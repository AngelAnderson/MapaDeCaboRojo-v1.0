
import React, { useState, useEffect, useRef } from 'react';
import { Place, PlaceCategory, ParkingStatus, Event, EventCategory, AdminLog } from '../types';
import { supabase, updatePlace, deletePlace, createPlace, uploadImage, getAdminLogs, createEvent, updateEvent, deleteEvent, getEvents } from '../services/supabase';
import { generateMarketingCopy, enhanceDescription } from '../services/geminiService';
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
    
    // Editor State (Places)
    const [editingPlace, setEditingPlace] = useState<Place | null>(null);
    const [openSection, setOpenSection] = useState<string>('basic');
    const [placeSearchTerm, setPlaceSearchTerm] = useState('');

    // Editor State (Events)
    const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);

    // Marketing State
    const [marketingPlaceId, setMarketingPlaceId] = useState<string>('');
    const [marketingPlatform, setMarketingPlatform] = useState<'instagram' | 'email' | 'radio'>('instagram');
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
            loadLogs();
            if (!initialEvents) loadEvents();
        }
    }, [activeTab]);

    const loadLogs = async () => {
        const data = await getAdminLogs();
        setLogs(data);
    };

    const loadEvents = async () => {
        const data = await getEvents();
        setEventsList(data);
    };

    const handleLogin = async () => {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else setUser(data.user);
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
            await onUpdate(); // Updates global App state
            await loadEvents(); // Updates local list
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
    const runAiMarketing = async (place?: Place) => {
        const target = place || editingPlace;
        if (!target) return;
        setLoading(true);
        const copy = await generateMarketingCopy(target.name, target.category, 'instagram');
        alert(copy); 
        setLoading(false);
    };
    
    const runAiEnhance = async () => {
        if (!editingPlace) return;
        setLoading(true);
        const improved = await enhanceDescription(editingPlace.description, editingPlace.name);
        setEditingPlace({ ...editingPlace, description: improved });
        setLoading(false);
    };
    
    const handleMarketingTabGenerate = async () => {
        if (!marketingPlaceId) return alert("Please select a place first.");
        const p = places.find(x => x.id === marketingPlaceId);
        if (!p) return;
        setLoading(true);
        const result = await generateMarketingCopy(p.name, p.category, marketingPlatform);
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
            <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Places</div>
                    <div className="text-3xl font-black text-white">{places.length}</div>
                </div>
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Active Events</div>
                    <div className="text-3xl font-black text-white">{eventsList.length}</div>
                </div>
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Pending Review</div>
                    <div className="text-3xl font-black text-amber-400">{places.filter(p => p.status === 'pending').length}</div>
                </div>
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Logs</div>
                    <div className="text-3xl font-black text-white">{logs.length}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 font-bold text-white">Recent Activity</div>
                    <div className="divide-y divide-slate-700">
                        {logs.slice(0, 5).map(log => (
                            <div key={log.id} className="p-4 flex justify-between items-center text-sm">
                                <div>
                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${log.action.includes('DELETE') ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                    <span className="text-white font-medium">{log.place_name}</span>
                                    <span className="text-slate-500 ml-2 text-xs">{log.action}</span>
                                </div>
                                <span className="text-slate-500 text-xs">{new Date(log.created_at).toLocaleDateString()}</span>
                            </div>
                        ))}
                        {logs.length === 0 && <div className="p-4 text-slate-500 text-center">No logs found.</div>}
                    </div>
                </div>
                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col justify-center items-center gap-4">
                    <button onClick={() => { setActiveTab('places'); setEditingPlace({ id: 'new', name: '', description: '', category: PlaceCategory.FOOD, coords: { lat: 17.9620, lng: -67.1650 }, parking: ParkingStatus.FREE, tags: [], vibe: [], imageUrl: '', videoUrl: '', website: '', phone: '', status: 'open', plan: 'free', sponsor_weight: 0, is_featured: false, hasRestroom: false, hasShowers: false, tips: '', priceLevel: '$', bestTimeToVisit: '', isPetFriendly: false, isHandicapAccessible: false, isVerified: true, slug: '', address: '', gmapsUrl: '' }); }} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">
                        <i className="fa-solid fa-plus"></i> Add New Place
                    </button>
                    <button onClick={() => { setActiveTab('events'); setEditingEvent({ id: 'new', title: '', status: 'published', category: EventCategory.COMMUNITY, startTime: new Date().toISOString() }); }} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">
                        <i className="fa-solid fa-calendar-plus"></i> Add New Event
                    </button>
                </div>
            </div>
        </div>
    );

    const renderPlaceList = () => {
        const filtered = places.filter(p => p.name.toLowerCase().includes(placeSearchTerm.toLowerCase()));
        return (
            <div className="h-full flex flex-col animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-2xl font-bold text-white">Places Database</h2>
                     <button onClick={() => setEditingPlace({ id: 'new', name: '', description: '', category: PlaceCategory.FOOD, coords: { lat: 17.9620, lng: -67.1650 }, parking: ParkingStatus.FREE, tags: [], vibe: [], imageUrl: '', videoUrl: '', website: '', phone: '', status: 'open', plan: 'free', sponsor_weight: 0, is_featured: false, hasRestroom: false, hasShowers: false, tips: '', priceLevel: '$', bestTimeToVisit: '', isPetFriendly: false, isHandicapAccessible: false, isVerified: true, slug: '', address: '', gmapsUrl: '' })} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-900/20 hover:scale-105 transition-transform"><i className="fa-solid fa-plus mr-2"></i> New Place</button>
                </div>
                <div className="bg-slate-800 p-2 rounded-xl mb-4 border border-slate-700">
                    <input type="text" placeholder="Search places..." value={placeSearchTerm} onChange={e => setPlaceSearchTerm(e.target.value)} className="w-full bg-transparent text-white p-2 outline-none" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {filtered.map(p => (
                        <div key={p.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group hover:border-teal-500/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <img src={p.imageUrl} className="w-12 h-12 rounded-lg object-cover bg-slate-700" alt="" />
                                <div>
                                    <h3 className="font-bold text-white">{p.name}</h3>
                                    <p className="text-xs text-slate-500 uppercase font-bold flex gap-2">
                                        <span>{p.category}</span>
                                        <span className={p.status === 'open' ? 'text-green-500' : 'text-amber-500'}>• {p.status}</span>
                                        {p.is_featured && <span className="text-yellow-400">• Featured</span>}
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
                            <div className="flex-1"><InputGroup label="Status"><select value={editingPlace!.status} onChange={e => setEditingPlace({...editingPlace!, status: e.target.value as any})} className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2.5 text-sm outline-none"><option value="open">Open</option><option value="closed">Closed</option><option value="pending">Pending</option></select></InputGroup></div>
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
                        <InputGroup label="Image URL"><StyledInput value={editingPlace!.imageUrl} onChange={e => setEditingPlace({...editingPlace!, imageUrl: e.target.value})} /></InputGroup>
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
                                         log.action.includes('DELETE') ? <span className="text-red-400">{log.action}</span> :
                                         <span className="text-teal-400">{log.action}</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-white">{log.place_name}</td>
                                    <td className="px-4 py-3 text-xs opacity-70 truncate max-w-[200px]">{log.details}</td>
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
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                             <h3 className="font-bold text-white mb-2">Features & Amenities</h3>
                             <div className="space-y-2 text-sm text-slate-300">
                                <div className="flex justify-between"><span>Free Parking</span> <span className="font-bold text-white">{places.filter(p => p.parking === 'FREE').length}</span></div>
                                <div className="flex justify-between"><span>Pet Friendly</span> <span className="font-bold text-white">{places.filter(p => p.isPetFriendly).length}</span></div>
                                <div className="flex justify-between"><span>Handicap Access</span> <span className="font-bold text-white">{places.filter(p => p.isHandicapAccessible).length}</span></div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderMarketing = () => (
        <div className="h-full flex flex-col animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-2">Marketing Generator</h2>
            <p className="text-slate-400 mb-6 text-sm">Use AI (El Veci) to write social media copy for your places.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 h-fit space-y-6">
                     <InputGroup label="Select Place">
                        <select value={marketingPlaceId} onChange={e => setMarketingPlaceId(e.target.value)} className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-3 outline-none">
                            <option value="">-- Choose a Place --</option>
                            {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                     </InputGroup>
                     <InputGroup label="Platform / Style">
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => setMarketingPlatform('instagram')} className={`p-3 rounded-xl border font-bold text-xs ${marketingPlatform === 'instagram' ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>Instagram</button>
                            <button onClick={() => setMarketingPlatform('email')} className={`p-3 rounded-xl border font-bold text-xs ${marketingPlatform === 'email' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>Email</button>
                            <button onClick={() => setMarketingPlatform('radio')} className={`p-3 rounded-xl border font-bold text-xs ${marketingPlatform === 'radio' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>Radio</button>
                        </div>
                     </InputGroup>
                     <button onClick={handleMarketingTabGenerate} disabled={loading || !marketingPlaceId} className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-900/20 transition-all">
                        {loading ? 'Generating...' : 'Generate Copy'}
                     </button>
                </div>
                <div className="flex flex-col h-full">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2">AI Output</label>
                    <textarea 
                        className="flex-1 w-full bg-slate-800 text-white border border-slate-700 rounded-2xl p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:border-teal-500"
                        value={marketingResult}
                        readOnly
                        placeholder="Generated text will appear here..."
                    ></textarea>
                    {marketingResult && (
                        <button onClick={() => navigator.clipboard.writeText(marketingResult)} className="mt-2 text-teal-400 text-xs font-bold hover:text-white flex items-center justify-end gap-2">
                            <i className="fa-solid fa-copy"></i> Copy to Clipboard
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    // --- MAIN RENDER ---

    if (!user) {
        // Login Screen (Same as before)
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
