import { useMemo, useState } from 'react';
import { TrendingUp, Coins, ShoppingCart, AlertTriangle, ArrowRight, Plus, RefreshCw } from 'lucide-react';
import { Product, Transaction } from '../types';
import { formatRupiah } from '../utils';
import Tooltip from './Tooltip';

interface DashboardOverviewProps {
  products: Product[];
  transactions: Transaction[];
  onNavigate: (tab: 'pos' | 'stock' | 'history' | 'analytics') => void;
  onRestock: (productId: string, amount: number) => void;
}

export default function DashboardOverview({
  products,
  transactions,
  onNavigate,
  onRestock,
}: DashboardOverviewProps) {
  const [restockAmts, setRestockAmts] = useState<{ [key: string]: number }>({});

  // Use actual today's date dynamically
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const metrics = useMemo(() => {
    // Filter transactions happening today (in Local Time / UTC depends on date comparison)
    const todayTransactions = transactions.filter(t => {
      const datePart = t.timestamp.split('T')[0];
      return datePart === todayStr;
    });

    let todayRevenue = 0;
    let todayProfit = 0;
    let todayTxCount = todayTransactions.length;

    todayTransactions.forEach(t => {
      todayRevenue += t.total;
      
      // Calculate profit by comparing transaction sell price with the actual purchase cost
      let transactionProfit = 0;
      t.items.forEach(item => {
        const itemProfit = (item.sellPrice - item.buyPrice) * item.quantity;
        transactionProfit += itemProfit;
      });

      // Adjust for discount proportionately
      // Profit is Revenue - CostOfGoodsSold
      // Net Profit = (revenue of this transaction) - CostOfGoodsSold
      let totalCostOfGoods = t.items.reduce((acc, item) => acc + (item.buyPrice * item.quantity), 0);
      let netTxProfit = t.total - totalCostOfGoods;
      todayProfit += netTxProfit;
    });

    const lowStockItems = products.filter(p => p.stock <= p.minStock);

    return {
      todayRevenue,
      todayProfit,
      todayTxCount,
      lowStockCount: lowStockItems.length,
      lowStockItems,
    };
  }, [products, transactions]);

  // Breakdown of sales by category
  const categorySales = useMemo(() => {
    const counts: { [category: string]: number } = {};
    
    // Initialize
    products.forEach(p => {
      if (!counts[p.category]) counts[p.category] = 0;
    });

    transactions.forEach(t => {
      t.items.forEach(item => {
        // Find product to get its category (or default)
        const prod = products.find(p => p.id === item.productId);
        const cat = prod ? prod.category : 'Lainnya';
        counts[cat] = (counts[cat] || 0) + item.total;
      });
    });

    // Format list sorted by revenue
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [products, transactions]);

  const maxCategoryValue = useMemo(() => {
    return Math.max(...categorySales.map(c => c.value), 1);
  }, [categorySales]);

  // Daily sales chart data — last 14 days
  const dailyChartData = useMemo(() => {
    const days: { dateStr: string; label: string; revenue: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNum = d.getDate();
      const monthShort = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][d.getMonth()];
      const label = `${dayNum} ${monthShort}`;
      const revenue = transactions
        .filter(t => t.timestamp.split('T')[0] === dateStr)
        .reduce((s, t) => s + t.total, 0);
      days.push({ dateStr, label, revenue });
    }
    return days;
  }, [transactions]);

  const maxDailyRevenue = useMemo(() =>
    Math.max(...dailyChartData.map(d => d.revenue), 1)
  , [dailyChartData]);

  // Monthly sales chart data — last 12 months
  const monthlyChartData = useMemo(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const today = new Date();
    const months: { key: string; label: string; revenue: number; isCurrentMonth: boolean }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${MONTHS[month]}`;
      const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
      const revenue = transactions
        .filter(t => {
          const ts = t.timestamp.slice(0, 7); // yyyy-MM
          return ts === key;
        })
        .reduce((s, t) => s + t.total, 0);
      months.push({ key, label, revenue, isCurrentMonth });
    }
    return months;
  }, [transactions]);

  const maxMonthlyRevenue = useMemo(() =>
    Math.max(...monthlyChartData.map(m => m.revenue), 1)
  , [monthlyChartData]);

  const handleRestockClick = (productId: string) => {
    const amount = restockAmts[productId] || 10;
    onRestock(productId, amount);
    // Clear state
    setRestockAmts(prev => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omset Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Omset Hari Ini</p>
            <h3 className="text-xl font-black font-mono tracking-tight text-slate-800">{formatRupiah(metrics.todayRevenue)}</h3>
            <p className="text-[11px] text-slate-400">Total kotor pembayaran pelanggan</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Keuntungan Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laba Bersih Hari Ini</p>
            <h3 className="text-xl font-black font-mono tracking-tight text-emerald-600">{formatRupiah(metrics.todayProfit)}</h3>
            <p className="text-[11px] text-slate-400">Keuntungan setelah dikurangi modal</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <Coins size={24} />
          </div>
        </div>

        {/* Transaksi Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaksi Sukses</p>
            <h3 className="text-xl font-black font-mono tracking-tight text-indigo-600">{metrics.todayTxCount} nota</h3>
            <p className="text-[11px] text-slate-400">Jumlah penjualan hari ini</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <ShoppingCart size={24} />
          </div>
        </div>

        {/* Peringatan Stok Card */}
        <button
          onClick={() => onNavigate('stock')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between text-left group hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peringatan Kritis Stok</p>
            <h3 className={`text-xl font-black font-mono tracking-tight ${metrics.lowStockCount > 0 ? 'text-amber-500' : 'text-slate-500'}`}>
              {metrics.lowStockCount} Produk
            </h3>
            <p className="text-[11px] text-slate-400 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
              Lihat tabel ketersediaan stok <ArrowRight size={12} />
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metrics.lowStockCount > 0 ? 'bg-amber-50 text-amber-500 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
            <AlertTriangle size={24} />
          </div>
        </button>
      </div>

      {/* Daily Sales Bar Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Grafik Penjualan Harian</h3>
            <p className="text-xs text-slate-400 mt-0.5">Omset 14 hari terakhir</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Periode</p>
            <p className="text-sm font-black font-mono text-indigo-600">
              {formatRupiah(dailyChartData.reduce((s, d) => s + d.revenue, 0))}
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="px-5 pb-5">
          <div className="flex items-end gap-1.5 h-36 w-full">
            {dailyChartData.map((day) => {
              const pct = day.revenue / maxDailyRevenue;
              const isToday = day.dateStr === todayStr;
              const barH = Math.max(pct * 100, day.revenue > 0 ? 4 : 1);
              return (
                <div
                  key={day.dateStr}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                >
                  {/* Tooltip */}
                  {day.revenue > 0 && (
                    <div className="absolute bottom-[calc(100%+2px)] left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {formatRupiah(day.revenue)}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                    </div>
                  )}
                  {/* Bar */}
                  <div className="w-full flex items-end" style={{ height: '128px' }}>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        isToday
                          ? 'bg-indigo-600 group-hover:bg-indigo-500'
                          : 'bg-slate-200 group-hover:bg-indigo-300'
                      }`}
                      style={{ height: `${barH}%` }}
                    />
                  </div>
                  {/* Label */}
                  <span className={`text-[9px] font-bold truncate w-full text-center ${
                    isToday ? 'text-indigo-600' : 'text-slate-400'
                  }`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Y-axis hint */}
          <div className="flex justify-between mt-2 border-t border-slate-100 pt-2">
            <span className="text-[9px] text-slate-300 font-mono">Rp 0</span>
            <span className="text-[9px] text-slate-400 font-mono">{formatRupiah(maxDailyRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Monthly Sales Bar Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Grafik Penjualan Bulanan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Omset 12 bulan terakhir</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Setahun</p>
            <p className="text-sm font-black font-mono text-emerald-600">
              {formatRupiah(monthlyChartData.reduce((s, m) => s + m.revenue, 0))}
            </p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-end gap-1.5 h-36 w-full">
            {monthlyChartData.map((month) => {
              const pct = month.revenue / maxMonthlyRevenue;
              const barH = Math.max(pct * 100, month.revenue > 0 ? 4 : 1);
              return (
                <div
                  key={month.key}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                >
                  {/* Tooltip */}
                  {month.revenue > 0 && (
                    <div className="absolute bottom-[calc(100%+2px)] left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {formatRupiah(month.revenue)}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                    </div>
                  )}
                  {/* Bar */}
                  <div className="w-full flex items-end" style={{ height: '128px' }}>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        month.isCurrentMonth
                          ? 'bg-emerald-500 group-hover:bg-emerald-400'
                          : 'bg-slate-200 group-hover:bg-emerald-300'
                      }`}
                      style={{ height: `${barH}%` }}
                    />
                  </div>
                  {/* Label */}
                  <span className={`text-[9px] font-bold truncate w-full text-center ${
                    month.isCurrentMonth ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {month.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 border-t border-slate-100 pt-2">
            <span className="text-[9px] text-slate-300 font-mono">Rp 0</span>
            <span className="text-[9px] text-slate-400 font-mono">{formatRupiah(maxMonthlyRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Main Section split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side: Restock & Action Cards */}
        <div className="lg:col-span-3 space-y-6">
          {/* Quick Restocking Box */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                <h4 className="font-bold text-sm text-slate-850">Barang Perlu Restok</h4>
              </div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                Di Bawah Minimal Stok
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
              {metrics.lowStockItems.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-500">Keren! Semua stok barang aman dan tercukupi.</p>
                  <button 
                    onClick={() => onNavigate('pos')}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    Buka Kasir POS untuk Jual &rarr;
                  </button>
                </div>
              ) : (
                metrics.lowStockItems.map(p => (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{p.sku}</p>
                      <h5 className="text-sm font-bold text-slate-800">{p.name}</h5>
                      <p className="text-[11px] text-slate-500">
                        Sisa Stok: <span className="text-amber-600 font-bold font-mono">{p.stock} {p.unit}</span> (Min: {p.minStock})
                      </p>
                    </div>
                    {/* Action Block */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                        <input
                          type="number"
                          placeholder="Jumlah"
                          className="w-16 px-2 py-1 text-xs text-center font-semibold focus:outline-none bg-transparent"
                          value={restockAmts[p.id] ?? ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setRestockAmts(prev => ({
                              ...prev,
                              [p.id]: isNaN(val) ? 0 : val
                            }));
                          }}
                        />
                        <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 border-l border-slate-200 uppercase font-mono">
                          {p.unit}
                        </span>
                      </div>
                      <Tooltip text="Tambah Stok">
                        <button
                          onClick={() => handleRestockClick(p.id)}
                          className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={16} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate('pos')}
              className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 hover:bg-indigo-100/50 transition-all text-center space-y-2 cursor-pointer text-indigo-800 group"
            >
              <div className="w-10 h-10 bg-indigo-150 rounded-full flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                <ShoppingCart size={18} />
              </div>
              <p className="text-xs font-bold">Luncurkan Kasir POS</p>
            </button>

            <button
              onClick={() => onNavigate('stock')}
              className="p-4 bg-sky-50 rounded-2xl border border-sky-100 hover:bg-sky-100/70 transition-all text-center space-y-2 cursor-pointer text-sky-800 group"
            >
              <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                <Plus size={18} />
              </div>
              <p className="text-xs font-bold">Kelola Produk</p>
            </button>

            <button
              onClick={() => onNavigate('history')}
              className="p-4 bg-slate-100 rounded-2xl border border-slate-200 hover:bg-slate-200/80 transition-all text-center space-y-2 cursor-pointer text-slate-800 group"
            >
              <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                <RefreshCw size={18} />
              </div>
              <p className="text-xs font-bold">Riwayat Penjualan</p>
            </button>
          </div>
        </div>

        {/* Right Side: Sales Categories breakdown */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-1 border-b border-slate-100 pb-3 mb-4">
            <h4 className="font-bold text-slate-800 text-sm">Penjualan per Kategori</h4>
            <p className="text-xs text-slate-400">Pembagian pendapatan kotor toko</p>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {categorySales.map((cat, idx) => {
              const pct = (cat.value / maxCategoryValue) * 100;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{cat.name}</span>
                    <span className="font-mono text-slate-500">{formatRupiah(cat.value)}</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        idx === 0 ? 'bg-indigo-600' :
                        idx === 1 ? 'bg-violet-500' :
                        idx === 2 ? 'bg-sky-500' :
                        'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {categorySales.length === 0 || categorySales.every(c => c.value === 0) ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                Belum ada transaksi terekam untuk menyusun grafik proporsi kategori.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
