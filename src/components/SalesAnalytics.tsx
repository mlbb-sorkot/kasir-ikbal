import React, { useMemo, useRef, useState } from 'react';
import { TrendingUp, Coins, ShoppingCart, Award, HardDriveDownload, Download, Trash2, RotateCcw, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Product, Transaction } from '../types';
import { formatRupiah } from '../utils';
import Modal from './Modal';

interface SalesAnalyticsProps {
  products: Product[];
  transactions: Transaction[];
  onResetDatabase: () => void;
  onImportDatabase: (products: Product[], transactions: Transaction[]) => void;
}

export default function SalesAnalytics({
  products,
  transactions,
  onResetDatabase,
  onImportDatabase,
}: SalesAnalyticsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  // 1. Overall aggregated statistics (Full history)
  const fullStats = useMemo(() => {
    let salesTotal = 0;
    let profitTotal = 0;
    
    transactions.forEach(t => {
      salesTotal += t.total;
      
      let totalCostOfGoods = t.items.reduce((acc, item) => acc + (item.buyPrice * item.quantity), 0);
      let netTxProfit = t.total - totalCostOfGoods;
      profitTotal += netTxProfit;
    });

    const averageTransactionVal = transactions.length > 0 ? salesTotal / transactions.length : 0;

    return {
      salesTotal,
      profitTotal,
      txCount: transactions.length,
      averageTransactionVal,
    };
  }, [transactions]);

  // 2. Best-selling products (Sorted by sales volume/quantity sold)
  const bestSellers = useMemo(() => {
    const itemQuantities: { [productId: string]: { name: string; sku: string; qty: number; revenue: number } } = {};

    transactions.forEach(t => {
      t.items.forEach(item => {
        if (!itemQuantities[item.productId]) {
          itemQuantities[item.productId] = {
            name: item.productName,
            sku: item.sku,
            qty: 0,
            revenue: 0,
          };
        }
        itemQuantities[item.productId].qty += item.quantity;
        itemQuantities[item.productId].revenue += item.total;
      });
    });

    return Object.values(itemQuantities)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5); // top 5 best sellers
  }, [transactions]);

  // 3. Payment preference percentages
  const paymentPreferences = useMemo(() => {
    let cashCount = 0;
    let qrisCount = 0;
    let bankCount = 0;

    transactions.forEach(t => {
      if (t.paymentMethod === 'cash') cashCount += t.total;
      else if (t.paymentMethod === 'qris') qrisCount += t.total;
      else if (t.paymentMethod === 'bank_transfer') bankCount += t.total;
    });

    const grandTotal = cashCount + qrisCount + bankCount || 1;

    return [
      { name: 'Uang Tunai', value: cashCount, percent: (cashCount / grandTotal) * 100, color: 'bg-amber-500' },
      { name: 'QRIS / Gopay / OVO', value: qrisCount, percent: (qrisCount / grandTotal) * 100, color: 'bg-teal-500' },
      { name: 'Transfer Bank', value: bankCount, percent: (bankCount / grandTotal) * 100, color: 'bg-indigo-500' },
    ].sort((a, b) => b.value - a.value);
  }, [transactions]);

  // 4. Export data to JSON file
  const handleExportData = () => {
    const backupObj = {
      version: 'IKBAL_KASIR_V2',
      timestamp: new Date().toISOString(),
      products,
      transactions,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `BACKUP_KASIR_IKBAL_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 5. Import backup JSON data
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.products && parsed.transactions) {
          setConfirmDialog({
            title: 'Konfirmasi',
            description: `Data backup valid terdeteksi! Jumlah produk: ${parsed.products.length}, Jumlah transaksi: ${parsed.transactions.length}. Apakah Anda yakin ingin menimpa database kasir saat ini dengan data backup ini?`,
            onConfirm: () => {
              setConfirmDialog(null);
              onImportDatabase(parsed.products, parsed.transactions);
              alert('Database kasir berhasil dipulihkan dari data backup!');
            },
          });
        } else {
          alert('Format berkas backup json tidak cocok dengan skema Kasir IKBAL.');
        }
      } catch (err) {
        alert('Gagal membaca berkas: JSON tidak valid.');
      }
    };
    reader.readAsText(file);
    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetClick = () => {
    setConfirmDialog({
      title: 'Konfirmasi',
      description: '⚠️ PERINGATAN KERAS! ⚠️ Tindakan ini akan menghapus SELURUH produk kustom dan seluruh riwayat transaksi penjualan. Apakah Anda ingin melanjutkan dan mereset kasir ke setelan pabrik (seeding default)?',
      onConfirm: () => {
        setConfirmDialog(null);
        onResetDatabase();
        alert('Kasir didefaultkan kembali!');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Omset */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Pendapatan (Omset Alur)</p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-2xl font-black font-mono tracking-tight text-slate-900">{formatRupiah(fullStats.salesTotal)}</h3>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-medium">Dari semenjak toko diluncurkan</p>
        </div>

        {/* Total Profit */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Margin Laba (Bersih)</p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-2xl font-black font-mono tracking-tight text-indigo-600">{formatRupiah(fullStats.profitTotal)}</h3>
          </div>
          <p className="text-[10px] text-indigo-500 font-semibold mt-2">Nilai bersih dikurangi modal kulakan</p>
        </div>

        {/* Average transaction Basket */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rata-rata Nilai Belanja</p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-2xl font-black font-mono tracking-tight text-slate-800">{formatRupiah(fullStats.averageTransactionVal)}</h3>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-medium">Nilai rata-rata per nota transaksi pelanggan</p>
        </div>
      </div>

      {/* Analytics charts breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Popularity Rankings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Produk Paling Laris</h4>
              <p className="text-xs text-slate-400">Peringkat 5 produk dengan volume penjualan tertinggi</p>
            </div>
            <Award size={18} className="text-indigo-600" />
          </div>

          <div className="space-y-3.5 flex-1 flex flex-col justify-center">
            {bestSellers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                Belum ada transaksi terekam untuk menyusun peringkat juara produk terlaris.
              </div>
            ) : (
              bestSellers.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-xs ${
                      idx === 0 ? 'bg-indigo-600 text-white shadow-sm' :
                      idx === 1 ? 'bg-indigo-100 text-indigo-700' :
                      idx === 2 ? 'bg-slate-200 text-slate-650' :
                      'bg-slate-100 text-slate-450'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="space-y-0.5 truncate">
                      <h5 className="text-xs font-bold text-slate-800 truncate">{item.name}</h5>
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">{item.sku}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-700 block">{item.qty} Terjual</span>
                    <span className="text-[10px] text-indigo-600 font-bold">{formatRupiah(item.revenue)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Preference Pie Chart (Simulated in clean tables) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h4 className="font-bold text-slate-900 text-sm">Preferensi Saluran Bayar</h4>
            <p className="text-xs text-slate-400">Menganalisis presentase sebaran tipe alat transaksi</p>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {transactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                Belum ada transaksi terekam untuk menyusun grafik sebaran finansial.
              </div>
            ) : (
              paymentPreferences.map((pref, idx) => {
                const accentColor = 
                  idx === 0 ? 'bg-indigo-600' :
                  idx === 1 ? 'bg-slate-900' :
                  'bg-slate-400';
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-755 text-slate-700">
                        <span className={`w-2.5 h-2.5 rounded-full ${accentColor}`} />
                        {pref.name}
                      </div>
                      <span className="font-mono text-slate-500 font-black">{pref.percent.toFixed(1)}%</span>
                    </div>
                    {/* Visual Bar representation */}
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${accentColor} transition-all duration-500`}
                        style={{ width: `${pref.percent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-bold block pl-4">
                      Omset: {formatRupiah(pref.value)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Admin Utilities (Wipe / Export / Import / Reset to seed template) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="border-b border-slate-100 pb-3 mb-4">
          <h4 className="font-bold text-rose-600 text-sm flex items-center gap-1.5">
            <AlertTriangle size={16} /> Konsol Pengaturan Administrasi & Backup
          </h4>
          <p className="text-xs text-slate-400">Kelola cadangan salinan database toko kelontong atau setel ulang data sistem</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Backup Action */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-left">
            <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <Download size={14} className="text-indigo-600" /> Unduh Salinan Cadangan
            </h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Unduh seluruh daftar persediaan produk dan semua daftar kuitansi kasir lunas saat ini dalam format berkas aman `.json` ke perangkat Anda.
            </p>
            <button
              onClick={handleExportData}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
            >
              Unduh JSON Backup &rarr;
            </button>
          </div>

          {/* Restore Backup Action */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-left">
            <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <HardDriveDownload size={14} className="text-slate-900" /> Pulihkan Data Cadangan
            </h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Impor berkas `.json` salinan cadangan yang telah Anda unduh sebelumnya untuk dikembalikan mutlak ke pencatatan kasir saat ini.
            </p>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportData}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
            >
              Unggah & Impor JSON
            </button>
          </div>

          {/* Danger wipe settings */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-left bg-rose-50/20 border-rose-100">
            <h5 className="text-xs font-bold text-rose-800 flex items-center gap-1">
              <RotateCcw size={14} className="text-rose-700" /> Setel Ulang ke Awal
            </h5>
            <p className="text-[11px] text-rose-600/80 leading-relaxed">
              Menghapus seluruh modifikasi produk, mereset stok, dan melenyapkan semua log kuitansi kasir kembali mutlak ke produk default warung kelontong IKBAL.
            </p>
            <button
              onClick={handleResetClick}
              className="w-full bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
            >
              Setel Ulang Pabrik
            </button>
          </div>
        </div>
      </div>

      {confirmDialog && (
        <Modal
          open={true}
          onClose={() => setConfirmDialog(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          actions={[
            { label: 'Batal', onClick: () => setConfirmDialog(null), variant: 'ghost' },
            { label: 'Ya, Lanjutkan', onClick: confirmDialog.onConfirm, variant: 'danger' },
          ]}
        />
      )}
    </div>
  );
}
