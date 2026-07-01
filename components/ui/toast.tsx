import React from 'react';
import { createRoot, Root } from 'react-dom/client';

/**
 * Zero-wiring toast. Call toast('Guardado') from anywhere — it mounts its own
 * container into <body> on first use. No provider needed.
 */
type ToastTone = 'default' | 'success' | 'error';
interface ToastItem { id: number; message: string; tone: ToastTone; }

let root: Root | null = null;
let push: ((t: ToastItem) => void) | null = null;
let seq = 0;

function ensureRoot() {
  if (root) return;
  const el = document.createElement('div');
  el.id = 'toast-root';
  el.style.cssText =
    'position:fixed;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0) + 88px);' +
    'display:flex;flex-direction:column;align-items:center;gap:8px;z-index:5000;pointer-events:none;';
  document.body.appendChild(el);
  root = createRoot(el);
  root.render(<ToastHost register={(fn) => { push = fn; }} />);
}

const ToastHost: React.FC<{ register: (fn: (t: ToastItem) => void) => void }> = ({ register }) => {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  React.useEffect(() => {
    register((t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    });
  }, [register]);

  const toneCls: Record<ToastTone, string> = {
    default: 'bg-ink text-canvas',
    success: 'bg-brand-600 text-white',
    error: 'bg-coral-600 text-white',
  };

  return (
    <>
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-slide-up pointer-events-auto max-w-[90vw] px-4 py-2.5 rounded-pill shadow-e4 text-sm font-semibold ${toneCls[t.tone]}`}
        >
          {t.message}
        </div>
      ))}
    </>
  );
};

export function toast(message: string, tone: ToastTone = 'default') {
  ensureRoot();
  const item = { id: ++seq, message, tone };
  if (push) push(item);
  else setTimeout(() => push && push(item), 50);
}

export const toastSuccess = (m: string) => toast(m, 'success');
export const toastError = (m: string) => toast(m, 'error');
