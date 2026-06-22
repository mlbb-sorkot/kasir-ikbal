import React, { useState, useMemo } from 'react';
import { Search, Eye, Printer, Trash2, FileText, X, CalendarDays, TrendingUp } from 'lucide-react';
import { Transaction } from '../types';
import { formatRupiah, formatDate } from '../utils';
import Tooltip from './Tooltip';

interface TransactionsHistoryProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  filterTodayOnly?: boolean;
  allowDelete?: boolean;
}

type HistoryView = 'semua' | 'harian' | 'mingguan';

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return Math.ceil((date.getDate() + firstDay) / 7);
}

export default function TransactionsHistory({
  transactions,
  onDeleteTransaction,
  filterTodayOnly = false,
  allowDelete = true,
}: TransactionsHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [viewingReceipt, setViewingReceipt] = useState<Transaction | null>(null);
  const [historyView, setHistoryView] = useState<HistoryView>('semua');

  // Base filtered (for Kasir's today-only view)
  const baseTransactions = useMemo(() => {
    if (filterTodayOnly) {
      const todayStr = new Date().toLocaleDateString('id-ID');
      return transactions.filter(t => new Date(t.timestamp).toLocaleDateString('id-ID') === todayStr);
    }
    return transactions;
  }, [transactions, filterTodayOnly]);

  // "Semua" tab: search + method filter
  const filteredTransactions = useMemo(() => {
    return baseTransactions.filter(t => {
      const matchSearch = t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.cashierName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMethod = filterMethod === 'all' || t.paymentMethod === filterMethod;
      return matchSearch && matchMethod;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [baseTransactions, searchTerm, filterMethod]);

  const totalFilteredRevenue = useMemo(() =>
    filteredTransactions.reduce((acc, t) => acc + t.total, 0),
  [filteredTransactions]);

  // "Harian" tab: group by calendar date
  const dailyGroups = useMemo(() => {
    const map = new Map<string, { label: string; sortKey: string; count: number; revenue: number }>();
    transactions.forEach(t => {
      const d = new Date(t.timestamp);
      const key = d.toLocaleDateString('id-ID'); // dd/mm/yyyy local
      const day = d.getDate();
      const month = MONTHS_ID[d.getMonth()];
      const year = d.getFullYear();
      const dayName = DAYS_ID[d.getDay()];
      const label = `${dayName}, ${day} ${month} ${year}`;
      const sortKey = d.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, { label, sortKey, count: 0, revenue: 0 });
      }
      const entry = map.get(key)!;
      entry.count += 1;
      entry.revenue += t.total;
    });
    return Array.from(map.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [transactions]);

  // "Mingguan" tab: group by week-of-month within each month
  const weeklyGroups = useMemo(() => {
    const map = new Map<string, { label: string; sortKey: string; count: number; revenue: number }>();
    transactions.forEach(t => {
      const d = new Date(t.timestamp);
      const week = getWeekOfMonth(d);
      const month = MONTHS_ID[d.getMonth()];
      const year = d.getFullYear();
      const key = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-W${week}`;
      const label = `Minggu ke-${week} — ${month} ${year}`;
      if (!map.has(key)) {
        map.set(key, { label, sortKey: key, count: 0, revenue: 0 });
      }
      const entry = map.get(key)!;
      entry.count += 1;
      entry.revenue += t.total;
    });
    return Array.from(map.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [transactions]);

  const handleDeleteConfirm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Apakah Anda yakin ingin membatalkan transaksi "${id}"? Stok tidak akan otomatis dikembalikan.`)) {
      onDeleteTransaction(id);
    }
  };

  return (
    <div className="space-y-4">

      {/* View Tabs — only for admin full history */}
      {!filterTodayOnly && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-1.5 flex gap-1">
          {(['semua', 'harian', 'mingguan'] as HistoryView[]).map(view => (
            <button
              key={view}
              onClick={() => setHistoryView(view)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                historyView === view
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              {view === 'semua' ? 'Semua Transaksi' : view === 'harian' ? 'Rekap Harian' : 'Rekap Mingguan'}
            </button>
          ))}
        </div>
      )}

      {/* HARIAN VIEW */}
      {!filterTodayOnly && historyView === 'harian' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-200 flex items-center gap-2">
            <CalendarDays size={16} className="text-indigo-500" />
            <h3 className="font-bold text-sm text-neutral-700">Rekap Penjualan per Hari</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3 text-center">Jumlah Transaksi</th>
                  <th className="px-5 py-3 text-right">Total Omset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 text-sm">
                {dailyGroups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-neutral-400">
                      Belum ada data transaksi.
                    </td>
                  </tr>
                ) : (
                  dailyGroups.map((g, i) => (
                    <tr key={i} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-neutral-700">{g.label}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="bg-indigo-50 text-indigo-700 font-bold text-xs px-3 py-1 rounded-full">
                          {g.count} nota
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-black font-mono text-neutral-800">
                        {formatRupiah(g.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {dailyGroups.length > 0 && (
                <tfoot>
                  <tr className="bg-neutral-50 border-t-2 border-neutral-200">
                    <td className="px-5 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Keseluruhan</td>
                    <td className="px-5 py-3 text-center text-xs font-bold text-neutral-600">
                      {dailyGroups.reduce((s, g) => s + g.count, 0)} nota
                    </td>
                    <td className="px-5 py-3 text-right font-black font-mono text-indigo-700">
                      {formatRupiah(dailyGroups.reduce((s, g) => s + g.revenue, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* MINGGUAN VIEW */}
      {!filterTodayOnly && historyView === 'mingguan' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-200 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <h3 className="font-bold text-sm text-neutral-700">Rekap Penjualan per Minggu</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-5 py-3">Periode Minggu</th>
                  <th className="px-5 py-3 text-center">Jumlah Transaksi</th>
                  <th className="px-5 py-3 text-right">Total Omset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 text-sm">
                {weeklyGroups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-neutral-400">
                      Belum ada data transaksi.
                    </td>
                  </tr>
                ) : (
                  weeklyGroups.map((g, i) => (
                    <tr key={i} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-neutral-700">{g.label}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-3 py-1 rounded-full">
                          {g.count} nota
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-black font-mono text-neutral-800">
                        {formatRupiah(g.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {weeklyGroups.length > 0 && (
                <tfoot>
                  <tr className="bg-neutral-50 border-t-2 border-neutral-200">
                    <td className="px-5 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Keseluruhan</td>
                    <td className="px-5 py-3 text-center text-xs font-bold text-neutral-600">
                      {weeklyGroups.reduce((s, g) => s + g.count, 0)} nota
                    </td>
                    <td className="px-5 py-3 text-right font-black font-mono text-emerald-700">
                      {formatRupiah(weeklyGroups.reduce((s, g) => s + g.revenue, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* SEMUA / Default Transaction Table */}
      {(filterTodayOnly || historyView === 'semua') && (
        <>
          {/* Riwayat Hari Ini summary banner */}
          {filterTodayOnly && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Total Penjualan Hari Ini</p>
                <p className="text-2xl font-black font-mono text-indigo-800">{formatRupiah(totalFilteredRevenue)}</p>
              </div>
              <p className="text-sm font-bold text-indigo-600">{filteredTransactions.length} nota</p>
            </div>
          )}

          {/* Filtering Controller Panel */}
          <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-neutral-400" size={17} />
                <input
                  type="text"
                  placeholder="Cari ID transaksi atau nama kasir..."
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
              >
                <option value="all">Semua Metode Bayar</option>
                <option value="cash">Tunai (Cash)</option>
                <option value="qris">QRIS / E-Wallet</option>
                <option value="bank_transfer">Transfer Bank</option>
              </select>
            </div>
            {!filterTodayOnly && (
              <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Omset Filtered</p>
                  <p className="text-sm font-bold font-mono text-emerald-950">{formatRupiah(totalFilteredRevenue)}</p>
                </div>
                <p className="text-xs font-semibold text-emerald-800">{filteredTransactions.length} nota</p>
              </div>
            )}
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto text-[11px] leading-relaxed">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-500 uppercase text-[10px] font-bold tracking-wider select-none border-b border-neutral-200/60">
                    <th className="p-4">Tanggal &amp; Waktu</th>
                    <th className="p-4">No. Nota / ID Transaksi</th>
                    <th className="p-4">Petugas Kasir</th>
                    <th className="p-4">Item Produk Terjual</th>
                    <th className="p-4 text-center">Sistem Bayar</th>
                    <th className="p-4 text-right">Total Tagihan</th>
                    <th className="p-4 text-right">Kelola</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-neutral-400 font-medium">
                        Belum ada riwayat transaksi yang terekam atau cocok dengan pencarian Anda.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(t => {
                      const itemsSummary = t.items.map(i => `${i.productName} (${i.quantity})`).join(', ');
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setViewingReceipt(t)}
                          className="hover:bg-neutral-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="p-4 font-semibold text-neutral-500">{formatDate(t.timestamp)}</td>
                          <td className="p-4 font-mono font-bold text-neutral-800 uppercase group-hover:text-emerald-700 transition-colors">
                            {t.id}
                          </td>
                          <td className="p-4 uppercase font-semibold text-neutral-600">{t.cashierName}</td>
                          <td className="p-4 font-normal text-neutral-500 max-w-[240px] truncate">
                            <Tooltip text={itemsSummary}>
                              <span>{itemsSummary}</span>
                            </Tooltip>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              t.paymentMethod === 'cash' ? 'bg-amber-100 text-amber-800' :
                              t.paymentMethod === 'qris' ? 'bg-teal-100 text-teal-800' :
                              'bg-indigo-100 text-indigo-800'
                            }`}>
                              {t.paymentMethod}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-neutral-900 font-mono">
                            {formatRupiah(t.total)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setViewingReceipt(t); }}
                                className="p-1 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-md transition-colors"
                              >
                                <Eye size={14} />
                              </button>
                              {allowDelete && (
                                <Tooltip text="Batalkan Transaksi">
                                  <button
                                    onClick={(e) => handleDeleteConfirm(t.id, e)}
                                    className="p-1 text-neutral-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Receipt Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-neutral-800 text-white px-5 py-4 flex items-center justify-between no-print">
              <div className="flex items-center gap-1.5">
                <FileText size={16} />
                <h4 className="font-bold text-sm">Lihat Detail Transaksi</h4>
              </div>
              <button onClick={() => setViewingReceipt(null)} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto bg-neutral-100">
              <div className="bg-white p-6 border shadow-xs rounded-lg font-mono text-[11px] text-neutral-700 leading-relaxed max-w-xs mx-auto">
                <div className="text-center space-y-1 pb-4 border-b border-dashed border-neutral-300">
                  <h3 className="text-sm font-extrabold text-neutral-800 uppercase tracking-wider">Toko IKBAL POS</h3>
                  <p className="text-[10px] text-neutral-500">Kelola Stok &amp; Penjualan Efisien</p>
                  <p className="text-[9px] text-neutral-400">Jl. Raya Utama No. 88, Sorkot</p>
                </div>

                <div className="py-3 border-b border-dashed border-neutral-300 space-y-0.5 text-[9px] text-neutral-500">
                  <div className="flex justify-between">
                    <span>No. Nota:</span>
                    <span className="font-semibold text-neutral-700">{viewingReceipt.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>{new Date(viewingReceipt.timestamp).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span className="capitalize">{viewingReceipt.cashierName}</span>
                  </div>
                </div>

                <div className="py-3 border-b border-dashed border-neutral-300 space-y-2">
                  {viewingReceipt.items.map((item, index) => (
                    <div key={index} className="space-y-0.5">
                      <div className="font-bold text-neutral-800 flex justify-between">
                        <span className="max-w-[170px] wrap-break-word">{item.productName}</span>
                        <span>{formatRupiah(item.total)}</span>
                      </div>
                      <div className="text-[10px] text-neutral-500 flex justify-between">
                        <span>{item.quantity} x {formatRupiah(item.sellPrice)}</span>
                        <span>SKU: {item.sku}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="py-3 text-[10px] space-y-1 font-semibold text-neutral-600 border-b border-dashed border-neutral-200">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatRupiah(viewingReceipt.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-neutral-800 pt-1 border-t border-neutral-100">
                    <span>TOTAL KESELURUHAN:</span>
                    <span>{formatRupiah(viewingReceipt.total)}</span>
                  </div>
                </div>

                <div className="py-3 text-[10px] space-y-1 font-semibold text-neutral-600">
                  <div className="flex justify-between">
                    <span>Metode:</span>
                    <span className="uppercase">{viewingReceipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bayar:</span>
                    <span>{formatRupiah(viewingReceipt.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-800 pt-1 border-t border-neutral-100">
                    <span>KEMBALIAN:</span>
                    <span>{formatRupiah(viewingReceipt.change)}</span>
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-dashed border-neutral-300 space-y-0.5">
                  <p className="text-[9px] font-bold text-neutral-800">*** PRINT COPY ***</p>
                  <p className="text-[8px] text-neutral-400">Terima kasih atas kerja samanya.</p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-100 p-4 border-t border-neutral-200 flex gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Printer size={13} /> Cetak Nota
              </button>
              <button
                onClick={() => setViewingReceipt(null)}
                className="flex-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer text-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
