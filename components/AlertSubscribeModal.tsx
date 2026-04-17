import React, { useState } from 'react';
import { subscribeToAlerts } from '../services/supabase';

interface AlertSubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BARRIOS = ['Pueblo', 'Boquerón', 'Combate', 'Joyuda', 'Puerto Real', 'Pedernales', 'Llanos Tuna', 'Monte Grande', 'Miradero', 'Pole Ojea', 'Guanajibo', 'Sabana Eneas', 'Las Palmas'];

const AlertSubscribeModal: React.FC<AlertSubscribeModalProps> = ({ isOpen, onClose }) => {
  const [phone, setPhone] = useState('');
  const [barrio, setBarrio] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // F7 fix: reset state when modal re-opens
  React.useEffect(() => {
    if (isOpen) { setPhone(''); setBarrio(''); setStatus('idle'); setErrorMsg(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setErrorMsg('Número debe tener al menos 10 dígitos');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      await subscribeToAlerts(digits, barrio || undefined);
      setStatus('success');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error al suscribir');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        {status === 'success' ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🔔</div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">¡Listo!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Te avisaremos cuando abran negocios nuevos.</p>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-teal-500 text-white rounded-full font-bold text-sm">Cerrar</button>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1 flex items-center gap-2">
              <i className="fa-solid fa-bell text-amber-500"></i> Alertas de negocios nuevos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Recibe un mensaje cuando abra algo nuevo.</p>

            <input
              type="tel"
              placeholder="787-417-7711"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />

            <select
              value={barrio}
              onChange={e => setBarrio(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todos los barrios</option>
              {BARRIOS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {status === 'error' && (
              <p className="text-xs text-red-500 mb-3">{errorMsg}</p>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button
                onClick={handleSubmit}
                disabled={status === 'loading'}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-50 transition-colors"
              >
                {status === 'loading' ? 'Enviando...' : 'Suscribirme'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AlertSubscribeModal;
