import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Transaction, User } from './types';

const productsCol = collection(db, 'products');
const transactionsCol = collection(db, 'transactions');
const usersCol = collection(db, 'users');

// ─── User Profile (Firebase Auth UID → Firestore doc) ─────────
export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: snap.id,
    email: data.email,
    role: data.role,
    name: data.name
  };
}

export async function createUserProfile(uid: string, email: string, role: 'admin' | 'kasir', name: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { email, role, name });
}

export async function isAdminExists(): Promise<boolean> {
  const q = query(usersCol, where('role', '==', 'admin'), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── Products ───────────────────────────────────────────────────
export async function fetchProducts(): Promise<Product[]> {
  const snap = await getDocs(productsCol);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
}

export async function addProduct(product: Product): Promise<void> {
  await setDoc(doc(db, 'products', product.id), product);
}

export async function updateProduct(product: Product): Promise<void> {
  await setDoc(doc(db, 'products', product.id), product, { merge: true });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id));
}

export function subscribeProducts(callback: (products: Product[]) => void): () => void {
  return onSnapshot(productsCol, (snap) => {
    const products = snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
    callback(products);
  });
}

// ─── Transactions ────────────────────────────────────────────────
export async function fetchTransactions(): Promise<Transaction[]> {
  const q = query(transactionsCol, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
}

export async function addTransaction(tx: Transaction): Promise<void> {
  await setDoc(doc(db, 'transactions', tx.id), tx);
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(db, 'transactions', id));
}

export function subscribeTransactions(callback: (transactions: Transaction[]) => void): () => void {
  const q = query(transactionsCol, orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snap) => {
    const transactions = snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
    callback(transactions);
  });
}

// ─── Reset ───────────────────────────────────────────────────────
export async function resetDatabase(
  newProducts: Product[],
  newTransactions: Transaction[]
): Promise<void> {
  const batch = writeBatch(db);

  // Delete existing
  const existingProducts = await getDocs(productsCol);
  existingProducts.forEach(d => batch.delete(d.ref));
  const existingTransactions = await getDocs(transactionsCol);
  existingTransactions.forEach(d => batch.delete(d.ref));

  // Add new
  newProducts.forEach(p => batch.set(doc(db, 'products', p.id), p));
  newTransactions.forEach(t => batch.set(doc(db, 'transactions', t.id), t));

  await batch.commit();
}
