import { useState, useEffect, FormEvent } from 'react';
import { Users, Plus, UserPlus, ShieldCheck, Ban, AlertTriangle } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { User } from '../types';
import { createUserProfile } from '../db';
import Tooltip from './Tooltip';
import Modal from './Modal';

interface UserWithDocId extends User {
  docId: string;
}

export default function UserManager() {
  const [users, setUsers] = useState<UserWithDocId[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: UserWithDocId[] = snap.docs.map(d => ({
        uid: d.id,
        docId: d.id,
        email: d.data().email || '',
        role: d.data().role || 'kasir',
        name: d.data().name || d.id,
      }));
      setUsers(list);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!newUsername.trim() || !newName.trim()) {
      setError('Semua field harus diisi.');
      setSubmitting(false);
      return;
    }

    try {
      const email = `${newUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}@kasir.app`;
      const cred = await createUserWithEmailAndPassword(auth, email, newPassword);
      await createUserProfile(cred.user.uid, email, 'kasir', newName.trim());

      setShowForm(false);
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      await fetchUsers();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Username ini sudah terdaftar.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Minimal 6 karakter.');
      } else {
        setError(`Gagal: ${err.message}`);
      }
    }
    setSubmitting(false);
  };

  const handleDelete = async (u: UserWithDocId) => {
    setConfirmDialog({
      title: 'Konfirmasi',
      description: `Hapus user "${u.name}" (${u.role})?`,
      onConfirm: () => {
        setConfirmDialog(null);
        (async () => {
          try {
            await deleteDoc(doc(db, 'users', u.docId));
            await fetchUsers();
          } catch {
            setError('Gagal menghapus user.');
          }
        })();
      },
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-indigo-600" />
          <h3 className="font-bold text-sm text-slate-800">Manajemen User</h3>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
        >
          <Plus size={14} /> Tambah Kasir
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-xl flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mx-5 mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-600 flex items-center gap-1">
            <UserPlus size={14} /> User Kasir Baru
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Username"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
            <input
              type="password"
              placeholder="Password (min 6)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
              minLength={6}
            />
            <input
              type="text"
              placeholder="Nama Lengkap"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-bold text-slate-500 bg-white border border-slate-300 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-xs font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Membuat...' : 'Buat User'}
            </button>
          </div>
        </form>
      )}

      <div className="p-5">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="pb-3">Nama</th>
              <th className="pb-3">Username</th>
              <th className="pb-3">Role</th>
              <th className="pb-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs">
            {users.map(u => (
              <tr key={u.docId} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 font-bold text-slate-800">{u.name}</td>
                <td className="py-3 text-slate-500 font-mono">{u.email.split('@')[0]}</td>
                <td className="py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    u.role === 'admin'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <ShieldCheck size={10} />
                    {u.role === 'admin' ? 'Admin' : 'Kasir'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  {u.role !== 'admin' && (
                    <Tooltip text="Hapus user">
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-red-400 hover:text-red-600 transition-colors cursor-pointer p-1"
                      >
                        <Ban size={14} />
                      </button>
                    </Tooltip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-6">Belum ada user.</p>
        )}
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
