import { useState, FormEvent } from 'react';
import { Store, Lock, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { authenticateUser } from '../db';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    try {
      const user = await authenticateUser(cleanUsername, cleanPassword);
      
      if (user) {
        onLogin(user);
      } else {
        setError('Username atau password salah.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setError(`Gagal terhubung ke database: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md bg-neutral-800/60 backdrop-blur-2xl border border-neutral-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl z-10">
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-linear-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
            <Store size={32} className="stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            IKBAL<span className="text-indigo-400 font-black italic uppercase text-xs tracking-wider bg-indigo-400/10 px-2 py-1 rounded-md">Pro</span>
          </h1>
          <p className="text-neutral-400 text-sm mt-3 font-medium">Sistem Manajemen Kasir</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <ShieldCheck className="shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-indigo-400 transition-colors">
                <UserIcon size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-neutral-900/50 border border-neutral-700 text-white rounded-2xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600"
                placeholder="Masukkan username Anda"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-indigo-400 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-900/50 border border-neutral-700 text-white rounded-2xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl py-4 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-4 shadow-lg shadow-indigo-600/20"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* <div className="mt-8 pt-6 border-t border-neutral-700/50 text-center">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Gunakan <strong className="text-neutral-300">admin/admin123</strong> untuk akses penuh atau <strong className="text-neutral-300">kasir/kasir123</strong> untuk mode POS.
          </p>
        </div> */}

      </div>
    </div>
  );
}
