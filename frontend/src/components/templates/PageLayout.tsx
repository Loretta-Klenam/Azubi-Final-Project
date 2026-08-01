import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navbar } from '../organisms/Navbar';
import { useUIStore } from '../../store/uiStore';

interface Props {
  children: ReactNode;
}

export function PageLayout({ children }: Props) {
  const toast = useUIStore((s) => s.toast);
  const clearToast = useUIStore((s) => s.clearToast);

  return (
    <div className="page-shell min-h-screen text-slate-900">
      <Navbar />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>

      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={clearToast}
            className={`fixed bottom-6 right-6 z-50 cursor-pointer rounded-xl border px-5 py-3 text-sm shadow-xl ${
              toast.type === 'success'
                ? 'border-emerald-700 bg-emerald-900/80 text-emerald-200'
                : 'border-red-700 bg-red-900/80 text-red-200'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
