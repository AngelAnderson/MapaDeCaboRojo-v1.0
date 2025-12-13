
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas'; 
import { Place, Event, PlaceCategory, ParkingStatus, EventCategory, AdminLog, DaySchedule, Category, InsightSnapshot, Person } from '../types';
import { updatePlace, deletePlace, createPlace, updateEvent, deleteEvent, createEvent, getAdminLogs, uploadImage, loginAdmin, checkSession, createCategory, updateCategory, deleteCategory, saveInsightSnapshot, getLatestInsights, createPerson, updatePerson, deletePerson, getPeople } from '../services/supabase';
import { generateMarketingCopy, categorizeAndTagPlace, enhanceDescription, generateElVeciTip, generateImageAltText, generateSeoMetaTags, analyzeUserDemand, parsePlaceFromRawText, parseBulkPlaces } from '../services/aiService'; 
import { fetchPlaceDetails, autocompletePlace, generateSessionToken } from '../services/placesService';
import { useLanguage } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import { DEFAULT_PLACE_ZOOM, DEFAULT_CATEGORIES } from '../constants';
import { getPlaceHeaderImage } from '../utils/imageOptimizer';

interface AdminProps {
  onClose: () => void;
  places: Place[];
  events: Event[];
  categories?: Category[];
  onUpdate: () => void;
}

// ... (Keep Section, InputGroup, StyledInput, StyledSelect, StyledTextArea, Toggle, Toast components unchanged)
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

const InputGroup = ({ label, children, description, className }: { label: string, children?: React.ReactNode, description?: string, className?: string }) => (
  <div className={`flex flex-col gap-1.5 ${className || ''}`}>
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

// --- SOCIAL CARD COMPONENT (Hidden) ---
const SocialCardTemplate = React.forwardRef<HTMLDivElement, { place: Partial<Place> }>(({ place }, ref) => {
    return (
        <div ref={ref} className="fixed left-[-9999px] top-0 w-[1080px] h-[1920px] bg-slate-900 text-white flex flex-col relative overflow-hidden font-sans">
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
                           <span className="text-slate-900 font-bold text-xs text-center">SCAN<br/>ME</span>
                       </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

// --- MAIN COMPONENT ---

const Admin: React.FC<AdminProps> = ({ onClose, places, events, categories = [], onUpdate }) => {
  const { t } = useLanguage();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'inbox' | 'places' | 'events' | 'logs' | 'insights' | 'categories' | 'people'>('places');
  const [editingPlace, setEditingPlace] = useState<Partial<Place> | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingPerson, setEditingPerson] = useState<Partial<Person> | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [jsonString, setJsonString] = useState('');

  const [importQuery, setImportQuery] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  
  // Google Maps Session Token (Cost optimization)
  const [sessionToken, setSessionToken] = useState(() => generateSessionToken());
  
  // Bulk & Magic State
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<Partial<Place>[]>([]);
  
  // Autocomplete State
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const autocompleteTimeoutRef = useRef<number | null>(null);

  // AI Spinners
  const [isAiGeneratingCategoryTags, setIsAiGeneratingCategoryTags] = useState(false);
  const [isAiEnhancingDescription, setIsAiEnhancingDescription] = useState(false);
  const [isAiGeneratingTip, setIsAiGeneratingTip] = useState(false);
  const [isAiGeneratingAltText, setIsAiGeneratingAltText] = useState(false);
  const [isAiGeneratingSeo, setIsAiGeneratingSeo] = useState(false);

  const [userLogs, setUserLogs] = useState<AdminLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<AdminLog[]>([]);
  const [topSearches, setTopSearches] = useState<{term: string, count: number}[]>([]);
  const [demandAnalysis, setDemandAnalysis] = useState<InsightSnapshot | null>(null);
  const [insightHistory, setInsightHistory] = useState<InsightSnapshot[]>([]);
  
  const [marketingPlatform, setMarketingPlatform] = useState<'instagram' | 'radio' | 'email' | 'campaign_bundle'>('instagram'); 
  const [marketingTone, setMarketingTone] = useState<'hype' | 'chill' | 'professional'>('hype');
  const [marketingResult, setMarketingResult] = useState('');
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  const socialCardRef = useRef<HTMLDivElement>(null); 
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchLower = searchTerm.toLowerCase();
  const matchesSearch = (text?: string) => text?.toLowerCase().includes(searchLower);

  const pendingPlaces = places.filter(p => 
      p.status === 'pending' && 
      (!searchTerm || matchesSearch(p.name) || matchesSearch(p.description) || matchesSearch(p.id))
  );
  
  const filteredPlaces = places.filter(p => 
      p.status !== 'pending' && 
      (!searchTerm || matchesSearch(p.name) || matchesSearch(p.description) || matchesSearch(p.tags?.join(' ')) || matchesSearch(p.id))
  );

  const filteredEvents = events.filter(e => 
      !searchTerm || matchesSearch(e.title) || matchesSearch(e.locationName) || matchesSearch(e.description)
  );

  const filteredCategories = categories.filter(c => 
      !searchTerm || matchesSearch(c.label_es) || matchesSearch(c.label_en) || matchesSearch(c.id)
  );

  const filteredPeople = people.filter(p => 
      !searchTerm || matchesSearch(p.name) || matchesSearch(p.role) || matchesSearch(p.bio)
  );

  useEffect(() => {
      checkSession().then(hasSession => {
          if (hasSession) setIsAuthenticated(true);
          setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'people' && isAuthenticated) {
        getPeople().then(setPeople);
    }
    if ((activeTab === 'logs' || activeTab === 'insights') && isAuthenticated) {
      // ... (Rest of logs logic)
      const limit = activeTab === 'insights' ? 500 : 50;
      getAdminLogs(limit).then(fetchedLogs => {
          setLogs(fetchedLogs);
          // ...
          const uLogs = fetchedLogs.filter(l => ['USER_SEARCH', 'USER_CHAT'].includes(l.action));
          const sLogs = fetchedLogs.filter(l => !['USER_SEARCH', 'USER_CHAT'].includes(l.action));
          setUserLogs(uLogs);
          setSystemLogs(sLogs);
          // ...
          const searchCounts: Record<string, number> = {};
          uLogs.filter(l => l.action === 'USER_SEARCH').forEach(l => {
              const term = l.place_name.trim().toLowerCase();
              if (term.length > 2) searchCounts[term] = (searchCounts[term] || 0) + 1;
          });
          const sortedSearches = Object.entries(searchCounts)
              .map(([term, count]) => ({ term, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10);
          setTopSearches(sortedSearches);
      });

      if (activeTab === 'insights') {
          getLatestInsights().then(history => {
              if (history.length > 0) {
                  setInsightHistory(history);
                  setDemandAnalysis(history[0]); 
              }
          });
      }
    }
  }, [activeTab, isAuthenticated]);
  
  useEffect(() => {
    if (editingPlace) {
        setJsonString(JSON.stringify(editingPlace.contact_info || {}, null, 2));
    }
  }, [editingPlace?.id]);

  // Autocomplete Logic
  useEffect(() => {
    if (autocompleteTimeoutRef.current) clearTimeout(autocompleteTimeoutRef.current);
    if (importQuery.length > 2) {
      autocompleteTimeoutRef.current = window.setTimeout(async () => {
        try {
          // Pass current session token
          const suggestions = await autocompletePlace(importQuery, sessionToken);
          setAutocompleteSuggestions(suggestions);
        } catch (e) {
          console.error("Autocomplete fetch error:", e);
          setAutocompleteSuggestions([]);
        }
      }, 300);
    } else {
      setAutocompleteSuggestions([]);
    }
    return () => { if (autocompleteTimeoutRef.current) clearTimeout(autocompleteTimeoutRef.current); };
  }, [importQuery, sessionToken]); // Added sessionToken dependancy

  // ... (ACTIONS methods like handleLogin, showToast, handleGetLocation, handleGoogleSync remain same)
  const handleLogin = async () => {
      if (!email || !password) return showToast(t('admin_enter_credentials'), 'error');
      setAuthLoading(true);
      const res = await loginAdmin(email, password);
      setAuthLoading(false);
      if (res.user) setIsAuthenticated(true);
      else showToast(res.error || t('admin_login_failed'), 'error');
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  const handleGetLocation = () => {
      if (!navigator.geolocation) return showToast(t('admin_geolocation_not_supported'), 'error');
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              if (editingPlace) {
                  setEditingPlace({
                      ...editingPlace,
                      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }
                  });
                  showToast(t('admin_gps_updated'), 'success');
              }
          },
          (err) => showToast(`${t('admin_error_getting_location')}: ${err.message}`, 'error'),
          { enableHighAccuracy: true }
      );
  };

  const handleGoogleSync = async () => {
      if (!editingPlace?.id) return showToast("Save place first to get an ID.", 'error');
      setIsSyncing(true);
      let gId = '';
      if (editingPlace.gmapsUrl && editingPlace.gmapsUrl.includes('place_id:')) { gId = editingPlace.gmapsUrl.split('place_id:')[1].split('&')[0]; }
      if (!gId && editingPlace.name) {
          try { const suggestions = await autocompletePlace(editingPlace.name); if (suggestions.length > 0) gId = suggestions[0].place_id; } catch(e) { console.error(e); }
      }
      if (!gId) { setIsSyncing(false); return showToast("Cannot sync: Google Place ID not found via URL or Name.", 'error'); }
      try {
          const res = await fetch('/api/sync-place', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ placeId: editingPlace.id, googlePlaceId: gId }) });
          const data = await res.json();
          if (res.ok) {
              const updates = data.data;
              const newCoords = (updates.lat && updates.lon) ? { lat: updates.lat, lng: updates.lon } : editingPlace.coords;
              setEditingPlace(prev => ({ ...prev!, address: updates.address, phone: updates.phone, website: updates.website, status: updates.status, rating: updates.rating, priceLevel: updates.price_level, coords: newCoords, gmapsUrl: `https://www.google.com/maps/place/?q=place_id:${gId}` }));
              showToast("Sync Successful! Data updated.", 'success'); onUpdate(); 
          } else { showToast(data.error || "Sync Failed", 'error'); }
      } catch (e: any) { showToast(e.message || "Network Error during Sync", 'error'); } finally { setIsSyncing(false); }
  };

  const handleSmartImport = async (text: string) => {
      if (!text) return;
      setImportLoading(true);
      setAutocompleteSuggestions([]); 
      try {
          if (text.includes('http') || text.includes('maps')) {
              // Note: Google Maps URLs don't support session tokens directly for details in the same way autocomplete does
              // but we pass it anyway in case it was a place_id reference
              const details = await fetchPlaceDetails(text, sessionToken);
              if (details) {
                  setEditingPlace(prev => ({ ...prev, ...details }));
                  showToast("Imported from Google Maps!", 'success');
              } else {
                  showToast("Could not resolve URL.", 'error');
              }
          } else {
              // Pass the session token to link with previous autocomplete
              const details = await fetchPlaceDetails(text, sessionToken);
              if (details) {
                  setEditingPlace(prev => ({ ...prev, ...details }));
                  showToast("Imported from Google!", 'success');
              } else {
                  // Fallback: AI Parse
                  const parsed = await parsePlaceFromRawText(text);
                  if (parsed && parsed.name) {
                      setEditingPlace(prev => ({ ...prev, ...parsed, status: 'open', isVerified: true }));
                      showToast("AI Parsed Text!", 'success');
                  } else {
                      showToast("AI could not understand text.", 'error');
                  }
              }
          }
      } catch (e) {
          showToast("Import failed.", 'error');
      } finally {
          setImportLoading(false);
          setImportQuery('');
          // Regenerate token after successful use to start a new billing session
          setSessionToken(generateSessionToken());
      }
  };

  // ... (Rest of bulk magic, save logic, delete logic, ai helpers, schedule logic - unchanged)
  
  const handleBulkMagic = async () => {
      if (!bulkInput) return;
      setBulkProcessing(true);
      try {
          const results = await parseBulkPlaces(bulkInput);
          if (Array.isArray(results) && results.length > 0) {
              setBulkResults(results);
              showToast(`Parsed ${results.length} items! Review and save.`, 'success');
          } else {
              showToast("No items parsed.", 'error');
          }
      } catch (e) {
          showToast("Bulk AI Failed.", 'error');
      } finally {
          setBulkProcessing(false);
      }
  };

  const saveBulkItem = async (index: number) => {
      const item = bulkResults[index];
      if (!item) return;
      try {
          const res = await createPlace({ ...item, status: 'open', isVerified: true, defaultZoom: 16 });
          if (res.success) {
              const newResults = [...bulkResults];
              newResults.splice(index, 1);
              setBulkResults(newResults);
              onUpdate();
              showToast(`Saved ${item.name}`, 'success');
          } else {
              showToast("Error saving item", 'error');
          }
      } catch (e) { showToast("Network error", 'error'); }
  };

  const handleSavePlace = async (autoApprove: boolean = false) => {
    if (!editingPlace || !editingPlace.name) return showToast(t('admin_name_required'), 'error');
    try { const parsed = JSON.parse(jsonString); editingPlace.contact_info = parsed; } catch (e) { return showToast(t('admin_invalid_json'), 'error'); }
    if (autoApprove) { editingPlace.status = 'open'; editingPlace.isVerified = true; }
    setIsSaving(true);
    try {
      if (editingPlace.id) { const res = await updatePlace(editingPlace.id, editingPlace); if (!res.success) throw new Error(res.error); } 
      else { const res = await createPlace(editingPlace); if (!res.success) throw new Error(res.error); }
      await onUpdate(); showToast(t('admin_saved_successfully'), 'success'); setEditingPlace(null);
    } catch (e: any) { showToast(e.message || t('admin_error_saving'), 'error'); } finally { setIsSaving(false); }
  };

  const handleDeletePlace = async (id: string) => {
    if (confirm(t('admin_confirm_delete_place'))) {
      setIsSaving(true);
      try { const res = await deletePlace(id); if (res.success) { setEditingPlace(null); await onUpdate(); showToast(t('admin_place_deleted'), 'success'); } else { showToast(res.error || t('admin_failed_to_delete'), 'error'); } } 
      catch (e) { showToast(t('admin_unexpected_delete_error'), 'error'); } finally { setIsSaving(false); }
    }
  };

  const handleSaveEvent = async () => {
      if (!editingEvent || !editingEvent.title) return showToast(t('admin_title_required'), 'error');
      setIsSaving(true);
      try {
          if (editingEvent.id) { const res = await updateEvent(editingEvent.id, editingEvent); if (!res.success) throw new Error(res.error); }
          else { const res = await createEvent(editingEvent); if (!res.success) throw new Error(res.error); }
          await onUpdate(); showToast(t('admin_event_saved'), 'success'); setEditingEvent(null);
      } catch (e: any) { showToast(e.message || t('admin_error_saving_event'), 'error'); } finally { setIsSaving(false); }
  };

  const handleDeleteEvent = async (id: string) => {
      if (confirm(t('admin_confirm_delete_event'))) {
          setIsSaving(true);
          try { const res = await deleteEvent(id); if (res.success) { setEditingEvent(null); await onUpdate(); showToast(t('admin_event_deleted'), 'success'); } else { showToast(res.error || t('admin_failed_to_delete_event'), 'error'); } }
          catch (e) { showToast(t('admin_unexpected_delete_error'), 'error'); } finally { setIsSaving(false); }
      }
  };

  const handleSaveCategory = async () => {
      if (!editingCategory || !editingCategory.id || !editingCategory.label_es) return showToast("ID and Label (ES) required", 'error');
      setIsSaving(true);
      try {
          const exists = categories.find(c => c.id === editingCategory.id);
          // If exists in local list, assume update, otherwise create.
          if (exists && categories.some(c => c.id === editingCategory.id)) {
              await updateCategory(editingCategory.id, editingCategory);
          } else {
              await createCategory(editingCategory as Category);
          }
          await onUpdate(); showToast("Category saved", 'success'); setEditingCategory(null);
      } catch(e: any) { showToast(e.message, 'error'); } finally { setIsSaving(false); }
  };

  const handleDeleteCategory = async (id: string) => {
      if(confirm("Delete category?")) {
          setIsSaving(true);
          try { await deleteCategory(id); await onUpdate(); showToast("Category deleted", 'success'); setEditingCategory(null); }
          catch(e) { showToast("Error", 'error'); } finally { setIsSaving(false); }
      }
  };

  const handleSavePerson = async () => {
      if (!editingPerson || !editingPerson.name) return showToast("Name required", 'error');
      setIsSaving(true);
      try {
          if (editingPerson.id) { await updatePerson(editingPerson.id, editingPerson); }
          else { await createPerson(editingPerson); }
          setPeople(await getPeople());
          await onUpdate(); 
          showToast("Person saved", 'success'); 
          setEditingPerson(null);
      } catch(e: any) { showToast(e.message, 'error'); } finally { setIsSaving(false); }
  };

  const handleDeletePerson = async (id: string) => {
      if(confirm("Delete Person?")) {
          setIsSaving(true);
          try { await deletePerson(id); setPeople(await getPeople()); await onUpdate(); showToast("Deleted", 'success'); setEditingPerson(null); }
          catch(e) { showToast("Error", 'error'); } finally { setIsSaving(false); }
      }
  };

  const handleGenerateSocialCard = async () => {
      if (!socialCardRef.current || !editingPlace) return;
      setIsGeneratingCard(true);
      try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const canvas = await html2canvas(socialCardRef.current, {
              useCORS: true, 
              scale: 1, 
              backgroundColor: '#0f172a'
          });
          const link = document.createElement('a');
          link.download = `CaboRojo_Story_${editingPlace.slug || 'place'}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          showToast("Social Card Downloaded!", 'success');
      } catch (e) {
          console.error("Card Gen Failed:", e);
          showToast("Failed to generate image. Check console.", 'error');
      } finally {
          setIsGeneratingCard(false);
      }
  };

  // ADDED: Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsUploading(true);
      try {
          const res = await uploadImage(file);
          if (res.success && res.url) {
              if (editingPlace) setEditingPlace(prev => ({ ...prev!, imageUrl: res.url }));
              else if (editingPerson) setEditingPerson(prev => ({ ...prev!, imageUrl: res.url }));
              showToast("Image uploaded successfully", 'success');
          } else {
              showToast(res.error || "Upload failed", 'error');
          }
      } catch (err) {
          showToast("Upload error", 'error');
      } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  // AI Helpers
  const handleAiEnhanceDescription = async () => {
      if (!editingPlace?.name || !editingPlace?.description) return showToast("Need name & desc first", 'error');
      setIsAiEnhancingDescription(true);
      try {
          const enhanced = await enhanceDescription(editingPlace.name, editingPlace.description);
          if (enhanced) setEditingPlace(prev => ({...prev, description: enhanced}));
          else showToast("AI failed", 'error');
      } catch(e) { showToast("Error", 'error'); } finally { setIsAiEnhancingDescription(false); }
  };

  const handleAiGenerateTip = async () => {
      if (!editingPlace?.name || !editingPlace?.category) return showToast("Need name & category", 'error');
      setIsAiGeneratingTip(true);
      try {
          const tip = await generateElVeciTip(editingPlace.name, editingPlace.category, editingPlace.description || "");
          if (tip) setEditingPlace(prev => ({...prev, tips: tip}));
          else showToast("AI failed", 'error');
      } catch(e) { showToast("Error", 'error'); } finally { setIsAiGeneratingTip(false); }
  };

  const handleAiSuggestCategoryAndTags = async () => {
      if (!editingPlace?.name) return showToast("Need place name", 'error');
      setIsAiGeneratingCategoryTags(true);
      try {
          const res = await categorizeAndTagPlace(editingPlace.name, editingPlace.description || "");
          if (res) {
              setEditingPlace(prev => ({...prev, category: res.category, tags: res.tags}));
              showToast("AI categorized successfully!", 'success');
          } else {
              showToast("AI categorization failed", 'error');
          }
      } catch(e) { showToast("Error connecting to AI", 'error'); } finally { setIsAiGeneratingCategoryTags(false); }
  };

  const handleAiGenerateAltText = async () => {
      if (!editingPlace?.imageUrl) return showToast("Need image URL first", 'error');
      setIsAiGeneratingAltText(true);
      try {
          const alt = await generateImageAltText(editingPlace.imageUrl);
          if (alt) {
              setEditingPlace(prev => ({...prev, imageAlt: alt}));
              showToast("AI Alt Text generated!", 'success');
          } else {
              showToast("AI failed to generate alt text", 'error');
          }
      } catch(e) { showToast("Error connecting to AI", 'error'); } finally { setIsAiGeneratingAltText(false); }
  };

  const handleAiGenerateSeo = async () => {
      if (!editingPlace?.name || !editingPlace?.category) return showToast("Need name & category", 'error');
      setIsAiGeneratingSeo(true);
      try {
          const seo = await generateSeoMetaTags(editingPlace.name, editingPlace.description || "", editingPlace.category);
          if (seo) {
              setEditingPlace(prev => ({...prev, metaTitle: seo.metaTitle, metaDescription: seo.metaDescription}));
              showToast("AI SEO Generated!", 'success');
          } else {
              showToast("AI failed to generate SEO tags", 'error');
          }
      } catch(e) { showToast("Error connecting to AI", 'error'); } finally { setIsAiGeneratingSeo(false); }
  };

  const handleGenerateMarketing = async () => {
      if (!editingPlace?.name) return showToast(t('admin_name_required'), 'error');
      setIsGeneratingMarketing(true);
      try {
          const copy = await generateMarketingCopy(editingPlace.name, marketingPlatform, marketingTone);
          setMarketingResult(copy);
      } catch (e) {
          showToast(t('admin_error_saving'), 'error'); 
      } finally {
          setIsGeneratingMarketing(false);
      }
  };

  // --- SCHEDULE LOGIC ---
  const formatTime12 = (t: string) => {
      if (!t) return '';
      const [h, m] = t.split(':');
      const date = new Date();
      date.setHours(parseInt(h), parseInt(m));
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
  };

  const getStructuredHours = () => {
      const existing = editingPlace?.opening_hours?.structured;
      // If existing data looks valid (7 days), return it
      if (existing && existing.length === 7) return existing;
      
      // Otherwise, fill gaps or create defaults
      return Array.from({ length: 7 }, (_, i) => {
          const found = existing?.find(e => e.day === i);
          return found || {
              day: i,
              open: '09:00',
              close: '17:00',
              isClosed: false
          };
      });
  };

  const updateScheduleDay = (idx: number, field: keyof DaySchedule, val: any) => {
      if (!editingPlace) return;
      const structured = [...getStructuredHours()]; // Clone array
      structured[idx] = { ...structured[idx], [field]: val };
      
      setEditingPlace({
          ...editingPlace,
          opening_hours: {
              ...(editingPlace.opening_hours || {}),
              type: editingPlace.opening_hours?.type || 'fixed', // Ensure type is set
              structured
          }
      });
  };

  const applyMonToFri = () => {
      if (!editingPlace) return;
      const structured = [...getStructuredHours()]; // Clone
      const mon = structured[1]; // Monday index
      for (let i = 2; i <= 5; i++) { // Tue to Fri
          structured[i] = { ...structured[i], open: mon.open, close: mon.close, isClosed: mon.isClosed };
      }
      setEditingPlace({
          ...editingPlace,
          opening_hours: {
              ...(editingPlace.opening_hours || {}),
              type: editingPlace.opening_hours?.type || 'fixed',
              structured
          }
      });
      showToast(t('admin_applied_mon_to_fri'), 'success');
  };

  // --- AUTH UI ---
  if (!isAuthenticated) {
    // ... (Login form unchanged)
    return (
        <div className="fixed inset-0 bg-slate-900/90 z-[5000] flex items-center justify-center p-4 backdrop-blur-md">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
            <div className="bg-slate-800 border border-slate-700 w-full max-w-md p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                    <i className="fa-solid fa-xmark text-xl"></i>
                </button>
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-teal-500/10 text-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                        <i className="fa-solid fa-lock"></i>
                    </div>
                    <h2 className="text-2xl font-black text-white">{t('admin_access_title')}</h2>
                    <p className="text-slate-400 text-sm mt-1">{t('admin_access_subtitle')}</p>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">{t('admin_email_placeholder')}</label>
                        <input 
                            type="email" 
                            className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl focus:border-teal-500 outline-none transition-colors"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">{t('admin_password_placeholder')}</label>
                        <input 
                            type="password" 
                            className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl focus:border-teal-500 outline-none transition-colors"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        />
                    </div>
                    <button 
                        onClick={handleLogin} 
                        disabled={authLoading}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {authLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-arrow-right-to-bracket"></i>}
                        <span>{t('admin_login_button')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
  }

  const isEditing = editingPlace || editingEvent || editingCategory || editingPerson;

  return (
    <div className="fixed inset-0 bg-slate-900 z-[5000] flex flex-col font-sans text-slate-200">
      
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-slate-900 border-b border-slate-700 p-3 flex justify-between items-center shadow-md z-20 h-16 shrink-0">
        {/* ... (Header content mostly unchanged) ... */}
        {isEditing ? (
            <div className="flex items-center gap-3 w-full">
                <button 
                    onClick={() => { setEditingPlace(null); setEditingEvent(null); setEditingCategory(null); setEditingPerson(null); setBulkMode(false); }} 
                    className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 active:bg-slate-700 transition-colors"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('admin_editing')}</h2>
                    <p className="text-white font-bold truncate">
                        {editingPlace?.name || editingEvent?.title || editingCategory?.id || editingPerson?.name || t('admin_new_item')}
                    </p>
                </div>
                <button 
                    onClick={() => {
                        if (activeTab === 'categories') handleSaveCategory();
                        else if (activeTab === 'people') handleSavePerson();
                        else if (activeTab === 'places' || activeTab === 'inbox') handleSavePlace(false);
                        else handleSaveEvent();
                    }} 
                    disabled={isSaving}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-900/20 active:scale-95 transition-transform flex items-center gap-2"
                >
                    {isSaving && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                    <span>{t('save')}</span>
                </button>
            </div>
        ) : (
            <div className="flex items-center justify-between w-full">
                {/* ... Main Header ... */}
                <div className="flex items-center gap-3">
                    <div className="bg-teal-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20"><i className="fa-solid fa-lock text-white text-xs"></i></div>
                    <span className="font-black text-lg tracking-tight">Admin</span>
                </div>
                
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('inbox')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 whitespace-nowrap ${activeTab === 'inbox' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>
                        {t('admin_inbox')} {pendingPlaces.length > 0 && <span className="bg-red-500 text-white px-1.5 rounded-full text-[9px]">{pendingPlaces.length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('places')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'places' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{t('admin_places')}</button>
                    <button onClick={() => setActiveTab('events')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'events' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{t('admin_events')}</button>
                    <button onClick={() => setActiveTab('people')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'people' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>People</button>
                    <button onClick={() => setActiveTab('categories')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'categories' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Cats</button>
                    <button onClick={() => setActiveTab('insights')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'insights' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Insights</button>
                    <button onClick={() => setActiveTab('logs')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'logs' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{t('admin_logs')}</button>
                </div>

                <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-700"><i className="fa-solid fa-xmark"></i></button>
            </div>
        )}
      </header>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* ... (Sidebar logic unchanged) ... */}
        <div className={`w-full md:w-80 border-r border-slate-700 bg-slate-900 flex flex-col ${isEditing || bulkMode ? 'hidden md:flex' : 'flex'} ${activeTab === 'insights' || activeTab === 'logs' ? 'hidden md:hidden' : ''}`}>
            {/* Search Bar in Sidebar */}
            {!isEditing && (activeTab === 'places' || activeTab === 'inbox' || activeTab === 'events' || activeTab === 'categories' || activeTab === 'people') && (
                <div className="p-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-500 transition-colors">
                            <i className="fa-solid fa-magnifying-glass text-xs"></i>
                        </div>
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('admin_search_placeholder') || "Search..."}
                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg py-2.5 pl-9 pr-8 outline-none focus:border-teal-500/50 focus:bg-slate-800/80 transition-all placeholder:text-slate-600"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                            >
                                <i className="fa-solid fa-circle-xmark text-xs"></i>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ... (Keep sidebar sections for places, inbox, events, categories) ... */}
            {activeTab === 'places' && (
                <>
                    <div className="flex gap-2 p-2">
                        <button onClick={() => { setEditingPlace({ name: '', category: 'FOOD', status: 'open', plan: 'free', parking: ParkingStatus.FREE, defaultZoom: DEFAULT_PLACE_ZOOM }); setJsonString('{}'); }} className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-teal-500 hover:text-teal-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-plus text-lg"></i> <span className="text-[10px]">Add New</span></button>
                        <button onClick={() => { setBulkMode(true); setEditingPlace(null); }} className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-700 text-purple-400 hover:border-purple-500 hover:text-purple-500 hover:bg-purple-900/10 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-layer-group text-lg"></i> <span className="text-[10px]">Bulk Ops</span></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
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
                    </div>
                </>
            )}
            {/* ... (Keep Inbox, Events, Categories sidebars same as existing) ... */}
            {activeTab === 'inbox' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {pendingPlaces.length === 0 && <div className="text-center p-8 text-slate-500 text-xs font-bold">No pending places</div>}
                    {pendingPlaces.map(p => (
                        <div key={p.id} onClick={() => setEditingPlace(p)} className={`p-4 rounded-xl border cursor-pointer transition-all ${editingPlace?.id === p.id ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-800 border-slate-700'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-bold text-sm text-slate-200 truncate">{p.name}</h4>
                                <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Pending</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{p.description}</p>
                        </div>
                    ))}
                </div>
            )}
            {activeTab === 'events' && (
                <>
                    <div className="p-2">
                        <button onClick={() => setEditingEvent({ title: '', description: '', category: EventCategory.MUSIC, status: 'published', isFeatured: false, startTime: new Date().toISOString() })} className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-purple-500 hover:text-purple-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-calendar-plus text-lg"></i> <span className="text-[10px]">Add Event</span></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {filteredEvents.map(e => (
                            <div key={e.id} onClick={() => setEditingEvent(e)} className={`p-4 rounded-xl border cursor-pointer transition-all ${editingEvent?.id === e.id ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-800 border-slate-700'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-sm text-slate-200 truncate">{e.title}</h4>
                                    <span className="text-[10px] text-slate-500">{new Date(e.startTime).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <i className="fa-solid fa-location-dot"></i> {e.locationName}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {activeTab === 'people' && (
                <>
                    <div className="p-2">
                        <button onClick={() => setEditingPerson({ name: '', role: '', bio: '' })} className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-user-plus text-lg"></i> <span className="text-[10px]">Add Person</span></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {filteredPeople.map(p => (
                            <div key={p.id} onClick={() => setEditingPerson(p)} className={`p-4 rounded-xl border cursor-pointer transition-all flex gap-3 items-center ${editingPerson?.id === p.id ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800 border-slate-700'}`}>
                                <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden shrink-0">
                                    {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-slate-500"><i className="fa-solid fa-user"></i></div>}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-sm text-slate-200 truncate">{p.name}</h4>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">{p.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {activeTab === 'categories' && (
                <>
                    <div className="p-2">
                        <button onClick={() => setEditingCategory({ id: '', label_es: '', label_en: '', icon: 'tag', color: '#64748b' })} className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-tag text-lg"></i> <span className="text-[10px]">Add Category</span></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {filteredCategories.map(c => (
                            <div key={c.id} onClick={() => setEditingCategory(c)} className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${editingCategory?.id === c.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800 border-slate-700'}`}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{backgroundColor: c.color}}>
                                    <i className={`fa-solid fa-${c.icon}`}></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-200">{c.label_es}</h4>
                                    <p className="text-[10px] text-slate-500 font-mono">{c.id}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>

        <div className={`flex-1 bg-slate-900 overflow-y-auto custom-scrollbar ${isEditing || bulkMode ? 'absolute inset-0 z-10 md:static' : ((activeTab === 'insights' || activeTab === 'logs') ? 'w-full' : 'hidden md:flex flex-col items-center justify-center')}`}>
            
            {/* BULK / MAGIC IMPORT MODE */}
            {bulkMode && !isEditing && (
                <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 animate-slide-up">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black text-white">Magic Import & Bulk Tools</h2>
                        <button onClick={() => setBulkMode(false)} className="bg-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-slate-700 text-sm font-bold">Cancel</button>
                    </div>

                    <Section title="AI Magic Parser" icon="wand-magic-sparkles">
                        <p className="text-xs text-slate-400 mb-2">Paste a raw list of places (names, descriptions, addresses) and let AI structure them for you.</p>
                        <StyledTextArea 
                            placeholder="Example: El Meson Sandwiches, Cabo Rojo - Good breakfast place. Open 6am.&#10;Playa Buyé - Beautiful beach with calm waters." 
                            className="h-48 font-mono text-xs"
                            value={bulkInput}
                            onChange={e => setBulkInput(e.target.value)}
                        />
                        <button 
                            onClick={handleBulkMagic} 
                            disabled={bulkProcessing || !bulkInput}
                            className="mt-3 bg-purple-600 text-white w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 active:scale-95 transition-all"
                        >
                            {bulkProcessing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                            Process with AI
                        </button>
                    </Section>

                    {bulkResults.length > 0 && (
                        <div className="space-y-3 mt-6">
                            <h3 className="font-bold text-white mb-2">Results ({bulkResults.length})</h3>
                            {bulkResults.map((item, idx) => (
                                <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group">
                                    <div>
                                        <h4 className="font-bold text-white">{item.name}</h4>
                                        <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded mr-2">{item.category}</span>
                                        <span className="text-xs text-slate-500">{item.description?.substring(0, 50)}...</span>
                                    </div>
                                    <button onClick={() => saveBulkItem(idx)} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white p-2 rounded-lg transition-colors">
                                        <i className="fa-solid fa-plus"></i> Save
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* PLACE EDITOR (Used for Places & Inbox) */}
            {(activeTab === 'places' || activeTab === 'inbox') && editingPlace && (
                <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
                    
                    {/* NEW: Smart Import Bar */}
                    {!editingPlace.id && (
                        <div className="mb-6 relative bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-2xl p-4 flex gap-2 items-center shadow-lg">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/30"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
                            <div className="flex-1 relative">
                                <input 
                                    className="w-full bg-transparent text-white placeholder-blue-300/50 outline-none text-sm font-bold" 
                                    placeholder="Paste Google Maps Link or Raw Text to Auto-Fill..."
                                    value={importQuery}
                                    onChange={e => setImportQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSmartImport(importQuery)}
                                />
                                {autocompleteSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl mt-3 z-50 shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                        {autocompleteSuggestions.map((s, i) => (
                                            <div key={i} onClick={() => handleSmartImport(s.description)} className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0 transition-colors">
                                                <p className="text-sm font-bold text-white">{s.structured_formatting?.main_text || s.description}</p>
                                                <p className="text-xs text-slate-400">{s.structured_formatting?.secondary_text}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => handleSmartImport(importQuery)} 
                                disabled={importLoading}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                            >
                                {importLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Magic Fill / Parse"}
                            </button>
                        </div>
                    )}

                    {/* ... (Keep all existing sections: basic info, location, media, operations, schedule, amenities, vibe, seo, marketing) ... */}
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-mono text-xs text-slate-500">{editingPlace.id || 'NEW RECORD'}</span>
                        <div className="flex items-center gap-3">
                            {editingPlace.status === 'pending' && (
                                <button onClick={() => handleSavePlace(true)} className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-900/20">
                                    <i className="fa-solid fa-check mr-2"></i> Approve & Publish
                                </button>
                            )}
                            {editingPlace.id && (
                                <button onClick={() => handleDeletePlace(editingPlace.id!)} className="text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors">
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    <Section title={t('admin_basic_info')} icon="circle-info">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup label={t('admin_name')}><StyledInput value={editingPlace.name || ''} onChange={e => setEditingPlace({...editingPlace, name: e.target.value})} /></InputGroup>
                            <InputGroup label="Slug (URL)"><StyledInput value={editingPlace.slug || ''} onChange={e => setEditingPlace({...editingPlace, slug: e.target.value})} placeholder="place-name-cabo-rojo" /></InputGroup>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup label="Category">
                                <StyledSelect value={editingPlace.category} onChange={e => setEditingPlace({...editingPlace, category: e.target.value})}>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.label_es}</option>)}
                                    <option value="HISTORY">Historic / Landmark</option>
                                    <option value="PROJECT">Project / Development</option>
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label="Custom Icon (FontAwesome)" description="e.g. pizza-slice (no fa- prefix)">
                                <div className="flex gap-2">
                                    <StyledInput value={editingPlace.customIcon || ''} onChange={e => setEditingPlace({...editingPlace, customIcon: e.target.value})} placeholder="pizza-slice" />
                                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 shrink-0">
                                        {editingPlace.customIcon && <i className={`fa-solid fa-${editingPlace.customIcon} text-xl text-white`}></i>}
                                    </div>
                                </div>
                            </InputGroup>
                        </div>
                        <InputGroup label="Tags (comma separated)">
                            <div className="flex gap-2">
                                <StyledInput value={editingPlace.tags?.join(', ') || ''} onChange={e => setEditingPlace({...editingPlace, tags: e.target.value.split(',').map(t=>t.trim())})} placeholder="beach, sunset, food" />
                                <button onClick={handleAiSuggestCategoryAndTags} disabled={isAiGeneratingCategoryTags} className="bg-purple-600/20 text-purple-400 border border-purple-500/50 rounded-xl px-4 flex items-center justify-center shrink-0">
                                    {isAiGeneratingCategoryTags ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                                </button>
                            </div>
                        </InputGroup>
                        <InputGroup label={t('admin_description')}>
                            <StyledTextArea value={editingPlace.description || ''} onChange={e => setEditingPlace({...editingPlace, description: e.target.value})} />
                            <button onClick={handleAiEnhanceDescription} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-2 rounded-xl mt-2 flex items-center justify-center gap-2">{t('admin_ai_enhance_description')}</button>
                        </InputGroup>
                    </Section>

                    <Section title="Location & Contact" icon="map-location-dot">
                        <InputGroup label="Address"><StyledInput value={editingPlace.address || ''} onChange={e => setEditingPlace({...editingPlace, address: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <InputGroup label="Phone"><StyledInput value={editingPlace.phone || ''} onChange={e => setEditingPlace({...editingPlace, phone: e.target.value})} /></InputGroup>
                             <InputGroup label="Website"><StyledInput value={editingPlace.website || ''} onChange={e => setEditingPlace({...editingPlace, website: e.target.value})} /></InputGroup>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <InputGroup label="Latitude">
                                <StyledInput type="number" step="any" value={editingPlace.coords?.lat || ''} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords, lat: parseFloat(e.target.value) || 0, lng: editingPlace.coords?.lng || 0 }})} />
                            </InputGroup>
                            <InputGroup label="Longitude">
                                <div className="flex gap-2">
                                    <StyledInput type="number" step="any" value={editingPlace.coords?.lng || ''} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords, lng: parseFloat(e.target.value) || 0, lat: editingPlace.coords?.lat || 0 }})} />
                                    <button onClick={handleGetLocation} className="bg-slate-700 text-white px-3 rounded-xl hover:bg-slate-600 transition-colors" title="Get GPS"><i className="fa-solid fa-crosshairs"></i></button>
                                </div>
                            </InputGroup>
                        </div>
                        <InputGroup label="Google Maps URL">
                            <div className="flex gap-2">
                                <StyledInput value={editingPlace.gmapsUrl || ''} onChange={e => setEditingPlace({...editingPlace, gmapsUrl: e.target.value})} />
                                <button onClick={handleGoogleSync} className="bg-slate-700 text-white px-4 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-600 transition-colors"><i className="fa-brands fa-google"></i> Sync</button>
                            </div>
                        </InputGroup>
                    </Section>

                    <Section title="Media" icon="image">
                        <InputGroup label="Image URL">
                            <div className="flex gap-2">
                                <StyledInput value={editingPlace.imageUrl || ''} onChange={e => setEditingPlace({...editingPlace, imageUrl: e.target.value})} />
                                <button 
                                    onClick={() => fileInputRef.current?.click()} 
                                    disabled={isUploading}
                                    className="bg-slate-700 text-white px-4 rounded-xl flex items-center justify-center min-w-[50px] hover:bg-slate-600 transition-colors"
                                    title="Upload Image"
                                >
                                    {isUploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                                </button>
                                <button onClick={() => window.open(editingPlace.imageUrl, '_blank')} disabled={!editingPlace.imageUrl} className="bg-slate-700 text-white px-4 rounded-xl hover:bg-slate-600 transition-colors"><i className="fa-solid fa-eye"></i></button>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </InputGroup>
                        {editingPlace.imageUrl && <img src={editingPlace.imageUrl} alt="Preview" className="w-full h-48 object-cover rounded-xl mt-2 mb-4 border border-slate-700" />}
                        <InputGroup label="Image Position (Object-Position)" description="Useful for cropping headers properly.">
                            <StyledSelect value={editingPlace.imagePosition || 'center'} onChange={e => setEditingPlace({...editingPlace, imagePosition: e.target.value})}>
                                <option value="center">Center</option>
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </StyledSelect>
                        </InputGroup>
                        <InputGroup label="Image Alt Text (SEO)">
                            <div className="flex gap-2">
                                <StyledInput value={editingPlace.imageAlt || ''} onChange={e => setEditingPlace({...editingPlace, imageAlt: e.target.value})} placeholder="Describe image for accessibility" />
                                <button onClick={handleAiGenerateAltText} disabled={isAiGeneratingAltText || !editingPlace.imageUrl} className="bg-blue-600/20 text-blue-400 border border-blue-500/50 rounded-xl px-4 flex items-center justify-center shrink-0">
                                    {isAiGeneratingAltText ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-image"></i>}
                                </button>
                            </div>
                        </InputGroup>
                        <InputGroup label="Video URL (YouTube/MP4)">
                            <StyledInput value={editingPlace.videoUrl || ''} onChange={e => setEditingPlace({...editingPlace, videoUrl: e.target.value})} />
                        </InputGroup>
                    </Section>

                    <Section title="Operations & Status" icon="sliders">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <InputGroup label="Status">
                                <StyledSelect value={editingPlace.status || 'open'} onChange={e => setEditingPlace({...editingPlace, status: e.target.value as any})}>
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                    <option value="pending">Pending</option>
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label="Price Level">
                                <StyledSelect value={editingPlace.priceLevel || '$'} onChange={e => setEditingPlace({...editingPlace, priceLevel: e.target.value})}>
                                    <option value="$">$ (Cheap)</option>
                                    <option value="$$">$$ (Moderate)</option>
                                    <option value="$$$">$$$ (Expensive)</option>
                                    <option value="$$$$">$$$$ (Luxury)</option>
                                </StyledSelect>
                            </InputGroup>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <InputGroup label="Plan (Monetization)">
                                <StyledSelect value={editingPlace.plan || 'free'} onChange={e => setEditingPlace({...editingPlace, plan: e.target.value as any})}>
                                    <option value="free">Free</option>
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label="Crowd Level">
                                <StyledSelect value={editingPlace.crowdLevel || 'MEDIUM'} onChange={e => setEditingPlace({...editingPlace, crowdLevel: e.target.value as any})}>
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                </StyledSelect>
                            </InputGroup>
                        </div>
                        <InputGroup label="Sponsor Weight (0-100)" description="Higher numbers rank higher in sorting.">
                            <StyledInput type="number" min="0" max="100" value={editingPlace.sponsor_weight || 0} onChange={e => setEditingPlace({...editingPlace, sponsor_weight: parseInt(e.target.value) || 0})} />
                        </InputGroup>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                            <Toggle label="Featured" checked={editingPlace.is_featured || false} onChange={v => setEditingPlace({...editingPlace, is_featured: v})} icon="star" />
                            <Toggle label="Verified" checked={editingPlace.isVerified || false} onChange={v => setEditingPlace({...editingPlace, isVerified: v})} icon="circle-check" />
                            <Toggle label="Mobile/Delivery" checked={editingPlace.isMobile || false} onChange={v => setEditingPlace({...editingPlace, isMobile: v})} icon="truck-fast" />
                            <Toggle label="Secret Spot" checked={editingPlace.isSecret || false} onChange={v => setEditingPlace({...editingPlace, isSecret: v})} icon="user-secret" />
                            <Toggle label="Landing Spot" checked={editingPlace.isLanding || false} onChange={v => setEditingPlace({...editingPlace, isLanding: v})} icon="plane-arrival" />
                        </div>
                    </Section>

                    <Section title="Schedule" icon="clock">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup label="Hours Type">
                                <StyledSelect 
                                    value={editingPlace.opening_hours?.type || 'fixed'} 
                                    onChange={e => setEditingPlace({
                                        ...editingPlace, 
                                        opening_hours: { 
                                            ...(editingPlace.opening_hours || {}), 
                                            type: e.target.value as any 
                                        }
                                    })}
                                >
                                    <option value="fixed">Fixed Hours</option>
                                    <option value="24_7">Open 24/7</option>
                                    <option value="sunrise_sunset">Sunrise to Sunset</option>
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label="Display Note">
                                <StyledInput 
                                    value={editingPlace.opening_hours?.note || ''} 
                                    onChange={e => setEditingPlace({
                                        ...editingPlace, 
                                        opening_hours: { 
                                            ...(editingPlace.opening_hours || {}), 
                                            note: e.target.value 
                                        }
                                    })} 
                                    placeholder="e.g. Mon-Fri 9am-5pm" 
                                />
                            </InputGroup>
                        </div>
                        {(editingPlace.opening_hours?.type === 'fixed' || !editingPlace.opening_hours?.type) && (
                            <div className="mt-4 bg-slate-900 rounded-xl p-3 border border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase">Weekly Schedule</h4>
                                    <button onClick={applyMonToFri} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 transition-colors">Copy Mon to Fri</button>
                                </div>
                                <div className="space-y-1">
                                    {getStructuredHours().map((day, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                            <span className="w-20 text-slate-400 font-medium">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]}</span>
                                            <div className={`flex-1 flex items-center gap-2 ${day.isClosed ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                                                <input type="time" className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white w-24" value={day.open} onChange={e => updateScheduleDay(idx, 'open', e.target.value)} />
                                                <span className="text-[10px] text-slate-500 font-mono w-14 text-center">{formatTime12(day.open)}</span>
                                                <span className="text-slate-600">-</span>
                                                <input type="time" className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white w-24" value={day.close} onChange={e => updateScheduleDay(idx, 'close', e.target.value)} />
                                                <span className="text-[10px] text-slate-500 font-mono w-14 text-center">{formatTime12(day.close)}</span>
                                            </div>
                                            <label className="flex items-center gap-1 cursor-pointer select-none">
                                                <input type="checkbox" checked={day.isClosed} onChange={e => updateScheduleDay(idx, 'isClosed', e.target.checked)} className="w-4 h-4 rounded bg-slate-800 border-slate-700 accent-red-500" />
                                                <span className={`text-[10px] uppercase font-bold ${day.isClosed ? 'text-red-500' : 'text-slate-600'}`}>Closed</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Section>

                    <Section title="Amenities" icon="bell-concierge">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                             <InputGroup label="Parking">
                                <StyledSelect value={editingPlace.parking || 'FREE'} onChange={e => setEditingPlace({...editingPlace, parking: e.target.value as any})}>
                                    <option value="FREE">Free</option>
                                    <option value="PAID">Paid</option>
                                    <option value="NONE">None/Street</option>
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label="Best Time">
                                <StyledInput value={editingPlace.bestTimeToVisit || ''} onChange={e => setEditingPlace({...editingPlace, bestTimeToVisit: e.target.value})} placeholder="e.g. Sunset" />
                            </InputGroup>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Toggle label="Restroom" checked={editingPlace.hasRestroom || false} onChange={v => setEditingPlace({...editingPlace, hasRestroom: v})} icon="restroom" />
                            <Toggle label="Showers" checked={editingPlace.hasShowers || false} onChange={v => setEditingPlace({...editingPlace, hasShowers: v})} icon="shower" />
                            <Toggle label="Pet Friendly" checked={editingPlace.isPetFriendly || false} onChange={v => setEditingPlace({...editingPlace, isPetFriendly: v})} icon="dog" />
                            <Toggle label="Handicap" checked={editingPlace.isHandicapAccessible || false} onChange={v => setEditingPlace({...editingPlace, isHandicapAccessible: v})} icon="wheelchair" />
                            <Toggle label="Generator" checked={editingPlace.hasGenerator || false} onChange={v => setEditingPlace({...editingPlace, hasGenerator: v})} icon="bolt" />
                        </div>
                    </Section>

                    <Section title="Vibe & Tips" icon="wand-magic-sparkles">
                        <InputGroup label="Vibe (comma separated)">
                            <StyledInput value={editingPlace.vibe?.join(', ') || ''} onChange={e => setEditingPlace({...editingPlace, vibe: e.target.value.split(',').map(t=>t.trim())})} placeholder="Relaxed, Romantic, Party" />
                        </InputGroup>
                        <InputGroup label="El Veci Tip">
                            <StyledTextArea value={editingPlace.tips || ''} onChange={e => setEditingPlace({...editingPlace, tips: e.target.value})} />
                            <button onClick={handleAiGenerateTip} className="w-full bg-orange-500/20 text-orange-400 border border-orange-500/50 font-bold text-sm py-2 rounded-xl mt-2 flex items-center justify-center gap-2">{t('admin_ai_generate_tip')}</button>
                        </InputGroup>
                    </Section>

                    <Section title="SEO Optimization" icon="magnifying-glass">
                        <div className="flex justify-end mb-2">
                            <button onClick={handleAiGenerateSeo} disabled={isAiGeneratingSeo || !editingPlace.name} className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                                {isAiGeneratingSeo ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-robot"></i>} Generate Meta Tags
                            </button>
                        </div>
                        <InputGroup label="Meta Title">
                            <StyledInput value={editingPlace.metaTitle || ''} onChange={e => setEditingPlace({...editingPlace, metaTitle: e.target.value})} placeholder="SEO Title" />
                        </InputGroup>
                        <InputGroup label="Meta Description">
                            <StyledTextArea value={editingPlace.metaDescription || ''} onChange={e => setEditingPlace({...editingPlace, metaDescription: e.target.value})} placeholder="SEO Description" className="min-h-[80px]" />
                        </InputGroup>
                    </Section>

                    <Section title={t('admin_ai_marketing_studio')} icon="bullhorn">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <InputGroup label={t('admin_platform')}>
                                <StyledSelect value={marketingPlatform} onChange={e => setMarketingPlatform(e.target.value as any)}>
                                    <option value="instagram">Instagram</option>
                                    <option value="radio">Radio Script</option>
                                    <option value="email">Email Blast</option>
                                    <option value="campaign_bundle">Campaign Bundle</option>
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label={t('admin_tone')}>
                                <StyledSelect value={marketingTone} onChange={e => setMarketingTone(e.target.value as any)}>
                                    <option value="hype">🔥 {t('admin_tone_hype')}</option>
                                    <option value="chill">🌴 {t('admin_tone_chill')}</option>
                                    <option value="professional">💼 {t('admin_tone_professional')}</option>
                                </StyledSelect>
                            </InputGroup>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <button onClick={handleGenerateMarketing} disabled={isGeneratingMarketing || !editingPlace.name} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">{isGeneratingMarketing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} {t('admin_generate_copy')}</button>
                            <button onClick={handleGenerateSocialCard} disabled={isGeneratingCard || !editingPlace.name || !editingPlace.imageUrl} className="w-full bg-slate-700 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-slate-600">
                                {isGeneratingCard ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-image"></i>} Generate Image
                            </button>
                        </div>
                        
                        {marketingResult && <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 relative group"><textarea className="w-full bg-transparent text-slate-300 text-sm h-32 outline-none resize-none font-mono" value={marketingResult} readOnly /><button onClick={() => { navigator.clipboard.writeText(marketingResult); showToast(t('copied'), 'success'); }} className="absolute top-2 right-2 bg-slate-800 text-slate-400 hover:text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-regular fa-copy"></i></button></div>}
                        
                        {editingPlace && <SocialCardTemplate ref={socialCardRef} place={editingPlace} />}
                    </Section>
                    <div className="h-12"></div>
                </div>
            )}

            {/* EVENT EDITOR */}
            {activeTab === 'events' && editingEvent && (
                <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-bold text-white text-lg">Event Editor</span>
                        {editingEvent.id && (
                            <button onClick={() => handleDeleteEvent(editingEvent.id!)} className="text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors">
                                <i className="fa-solid fa-trash"></i>
                            </button>
                        )}
                    </div>
                    <Section title="Event Details" icon="calendar">
                        <InputGroup label="Title"><StyledInput value={editingEvent.title || ''} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Start Time"><StyledInput type="datetime-local" value={editingEvent.startTime ? new Date(editingEvent.startTime).toISOString().slice(0,16) : ''} onChange={e => setEditingEvent({...editingEvent, startTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                            <InputGroup label="End Time"><StyledInput type="datetime-local" value={editingEvent.endTime ? new Date(editingEvent.endTime).toISOString().slice(0,16) : ''} onChange={e => setEditingEvent({...editingEvent, endTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                        </div>
                        <InputGroup label="Location"><StyledInput value={editingEvent.locationName || ''} onChange={e => setEditingEvent({...editingEvent, locationName: e.target.value})} /></InputGroup>
                        <InputGroup label="Description"><StyledTextArea value={editingEvent.description || ''} onChange={e => setEditingEvent({...editingEvent, description: e.target.value})} /></InputGroup>
                    </Section>
                </div>
            )}

            {/* PERSON EDITOR */}
            {activeTab === 'people' && editingPerson && (
                <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-bold text-white text-lg">Person Editor</span>
                        {editingPerson.id && (
                            <button onClick={() => handleDeletePerson(editingPerson.id!)} className="text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors">
                                <i className="fa-solid fa-trash"></i>
                            </button>
                        )}
                    </div>
                    <Section title="Basic Info" icon="user">
                        <InputGroup label="Name"><StyledInput value={editingPerson.name || ''} onChange={e => setEditingPerson({...editingPerson, name: e.target.value})} /></InputGroup>
                        <InputGroup label="Role / Title"><StyledInput value={editingPerson.role || ''} onChange={e => setEditingPerson({...editingPerson, role: e.target.value})} placeholder="e.g. Mayor, Historic Figure" /></InputGroup>
                        <InputGroup label="Years"><StyledInput value={editingPerson.years || ''} onChange={e => setEditingPerson({...editingPerson, years: e.target.value})} placeholder="e.g. 1920-1990" /></InputGroup>
                        <InputGroup label="Biography"><StyledTextArea value={editingPerson.bio || ''} onChange={e => setEditingPerson({...editingPerson, bio: e.target.value})} /></InputGroup>
                    </Section>
                    
                    <Section title="Media" icon="image">
                        <InputGroup label="Image URL">
                            <div className="flex gap-2">
                                <StyledInput value={editingPerson.imageUrl || ''} onChange={e => setEditingPerson({...editingPerson, imageUrl: e.target.value})} />
                                <button onClick={() => fileInputRef.current?.click()} className="bg-slate-700 text-white px-4 rounded-xl flex items-center justify-center min-w-[50px] hover:bg-slate-600 transition-colors">
                                    <i className="fa-solid fa-upload"></i>
                                </button>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </InputGroup>
                        {editingPerson.imageUrl && <img src={editingPerson.imageUrl} alt="Preview" className="w-32 h-32 object-cover rounded-xl mt-2 border border-slate-700" />}
                    </Section>

                    <Section title="Link to Place" icon="map-pin">
                        <InputGroup label="Associated Place">
                            <StyledSelect value={editingPerson.placeId || ''} onChange={e => setEditingPerson({...editingPerson, placeId: e.target.value || undefined})}>
                                <option value="">-- None --</option>
                                {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </StyledSelect>
                        </InputGroup>
                    </Section>
                </div>
            )}

            {/* CATEGORY EDITOR */}
            {activeTab === 'categories' && editingCategory && (
                <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-bold text-white text-lg">Category Editor</span>
                        {editingCategory.id && (
                            <button onClick={() => handleDeleteCategory(editingCategory.id!)} className="text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors">
                                <i className="fa-solid fa-trash"></i>
                            </button>
                        )}
                    </div>
                    <Section title="Settings" icon="sliders">
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="ID (Key)"><StyledInput value={editingCategory.id || ''} onChange={e => setEditingCategory({...editingCategory, id: e.target.value.toUpperCase()})} /></InputGroup>
                            <InputGroup label="Color"><StyledInput type="color" value={editingCategory.color || '#000000'} onChange={e => setEditingCategory({...editingCategory, color: e.target.value})} className="h-12 p-1" /></InputGroup>
                        </div>
                        <InputGroup label="Label (ES)"><StyledInput value={editingCategory.label_es || ''} onChange={e => setEditingCategory({...editingCategory, label_es: e.target.value})} /></InputGroup>
                        <InputGroup label="Label (EN)"><StyledInput value={editingCategory.label_en || ''} onChange={e => setEditingCategory({...editingCategory, label_en: e.target.value})} /></InputGroup>
                        <InputGroup label="FontAwesome Icon (no fa- prefix)"><StyledInput value={editingCategory.icon || ''} onChange={e => setEditingCategory({...editingCategory, icon: e.target.value})} /></InputGroup>
                    </Section>
                </div>
            )}

            {/* LOGS VIEWER */}
            {activeTab === 'logs' && (
                <div className="p-4 max-w-5xl mx-auto h-full overflow-y-auto">
                    <h2 className="text-2xl font-bold text-white mb-4">System Logs</h2>
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">Time</th>
                                    <th className="px-6 py-3">Action</th>
                                    <th className="px-6 py-3">Target</th>
                                    <th className="px-6 py-3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${log.action === 'DELETE' ? 'bg-red-900/30 text-red-400' : log.action === 'CREATE' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>{log.action}</span></td>
                                        <td className="px-6 py-4 font-bold text-white">{log.place_name}</td>
                                        <td className="px-6 py-4 text-xs text-slate-400 truncate max-w-xs">{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* INSIGHTS DASHBOARD */}
            {activeTab === 'insights' && (
                <div className="p-4 max-w-5xl mx-auto h-full overflow-y-auto">
                    <h2 className="text-2xl font-bold text-white mb-6">AI Insights & Trends</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                            <h3 className="text-lg font-bold text-teal-400 mb-4 flex items-center gap-2"><i className="fa-solid fa-magnifying-glass-chart"></i> Top User Searches</h3>
                            <div className="space-y-3">
                                {topSearches.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-slate-300 capitalize">{s.term}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-teal-500" style={{ width: `${Math.min((s.count / (topSearches[0]?.count || 1)) * 100, 100)}%` }}></div>
                                            </div>
                                            <span className="text-xs font-mono text-slate-500">{s.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-900/40 to-slate-800 p-6 rounded-2xl border border-purple-500/30">
                            <h3 className="text-lg font-bold text-purple-400 mb-2 flex items-center gap-2"><i className="fa-solid fa-brain"></i> Demand Analysis</h3>
                            {demandAnalysis ? (
                                <div className="space-y-4">
                                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10">
                                        <p className="text-xs text-purple-300 font-bold uppercase mb-1">Recommendation</p>
                                        <p className="text-sm text-slate-200">{demandAnalysis.recommendation}</p>
                                    </div>
                                    <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10">
                                        <p className="text-xs text-purple-300 font-bold uppercase mb-1">Content Gaps</p>
                                        <ul className="space-y-2">
                                            {demandAnalysis.content_gaps.map((gap, i) => (
                                                <li key={i} className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-300">{gap.gap}</span>
                                                    <span className={`px-2 py-0.5 rounded ${gap.urgency === 'HIGH' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{gap.urgency}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-500">
                                    <p>No analysis yet.</p>
                                    <button onClick={() => analyzeUserDemand(topSearches.map(s => s.term), categories.map(c => c.id))} className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Run Analysis</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* EMPTY STATE */}
            {!editingPlace && !editingEvent && !editingCategory && !editingPerson && !['logs','insights'].includes(activeTab) && !bulkMode && (
                <div className="text-center text-slate-500 opacity-50"><i className="fa-solid fa-hand-pointer text-4xl mb-4"></i><p>{t('admin_select_item')}</p></div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
