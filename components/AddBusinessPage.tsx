
import React, { useState, useRef } from 'react';
import { createPlace, uploadImage } from '../services/supabase';
import { moderateUserContent } from '../services/aiService';
import { findCoordinates } from '../services/placesService';
import { PlaceCategory, ParkingStatus } from '../types';
import Button from './Button';

/**
 * AddBusinessPage — formulario "Añade tu negocio al directorio".
 *
 * Distinto del flujo "Sugiere un lugar" (SuggestPlaceModal): ese lo llena un
 * vecino sobre un sitio que le gusta. Éste lo llena el DUEÑO sobre su propio
 * negocio — por eso captura su contacto (WhatsApp) para el follow-up y un
 * interés opcional en destacar (señal de Vitrina, sin pitch).
 *
 * Página standalone y compartible: mapadecaborojo.com/?page=negocio
 * Escribe a `places` con status 'pending' (createPlace lo guarda como 'closed'
 * para no-admins → entra a revisión del admin). El contacto del dueño va en
 * `contact_info`. Voz español abuelita-friendly, diseño teal/coral del sistema.
 */
const AddBusinessPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [resolvingCoords, setResolvingCoords] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Datos del negocio ---
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>(PlaceCategory.FOOD);
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [hoursType, setHoursType] = useState<'fixed' | '24_7' | 'sunrise_sunset'>('fixed');
  const [hoursNote, setHoursNote] = useState('');

  // --- Datos del dueño (para el follow-up) ---
  const [ownerName, setOwnerName] = useState('');
  const [ownerWhatsapp, setOwnerWhatsapp] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [wantsVitrina, setWantsVitrina] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('La foto es muy grande (máximo 5 MB). Prueba con otra.');
        return;
      }
      setImageFile(file);
    }
  };

  const handleGoHome = () => { window.location.href = '/'; };

  const handleNext = () => {
    if (!name.trim()) {
      alert('Escribe el nombre de tu negocio para seguir.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Falta el nombre del negocio.');
      return;
    }
    if (!ownerWhatsapp.trim()) {
      alert('Déjanos un WhatsApp para avisarte cuando esté listo.');
      return;
    }

    // El Veci revisa que el texto esté limpio antes de enviar
    setAnalyzing(true);
    const moderation = await moderateUserContent(name, description);
    setAnalyzing(false);
    if (!moderation.safe) {
      alert(`No pudimos enviarlo: ${moderation.reason || 'revisa el texto e intenta de nuevo.'}`);
      return;
    }

    setLoading(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        const up = await uploadImage(imageFile);
        if (up.success && up.url) imageUrl = up.url;
        else {
          alert(up.error || 'No se pudo subir la foto. Intenta de nuevo.');
          setLoading(false);
          return;
        }
      }

      let resolvedCoords;
      if (gmapsUrl.trim()) {
        setResolvingCoords(true);
        const coordsResult = await findCoordinates(gmapsUrl);
        if (coordsResult) resolvedCoords = coordsResult;
        setResolvingCoords(false);
      }

      const tags = ['Owner Submission', 'Directorio'];
      if (wantsVitrina) tags.push('Quiere Vitrina');

      const res = await createPlace({
        name,
        category,
        gmapsUrl,
        address: '',
        description,
        tips: '',
        imageUrl,
        phone,
        website,
        parking: ParkingStatus.FREE,
        hasRestroom: false,
        isPetFriendly: false,
        status: 'pending',
        coords: resolvedCoords,
        is_featured: false,
        sponsor_weight: 0,
        isVerified: false,
        tags,
        opening_hours: { type: hoursType, note: hoursNote },
        contact_info: {
          owner_name: ownerName.trim(),
          owner_whatsapp: ownerWhatsapp.trim(),
          owner_email: ownerEmail.trim(),
          wants_vitrina: wantsVitrina,
          submitted_via: 'add-business-page',
        },
      });

      if (res.success) setStep(3);
      else alert(res.error || 'No se pudo enviar. Intenta de nuevo en un rato.');
    } catch (e) {
      console.error('Submission Error:', e);
      alert('Falló la conexión. Revisa tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-4 rounded-xl border border-slate-300 dark:border-slate-600 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium";
  const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors">

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 px-4 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
            <i className="fa-solid fa-store"></i>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">Añade tu negocio</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gratis · al directorio de Cabo Rojo</p>
          </div>
        </div>
        <button onClick={handleGoHome} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors" aria-label="Cerrar">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-6 pb-32">

        {/* Intro — solo en el primer paso */}
        {step === 1 && (
          <div className="mb-6 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/40 rounded-2xl p-5 animate-fade-in">
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
              ¿Tienes un negocio en Cabo Rojo? Ponlo aquí para que los vecinos te encuentren
              en el mapa y cuando le escriben al Veci al <span className="font-bold whitespace-nowrap">787-417-7711</span>.
              Es <span className="font-bold">gratis</span> y toma dos minutos.
            </p>
          </div>
        )}

        {/* Progreso */}
        {step < 3 && (
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
          </div>
        )}

        {/* ───────────── PASO 1: el negocio ───────────── */}
        {step === 1 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <label className={labelClass}>Nombre del negocio *</label>
              <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Panadería La Esperanza" autoFocus />
            </div>

            <div>
              <label className={labelClass}>¿Qué tipo de negocio es?</label>
              <div className="relative">
                <select className={inputClass} value={category} onChange={e => setCategory(e.target.value as PlaceCategory)}>
                  {Object.values(PlaceCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <i className="fa-solid fa-chevron-down"></i>
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Enlace de Google Maps</label>
              <input className={inputClass} value={gmapsUrl} onChange={e => setGmapsUrl(e.target.value)} placeholder="Pega aquí el enlace de tu negocio en Google Maps" />
              <p className="text-[11px] text-slate-400 mt-1 ml-1">Así lo ubicamos exacto en el mapa. Si no lo tienes, déjalo en blanco.</p>
            </div>

            <div>
              <label className={labelClass}>Una foto del negocio</label>
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl p-8 text-center cursor-pointer hover:border-teal-500 dark:hover:border-teal-500 transition-colors group">
                {imageFile ? (
                  <div className="flex flex-col items-center">
                    <i className="fa-solid fa-check-circle text-teal-500 text-3xl mb-2"></i>
                    <span className="text-teal-600 dark:text-teal-400 font-bold">{imageFile.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400 group-hover:text-teal-500 transition-colors">
                    <i className="fa-solid fa-camera text-3xl mb-2"></i>
                    <span className="font-medium">Toca para subir una foto</span>
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
            </div>

            <div className="pt-4">
              <Button label="Siguiente" onClick={handleNext} icon="arrow-right" />
            </div>
          </div>
        )}

        {/* ───────────── PASO 2: detalles + dueño ───────────── */}
        {step === 2 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <label className={labelClass}>Cuéntanos qué ofreces</label>
              <textarea className={`${inputClass} h-28 resize-none`} value={description} onChange={e => setDescription(e.target.value)} placeholder="En una o dos líneas: qué vendes o qué servicio das." />
            </div>

            <div>
              <label className={labelClass}>Horario</label>
              <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-300 dark:border-slate-600 flex mb-3">
                {[
                  { id: 'fixed', label: 'Horario fijo' },
                  { id: '24_7', label: '24/7' },
                  { id: 'sunrise_sunset', label: 'Varía' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setHoursType(opt.id as any)}
                    className={`flex-1 py-2.5 text-[11px] font-bold uppercase rounded-lg transition-all ${hoursType === opt.id ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {hoursType === 'fixed' && (
                <input className={inputClass} value={hoursNote} onChange={e => setHoursNote(e.target.value)} placeholder="Ej. Lun a Sáb 9am-6pm" />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={labelClass}>Teléfono del negocio</label>
                <input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="787-000-0000" />
              </div>
              <div>
                <label className={labelClass}>Página web o Facebook (si tienes)</label>
                <input className={inputClass} value={website} onChange={e => setWebsite(e.target.value)} type="url" placeholder="facebook.com/tunegocio" />
              </div>
            </div>

            {/* Contacto del dueño */}
            <div className="bg-orange-50 dark:bg-orange-900/15 border border-orange-100 dark:border-orange-800/40 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <i className="fa-solid fa-user"></i>
                <span className="font-bold text-sm uppercase tracking-wide">¿A dónde te avisamos?</span>
              </div>
              <p className="text-[13px] text-slate-600 dark:text-slate-300 -mt-2">Te escribimos cuando tu negocio esté publicado.</p>
              <div>
                <label className={labelClass}>Tu nombre</label>
                <input className={inputClass} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="¿Cómo te llamas?" />
              </div>
              <div>
                <label className={labelClass}>Tu WhatsApp *</label>
                <input className={inputClass} value={ownerWhatsapp} onChange={e => setOwnerWhatsapp(e.target.value)} type="tel" placeholder="787-000-0000" />
              </div>
              <div>
                <label className={labelClass}>Tu correo (opcional)</label>
                <input className={inputClass} value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} type="email" placeholder="tucorreo@email.com" />
              </div>
            </div>

            {/* Interés Vitrina — informativo, sin pitch */}
            <label className="flex items-start gap-3 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-300 dark:border-slate-600 cursor-pointer hover:border-teal-500 transition-colors">
              <input type="checkbox" checked={wantsVitrina} onChange={e => setWantsVitrina(e.target.checked)} className="w-6 h-6 accent-teal-600 rounded mt-0.5 shrink-0 cursor-pointer" />
              <span className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                <span className="font-bold">Quiero que más gente lo vea.</span> Cuéntame cómo destacar mi
                negocio para que aparezca primero. <span className="text-slate-400">(sin compromiso)</span>
              </span>
            </label>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="px-6 py-4 rounded-xl text-slate-500 dark:text-slate-400 font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Atrás</button>
              <div className="flex-1">
                <Button
                  label={analyzing || resolvingCoords ? 'Revisando…' : loading ? 'Enviando…' : 'Añadir mi negocio'}
                  onClick={handleSubmit}
                  disabled={loading || analyzing || resolvingCoords}
                  icon={analyzing || resolvingCoords ? 'circle-notch fa-spin' : 'paper-plane'}
                />
              </div>
            </div>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Tu negocio entra a revisión antes de salir publicado. Nada se publica sin verificar.
            </p>
          </div>
        )}

        {/* ───────────── PASO 3: gracias ───────────── */}
        {step === 3 && (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg shadow-emerald-500/20">
              <i className="fa-solid fa-check"></i>
            </div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">¡Recibido, gracias!</h3>
            <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed max-w-md mx-auto">
              Lo revisamos y te escribimos por WhatsApp cuando tu negocio esté en el directorio.
              {wantsVitrina && ' Y te cuento cómo destacarlo para que aparezca primero.'}
            </p>
            <div className="mt-12 space-y-3">
              <Button label="Añadir otro negocio" onClick={() => window.location.reload()} variant="secondary" icon="plus" />
              <button onClick={handleGoHome} className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-white transition-colors">
                Ir al mapa
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AddBusinessPage;
