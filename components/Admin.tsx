
import React, { useState, useEffect, useRef } from 'react';
import { Place, PlaceCategory, ParkingStatus, Event, EventCategory, AdminLog, DaySchedule } from '../types';
import { supabase, updatePlace, deletePlace, createPlace, uploadImage, getAdminLogs, createEvent, updateEvent, deleteEvent, getEvents } from '../services/supabase';
import { generateMarketingCopy, enhanceDescription, generateExecutiveBriefing, enrichPlaceMetadata, discoverPlaces, generateEditorialContent, findCoordinates } from '../services/geminiService';
import L from 'leaflet';
import { useLanguage } from '../i18n/LanguageContext';

// --- Helper Components ---

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm focus:border-teal-500 focus:outline-none transition-colors" />
);

const StyledTextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm focus:border-teal-500 focus:outline-none transition-colors min-h-[100px]" />
);

const InputGroup = ({ label, children }: { label: string; children?: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-bold text-slate-500 uppercase ml-1">{label}</label>
    {children}
  </div>
);

const SectionHeader = ({ title, icon, isOpen, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${isOpen ? 'bg-slate-800 text-teal-400' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
        <div className="flex items-center gap-3">
            <i className={`fa-solid fa-${icon} w-6 text-center`}></i>
            <span className="font-bold uppercase text-sm tracking-wider">{title}</span>
        </div>
        <i className={`fa-solid fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
    </button>
);

const LocationPicker = ({ coords, onChange, centerTrigger }: { coords: { lat: number, lng: number }, onChange: (lat: number, lng: number) => void, centerTrigger?: number }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const markerInstance = useRef<L.Marker | null>(null);

    // Initialize Map
    useEffect(() => {
        if (!mapRef.current) return;
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current, { attributionControl: false }).setView([coords.lat || 17.9620, coords.lng || -67.1650], 15);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);
            
            // Map click moves marker
            mapInstance.current.on('click', (e) => {
                const { lat, lng } = e.latlng;
                onChange(lat, lng);
            });
        }

        return () => { 
            if (mapInstance.current) {
                 mapInstance.current.remove();
                 mapInstance.current = null;
                 markerInstance.current = null;
            }
        };
    }, []);

    // Handle Coordinate Updates & Dragging
    useEffect(() => {
        if (mapInstance.current) {
            const lat = coords.lat || 17.9620;
            const lng = coords.lng || -67.1650;

            if (!markerInstance.current) {
                 const customIcon = L.divIcon({
                     className: 'bg-transparent',
                     html: `<div style="width: 30px; height: 30px; background: #0f766e; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>`,
                     iconSize: [30, 30],
                     iconAnchor: [15, 30]
                 });

                 markerInstance.current = L.marker([lat, lng], { 
                     icon: customIcon,
                     draggable: true // ENABLE DRAGGING
                 }).addTo(mapInstance.current);

                 // Listen for drag end
                 markerInstance.current.on('dragend', (e) => {
                     const pos = e.target.getLatLng();
                     onChange(pos.lat, pos.lng);
                 });
            } else {
                 markerInstance.current.setLatLng([lat, lng]);
                 // Optional: Pan map if the new coordinate is far away (manual typing)
                 // mapInstance.current.panTo([lat, lng]);
            }
        }
    }, [coords.lat, coords.lng]);

    // Fly to location when triggered externally (Search)
    useEffect(() => {
        if (mapInstance.current && centerTrigger) {
             mapInstance.current.flyTo([coords.lat, coords.lng], 16, { duration: 1.5 });
        }
    }, [centerTrigger]);

    return <div ref={mapRef} className="w-full h-64 rounded-xl overflow-hidden border border-slate-700 relative z-0" />;
};

// --- Hours Editor Helper ---
const HoursEditor = ({ 
    schedule, 
    onChange 
}: { 
    schedule: DaySchedule[], 
    onChange: (s: DaySchedule[]) => void 
}) => {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Initialize schedule if empty
    useEffect(() => {
        if (!schedule || schedule.length !== 7) {
            const initial = Array.from({ length: 7 }, (_, i) => ({
                day: i,
                open: '09:00',
                close: '17:00',
                isClosed: false
            }));
            onChange(initial);
        }
    }, []);

    const updateDay = (idx: number, field: keyof DaySchedule, val: any) => {
        const next = [...schedule];
        next[idx] = { ...next[idx], [field]: val };
        onChange(next);
    };

    const copyToWeek = (idx: number) => {
        const template = schedule[idx];
        const next = schedule.map(d => ({ ...d, open: template.open, close: template.close, isClosed: template.isClosed }));
        onChange(next);
    };

    if (!schedule || schedule.length === 0) return <div>Initializing...</div>;

    return (
        <div className="space-y-2 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-slate-500 mb-1">
                <div className="col-span-2">Day</div>
                <div className="col-span-3">Open</div>
                <div className="col-span-3">Close</div>
                <div className="col-span-2 text-center">Closed?</div>
                <div className="col-span-2">Action</div>
            </div>
            {schedule.map((day, i) => (
                <div key={i} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${day.isClosed ? 'bg-slate-700/30 opacity-60' : 'bg-slate-700/50'}`}>
                    <div className="col-span-2 font-bold text-white text-xs">{DAYS[i]}</div>
                    <div className="col-span-3">
                        <input type="time" disabled={day.isClosed} value={day.open} onChange={(e) => updateDay(i, 'open', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-white" />
                    </div>
                    <div className="col-span-3">
                         <input type="time" disabled={day.isClosed} value={day.close} onChange={(e) => updateDay(i, 'close', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-white" />
                    </div>
                    <div className="col-span-2 flex justify-center">
                        <input type="checkbox" checked={day.isClosed} onChange={(e) => updateDay(i, 'isClosed', e.target.checked)} className="w-4 h-4 accent-red-500 rounded" />
                    </div>
                    <div className="col-span-2">
                         <button onClick={() => copyToWeek(i)} className="text-[10px] bg-slate-600 hover:bg-teal-600 text-white px-2 py-1 rounded w-full" title="Copy this time to all days">Copy All</button>
                    </div>
                </div>
            ))}
        </div>
    );
};

interface AdminProps {
  onClose: () => void;
  places: Place[];
  events?: Event[];
  onUpdate: () => Promise<any>;
}

const Admin: React.FC<AdminProps> = ({ onClose, places, events: initialEvents, onUpdate }) => {
    const { t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'dashboard' | 'places' | 'events' | 'editorial' | 'marketing' | 'logs'>('dashboard');
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [eventsList, setEventsList] = useState<Event[]>(initialEvents || []);
    
    // Briefing State
    const [briefingData, setBriefingData] = useState<any>(null); // Stores JSON { en: html, es: html }
    const [briefingLang, setBriefingLang] = useState<'en' | 'es'>('en');

    // Editor State (Places)
    const [editingPlace, setEditingPlace] = useState<Place | null>(null);
    const [openSection, setOpenSection] = useState<string>('basic');
    const [placeSearchTerm, setPlaceSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Editorial State
    const [editorialResult, setEditorialResult] = useState('');
    const [editorialLoading, setEditorialLoading] = useState(false);

    // Location Tools State
    const [locationQuery, setLocationQuery] = useState('');
    const [locating, setLocating] = useState(false);
    const [mapCenterTrigger, setMapCenterTrigger] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

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
        
        // Try to load existing briefing from logs
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

    const handleGenerateBriefing = async () => {
        setLoading(true);
        // Call Serverless Function if available, else local
        try {
            const res = await fetch('/api/cron-briefing');
            if (res.ok) {
                loadDashboardData(); // Reload logs to get the new briefing
            } else {
                // Fallback to client-side generation
                const raw = await generateExecutiveBriefing(logs, places);
                setBriefingData(JSON.parse(raw));
            }
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const handleExportCSV = () => {
        const headers = ["id", "name", "category", "description", "lat", "lon", "status", "is_featured", "tags", "amenities", "opening_hours", "contact_info", "sponsor_weight"];
        
        const rows = places.map(p => [
            p.id,
            `"${p.name.replace(/"/g, '""')}"`,
            p.category,
            `"${p.description.replace(/"/g, '""')}"`,
            p.coords.lat,
            p.coords.lng,
            p.status,
            p.is_featured,
            `"${(p.tags || []).join(', ')}"`,
            `"${JSON.stringify(p.amenities || {}).replace(/"/g, '""')}"`,
            `"${JSON.stringify(p.opening_hours || {}).replace(/"/g, '""')}"`,
            `"${JSON.stringify(p.contact_info || {}).replace(/"/g, '""')}"`,
            p.sponsor_weight
        ]);
    
        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');
    
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
                        <div className="w-16 h-16 bg-teal-900/50 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border border-teal-500/30">
                            <i className="fa-solid fa-lock"></i>
                        </div>
                        <h2 className="text-2xl font-black text-white">Admin Access</h2>
                        <p className="text-slate-400 text-sm mt-1">Authorized personnel only.</p>
                    </div>
                    <div className="space-y-4">
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none" />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none" />
                        <button onClick={handleLogin} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold p-3 rounded-xl transition-colors disabled:opacity-50">
                            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Unlock System"}
                        </button>
                        <button onClick={onClose} className="w-full text-slate-500 text-sm font-bold p-2 hover:text-white">Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Place Editor Logic ---
    const handleSavePlace = async () => {
        if (!editingPlace) return;
        setLoading(true);
        
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
            loadDashboardData(); // Refresh stats
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
        setEditingPlace({
            ...editingPlace,
            description: enhanced.description,
            tags: enhanced.tags,
            vibe: enhanced.vibe
        });
        setLoading(false);
    };

    const handleAutoLocate = async () => {
        if (!locationQuery.trim()) return;
        setLocating(true);
        const coords = await findCoordinates(locationQuery);
        setLocating(false);
        
        if (coords) {
            setEditingPlace(prev => prev ? { ...prev, coords: { lat: coords.lat, lng: coords.lng } } : null);
            setMapCenterTrigger(prev => prev + 1); // Trigger map flyTo
        } else {
            alert("Couldn't find coordinates. Try a simpler address or paste a Google Maps link.");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingPlace) return;

        setLoading(true);
        const res = await uploadImage(file);
        if (res.success && res.url) {
            setEditingPlace({ ...editingPlace, imageUrl: res.url });
        } else {
            alert("Upload failed: " + (res.error || "Unknown error"));
        }
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="fixed inset-0 z-[5000] bg-slate-900 text-white flex overflow-hidden font-sans">
            
            {/* Sidebar */}
            <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
                <div className="p-6">
                    <h2 className="text-xl font-black tracking-tighter text-teal-400">EL VECI <span className="text-slate-600">OS</span></h2>
                    <p className="text-xs text-slate-500 font-mono mt-1">v2.5.0 • Stable</p>
                </div>
                
                <nav className="flex-1 px-4 space-y-1">
                    {[
                        { id: 'dashboard', icon: 'chart-line', label: 'Dashboard' },
                        { id: 'places', icon: 'map-location-dot', label: 'Places DB' },
                        { id: 'events', icon: 'calendar-days', label: 'Events' },
                        { id: 'editorial', icon: 'pen-nib', label: 'Editorial' },
                        { id: 'marketing', icon: 'bullhorn', label: 'Marketing AI' },
                        { id: 'logs', icon: 'terminal', label: 'System Logs' },
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold transition-all ${activeTab === item.id ? 'bg-teal-900/30 text-teal-400 border border-teal-500/30' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                        >
                            <i className={`fa-solid fa-${item.icon} w-5 text-center`}></i>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-lg text-sm font-bold text-slate-400 hover:text-white hover:bg-red-900/20 transition-colors">
                        <i className="fa-solid fa-power-off w-5 text-center"></i>
                        Exit System
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 relative">
                
                {/* Header */}
                <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
                    <h1 className="text-lg font-bold uppercase tracking-widest text-slate-400">{activeTab}</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/30 rounded-full border border-green-500/30">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-green-400">System Online</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6">
                    
                    {/* DASHBOARD VIEW */}
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

                            <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-black text-white"><i className="fa-solid fa-robot mr-2 text-teal-400"></i>El Veci Briefing</h3>
                                        <p className="text-sm text-slate-400">AI-generated daily intelligence report.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setBriefingLang('en')} className={`px-3 py-1 rounded-lg text-xs font-bold ${briefingLang === 'en' ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400'}`}>EN</button>
                                        <button onClick={() => setBriefingLang('es')} className={`px-3 py-1 rounded-lg text-xs font-bold ${briefingLang === 'es' ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400'}`}>ES</button>
                                        <button onClick={handleGenerateBriefing} disabled={loading} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white transition-colors">
                                            {loading ? <i className="fa-solid fa-spin fa-circle-notch"></i> : <i className="fa-solid fa-rotate"></i>}
                                        </button>
                                    </div>
                                </div>
                                <div className="p-8 bg-slate-900/50 min-h-[300px]">
                                    {briefingData ? (
                                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: briefingData[briefingLang] || briefingData['en'] || "Error loading briefing." }} />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
                                            <i className="fa-solid fa-file-lines text-5xl mb-4"></i>
                                            <p className="font-bold">No briefing generated yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EDITORIAL VIEW (NEW) */}
                    {activeTab === 'editorial' && (
                         <div className="max-w-4xl mx-auto space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => runEditorial('weekly_events')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl text-left transition-colors group">
                                    <div className="w-12 h-12 bg-purple-900/30 text-purple-400 rounded-xl flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                                        <i className="fa-solid fa-calendar-week"></i>
                                    </div>
                                    <h3 className="font-bold text-lg text-white">Qué hay esta semana</h3>
                                    <p className="text-xs text-slate-400 mt-1">Genera agenda de eventos.</p>
                                </button>
                                
                                <button onClick={() => runEditorial('notifications')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl text-left transition-colors group">
                                    <div className="w-12 h-12 bg-blue-900/30 text-blue-400 rounded-xl flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                                        <i className="fa-solid fa-bell"></i>
                                    </div>
                                    <h3 className="font-bold text-lg text-white">Notificaciones</h3>
                                    <p className="text-xs text-slate-400 mt-1">3 opciones de Push Notifications.</p>
                                </button>

                                <button onClick={() => runEditorial('weekly_summary')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl text-left transition-colors group">
                                    <div className="w-12 h-12 bg-teal-900/30 text-teal-400 rounded-xl flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                                        <i className="fa-solid fa-newspaper"></i>
                                    </div>
                                    <h3 className="font-bold text-lg text-white">Resumen Semanal</h3>
                                    <p className="text-xs text-slate-400 mt-1">Newsletter style blog post.</p>
                                </button>

                                <button onClick={() => runEditorial('daily_content')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-6 rounded-2xl text-left transition-colors group">
                                    <div className="w-12 h-12 bg-pink-900/30 text-pink-400 rounded-xl flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                                        <i className="fa-solid fa-hashtag"></i>
                                    </div>
                                    <h3 className="font-bold text-lg text-white">Contenido Diario</h3>
                                    <p className="text-xs text-slate-400 mt-1">Caption para redes sociales.</p>
                                </button>
                            </div>

                            {editorialLoading && (
                                <div className="text-center py-10">
                                    <i className="fa-solid fa-circle-notch fa-spin text-3xl text-teal-500"></i>
                                    <p className="mt-2 text-slate-400 font-bold">El Veci está escribiendo...</p>
                                </div>
                            )}

                            {editorialResult && (
                                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden animate-fade-in">
                                    <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
                                        <h3 className="font-bold text-slate-300">Resultado Generado</h3>
                                        <button onClick={() => navigator.clipboard.writeText(editorialResult)} className="text-xs bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg font-bold transition-colors">
                                            <i className="fa-solid fa-copy mr-1"></i> Copiar
                                        </button>
                                    </div>
                                    <pre className="p-6 whitespace-pre-wrap font-mono text-sm text-slate-300 bg-black/20 max-h-[400px] overflow-y-auto">
                                        {editorialResult}
                                    </pre>
                                </div>
                            )}
                         </div>
                    )}

                    {/* PLACES EDITOR VIEW */}
                    {activeTab === 'places' && (
                        <div className="space-y-4">
                            <div className="flex justify-between gap-4">
                                <input 
                                    type="text" 
                                    placeholder="Search places..." 
                                    className="flex-1 bg-slate-800 border border-slate-700 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500"
                                    value={placeSearchTerm}
                                    onChange={e => setPlaceSearchTerm(e.target.value)}
                                />
                                <button onClick={handleExportCSV} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                                     <i className="fa-solid fa-file-csv"></i> Export CSV
                                </button>
                                <button 
                                    onClick={() => setEditingPlace({ id: 'new', name: '', category: PlaceCategory.FOOD, description: '', coords: { lat: 18.0, lng: -67.1 }, amenities: {}, status: 'open', is_featured: false, sponsor_weight: 0, plan: 'free', parking: ParkingStatus.FREE } as Place)}
                                    className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-6 rounded-xl transition-colors shadow-lg shadow-teal-900/20"
                                >
                                    <i className="fa-solid fa-plus mr-2"></i> New Place
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {places
                                    .filter(p => p.name.toLowerCase().includes(placeSearchTerm.toLowerCase()))
                                    .map(place => (
                                    <div key={place.id} onClick={() => setEditingPlace(place)} className="bg-slate-800 border border-slate-700 rounded-xl p-4 cursor-pointer hover:border-teal-500 transition-all group relative overflow-hidden">
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <div>
                                                <h3 className="font-bold text-white group-hover:text-teal-400 transition-colors">{place.name}</h3>
                                                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">{place.category}</span>
                                            </div>
                                            <div className={`w-2 h-2 rounded-full ${place.status === 'open' ? 'bg-green-500' : place.status === 'pending' ? 'bg-orange-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        </div>
                                        {place.imageUrl && (
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity">
                                                <img src={place.imageUrl} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <p className="text-xs text-slate-400 line-clamp-2 relative z-10">{place.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* EDIT MODAL (Overlay) */}
                    {editingPlace && (
                        <div className="fixed inset-0 z-[6000] bg-slate-950/80 backdrop-blur-sm flex justify-end">
                            <div className="w-full max-w-2xl bg-slate-900 h-full border-l border-slate-800 shadow-2xl flex flex-col animate-slide-up">
                                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
                                    <div>
                                        <h2 className="text-xl font-black text-white">{editingPlace.id === 'new' ? 'Create New Place' : 'Edit Place'}</h2>
                                        <p className="text-xs text-slate-500 font-mono">{editingPlace.id}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {editingPlace.id !== 'new' && (
                                            <button onClick={() => handleDeletePlace(editingPlace.id)} className="w-10 h-10 rounded-full bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center">
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        )}
                                        <button onClick={() => setEditingPlace(null)} className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center justify-center">
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                                    
                                    {/* AI Toolbar */}
                                    <div className="bg-gradient-to-r from-purple-900/20 to-teal-900/20 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-white"><i className="fa-solid fa-wand-magic-sparkles text-purple-400 mr-2"></i>AI Assistant</h4>
                                            <p className="text-xs text-slate-400">Auto-enhance descriptions & tags</p>
                                        </div>
                                        <button onClick={handleMagicWand} disabled={loading} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                                            {loading ? 'Thinking...' : 'Magic Fix'}
                                        </button>
                                    </div>

                                    {/* Status & Plan */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup label="Status">
                                            <select 
                                                value={editingPlace.status} 
                                                onChange={e => setEditingPlace({...editingPlace, status: e.target.value as any})}
                                                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm"
                                            >
                                                <option value="open">Open (Public)</option>
                                                <option value="closed">Closed (Hidden)</option>
                                                <option value="pending">Pending Review</option>
                                            </select>
                                        </InputGroup>
                                        <InputGroup label="Plan">
                                            <select 
                                                value={editingPlace.plan} 
                                                onChange={e => setEditingPlace({...editingPlace, plan: e.target.value as any})}
                                                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm"
                                            >
                                                <option value="free">Free</option>
                                                <option value="basic">Basic</option>
                                                <option value="pro">Pro</option>
                                            </select>
                                        </InputGroup>
                                    </div>

                                    <div className="space-y-4">
                                        <InputGroup label="Name">
                                            <StyledInput value={editingPlace.name} onChange={e => setEditingPlace({...editingPlace, name: e.target.value})} />
                                        </InputGroup>
                                        
                                        <InputGroup label="Category">
                                            <select value={editingPlace.category} onChange={e => setEditingPlace({...editingPlace, category: e.target.value as PlaceCategory})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm">
                                                {Object.values(PlaceCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </InputGroup>

                                        <InputGroup label="Description">
                                            <StyledTextArea value={editingPlace.description} onChange={e => setEditingPlace({...editingPlace, description: e.target.value})} />
                                        </InputGroup>
                                        
                                        <InputGroup label="Tags (comma separated)">
                                            <StyledInput value={(editingPlace.tags || []).join(', ')} onChange={e => setEditingPlace({...editingPlace, tags: e.target.value.split(',').map(s => s.trim())})} />
                                        </InputGroup>
                                    </div>

                                    <SectionHeader title="Location" icon="map-pin" isOpen={openSection === 'location'} onClick={() => setOpenSection(openSection === 'location' ? '' : 'location')} />
                                    {openSection === 'location' && (
                                        <div className="space-y-4 animate-fade-in">
                                            
                                            {/* SMART LOCATOR TOOL */}
                                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
                                                <label className="text-xs font-bold text-teal-400 uppercase flex items-center gap-2">
                                                    <i className="fa-solid fa-crosshairs"></i> Smart Locator
                                                </label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={locationQuery}
                                                        onChange={(e) => setLocationQuery(e.target.value)}
                                                        placeholder="Name, Address, or Paste Google Maps Link"
                                                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                                                    />
                                                    <button 
                                                        onClick={handleAutoLocate}
                                                        disabled={locating}
                                                        className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                                                    >
                                                        {locating ? <i className="fa-solid fa-spinner fa-spin"></i> : "Find"}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-500">
                                                    Tip: Paste a Google Maps link (e.g., https://goo.gl/maps/...) to extract exact coordinates instantly.
                                                </p>
                                            </div>

                                            <LocationPicker 
                                                coords={editingPlace.coords} 
                                                onChange={(lat, lng) => setEditingPlace({...editingPlace, coords: { lat, lng }})} 
                                                centerTrigger={mapCenterTrigger}
                                            />
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <InputGroup label="Latitude">
                                                  <StyledInput 
                                                    type="number" 
                                                    step="any" 
                                                    value={editingPlace.coords.lat} 
                                                    onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords, lat: parseFloat(e.target.value) || 0 }})} 
                                                  />
                                                </InputGroup>
                                                <InputGroup label="Longitude">
                                                  <StyledInput 
                                                    type="number" 
                                                    step="any" 
                                                    value={editingPlace.coords.lng} 
                                                    onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords, lng: parseFloat(e.target.value) || 0 }})} 
                                                  />
                                                </InputGroup>
                                            </div>
                                            <InputGroup label="Address"><StyledInput value={editingPlace.address} onChange={e => setEditingPlace({...editingPlace, address: e.target.value})} /></InputGroup>
                                            <InputGroup label="Google Maps URL"><StyledInput value={editingPlace.gmapsUrl} onChange={e => setEditingPlace({...editingPlace, gmapsUrl: e.target.value})} /></InputGroup>
                                        </div>
                                    )}

                                    <SectionHeader title="Media & Contact" icon="image" isOpen={openSection === 'media'} onClick={() => setOpenSection(openSection === 'media' ? '' : 'media')} />
                                    {openSection === 'media' && (
                                        <div className="space-y-4 animate-fade-in">
                                            <InputGroup label="Main Photo">
                                                <div className="space-y-3">
                                                    {/* Preview Area */}
                                                    <div className="relative w-full h-48 bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden group">
                                                        {editingPlace.imageUrl ? (
                                                            <>
                                                                <img src={editingPlace.imageUrl} className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                    <button 
                                                                        onClick={() => window.open(editingPlace.imageUrl, '_blank')}
                                                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                                                                        title="View Full"
                                                                    >
                                                                        <i className="fa-solid fa-expand"></i>
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setEditingPlace({...editingPlace, imageUrl: ''})}
                                                                        className="p-2 bg-red-500/20 hover:bg-red-500 rounded-full text-white backdrop-blur-md transition-colors"
                                                                        title="Remove Image"
                                                                    >
                                                                        <i className="fa-solid fa-trash"></i>
                                                                    </button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="text-slate-500 flex flex-col items-center">
                                                                <i className="fa-regular fa-image text-3xl mb-2"></i>
                                                                <span className="text-xs">No image set</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={editingPlace.imageUrl} 
                                                            onChange={e => setEditingPlace({...editingPlace, imageUrl: e.target.value})} 
                                                            placeholder="Paste URL or upload..."
                                                            className="flex-1 bg-slate-800 border border-slate-700 text-white p-2.5 rounded-lg text-sm focus:border-teal-500 outline-none"
                                                        />
                                                        <button 
                                                            onClick={() => fileInputRef.current?.click()}
                                                            disabled={loading}
                                                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                                                        >
                                                            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                                                            Upload
                                                        </button>
                                                        <input 
                                                            type="file" 
                                                            ref={fileInputRef} 
                                                            className="hidden" 
                                                            accept="image/jpeg,image/png,image/webp" 
                                                            onChange={handleImageUpload} 
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-slate-500">Supported: JPG, PNG, WEBP. Max 5MB.</p>
                                                </div>
                                            </InputGroup>

                                            <InputGroup label="Phone"><StyledInput value={editingPlace.phone} onChange={e => setEditingPlace({...editingPlace, phone: e.target.value})} /></InputGroup>
                                            <InputGroup label="Website"><StyledInput value={editingPlace.website} onChange={e => setEditingPlace({...editingPlace, website: e.target.value})} /></InputGroup>
                                        </div>
                                    )}

                                    <SectionHeader title="Operations" icon="clock" isOpen={openSection === 'ops'} onClick={() => setOpenSection(openSection === 'ops' ? '' : 'ops')} />
                                    {openSection === 'ops' && (
                                        <div className="space-y-4 animate-fade-in">
                                             <InputGroup label="Opening Hours Strategy">
                                                 <select 
                                                    value={editingPlace.opening_hours?.type || 'fixed'} 
                                                    onChange={e => setEditingPlace({
                                                        ...editingPlace, 
                                                        opening_hours: { 
                                                            ...editingPlace.opening_hours, 
                                                            type: e.target.value as any 
                                                        }
                                                    })}
                                                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm mb-4"
                                                 >
                                                     <option value="fixed">Fixed Schedule</option>
                                                     <option value="24_7">Open 24/7</option>
                                                     <option value="sunrise_sunset">Sunrise to Sunset (Nature)</option>
                                                 </select>
                                             </InputGroup>
                                             
                                             {(editingPlace.opening_hours?.type === 'fixed' || !editingPlace.opening_hours?.type) && (
                                                 <HoursEditor 
                                                    schedule={editingPlace.opening_hours?.structured || []} 
                                                    onChange={s => setEditingPlace({ ...editingPlace, opening_hours: { ...editingPlace.opening_hours, structured: s } })} 
                                                 />
                                             )}

                                             <InputGroup label="Manual Note (Override)">
                                                 <StyledInput value={editingPlace.opening_hours?.note || ''} onChange={e => setEditingPlace({...editingPlace, opening_hours: { ...editingPlace.opening_hours, note: e.target.value }})} placeholder="e.g. Call for hours" />
                                             </InputGroup>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 sticky bottom-0 z-20">
                                    <button onClick={() => setEditingPlace(null)} className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                                    <button onClick={handleSavePlace} disabled={loading} className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-95 disabled:opacity-50">
                                        {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Save Changes"}
                                    </button>
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
