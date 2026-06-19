import { useState, FormEvent, useEffect } from 'react';
import { Store, Lock, User as UserIcon, ArrowRight, AlertTriangle } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';
import { getUserProfile, createUserProfile } from '../db';

interface LoginProps {
  onLogin: (user: User) => void;
}

type PageMode = 'loading' | 'setup' | 'login' | 'migrate';

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<PageMode>('loading');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (snap.empty) {
          setMode('setup');
          return;
        }

        const hasPasswordField = snap.docs.some(d => d.data().password !== undefined);
        if (hasPasswordField) {
          setMode('migrate');
        } else {
          setMode('login');
        }
      } catch (err: any) {
        // permission-denied = Firestore rules aktif & user sudah ada
        if (err.code === 'permission-denied') {
          setMode('login');
        } else {
          setMode('setup');
        }
      }
    })();
  }, []);

  const getEmail = (user: string) => `${user.toLowerCase().replace(/[^a-z0-9]/g, '')}@kasir.app`;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const email = getEmail(username);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(cred.user.uid);

      if (!profile) {
        setError('Akun ditemukan tetapi profil tidak lengkap. Hubungi admin.');
        setIsSubmitting(false);
        return;
      }

      onLogin(profile);
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Username atau password salah.');
      } else if (code === 'auth/too-many-requests') {
        setError('Terlalu banyak percobaan login. Coba lagi nanti.');
      } else {
        setError(`Gagal login: ${err.message}`);
      }
      setIsSubmitting(false);
    }
  };

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!displayName.trim()) {
      setError('Nama admin harus diisi.');
      setIsSubmitting(false);
      return;
    }

    try {
      const email = getEmail(username);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await createUserProfile(cred.user.uid, email, 'admin', displayName.trim());

      const user: User = {
        uid: cred.user.uid,
        email,
        role: 'admin',
        name: displayName.trim()
      };
      onLogin(user);
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/email-already-in-use') {
        setError('Username ini sudah terdaftar. Silakan login.');
      } else if (code === 'auth/weak-password') {
        setError('Password terlalu lemah. Minimal 6 karakter.');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Login dengan Email/Password belum diaktifkan di Firebase Console > Authentication.');
      } else {
        setError(`Gagal: ${err.message}`);
      }
      setIsSubmitting(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md bg-neutral-800/60 backdrop-blur-2xl border border-neutral-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl z-10">

        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-linear-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
            <Store size={32} className="stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            IKBAL<span className="text-indigo-400 font-black italic uppercase text-xs tracking-wider bg-indigo-400/10 px-2 py-1 rounded-md">Pro</span>
          </h1>
          <p className="text-neutral-400 text-sm mt-3 font-medium">
            {mode === 'setup' ? 'Setup Admin Pertama' :
             mode === 'migrate' ? 'Migrasi ke Sistem Baru' :
             'Sistem Manajemen Kasir'}
          </p>
        </div>

        <form onSubmit={
          mode === 'setup' || mode === 'migrate' ? handleSetup :
          handleLogin
        } className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}

          {mode === 'migrate' && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-4 rounded-2xl flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <strong>Data pengguna lama terdeteksi.</strong><br />
                Masukkan username dan password baru untuk membuat akun admin di sistem keamanan baru. Data produk & transaksi tetap aman.
              </div>
            </div>
          )}

          {mode === 'setup' && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs p-4 rounded-2xl">
              <strong>Setup Awal:</strong> Buat akun admin pertama.
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-indigo-400 transition-colors">
                <UserIcon size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-neutral-900/50 border border-neutral-700 text-white rounded-2xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600"
                placeholder={mode === 'migrate' ? 'Buat username baru (contoh: admin)' : 'Masukkan username'}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-indigo-400 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-900/50 border border-neutral-700 text-white rounded-2xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600"
                placeholder={mode === 'migrate' || mode === 'setup' ? 'Buat password baru (min 6 karakter)' : 'Masukkan password'}
                required
                minLength={6}
              />
            </div>
          </div>

          {(mode === 'setup' || mode === 'migrate') && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Nama Lengkap Admin</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-indigo-400 transition-colors">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-neutral-700 text-white rounded-2xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600"
                  placeholder="Contoh: Admin Toko"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl py-4 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-4 shadow-lg shadow-indigo-600/20"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>{
                  mode === 'setup' ? 'Buat Akun Admin' :
                  mode === 'migrate' ? 'Migrasi & Login' :
                  'Masuk ke Sistem'
                }</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {mode === 'setup' && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-xs text-neutral-500 hover:text-neutral-300 font-semibold underline underline-offset-2 cursor-pointer"
            >
              Kembali ke Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
