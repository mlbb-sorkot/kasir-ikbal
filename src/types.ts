export type UserRole = 'admin' | 'kasir';

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  buyPrice: number;   // Harga Modal
  sellPrice: number;  // Harga Jual
  stock: number;      // Stok saat ini
  minStock: number;   // Batas minimum stok
  unit: string;       // Pcs, Pack, Kg, dll.
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'cash' | 'qris' | 'bank_transfer';

export interface TransactionItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  total: number;
}

export interface Transaction {
  id: string;
  timestamp: string;
  items: TransactionItem[];
  subtotal: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: PaymentMethod;
  cashierName: string;
}

export interface SalesSummary {
  totalRevenue: number;
  totalProfit: number;
  totalTransactions: number;
  lowStockCount: number;
}
