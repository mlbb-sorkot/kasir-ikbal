import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ModalAction[];
  icon?: ReactNode;
}

export default function Modal({ open, onClose, title, description, children, actions, icon }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const variantStyles: Record<string, string> = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20',
    ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {icon && (
          <div className="flex justify-center pt-6 pb-2">
            {icon}
          </div>
        )}

        <div className="px-6 pb-4 pt-4 text-center">
          <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
          {description && (
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{description}</p>
          )}
        </div>

        {children && <div className="px-6 pb-4">{children}</div>}

        {actions && actions.length > 0 && (
          <div className="px-6 pb-6 flex flex-col gap-2">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${variantStyles[action.variant || 'primary']}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
