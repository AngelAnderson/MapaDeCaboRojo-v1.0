
import React, { useState, useEffect, useRef } from 'react';
import { Place, Event, PlaceCategory, ParkingStatus, EventCategory, AdminLog, DaySchedule } from '../types';
import { updatePlace, deletePlace, createPlace, updateEvent, deleteEvent, createEvent, getAdminLogs, uploadImage, loginAdmin, checkSession } from '../services/supabase';
import { fetchPlaceDetails } from '../services/geminiService';

interface AdminProps {
  onClose: () => void;
  places: Place[];
  events: Event[];
  onUpdate: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// --- UI COMPONENTS ---

const Section = ({ title, icon, children }: { title: string, icon: string, children?: React.ReactNode }) => (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden mb-6">
        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
            <i className={`fa-solid fa-${icon} text-teal-500`}></i>
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide">{title}</h3>
        </div>
        <div className="p-4 space-y-4">
            {children}
        </div>
    </div>
);

const InputGroup = ({ label, children, description }: { label: string, children?: React.ReactNode, description?: string }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-baseline">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</label>
        {description && <span className="text-[10px] text-slate-500 italic">{description}</span>}
    </div>
    {children}
  </div>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="w-full bg-slate-900 text-white border border-slate-700 rounded-xl p-3 text-base focus:border-teal-500 outline-none transition-colors placeholder:text-slate-600 appearance-none" {...props} />
);

const StyledSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
      <select className="w-full bg-slate-900 text-white border border-slate-700 rounded-xl p-3 text-base focus:border-teal-500 outline-none transition-colors appearance-none cursor-pointer" {...props} />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          <i className="fa-solid fa-chevron-down text-xs"></i>
      </div>
  </div>
);

const StyledTextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className="w-full bg-slate-900 text-white border border-slate-700 rounded-xl p-3 text-base min-h-[100px] focus:border-teal-500 outline-none transition-colors resize-y placeholder:text-slate-600" {...props} />
);

const Toggle = ({ label, checked, onChange, icon }: { label: string, checked: boolean, onChange: (val: boolean) => void, icon?: string }) => (
    <div 
        onClick={() => onChange(!checked)}
        className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all select-none active:scale-95 ${checked ? 'bg-teal-900/30 border-teal-500/50' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}
    >
        <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0 ${checked ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
            {checked && <i className="fa-solid fa-check text-xs"></i>}
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
            {icon && <i className={`fa-solid fa-${icon} ${checked ? 'text-teal-400' : 'text-slate-500'} w-5 text-center`}></i>}
            <span className={`text-sm font-bold truncate ${checked ? 'text-white' : 'text-slate-400'}`}>{label}</span>
        </div>
    </div>
);

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[6000] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-slide-up ${type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
            <i className={`fa-solid fa-${type === 'success' ? 'check' : 'triangle-exclamation'}`}></i>
            <span className="font-bold text-sm">{message}</span>
        </div>
    );
};

// --- MAIN COMPONENT ---

const Admin: React.FC<AdminProps> = ({ onClose, places, events, onUpdate }) => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // App State
  const [activeTab, setActiveTab] = useState<'places' | 'events' | 'logs'>('places');
  const [editingPlace, setEditingPlace] = useState<Partial<Place> | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  
  // Smart Import State
  const [importQuery, setImportQuery] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter lists
  const filteredPlaces = places.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredEvents = events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Check Session on Mount
  useEffect(() => {
      checkSession().then(hasSession => {
          if (hasSession) setIsAuthenticated(true);
          setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'logs' && isAuthenticated) {
      getAdminLogs().then(setLogs);
    }
  }, [activeTab, isAuthenticated]);

  const handleLogin = async () => {
      if (!email || !password) return showToast("Enter credentials", 'error');
      setAuthLoading(true);
      const res = await loginAdmin(email, password);
      setAuthLoading(false);
      if (res.user) {
          setIsAuthenticated(true);
      } else {
          showToast(res.error || "Login failed", 'error');
      }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  const handleGetLocation = () => {
      if (!navigator.geolocation) return alert("Geolocation not supported");
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              if (editingPlace) {
                  setEditingPlace({
                      ...editingPlace,
                      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }
                  });
                  showToast("GPS Updated!", 'success');
              }
          },
          (err) => alert("Error getting location: " + err.message),
          { enableHighAccuracy: true }
      );
  };

  const handleSavePlace = async () => {
    if (!editingPlace || !editingPlace.name) return showToast("Name is required", 'error');
    setIsSaving(true);
    try {
      if (editingPlace.id) {
        const res = await updatePlace(editingPlace.id, editingPlace);
        if (!res.success) throw new Error(res.error);
      } else {
        const res = await createPlace(editingPlace);
        if (!res.success) throw new Error(res.error);
      }
      await onUpdate();
      showToast("Guardado exitosamente", 'success');
      setEditingPlace(null); // Return to list on mobile/desktop
    } catch (e: any) {
      showToast(e.message || "Error saving", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlace = async (id: string) => {
    if (confirm("Are you sure? This action cannot be undone.")) {
      await deletePlace(id);
      await onUpdate();
      setEditingPlace(null);
      showToast("Place deleted", 'success');
    }
  };

  const handleSaveEvent = async () => {
      if (!editingEvent || !editingEvent.title) return showToast("Title is required", 'error');
      setIsSaving(true);
      try {
          if (editingEvent.id) {
              await updateEvent(editingEvent.id, editingEvent);
          } else {
              await createEvent(editingEvent);
          }
          await onUpdate();
          setEditingEvent(null);
          showToast("Event saved", 'success');
      } catch (e: any) {
          showToast(e.message || "Error saving event", 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      const res = await uploadImage(file);
      setIsUploading(false);

      if (res.success && res.url) {
          if (activeTab === 'places' && editingPlace) {
              setEditingPlace({ ...editingPlace, imageUrl: res.url });
          } else if (activeTab === 'events' && editingEvent) {
              setEditingEvent({ ...editingEvent, imageUrl: res.url });
          }
          showToast("Image uploaded!", 'success');
      } else {
          showToast(res.error || "Upload failed", 'error');
      }
  };

  const handleSmartImport = async () => {
      if (!importQuery) return showToast("Enter a name or link", 'error');
      setImportLoading(true);
      try {
          const details = await fetchPlaceDetails(importQuery);
          if (details) {
              setEditingPlace(prev => ({
                  ...prev,
                  ...details,
                  id: prev?.id, // Preserve ID
                  status: prev?.status || 'open'
              }));
              showToast("Import Successful!", 'success');
              setImportQuery('');
          } else {
              showToast("Could not find place details.", 'error');
          }
      } catch (e) {
          showToast("Import failed", 'error');
      } finally {
          setImportLoading(false);
      }
  };

  // --- SCHEDULE HELPERS ---
  const getStructuredHours = (): DaySchedule[] => {
      if (editingPlace?.opening_hours?.structured && editingPlace.opening_hours.structured.length === 7) {
          return editingPlace.opening_hours.structured;
      }
      // Initialize if missing
      return Array(7).fill(null).map((_, i) => ({ day: i, open: '09:00', close: '17:00', isClosed: false }));
  };

  const updateScheduleDay = (idx: number, field: keyof DaySchedule, val: any) => {
      const current = getStructuredHours();
      current[idx] = { ...current[idx], [field]: val };
      setEditingPlace({
          ...editingPlace,
          opening_hours: { ...(editingPlace?.opening_hours || {}), structured: current }
      });
  };

  const applyMonToFri = () => {
      const current = getStructuredHours();
      const monday = current[1]; // Monday
      const newSchedule = current.map((d, i) => {
          if (i >= 1 && i <= 5) return { ...d, open: monday.open, close: monday.close, isClosed: monday.isClosed };
          return d;
      });
      setEditingPlace({
          ...editingPlace,
          opening_hours: { ...(editingPlace?.opening_hours || {}), structured: newSchedule }
      });
      showToast("Applied Mon settings to Tue-Fri", 'success');
  };

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
      return (
        <div className="fixed inset-0 bg-slate-900 z-[5000] flex flex-col items-center justify-center p-6 animate-fade-in font-sans text-slate-200">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
            <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white"><i className="fa-solid fa-xmark text-2xl"></i></button>
            
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-xl">
                        <i className="fa-solid fa-lock text-3xl text-teal-500"></i>
                    </div>
                    <h1 className="text-2xl font-black text-white">Admin Access</h1>
                    <p className="text-slate-500 text-sm">Secure Entry Point</p>
                </div>

                <div className="space-y-4">
                    <input 
                        type="email" 
                        placeholder="Email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-teal-500 transition-colors"
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-teal-500 transition-colors"
                    />
                    <button 
                        onClick={handleLogin} 
                        disabled={authLoading}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {authLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Login'}
                    </button>
                </div>
            </div>
        </div>
      );
  }

  // --- DASHBOARD ---
  const isEditing = editingPlace || editingEvent;

  return (
    <div className="fixed inset-0 bg-slate-900 z-[5000] flex flex-col font-sans text-slate-200">
      
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-700 p-3 flex justify-between items-center shadow-md z-20 h-16 shrink-0">
        {isEditing ? (
            <div className="flex items-center gap-3 w-full">
                <button 
                    onClick={() => { setEditingPlace(null); setEditingEvent(null); }} 
                    className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 active:bg-slate-700 transition-colors"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Editing</h2>
                    <p className="text-white font-bold truncate">{editingPlace?.name || editingEvent?.title || 'New Item'}</p>
                </div>
                <button 
                    onClick={activeTab === 'places' ? handleSavePlace : handleSaveEvent} 
                    disabled={isSaving}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-900/20 active:scale-95 transition-transform flex items-center gap-2"
                >
                    {isSaving && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                    <span>Save</span>
                </button>
            </div>
        ) : (
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                    <div className="bg-teal-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
                        <i className="fa-solid fa-lock text-white text-xs"></i>
                    </div>
                    <span className="font-black text-lg tracking-tight">Admin</span>
                </div>
                
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button onClick={() => setActiveTab('places')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${activeTab === 'places' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Places</button>
                    <button onClick={() => setActiveTab('events')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${activeTab === 'events' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Events</button>
                    <button onClick={() => setActiveTab('logs')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${activeTab === 'logs' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Logs</button>
                </div>

                <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-700">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>
        )}
      </header>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-hidden flex relative">
        
        {/* LIST VIEW (Sidebar on Desktop, Full on Mobile when not editing) */}
        <div className={`w-full md:w-80 border-r border-slate-700 bg-slate-900 flex flex-col ${isEditing ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-700">
                <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:border-teal-500 outline-none"
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {activeTab === 'places' && (
                    <>
                    <button 
                        onClick={() => setEditingPlace({ name: '', category: PlaceCategory.FOOD, status: 'open', plan: 'free', coords: { lat: 0, lng: 0 }, amenities: {}, parking: ParkingStatus.FREE })} 
                        className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-teal-500 hover:text-teal-500 hover:bg-slate-800 transition-all font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-plus"></i> Add New Place
                    </button>
                    {filteredPlaces.map(p => (
                        <div key={p.id} onClick={() => setEditingPlace(p)} className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${editingPlace?.id === p.id ? 'bg-teal-900/20 border-teal-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-bold text-sm truncate ${editingPlace?.id === p.id ? 'text-teal-400' : 'text-slate-200'}`}>{p.name}</h4>
                                <div className={`w-2 h-2 rounded-full mt-1.5 ${p.status === 'open' ? 'bg-emerald-500' : p.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`}></div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="uppercase tracking-wider font-bold">{p.category}</span>
                                {p.is_featured && <span className="text-amber-500"><i className="fa-solid fa-star"></i></span>}
                            </div>
                        </div>
                    ))}
                    </>
                )}
                
                {activeTab === 'events' && (
                     <>
                        <button onClick={() => setEditingEvent({ title: '', category: EventCategory.COMMUNITY, status: 'published' })} className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-teal-500 hover:text-teal-500 hover:bg-slate-800 transition-all font-bold text-sm flex items-center justify-center gap-2">
                            <i className="fa-solid fa-plus"></i> Add New Event
                        </button>
                        {filteredEvents.map(e => (
                             <div key={e.id} onClick={() => setEditingEvent(e)} className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer">
                                <h4 className="text-slate-200 font-bold text-sm truncate">{e.title}</h4>
                                <p className="text-slate-500 text-xs truncate">{new Date(e.startTime).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </>
                )}

                {activeTab === 'logs' && (
                     <div className="space-y-3">
                        {logs.map(log => (
                            <div key={log.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-xs">
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`font-bold px-1.5 rounded ${log.action === 'UPDATE' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{log.action}</span>
                                    <span className="text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-slate-300 font-medium truncate">{log.place_name}</p>
                                <p className="text-slate-500 truncate">{log.details}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* EDITOR VIEW (Full screen on mobile if editing) */}
        <div className={`flex-1 bg-slate-900 overflow-y-auto custom-scrollbar ${isEditing ? 'absolute inset-0 z-10 md:static' : 'hidden md:flex flex-col items-center justify-center'}`}>
            
            {activeTab === 'places' && editingPlace ? (
                <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
                    
                    {/* ID & Delete Header */}
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-mono text-xs text-slate-500">{editingPlace.id || 'NEW RECORD'}</span>
                        {editingPlace.id && <button onClick={() => handleDeletePlace(editingPlace.id!)} className="text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Delete Record</button>}
                    </div>

                    {/* SMART IMPORT */}
                    <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-4 rounded-2xl border border-indigo-500/30 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <i className="fa-solid fa-wand-magic-sparkles text-6xl text-white"></i>
                        </div>
                        <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-bolt text-yellow-400"></i> Smart Import
                        </h3>
                        <div className="flex gap-2 relative z-10">
                            <input 
                                className="flex-1 bg-slate-900/80 border border-indigo-500/30 rounded-xl px-4 text-white placeholder:text-indigo-300/50 focus:border-indigo-400 outline-none" 
                                placeholder="Paste Google Maps Link or Place Name..."
                                value={importQuery}
                                onChange={(e) => setImportQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSmartImport()}
                            />
                            <button 
                                onClick={handleSmartImport}
                                disabled={importLoading}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/50 flex items-center gap-2 disabled:opacity-50"
                            >
                                {importLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-download"></i>}
                                <span className="hidden md:inline">Auto-Fill</span>
                            </button>
                        </div>
                        <p className="text-[10px] text-indigo-300 mt-2 ml-1">
                            Fetches photos, hours, address, coords & more from Google/Web.
                        </p>
                    </div>

                    <Section title="Basic Info" icon="circle-info">
                        <InputGroup label="Name"><StyledInput value={editingPlace.name || ''} onChange={e => setEditingPlace({...editingPlace, name: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup label="Category">
                                <StyledSelect 
                                    value={editingPlace.category || PlaceCategory.FOOD} 
                                    onChange={e => setEditingPlace({...editingPlace, category: e.target.value as PlaceCategory})}
                                >
                                    {Object.values(PlaceCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label="Icon Name">
                                <div className="flex gap-2">
                                    <StyledInput value={editingPlace.customIcon || ''} onChange={e => setEditingPlace({...editingPlace, customIcon: e.target.value})} placeholder="pizza-slice" />
                                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 text-xl shrink-0">
                                        <i className={`fa-solid fa-${editingPlace.customIcon || 'icons'}`}></i>
                                    </div>
                                </div>
                            </InputGroup>
                        </div>
                        <InputGroup label="Description"><StyledTextArea value={editingPlace.description || ''} onChange={e => setEditingPlace({...editingPlace, description: e.target.value})} /></InputGroup>
                        <InputGroup label="Tags"><StyledInput value={(editingPlace.tags || []).join(', ')} onChange={e => setEditingPlace({...editingPlace, tags: e.target.value.split(',').map(s => s.trim())})} /></InputGroup>
                    </Section>

                    <Section title="Location" icon="map-location-dot">
                        <InputGroup label="Address"><StyledInput value={editingPlace.address || ''} onChange={e => setEditingPlace({...editingPlace, address: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-2 gap-4">
                             <InputGroup label="Lat"><StyledInput type="number" value={editingPlace.coords?.lat || 0} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords!, lat: parseFloat(e.target.value) }})} /></InputGroup>
                             <InputGroup label="Lng"><StyledInput type="number" value={editingPlace.coords?.lng || 0} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords!, lng: parseFloat(e.target.value) }})} /></InputGroup>
                        </div>
                        <button onClick={handleGetLocation} className="w-full py-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                            <i className="fa-solid fa-location-crosshairs"></i> Use My Current Location
                        </button>
                        <InputGroup label="Maps Link"><StyledInput value={editingPlace.gmapsUrl || ''} onChange={e => setEditingPlace({...editingPlace, gmapsUrl: e.target.value})} /></InputGroup>
                    </Section>

                    <Section title="Operations & Hours" icon="clock">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Hours Strategy</label>
                        <div className="bg-slate-900/50 p-1 rounded-xl border border-slate-700 flex mb-4">
                            {['fixed', '24_7', 'sunrise_sunset'].map(type => (
                                <button 
                                    key={type}
                                    onClick={() => setEditingPlace({...editingPlace, opening_hours: { ...(editingPlace.opening_hours || {}), type: type as any } })}
                                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-colors ${editingPlace.opening_hours?.type === type || (!editingPlace.opening_hours?.type && type === 'fixed') ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {type === '24_7' ? '24/7' : type.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        
                        {(!editingPlace.opening_hours?.type || editingPlace.opening_hours?.type === 'fixed') && (
                            <div className="space-y-4">
                                <InputGroup label="Display Note (e.g. Daily 8am-5pm)">
                                    <StyledInput 
                                        value={editingPlace.opening_hours?.note || ''} 
                                        onChange={e => setEditingPlace({...editingPlace, opening_hours: { ...editingPlace.opening_hours, note: e.target.value }})} 
                                    />
                                </InputGroup>

                                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Weekly Schedule</span>
                                        <button onClick={applyMonToFri} className="text-[10px] bg-teal-600/20 text-teal-400 px-2 py-1 rounded hover:bg-teal-600/30 transition-colors font-bold">
                                            Apply Mon-Fri
                                        </button>
                                    </div>
                                    {getStructuredHours().map((dayData, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                                            <div className="w-8 text-xs font-bold text-slate-400 uppercase">{DAYS[index]}</div>
                                            
                                            <div className="flex-1 flex items-center gap-2">
                                                {!dayData.isClosed ? (
                                                    <>
                                                        <input 
                                                            type="time" 
                                                            value={dayData.open} 
                                                            onChange={e => updateScheduleDay(index, 'open', e.target.value)}
                                                            className="bg-slate-800 text-white text-sm rounded-lg p-1 border border-slate-600 focus:border-teal-500 outline-none w-24 text-center"
                                                        />
                                                        <span className="text-slate-600 font-bold">-</span>
                                                        <input 
                                                            type="time" 
                                                            value={dayData.close} 
                                                            onChange={e => updateScheduleDay(index, 'close', e.target.value)}
                                                            className="bg-slate-800 text-white text-sm rounded-lg p-1 border border-slate-600 focus:border-teal-500 outline-none w-24 text-center"
                                                        />
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-slate-500 italic flex-1 text-center font-medium bg-slate-800/50 py-1.5 rounded-lg">Closed</span>
                                                )}
                                            </div>

                                            <button 
                                                onClick={() => updateScheduleDay(index, 'isClosed', !dayData.isClosed)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dayData.isClosed ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                title={dayData.isClosed ? "Mark as Open" : "Mark as Closed"}
                                            >
                                                <i className={`fa-solid ${dayData.isClosed ? 'fa-ban' : 'fa-check'}`}></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <InputGroup label="Phone"><StyledInput type="tel" value={editingPlace.phone || ''} onChange={e => setEditingPlace({...editingPlace, phone: e.target.value})} /></InputGroup>
                        <InputGroup label="Website"><StyledInput value={editingPlace.website || ''} onChange={e => setEditingPlace({...editingPlace, website: e.target.value})} /></InputGroup>
                    </Section>

                    <Section title="Media" icon="image">
                         <div 
                            className="relative w-full aspect-video bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden mb-4"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {editingPlace.imageUrl ? (
                                <img src={editingPlace.imageUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-4 text-slate-500">
                                    <i className="fa-solid fa-cloud-arrow-up text-3xl mb-2"></i>
                                    <p className="font-bold">Tap to Upload</p>
                                </div>
                            )}
                            {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        <InputGroup label="Image URL"><StyledInput value={editingPlace.imageUrl || ''} onChange={e => setEditingPlace({...editingPlace, imageUrl: e.target.value})} /></InputGroup>
                        
                        <div className="grid grid-cols-3 gap-2">
                             {['top', 'center', 'bottom'].map(pos => (
                                <button 
                                    key={pos} 
                                    onClick={() => setEditingPlace({...editingPlace, imagePosition: pos})}
                                    className={`py-2 rounded-lg border text-xs font-bold uppercase ${editingPlace.imagePosition === pos ? 'bg-teal-600 border-teal-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                                >
                                    {pos}
                                </button>
                             ))}
                        </div>
                    </Section>

                    <Section title="Details & Amenities" icon="list-check">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Toggle label="Visible (Open)" checked={editingPlace.status === 'open'} onChange={v => setEditingPlace({...editingPlace, status: v ? 'open' : 'closed'})} icon="eye" />
                            <Toggle label="Verified" checked={editingPlace.isVerified || false} onChange={v => setEditingPlace({...editingPlace, isVerified: v})} icon="certificate" />
                            <Toggle label="Featured" checked={editingPlace.is_featured || false} onChange={v => setEditingPlace({...editingPlace, is_featured: v})} icon="star" />
                            <Toggle label="Landing Spot" checked={editingPlace.isLanding || false} onChange={v => setEditingPlace({...editingPlace, isLanding: v})} icon="map-pin" />
                            <Toggle label="Pet Friendly" checked={editingPlace.isPetFriendly || false} onChange={v => setEditingPlace({...editingPlace, isPetFriendly: v})} icon="dog" />
                            <Toggle label="Restrooms" checked={editingPlace.hasRestroom || false} onChange={v => setEditingPlace({...editingPlace, hasRestroom: v})} icon="restroom" />
                            <Toggle label="Generator" checked={editingPlace.hasGenerator || false} onChange={v => setEditingPlace({...editingPlace, hasGenerator: v})} icon="bolt" />
                            <Toggle label="Paid Parking" checked={editingPlace.parking === ParkingStatus.PAID} onChange={v => setEditingPlace({...editingPlace, parking: v ? ParkingStatus.PAID : ParkingStatus.FREE})} icon="square-parking" />
                         </div>
                         <div className="mt-4 space-y-4">
                            <InputGroup label="El Veci Tip"><StyledTextArea value={editingPlace.tips || ''} onChange={e => setEditingPlace({...editingPlace, tips: e.target.value})} /></InputGroup>
                            
                            <InputGroup label="Advanced Contact Info (JSON)" description="Raw JSON for extra details like Instagram, Email, Manager">
                                <StyledTextArea 
                                    className="font-mono text-xs h-24 bg-slate-950 text-emerald-400 border-slate-800"
                                    value={JSON.stringify(editingPlace.contact_info || {}, null, 2)} 
                                    onChange={e => {
                                        try {
                                            const parsed = JSON.parse(e.target.value);
                                            setEditingPlace({...editingPlace, contact_info: parsed});
                                        } catch(err) {
                                            // Allow typing, validate on blur/save ideally, but for now just let it be (state won't update if invalid json)
                                        }
                                    }} 
                                />
                            </InputGroup>
                         </div>
                    </Section>

                    <div className="h-12"></div>
                </div>
            ) : activeTab === 'events' && editingEvent ? (
                <div className="p-4 md:p-8 max-w-2xl mx-auto">
                    <Section title="Event Details" icon="calendar">
                        <InputGroup label="Title"><StyledInput value={editingEvent.title || ''} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} /></InputGroup>
                        <InputGroup label="Description"><StyledTextArea value={editingEvent.description || ''} onChange={e => setEditingEvent({...editingEvent, description: e.target.value})} /></InputGroup>
                        <InputGroup label="Start"><StyledInput type="datetime-local" value={editingEvent.startTime?.slice(0, 16) || ''} onChange={e => setEditingEvent({...editingEvent, startTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                        <InputGroup label="End"><StyledInput type="datetime-local" value={editingEvent.endTime?.slice(0, 16) || ''} onChange={e => setEditingEvent({...editingEvent, endTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                        <div 
                            className="relative w-full aspect-video bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden mt-4"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {editingEvent.imageUrl ? <img src={editingEvent.imageUrl} className="w-full h-full object-cover" /> : <p>Upload Image</p>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </Section>
                </div>
            ) : (
                <div className="text-center text-slate-500 opacity-50">
                    <i className="fa-solid fa-hand-pointer text-4xl mb-4"></i>
                    <p>Select an item from the list</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
