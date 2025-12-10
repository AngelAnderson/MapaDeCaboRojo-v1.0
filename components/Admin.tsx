
import React, { useState, useEffect, useRef } from 'react';
import { Place, PlaceCategory, ParkingStatus, Event, EventCategory, AdminLog } from '../types';
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
    const [briefing, setBriefing] = useState<string>(''); // For AI Analyst
    
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
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') loadLogs();
        if (activeTab === 'events') loadEvents();
        if (activeTab === 'dashboard') {
            loadLogs().then((fetchedLogs) => {
                if (!initialEvents) loadEvents();
                if (!briefing && fetchedLogs) {
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
        const report = await generateExecutiveBriefing(currentLogs, places);
        setBriefing(report);
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

    // --- ANALYTICS HELPERS ---
    
    const calculateDBHealth = () => {
        if (places.length === 0) return 0;
        let score = 0;
        let totalPoints = places.length * 5; // 5 criteria per place
        
        places.forEach(p => {
            if (p.imageUrl && p.imageUrl.length > 10) score++;
            if (p.description && p.description.length > 30) score++;
            if (p.isVerified) score++;
            if (p.tags && p.tags.length > 0) score++;
            if (p.phone || p.website) score++;
        });
        
        return Math.round((score / totalPoints) * 100);
    };

    const getSearchGaps = () => {
        const searches = logs
            .filter(l => l.action === 'USER_SEARCH')
            .map(l => l.details?.toLowerCase() || '');
        
        // Count occurrences
        const counts: Record<string, number> = {};
        searches.forEach(s => { if(s) counts[s] = (counts[s] || 0) + 1; });
        
        // Filter terms that have NO results in current DB
        const gaps = Object.entries(counts)
            .filter(([term, count]) => {
                const hasMatch = places.some(p => p.name.toLowerCase().includes(term) || p.tags?.some(t => t.toLowerCase().includes(term)));
                return !hasMatch && term.length > 3;
            })
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5); // Top 5
            
        return gaps;
    };

    const getAuditStats = () => {
        return {
            noImage: places.filter(p => !p.imageUrl || p.imageUrl.length < 10).length,
            unverified: places.filter(p => !p.isVerified).length,
            shortDesc: places.filter(p => !p.description || p.description.length < 30).length
        };
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

    const renderDashboard = () => {
        const health = calculateDBHealth();
        const gaps = getSearchGaps();
        const audits = getAuditStats();
        
        const goToFix = (filter: string) => {
            setActiveTab('places');
            // Logic to set filter would go here, for now just navigates
        };

        return (
            <div className="space-y-6 animate-fade-in pb-10">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight">Command Center</h2>
                        <p className="text-slate-400">Welcome back, Veci. Here is what's happening.</p>
                    </div>
                    <div className="text-right hidden md:block">
                        <div className="text-sm font-bold text-teal-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                        <div className="text-xs text-slate-500">{places.length} Places • {eventsList.length} Events</div>
                    </div>
                </div>
                
                {/* 1. HEALTH SCORE CARD */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-700 relative overflow-hidden">
                        <div className="flex justify-between items-start z-10 relative">
                            <div>
                                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Database Health</h3>
                                <div className="text-4xl font-black text-white">{health}%</div>
                            </div>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 font-bold text-sm ${health > 80 ? 'border-green-500 text-green-500' : 'border-amber-500 text-amber-500'}`}>
                                {health > 80 ? 'A+' : 'B'}
                            </div>
                        </div>
                        <div className="mt-4 space-y-2 relative z-10">
                            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div className={`h-full ${health > 80 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${health}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-500">
                                {health < 90 ? "Improve descriptions and add photos to boost score." : "Database is looking healthy!"}
                            </p>
                        </div>
                        {/* Background Decoration */}
                        <i className="fa-solid fa-heart-pulse absolute -right-4 -bottom-4 text-9xl text-white/5"></i>
                    </div>

                    {/* 2. DEMAND GAPS (What users want but you don't have) */}
                    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 flex flex-col relative overflow-hidden">
                        <h3 className="text-red-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                             <i className="fa-solid fa-triangle-exclamation"></i> Missing Content (Demand)
                        </h3>
                        {gaps.length > 0 ? (
                            <div className="flex-1 space-y-3 z-10">
                                {gaps.map(([term, count], i) => (
                                    <div key={i} className="flex justify-between items-center group cursor-pointer hover:bg-slate-700/50 p-2 -mx-2 rounded-lg transition-colors" onClick={() => { setEditingPlace({ id: 'new', name: term.charAt(0).toUpperCase() + term.slice(1), description: '', category: PlaceCategory.FOOD, coords: { lat: 17.9620, lng: -67.1650 }, parking: ParkingStatus.FREE, tags: [], vibe: [], imageUrl: '', videoUrl: '', website: '', phone: '', status: 'open', plan: 'free', sponsor_weight: 0, is_featured: false, hasRestroom: false, hasShowers: false, tips: '', priceLevel: '$', bestTimeToVisit: '', isPetFriendly: false, isHandicapAccessible: false, isVerified: true, slug: '', address: '', gmapsUrl: '' }); setActiveTab('places'); }}>
                                        <span className="text-white font-bold capitalize">{term}</span>
                                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">{count} searches</span>
                                        <i className="fa-solid fa-plus text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                                No gaps detected yet. Good job!
                            </div>
                        )}
                        <i className="fa-solid fa-magnifying-glass absolute -right-4 -bottom-4 text-9xl text-white/5"></i>
                    </div>

                    {/* 3. ACTION ITEMS (To-Do List) */}
                    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 flex flex-col relative overflow-hidden">
                         <h3 className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-3">Action Required</h3>
                         <div className="space-y-3 z-10">
                            {audits.unverified > 0 && (
                                <button onClick={() => goToFix('unverified')} className="w-full bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex justify-between items-center hover:bg-amber-500/20 transition-colors">
                                    <span className="text-amber-500 font-bold text-sm"><i className="fa-solid fa-clock mr-2"></i> Pending Reviews</span>
                                    <span className="bg-amber-500 text-slate-900 font-bold px-2 py-0.5 rounded text-xs">{audits.unverified}</span>
                                </button>
                            )}
                            {audits.noImage > 0 && (
                                <button onClick={() => goToFix('no-image')} className="w-full bg-slate-700/30 border border-slate-600 p-3 rounded-xl flex justify-between items-center hover:bg-slate-700/50 transition-colors">
                                    <span className="text-slate-300 font-bold text-sm"><i className="fa-solid fa-image mr-2"></i> Missing Photos</span>
                                    <span className="bg-slate-600 text-white font-bold px-2 py-0.5 rounded text-xs">{audits.noImage}</span>
                                </button>
                            )}
                            {audits.shortDesc > 0 && (
                                <button onClick={() => goToFix('short-desc')} className="w-full bg-slate-700/30 border border-slate-600 p-3 rounded-xl flex justify-between items-center hover:bg-slate-700/50 transition-colors">
                                    <span className="text-slate-300 font-bold text-sm"><i className="fa-solid fa-align-left mr-2"></i> Short Descriptions</span>
                                    <span className="bg-slate-600 text-white font-bold px-2 py-0.5 rounded text-xs">{audits.shortDesc}</span>
                                </button>
                            )}
                            {audits.unverified === 0 && audits.noImage === 0 && audits.shortDesc === 0 && (
                                <div className="text-green-500 font-bold flex items-center gap-2">
                                    <i className="fa-solid fa-check-circle"></i> All clean!
                                </div>
                            )}
                         </div>
                    </div>
                </div>

                {/* AI Briefing Section */}
                <div className="bg-gradient-to-r from-teal-900/20 to-slate-800 p-8 rounded-3xl border border-teal-500/20 relative">
                     <h3 className="text-teal-400 font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-robot"></i> Morning Briefing
                    </h3>
                    {briefing ? (
                        <div className="prose prose-invert prose-sm max-w-none text-slate-300 columns-1 md:columns-2 gap-8" dangerouslySetInnerHTML={{ __html: briefing }}></div>
                    ) : (
                        <div className="flex items-center gap-3 text-slate-400 py-4">
                            <i className="fa-solid fa-circle-notch fa-spin"></i> El Veci is analyzing logs...
                        </div>
                    )}
                </div>

                {/* Recent Logs Ticker */}
                <div>
                     <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3 ml-1">Live Activity Feed</h3>
                     <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700/50 max-h-60 overflow-y-auto">
                        {logs.slice(0, 5).map(log => (
                            <div key={log.id} className="p-4 flex items-center gap-4 text-sm">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase w-20 text-center ${
                                    log.action === 'USER_SEARCH' ? 'bg-blue-500/20 text-blue-400' :
                                    log.action === 'UPDATE_SUGGESTION' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-slate-600/20 text-slate-400'
                                }`}>{log.action.replace('USER_', '')}</span>
                                <span className="text-slate-300 flex-1 truncate">{log.details}</span>
                                <span className="text-slate-500 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        ))}
                     </div>
                </div>
            </div>
        );
    };

    const renderPlaceList = () => {
        const filtered = places.filter(p => p.name.toLowerCase().includes(placeSearchTerm.toLowerCase()));
        return (
            <div className="h-full flex flex-col animate-fade-in relative">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-2xl font-bold text-white">Places Database</h2>
                     <div className="flex gap-2">
                        <button onClick={handleBatchAutoFix} disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-purple-900/20 hover:scale-105 transition-transform"><i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Auto-Fix Data</button>
                        <button onClick={() => setEditingPlace({ id: 'new', name: '', description: '', category: PlaceCategory.FOOD, coords: { lat: 17.9620, lng: -67.1650 }, parking: ParkingStatus.FREE, tags: [], vibe: [], imageUrl: '', videoUrl: '', website: '', phone: '', status: 'open', plan: 'free', sponsor_weight: 0, is_featured: false, hasRestroom: false, hasShowers: false, tips: '', priceLevel: '$', bestTimeToVisit: '', isPetFriendly: false, isHandicapAccessible: false, isVerified: true, slug: '', address: '', gmapsUrl: '' })} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-900/20 hover:scale-105 transition-transform"><i className="fa-solid fa-plus mr-2"></i> New Place</button>
                     </div>
                </div>
                <div className="bg-slate-800 p-2 rounded-xl mb-4 border border-slate-700">
                    <input type="text" placeholder="Search places..." value={placeSearchTerm} onChange={e => setPlaceSearchTerm(e.target.value)} className="w-full bg-transparent text-white p-2 outline-none" />
                </div>
                
                {/* Bulk Action Bar */}
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
                                                // Automatically verify if moving out of pending
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
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Pin Location</label>
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
                        <InputGroup label="Address"><StyledTextArea value={editingPlace!.address} onChange={(e) => setEditingPlace({...editingPlace!, address: e.target.value})} style={{minHeight: '80px'}} /></InputGroup>
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
                            <p className="text-[10px] text-slate-500 mt-1 ml-1">Higher values (e.g. 100) appear at the top of the list.</p>
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

    const renderEvents = () => {
        if (editingEvent) {
            return (
                <div className="h-full flex flex-col animate-slide-up">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setEditingEvent(null)} className="bg-slate-700 w-10 h-10 rounded-full text-white hover:bg-slate-600 transition-colors"><i className="fa-solid fa-arrow-left"></i></button>
                            <h2 className="text-xl font-bold text-white">{editingEvent.title || 'New Event'}</h2>
                        </div>
                        <button onClick={handleSaveEvent} disabled={loading} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-teal-900/20">
                            {loading ? 'Saving...' : 'Save Event'}
                        </button>
                    </div>
                    <div className="space-y-4 overflow-y-auto p-1">
                        <InputGroup label="Title"><StyledInput value={editingEvent.title || ''} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} /></InputGroup>
                        <InputGroup label="Description"><StyledTextArea value={editingEvent.description || ''} onChange={e => setEditingEvent({...editingEvent, description: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Category">
                                <select value={editingEvent.category} onChange={e => setEditingEvent({...editingEvent, category: e.target.value as EventCategory})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm outline-none">
                                    {Object.values(EventCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </InputGroup>
                            <InputGroup label="Status">
                                <select value={editingEvent.status} onChange={e => setEditingEvent({...editingEvent, status: e.target.value})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm outline-none">
                                    <option value="published">Published</option><option value="draft">Draft</option><option value="cancelled">Cancelled</option>
                                </select>
                            </InputGroup>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <InputGroup label="Start Time"><StyledInput type="datetime-local" value={editingEvent.startTime?.slice(0, 16)} onChange={e => setEditingEvent({...editingEvent, startTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                             <InputGroup label="End Time"><StyledInput type="datetime-local" value={editingEvent.endTime?.slice(0, 16) || ''} onChange={e => setEditingEvent({...editingEvent, endTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                        </div>
                        <InputGroup label="Location Name"><StyledInput value={editingEvent.locationName || ''} onChange={e => setEditingEvent({...editingEvent, locationName: e.target.value})} /></InputGroup>
                        <InputGroup label="Map Link / Place ID"><StyledInput value={editingEvent.mapLink || ''} onChange={e => setEditingEvent({...editingEvent, mapLink: e.target.value})} placeholder="Optional URL or ID" /></InputGroup>
                        <InputGroup label="Image URL"><StyledInput value={editingEvent.imageUrl || ''} onChange={e => setEditingEvent({...editingEvent, imageUrl: e.target.value})} /></InputGroup>
                        {editingEvent.imageUrl && <img src={editingEvent.imageUrl} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-slate-700" />}
                    </div>
                </div>
            );
        }

        return (
            <div className="h-full flex flex-col animate-fade-in">
                 <div className="flex justify-between items-center mb-4">
                     <h2 className="text-2xl font-bold text-white">Events Calendar</h2>
                     <button onClick={() => setEditingEvent({ id: 'new', title: '', status: 'published', category: EventCategory.COMMUNITY, startTime: new Date().toISOString() })} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:scale-105 transition-transform"><i className="fa-solid fa-plus mr-2"></i> New Event</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {eventsList.map(ev => (
                        <div key={ev.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group">
                            <div>
                                <h3 className="font-bold text-white">{ev.title}</h3>
                                <p className="text-xs text-slate-500">{new Date(ev.startTime).toLocaleDateString()} • {ev.locationName}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingEvent(ev)} className="w-10 h-10 bg-slate-700 rounded-lg text-white hover:bg-teal-600 transition-colors flex items-center justify-center"><i className="fa-solid fa-pen"></i></button>
                                <button onClick={() => handleDeleteEvent(ev.id)} className="w-10 h-10 bg-slate-700 rounded-lg text-slate-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"><i className="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    ))}
                    {eventsList.length === 0 && <div className="text-slate-500 text-center py-10">No events found.</div>}
                </div>
            </div>
        );
    };

    const renderLogs = () => (
        <div className="h-full flex flex-col animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-4">System Logs</h2>
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900 text-slate-200 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Target / Query</th>
                                <th className="px-4 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-700/50">
                                    <td className="px-4 py-3 whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="px-4 py-3 font-bold text-white">
                                        {log.action === 'USER_SEARCH' ? <span className="text-blue-400">SEARCH</span> : 
                                         log.action === 'USER_CHAT' ? <span className="text-purple-400">AI CHAT</span> : 
                                         log.action === 'AI_BRIEFING' ? <span className="text-teal-400 animate-pulse">⚡ BRIEFING</span> :
                                         log.action === 'UPDATE_SUGGESTION' ? <span className="text-orange-400">REPORT</span> :
                                         log.action.includes('DELETE') ? <span className="text-red-400">{log.action}</span> :
                                         <span className="text-teal-400">{log.action}</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-white">{log.place_name}</td>
                                    <td className="px-4 py-3 text-xs opacity-70 truncate max-w-[200px]">{log.details.startsWith('<') ? 'HTML Content' : log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && <div className="p-8 text-center text-slate-500">No logs found.</div>}
                </div>
            </div>
        </div>
    );

    const renderStats = () => {
         const catCounts = places.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {} as Record<string, number>);
        return (
            <div className="h-full overflow-y-auto animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6">Database Stats</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <h3 className="font-bold text-white mb-4">Places by Category</h3>
                        <div className="space-y-3">
                            {Object.entries(catCounts).sort((a,b) => Number(b[1]) - Number(a[1])).map(([cat, count]) => (
                                <div key={cat} className="flex items-center gap-3">
                                    <div className="w-24 text-xs font-bold text-slate-400 uppercase">{cat}</div>
                                    <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-teal-500" style={{ width: `${(Number(count) / places.length) * 100}%` }}></div>
                                    </div>
                                    <div className="w-8 text-right text-sm font-bold text-white">{count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="space-y-6">
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                             <h3 className="font-bold text-white mb-2">Verification Status</h3>
                             <div className="flex gap-4">
                                <div className="text-center">
                                    <div className="text-3xl font-black text-green-500">{places.filter(p => p.isVerified).length}</div>
                                    <div className="text-xs text-slate-400 uppercase">Verified</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-black text-slate-500">{places.length - places.filter(p => p.isVerified).length}</div>
                                    <div className="text-xs text-slate-400 uppercase">Unverified</div>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderMarketing = () => {
        const isBundle = marketingPlatform === 'campaign_bundle';
        let parsedBundle: any = null;
        if (isBundle && marketingResult) {
            try { parsedBundle = JSON.parse(marketingResult); } catch(e) { parsedBundle = null; }
        }

        return (
            <div className="h-full flex flex-col animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-2">Social Studio 📸</h2>
                <p className="text-slate-400 mb-6 text-sm">Generate targeted content with El Veci.</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    <div className="space-y-6 h-fit overflow-y-auto pr-2">
                         <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4">
                            <InputGroup label="1. Select Place">
                                <select value={marketingPlaceId} onChange={e => setMarketingPlaceId(e.target.value)} className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-3 outline-none">
                                    <option value="">-- Choose a Place --</option>
                                    {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </InputGroup>

                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="2. Tone / Vibe">
                                    <div className="grid grid-cols-1 gap-2">
                                        {['chill', 'hype', 'professional'].map(t => (
                                            <button key={t} onClick={() => setMarketingTone(t)} className={`p-2 rounded-lg border text-xs font-bold uppercase transition-all ${marketingTone === t ? 'bg-teal-600 border-teal-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </InputGroup>
                                 <InputGroup label="3. Language">
                                    <div className="grid grid-cols-1 gap-2">
                                        {['spanglish', 'es', 'en'].map(l => (
                                            <button key={l} onClick={() => setMarketingLang(l)} className={`p-2 rounded-lg border text-xs font-bold uppercase transition-all ${marketingLang === l ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </InputGroup>
                            </div>
                            
                            <InputGroup label="4. Format">
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setMarketingPlatform('instagram')} className={`p-3 rounded-xl border font-bold text-xs ${marketingPlatform === 'instagram' ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}><i className="fa-brands fa-instagram mr-2"></i> Post</button>
                                    <button onClick={() => setMarketingPlatform('campaign_bundle')} className={`p-3 rounded-xl border font-bold text-xs ${marketingPlatform === 'campaign_bundle' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}><i className="fa-solid fa-layer-group mr-2"></i> Bundle</button>
                                </div>
                            </InputGroup>
                            
                            <button onClick={handleMarketingTabGenerate} disabled={loading || !marketingPlaceId} className="w-full bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-900/20 transition-all mt-4">
                                {loading ? 'Magic happening...' : '✨ Generate Content'}
                            </button>
                         </div>
                    </div>
                    
                    {/* PREVIEW AREA */}
                    <div className="flex flex-col h-full bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden relative shadow-2xl">
                        <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">iPhone Preview</span>
                            <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div></div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
                             {/* Instagram Mockup */}
                             <div className="w-full max-w-xs bg-white text-black rounded-[30px] overflow-hidden shadow-xl border border-slate-200">
                                 {/* Header */}
                                 <div className="flex items-center justify-between p-3 border-b border-gray-100">
                                     <div className="flex items-center gap-2">
                                         <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[2px]">
                                             <div className="w-full h-full bg-white rounded-full p-[2px]"><img src="https://cdn-icons-png.flaticon.com/512/3203/3203071.png" className="w-full h-full rounded-full" alt="profile"/></div>
                                         </div>
                                         <span className="text-xs font-bold">mapadecaborojo</span>
                                     </div>
                                     <i className="fa-solid fa-ellipsis text-xs"></i>
                                 </div>
                                 {/* Image Placeholder */}
                                 <div className="aspect-square bg-slate-100 flex items-center justify-center">
                                     {marketingPlaceId ? (
                                         <img src={places.find(p => p.id === marketingPlaceId)?.imageUrl} className="w-full h-full object-cover" alt="" />
                                     ) : (
                                         <i className="fa-solid fa-image text-slate-300 text-4xl"></i>
                                     )}
                                 </div>
                                 {/* Actions */}
                                 <div className="px-3 py-2 flex justify-between text-xl">
                                     <div className="flex gap-4">
                                         <i className="fa-regular fa-heart"></i>
                                         <i className="fa-regular fa-comment"></i>
                                         <i className="fa-regular fa-paper-plane"></i>
                                     </div>
                                     <i className="fa-regular fa-bookmark"></i>
                                 </div>
                                 {/* Caption */}
                                 <div className="px-3 pb-4 text-xs">
                                     <span className="font-bold mr-2">mapadecaborojo</span>
                                     <span className="whitespace-pre-wrap leading-tight">
                                         {marketingResult ? (
                                             isBundle && parsedBundle ? parsedBundle.instagram : marketingResult
                                         ) : "Your AI caption will appear here..."}
                                     </span>
                                 </div>
                             </div>
                             
                             {/* Extra Bundle Info */}
                             {isBundle && parsedBundle && (
                                 <div className="w-full mt-6 bg-slate-800 rounded-xl p-4 border border-slate-700">
                                     <h4 className="text-teal-400 text-xs font-bold uppercase mb-2">📧 Email Subject</h4>
                                     <p className="text-white text-sm mb-4">{parsedBundle.email_subject}</p>
                                     
                                     <h4 className="text-purple-400 text-xs font-bold uppercase mb-2">📹 Story Script</h4>
                                     <p className="text-slate-300 text-xs whitespace-pre-wrap">{parsedBundle.story_script}</p>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- MAIN RENDER ---
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
                {/* Mobile Header */}
                <div className="md:hidden p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
                    <span className="font-bold text-white">ADMIN PANEL</span>
                    <button onClick={onClose}><i className="fa-solid fa-xmark text-white text-xl"></i></button>
                </div>

                <div className="flex-1 overflow-hidden p-4 md:p-8 relative">
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'places' && (editingPlace ? renderPlaceEditor() : renderPlaceList())}
                    {activeTab === 'events' && renderEvents()}
                    {activeTab === 'logs' && renderLogs()}
                    {activeTab === 'stats' && renderStats()}
                    {activeTab === 'marketing' && renderMarketing()}
                </div>
            </main>
        </div>
    );
};

export default Admin;
