import React, { useState, useRef, useEffect } from 'react';
import { supabase, createPlace, updatePlace, deletePlace, uploadImage } from '../services/supabase';
import { generateMarketingCopy, enhanceDescription, suggestTags } from '../services/geminiService';
import { Place, PlaceCategory, ParkingStatus } from '../types';
import Button from './Button';
import { useLanguage } from '../i18n/LanguageContext';

// --- STYLED COMPONENTS & HELPERS ---
const SectionHeader = ({ title, icon, isOpen, onClick }: { title: string, icon: string, isOpen: boolean, onClick: () => void }) => (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700 transition-colors ${isOpen ? 'text-teal-400' : 'text-slate-300'}`}>
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOpen ? 'bg-teal-900/50' : 'bg-slate-700'}`}>
                <i className={`fa-solid fa-${icon} text-sm`}></i>
            </div>
            <span className="font-bold uppercase text-sm tracking-wider">{title}</span>
        </div>
        <i className={`fa-solid fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
    </button>
);

const InputGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="mb-4">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">{label}</label>
        {children}
    </div>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white text-base focus:border-teal-500 outline-none transition-all" {...props} />
);

const StyledTextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white text-base focus:border-teal-500 outline-none transition-all min-h-[120px]" {...props} />
);

const StyledSelect = ({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string, label: string }[] }) => (
    <div className="relative">
        <select className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white text-base focus:border-teal-500 outline-none appearance-none" {...props}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <i className="fa-solid fa-caret-down"></i>
        </div>
    </div>
);

const ToggleSwitch = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void }) => (
    <label className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-700 cursor-pointer">
        <span className="text-slate-300 font-bold text-sm">{label}</span>
        <div className={`w-12 h-7 rounded-full p-1 transition-colors ${checked ? 'bg-teal-500' : 'bg-slate-600'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </div>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="hidden" />
    </label>
);

// Safety helper to avoid [object Object] alerts
const safeAlert = (prefix: string, error: any) => {
    let msg = "Unknown error";
    if (typeof error === 'string') msg = error;
    else if (error instanceof Error) msg = error.message;
    else if (typeof error === 'object') {
        // Handle Postgrest Error
        msg = error.message || error.details || error.hint || "Unknown Object Error";
        if (msg === "Unknown Object Error") {
            try {
                msg = JSON.stringify(error);
            } catch (e) {
                msg = "Circular Object Error";
            }
        }
    }
    alert(`${prefix}: ${msg}`);
};

interface AdminProps { onClose: () => void; places: Place[]; onUpdate?: () => void; }
const EMPTY_PLACE: Partial<Place> = { name: '', category: PlaceCategory.FOOD, status: 'pending', coords: { lat: 18.0, lng: -67.1 }, plan: 'free', sponsor_weight: 0, priceLevel: '$', description: '', parking: ParkingStatus.FREE, tags: [], vibe: [] };

// --- INTERNAL STATE TYPES ---
interface MarketingState {
    isOpen: boolean;
    place: Place | null;
    platform: 'instagram' | 'email' | 'radio';
    content: string;
    loading: boolean;
}

interface MediaState {
    isOpen: boolean;
    place: Place | null;
    uploading: boolean;
}

const Admin: React.FC<AdminProps> = ({ onClose, places: initialPlaces, onUpdate }) => {
    const { t } = useLanguage(); 
    const [user, setUser] = useState<any>(null);
    const [authChecking, setAuthChecking] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'LIST' | 'EDITOR'>('LIST');
    const [places, setPlaces] = useState<Place[]>(initialPlaces);
    const [filter, setFilter] = useState('');
    const [editingPlace, setEditingPlace] = useState<Partial<Place>>(EMPTY_PLACE);
    const [openSection, setOpenSection] = useState<string>('identity'); 
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const quickFileRef = useRef<HTMLInputElement>(null);
    const [aiLoading, setAiLoading] = useState(false);

    // Modals
    const [marketing, setMarketing] = useState<MarketingState>({ isOpen: false, place: null, platform: 'instagram', content: '', loading: false });
    const [media, setMedia] = useState<MediaState>({ isOpen: false, place: null, uploading: false });

    useEffect(() => { setPlaces(initialPlaces); }, [initialPlaces]);

    useEffect(() => {
        const checkSession = async () => { const { data: { session } } = await supabase.auth.getSession(); if (session?.user) { setUser(session.user); } setAuthChecking(false); };
        checkSession();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); });
        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = async () => { setLoading(true); const { data, error } = await supabase.auth.signInWithPassword({ email, password }); setLoading(false); if (error) alert(error.message); else setUser(data.user); };
    
    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    // --- CRUD Handlers ---
    const handleSave = async () => { 
        setLoading(true); 
        try { 
            // Handle Tags and Vibe input which might be array or string (if edited manually)
            const processArrayInput = (input: string | string[] | undefined) => {
                if (Array.isArray(input)) return input;
                if (typeof input === 'string') return input.split(',').map(s => s.trim()).filter(Boolean);
                return [];
            };

            const cleanTags = processArrayInput(editingPlace.tags);
            const cleanVibe = processArrayInput(editingPlace.vibe);

            const payload = { 
                ...editingPlace, 
                tags: cleanTags, 
                vibe: cleanVibe, 
                is_featured: (editingPlace.sponsor_weight || 0) >= 100 
            }; 
            
            console.log("Saving Place:", payload);

            let res; 
            if (editingPlace.id) { res = await updatePlace(editingPlace.id, payload); } 
            else { res = await createPlace(payload); } 
            
            if (res.success) { 
                if (onUpdate) await onUpdate(); 
                setView('LIST'); 
            } else { safeAlert("Error", res.error); } 
        } catch (e: any) { 
            safeAlert("Error", e);
        } finally { setLoading(false); } 
    };
    
    const handleDelete = async () => { 
        if (!editingPlace.id || !window.confirm("Delete?")) return; 
        setLoading(true); 
        try {
            await deletePlace(editingPlace.id); 
            if (onUpdate) await onUpdate(); 
            setView('LIST'); 
        } catch (e: any) {
             safeAlert("Error", e);
        } finally {
            setLoading(false); 
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (!e.target.files?.[0]) return; 
        setIsUploading(true); 
        try {
            const res = await uploadImage(e.target.files[0]); 
            if (res.success && res.url) { 
                setEditingPlace(prev => ({ ...prev, imageUrl: res.url })); 
            } else { 
                safeAlert("Upload Error", res.error);
            } 
        } catch (e: any) {
            safeAlert("Upload Error", e);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    // --- AI & QUICK ACTIONS ---
    const runAI = async (task: 'copy' | 'improve' | 'tags') => { 
        setAiLoading(true); 
        const name = editingPlace.name || 'Lugar'; 
        const cat = editingPlace.category || 'General'; 
        if (task === 'copy') { const copy = await generateMarketingCopy(name, cat, 'instagram'); navigator.clipboard.writeText(copy); alert("Copy:\n\n" + copy); } 
        if (task === 'improve') { const desc = await enhanceDescription(editingPlace.description || '', name); setEditingPlace(prev => ({ ...prev, description: desc })); } 
        if (task === 'tags') { const tags = await suggestTags(name, cat); setEditingPlace(prev => ({ ...prev, tags: tags.split(', ') })); } 
        setAiLoading(false); 
    };

    // --- MARKETING MAGIC HANDLER ---
    const openMarketing = (place: Place) => {
        setMarketing({ isOpen: true, place, platform: 'instagram', content: '', loading: false });
    };

    const generateMarketing = async (platform: 'instagram' | 'email' | 'radio') => {
        if (!marketing.place) return;
        setMarketing(prev => ({ ...prev, platform, loading: true }));
        const copy = await generateMarketingCopy(marketing.place.name, marketing.place.category, platform);
        setMarketing(prev => ({ ...prev, content: copy, loading: false }));
    };

    // --- MEDIA MANAGER HANDLER ---
    const openMedia = (place: Place) => {
        setMedia({ isOpen: true, place, uploading: false });
    };

    const quickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !media.place) return;
        setMedia(prev => ({ ...prev, uploading: true }));
        try {
            const res = await uploadImage(e.target.files[0]);
            if (res.success && res.url) {
                await updatePlace(media.place.id, { imageUrl: res.url });
                if (onUpdate) await onUpdate();
                setMedia(prev => ({ ...prev, uploading: false, place: { ...prev.place!, imageUrl: res.url! } }));
            } else {
                safeAlert("Error", res.error);
                setMedia(prev => ({ ...prev, uploading: false }));
            }
        } catch (e: any) {
             safeAlert("Error", e);
             setMedia(prev => ({ ...prev, uploading: false }));
        }
    };

    // --- RENDER SUB-COMPONENTS ---
    
    const renderMarketingModal = () => (
        <div className="fixed inset-0 z-[3100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Editar Lugar <span className="text-slate-300 mx-2">|</span> Editor</h2>
                        <p className="text-slate-400 text-xs mt-1">Genera copy instantáneo con IA.</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2"><i className="fa-solid fa-wand-magic-sparkles"></i> Marketing</span>
                        <button onClick={() => setMarketing(prev => ({ ...prev, isOpen: false }))} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-800"><i className="fa-solid fa-xmark text-lg"></i></button>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto bg-slate-50">
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-purple-800 font-bold opacity-50">
                            <i className="fa-solid fa-pen-nib"></i> Create Content
                        </div>
                        <p className="text-slate-600 mb-6 text-sm">Use "El Veci" AI to generate marketing copy instantly for <span className="font-bold">{marketing.place?.name}</span>.</p>
                        
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {(['instagram', 'email', 'radio'] as const).map(p => (
                                <button 
                                    key={p} 
                                    onClick={() => setMarketing(prev => ({ ...prev, platform: p }))}
                                    className={`py-3 px-4 rounded-lg font-bold text-sm capitalize transition-all ${marketing.platform === p ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 transform scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        <button 
                            onClick={() => generateMarketing(marketing.platform)}
                            disabled={marketing.loading}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {marketing.loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-sparkles"></i>}
                            Generate Copy
                        </button>
                    </div>

                    {marketing.content && (
                        <div className="mt-6 animate-fade-in">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative">
                                <textarea 
                                    readOnly 
                                    value={marketing.content} 
                                    className="w-full h-40 text-slate-700 text-sm resize-none outline-none bg-transparent"
                                />
                                <button 
                                    onClick={() => { navigator.clipboard.writeText(marketing.content); alert("Copied!"); }}
                                    className="absolute bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors"
                                >
                                    Copy Text
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderMediaModal = () => (
        <div className="fixed inset-0 z-[3100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800">Media Manager</h2>
                    <button onClick={() => setMedia(prev => ({ ...prev, isOpen: false }))}><i className="fa-solid fa-xmark text-slate-400 hover:text-slate-800 text-lg"></i></button>
                </div>
                <div className="p-6">
                    <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden mb-4 border border-slate-200 relative group">
                        <img src={media.place?.imageUrl} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={media.place?.imageUrl} target="_blank" rel="noreferrer" className="text-white bg-white/20 backdrop-blur px-4 py-2 rounded-full font-bold text-sm hover:bg-white/40 transition-colors">
                                View Full Size
                            </a>
                        </div>
                    </div>
                    
                    <InputGroup label="Public URL">
                        <div className="flex gap-2">
                            <input readOnly value={media.place?.imageUrl} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 outline-none" />
                            <button onClick={() => { navigator.clipboard.writeText(media.place?.imageUrl || ''); alert("Copied!"); }} className="bg-slate-200 px-3 rounded-lg text-slate-600 hover:bg-slate-300"><i className="fa-solid fa-copy"></i></button>
                        </div>
                    </InputGroup>

                    <div className="mt-6 pt-6 border-t border-slate-100">
                        <label className="block w-full cursor-pointer group">
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 hover:border-blue-400 transition-all">
                                {media.uploading ? (
                                    <div className="text-blue-500"><i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i><p className="text-sm font-bold">Uploading...</p></div>
                                ) : (
                                    <div className="text-slate-400 group-hover:text-blue-500 transition-colors">
                                        <i className="fa-solid fa-cloud-arrow-up text-3xl mb-2"></i>
                                        <p className="text-sm font-bold">Upload New Image</p>
                                        <p className="text-xs mt-1">Replaces current image immediately</p>
                                    </div>
                                )}
                            </div>
                            <input type="file" ref={quickFileRef} className="hidden" onChange={quickUpload} disabled={media.uploading} accept="image/*" />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderDashboard = () => {
        const filtered = places.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
        return (
            <div className="fixed inset-0 bg-slate-50 z-[3000] flex flex-col font-sans">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 p-6 flex flex-col gap-4 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Panel de Control</h1>
                            <p className="text-slate-500 text-xs font-medium">{user.email}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingPlace(EMPTY_PLACE); setView('EDITOR'); }} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 text-xs sm:text-sm">
                                <i className="fa-solid fa-plus"></i> <span className="hidden sm:inline">Nuevo Lugar</span><span className="sm:hidden">Nuevo</span>
                            </button>
                            <button onClick={onClose} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 text-xs sm:text-sm" title="Volver al Mapa">
                                <i className="fa-solid fa-map-location-dot"></i> <span className="hidden sm:inline">Ver Mapa</span>
                            </button>
                            <button onClick={handleLogout} className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors flex items-center justify-center" title="Cerrar Sesión">
                                <i className="fa-solid fa-right-from-bracket"></i>
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-11 text-slate-700 outline-none focus:ring-2 focus:ring-teal-500 transition-all" 
                            placeholder="Search records..." 
                            value={filter} 
                            onChange={(e) => setFilter(e.target.value)} 
                        />
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {filtered.map(place => (
                        <div key={place.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group">
                            <div className="relative w-16 h-16 shrink-0">
                                <img src={place.imageUrl} className="w-full h-full rounded-lg object-cover bg-slate-100 border border-slate-100" alt="" />
                                {place.is_featured && <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white"></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 truncate text-lg">{place.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${place.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {place.status}
                                    </span>
                                    <span className="text-xs text-slate-400 truncate bg-slate-800 text-slate-100 px-2 py-0.5 rounded-full">{place.category}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => openMarketing(place)} className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 hover:scale-110 transition-all flex items-center justify-center" title="Marketing Magic">
                                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                                </button>
                                <button onClick={() => openMedia(place)} className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-110 transition-all flex items-center justify-center" title="Media Manager">
                                    <i className="fa-solid fa-image"></i>
                                </button>
                                <button onClick={() => { setEditingPlace(place); setView('EDITOR'); }} className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 hover:scale-110 transition-all flex items-center justify-center" title="Edit Record">
                                    <i className="fa-solid fa-pen"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                    <div className="h-10"></div>
                </div>

                {marketing.isOpen && marketing.place && renderMarketingModal()}
                {media.isOpen && media.place && renderMediaModal()}
            </div>
        );
    };

    const renderEditor = () => (
        <div className="fixed inset-0 bg-slate-900 z-[3000] flex flex-col animate-slide-up">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shadow-lg z-20">
                <button onClick={() => setView('LIST')} className="text-slate-400 flex items-center gap-2 font-bold"><i className="fa-solid fa-arrow-left"></i> {t('back')}</button>
                <div className="flex gap-2">
                    {editingPlace.id && <button onClick={handleDelete} className="w-10 h-10 bg-red-900/50 text-red-400 rounded-full"><i className="fa-solid fa-trash"></i></button>}
                    <button onClick={handleSave} disabled={loading} className="bg-teal-600 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-teal-900/50 flex items-center gap-2">{loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>} {t('save')}</button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-900/90">
                <SectionHeader title="Identidad & Status" icon="id-card" isOpen={openSection === 'identity'} onClick={() => setOpenSection(openSection === 'identity' ? '' : 'identity')} />
                {openSection === 'identity' && (<div className="p-4 space-y-4 bg-slate-900/50"><InputGroup label="Nombre"><StyledInput value={editingPlace.name} onChange={(e: any) => setEditingPlace({...editingPlace, name: e.target.value})} /></InputGroup><div className="grid grid-cols-2 gap-4"><InputGroup label="Categoría"><StyledSelect value={editingPlace.category} onChange={(e: any) => setEditingPlace({...editingPlace, category: e.target.value})} options={Object.values(PlaceCategory).map(c => ({value: c, label: c}))} /></InputGroup><InputGroup label="Status"><StyledSelect value={editingPlace.status || 'pending'} onChange={(e: any) => setEditingPlace({...editingPlace, status: e.target.value})} options={[{value: 'open', label: '🟢 Open'}, {value: 'pending', label: '🟡 Pending'}, {value: 'closed', label: '🔴 Closed'}]} /></InputGroup></div><div className="grid grid-cols-2 gap-4"><InputGroup label="Weight"><StyledInput type="number" value={editingPlace.sponsor_weight} onChange={(e: any) => setEditingPlace({...editingPlace, sponsor_weight: parseInt(e.target.value)})} /></InputGroup><InputGroup label="Icono"><StyledInput value={editingPlace.customIcon || ''} onChange={(e: any) => setEditingPlace({...editingPlace, customIcon: e.target.value})} placeholder="fa-pizza-slice" /></InputGroup></div><ToggleSwitch label="Verificado" checked={editingPlace.isVerified || false} onChange={(v: boolean) => setEditingPlace({...editingPlace, isVerified: v})} /></div>)}
                
                <SectionHeader title="Contenido & AI" icon="pen-nib" isOpen={openSection === 'content'} onClick={() => setOpenSection(openSection === 'content' ? '' : 'content')} />
                {openSection === 'content' && (
                    <div className="p-4 space-y-4 bg-slate-900/50">
                        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                            <button onClick={() => runAI('improve')} disabled={aiLoading} className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"><i className="fa-solid fa-wand-magic-sparkles"></i> AI Improve</button>
                            <button onClick={() => runAI('tags')} disabled={aiLoading} className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"><i className="fa-solid fa-tags"></i> AI Tags</button>
                        </div>
                        <InputGroup label="Descripción">
                            <StyledTextArea value={editingPlace.description} onChange={(e: any) => setEditingPlace({...editingPlace, description: e.target.value})} />
                        </InputGroup>
                        <InputGroup label="Tags (separar por coma)">
                            <StyledInput 
                                value={Array.isArray(editingPlace.tags) ? editingPlace.tags.join(', ') : (editingPlace.tags || '')} 
                                onChange={(e: any) => setEditingPlace({...editingPlace, tags: e.target.value})} 
                                placeholder="playa, familiar, barato"
                            />
                        </InputGroup>
                        <InputGroup label="Vibe (separar por coma)">
                             <StyledInput 
                                value={Array.isArray(editingPlace.vibe) ? editingPlace.vibe.join(', ') : (editingPlace.vibe || '')} 
                                onChange={(e: any) => setEditingPlace({...editingPlace, vibe: e.target.value})} 
                                placeholder="Romántico, Aventura, Chill"
                            />
                        </InputGroup>
                        <InputGroup label="Tips">
                            <StyledTextArea value={editingPlace.tips} onChange={(e: any) => setEditingPlace({...editingPlace, tips: e.target.value})} />
                        </InputGroup>
                    </div>
                )}
                
                <SectionHeader title="Ubicación" icon="map-location-dot" isOpen={openSection === 'location'} onClick={() => setOpenSection(openSection === 'location' ? '' : 'location')} />
                {openSection === 'location' && (<div className="p-4 space-y-4 bg-slate-900/50"><InputGroup label="Address"><StyledTextArea value={editingPlace.address} onChange={(e: any) => setEditingPlace({...editingPlace, address: e.target.value})} style={{minHeight: '80px'}} /></InputGroup><InputGroup label="GMap URL"><StyledInput value={editingPlace.gmapsUrl} onChange={(e: any) => setEditingPlace({...editingPlace, gmapsUrl: e.target.value})} /></InputGroup><div className="grid grid-cols-2 gap-4"><InputGroup label="Lat"><StyledInput type="number" value={editingPlace.coords?.lat} onChange={(e: any) => setEditingPlace({...editingPlace, coords: {...editingPlace.coords, lat: parseFloat(e.target.value)}})} /></InputGroup><InputGroup label="Lng"><StyledInput type="number" value={editingPlace.coords?.lng} onChange={(e: any) => setEditingPlace({...editingPlace, coords: {...editingPlace.coords, lng: parseFloat(e.target.value)}})} /></InputGroup></div></div>)}
                <SectionHeader title="Media" icon="camera" isOpen={openSection === 'media'} onClick={() => setOpenSection(openSection === 'media' ? '' : 'media')} />
                {openSection === 'media' && (<div className="p-4 space-y-4 bg-slate-900/50"><div className="bg-slate-800 p-4 rounded-xl border border-slate-700">{editingPlace.imageUrl && <img src={editingPlace.imageUrl} className="w-full h-48 object-cover rounded-lg mb-4 bg-black" alt="Preview" />}<button onClick={() => fileInputRef.current?.click()} className="bg-teal-600 text-white py-3 rounded-lg font-bold text-sm w-full">{isUploading ? 'Uploading...' : '📸 Upload Photo'}</button><input type="file" ref={fileInputRef} className="hidden" onChange={handleImageUpload} /></div><InputGroup label="Video URL"><StyledInput value={editingPlace.videoUrl} onChange={(e: any) => setEditingPlace({...editingPlace, videoUrl: e.target.value})} /></InputGroup></div>)}
                <SectionHeader title="Contacto & Amenidades" icon="phone" isOpen={openSection === 'contact'} onClick={() => setOpenSection(openSection === 'contact' ? '' : 'contact')} />
                {openSection === 'contact' && (<div className="p-4 space-y-4 bg-slate-900/50"><div className="grid grid-cols-2 gap-4"><InputGroup label="Tel"><StyledInput value={editingPlace.phone} onChange={(e: any) => setEditingPlace({...editingPlace, phone: e.target.value})} /></InputGroup><InputGroup label="Web"><StyledInput value={editingPlace.website} onChange={(e: any) => setEditingPlace({...editingPlace, website: e.target.value})} /></InputGroup></div><div className="space-y-3 pt-2"><ToggleSwitch label="Parking Free" checked={editingPlace.parking === ParkingStatus.FREE} onChange={(v: boolean) => setEditingPlace({...editingPlace, parking: v ? ParkingStatus.FREE : ParkingStatus.PAID})} /><ToggleSwitch label="Baños" checked={editingPlace.hasRestroom || false} onChange={(v: boolean) => setEditingPlace({...editingPlace, hasRestroom: v})} /><ToggleSwitch label="Pet Friendly" checked={editingPlace.isPetFriendly || false} onChange={(v: boolean) => setEditingPlace({...editingPlace, isPetFriendly: v})} /><ToggleSwitch label="Handicap" checked={editingPlace.isHandicapAccessible || false} onChange={(v: boolean) => setEditingPlace({...editingPlace, isHandicapAccessible: v})} /></div></div>)}
                <div className="h-20"></div>
            </div>
        </div>
    );

    // --- MAIN RENDER ---
    if (authChecking) return <div className="fixed inset-0 bg-slate-900 z-[3000] flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-teal-500 text-4xl"></i></div>;
    
    if (!user) return (
        <div className="fixed inset-0 bg-slate-900 z-[3000] flex flex-col justify-center p-6">
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-teal-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl shadow-teal-900/50"><i className="fa-solid fa-user-astronaut text-4xl text-white"></i></div>
                <h1 className="text-3xl font-black text-white">{t('admin_login')}</h1>
                <p className="text-slate-400">Control Total</p>
            </div>
            <div className="space-y-4">
                <StyledInput placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <StyledInput type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button label={loading ? t('loading') : "Login"} onClick={handleLogin} />
                <button onClick={onClose} className="w-full py-4 text-slate-500 font-bold">{t('cancel')}</button>
            </div>
        </div>
    );

    return view === 'LIST' ? renderDashboard() : renderEditor();
};
export default Admin;