// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA4T8PX6AyQNtHDd701TVnr5-PPTdjdL-U",
  authDomain: "kios-ikbal.firebaseapp.com",
  projectId: "kios-ikbal",
  storageBucket: "kios-ikbal.firebasestorage.app",
  messagingSenderId: "155097327035",
  appId: "1:155097327035:web:e8bc476783c00468c6109e",
  measurementId: "G-BV68ZJH3KP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Offline persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Offline persistence not supported by this browser');
  }
});

export { db };
