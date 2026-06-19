import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Boxes, 
  History, 
  TrendingUp, 
  Clock, 
  Store,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  Maximize,
  Minimize
} from 'lucide-react';
import { User, Product, Transaction } from './types';
import { INITIAL_PRODUCTS, INITIAL_TRANSACTIONS } from './initialData';
import {
  fetchProducts,
  fetchTransactions,
  addProduct,
  updateProduct,
  deleteProduct,
  addTransaction,
  deleteTransaction,
  resetDatabase,
  seedDefaultUsers,
} from './db';
import Login from './components/Login';

// Component imports
import DashboardOverview from './components/DashboardOverview';
import POSTerminal from './components/POSTerminal';
import InventoryManager from './components/InventoryManager';
import TransactionsHistory from './components/TransactionsHistory';
import SalesAnalytics from './components/SalesAnalytics';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'stock' | 'history' | 'history-today' | 'analytics'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const storedUser = sessionStorage.getItem('IKBAL_KASIR_USER');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);
      setIsSidebarCollapsed(true);
      if (user.role === 'kasir') {
        setActiveTab('pos');
      }
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('IKBAL_KASIR_USER', JSON.stringify(user));
    setIsSidebarCollapsed(true);
    if (user.role === 'kasir') {
      setActiveTab('pos');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('IKBAL_KASIR_USER');
    setActiveTab('dashboard');
  };
  
  // Real-time terminal clock
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Master datasets
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // 1. Initial hydration from Firestore
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Ensure at least default users exist
        await seedDefaultUsers();

        let dbProducts = await fetchProducts();
        let dbTransactions = await fetchTransactions();

        // If empty, seed with initial data
        if (dbProducts.length === 0) {
          for (const p of INITIAL_PRODUCTS) await addProduct(p);
          dbProducts = INITIAL_PRODUCTS;
        }

        if (dbTransactions.length === 0 && INITIAL_TRANSACTIONS.length > 0) {
          for (const t of INITIAL_TRANSACTIONS) await addTransaction(t);
          dbTransactions = INITIAL_TRANSACTIONS;
        }

        setProducts(dbProducts);
        setTransactions(dbTransactions);
      } catch (error) {
        console.error('Failed to load data from Firestore', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 2. Real-time clock tick updates & Fullscreen listener
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearInterval(clockTimer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Callback handlers — now wired to Firestore
  const handleDeductProductStock = async (productId: string, qtySold: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updatedProduct = { ...product, stock: Math.max(0, product.stock - qtySold) };
      await updateProduct(updatedProduct);
      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
    }
  };

  const handleRestockProduct = async (productId: string, qtyAdded: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updatedProduct = { ...product, stock: product.stock + qtyAdded };
      await updateProduct(updatedProduct);
      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
    }
  };

  const handleAddTransactionEntry = async (tx: Transaction) => {
    await addTransaction(tx);
    setTransactions(prev => [tx, ...prev]);
  };

  const handleDeleteTransactionEntry = async (id: string) => {
    await deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleAddProductEntry = async (newProduct: Product) => {
    await addProduct(newProduct);
    setProducts(prev => [...prev, newProduct]);
  };

  const handleUpdateProductEntry = async (updatedProduct: Product) => {
    await updateProduct(updatedProduct);
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const handleDeleteProductEntry = async (productId: string) => {
    await deleteProduct(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  // Reset seluruh database ke data awal
  const handleResetToFactoryDefaults = async () => {
    await resetDatabase(INITIAL_PRODUCTS, INITIAL_TRANSACTIONS);
    setProducts(INITIAL_PRODUCTS);
    setTransactions(INITIAL_TRANSACTIONS);
  };

  // Restore dari file import
  const handleImportedDataRestore = async (importedProducts: Product[], importedTransactions: Transaction[]) => {
    await resetDatabase(importedProducts, importedTransactions);
    setProducts(importedProducts);
    setTransactions(importedTransactions);
  };

  // Localized Indonesian date string for terminal clock
  const indonesianDateTimeStr = () => {
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthsIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const dayName = daysIndo[currentDateTime.getDay()];
    const dayDate = currentDateTime.getDate();
    const monthName = monthsIndo[currentDateTime.getMonth()];
    const year = currentDateTime.getFullYear();

    const hours = String(currentDateTime.getHours()).padStart(2, '0');
    const minutes = String(currentDateTime.getMinutes()).padStart(2, '0');
    const seconds = String(currentDateTime.getSeconds()).padStart(2, '0');

    return `${dayName}, ${dayDate} ${monthName} ${year} — ${hours}:${minutes}:${seconds}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-900">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500 animate-pulse">Memuat Database Lokal...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const changeTab = (tab: any) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Auto close mobile menu after clicking
  };

  const maxWidthClass = 'max-w-full';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 overflow-x-hidden">
      
      {/* STICKY ACCENTED BRANDING HEADER (no-print hides it in browser prints) */}
      <header className={`sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-4 sm:px-6 lg:px-8 py-4 mx-auto w-full ${maxWidthClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print`}>
        
        {/* Logo and store description */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/10 hover:scale-[1.02] transition-transform">
            <Store size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 font-sans flex items-center gap-1.5 leading-none">
              IKBAL<span className="text-indigo-600 font-black italic uppercase text-xs ml-0.5 tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded">Pro</span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Management System</p>
          </div>
        </div>

        {/* Real-time Clock & User Profile */}
        <div className="flex items-center gap-4 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 select-none">
            <Clock size={13} className="text-indigo-600 animate-pulse" />
            <span className="text-[10px] font-mono tracking-tight font-bold">{indonesianDateTimeStr()}</span>
          </div>

          <button
            onClick={toggleBrowserFullscreen}
            title={isBrowserFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
          >
            {isBrowserFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>

          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-700 leading-none">{currentUser.name}</p>
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{currentUser.role}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-[10px] bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-2 rounded-xl font-bold transition-colors uppercase tracking-wider"
            >
              Keluar
            </button>
          </div>
        </div>

      </header>

      {/* CORE FRAME CONTAINER: BENTO-CONTAINED WORKSPACE */}
      <main className={`flex-1 ${maxWidthClass} mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6`}>
        
        {/* SIDE BAR NAVIGATION RAIL (no-print hides in printing receipts) */}
        <aside className={`${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} transition-all duration-300 shrink-0 flex flex-col gap-4 no-print bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl text-slate-300`}>
          
          <div className={`flex items-center ${isSidebarCollapsed ? 'lg:justify-center' : 'lg:justify-between'} justify-between px-1`}>
            {/* Desktop text */}
            {!isSidebarCollapsed && (
              <p className="hidden lg:block text-[9px] font-bold text-slate-500 uppercase tracking-widest selection:bg-transparent">
                Menu Utama
              </p>
            )}
            {/* Mobile text */}
            <p className="lg:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Menu Utama
            </p>

            {/* Desktop Toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isSidebarCollapsed ? "Perluas Menu" : "Kecilkan Menu"}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden flex p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>

          {/* Navigation Button Menu */}
          <nav className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex flex-col gap-1 pb-2 lg:pb-0`}>
            
            {currentUser.role === 'admin' && (
              <button
                onClick={() => changeTab('dashboard')}
                title={isSidebarCollapsed ? "Dashboard" : ""}
                className={`w-full ${isSidebarCollapsed ? 'lg:px-0 lg:justify-center' : 'px-4'} py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 justify-start cursor-pointer group shrink-0 lg:shrink ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard size={16} className={activeTab === 'dashboard' ? 'text-white shadow-indigo-600/20' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className={isSidebarCollapsed ? "lg:hidden" : ""}>Dashboard</span>
              </button>
            )}

            {currentUser.role === 'kasir' && (
              <>
                <button
                  onClick={() => changeTab('pos')}
                  title={isSidebarCollapsed ? "Kasir Terminal" : ""}
                  className={`w-full ${isSidebarCollapsed ? 'lg:px-0 lg:justify-center' : 'px-4'} py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 justify-start cursor-pointer group shrink-0 lg:shrink ${
                    activeTab === 'pos'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800'
                  }`}
                >
                  <ShoppingCart size={16} className={activeTab === 'pos' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className={isSidebarCollapsed ? "lg:hidden" : ""}>Kasir Terminal</span>
                </button>
                <button
                  onClick={() => changeTab('history-today')}
                  title={isSidebarCollapsed ? "Riwayat Hari Ini" : ""}
                  className={`w-full ${isSidebarCollapsed ? 'lg:px-0 lg:justify-center' : 'px-4'} py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 justify-start cursor-pointer group shrink-0 lg:shrink ${
                    activeTab === 'history-today'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800'
                  }`}
                >
                  <History size={16} className={activeTab === 'history-today' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className={isSidebarCollapsed ? "lg:hidden" : ""}>Riwayat Hari Ini</span>
                </button>
              </>
            )}

            {currentUser.role === 'admin' && (
              <>
                <button
                onClick={() => changeTab('stock')}
                title={isSidebarCollapsed ? "Stok Produk" : ""}
                  className={`w-full ${isSidebarCollapsed ? 'lg:px-0 lg:justify-center' : 'px-4'} py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 justify-start cursor-pointer group shrink-0 lg:shrink ${
                    activeTab === 'stock'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800'
                  }`}
                >
                  <Boxes size={16} className={activeTab === 'stock' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className={isSidebarCollapsed ? "lg:hidden" : ""}>Kelola Stok Barang</span>
                </button>

                <button
                onClick={() => changeTab('history')}
                title={isSidebarCollapsed ? "Riwayat Penjualan" : ""}
                  className={`w-full ${isSidebarCollapsed ? 'lg:px-0 lg:justify-center' : 'px-4'} py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 justify-start cursor-pointer group shrink-0 lg:shrink ${
                    activeTab === 'history'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800'
                  }`}
                >
                  <History size={16} className={activeTab === 'history' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className={isSidebarCollapsed ? "lg:hidden" : ""}>Riwayat Penjualan</span>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  title={isSidebarCollapsed ? "Utilitas & Analitik" : ""}
                  className={`w-full ${isSidebarCollapsed ? 'lg:px-0 lg:justify-center' : 'px-4'} py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 justify-start cursor-pointer group shrink-0 lg:shrink ${
                    activeTab === 'analytics'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800'
                  }`}
                >
                  <TrendingUp size={16} className={activeTab === 'analytics' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className={isSidebarCollapsed ? "lg:hidden" : ""}>Utilitas & Analitik</span>
                </button>
              </>
            )}

          </nav>

          {/* Quick info status block */}
          {!isSidebarCollapsed && (
            <div className="hidden lg:block mt-auto bg-slate-800/40 border border-slate-800/60 rounded-2xl p-4 space-y-2.5 select-none">
              <h5 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Metode Data</h5>
              <div className="space-y-1.5 text-[10px] font-semibold text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Penyimpanan:</span>
                  <span className="text-indigo-400 font-bold uppercase">IndexedDB (Lokal)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Produk Aktif:</span>
                  <span className="font-mono text-slate-200">{products.length} item</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Nota Log:</span>
                  <span className="font-mono text-slate-200">{transactions.length} baris</span>
                </div>
              </div>
            </div>
          )}

        </aside>

        {/* WORKSPACE CENTRAL WORKPAD */}
        <section className="flex-1 min-w-0">
          
          {/* Renders subpanels based on active tab state */}
          {activeTab === 'dashboard' && (
            <DashboardOverview
              products={products}
              transactions={transactions}
              onNavigate={(tab) => setActiveTab(tab)}
              onRestock={handleRestockProduct}
            />
          )}

          {activeTab === 'pos' && (
            <POSTerminal
              products={products}
              transactions={transactions}
              onAddTransaction={handleAddTransactionEntry}
              onDeductStock={handleDeductProductStock}
            />
          )}

          {activeTab === 'stock' && (
            <InventoryManager
              products={products}
              onAddProduct={handleAddProductEntry}
              onUpdateProduct={handleUpdateProductEntry}
              onDeleteProduct={handleDeleteProductEntry}
            />
          )}

          {activeTab === 'history' && (
            <TransactionsHistory
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransactionEntry}
            />
          )}

          {activeTab === 'history-today' && (
            <TransactionsHistory
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransactionEntry}
              filterTodayOnly={true}
              allowDelete={false}
            />
          )}

          {activeTab === 'analytics' && (
            <SalesAnalytics
              products={products}
              transactions={transactions}
              onResetDatabase={handleResetToFactoryDefaults}
              onImportDatabase={handleImportedDataRestore}
            />
          )}

        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto no-print">
        <div className="max-w-7xl mx-auto px-4 text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          &copy; 2026 Kasir IKBAL Pro &bull; Sistem Pengelola Stok Barang &amp; Transaksi Penjualan Efisien
        </div>
      </footer>

    </div>
  );
}
