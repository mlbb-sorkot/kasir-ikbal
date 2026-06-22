import { useState, useMemo } from 'react';
import { Search, ShoppingCart, Trash2, Tag, RefreshCw, Layers, Check, CheckCircle, Printer, X } from 'lucide-react';
import { Product, CartItem, PaymentMethod, Transaction } from '../types';
import { formatRupiah, generateTransactionId } from '../utils';
import { CATEGORIES } from '../initialData';
import Tooltip from './Tooltip';
import Modal from './Modal';

interface POSTerminalProps {
  products: Product[];
  transactions?: Transaction[];
  onAddTransaction: (transaction: Transaction) => void;
  onDeductStock: (productId: string, quantity: number) => void;
}

export default function POSTerminal({
  products,
  transactions = [],
  onAddTransaction,
  onDeductStock,
}: POSTerminalProps) {
  // State for POS terminal workflow
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // State for checkout calculators
  const [cashierName, setCashierName] = useState('Ikbal');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [customAmountPaid, setCustomAmountPaid] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Post-transaction receipt modal state
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);

  // Filter products based on search term and category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      return matchSearch && matchCategory && (p.stock ?? 0) > 0;
    });
  }, [products, searchTerm, selectedCategory]);

  // Add product to active cart
  const handleAddToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    const existingQty = existing ? existing.quantity : 0;

    if (existingQty >= (product.stock ?? 0)) return;

    if (existing) {
      setCart(prev => prev.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart(prev => [...prev, { product, quantity: 1 }]);
    }
  };

  // Adjust quantities directly inside the cart
  const handleUpdateQty = (productId: string, newQty: number) => {
    const item = cart.find(c => c.product.id === productId);
    if (!item) return;

    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    if (newQty > (item.product.stock ?? 0)) return;

    setCart(prev => prev.map(c => 
      c.product.id === productId ? { ...c, quantity: newQty } : c
    ));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setShowClearConfirm(true);
  };

  const confirmClearCart = () => {
    setCart([]);
    setCustomAmountPaid('');
    setAmountPaid(0);
    setShowClearConfirm(false);
  };

  // Shopping Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.sellPrice * item.quantity), 0);
  }, [cart]);

  const grandTotal = subtotal;

  // Automated Quick Money Helpers for cash payment method
  const quickCashAmounts = useMemo(() => {
    if (grandTotal <= 0) return [];
    
    const baseAmounts = [10000, 20000, 50000, 100000];
    const suggestions = [grandTotal]; // Option 1: Uang Pas
    
    // Suggest round numbers greater than the grand total
    baseAmounts.forEach(cash => {
      if (cash > grandTotal) {
        suggestions.push(cash);
      }
    });

    // Add another custom rounded combination to look professional
    const roundedUpOption = Math.ceil(grandTotal / 5000) * 5000;
    if (!suggestions.includes(roundedUpOption)) {
      suggestions.push(roundedUpOption);
    }

    const roundedUp10kOption = Math.ceil(grandTotal / 10000) * 10000;
    if (!suggestions.includes(roundedUp10kOption)) {
      suggestions.push(roundedUp10kOption);
    }

    return Array.from(new Set(suggestions)).sort((a, b) => a - b);
  }, [grandTotal]);

  const changeDue = useMemo(() => {
    const paid = paymentMethod === 'cash' ? amountPaid : grandTotal;
    return Math.max(0, paid - grandTotal);
  }, [paymentMethod, amountPaid, grandTotal]);

  const isPaymentValid = useMemo(() => {
    if (cart.length === 0) return false;
    if (paymentMethod === 'cash' && amountPaid < grandTotal) return false;
    return true;
  }, [cart, paymentMethod, amountPaid, grandTotal]);

  // Execute terminal checkout
  const handleProceedCheckout = () => {
    if (!isPaymentValid) return;

    const receiptId = generateTransactionId();
    const finalPaid = paymentMethod === 'cash' ? amountPaid : grandTotal;
    const finalChange = paymentMethod === 'cash' ? changeDue : 0;

    const transactionData: Transaction = {
      id: receiptId,
      timestamp: new Date().toISOString(),
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        buyPrice: item.product.buyPrice,
        sellPrice: item.product.sellPrice,
        total: item.product.sellPrice * item.quantity,
      })),
      subtotal,
      total: grandTotal,
      amountPaid: finalPaid,
      change: finalChange,
      paymentMethod,
      cashierName,
    };

    // 1. Deduct Product's actual stock in master products state
    cart.forEach(item => {
      onDeductStock(item.product.id, item.quantity);
    });

    // 2. Log standard transaction metrics
    onAddTransaction(transactionData);

    // 3. Keep receipt showing inside receipt dialog
    setActiveReceipt(transactionData);
  };

  const handleCloseReceiptModal = () => {
    // Reset active cart and calculators
    setCart([]);
    setCustomAmountPaid('');
    setAmountPaid(0);
    setActiveReceipt(null);
  };

  const handleManualCashChange = (valStr: string) => {
    setCustomAmountPaid(valStr);
    const parsed = parseInt(valStr.replace(/\D/g, ''));
    setAmountPaid(isNaN(parsed) ? 0 : parsed);
  };

  const handleQuickCashSelect = (amt: number) => {
    setAmountPaid(amt);
    setCustomAmountPaid(amt.toLocaleString('id-ID'));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
      {/* LEFT SECTION: PRODUCT CATALOGUE (lg:col-span-7) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Filters and Search Panel */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari produk berdasarkan nama atau SKU..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Categories Horizontal Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedCategory('Semua')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                selectedCategory === 'Semua'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Semua Barang
            </button>
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === category
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto pr-1">
          {filteredProducts.map(product => {
            const cartQty = cart.find(c => c.product.id === product.id)?.quantity || 0;
            const remainingStock = Math.max(0, (product.stock ?? 0) - cartQty);
            const isOutOfStock = remainingStock <= 0;
            const isLowStock = remainingStock <= (product.minStock ?? 0) && remainingStock > 0;

            return (
              <div 
                key={product.id}
                onClick={() => !isOutOfStock && handleAddToCart(product)}
                className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative flex flex-col justify-between ${
                  isOutOfStock ? 'border-red-300 bg-red-50 cursor-default' : 
                  cartQty > 0 ? 'border-indigo-600 ring-1 ring-indigo-600 cursor-pointer' : 'border-slate-200/85 hover:border-indigo-500 cursor-pointer'
                }`}
              >
                {cartQty > 0 && !isOutOfStock && (
                  <span className="absolute top-2 right-2 bg-indigo-600 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                    {cartQty}
                  </span>
                )}

                {isOutOfStock && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                    Habis
                  </span>
                )}

                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className={`text-[10px] font-bold tracking-wider uppercase font-mono block ${
                      isOutOfStock ? 'text-red-300' : 'text-slate-400'
                    }`}>
                      {product.sku}
                    </span>
                    <h4 className={`text-xs font-bold line-clamp-2 h-8 leading-tight ${
                      isOutOfStock ? 'text-red-400' : 'text-slate-800'
                    }`}>
                      {product.name}
                    </h4>
                  </div>

                  <div className={`pt-2 border-t flex items-center justify-between ${isOutOfStock ? 'border-red-200' : 'border-slate-100'}`}>
                    <span className={`text-xs font-black font-mono ${
                      isOutOfStock ? 'text-red-400' : 'text-indigo-600'
                    }`}>
                      {formatRupiah(product.sellPrice)}
                    </span>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOutOfStock ? 'bg-red-100 text-red-600' :
                        isLowStock ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {isOutOfStock ? 'Stok Habis' : `Stok: ${remainingStock}`}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={isOutOfStock}
                  className={`w-full py-2 text-center text-[11px] font-bold border-t transition-colors ${
                    isOutOfStock ? 'bg-red-100 text-red-400 border-red-200' :
                    cartQty > 0 ? 'bg-indigo-600 text-white border-indigo-600 group-hover:bg-indigo-700' :
                    'bg-slate-50 text-slate-600 border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                  }`}
                >
                  {isOutOfStock ? 'STOK HABIS' : cartQty > 0 ? 'TAMBAH LAGI' : 'TAMBAH KE KASIR'}
                </button>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full bg-white p-12 text-center border border-slate-200 rounded-2xl space-y-2">
              <p className="text-sm font-bold text-slate-500">Produk yang Anda cari tidak ditemukan.</p>
              <p className="text-xs text-slate-400">Silakan periksa kata kunci pencarian Anda atau tambahkan produk baru.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: ACTIVE CART & CHECKOUT CONTROLLER (lg:col-span-5) */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-5 shadow-xl flex flex-col justify-between h-max min-h-[600px]">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-indigo-400" />
            <h4 className="font-bold text-slate-100 text-sm">Keranjang Transaksi</h4>
            <span className="bg-indigo-950 text-indigo-300 border border-indigo-900 font-bold text-xs px-2.5 py-0.5 rounded-full">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} items
            </span>
          </div>

          {cart.length > 0 && (
            <Tooltip text="Kosongkan Keranjang">
              <button
                onClick={handleClearCart}
                className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Cart List Block */}
        <div className="flex-1 overflow-y-auto max-h-[220px] divide-y divide-slate-850 my-2 pr-1 minimal-scrollbar">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-2 select-none">
              <div className="w-12 h-12 bg-slate-800/40 border border-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                <ShoppingCart size={20} />
              </div>
              <p className="text-xs font-bold text-slate-400">Keranjang masih kosong.</p>
              <p className="text-[11px] text-slate-500">Pilih menu produk di sebelah kiri.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="py-3 flex items-center justify-between gap-2 border-slate-850">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-200 truncate">{item.product.name}</h5>
                  <p className="text-[10px] font-mono text-slate-450 font-semibold uppercase tracking-wider">
                    {item.product.sku} &bull; {formatRupiah(item.product.sellPrice)}
                  </p>
                </div>

                {/* Adjuster plus / minus panel */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-700/80 rounded-xl overflow-hidden bg-slate-850 py-0.5">
                    <button
                      onClick={() => handleUpdateQty(item.product.id, item.quantity - 1)}
                      className="px-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors font-bold text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-1 text-xs font-mono font-bold text-slate-200 min-w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQty(item.product.id, item.quantity + 1)}
                      className="px-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors font-bold text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-xs font-bold text-slate-200 min-w-[70px] text-right font-mono">
                    {formatRupiah(item.product.sellPrice * item.quantity)}
                  </span>

                  <button
                    onClick={() => handleRemoveFromCart(item.product.id)}
                    className="text-slate-500 hover:text-rose-450 p-1 rounded-md cursor-pointer transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sales Modifiers Block: Cashier & Payment Method */}
        {cart.length > 0 && (
          <div className="bg-slate-850/45 p-4 rounded-2xl border border-slate-800/80 space-y-3.5 my-2">
            {/* Cashier input and payment toggling */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Petugas Kasir
                </label>
                <input
                  type="text"
                  placeholder="Nama Kasir"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Metode Bayar
                </label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none cursor-pointer"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value="cash">Uang Tunai</option>
                  <option value="qris">QRIS / E-Money</option>
                  <option value="bank_transfer">Transfer Bank</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Calculations & Checkout */}
        {cart.length > 0 && (
          <div className="space-y-3.5 pt-2 border-t border-slate-800">
            {/* Bills list */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400 font-medium">
                <span>Subtotal</span>
                <span className="font-mono">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-850 pt-2 text-sm font-black text-slate-100">
                <span>Total Akhir</span>
                <span className="font-mono text-indigo-400 font-extrabold text-xl">{formatRupiah(grandTotal)}</span>
              </div>
            </div>

            {/* Input Cash Received Section */}
            {paymentMethod === 'cash' && (
              <div className="space-y-2 border-t border-dashed border-slate-800 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Tunai Diterima:</span>
                  <div className="flex items-center border border-slate-700 rounded-xl bg-slate-900 overflow-hidden">
                    <span className="text-xs text-slate-500 bg-slate-850 px-2.5 py-1 font-bold border-r border-slate-800">
                      Rp
                    </span>
                    <input
                      type="text"
                      className="w-32 bg-slate-900 text-white px-2 py-1 text-xs text-right font-black focus:outline-none font-mono"
                      placeholder="0"
                      value={customAmountPaid}
                      onChange={(e) => handleManualCashChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* Quick Cash Suggestions Grid */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                  {quickCashAmounts.map((amt, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickCashSelect(amt)}
                      className={`px-2 py-1 border text-[10px] font-bold whitespace-nowrap rounded-lg cursor-pointer ${
                        amountPaid === amt
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {amt === grandTotal ? 'Pas' : formatRupiah(amt)}
                    </button>
                  ))}
                </div>

                {/* Change Due Row */}
                {amountPaid > 0 && (
                  <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-1.5">
                    <span className="text-slate-400 font-semibold">Angsuran / Kembalian</span>
                    <span className={`font-mono font-bold text-sm ${
                      amountPaid < grandTotal ? 'text-rose-400' : 'text-emerald-400 animate-pulse'
                    }`}>
                      {amountPaid < grandTotal 
                        ? `Kurang ${formatRupiah(grandTotal - amountPaid)}` 
                        : formatRupiah(changeDue)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Process Checkout Trigger Button */}
            <button
              onClick={handleProceedCheckout}
              disabled={!isPaymentValid}
              className={`w-full py-3.5 rounded-2xl font-black text-xs text-center shadow-md transition-all cursor-pointer transform ${
                isPaymentValid 
                  ? 'bg-indigo-600 hover:bg-indigo-505 hover:bg-indigo-500 text-white hover:scale-[1.01] active:translate-y-0.5 shadow-lg shadow-indigo-600/20' 
                  : 'bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed'
              }`}
            >
              PROSES PEMBAYARAN ({paymentMethod.toUpperCase()})
            </button>
          </div>
        )}
      </div>

      {/* DETAILED MONOSPACE RECEIPT MODAL (POST-CHECKOUT DIALOG) */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 no-print">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-indigo-400" />
                <h4 className="font-bold text-sm">Pembayaran Sukses!</h4>
              </div>
              <button 
                onClick={handleCloseReceiptModal}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Receipt Area */}
            <div className="p-5 overflow-y-auto bg-slate-100">
              <div id="thermal-receipt" className="bg-white p-6 border shadow-md rounded-xl font-mono text-[11px] text-slate-705 text-slate-700 leading-relaxed max-w-xs mx-auto">
                <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-300">
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest leading-none pt-1">Toko IKBAL</h3>
                  <p className="text-[10px] text-slate-500 font-bold">POS Management System</p>
                  <p className="text-[9px] text-slate-400">Jl. Raya Utama No. 88, Sorkot</p>
                </div>

                <div className="py-3 border-b border-dashed border-slate-300 space-y-0.5 text-[9px] text-slate-500">
                  <div className="flex justify-between">
                    <span>No. Nota:</span>
                    <span className="font-bold text-slate-750">{activeReceipt.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>{new Date(activeReceipt.timestamp).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span className="capitalize">{activeReceipt.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sistem:</span>
                    <span className="font-semibold text-slate-600">Tunai / Elektronik</span>
                  </div>
                </div>

                {/* Items */}
                <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
                  {activeReceipt.items.map((item, index) => (
                    <div key={index} className="space-y-0.5">
                      <div className="font-bold text-slate-800 flex justify-between">
                        <span className="max-w-[180px] wrap-break-word">{item.productName}</span>
                        <span>{formatRupiah(item.total)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>{item.quantity} x {formatRupiah(item.sellPrice)}</span>
                        <span>SKU: {item.sku}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mathematical breakdown */}
                <div className="py-3 text-[10px] space-y-1 font-semibold text-slate-600 border-b border-dashed border-slate-200">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatRupiah(activeReceipt.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-slate-850 pt-1 border-t border-slate-100">
                    <span>TOTAL BILL:</span>
                    <span>{formatRupiah(activeReceipt.total)}</span>
                  </div>
                </div>

                {/* Payments */}
                <div className="py-3 text-[10px] space-y-1 font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span>Metode Bayar:</span>
                    <span className="uppercase">{activeReceipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bayar:</span>
                    <span>{formatRupiah(activeReceipt.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-indigo-600 pt-1 border-t border-slate-100">
                    <span>KEMBALIAN:</span>
                    <span>{formatRupiah(activeReceipt.change)}</span>
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-dashed border-slate-300 space-y-1">
                  <p className="text-[10px] font-extrabold text-slate-850">*** TERIMA KASIH ***</p>
                  <p className="text-[8px] text-slate-400">Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan.</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-5 py-4 flex gap-2 border-t border-slate-200 no-print">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Printer size={14} /> Cetak Struk
              </button>
              <button
                onClick={handleCloseReceiptModal}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              >
                Transaksi Baru <Check size={14} />
              </button>
            </div>

          </div>
        </div>
      )}

      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Kosongkan Keranjang?"
        description="Semua item di keranjang belanja akan dihapus dan tidak dapat dikembalikan."
        actions={[
          { label: 'Batal', onClick: () => setShowClearConfirm(false), variant: 'ghost' },
          { label: 'Ya, Kosongkan', onClick: confirmClearCart, variant: 'danger' },
        ]}
      />
    </div>
  );
}
