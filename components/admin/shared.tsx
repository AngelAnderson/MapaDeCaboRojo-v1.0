
import React, { useEffect } from 'react';
import { getPlaceHeaderImage } from '../../utils/imageOptimizer';
import { Place } from '../../types';

// ─── Shared UI primitives ────────────────────────────────────────────────────

export const Section = ({ title, icon, children }: { title: string; icon: string; children?: React.ReactNode }) => (
  <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden mb-6">
    <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
      <i className={`fa-solid fa-${icon} text-teal-500`}></i>
      <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide">{title}</h3>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

export const InputGroup = ({
  label,
  children,
  description,
  className,
}: {
  label: string;
  children?: React.ReactNode;
  description?: string;
  className?: string;
}) => (
  <div className={`flex flex-col gap-1.5 ${className || ''}`}>
    <div className="flex justify-between items-baseline">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</label>
      {description && <span className="text-[10px] text-slate-500 italic">{description}</span>}
    </div>
    {children}
  </div>
);

export const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className="w-full bg-slate-900 text-white border border-slate-700 rounded-xl p-3 text-base focus:border-teal-500 outline-none transition-colors placeholder:text-slate-600 appearance-none"
    {...props}
  />
);

export const StyledSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select
      className="w-full bg-slate-900 text-white border border-slate-700 rounded-xl p-3 text-base focus:border-teal-500 outline-none transition-colors appearance-none cursor-pointer"
      {...props}
    />
    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
      <i className="fa-solid fa-chevron-down text-xs"></i>
    </div>
  </div>
);

export const StyledTextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className="w-full bg-slate-900 text-white border border-slate-700 rounded-xl p-3 text-base min-h-[100px] focus:border-teal-500 outline-none transition-colors resize-y placeholder:text-slate-600"
    {...props}
  />
);

export const Toggle = ({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  icon?: string;
}) => (
  <div
    onClick={() => onChange(!checked)}
    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all select-none active:scale-95 ${
      checked ? 'bg-teal-900/30 border-teal-500/50' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
    }`}
  >
    <div
      className={`w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0 ${
        checked ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-500'
      }`}
    >
      {checked && <i className="fa-solid fa-check text-xs"></i>}
    </div>
    <div className="flex items-center gap-2 overflow-hidden">
      {icon && (
        <i className={`fa-solid fa-${icon} ${checked ? 'text-teal-400' : 'text-slate-500'} w-5 text-center`}></i>
      )}
      <span className={`text-sm font-bold truncate ${checked ? 'text-white' : 'text-slate-400'}`}>{label}</span>
    </div>
  </div>
);

export const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[6000] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-slide-up ${
        type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
      }`}
    >
      <i className={`fa-solid fa-${type === 'success' ? 'check' : 'triangle-exclamation'}`}></i>
      <span className="font-bold text-sm">{message}</span>
    </div>
  );
};

export const SocialCardTemplate = React.forwardRef<HTMLDivElement, { place: Partial<Place> }>(({ place }, ref) => (
  <div
    ref={ref}
    className="fixed left-[-9999px] top-0 w-[1080px] h-[1920px] bg-slate-900 text-white flex flex-col relative overflow-hidden font-sans"
  >
    <div className="absolute inset-0 z-0">
      <img
        src={getPlaceHeaderImage(place.imageUrl || '')}
        alt="bg"
        className="w-full h-full object-cover opacity-60"
        crossOrigin="anonymous"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
    </div>
    <div className="relative z-10 flex-1 flex flex-col justify-end p-16 pb-24">
      <div className="flex gap-3 mb-6">
        <span className="bg-teal-500 text-white px-6 py-2 rounded-full text-2xl font-bold uppercase tracking-wider shadow-lg">
          {place.category}
        </span>
        {place.is_featured && (
          <span className="bg-amber-500 text-white px-6 py-2 rounded-full text-2xl font-bold uppercase tracking-wider shadow-lg">
            ★ Top Pick
          </span>
        )}
      </div>
      <h1 className="text-8xl font-black mb-6 leading-tight drop-shadow-xl">{place.name}</h1>
      {place.tips && (
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl mb-10">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-orange-400 text-4xl">💡</span>
            <h3 className="text-3xl font-bold text-orange-200 uppercase">El Veci dice:</h3>
          </div>
          <p className="text-3xl font-medium leading-relaxed text-slate-100">"{place.tips}"</p>
        </div>
      )}
      <div className="border-t border-white/30 pt-10 flex justify-between items-center">
        <div>
          <p className="text-2xl text-slate-400 uppercase font-bold tracking-widest mb-2">Descubre más en</p>
          <p className="text-4xl font-black text-white">MapaDeCaboRojo.com</p>
        </div>
        <div className="bg-white p-2 rounded-xl">
          <div className="w-24 h-24 border-4 border-slate-900 flex items-center justify-center">
            <span className="text-slate-900 font-bold text-xs text-center">
              SCAN
              <br />
              ME
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
));
