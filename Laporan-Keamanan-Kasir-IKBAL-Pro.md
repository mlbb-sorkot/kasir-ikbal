# Laporan Keamanan — Kasir IKBAL Pro

**Target:** https://kasir-ikbal.vercel.app/
**Repository:** github.com/mlbb-sorkot/kasir-ikbal
**Stack:** React + Vite (frontend), Firebase Authentication + Cloud Firestore (backend), hosting di Vercel
**Metode:** Static code review terhadap source code repository (bukan penetration testing aktif terhadap server live)
**Tanggal:** 21 Juni 2026

---

## Ringkasan Eksekutif

Secara umum arsitektur aplikasi ini sudah cukup baik — tidak ada server backend custom yang rentan injeksi SQL klasik, React sudah otomatis meng-escape output (tidak ditemukan `dangerouslySetInnerHTML`), dan source map sudah dimatikan saat build. Namun, ditemukan **satu kesalahan konfigurasi kritis pada Firestore Security Rules** yang membuat seluruh database bisa dibaca dan ditulis bebas oleh siapa pun yang berhasil login — termasuk berpotensi melakukan **eskalasi hak akses dari kasir menjadi admin**. Ini adalah satu-satunya celah yang masuk kategori kritis; sisanya bersifat menengah dan rendah, sesuai dengan permintaan Anda untuk perbaikan level menengah.

| # | Temuan | Tingkat Risiko |
|---|--------|-----------------|
| 1 | Firestore rules memiliki *wildcard rule* yang membuka akses penuh | 🔴 Kritis |
| 2 | User (termasuk kasir) bisa mengubah field `role` miliknya sendiri | 🟠 Tinggi |
| 3 | Total transaksi dihitung & dipercaya penuh dari sisi client | 🟠 Tinggi |
| 4 | Halaman "Setup Admin Pertama" dapat diakses publik | 🟡 Menengah |
| 5 | Skema username dapat ditebak + tidak ada App Check/CAPTCHA | 🟡 Menengah |
| 6 | Jejak migrasi dari skema password lama (kemungkinan plaintext) | 🟡 Menengah |
| 7 | Tidak ada audit trail (siapa menghapus/mengubah data) | 🟢 Rendah |
| 8 | Dependency `@google/genai` tidak terpakai | 🟢 Rendah |
| 9 | Kebijakan password lemah (minimal 6 karakter) | 🟢 Rendah |

---

## Temuan Detail

### 1. 🔴 Kritis — Firestore Rules: akses penuh untuk siapa saja yang login

File `firestore.rules` memiliki aturan ini di paling atas:

```
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

Di Firestore, jika ada beberapa aturan yang cocok dengan satu path, request akan diizinkan selama **salah satu** aturan mengizinkannya (bukan harus semua). Artinya aturan wildcard ini **mengalahkan** semua pembatasan yang lebih spesifik di bawahnya — pembatasan "hanya admin boleh menulis produk", "hanya admin boleh menghapus transaksi", semuanya jadi tidak efektif, karena aturan wildcard di atas sudah lebih dulu mengizinkan read **dan** write ke seluruh collection bagi siapa saja yang sudah login, apa pun role-nya.

**Dampak:** akun kasir biasa (atau akun siapa pun yang berhasil login) bisa langsung memanggil Firestore SDK dari browser untuk mengubah harga produk, mengubah/menghapus transaksi siapa pun, atau membaca seluruh data pengguna lain — tanpa perlu lewat tampilan aplikasi sama sekali.

**Perbaikan:** hapus aturan wildcard tersebut. Berikut versi rules yang sudah diperbaiki dan ditambah validasi dasar:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      // User biasa boleh update profil sendiri TAPI tidak boleh mengubah field role.
      allow update: if isSignedIn() && request.auth.uid == userId
                    && request.resource.data.role == resource.data.role;
      allow create, delete: if isAdmin();
    }

    match /products/{productId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /transactions/{txId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update: if false;
      allow delete: if isAdmin();
    }

    // Tidak ada wildcard fallback — apa pun yang tidak match di atas otomatis ditolak.
  }
}
```

Setelah mengedit, jangan lupa **deploy ulang** rules-nya (`firebase deploy --only firestore:rules`, atau paste manual ke Firebase Console → Firestore → Rules). Mengubah file di repo saja tidak otomatis berlaku di production.

---

### 2. 🟠 Tinggi — Eskalasi hak akses lewat field `role`

Terkait erat dengan temuan #1: bahkan tanpa wildcard, aturan asli untuk `/users/{userId}` mengizinkan user menulis ke dokumennya sendiri tanpa membatasi field apa yang boleh diubah:

```
allow write: if request.auth != null && request.auth.uid == userId;
```

Karena dokumen user menyimpan field `role` (`admin` / `kasir`) yang dipakai untuk menentukan hak akses di seluruh aplikasi, seorang kasir yang login bisa langsung memanggil `setDoc` ke dokumennya sendiri dan mengubah `role: "kasir"` menjadi `role: "admin"` — lalu refresh halaman, dan tampilan admin akan terbuka.

**Perbaikan:** sudah termasuk dalam rules di atas — baris `request.resource.data.role == resource.data.role` memastikan field `role` tidak bisa diubah lewat self-update; perubahan role hanya boleh dilakukan oleh admin lain.

---

### 3. 🟠 Tinggi — Total transaksi sepenuhnya dipercaya dari client

Di `POSTerminal.tsx`, subtotal dan total dihitung di browser dari `item.product.sellPrice * item.quantity`, lalu seluruh objek transaksi (termasuk `total`, `amountPaid`) langsung ditulis ke Firestore lewat `addTransaction()`. Tidak ada validasi di sisi server/rules yang memastikan angka-angka ini konsisten dengan data produk yang sebenarnya.

**Dampak:** karena tidak ada backend API custom (semua langsung dari client ke Firestore), seseorang yang mengerti cara kerja Firestore SDK bisa memanipulasi request untuk mencatat transaksi dengan total lebih rendah dari yang sebenarnya dibayar pelanggan — risiko kecurangan internal (misalnya kasir nakal) atau manipulasi laporan penjualan.

**Perbaikan (level menengah, realistis untuk arsitektur tanpa backend):**
- Tambahkan validasi dasar di Firestore Rules untuk collection `transactions`, misalnya memastikan `total` adalah angka positif dan field wajib (`items`, `total`, `timestamp`) ada.
- Untuk validasi yang lebih kuat (memastikan total = harga produk asli × qty), pertimbangkan memindahkan proses pembuatan transaksi ke **Cloud Function** yang menghitung ulang total dari harga produk di database, bukan menerima total dari client mentah-mentah. Ini levelnya lebih advance, tapi adalah praktik standar untuk sistem kasir/pembayaran.

---

### 4. 🟡 Menengah — Wizard "Setup Admin Pertama" terbuka di halaman publik

`Login.tsx` punya mode `setup` yang otomatis muncul kalau aplikasi gagal membaca collection `users` (misalnya karena rules belum ter-deploy, atau koneksi error). Di mode ini, siapa pun yang membuka situs bisa langsung membuat akun dengan role `admin`.

Selama rules sudah benar dan ter-deploy, jalur ini seharusnya selalu gagal untuk pengunjung yang belum login (karena baca `users` butuh auth). Tapi ini bergantung 100% pada rules selalu benar — kalau suatu saat rules ter-reset/ter-skip (misalnya saat redeploy project baru, testing, dsb), siapa pun yang kebetulan membuka situs duluan bisa mengambil alih sebagai admin pertama.

**Perbaikan:** jangan andalkan rules sebagai satu-satunya penjaga. Setelah admin pertama berhasil dibuat, sebaiknya nonaktifkan/hapus jalur "setup" ini dari build production (misalnya lewat environment flag), dan buat admin pertama lewat Firebase Console secara manual atau script terpisah yang tidak ter-expose ke publik.

---

### 5. 🟡 Menengah — Skema username mudah ditebak, tanpa proteksi brute-force tambahan

Email login dibentuk otomatis dari username: `username@kasir.app` (lihat `getEmail()` di `Login.tsx`). Username toko kasir biasanya mudah ditebak (`admin`, `kasir`, `kasir1`, nama toko, dst). Karena Firebase API key memang publik by design, siapa pun secara teknis bisa mencoba login langsung ke Firebase Authentication REST API dengan menebak kombinasi username+password tanpa lewat UI aplikasi sama sekali. Firebase punya rate-limiting bawaan (muncul di kode sebagai `auth/too-many-requests`), tapi ini bukan proteksi yang didesain khusus untuk mencegah scripted brute-force.

**Perbaikan:**
- Aktifkan **Firebase App Check** di project Firebase Console — ini memastikan hanya request dari aplikasi web Anda yang sah (bukan script luar) yang bisa memanggil Auth/Firestore.
- Di Google Cloud Console, batasi API key Firebase Anda dengan **HTTP referrer restriction** agar hanya bisa dipakai dari domain `kasir-ikbal.vercel.app`.
- Pertimbangkan menaikkan minimum panjang password (lihat temuan #9) dan tambahkan 2FA khusus untuk akun admin.

---

### 6. 🟡 Menengah — Sisa migrasi dari skema password lama

Kode `Login.tsx` punya mode `migrate` yang aktif kalau ditemukan dokumen user dengan field `password` tersimpan langsung di Firestore — pertanda versi aplikasi sebelumnya pernah menyimpan password (kemungkinan plaintext) sebagai field database biasa, sebelum pindah ke Firebase Authentication yang sebenarnya.

**Perbaikan:**
- Cek langsung di Firebase Console apakah masih ada dokumen `users` lama dengan field `password`. Jika ada, hapus field tersebut sepenuhnya setelah migrasi selesai.
- Karena password lama mungkin pernah tersimpan plaintext, **anggap password tersebut sudah bocor** — minta semua user yang masih pakai password lama untuk mengganti password mereka.

---

### 7. 🟢 Rendah — Tidak ada audit trail

Tidak ada field seperti `createdBy`, `updatedAt`, atau log perubahan pada produk/transaksi. Kalau terjadi kejanggalan data (harga berubah, transaksi hilang), tidak ada cara melacak siapa pelakunya.

**Perbaikan:** tambahkan field `createdBy: request.auth.uid` saat membuat/mengubah dokumen, dan pertimbangkan Cloud Function `onWrite` untuk mencatat log perubahan ke collection terpisah (`audit_logs`).

---

### 8. 🟢 Rendah — Dependency tidak terpakai (`@google/genai`)

Proyek ini dibuat dari template Google AI Studio dan masih membawa dependency `@google/genai`, tapi tidak dipakai di kode (`src/`). Tidak ditemukan API key Gemini ter-bundle di client, jadi ini bukan kebocoran kredensial — tapi dependency yang tidak terpakai menambah luas permukaan serangan (kerentanan di package tersebut tetap bisa memengaruhi build Anda) dan ukuran bundle.

**Perbaikan:** jalankan `npm uninstall @google/genai` jika memang tidak dipakai.

---

### 9. 🟢 Rendah — Kebijakan password lemah

Validasi password di form hanya `minLength={6}`, tanpa syarat kombinasi huruf/angka/simbol.

**Perbaikan:** naikkan minimal ke 8-10 karakter, dan pertimbangkan mengaktifkan fitur **Password Policy** bawaan Firebase Authentication (tersedia di Firebase Console → Authentication → Settings) agar enforcement terjadi di level server, bukan cuma di form.

---

## Hal yang Sudah Baik (tidak perlu diubah)

- Tidak ada `dangerouslySetInnerHTML`, `innerHTML`, atau `eval()` — risiko XSS dari React rendah karena escaping otomatis.
- Source map dimatikan saat build (`sourcemap: false` di `vite.config.ts`) — struktur kode tidak mudah dibongkar dari production build.
- Tidak ada file `.env` yang ter-commit ke repository, dan `.gitignore` sudah benar mengecualikan `.env*`.
- Field `apiKey` Firebase di `firebase.ts` memang **bukan rahasia** — ini desain normal Firebase, keamanan sebenarnya ada di Firestore Rules (makanya temuan #1 jadi prioritas utama, bukan API key-nya).
- Field `update: false` pada rules transaksi sudah benar secara desain (transaksi tidak boleh diedit) — hanya perlu diperbaiki agar wildcard tidak membatalkannya.

---

## Prioritas Tindakan

1. **Segera:** ganti `firestore.rules` dengan versi yang sudah diperbaiki di atas, lalu deploy ke Firebase Console. Ini menutup celah paling kritis.
2. **Minggu ini:** audit data `users` lama untuk field `password` plaintext, paksa ganti password yang terdampak; nonaktifkan halaman setup admin dari production.
3. **Bulan ini:** aktifkan Firebase App Check, batasi API key dengan HTTP referrer, naikkan kebijakan password, tambahkan audit trail dasar.
4. **Jika sumber daya memungkinkan:** pindahkan kalkulasi total transaksi ke Cloud Function agar tidak 100% dipercaya dari client.

---

*Catatan: laporan ini berdasarkan analisis kode sumber publik di repository, bukan pengujian intrusif terhadap server live. Setelah perbaikan diterapkan, disarankan melakukan pengujian ulang (misalnya coba login sebagai kasir lalu coba ubah role sendiri lewat console browser) untuk memverifikasi rules baru benar-benar efektif.*
