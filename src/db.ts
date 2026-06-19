// src/db.ts — Firestore CRUD operations
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  where,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Transaction, User } from './types';

// ─── Collections ────────────────────────────────────────────────
const productsCol = collection(db, 'products');
const transactionsCol = collection(db, 'transactions');
const usersCol = collection(db, 'users');

// ─── Authentication ───────────────────────────────────────────────
export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const q = query(
    usersCol,
    where('username', '==', username),
    where('password', '==', password),
    limit(1)
  );
  
  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }
  
  const doc = snap.docs[0];
  const data = doc.data();
  return {
    username: data.username,
    role: data.role,
    name: data.name
  };
}

export async function seedDefaultUsers(): Promise<void> {
  const snap = await getDocs(usersCol);
  
  // Only seed if collection is completely empty
  if (snap.empty) {
    const batch = writeBatch(db);
    
    // Default Admin
    const adminRef = doc(db, 'users', 'admin');
    batch.set(adminRef, {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      name: 'Administrator'
    });

    // Default Kasir
    const kasirRef = doc(db, 'users', 'kasir');
    batch.set(kasirRef, {
      username: 'kasir',
      password: 'kasir123',
      role: 'kasir',
      name: 'Petugas Kasir'
    });

    await batch.commit();
    console.log("Default users seeded to Firestore.");
  }
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
