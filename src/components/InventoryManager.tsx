import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, ArrowUpDown, Search, Percent, Eye, AlertTriangle, ShieldAlert, BadgeInfo } from 'lucide-react';
import { Product } from '../types';
import { CATEGORIES } from '../initialData';
import { formatRupiah, generateSKU } from '../utils';
import Tooltip from './Tooltip';
import Modal from './Modal';

interface InventoryManagerProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

type SortField = 'sku' | 'name' | 'category' | 'buyPrice' | 'sellPrice' | 'stock';
type SortOrder = 'asc' | 'desc';

export default function InventoryManager({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}: InventoryManagerProps) {
  // Queries & view filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // New or Edit product modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Sembako');
  const [formBuyPrice, setFormBuyPrice] = useState<number>(0);
  const [formSellPrice, setFormSellPrice] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(0);
  const [formMinStock, setFormMinStock] = useState<number>(5);
  const [formUnit, setFormUnit] = useState('pcs');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  // Quick addition of stock in table
  const [quickAddQty, setQuickAddQty] = useState<{ [key: string]: number }>({});

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormSku('');
    setFormName('');
    setFormCategory('Makanan');
    setFormBuyPrice(0);
    setFormSellPrice(0);
    setFormStock(0);
    setFormMinStock(5);
    setFormUnit('pcs');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormSku(p.sku);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormBuyPrice(p.buyPrice);
    setFormSellPrice(p.sellPrice);
    setFormStock(p.stock);
    setFormMinStock(p.minStock);
    setFormUnit(p.unit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      alert('Nama produk tidak boleh kosong!');
      return;
    }

    if (formSellPrice <= 0 || formBuyPrice <= 0) {
      alert('Harga modal maupun harga jual harus lebih besar dari 0!');
      return;
    }

    if (formSellPrice < formBuyPrice) {
      setConfirmDialog({
        title: 'Konfirmasi',
        description: 'Perhatian: Harga jual lebih rendah dari harga beli (rugi). Tetap ingin menyimpan?',
        onConfirm: () => { setConfirmDialog(null); executeSaveProduct(); },
      });
      return;
    }
    executeSaveProduct();
  };

  const executeSaveProduct = () => {
    // Determine final SKU
    const finalSku = formSku.trim() || generateSKU(formCategory);

    // Check duplicate SKU (only outer scope)
    const duplicateSku = products.find(p => p.sku.toUpperCase() === finalSku.toUpperCase() && p.id !== editingProduct?.id);
    if (duplicateSku) {
      alert(`Produk dengan SKU ${finalSku} sudah terdaftar (${duplicateSku.name}). Gunakan SKU unik.`);
      return;
    }

    if (editingProduct) {
      // Edit mode
      const updated: Product = {
        ...editingProduct,
        sku: finalSku,
        name: formName.trim(),
        category: formCategory,
        buyPrice: formBuyPrice,
        sellPrice: formSellPrice,
        stock: formStock,
        minStock: formMinStock,
        unit: formUnit.trim().toLowerCase(),
      };
      onUpdateProduct(updated);
    } else {
      // Add mode
      const newProd: Product = {
        id: 'p_' + Date.now(),
        sku: finalSku,
        name: formName.trim(),
        category: formCategory,
        buyPrice: formBuyPrice,
        sellPrice: formSellPrice,
        stock: formStock,
        minStock: formMinStock,
        unit: formUnit.trim().toLowerCase(),
      };
      onAddProduct(newProd);
    }

    handleCloseModal();
  };

  const handleDeleteClick = (p: Product) => {
    setConfirmDialog({
      title: 'Konfirmasi',
      description: `Apakah Anda yakin ingin menghapus produk "${p.name}" dari sistem?`,
      onConfirm: () => { setConfirmDialog(null); onDeleteProduct(p.id); },
    });
  };

  const handleQuickAddStock = (p: Product) => {
    const qty = quickAddQty[p.id];
    if (!qty || qty <= 0) return;

    const updated: Product = {
      ...p,
      stock: p.stock + qty,
    };
    onUpdateProduct(updated);

    // Clear quick input state
    setQuickAddQty(prev => {
      const copy = { ...prev };
      delete copy[p.id];
      return copy;
    });
  };

  // Sorting toggler handler
  const requestSort = (field: SortField) => {
    let order: SortOrder = 'asc';
    if (sortField === field && sortOrder === 'asc') {
      order = 'desc';
    }
    setSortField(field);
    setSortOrder(order);
  };

  // Process filters, searches and sorting
  const processedProducts = useMemo(() => {
    let filtered = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      const matchLowStock = !showLowStockOnly || p.stock <= p.minStock;
      
      return matchSearch && matchCategory && matchLowStock;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [products, searchTerm, selectedCategory, showLowStockOnly, sortField, sortOrder]);

  return (
    <div className="space-y-4">
      {/* Top Controller Panel */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search & Category filter */}
        <div className="flex flex-1 flex-col sm:flex-row items-stretch gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-neutral-400" size={17} />
            <input
              type="text"
              placeholder="Cari SKU atau nama produk..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category SELECT */}
          <select
            className="bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="Semua">Semua Kategori</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Toggle Alert Low Stock */}
          <button
            onClick={() => setShowLowStockOnly(prev => !prev)}
            className={`px-3.5 py-2 border rounded-lg text-xs font-semibold select-none cursor-pointer transition-colors flex items-center gap-1.5 ${
              showLowStockOnly
                ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-300'
                : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <AlertTriangle size={14} /> Low Stock Saja
          </button>
        </div>

        {/* Plus new item */}
        <button
          onClick={handleOpenAddModal}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start md:self-auto"
        >
          <Plus size={15} /> Tambah Produk Baru
        </button>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-neutral-500 uppercase text-[10px] font-bold tracking-wider select-none border-b border-neutral-200/60">
                <th className="p-4 cursor-pointer hover:bg-neutral-100" onClick={() => requestSort('sku')}>
                  <span className="flex items-center gap-1">SKU <ArrowUpDown size={10} /></span>
                </th>
                <th className="p-4 cursor-pointer hover:bg-neutral-100" onClick={() => requestSort('name')}>
                  <span className="flex items-center gap-1">Nama Produk <ArrowUpDown size={10} /></span>
                </th>
                <th className="p-4 cursor-pointer hover:bg-neutral-100" onClick={() => requestSort('category')}>
                  <span className="flex items-center gap-1">Kategori <ArrowUpDown size={10} /></span>
                </th>
                <th className="p-4 cursor-pointer hover:bg-neutral-100 text-right" onClick={() => requestSort('buyPrice')}>
                  <span className="flex items-center gap-1 justify-end">Modal (Beli) <ArrowUpDown size={10} /></span>
                </th>
                <th className="p-4 cursor-pointer hover:bg-neutral-100 text-right" onClick={() => requestSort('sellPrice')}>
                  <span className="flex items-center gap-1 justify-end">Jual <ArrowUpDown size={10} /></span>
                </th>
                <th className="p-4 font-bold text-center">Keuntungan</th>
                <th className="p-4 cursor-pointer hover:bg-neutral-100 text-center" onClick={() => requestSort('stock')}>
                  <span className="flex items-center gap-1 justify-center">Sisa Stok <ArrowUpDown size={10} /></span>
                </th>
                <th className="p-4 font-bold text-center">Quick Tambah</th>
                <th className="p-4 col-span-2 text-right">Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
              {processedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-neutral-400 font-medium">
                    Tidak ada produk diinventarisasi yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                processedProducts.map(p => {
                  const isLow = p.stock <= p.minStock;
                  const isOut = p.stock <= 0;
                  const markup = p.sellPrice - p.buyPrice;
                  const markupPercent = (markup / p.buyPrice) * 100;

                  return (
                    <tr 
                      key={p.id}
                      className={`hover:bg-neutral-50/50 transition-colors ${
                        isOut ? 'bg-rose-50/30' : isLow ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* SKU */}
                      <td className="p-4 font-mono font-semibold text-neutral-500 uppercase">{p.sku}</td>
                      
                      {/* Name */}
                      <td className="p-4 font-bold text-neutral-800">
                        {p.name}
                        {isLow && (
                          <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1.5 ${
                            isOut ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isOut ? 'Stok Habis' : 'Stok Menipis'}
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className="bg-neutral-100 text-neutral-600 font-medium px-2 py-0.5 rounded-md">
                          {p.category}
                        </span>
                      </td>

                      {/* Buy Price */}
                      <td className="p-4 text-right font-mono text-neutral-500">{formatRupiah(p.buyPrice)}</td>

                      {/* Sell Price */}
                      <td className="p-4 text-right font-semibold font-mono text-emerald-800">{formatRupiah(p.sellPrice)}</td>

                      {/* Margins */}
                      <td className="p-4 text-center">
                        <Tooltip text="Keuntungan Margin">
                          <span className={`text-[11px] font-semibold text-neutral-500`}>
                            {formatRupiah(markup)} <span className="text-[10px] text-neutral-400">({markupPercent.toFixed(0)}%)</span>
                          </span>
                        </Tooltip>
                      </td>

                      {/* Stock Level Counter */}
                      <td className="p-4 text-center font-semibold">
                        <span className={`px-2 py-1 rounded-md font-mono ${
                          isOut ? 'text-rose-600 bg-rose-100/50 font-bold' :
                          isLow ? 'text-amber-600 bg-amber-100/50 font-bold' :
                          'text-neutral-700 bg-neutral-100/70'
                        }`}>
                          {p.stock} <span className="text-[10px] uppercase">{p.unit}</span>
                        </span>
                      </td>

                      {/* Quick Addition Stock Row */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1 max-w-[120px] mx-auto">
                          <input
                            type="number"
                            placeholder="+"
                            className="w-12 px-1 py-0.5 border border-neutral-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                            value={quickAddQty[p.id] ?? ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setQuickAddQty(prev => ({
                                ...prev,
                                [p.id]: isNaN(val) ? 0 : val
                              }));
                            }}
                          />
                          <Tooltip text="Konfirmasi Tambah">
                            <button
                              onClick={() => handleQuickAddStock(p)}
                              className="bg-neutral-100 hover:bg-emerald-700 hover:text-white border border-neutral-300 hover:border-emerald-700 text-neutral-600 p-1.5 rounded transition-colors cursor-pointer"
                            >
                              <Plus size={12} />
                            </button>
                          </Tooltip>
                        </div>
                      </td>

                      {/* Row Actions */}
                      <td className="p-4 col-span-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Tooltip text="Edit Data Produk">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 text-neutral-400 hover:text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>
                          </Tooltip>
                          <Tooltip text="Hapus Produk">
                            <button
                              onClick={() => handleDeleteClick(p)}
                              className="p-1.5 text-neutral-400 hover:text-rose-600 bg-white hover:bg-rose-50 border border-neutral-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </Tooltip>
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

      {/* NEW OR EDIT DIALOG / MODAL POPUP */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-neutral-200 shadow-2xl overflow-hidden animate-scale-up">
            <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
              <h4 className="font-bold text-sm">
                {editingProduct ? `Edit Data: ${editingProduct.name}` : 'Instansi Produk Baru'}
              </h4>
              <button 
                onClick={handleCloseModal}
                className="text-white/80 hover:text-white transition-colors cursor-pointer border border-white/20 hover:border-white/50 w-6 h-6 rounded-md flex items-center justify-center font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                    Product SKU Code (Kunci)
                  </label>
                  <input
                    type="text"
                    placeholder="Kosongkan untuk auto"
                    className="w-full bg-neutral-50 focus:bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase font-mono"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                    Kategori Barang
                  </label>
                  <select
                    className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                  Nama Brand / Produk Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Indomie Goreng Rendang 85g"
                  required
                  className="w-full bg-neutral-50 focus:bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                    Harga Modal (Beli)
                  </label>
                  <div className="flex border border-neutral-300 rounded-lg overflow-hidden bg-neutral-50">
                    <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-1.5 border-r border-neutral-200">
                      Rp
                    </span>
                    <input
                      type="number"
                      required
                      placeholder="0"
                      className="w-full bg-white px-2.5 py-1 text-xs focus:outline-none font-mono"
                      value={formBuyPrice || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setFormBuyPrice(isNaN(val) ? 0 : val);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                    Harga Jual Toko
                  </label>
                  <div className="flex border border-neutral-300 rounded-lg overflow-hidden bg-neutral-100">
                    <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-1.5 border-r border-neutral-200">
                      Rp
                    </span>
                    <input
                      type="number"
                      required
                      placeholder="0"
                      className="w-full bg-white px-2.5 py-1 text-xs focus:outline-none font-mono font-semibold text-emerald-800"
                      value={formSellPrice || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setFormSellPrice(isNaN(val) ? 0 : val);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                    Jumlah Stok
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    className="w-full bg-neutral-50 focus:bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono text-center"
                    value={formStock}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFormStock(isNaN(val) ? 0 : val);
                    }}
                  />
                </div>

                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                    Batas Minimum
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="5"
                    className="w-full bg-neutral-50 focus:bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono text-center"
                    value={formMinStock}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFormMinStock(isNaN(val) ? 0 : val);
                    }}
                  />
                </div>

                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block">
                    Satuan Barang
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="pcs"
                    className="w-full bg-neutral-50 focus:bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-center"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                  />
                </div>
              </div>

              {/* Loss warning note */}
              {formBuyPrice > 0 && formSellPrice > 0 && formSellPrice < formBuyPrice && (
                <div className="bg-rose-50 text-rose-800 text-[10px] p-2.5 border border-rose-200 rounded-lg flex items-start gap-1.5">
                  <ShieldAlert size={14} className="text-rose-600 flex-shrink-0 mt-0.5" />
                  <p><b>Peringatan Kerugian:</b> Jual {formatRupiah(formSellPrice)} &lt; Beli {formatRupiah(formBuyPrice)}. Anda akan merugi {formatRupiah(formBuyPrice - formSellPrice)} per unit barang.</p>
                </div>
              )}

              {/* Submit CTA */}
              <div className="flex gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-2.5 px-3 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 px-3 rounded-xl font-bold text-xs cursor-pointer transition-all"
                >
                  Simpan Produk
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

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
