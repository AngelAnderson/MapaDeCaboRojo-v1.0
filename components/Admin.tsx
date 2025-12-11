import React, { useState, useEffect, useRef } from 'react';
import { Place, Event, AdminLog, PlaceCategory, ParkingStatus } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { supabase, getAdminLogs, getEvents, createPlace, updatePlace, deletePlace, uploadImage } from '../services/supabase';
import { fetchPlaceDetails, findCoordinates, enrichPlaceMetadata, generateExecutiveBriefing, generateEditorialContent } from '../services/geminiService';

interface AdminProps {
  onClose: () => void;
  places: Place[];
  events: Event[];
  onUpdate: () => void;
}

const InputGroup = ({ label, children }: { label: string, children?: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-400 uppercase">{label}</label>
    {children}
  </div>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm focus:border-teal-500 outline-none transition-colors" {...props} />
);

const StyledTextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm focus:border-teal-500 outline-none transition-colors min-h-[100px]" {...props} />
);

const SectionHeader = ({ title, icon, isOpen, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isOpen ? 'bg-slate-800 border-teal-500/50 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
        <div className="flex items-center gap-3"><i className={`fa-solid fa-${icon} ${isOpen ? 'text-teal-400' : ''}`}></i><span className="font-bold text-sm">{title}</span></div>
        <i className={`fa-solid fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
    </button>
);

const HoursEditor = ({ schedule, onChange }: { schedule: any[], onChange: (s: any[]) => void }) => {
    // Basic implementation for structured hours
    return <div className="text-slate-500 text-xs italic bg-slate-800 p-2 rounded">Structured Hours Editor UI (Coming Soon)</div>
};

const LocationPicker = ({ coords, onChange, centerTrigger }: any) => {
    // Placeholder for map picker
    return <div className="h-32 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 text-xs mb-2">Map Picker Placeholder</div>;
};

const Admin: React.FC<AdminProps> = ({ onClose, places, events: initialEvents, onUpdate }) => {
    const { t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'dashboard' | 'places' | 'events' | 'editorial' | 'marketing' | 'logs' | 'team'>('dashboard');
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [eventsList, setEventsList] = useState<Event[]>(initialEvents || []);
    
    // Briefing State
    const [briefingData, setBriefingData] = useState<any>(null); 
    const [briefingLang, setBriefingLang] = useState<'en' | 'es'>('en');

    // Editor State (Places)
    const [editingPlace, setEditingPlace] = useState<Place | null>(null);
    const [openSection, setOpenSection] = useState<string>('basic');
    const [placeSearchTerm, setPlaceSearchTerm] = useState('');
    const [importQuery, setImportQuery] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    
    // Editorial State
    const [editorialResult, setEditorialResult] = useState('');
    const [editorialLoading, setEditorialLoading] = useState(false);

    // Location Tools State
    const [locationQuery, setLocationQuery] = useState('');
    const [locating, setLocating] = useState(false);
    const [mapCenterTrigger, setMapCenterTrigger] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [teamMembers] = useState([
        { id: 1, name: 'Angel (You)', role: 'Owner', email: 'angel@caborojo.com', status: 'Online', lastActive: 'Now' },
        { id: 2, name: 'Noelia', role: 'Admin', email: 'noelia@caborojo.com', status: 'Active', lastActive: '2h ago' }
    ]);

    useEffect(() => {
        checkUser();
        if (initialEvents) setEventsList(initialEvents);
    }, [initialEvents]);

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setUser(session.user);
            loadDashboardData();
        }
    };

    const loadDashboardData = async () => {
        const logsData = await getAdminLogs();
        setLogs(logsData);
        const evts = await getEvents();
        setEventsList(evts);
        try {
            const lastBriefing = logsData.find(l => l.action === 'AI_BRIEFING');
            if (lastBriefing) {
                setBriefingData(JSON.parse(lastBriefing.details));
            }
        } catch(e) {}
    };

    const handleLogin = async () => {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else {
            setUser(data.user);
            loadDashboardData();
        }
        setLoading(false);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await processFile(e.dataTransfer.files[0]);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        if (e.clipboardData.files && e.clipboardData.files[0]) {
            e.preventDefault();
            await processFile(e.clipboardData.files[0]);
        }
    };

    const processFile = async (file: File) => {
        if (!editingPlace) return;
        setLoading(true);
        const res = await uploadImage(file);
        if (res.success && res.url) {
            setEditingPlace({ ...editingPlace, imageUrl: res.url });
        } else {
            alert("Upload failed: " + (res.error || "Unknown error"));
        }
        setLoading(false);
    };

    const handleGenerateBriefing = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/cron-briefing');
            if (res.ok) {
                loadDashboardData(); 
            } else {
                const raw = await generateExecutiveBriefing(logs, places);
                setBriefingData(JSON.parse(raw));
            }
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const handleExportCSV = () => {
        const headers = ["id", "name", "category", "description", "lat", "lon", "status", "is_featured", "tags", "amenities", "opening_hours", "contact_info", "sponsor_weight"];
        const rows = places.map(p => [
            p.id, `"${p.name.replace(/"/g, '""')}"`, p.category, `"${p.description.replace(/"/g, '""')}"`, p.coords.lat, p.coords.lng, p.status, p.is_featured, `"${(p.tags || []).join(', ')}"`, `"${JSON.stringify(p.amenities || {}).replace(/"/g, '""')}"`, `"${JSON.stringify(p.opening_hours || {}).replace(/"/g, '""')}"`, `"${JSON.stringify(p.contact_info || {}).replace(/"/g, '""')}"`, p.sponsor_weight
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `places_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const runEditorial = async (type: 'weekly_events' | 'notifications' | 'weekly_summary' | 'daily_content') => {
        setEditorialLoading(true);
        const text = await generateEditorialContent(type, places, eventsList);
        setEditorialResult(text);
        setEditorialLoading(false);
    };

    if (!user) {
        return (
            <div className="fixed inset-0 z-[5000] bg-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-teal-900/50 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border border-teal-500/30"><i className="fa-solid fa-lock"></i></div>
                        <h2 className="text-2xl font-black text-white">Admin Access</h2>
                    </div>
                    <div className="space-y-4">
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none" />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none" />
                        <button onClick={handleLogin} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold p-3 rounded-xl transition-colors disabled:opacity-50">{loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Unlock System"}</button>
                        <button onClick={onClose} className="w-full text-slate-500 text-sm font-bold p-2 hover:text-white">Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    const handleSmartImport = async () => {
        if (!importQuery) return;
        setIsImporting(true);
        const details = await fetchPlaceDetails(importQuery);
        setIsImporting(false);
        
        if (details) {
            setEditingPlace(prev => ({
                ...prev!,
                ...details,
                id: prev?.id || 'new',
                status: prev?.status || 'open',
                coords: details.coords || prev?.coords || { lat: 17.9620, lng: -67.1650 },
                amenities: { 
                    ...prev?.amenities, 
                    ...details.amenities 
                },
                opening_hours: details.opening_hours || prev?.opening_hours || { note: '' },
                parking: details.parking || prev?.parking || ParkingStatus.FREE,
                isPetFriendly: details.isPetFriendly ?? prev?.isPetFriendly ?? false,
                hasRestroom: details.hasRestroom ?? prev?.hasRestroom ?? false,
                hasGenerator: details.hasGenerator ?? prev?.hasGenerator ?? false,
                imageUrl: details.imageUrl || prev?.imageUrl || '',
            }));
            setMapCenterTrigger(prev => prev + 1);
        } else {
            alert("Could not find place details. Try a more specific name.");
        }
    };

    const handleSavePlace = async () => {
        if (!editingPlace) return;
        setLoading(true);
        if (editingPlace.isLanding) {
            const conflictingPlaces = places.filter(p => !!p.isLanding && p.id !== editingPlace.id);
            for (const conflict of conflictingPlaces) {
                await updatePlace(conflict.id, { ...conflict, isLanding: false });
            }
        }
        let res;
        if (editingPlace.id === 'new') {
            const { id, ...newPlace } = editingPlace;
            res = await createPlace(newPlace);
        } else {
            res = await updatePlace(editingPlace.id, editingPlace);
        }
        if (res.success) {
            await onUpdate();
            setEditingPlace(null);
            loadDashboardData();
        } else {
            alert("Error: " + res.error);
        }
        setLoading(false);
    };

    const handleDeletePlace = async (id: string) => {
        if (!confirm("Are you sure? This cannot be undone.")) return;
        await deletePlace(id);
        await onUpdate();
        loadDashboardData();
    };

    const handleMagicWand = async () => {
        if (!editingPlace) return;
        setLoading(true);
        const enhanced = await enrichPlaceMetadata(editingPlace.name, editingPlace.description);
        setEditingPlace({ ...editingPlace, description: enhanced.description, tags: enhanced.tags, vibe: enhanced.vibe });
        setLoading(false);
    };

    const handleAutoLocate = async () => {
        if (!locationQuery.trim()) return;
        setLocating(true);
        const coords = await findCoordinates(locationQuery);
        setLocating(false);
        if (coords) {
            setEditingPlace(prev => prev ? { ...prev, coords: { lat: coords.lat, lng: coords.lng } } : null);
            setMapCenterTrigger(prev => prev + 1); 
        } else {
            alert("Couldn't find coordinates. Try a simpler address or paste a Google Maps link.");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const landingPlace = places.find(p => p.isLanding);

    return (
        <div className="fixed inset-0 z-[5000] bg-slate-900 text-white flex overflow-hidden font-sans">
            <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
                <div className="p-6">
                    <h2 className="text-xl font-black tracking-tighter text-teal-400">EL VECI <span className="text-slate-600">OS</span></h2>
                    <p className="text-xs text-slate-500 font-mono mt-1">v2.9.0 • Stable</p>
                </div>
                <nav className="flex-1 px-4 space-y-1">
                    {[{ id: 'dashboard', icon: 'chart-line', label: 'Dashboard' }, { id: 'places', icon: 'map-location-dot', label: 'Places DB' }, { id: 'events', icon: 'calendar-days', label: 'Events' }, { id: 'editorial', icon: 'pen-nib', label: 'Editorial' }, { id: 'marketing', icon: 'bullhorn', label: 'Marketing AI' }, { id: 'team', icon: 'users', label: 'Team' }, { id: 'logs', icon: 'terminal', label: 'System Logs' }].map(item => (
                        <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold transition-all ${activeTab === item.id ? 'bg-teal-900/30 text-teal-400 border border-teal-500/30' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
                            <i className={`fa-solid fa-${item.icon} w-5 text-center`}></i>{item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-800">
                    <button onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold text-slate-400 hover:text-white hover:bg-red-900/20 transition-colors"><i className="fa-solid fa-power-off w-5 text-center"></i>Exit System</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 relative">
                <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
                    <h1 className="text-lg font-bold uppercase tracking-widest text-slate-400">{activeTab}</h1>
                    <div className="flex items-center gap-4"><div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/30 rounded-full border border-green-500/30"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div><span className="text-xs font-bold text-green-400">System Online</span></div></div>
                </header>

                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'dashboard' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Total Places</p>
                                    <p className="text-3xl font-black text-white">{places.length}</p>
                                </div>
                                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Pending Review</p>
                                    <p className="text-3xl font-black text-orange-400">{places.filter(p => p.status === 'pending').length}</p>
                                </div>
                                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Events Active</p>
                                    <p className="text-3xl font-black text-purple-400">{eventsList.length}</p>
                                </div>
                                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Logs (24h)</p>
                                    <p className="text-3xl font-black text-blue-400">{logs.length}</p>
                                </div>
                            </div>
                            <div className="bg-teal-900/20 border border-teal-500/30 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center"><i className="fa-solid fa-map-pin text-xl"></i></div>
                                    <div><h3 className="font-bold text-white text-lg">Current Start Location</h3><p className="text-teal-200/70 text-sm">{landingPlace ? landingPlace.name : 'None Set (Using Default)'}</p></div>
                                </div>
                                {landingPlace && <button onClick={() => setEditingPlace(landingPlace)} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-bold">Edit</button>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'places' && (
                        <div className="space-y-4">
                            <div className="flex justify-between gap-4">
                                <input type="text" placeholder="Search places..." className="flex-1 bg-slate-800 border border-slate-700 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500" value={placeSearchTerm} onChange={e => setPlaceSearchTerm(e.target.value)} />
                                <button onClick={handleExportCSV} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"><i className="fa-solid fa-file-csv"></i> Export CSV</button>
                                <button onClick={() => setEditingPlace({ id: 'new', name: '', category: PlaceCategory.FOOD, description: '', coords: { lat: 18.0, lng: -67.1 }, amenities: {}, status: 'open', is_featured: false, sponsor_weight: 0, plan: 'free', parking: ParkingStatus.FREE, imagePosition: 'center' } as Place)} className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-6 rounded-xl transition-colors shadow-lg shadow-teal-900/20"><i className="fa-solid fa-plus mr-2"></i> New Place</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {places.filter(p => p.name.toLowerCase().includes(placeSearchTerm.toLowerCase())).map(place => (
                                    <div key={place.id} onClick={() => setEditingPlace(place)} className="bg-slate-800 border border-slate-700 rounded-xl p-4 cursor-pointer hover:border-teal-500 transition-all group relative overflow-hidden">
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <div><h3 className="font-bold text-white group-hover:text-teal-400 transition-colors">{place.name}</h3><span className="text-xs text-slate-500 uppercase font-bold tracking-wider">{place.category}</span></div>
                                            <div className={`w-2 h-2 rounded-full ${place.status === 'open' ? 'bg-green-500' : place.status === 'pending' ? 'bg-orange-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        </div>
                                        {place.imageUrl && <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"><img src={place.imageUrl} className="w-full h-full object-cover" style={{ objectPosition: place.imagePosition || 'center' }} /></div>}
                                        {place.isLanding && <span className="absolute top-2 right-2 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-20 shadow-sm"><i className="fa-solid fa-house"></i> START</span>}
                                        <p className="text-xs text-slate-400 line-clamp-2 relative z-10">{place.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                <h3 className="text-xl font-bold text-white mb-4">Administrators</h3>
                                <div className="space-y-4">
                                    {teamMembers.map(member => (
                                        <div key={member.id} className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700">
                                            <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-teal-900/50 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold">{member.name.charAt(0)}</div><div><h4 className="text-white font-bold">{member.name}</h4><p className="text-xs text-slate-500">{member.email}</p></div></div>
                                            <div className="flex items-center gap-4"><div className="text-right"><p className="text-[10px] text-slate-500 uppercase font-bold">Status</p><div className="flex items-center gap-1.5 justify-end"><div className={`w-2 h-2 rounded-full ${member.status === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-teal-500'}`}></div><span className="text-xs text-white">{member.status}</span></div></div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {editingPlace && (
                        <div className="fixed inset-0 z-[6000] bg-slate-950/80 backdrop-blur-sm flex justify-end">
                            <div className="w-full max-w-2xl bg-slate-900 h-full border-l border-slate-800 shadow-2xl flex flex-col animate-slide-up" onPaste={handlePaste}>
                                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
                                    <div><h2 className="text-xl font-black text-white">{editingPlace.id === 'new' ? 'Create New Place' : 'Edit Place'}</h2><p className="text-xs text-slate-500 font-mono">{editingPlace.id}</p></div>
                                    <div className="flex gap-2">
                                        {editingPlace.id !== 'new' && <button onClick={() => handleDeletePlace(editingPlace.id)} className="w-10 h-10 rounded-full bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"><i className="fa-solid fa-trash"></i></button>}
                                        <button onClick={() => setEditingPlace(null)} className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                                    <div className="bg-gradient-to-br from-blue-900/30 to-slate-800 p-5 rounded-2xl border border-blue-500/20 shadow-lg">
                                        <label className="text-xs font-bold text-blue-400 uppercase mb-2 block flex items-center gap-2">
                                            <i className="fa-solid fa-bolt"></i> Smart Import
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={importQuery}
                                                onChange={(e) => setImportQuery(e.target.value)}
                                                placeholder="Paste Google Maps Link or Place Name..."
                                                className="flex-1 bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-blue-500 outline-none text-sm"
                                            />
                                            <button 
                                                onClick={handleSmartImport}
                                                disabled={isImporting || !importQuery}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isImporting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                                                Auto-Fill
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2">
                                            El Veci will search Google to extract the address, category, phone, photo, and hours.
                                        </p>
                                    </div>

                                    <div className="bg-gradient-to-r from-purple-900/20 to-teal-900/20 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                        <div><h4 className="text-sm font-bold text-white"><i className="fa-solid fa-wand-magic-sparkles text-purple-400 mr-2"></i>AI Assistant</h4><p className="text-xs text-slate-400">Auto-enhance descriptions & tags</p></div>
                                        <button onClick={handleMagicWand} disabled={loading} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">{loading ? 'Thinking...' : 'Magic Fix'}</button>
                                    </div>
                                    <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${editingPlace.isLanding ? 'bg-teal-900/30 border-teal-500/50' : 'bg-slate-800 border-slate-700'}`}>
                                        <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${editingPlace.isLanding ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-400'}`}><i className="fa-solid fa-map-pin"></i></div><div><h4 className={`font-bold text-sm ${editingPlace.isLanding ? 'text-teal-400' : 'text-white'}`}>Start Location</h4><p className="text-xs text-slate-400">Users will land here.</p></div></div>
                                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={editingPlace.isLanding || false} onChange={e => setEditingPlace({...editingPlace, isLanding: e.target.checked})} /><div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div></label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup label="Status"><select value={editingPlace.status} onChange={e => setEditingPlace({...editingPlace, status: e.target.value as any})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm"><option value="open">Open</option><option value="closed">Closed</option><option value="pending">Pending</option></select></InputGroup>
                                        <InputGroup label="Plan"><select value={editingPlace.plan} onChange={e => setEditingPlace({...editingPlace, plan: e.target.value as any})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm"><option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option></select></InputGroup>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-700/50">
                                            <span className="text-xs font-bold text-white">Parking?</span>
                                            <select 
                                                value={editingPlace.parking} 
                                                onChange={e => setEditingPlace({...editingPlace, parking: e.target.value as any})}
                                                className="bg-transparent text-teal-400 text-xs font-bold outline-none text-right w-16"
                                            >
                                                <option value="FREE">Free</option>
                                                <option value="PAID">Paid</option>
                                                <option value="NONE">None</option>
                                            </select>
                                        </label>
                                        <label className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-700/50">
                                            <span className="text-xs font-bold text-white">Pet?</span>
                                            <input type="checkbox" checked={editingPlace.isPetFriendly} onChange={e => setEditingPlace({...editingPlace, isPetFriendly: e.target.checked})} className="w-4 h-4 accent-teal-500 rounded" />
                                        </label>
                                        <label className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-700/50">
                                            <span className="text-xs font-bold text-white">Restroom?</span>
                                            <input type="checkbox" checked={editingPlace.hasRestroom} onChange={e => setEditingPlace({...editingPlace, hasRestroom: e.target.checked})} className="w-4 h-4 accent-teal-500 rounded" />
                                        </label>
                                        <label className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-700/50">
                                            <span className="text-xs font-bold text-white">Generator?</span>
                                            <input type="checkbox" checked={editingPlace.hasGenerator} onChange={e => setEditingPlace({...editingPlace, hasGenerator: e.target.checked})} className="w-4 h-4 accent-yellow-500 rounded" />
                                        </label>
                                    </div>

                                    <div className="space-y-4">
                                        <InputGroup label="Name"><StyledInput value={editingPlace.name} onChange={e => setEditingPlace({...editingPlace, name: e.target.value})} /></InputGroup>
                                        <InputGroup label="Category"><select value={editingPlace.category} onChange={e => setEditingPlace({...editingPlace, category: e.target.value as PlaceCategory})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm">{Object.values(PlaceCategory).map(c => <option key={c} value={c}>{c}</option>)}</select></InputGroup>
                                        <InputGroup label="Description"><StyledTextArea value={editingPlace.description} onChange={e => setEditingPlace({...editingPlace, description: e.target.value})} /></InputGroup>
                                        <InputGroup label="Tags (comma separated)"><StyledInput value={(editingPlace.tags || []).join(', ')} onChange={e => setEditingPlace({...editingPlace, tags: e.target.value.split(',').map(s => s.trim())})} /></InputGroup>
                                    </div>

                                    <SectionHeader title="Media & Contact" icon="image" isOpen={openSection === 'media'} onClick={() => setOpenSection(openSection === 'media' ? '' : 'media')} />
                                    {openSection === 'media' && (
                                        <div className="space-y-4 animate-fade-in">
                                            <InputGroup label="Main Photo (Drag & Drop or Paste)">
                                                <div className="space-y-3">
                                                    <div 
                                                        className={`relative w-full h-48 bg-slate-800 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden group transition-colors ${dragActive ? 'border-teal-500 bg-teal-900/20' : 'border-slate-700 hover:border-slate-500'}`}
                                                        onDragEnter={handleDrag}
                                                        onDragLeave={handleDrag}
                                                        onDragOver={handleDrag}
                                                        onDrop={handleDrop}
                                                    >
                                                        {editingPlace.imageUrl ? (
                                                            <>
                                                                <img 
                                                                    src={editingPlace.imageUrl} 
                                                                    className="w-full h-full object-cover transition-all" 
                                                                    style={{ objectPosition: editingPlace.imagePosition || 'center' }} 
                                                                />
                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                    <button onClick={() => window.open(editingPlace.imageUrl, '_blank')} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"><i className="fa-solid fa-expand"></i></button>
                                                                    <button onClick={() => setEditingPlace({...editingPlace, imageUrl: ''})} className="p-2 bg-red-500/20 hover:bg-red-500 rounded-full text-white backdrop-blur-md transition-colors"><i className="fa-solid fa-trash"></i></button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="text-slate-500 flex flex-col items-center pointer-events-none">
                                                                <i className="fa-regular fa-image text-3xl mb-2"></i>
                                                                <span className="text-xs">{dragActive ? 'Drop image here' : 'Drag, Paste, or Upload'}</span>
                                                            </div>
                                                        )}
                                                        {loading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-teal-500 text-3xl"></i></div>}
                                                    </div>

                                                    <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-700">
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 ml-2">Focus Point</span>
                                                        <div className="flex gap-1">
                                                            {['top', 'center', 'bottom'].map((pos) => (
                                                                <button
                                                                    key={pos}
                                                                    onClick={() => setEditingPlace({ ...editingPlace, imagePosition: pos })}
                                                                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${editingPlace.imagePosition === pos || (!editingPlace.imagePosition && pos === 'center') ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                                >
                                                                    {pos === 'top' ? '⬆ Top' : pos === 'bottom' ? '⬇ Bottom' : '⏺ Center'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <input type="text" value={editingPlace.imageUrl} onChange={e => setEditingPlace({...editingPlace, imageUrl: e.target.value})} placeholder="Paste URL..." className="flex-1 bg-slate-800 border border-slate-700 text-white p-2.5 rounded-lg text-sm focus:border-teal-500 outline-none" />
                                                        <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                                                            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>} Upload
                                                        </button>
                                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                                    </div>
                                                </div>
                                            </InputGroup>
                                            <InputGroup label="Phone"><StyledInput value={editingPlace.phone} onChange={e => setEditingPlace({...editingPlace, phone: e.target.value})} /></InputGroup>
                                            <InputGroup label="Website"><StyledInput value={editingPlace.website} onChange={e => setEditingPlace({...editingPlace, website: e.target.value})} /></InputGroup>
                                        </div>
                                    )}
                                    <SectionHeader title="Location" icon="map-pin" isOpen={openSection === 'location'} onClick={() => setOpenSection(openSection === 'location' ? '' : 'location')} />
                                    {openSection === 'location' && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
                                                <label className="text-xs font-bold text-teal-400 uppercase flex items-center gap-2"><i className="fa-solid fa-crosshairs"></i> Smart Locator</label>
                                                <div className="flex gap-2">
                                                    <input type="text" value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder="Name, Address, or Paste Google Maps Link" className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none" />
                                                    <button onClick={handleAutoLocate} disabled={locating} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">{locating ? <i className="fa-solid fa-spinner fa-spin"></i> : "Find"}</button>
                                                </div>
                                            </div>
                                            <LocationPicker coords={editingPlace.coords} onChange={(lat: number, lng: number) => setEditingPlace({...editingPlace, coords: { lat, lng }})} centerTrigger={mapCenterTrigger} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <InputGroup label="Latitude"><StyledInput type="number" step="any" value={editingPlace.coords.lat} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords, lat: parseFloat(e.target.value) || 0 }})} /></InputGroup>
                                                <InputGroup label="Longitude"><StyledInput type="number" step="any" value={editingPlace.coords.lng} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords, lng: parseFloat(e.target.value) || 0 }})} /></InputGroup>
                                            </div>
                                            <InputGroup label="Address"><StyledInput value={editingPlace.address} onChange={e => setEditingPlace({...editingPlace, address: e.target.value})} /></InputGroup>
                                            <InputGroup label="Google Maps URL"><StyledInput value={editingPlace.gmapsUrl} onChange={e => setEditingPlace({...editingPlace, gmapsUrl: e.target.value})} /></InputGroup>
                                        </div>
                                    )}
                                    <SectionHeader title="Operations" icon="clock" isOpen={openSection === 'ops'} onClick={() => setOpenSection(openSection === 'ops' ? '' : 'ops')} />
                                    {openSection === 'ops' && (
                                        <div className="space-y-4 animate-fade-in">
                                             <InputGroup label="Opening Hours Strategy">
                                                 <select value={editingPlace.opening_hours?.type || 'fixed'} onChange={e => setEditingPlace({...editingPlace, opening_hours: { ...editingPlace.opening_hours, type: e.target.value as any }})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm mb-4">
                                                     <option value="fixed">Fixed Schedule</option><option value="24_7">Open 24/7</option><option value="sunrise_sunset">Sunrise to Sunset</option>
                                                 </select>
                                             </InputGroup>
                                             {(editingPlace.opening_hours?.type === 'fixed' || !editingPlace.opening_hours?.type) && (
                                                 <HoursEditor schedule={editingPlace.opening_hours?.structured || []} onChange={s => setEditingPlace({ ...editingPlace, opening_hours: { ...editingPlace.opening_hours, structured: s } })} />
                                             )}
                                             <InputGroup label="Manual Note"><StyledInput value={editingPlace.opening_hours?.note || ''} onChange={e => setEditingPlace({...editingPlace, opening_hours: { ...editingPlace.opening_hours, note: e.target.value }})} placeholder="e.g. Call for hours" /></InputGroup>
                                        </div>
                                    )}
                                </div>
                                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 sticky bottom-0 z-20">
                                    <button onClick={() => setEditingPlace(null)} className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                                    <button onClick={handleSavePlace} disabled={loading} className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-95 disabled:opacity-50">{loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Save Changes"}</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Admin;