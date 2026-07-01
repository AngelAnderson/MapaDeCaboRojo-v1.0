import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface SubmitEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Matches the public.events `category` enum (Supabase project vprjteqgmanntvisjrvp).
const EVENT_CATEGORIES = [
  'Música',
  'Comida',
  'Deportes',
  'Cultura',
  'Comunidad',
  'Bienestar',
  'Ciudadanía',
  'Aprendizaje',
  'Crecimiento Personal',
];

const SubmitEventModal: React.FC<SubmitEventModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [locationName, setLocationName] = useState('');
  const [municipality, setMunicipality] = useState('Cabo Rojo');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterContact, setSubmitterContact] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim()) { alert('Escribe el nombre del evento.'); return; }
    if (!startLocal) { alert('Pon la fecha y hora del evento.'); return; }
    if (!submitterContact.trim()) { alert('Déjanos un teléfono o email por si tenemos una pregunta.'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.from('events').insert([{
        title: title.trim(),
        category: category || null,
        start_time: new Date(startLocal).toISOString(),
        end_time: endLocal ? new Date(endLocal).toISOString() : null,
        location_name: locationName.trim() || null,
        municipality: municipality.trim() || 'Cabo Rojo',
        description: description.trim() || null,
        ticket_link: link.trim() || null,
        submitter_name: submitterName.trim() || null,
        submitter_contact: submitterContact.trim(),
        // Required by the events_public_submit RLS policy — keeps public
        // submissions pending so they flow through Angel's review pipeline.
        status: 'pending',
        angel_approved: false,
        discovery_source: 'public_submission',
        app_origin: 'mapadecaborojo',
      }]);
      if (error) throw error;
      setDone(true);
    } catch (e: any) {
      console.error('Event submission error:', e);
      alert('No pudimos enviar el evento. Verifica los datos e intenta otra vez.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-canvas text-ink p-3 rounded-xl border border-line outline-none focus:border-brand-500 transition-colors";
  const labelClass = "block text-xs font-bold text-ink-muted uppercase mb-1";

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[2500] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-paper w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh] transition-colors">
        <div className="bg-brand-600 dark:bg-brand-700 p-6 text-white flex justify-between items-center shrink-0 shadow-md z-10">
          <div>
            <h2 className="text-2xl font-black">Somete tu evento</h2>
            <p className="text-brand-100 text-sm">Cuéntale al pueblo lo que viene. Lo revisamos y lo publicamos.</p>
          </div>
          <button onClick={onClose} className="bg-brand-700/50 p-2 rounded-full hover:bg-brand-800 transition-colors" aria-label="Cerrar">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-paper">
          {!done ? (
            <div className="space-y-4 animate-slide-up">
              <div>
                <label className={labelClass}>Nombre del evento *</label>
                <input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Festival del Mangó" autoFocus />
              </div>

              <div>
                <label className={labelClass}>Categoría</label>
                <select className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">Escoge una…</option>
                  {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>¿Cuándo empieza? *</label>
                  <input type="datetime-local" className={inputClass} value={startLocal} onChange={e => setStartLocal(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>¿Cuándo termina?</label>
                  <input type="datetime-local" className={inputClass} value={endLocal} onChange={e => setEndLocal(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Lugar</label>
                  <input className={inputClass} value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Ej. Plaza de Cabo Rojo" />
                </div>
                <div>
                  <label className={labelClass}>Pueblo</label>
                  <input className={inputClass} value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="Cabo Rojo" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Descripción</label>
                <textarea className={`${inputClass} h-24`} value={description} onChange={e => setDescription(e.target.value)} placeholder="¿Qué es? ¿Para quién? ¿Cuesta algo?" />
              </div>

              <div>
                <label className={labelClass}>Enlace (boletos o más info)</label>
                <input className={inputClass} value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" type="url" />
              </div>

              <div className="bg-canvas/50 p-4 rounded-xl border border-line space-y-3">
                <p className="text-xs text-ink-muted">Por si tenemos una pregunta antes de publicar. No se muestra al público.</p>
                <div>
                  <label className={labelClass}>Tu nombre</label>
                  <input className={inputClass} value={submitterName} onChange={e => setSubmitterName(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Tu teléfono o email *</label>
                  <input className={inputClass} value={submitterContact} onChange={e => setSubmitterContact(e.target.value)} placeholder="787-000-0000" />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-600/20 transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Enviando…</>
                  : <><i className="fa-solid fa-paper-plane"></i> Enviar evento</>}
              </button>
            </div>
          ) : (
            <div className="text-center py-10 animate-fade-in">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">
                <i className="fa-solid fa-check"></i>
              </div>
              <h3 className="text-2xl font-bold text-ink">¡Gracias! Lo recibimos.</h3>
              <p className="text-ink-soft mt-2">Lo revisamos y, si todo cuadra, lo publicamos en el mapa.</p>
              <button onClick={onClose} className="mt-8 bg-slate-900 dark:bg-white text-white dark:text-ink px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">Cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmitEventModal;
