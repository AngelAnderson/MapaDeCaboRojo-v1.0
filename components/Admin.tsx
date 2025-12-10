
import React, { useState, useEffect, useRef } from 'react';
import { Place, PlaceCategory, ParkingStatus, Event, EventCategory, AdminLog, DaySchedule } from '../types';
import { supabase, updatePlace, deletePlace, createPlace, uploadImage, getAdminLogs, createEvent, updateEvent, deleteEvent, getEvents } from '../services/supabase';
import { generateMarketingCopy, enhanceDescription, generateExecutiveBriefing, enrichPlaceMetadata } from '../services/geminiService';
import L from 'leaflet';

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

const LocationPicker = ({ coords, onChange }: { coords: { lat: number, lng: number }, onChange: (lat: number, lng: number) => void }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const markerInstance = useRef<L.Marker | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current, { attributionControl: false }).setView([coords.lat || 17.9620, coords.lng || -67.1650], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);
            
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

    useEffect(() => {
        if (mapInstance.current) {
            if (!markerInstance.current) {
                 markerInstance.current = L.marker([coords.lat, coords.lng]).addTo(mapInstance.current);
            } else {
                 markerInstance.current.setLatLng([coords.lat, coords.lng]);
            }
            mapInstance.current.setView([coords.lat, coords.lng], mapInstance.current.getZoom());
        }
    }, [coords.lat, coords.lng]);

    return <div ref={mapRef} className="w-full h-48 rounded-xl overflow-hidden border border-slate-700 relative z-0" />;
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
    const [user, setUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'dashboard' | 'places' | 'events' | 'marketing' | 'stats' | 'logs'>('dashboard');
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

    // Editor State (Events)
    const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);

    // Marketing State
    const [marketingPlaceId, setMarketingPlaceId] = useState<string>('');
    const [marketingPlatform, setMarketingPlatform] = useState<'instagram' | 'email' | 'radio' | 'campaign_bundle'>('instagram');
    const [marketingTone, setMarketingTone] = useState<string>('chill');
    const [marketingLang, setMarketingLang] = useState<string>('spanglish');
    const [marketingResult, setMarketingResult] = useState('');

    // Init Data
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
        
        const savedLang = localStorage.getItem('app_language');
        if (savedLang === 'es') setBriefingLang('es');
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') loadLogs();
        if (activeTab === 'events') loadEvents();
        if (activeTab === 'dashboard') {
            loadLogs().then((fetchedLogs) => {
                if (!initialEvents) loadEvents();
                if (!briefingData && fetchedLogs) {
                    generateBriefing(fetchedLogs);
                }
            });
        }
    }, [activeTab]);

    const loadLogs = async () => {
        const data = await getAdminLogs();
        setLogs(data);
        return data;
    };

    const loadEvents = async () => {
        const data = await getEvents();
        setEventsList(data);
    };

    const generateBriefing = async (currentLogs: AdminLog[]) => {
        const reportJson = await generateExecutiveBriefing(currentLogs, places);
        try {
            const parsed = JSON.parse(reportJson);
            setBriefingData(parsed);
        } catch (e) {
            setBriefingData({ en: reportJson, es: reportJson });
        }
    };

    const handleLogin = async () => {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else setUser(data.user);
        setLoading(false);
    };

    // --- BULK ACTIONS ---
    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkVerify = async () => {
        if (!confirm(`Verify ${selectedIds.size} places?`)) return;
        setLoading(true);
        for (const id of selectedIds) {
            await updatePlace(id, { isVerified: true, verified_at: new Date().toISOString() });
        }
        await onUpdate();
        setSelectedIds(new Set());
        setLoading(false);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`DELETE ${selectedIds.size} places? This is permanent.`)) return;
        setLoading(true);
        for (const id of selectedIds) {
            await deletePlace(id);
        }
        await onUpdate();
        setSelectedIds(new Set());
        setLoading(false);
    };

    // --- PLACE CRUD ---
    const handleSavePlace = async () => {
        if (!editingPlace) return;
        if (!editingPlace.name.trim()) return alert("Place name required");
        setLoading(true);
        
        const finalPlace = {
            ...editingPlace,
            coords: {
                lat: Number(editingPlace.coords.lat),
                lng: Number(editingPlace.coords.lng)
            }
        };

        let res;
        if (places.find(p => p.id === finalPlace.id)) {
            res = await updatePlace(finalPlace.id, finalPlace);
        } else {
            res = await createPlace(finalPlace);
        }

        if (res.success) {
            await onUpdate();
            setEditingPlace(null);
        } else {
            alert("Error: " + res.error);
        }
        setLoading(false);
    };
    
    const handleDeletePlace = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        setLoading(true);
        const res = await deletePlace(id);
        if (res.success) await onUpdate();
        else alert(res.error);
        setLoading(false);
    };

    const handleImageDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (!editingPlace) return;
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            setLoading(true);
            const up = await uploadImage(file);
            if (up.success && up.url) {
                setEditingPlace({...editingPlace, imageUrl: up.url});
            } else {
                alert("Upload failed");
            }
            setLoading(false);
        }
    };

    // --- EVENT CRUD ---
    const handleSaveEvent = async () => {
        if (!editingEvent) return;
        if (!editingEvent.title) return alert("Title required");
        setLoading(true);
        
        let res;
        if (editingEvent.id && editingEvent.id !== 'new') {
            res = await updateEvent(editingEvent.id, editingEvent);
        } else {
            res = await createEvent(editingEvent);
        }

        if (res.success) {
            await onUpdate(); 
            await loadEvents(); 
            setEditingEvent(null);
        } else {
            alert("Error: " + res.error);
        }
        setLoading(false);
    };

    const handleDeleteEvent = async (id: string) => {
        if (!confirm("Delete this event?")) return;
        setLoading(true);
        await deleteEvent(id);
        await loadEvents();
        await onUpdate();
        setLoading(false);
    };

    // AI Helpers
    const runAiEnhance = async () => {
        if (!editingPlace) return;
        setLoading(true);
        const improved = await enhanceDescription(editingPlace.description, editingPlace.name);
        setEditingPlace({ ...editingPlace, description: improved });
        setLoading(false);
    };
    
    const handleBatchAutoFix = async () => {
        if (!confirm("Magic Wand will find 5 places with missing tags or short descriptions and auto-fix them. Continue?")) return;
        setLoading(true);

        const candidates = places
            .filter(p => !p.tags || p.tags.length === 0 || p.description.length < 50 || !p.vibe || p.vibe.length === 0)
            .slice(0, 5);

        if (candidates.length === 0) {
            alert("No places need fixing! Good job.");
            setLoading(false);
            return;
        }

        let fixCount = 0;
        for (const p of candidates) {
            const enriched = await enrichPlaceMetadata(p.name, p.description);
            await updatePlace(p.id, {
                ...p,
                description: enriched.description.length > p.description.length ? enriched.description : p.description,
                tags: enriched.tags && enriched.tags.length > 0 ? enriched.tags : p.tags,
                vibe: enriched.vibe && enriched.vibe.length > 0 ? enriched.vibe : p.vibe
            });
            fixCount++;
        }

        await onUpdate();
        alert(`✨ Magic Wand fixed ${fixCount} places!`);
        setLoading(false);
    };

    const handleMarketingTabGenerate = async () => {
        if (!marketingPlaceId) return alert("Please select a place first.");
        const p = places.find(x => x.id === marketingPlaceId);
        if (!p) return;
        setLoading(true);
        const result = await generateMarketingCopy(p.name, p.category, marketingPlatform, marketingTone, marketingLang);
        setMarketingResult(result);
        setLoading(false);
    };

    // --- RENDERERS ---

    const renderSidebar = () => (
        <aside className="w-16 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-4 md:p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white shrink-0">
                    <i className="fa-solid fa-lock"></i>
                </div>
                <span className="font-bold text-white tracking-wide hidden md:block">ADMIN</span>
            </div>
            <nav className="flex-1 p-2 space-y-1">
                {[
                    { id: 'dashboard', icon: 'gauge-high', label: 'Dashboard' },
                    { id: 'places', icon: 'map-location-dot', label: 'Places' },
                    { id: 'events', icon: 'calendar-days', label: 'Events' },
                    { id: 'marketing', icon: 'bullhorn', label: 'Marketing' },
                    { id: 'stats', icon: 'chart-pie', label: 'Stats' },
                    { id: 'logs', icon: 'scroll', label: 'Logs' },
                ].map((item) => (
                    <button 
                        key={item.id} 
                        onClick={() => { setActiveTab(item.id as any); setEditingPlace(null); setEditingEvent(null); }}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                        <i className={`fa-solid fa-${item.icon} w-5 text-center`}></i>
                        <span className="font-medium hidden md:block">{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-800">
                <button onClick={onClose} className="w-full flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
                    <i className="fa-solid fa-arrow-right-from-bracket w-5 text-center"></i>
                    <span className="font-medium hidden md:block">Exit</span>
                </button>
            </div>
        </aside>
    );

    const renderDashboard = () => (
        <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 {[
                     { label: 'Total Places', val: places.length, icon: 'map-pin', color: 'bg-blue-500' },
                     { label: 'Events', val: eventsList.length, icon: 'calendar', color: 'bg-purple-500' },
                     { label: 'Pending', val: places.filter(p => p.status === 'pending').length, icon: 'clock', color: 'bg-amber-500' },
                     { label: 'Users Today', val: '142', icon: 'users', color: 'bg-teal-500' }
                 ].map((stat, i) => (
                     <div key={i} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex items-center gap-4">
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${stat.color}`}>
                             <i className={`fa-solid fa-${stat.icon} text-xl`}></i>
                         </div>
                         <div>
                             <p className="text-slate-400 text-xs font-bold uppercase">{stat.label}</p>
                             <p className="text-2xl font-black text-white">{stat.val}</p>
                         </div>
                     </div>
                 ))}
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Morning Briefing */}
                 <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
                     <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                         <h3 className="text-white font-bold flex items-center gap-2"><i className="fa-solid fa-robot text-teal-400"></i> AI Morning Briefing</h3>
                         <div className="flex gap-1">
                             <button onClick={() => setBriefingLang('en')} className={`px-2 py-1 text-xs rounded ${briefingLang === 'en' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}>EN</button>
                             <button onClick={() => setBriefingLang('es')} className={`px-2 py-1 text-xs rounded ${briefingLang === 'es' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}>ES</button>
                         </div>
                     </div>
                     <div className="p-6 flex-1 text-slate-300 text-sm leading-relaxed">
                         {briefingData ? (
                             <div dangerouslySetInnerHTML={{ __html: briefingData[briefingLang] }}></div>
                         ) : (
                             <div className="flex items-center justify-center h-40 text-slate-500 flex-col gap-2">
                                 <i className="fa-solid fa-sparkles animate-pulse text-2xl"></i>
                                 <span>Generating AI Report...</span>
                             </div>
                         )}
                     </div>
                 </div>

                 {/* Recent Activity */}
                 <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
                     <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                         <h3 className="text-white font-bold"><i className="fa-solid fa-list-ul mr-2 text-slate-400"></i> Recent Activity</h3>
                     </div>
                     <div className="flex-1 overflow-y-auto max-h-[300px]">
                         {logs.slice(0,10).map(log => (
                             <div key={log.id} className="p-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                 <div className="flex justify-between items-start mb-1">
                                     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${log.action.includes('DELETE') ? 'bg-red-900/50 text-red-400' : log.action.includes('CREATE') ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'}`}>{log.action}</span>
                                     <span className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                                 </div>
                                 <p className="text-white text-sm font-medium truncate">{log.place_name}</p>
                                 <p className="text-xs text-slate-400 truncate">{log.details}</p>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
        </div>
    );

    const renderLogs = () => (
        <div className="h-full flex flex-col animate-fade-in">
             <h2 className="text-2xl font-bold text-white mb-4">System Logs</h2>
             <div className="bg-slate-800 rounded-xl border border-slate-700 flex-1 overflow-hidden flex flex-col">
                 <div className="overflow-y-auto flex-1">
                     <table className="w-full text-left border-collapse">
                         <thead className="bg-slate-900 text-slate-400 text-xs uppercase sticky top-0">
                             <tr>
                                 <th className="p-4 font-bold">Time</th>
                                 <th className="p-4 font-bold">Action</th>
                                 <th className="p-4 font-bold">Target</th>
                                 <th className="p-4 font-bold">Details</th>
                             </tr>
                         </thead>
                         <tbody className="text-sm text-slate-300 divide-y divide-slate-700">
                             {logs.map(log => (
                                 <tr key={log.id} className="hover:bg-slate-700/30">
                                     <td className="p-4 whitespace-nowrap text-slate-500 font-mono text-xs">{new Date(log.created_at).toLocaleString()}</td>
                                     <td className="p-4"><span className="bg-slate-700 text-white px-2 py-1 rounded text-xs font-bold">{log.action}</span></td>
                                     <td className="p-4 font-bold text-white">{log.place_name}</td>
                                     <td className="p-4 text-slate-400">{log.details}</td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             </div>
        </div>
    );
    
    const renderStats = () => (
        <div className="text-white p-4">
            <h2 className="text-2xl font-bold mb-4">Stats Analytics</h2>
            <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center text-slate-400">
                <i className="fa-solid fa-chart-line text-4xl mb-4"></i>
                <p>Detailed analytics charts coming soon.</p>
            </div>
        </div>
    );

    const renderMarketing = () => (
        <div className="h-full flex flex-col animate-fade-in max-w-4xl mx-auto">
             <h2 className="text-2xl font-bold text-white mb-6">AI Marketing Generator</h2>
             
             <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <InputGroup label="Target Place">
                         <select className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-3" value={marketingPlaceId} onChange={e => setMarketingPlaceId(e.target.value)}>
                             <option value="">-- Select Place --</option>
                             {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                         </select>
                     </InputGroup>
                     <InputGroup label="Platform / Format">
                         <select className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-3" value={marketingPlatform} onChange={e => setMarketingPlatform(e.target.value as any)}>
                             <option value="instagram">Instagram Post</option>
                             <option value="email">Email Blast</option>
                             <option value="radio">Radio Script (30s)</option>
                             <option value="campaign_bundle">Full Campaign Bundle (JSON)</option>
                         </select>
                     </InputGroup>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <InputGroup label="Tone">
                         <select className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-3" value={marketingTone} onChange={e => setMarketingTone(e.target.value)}>
                             <option value="chill">Chill / Relaxed</option>
                             <option value="hype">Hype / High Energy 🔥</option>
                             <option value="professional">Professional / Formal</option>
                             <option value="funny">Funny / Local Humor</option>
                         </select>
                     </InputGroup>
                     <InputGroup label="Language">
                         <select className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-3" value={marketingLang} onChange={e => setMarketingLang(e.target.value)}>
                             <option value="spanglish">Spanglish (PR Style)</option>
                             <option value="es">Spanish (Standard)</option>
                             <option value="en">English</option>
                         </select>
                     </InputGroup>
                 </div>

                 <button onClick={handleMarketingTabGenerate} disabled={loading || !marketingPlaceId} className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                     {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                     Generate Magic Copy
                 </button>

                 {marketingResult && (
                     <div className="bg-slate-900 rounded-xl p-4 border border-slate-600 relative mt-4">
                         <div className="absolute top-2 right-2">
                             <button onClick={() => navigator.clipboard.writeText(marketingResult)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Copy</button>
                         </div>
                         <pre className="text-slate-300 whitespace-pre-wrap font-mono text-sm">{marketingResult}</pre>
                     </div>
                 )}
             </div>
        </div>
    );

    const renderEvents = () => {
        const filteredEvents = eventsList.filter(e => e.title.toLowerCase().includes(placeSearchTerm.toLowerCase())); // Reuse search term or add distinct one
        return (
             <div className="h-full flex flex-col animate-fade-in relative">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-2xl font-bold text-white">Events</h2>
                     <button onClick={() => setEditingEvent({ id: 'new', title: '', description: '', category: EventCategory.COMMUNITY, startTime: new Date().toISOString(), locationName: '', status: 'published', isFeatured: false, isRecurring: false })} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-900/20 hover:scale-105 transition-transform"><i className="fa-solid fa-plus mr-2"></i> New Event</button>
                </div>
                 <div className="flex-1 overflow-y-auto space-y-2 pr-2 pb-20">
                    {filteredEvents.map(e => (
                        <div key={e.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group hover:border-teal-500/50">
                             <div>
                                <h3 className="font-bold text-white">{e.title}</h3>
                                <p className="text-xs text-slate-500">{new Date(e.startTime).toLocaleDateString()} • {e.locationName}</p>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setEditingEvent(e)} className="w-10 h-10 bg-slate-700 rounded-lg text-white hover:bg-teal-600 transition-colors flex items-center justify-center"><i className="fa-solid fa-pen"></i></button>
                                <button onClick={() => handleDeleteEvent(e.id)} className="w-10 h-10 bg-slate-700 rounded-lg text-slate-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"><i className="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    ))}
                 </div>
             </div>
        );
    };

    const renderEventEditor = () => (
        <div className="h-full flex flex-col animate-slide-up">
             <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setEditingEvent(null)} className="bg-slate-700 w-10 h-10 rounded-full text-white hover:bg-slate-600 transition-colors"><i className="fa-solid fa-arrow-left"></i></button>
                    <h2 className="text-xl font-bold text-white truncate">{editingEvent?.title || 'New Event'}</h2>
                </div>
                <button onClick={handleSaveEvent} disabled={loading} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-teal-900/20">
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
             <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  <div className="p-4 space-y-4 bg-slate-900/50 rounded-xl border border-slate-800">
                      <InputGroup label="Title"><StyledInput value={editingEvent!.title} onChange={e => setEditingEvent({...editingEvent!, title: e.target.value})} /></InputGroup>
                      <InputGroup label="Description"><StyledTextArea value={editingEvent!.description} onChange={e => setEditingEvent({...editingEvent!, description: e.target.value})} /></InputGroup>
                      <div className="grid grid-cols-2 gap-4">
                          <InputGroup label="Start Time"><StyledInput type="datetime-local" value={editingEvent!.startTime?.slice(0,16)} onChange={e => setEditingEvent({...editingEvent!, startTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                          <InputGroup label="End Time"><StyledInput type="datetime-local" value={editingEvent!.endTime?.slice(0,16)} onChange={e => setEditingEvent({...editingEvent!, endTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                      </div>
                      <InputGroup label="Location"><StyledInput value={editingEvent!.locationName} onChange={e => setEditingEvent({...editingEvent!, locationName: e.target.value})} /></InputGroup>
                      <InputGroup label="Map Link"><StyledInput value={editingEvent!.mapLink} onChange={e => setEditingEvent({...editingEvent!, mapLink: e.target.value})} /></InputGroup>
                      <InputGroup label="Image URL"><StyledInput value={editingEvent!.imageUrl} onChange={e => setEditingEvent({...editingEvent!, imageUrl: e.target.value})} /></InputGroup>
                  </div>
             </div>
        </div>
    );

    const renderPlaceList = () => {
        const filtered = places.filter(p => p.name.toLowerCase().includes(placeSearchTerm.toLowerCase()));
        return (
            <div className="h-full flex flex-col animate-fade-in relative">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-2xl font-bold text-white">Places Database</h2>
                     <div className="flex gap-2">
                        <button onClick={handleBatchAutoFix} disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-purple-900/20 hover:scale-105 transition-transform"><i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Auto-Fix Data</button>
                        <button onClick={() => setEditingPlace({ id: 'new', name: '', description: '', category: PlaceCategory.FOOD, coords: { lat: 17.9620, lng: -67.1650 }, parking: ParkingStatus.FREE, tags: [], vibe: [], imageUrl: '', videoUrl: '', website: '', phone: '', status: 'open', plan: 'free', sponsor_weight: 0, is_featured: false, hasRestroom: false, hasShowers: false, tips: '', priceLevel: '$', bestTimeToVisit: '', isPetFriendly: false, isHandicapAccessible: false, isVerified: true, slug: '', address: '', gmapsUrl: '', opening_hours: { note: '', structured: [] }, isMobile: false })} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-900/20 hover:scale-105 transition-transform"><i className="fa-solid fa-plus mr-2"></i> New Place</button>
                     </div>
                </div>
                <div className="bg-slate-800 p-2 rounded-xl mb-4 border border-slate-700">
                    <input type="text" placeholder="Search places..." value={placeSearchTerm} onChange={e => setPlaceSearchTerm(e.target.value)} className="w-full bg-transparent text-white p-2 outline-none" />
                </div>
                
                {selectedIds.size > 0 && (
                    <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center animate-slide-up">
                        <div className="bg-white text-slate-900 rounded-full shadow-2xl px-6 py-3 flex items-center gap-4 border border-slate-200">
                            <span className="font-bold">{selectedIds.size} selected</span>
                            <div className="h-4 w-px bg-slate-300"></div>
                            <button onClick={handleBulkVerify} className="font-bold text-teal-600 hover:underline">Verify</button>
                            <button onClick={handleBulkDelete} className="font-bold text-red-600 hover:underline">Delete</button>
                            <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 pb-20">
                    {filtered.map(p => (
                        <div key={p.id} className={`bg-slate-800 p-4 rounded-xl border flex justify-between items-center group transition-colors ${selectedIds.has(p.id) ? 'border-teal-500 bg-teal-900/10' : 'border-slate-700 hover:border-teal-500/50'}`}>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.has(p.id)} 
                                    onChange={() => toggleSelect(p.id)}
                                    className="w-5 h-5 accent-teal-600 rounded cursor-pointer" 
                                />
                                <img src={p.imageUrl} className="w-12 h-12 rounded-lg object-cover bg-slate-700" alt="" />
                                <div>
                                    <h3 className="font-bold text-white">{p.name}</h3>
                                    <p className="text-xs text-slate-500 uppercase font-bold flex gap-2">
                                        <span>{p.category}</span>
                                        <span className={p.status === 'open' ? 'text-green-500' : 'text-amber-500'}>• {p.status}</span>
                                        {p.is_featured && <span className="text-yellow-400">• Featured</span>}
                                        {p.isVerified && <span className="text-blue-400">• Verified</span>}
                                        {p.isMobile && <span className="text-purple-400">• Mobile</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingPlace(p)} className="w-10 h-10 bg-slate-700 rounded-lg text-white hover:bg-teal-600 transition-colors flex items-center justify-center"><i className="fa-solid fa-pen"></i></button>
                                <button onClick={() => handleDeletePlace(p.id)} className="w-10 h-10 bg-slate-700 rounded-lg text-slate-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"><i className="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderPlaceEditor = () => (
        <div className="h-full flex flex-col animate-slide-up">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setEditingPlace(null)} className="bg-slate-700 w-10 h-10 rounded-full text-white hover:bg-slate-600 transition-colors"><i className="fa-solid fa-arrow-left"></i></button>
                    <h2 className="text-xl font-bold text-white truncate max-w-[200px] md:max-w-md">{editingPlace!.name || 'New Place'}</h2>
                </div>
                <button onClick={handleSavePlace} disabled={loading} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-teal-900/20">
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {/* Basic Info */}
                <SectionHeader title="Basic Info" icon="circle-info" isOpen={openSection === 'basic'} onClick={() => setOpenSection(openSection === 'basic' ? '' : 'basic')} />
                {openSection === 'basic' && (
                    <div className="p-4 space-y-4 bg-slate-900/50 rounded-b-xl border border-slate-800 border-t-0 -mt-2">
                        <InputGroup label="Name"><StyledInput value={editingPlace!.name} onChange={e => setEditingPlace({...editingPlace!, name: e.target.value})} /></InputGroup>
                        <InputGroup label="Category">
                            <select value={editingPlace!.category} onChange={e => setEditingPlace({...editingPlace!, category: e.target.value as PlaceCategory})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500">
                                {Object.values(PlaceCategory).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </InputGroup>
                        <InputGroup label="Description">
                            <div className="relative">
                                <StyledTextArea value={editingPlace!.description} onChange={e => setEditingPlace({...editingPlace!, description: e.target.value})} />
                                <button onClick={runAiEnhance} className="absolute bottom-2 right-2 text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-500 shadow-sm" title="Enhance with AI"><i className="fa-solid fa-wand-magic-sparkles mr-1"></i> AI Improve</button>
                            </div>
                        </InputGroup>
                        <div className="flex gap-4">
                            <div className="flex-1"><InputGroup label="Price"><StyledInput value={editingPlace!.priceLevel} onChange={e => setEditingPlace({...editingPlace!, priceLevel: e.target.value})} /></InputGroup></div>
                            <div className="flex-1">
                                <InputGroup label="Status">
                                    <select 
                                        value={editingPlace!.status} 
                                        onChange={e => {
                                            const newStatus = e.target.value as any;
                                            setEditingPlace({
                                                ...editingPlace!, 
                                                status: newStatus,
                                                isVerified: newStatus !== 'pending' ? true : false
                                            });
                                        }} 
                                        className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm outline-none"
                                    >
                                        <option value="open">Open</option>
                                        <option value="closed">Closed</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                </InputGroup>
                            </div>
                        </div>
                    </div>
                )}

                {/* Location */}
                <SectionHeader title="Location" icon="map-location-dot" isOpen={openSection === 'location'} onClick={() => setOpenSection(openSection === 'location' ? '' : 'location')} />
                {openSection === 'location' && (
                    <div className="p-4 space-y-4 bg-slate-900/50 rounded-b-xl border border-slate-800 border-t-0 -mt-2">
                        
                        <label className="flex items-center gap-2 text-white text-sm bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4 cursor-pointer hover:bg-slate-700/50">
                            <input 
                                type="checkbox" 
                                checked={editingPlace!.isMobile || false} 
                                onChange={e => setEditingPlace({...editingPlace!, isMobile: e.target.checked})} 
                                className="w-5 h-5 accent-purple-500 rounded bg-slate-700" 
                            /> 
                            <span className="font-bold text-purple-400"><i className="fa-solid fa-truck-fast mr-2"></i> Mobile / Delivery Service (No fixed location)</span>
                        </label>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">
                                {editingPlace!.isMobile ? 'Base Location (Approximate)' : 'Pin Location'}
                            </label>
                            <LocationPicker coords={editingPlace!.coords} onChange={(lat, lng) => setEditingPlace({...editingPlace!, coords: {lat, lng}})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Latitude">
                                <StyledInput type="number" step="any" value={editingPlace!.coords?.lat ?? ''} onChange={(e) => setEditingPlace({...editingPlace!, coords: { ...editingPlace!.coords!, lat: parseFloat(e.target.value) || 0 }})} />
                            </InputGroup>
                            <InputGroup label="Longitude">
                                <StyledInput type="number" step="any" value={editingPlace!.coords?.lng ?? ''} onChange={(e) => setEditingPlace({...editingPlace!, coords: { ...editingPlace!.coords!, lng: parseFloat(e.target.value) || 0 }})} />
                            </InputGroup>
                        </div>
                        <InputGroup label="Google Maps URL"><StyledInput value={editingPlace!.gmapsUrl} onChange={(e) => setEditingPlace({...editingPlace!, gmapsUrl: e.target.value})} /></InputGroup>
                        <InputGroup label={editingPlace!.isMobile ? "Service Area (e.g. 'Todo Cabo Rojo')" : "Address"}>
                            <StyledTextArea value={editingPlace!.address} onChange={(e) => setEditingPlace({...editingPlace!, address: e.target.value})} style={{minHeight: '80px'}} />
                        </InputGroup>
                    </div>
                )}

                {/* Media */}
                <SectionHeader title="Media & Icon" icon="image" isOpen={openSection === 'media'} onClick={() => setOpenSection(openSection === 'media' ? '' : 'media')} />
                {openSection === 'media' && (
                    <div className="p-4 space-y-4 bg-slate-900/50 rounded-b-xl border border-slate-800 border-t-0 -mt-2">
                        <InputGroup label="Image URL">
                            <div 
                                onDragOver={e => e.preventDefault()}
                                onDrop={handleImageDrop}
                                className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <StyledInput value={editingPlace!.imageUrl} onChange={e => setEditingPlace({...editingPlace!, imageUrl: e.target.value})} placeholder="Paste URL or Drag & Drop Image here" className="mb-2" />
                                <span className="text-xs text-slate-500">Drag image here to upload</span>
                            </div>
                        </InputGroup>
                        {editingPlace!.imageUrl && <img src={editingPlace!.imageUrl} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-slate-700" />}
                        <InputGroup label="Video URL"><StyledInput value={editingPlace!.videoUrl} onChange={e => setEditingPlace({...editingPlace!, videoUrl: e.target.value})} /></InputGroup>
                        <InputGroup label="Custom Icon (FontAwesome)">
                            <div className="flex gap-2">
                                <StyledInput value={editingPlace!.customIcon || ''} onChange={e => setEditingPlace({...editingPlace!, customIcon: e.target.value})} placeholder="e.g. fa-pizza-slice" />
                                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center shrink-0 border border-slate-600"><i className={`fa-solid ${editingPlace!.customIcon || 'fa-location-dot'} text-white`}></i></div>
                            </div>
                            <a href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noreferrer" className="text-xs text-teal-500 hover:underline mt-1 block">Find Icons</a>
                        </InputGroup>
                    </div>
                )}

                {/* Details & Amenities */}
                <SectionHeader title="Details & Amenities" icon="list-check" isOpen={openSection === 'details'} onClick={() => setOpenSection(openSection === 'details' ? '' : 'details')} />
                {openSection === 'details' && (
                    <div className="p-4 space-y-4 bg-slate-900/50 rounded-b-xl border border-slate-800 border-t-0 -mt-2">
                        <div className="grid grid-cols-2 gap-4">
                             <InputGroup label="Phone"><StyledInput value={editingPlace!.phone} onChange={e => setEditingPlace({...editingPlace!, phone: e.target.value})} /></InputGroup>
                             <InputGroup label="Website"><StyledInput value={editingPlace!.website} onChange={e => setEditingPlace({...editingPlace!, website: e.target.value})} /></InputGroup>
                        </div>
                        
                        <InputGroup label="Schedule Note (e.g. Holidays)">
                            <StyledInput value={editingPlace!.opening_hours?.note || ''} onChange={e => setEditingPlace({...editingPlace!, opening_hours: { ...editingPlace!.opening_hours, note: e.target.value }})} placeholder="e.g. Closed on Christmas" />
                        </InputGroup>

                        <InputGroup label="Weekly Hours">
                            <HoursEditor 
                                schedule={editingPlace!.opening_hours?.structured || []} 
                                onChange={(newSchedule) => setEditingPlace({...editingPlace!, opening_hours: { ...editingPlace!.opening_hours, structured: newSchedule }})}
                            />
                        </InputGroup>

                        <InputGroup label="Priority Score (Sorting Weight)">
                            <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
                                <i className="fa-solid fa-arrow-up-wide-short text-slate-500"></i>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    step="5"
                                    value={editingPlace!.sponsor_weight || 0} 
                                    onChange={e => setEditingPlace({...editingPlace!, sponsor_weight: parseInt(e.target.value)})} 
                                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                />
                                <div className="w-12 text-center font-mono font-bold text-teal-400 border-l border-slate-600 pl-2">
                                    {editingPlace!.sponsor_weight || 0}
                                </div>
                            </div>
                        </InputGroup>

                        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 grid grid-cols-2 gap-4">
                             <label className="flex items-center gap-2 text-white text-sm"><input type="checkbox" checked={editingPlace!.parking === ParkingStatus.FREE} onChange={e => setEditingPlace({...editingPlace!, parking: e.target.checked ? ParkingStatus.FREE : ParkingStatus.PAID})} className="w-4 h-4 accent-teal-500 rounded" /> Free Parking</label>
                             <label className="flex items-center gap-2 text-white text-sm"><input type="checkbox" checked={editingPlace!.hasRestroom} onChange={e => setEditingPlace({...editingPlace!, hasRestroom: e.target.checked})} className="w-4 h-4 accent-teal-500 rounded" /> Restrooms</label>
                             <label className="flex items-center gap-2 text-white text-sm"><input type="checkbox" checked={editingPlace!.hasShowers} onChange={e => setEditingPlace({...editingPlace!, hasShowers: e.target.checked})} className="w-4 h-4 accent-teal-500 rounded" /> Showers</label>
                             <label className="flex items-center gap-2 text-white text-sm"><input type="checkbox" checked={editingPlace!.isPetFriendly} onChange={e => setEditingPlace({...editingPlace!, isPetFriendly: e.target.checked})} className="w-4 h-4 accent-teal-500 rounded" /> Pet Friendly</label>
                             <label className="flex items-center gap-2 text-white text-sm"><input type="checkbox" checked={editingPlace!.isHandicapAccessible} onChange={e => setEditingPlace({...editingPlace!, isHandicapAccessible: e.target.checked})} className="w-4 h-4 accent-teal-500 rounded" /> Handicap Access</label>
                             <label className="flex items-center gap-2 text-white text-sm font-bold text-yellow-400"><input type="checkbox" checked={editingPlace!.is_featured} onChange={e => setEditingPlace({...editingPlace!, is_featured: e.target.checked})} className="w-4 h-4 accent-yellow-400 rounded bg-slate-700" /> Featured (⭐)</label>
                             <label className="flex items-center gap-2 text-white text-sm font-bold text-blue-400"><input type="checkbox" checked={editingPlace!.isVerified} onChange={e => setEditingPlace({...editingPlace!, isVerified: e.target.checked})} className="w-4 h-4 accent-blue-400 rounded bg-slate-700" /> Verified</label>
                        </div>
                        <InputGroup label="Local Tips (El Veci says...)"><StyledTextArea value={editingPlace!.tips} onChange={e => setEditingPlace({...editingPlace!, tips: e.target.value})} /></InputGroup>
                        <InputGroup label="Vibe Tags (Comma sep)"><StyledInput value={editingPlace!.vibe?.join(', ')} onChange={e => setEditingPlace({...editingPlace!, vibe: e.target.value.split(',').map(s => s.trim())})} placeholder="e.g. Chill, Party, Romantic" /></InputGroup>
                    </div>
                )}
            </div>
        </div>
    );

    if (!user) {
        return (
            <div className="fixed inset-0 bg-slate-900 z-[3500] flex items-center justify-center p-4">
                <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl">
                    <h2 className="text-2xl font-black text-white mb-6">Admin Login</h2>
                    <div className="space-y-4">
                        <StyledInput placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                        <StyledInput type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                        <button onClick={handleLogin} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition-colors">
                            {loading ? 'Checking...' : 'Enter System'}
                        </button>
                        <button onClick={onClose} className="w-full text-slate-500 text-sm mt-2 hover:text-white">Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900 z-[3500] flex flex-col md:flex-row overflow-hidden animate-fade-in font-sans">
            {renderSidebar()}
            
            <main className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">
                <div className="md:hidden p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
                    <span className="font-bold text-white">ADMIN PANEL</span>
                    <button onClick={onClose}><i className="fa-solid fa-xmark text-white text-xl"></i></button>
                </div>

                <div className="flex-1 overflow-hidden p-4 md:p-8 relative">
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'places' && (editingPlace ? renderPlaceEditor() : renderPlaceList())}
                    {activeTab === 'events' && (editingEvent ? renderEventEditor() : renderEvents())}
                    {activeTab === 'logs' && renderLogs()}
                    {activeTab === 'stats' && renderStats()}
                    {activeTab === 'marketing' && renderMarketing()}
                </div>
            </main>
        </div>
    );
};

export default Admin;
