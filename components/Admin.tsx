
// ... existing imports
import React, { useState, useEffect, useRef } from 'react';
import { Place, Event, PlaceCategory, ParkingStatus, EventCategory, AdminLog, DaySchedule, Category, InsightSnapshot } from '../types';
import { updatePlace, deletePlace, createPlace, updateEvent, deleteEvent, createEvent, getAdminLogs, uploadImage, loginAdmin, checkSession, createCategory, updateCategory, deleteCategory, saveInsightSnapshot, getLatestInsights } from '../services/supabase';
import { generateMarketingCopy, categorizeAndTagPlace, enhanceDescription, generateElVeciTip, generateImageAltText, generateSeoMetaTags, analyzeUserDemand, parsePlaceFromRawText, parseBulkPlaces } from '../services/aiService'; 
import { fetchPlaceDetails, autocompletePlace } from '../services/placesService';
import { useLanguage } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import { DEFAULT_PLACE_ZOOM, DEFAULT_CATEGORIES } from '../constants';

interface AdminProps {
  onClose: () => void;
  places: Place[];
  events: Event[];
  categories?: Category[]; // Passed from parent
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

// --- MAIN COMPONENT ---

const Admin: React.FC<AdminProps> = ({ onClose, places, events, categories = [], onUpdate }) => {
  const { t } = useLanguage();

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // App State
  const [activeTab, setActiveTab] = useState<'inbox' | 'places' | 'events' | 'logs' | 'insights' | 'categories'>('places');
  const [editingPlace, setEditingPlace] = useState<Partial<Place> | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // New state for Google Sync
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  
  // Safe JSON Editing State
  const [jsonString, setJsonString] = useState('');

  // Smart Import State
  const [importQuery, setImportQuery] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [magicParsing, setMagicParsing] = useState(false); 
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const autocompleteTimeoutRef = useRef<number | null>(null);

  // Bulk Import State
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkType, setBulkType] = useState<'ai_magic' | 'scout' | 'json'>('ai_magic');
  const [bulkLogs, setBulkLogs] = useState<{status: 'success'|'error'|'pending', msg: string}[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // AI Content Generation States
  const [isAiGeneratingCategoryTags, setIsAiGeneratingCategoryTags] = useState(false);
  const [isAiEnhancingDescription, setIsAiEnhancingDescription] = useState(false);
  const [isAiGeneratingTip, setIsAiGeneratingTip] = useState(false);
  const [isAiGeneratingAltText, setIsAiGeneratingAltText] = useState(false);
  const [isAiGeneratingSeo, setIsAiGeneratingSeo] = useState(false);

  // Insights & Analytics State
  const [userLogs, setUserLogs] = useState<AdminLog[]>([]);
  const [systemLogs, setSystemLogs] = useState<AdminLog[]>([]);
  const [topSearches, setTopSearches] = useState<{term: string, count: number}[]>([]);
  const [demandAnalysis, setDemandAnalysis] = useState<InsightSnapshot | null>(null);
  const [insightHistory, setInsightHistory] = useState<InsightSnapshot[]>([]);
  const [isAnalyzingDemand, setIsAnalyzingDemand] = useState(false);


  // Marketing State
  const [marketingPlatform, setMarketingPlatform] = useState<'instagram' | 'radio' | 'email' | 'campaign_bundle'>('instagram'); 
  const [marketingTone, setMarketingTone] = useState<'hype' | 'chill' | 'professional'>('hype');
  const [marketingResult, setMarketingResult] = useState('');
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- FILTER LISTS (Enhanced for Inbox) ---
  const pendingPlaces = places.filter(p => p.status === 'pending');
  const filteredPlaces = places.filter(p => 
      p.status !== 'pending' && 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredEvents = events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Check Session on Mount
  useEffect(() => {
      checkSession().then(hasSession => {
          if (hasSession) setIsAuthenticated(true);
          setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    if ((activeTab === 'logs' || activeTab === 'insights') && isAuthenticated) {
      // Fetch more logs for insights to get better statistical data
      const limit = activeTab === 'insights' ? 500 : 50;
      getAdminLogs(limit).then(fetchedLogs => {
          setLogs(fetchedLogs);
          // Partition Logs
          const uLogs = fetchedLogs.filter(l => ['USER_SEARCH', 'USER_CHAT'].includes(l.action));
          const sLogs = fetchedLogs.filter(l => !['USER_SEARCH', 'USER_CHAT'].includes(l.action));
          setUserLogs(uLogs);
          setSystemLogs(sLogs);
          // Calculate Top Searches
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

      // Load Historical Insights
      if (activeTab === 'insights') {
          getLatestInsights().then(history => {
              if (history.length > 0) {
                  setInsightHistory(history);
                  setDemandAnalysis(history[0]); // Load most recent by default
              }
          });
      }
    }
  }, [activeTab, isAuthenticated]);
  
  // Sync JSON string state when place changes
  useEffect(() => {
    if (editingPlace) {
        setJsonString(JSON.stringify(editingPlace.contact_info || {}, null, 2));
    }
  }, [editingPlace?.id]);

  // Handle autocomplete input
  useEffect(() => {
    if (autocompleteTimeoutRef.current) clearTimeout(autocompleteTimeoutRef.current);
    if (importQuery.length > 2) {
      autocompleteTimeoutRef.current = window.setTimeout(async () => {
        try {
          const suggestions = await autocompletePlace(importQuery);
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
  }, [importQuery]);


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

  // --- GOOGLE SYNC HANDLER ---
  const handleGoogleSync = async () => {
      if (!editingPlace?.id) return showToast("Save place first to get an ID.", 'error');
      
      setIsSyncing(true);
      let gId = '';

      // 1. Try URL Extraction
      if (editingPlace.gmapsUrl && editingPlace.gmapsUrl.includes('place_id:')) {
          gId = editingPlace.gmapsUrl.split('place_id:')[1].split('&')[0];
      }

      // 2. Fallback: Search by Name if URL failed
      if (!gId && editingPlace.name) {
          try {
              const suggestions = await autocompletePlace(editingPlace.name);
              if (suggestions.length > 0) {
                  gId = suggestions[0].place_id;
              }
          } catch(e) { console.error(e); }
      }

      if (!gId) {
          setIsSyncing(false);
          return showToast("Cannot sync: Google Place ID not found via URL or Name.", 'error');
      }

      try {
          const res = await fetch('/api/sync-place', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ placeId: editingPlace.id, googlePlaceId: gId })
          });
          const data = await res.json();
          
          if (res.ok) {
              const updates = data.data;
              const newCoords = (updates.lat && updates.lon) ? { lat: updates.lat, lng: updates.lon } : editingPlace.coords;
              
              setEditingPlace(prev => ({
                  ...prev,
                  address: updates.address,
                  phone: updates.phone,
                  website: updates.website,
                  status: updates.status,
                  rating: updates.rating,
                  priceLevel: updates.price_level, // Map snake to camel
                  coords: newCoords,
                  // Ensure we save the resolved URL format for next time so it's faster
                  gmapsUrl: `https://www.google.com/maps/place/?q=place_id:${gId}` 
              }));
              showToast("Sync Successful! Data updated.", 'success');
              onUpdate(); 
          } else {
              showToast(data.error || "Sync Failed", 'error');
          }
      } catch (e: any) {
          showToast(e.message || "Network Error during Sync", 'error');
      } finally {
          setIsSyncing(false);
      }
  };

  const handleSavePlace = async (autoApprove: boolean = false) => {
    if (!editingPlace || !editingPlace.name) return showToast(t('admin_name_required'), 'error');
    
    // Coordinate Validation
    if (editingPlace.coords?.lat !== undefined && editingPlace.coords?.lat !== null) {
        if (editingPlace.coords.lat > 90 || editingPlace.coords.lat < -90) return showToast(t('admin_invalid_latitude'), 'error');
    }
    if (editingPlace.coords?.lng !== undefined && editingPlace.coords?.lng !== null) {
        if (editingPlace.coords.lng > 180 || editingPlace.coords.lng < -180) return showToast(t('admin_invalid_longitude'), 'error');
    }

    try {
        const parsed = JSON.parse(jsonString);
        editingPlace.contact_info = parsed;
    } catch (e) {
        return showToast(t('admin_invalid_json'), 'error');
    }

    if (autoApprove) {
        editingPlace.status = 'open';
        editingPlace.isVerified = true;
    }

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
      showToast(t('admin_saved_successfully'), 'success');
      setEditingPlace(null);
    } catch (e: any) {
      showToast(e.message || t('admin_error_saving'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ... (Bulk Import, Delete Place, Category, Event handlers remain unchanged)
  // ... (Copy pasting all previous logic to maintain context)
  const handleBulkImport = async () => {
      setIsBulkProcessing(true);
      setBulkLogs([]);
      const rawInput = bulkInput.trim();
      
      if (!rawInput) {
          setIsBulkProcessing(false);
          return showToast("Input cannot be empty", 'error');
      }

      if (bulkType === 'ai_magic') {
          setBulkLogs([{ status: 'pending', msg: '✨ AI is analyzing list...' }]);
          try {
              const aiPlaces = await parseBulkPlaces(rawInput);
              if (!Array.isArray(aiPlaces) || aiPlaces.length === 0) {
                  throw new Error("AI could not extract places from text.");
              }
              for (const place of aiPlaces) {
                  setBulkLogs(prev => [...prev, { status: 'pending', msg: `Scouting: ${place.name}...` }]);
                  let payload = { ...place, status: 'pending', isVerified: false, sponsor_weight: 0 } as Partial<Place>;
                  try {
                      const googleData = await fetchPlaceDetails(place.name);
                      if (googleData) {
                          payload = {
                              ...payload,
                              ...googleData,
                              description: (googleData.description && googleData.description.length > 10) ? googleData.description : place.description,
                              tags: Array.from(new Set([...(place.tags || []), ...(googleData.tags || [])])),
                              status: 'pending'
                          };
                          setBulkLogs(prev => [...prev, { status: 'success', msg: `   -> Found real data & photo for ${place.name}` }]);
                      } else {
                          setBulkLogs(prev => [...prev, { status: 'error', msg: `   -> Google Scout came up empty for ${place.name}` }]);
                      }
                  } catch (e) { console.warn("Scout failed for", place.name, e); }
                  
                  const res = await createPlace(payload);
                  if (res.success) {
                      setBulkLogs(prev => [...prev, { status: 'success', msg: `✅ Added: ${place.name}` }]);
                  } else {
                      setBulkLogs(prev => [...prev, { status: 'error', msg: `❌ Failed DB Save: ${place.name} - ${res.error}` }]);
                  }
                  await new Promise(r => setTimeout(r, 500));
              }
          } catch (e: any) {
              setBulkLogs(prev => [...prev, { status: 'error', msg: `CRITICAL: ${e.message}` }]);
          }
      } else if (bulkType === 'scout') {
          const lines = rawInput.split('\n').filter(line => line.trim() !== '');
          for (const query of lines) {
              setBulkLogs(prev => [...prev, { status: 'pending', msg: `Scouting: ${query}...` }]);
              try {
                  const details = await fetchPlaceDetails(query);
                  if (details && details.name) {
                      const res = await createPlace({ ...details, status: 'open', isVerified: true, sponsor_weight: 0, tags: ['Batch Scout', ...(details.tags || [])] });
                      if (res.success) {
                          setBulkLogs(prev => [...prev, { status: 'success', msg: `✅ Saved: ${details.name}` }]);
                      } else {
                          setBulkLogs(prev => [...prev, { status: 'error', msg: `❌ DB Error: ${query} - ${res.error}` }]);
                      }
                  } else {
                      setBulkLogs(prev => [...prev, { status: 'error', msg: `❌ Not Found: ${query}` }]);
                  }
                  await new Promise(r => setTimeout(r, 1000));
              } catch (e: any) {
                  setBulkLogs(prev => [...prev, { status: 'error', msg: `❌ Error: ${query} - ${e.message}` }]);
              }
          }
      } else {
          try {
              const data = JSON.parse(rawInput);
              if (!Array.isArray(data)) throw new Error("Input must be a JSON Array");
              for (const place of data) {
                  setBulkLogs(prev => [...prev, { status: 'pending', msg: `Processing: ${place.name || 'Unknown'}...` }]);
                  const payload = { ...place, status: place.status || 'open', category: place.category || 'SERVICE', isVerified: true };
                  const res = await createPlace(payload);
                  if (res.success) setBulkLogs(prev => [...prev, { status: 'success', msg: `✅ Imported: ${payload.name}` }]);
                  else setBulkLogs(prev => [...prev, { status: 'error', msg: `❌ Failed: ${payload.name} - ${res.error}` }]);
              }
          } catch (e: any) {
              setBulkLogs(prev => [...prev, { status: 'error', msg: `CRITICAL: Invalid JSON - ${e.message}` }]);
          }
      }
      await onUpdate();
      setIsBulkProcessing(false);
  };

  const handleDeletePlace = async (id: string) => {
    if (confirm(t('admin_confirm_delete_place'))) {
      setIsSaving(true);
      try {
        const res = await deletePlace(id);
        if (res.success) {
          setEditingPlace(null);
          await onUpdate();
          showToast(t('admin_place_deleted'), 'success');
        } else {
          showToast(res.error || t('admin_failed_to_delete'), 'error');
        }
      } catch (e) {
        showToast(t('admin_unexpected_delete_error'), 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSaveCategory = async () => {
      if (!editingCategory?.id || !editingCategory.label_en) return showToast("ID and English Label required", 'error');
      setIsSaving(true);
      try {
          const isUpdate = categories.some(c => c.id === editingCategory.id);
          if (isUpdate) {
              await updateCategory(editingCategory.id, editingCategory);
          } else {
              await createCategory(editingCategory as Category);
          }
          await onUpdate();
          setEditingCategory(null);
          showToast("Category Saved", 'success');
      } catch(e: any) {
          showToast(e.message || "Error saving category", 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeleteCategory = async (id: string) => {
      if (confirm("Delete Category? This might break places using it.")) {
          setIsSaving(true);
          try {
              await deleteCategory(id);
              await onUpdate();
              setEditingCategory(null);
              showToast("Category Deleted", 'success');
          } catch(e: any) {
              showToast(e.message, 'error');
          } finally {
              setIsSaving(false);
          }
      }
  };

  const handleSeedCategories = async () => {
      if (!confirm("Add default categories to database? Existing IDs won't be duplicated.")) return;
      setIsBulkProcessing(true);
      try {
          for (const cat of DEFAULT_CATEGORIES) {
              const exists = categories.find(c => c.id === cat.id);
              if (!exists) {
                  await createCategory(cat);
              }
          }
          await onUpdate();
          showToast("Categories Initialized!", 'success');
      } catch (e: any) {
          showToast("Seed failed: " + e.message, 'error');
      } finally {
          setIsBulkProcessing(false);
      }
  };

  const handleSaveEvent = async () => {
      if (!editingEvent || !editingEvent.title) return showToast(t('admin_title_required'), 'error');
      if (editingEvent.startTime && editingEvent.endTime && new Date(editingEvent.endTime) <= new Date(editingEvent.startTime)) {
          return showToast(t('admin_end_time_after_start'), 'error');
      }
      setIsSaving(true);
      try {
          if (editingEvent.id) await updateEvent(editingEvent.id, editingEvent);
          else await createEvent(editingEvent);
          await onUpdate();
          setEditingEvent(null);
          showToast(t('admin_event_saved'), 'success');
      } catch (e: any) { showToast(e.message, 'error'); } finally { setIsSaving(false); }
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm(t('admin_confirm_delete_event'))) {
      setIsSaving(true);
      try {
        const res = await deleteEvent(id);
        if (res.success) { setEditingEvent(null); await onUpdate(); showToast(t('admin_event_deleted'), 'success'); }
        else showToast(res.error || 'Failed', 'error');
      } finally { setIsSaving(false); }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      const res = await uploadImage(file);
      setIsUploading(false);
      if (res.success && res.url) {
          if ((activeTab === 'places' || activeTab === 'inbox') && editingPlace) {
              setEditingPlace({ ...editingPlace, imageUrl: res.url });
          } else if (activeTab === 'events' && editingEvent) {
              setEditingEvent({ ...editingEvent, imageUrl: res.url });
          }
          showToast(t('admin_image_uploaded'), 'success');
      } else {
          showToast(res.error || t('admin_upload_failed'), 'error');
      }
  };

  // ... (AI Helpers same as before)
  const handleSmartImport = async (queryOrPlaceId: string) => {
      if (!queryOrPlaceId) return showToast(t('admin_enter_name_or_link'), 'error');
      setImportLoading(true);
      setAutocompleteSuggestions([]); 
      try {
          const details = await fetchPlaceDetails(queryOrPlaceId);
          if (details) {
              setEditingPlace(prev => ({
                  ...prev, ...details, id: prev?.id, status: prev?.status || 'open',
                  imageUrl: details.imageUrl || prev?.imageUrl || '',
                  gmapsUrl: details.gmapsUrl || prev?.gmapsUrl || ''
              }));
              showToast(t('admin_import_successful'), 'success');
              setImportQuery('');
          } else { showToast(t('admin_could_not_find_details'), 'error'); }
      } catch (e: any) { showToast(e.message || t('admin_import_failed'), 'error'); } finally { setImportLoading(false); }
  };

  const handleMagicParse = async () => {
      if (!importQuery || importQuery.length < 5) return showToast("Paste some text first (at least 5 chars).", 'error');
      setMagicParsing(true);
      try {
          const parsed = await parsePlaceFromRawText(importQuery);
          if (parsed && parsed.name) {
              setEditingPlace(prev => ({ ...prev, ...parsed, id: prev?.id, status: prev?.status || 'open', imageUrl: prev?.imageUrl || '', category: Object.values(PlaceCategory).includes(parsed.category) ? parsed.category : PlaceCategory.SERVICE }));
              showToast("Magic Parse Successful!", 'success');
              setImportQuery('');
          } else { showToast("AI couldn't understand the text.", 'error'); }
      } catch (e) { showToast("AI Parse Failed", 'error'); } finally { setMagicParsing(false); }
  };

  const handleGenerateMarketing = async () => {
      if (!editingPlace?.name) return showToast(t('admin_need_name_first'), 'error');
      setIsGeneratingMarketing(true);
      const copy = await generateMarketingCopy(editingPlace.name, marketingPlatform, marketingTone);
      setMarketingResult(copy);
      setIsGeneratingMarketing(false);
  };

  const handleAiSuggestCategoryAndTags = async () => {
      if (!editingPlace?.name || !editingPlace.description) return showToast("Need name and description.", 'error');
      setIsAiGeneratingCategoryTags(true);
      try {
          const result = await categorizeAndTagPlace(editingPlace.name, editingPlace.description);
          if (result) { setEditingPlace(prev => ({ ...prev, category: result.category, tags: result.tags })); showToast(t('admin_ai_suggest_category_tags_success'), 'success'); }
          else showToast(t('admin_ai_suggest_category_tags_fail'), 'error');
      } catch (e) { showToast(t('admin_ai_suggest_category_tags_error'), 'error'); } finally { setIsAiGeneratingCategoryTags(false); }
  };

  const handleAiEnhanceDescription = async () => {
      if (!editingPlace?.name || !editingPlace.description) return showToast("Need name and description.", 'error');
      setIsAiEnhancingDescription(true);
      try {
          const result = await enhanceDescription(editingPlace.name, editingPlace.description);
          if (result) { setEditingPlace(prev => ({ ...prev, description: result })); showToast(t('admin_ai_enhance_description_success'), 'success'); }
      } catch (e) { showToast(t('admin_ai_enhance_description_error'), 'error'); } finally { setIsAiEnhancingDescription(false); }
  };

  const handleAiGenerateTip = async () => {
      if (!editingPlace?.name || !editingPlace.description || !editingPlace.category) return showToast("Need info for tip.", 'error');
      setIsAiGeneratingTip(true);
      try {
          const result = await generateElVeciTip(editingPlace.name, editingPlace.category, editingPlace.description);
          if (result) { setEditingPlace(prev => ({ ...prev, tips: result })); showToast(t('admin_ai_generate_tip_success'), 'success'); }
      } catch (e) { showToast(t('admin_ai_generate_tip_error'), 'error'); } finally { setIsAiGeneratingTip(false); }
  };

  const handleAiGenerateAltText = async () => {
    if (!editingPlace?.imageUrl) return showToast("Need image URL.", 'error');
    setIsAiGeneratingAltText(true);
    try {
        const result = await generateImageAltText(editingPlace.imageUrl);
        if (result) { setEditingPlace(prev => ({ ...prev, imageAlt: result })); showToast(t('admin_ai_generate_alt_text_success'), 'success'); }
    } catch (e) { showToast(t('admin_ai_generate_alt_text_error'), 'error'); } finally { setIsAiGeneratingAltText(false); }
  };

  const handleAiGenerateSeo = async () => {
    if (!editingPlace?.name || !editingPlace.description) return showToast("Need name/desc.", 'error');
    setIsAiGeneratingSeo(true);
    try {
        const result = await generateSeoMetaTags(editingPlace.name, editingPlace.description, editingPlace.category || 'General');
        if (result) { setEditingPlace(prev => ({ ...prev, metaTitle: result.metaTitle, metaDescription: result.metaDescription })); showToast(t('admin_ai_generate_seo_success'), 'success'); }
    } catch (e) { showToast(t('admin_ai_generate_seo_error'), 'error'); } finally { setIsAiGeneratingSeo(false); }
  };

  const handleAnalyzeDemand = async () => {
      setIsAnalyzingDemand(true);
      try {
          const queries = userLogs.map(l => l.place_name || l.details);
          const currentCategories = Object.values(PlaceCategory);
          const analysis = await analyzeUserDemand(queries, currentCategories);
          setDemandAnalysis(analysis);
          setInsightHistory(prev => [analysis, ...prev]);
          await saveInsightSnapshot(analysis);
          showToast("Strategic Analysis Complete & Saved", 'success');
      } catch (e) { showToast("Analysis Failed", 'error'); } finally { setIsAnalyzingDemand(false); }
  };

  const handleExportLogs = () => {
      if (logs.length === 0) return showToast("No logs to export", 'error');
      const headers = ["ID", "Time", "Action", "Place/Search Term", "Details"];
      const rows = logs.map(l => [
          l.id,
          new Date(l.created_at).toLocaleString(),
          l.action,
          `"${l.place_name.replace(/"/g, '""')}"`,
          `"${l.details.replace(/"/g, '""')}"`
      ]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `admin_logs_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const getStructuredHours = (): DaySchedule[] => {
      if (editingPlace?.opening_hours?.structured && editingPlace.opening_hours.structured.length === 7) {
          return editingPlace.opening_hours.structured;
      }
      return Array(7).fill(null).map((_, i) => ({ day: i, open: '09:00', close: '17:00', isClosed: false }));
  };

  const updateScheduleDay = (idx: number, field: keyof DaySchedule, val: any) => {
      const current = getStructuredHours();
      current[idx] = { ...current[idx], [field]: val };
      setEditingPlace({ ...editingPlace, opening_hours: { ...(editingPlace?.opening_hours || {}), structured: current } });
  };

  const applyMonToFri = () => {
      const current = getStructuredHours();
      const monday = current[1]; 
      const newSchedule = current.map((d, i) => {
          if (i >= 1 && i <= 5) return { ...d, open: monday.open, close: monday.close, isClosed: monday.isClosed };
          return d;
      });
      setEditingPlace({ ...editingPlace, opening_hours: { ...(editingPlace?.opening_hours || {}), structured: newSchedule } });
      showToast(t('admin_applied_mon_to_fri' as keyof typeof translations.es), 'success');
  };

  // ... (Login Screen Logic unchanged)
  if (!isAuthenticated) {
      return (
        <div className="fixed inset-0 bg-slate-900 z-[5000] flex flex-col items-center justify-center p-6 animate-fade-in font-sans text-slate-200">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
            <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white"><i className="fa-solid fa-xmark text-2xl"></i></button>
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-xl"><i className="fa-solid fa-lock text-3xl text-teal-500"></i></div>
                    <h1 className="text-2xl font-black text-white">{t('admin_access_title')}</h1>
                </div>
                <div className="space-y-4">
                    <input type="email" placeholder={t('admin_email_placeholder')} value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-teal-500 transition-colors" />
                    <input type="password" placeholder={t('admin_password_placeholder')} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-teal-500 transition-colors" />
                    <button onClick={handleLogin} disabled={authLoading} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">{authLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : t('admin_login_button')}</button>
                </div>
            </div>
        </div>
      );
  }

  const isEditing = editingPlace || editingEvent || editingCategory;

  return (
    <div className="fixed inset-0 bg-slate-900 z-[5000] flex flex-col font-sans text-slate-200">
      {/* ... (Header logic unchanged) ... */}
      
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-slate-900 border-b border-slate-700 p-3 flex justify-between items-center shadow-md z-20 h-16 shrink-0">
        {isEditing ? (
            <div className="flex items-center gap-3 w-full">
                <button 
                    onClick={() => { setEditingPlace(null); setEditingEvent(null); setEditingCategory(null); setBulkMode(false); }} 
                    className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 active:bg-slate-700 transition-colors"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('admin_editing')}</h2>
                    <p className="text-white font-bold truncate">
                        {editingPlace?.name || editingEvent?.title || editingCategory?.id || t('admin_new_item')}
                    </p>
                </div>
                <button 
                    onClick={() => {
                        if (activeTab === 'categories') handleSaveCategory();
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
        
        {/* SIDEBAR LIST */}
        <div className={`w-full md:w-80 border-r border-slate-700 bg-slate-900 flex flex-col ${isEditing || bulkMode ? 'hidden md:flex' : 'flex'} ${activeTab === 'insights' || activeTab === 'logs' ? 'hidden md:hidden' : ''}`}>
            {/* ... (Sidebar logic unchanged) ... */}
            {activeTab !== 'insights' && activeTab !== 'categories' && activeTab !== 'logs' && (
                <div className="p-4 border-b border-slate-700">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                        <input type="text" placeholder={t('admin_search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:border-teal-500 outline-none" />
                    </div>
                </div>
            )}
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {/* PLACES LIST */}
                {activeTab === 'places' && (
                    <>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingPlace({ name: '', category: 'FOOD', status: 'open', plan: 'free', parking: ParkingStatus.FREE, defaultZoom: DEFAULT_PLACE_ZOOM }); setJsonString('{}'); }} className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-teal-500 hover:text-teal-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-plus text-lg"></i> <span className="text-[10px]">Add New</span></button>
                            <button onClick={() => { setBulkMode(true); setEditingPlace(null); }} className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-700 text-purple-400 hover:border-purple-500 hover:text-purple-500 hover:bg-purple-900/10 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-layer-group text-lg"></i> <span className="text-[10px]">Bulk Ops</span></button>
                        </div>
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
                {/* ... (Categories and Inbox lists unchanged) ... */}
                {activeTab === 'categories' && (
                    <>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingCategory({ id: '', label_en: '', label_es: '', color: '#888888', icon: 'tag' })} className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-teal-500 hover:text-teal-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-plus text-lg"></i> <span className="text-[10px]">New Cat</span></button>
                            <button onClick={handleSeedCategories} className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-700 text-orange-400 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-900/10 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"><i className="fa-solid fa-database text-lg"></i> <span className="text-[10px]">Initialize Defaults</span></button>
                        </div>
                        
                        {categories.map(c => (
                            <div key={c.id} onClick={() => setEditingCategory(c)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${editingCategory?.id === c.id ? 'bg-teal-900/20 border-teal-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                                <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: c.color }}><i className={`fa-solid fa-${c.icon} text-white text-xs`}></i></div>
                                <div>
                                    <h4 className="font-bold text-slate-200 text-sm">{c.label_en}</h4>
                                    <p className="text-xs text-slate-500 font-mono">{c.id}</p>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {activeTab === 'inbox' && pendingPlaces.map(p => (
                    <div key={p.id} onClick={() => setEditingPlace(p)} className="p-4 rounded-xl bg-slate-800 border border-slate-700 mb-2 cursor-pointer hover:bg-slate-700"><h4 className="font-bold text-slate-200">{p.name}</h4><span className="text-xs text-amber-500">Pending Review</span></div>
                ))}
            </div>
        </div>

        {/* EDITOR AREA */}
        <div className={`flex-1 bg-slate-900 overflow-y-auto custom-scrollbar ${isEditing || bulkMode ? 'absolute inset-0 z-10 md:static' : ((activeTab === 'insights' || activeTab === 'logs') ? 'w-full' : 'hidden md:flex flex-col items-center justify-center')}`}>
            
            {activeTab === 'insights' ? (
                // ... (Insights tab logic unchanged) ...
                <div className="p-8 max-w-5xl mx-auto animate-slide-up space-y-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3"><i className="fa-solid fa-chart-line text-teal-500"></i> Strategic Intelligence</h2>
                        <button onClick={handleAnalyzeDemand} disabled={isAnalyzingDemand} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all">{isAnalyzingDemand ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} <span>Run New Analysis</span></button>
                    </div>
                    {/* ... (Charts logic unchanged) ... */}
                </div>
            ) : activeTab === 'logs' ? (
                // ... (Logs tab logic unchanged) ...
                <div className="p-8 max-w-6xl mx-auto animate-slide-up h-full flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3"><i className="fa-solid fa-terminal text-slate-500"></i> System Logs</h2>
                        <button onClick={handleExportLogs} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-2"><i className="fa-solid fa-download"></i> Export CSV</button>
                    </div>
                    {/* ... */}
                </div>
            ) : activeTab === 'categories' && editingCategory ? (
                // ... (Category editor unchanged) ...
                <div className="p-8 max-w-2xl mx-auto animate-slide-up">
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-mono text-xs text-slate-500">{editingCategory.id ? 'EDITING' : 'CREATING'}</span>
                        {editingCategory.id && <button onClick={() => handleDeleteCategory(editingCategory.id!)} className="text-red-500 text-xs font-bold hover:underline">Delete Category</button>}
                    </div>
                    <Section title="Category Details" icon="tag">
                        <InputGroup label="ID (Key)" description="Unique identifier (e.g., 'BEACH', 'FOOD'). UpperCase, no spaces.">
                            <StyledInput value={editingCategory.id || ''} onChange={e => setEditingCategory({...editingCategory, id: e.target.value.toUpperCase().replace(/\s/g, '_')})} disabled={!!categories.find(c => c.id === editingCategory.id && c !== editingCategory)} />
                        </InputGroup>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Label (English)"><StyledInput value={editingCategory.label_en || ''} onChange={e => setEditingCategory({...editingCategory, label_en: e.target.value})} /></InputGroup>
                            <InputGroup label="Label (Spanish)"><StyledInput value={editingCategory.label_es || ''} onChange={e => setEditingCategory({...editingCategory, label_es: e.target.value})} /></InputGroup>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Icon (FontAwesome)"><StyledInput value={editingCategory.icon || ''} onChange={e => setEditingCategory({...editingCategory, icon: e.target.value})} placeholder="umbrella-beach" /></InputGroup>
                            <InputGroup label="Color">
                                <div className="flex gap-2">
                                    <input type="color" value={editingCategory.color || '#000000'} onChange={e => setEditingCategory({...editingCategory, color: e.target.value})} className="h-12 w-12 rounded-xl border-none bg-transparent cursor-pointer" />
                                    <StyledInput value={editingCategory.color || ''} onChange={e => setEditingCategory({...editingCategory, color: e.target.value})} />
                                </div>
                            </InputGroup>
                        </div>
                        <InputGroup label="Sort Order"><StyledInput type="number" value={editingCategory.order_index || 0} onChange={e => setEditingCategory({...editingCategory, order_index: parseInt(e.target.value)})} /></InputGroup>
                    </Section>
                </div>
            ) : (activeTab === 'places' || activeTab === 'inbox') && editingPlace ? (
                // --- RESTORED PLACE EDITOR ---
                <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-mono text-xs text-slate-500">{editingPlace.id || 'NEW RECORD'}</span>
                        <div className="flex items-center gap-3">
                            {editingPlace.id && editingPlace.status !== 'pending' && <button onClick={() => handleDeletePlace(editingPlace.id!)} className="text-red-500 text-xs font-bold hover:bg-red-500/10 px-3 py-1.5 rounded-lg flex items-center gap-2"><i className="fa-solid fa-trash"></i> {t('admin_delete_record')}</button>}
                            
                            {/* GOOGLE SYNC BUTTON */}
                            {editingPlace.id && (
                                <button 
                                    onClick={handleGoogleSync} 
                                    disabled={isSyncing}
                                    className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/50 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    {isSyncing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-brands fa-google"></i>}
                                    <span>Sync Google Data</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ... (Smart Import Section unchanged) ... */}
                    <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-4 rounded-2xl border border-indigo-500/30 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fa-solid fa-wand-magic-sparkles text-6xl text-white"></i></div>
                        <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-wide mb-3 flex items-center gap-2"><i className="fa-solid fa-bolt text-yellow-400"></i> {t('admin_smart_import')}</h3>
                        <div className="relative z-10 flex flex-col gap-3">
                            <textarea className="w-full bg-slate-900/80 border border-indigo-500/30 rounded-xl px-4 py-3 text-white placeholder:text-indigo-300/50 focus:border-indigo-400 outline-none resize-y min-h-[80px]" placeholder={t('admin_import_placeholder')} value={importQuery} onChange={(e) => setImportQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && autocompleteSuggestions.length > 0) handleSmartImport(autocompleteSuggestions[0].description); }} />
                            <div className="flex gap-2">
                                <button onClick={() => handleSmartImport(importQuery)} disabled={importLoading || !importQuery} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">{importLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-download"></i>} <span>{t('admin_auto_fill')}</span></button>
                                <button onClick={handleMagicParse} disabled={magicParsing || !importQuery} className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">{magicParsing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} <span>Magic Parse</span></button>
                            </div>
                        </div>
                        {autocompleteSuggestions.length > 0 && <ul className="absolute left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl mt-2 max-h-48 overflow-y-auto shadow-lg z-20 mx-4">{autocompleteSuggestions.map((s, index) => <li key={s.place_id} onClick={() => { setImportQuery(s.description); handleSmartImport(s.place_id); }} className="px-4 py-3 text-sm text-white hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-b-0"><span className="font-bold">{s.structured_formatting?.main_text}</span><span className="text-slate-400 block text-xs">{s.structured_formatting?.secondary_text}</span></li>)}</ul>}
                    </div>

                    <Section title={t('admin_basic_info')} icon="circle-info">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup label={t('admin_name')}><StyledInput value={editingPlace.name || ''} onChange={e => setEditingPlace({...editingPlace, name: e.target.value})} /></InputGroup>
                            <InputGroup label="Slug" description="URL-friendly ID"><StyledInput value={editingPlace.slug || ''} onChange={e => setEditingPlace({...editingPlace, slug: e.target.value})} placeholder="auto-generated" /></InputGroup>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup label={t('admin_category')}>
                                <StyledSelect value={editingPlace.category || 'SERVICE'} onChange={e => setEditingPlace({...editingPlace, category: e.target.value})}>
                                    {categories.length > 0 
                                        ? categories.map(c => <option key={c.id} value={c.id}>{c.label_en} ({c.id})</option>)
                                        : DEFAULT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label_en} ({c.id})</option>) // Fallback logic inside render
                                    }
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label={t('admin_icon_name')}><div className="flex gap-2"><StyledInput value={editingPlace.customIcon || ''} onChange={e => setEditingPlace({...editingPlace, customIcon: e.target.value})} placeholder="pizza-slice" /><div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 text-xl shrink-0"><i className={`fa-solid fa-${editingPlace.customIcon || 'icons'}`}></i></div></div></InputGroup>
                        </div>
                        <InputGroup label={t('admin_description')}>
                            <StyledTextArea value={editingPlace.description || ''} onChange={e => setEditingPlace({...editingPlace, description: e.target.value})} />
                            <button onClick={handleAiEnhanceDescription} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-2 rounded-xl mt-2 flex items-center justify-center gap-2">{t('admin_ai_enhance_description')}</button>
                        </InputGroup>
                        <InputGroup label={t('admin_tags')}><StyledInput value={(editingPlace.tags || []).join(', ')} onChange={e => setEditingPlace({...editingPlace, tags: e.target.value.split(',').map(s => s.trim())})} /></InputGroup>
                        <InputGroup label={t('admin_meta_title')} description={t('admin_meta_title_desc')}><StyledInput value={editingPlace.metaTitle || ''} onChange={e => setEditingPlace({...editingPlace, metaTitle: e.target.value})} /></InputGroup>
                        <InputGroup label={t('admin_meta_description')} description={t('admin_meta_description_desc')}><StyledTextArea value={editingPlace.metaDescription || ''} onChange={e => setEditingPlace({...editingPlace, metaDescription: e.target.value})} /></InputGroup>
                    </Section>

                    <Section title="Classification & Vibe" icon="wand-magic-sparkles">
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Price Level">
                                <StyledSelect value={editingPlace.priceLevel || '$'} onChange={e => setEditingPlace({...editingPlace, priceLevel: e.target.value})}>
                                    <option value="$">$ (Cheap)</option>
                                    <option value="$$">$$ (Moderate)</option>
                                    <option value="$$$">$$$ (Expensive)</option>
                                    <option value="FREE">Free</option>
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label="Plan (Tier)">
                                <StyledSelect value={editingPlace.plan || 'free'} onChange={e => setEditingPlace({...editingPlace, plan: e.target.value as any})}>
                                    <option value="free">Free</option>
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </StyledSelect>
                            </InputGroup>
                        </div>
                        <InputGroup label="Crowd Level">
                            <StyledSelect value={editingPlace.crowdLevel || 'MEDIUM'} onChange={e => setEditingPlace({...editingPlace, crowdLevel: e.target.value as any})}>
                                <option value="LOW">Low (Quiet)</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High (Busy)</option>
                            </StyledSelect>
                        </InputGroup>
                        <InputGroup label="Best Time to Visit"><StyledInput value={editingPlace.bestTimeToVisit || ''} onChange={e => setEditingPlace({...editingPlace, bestTimeToVisit: e.target.value})} placeholder="e.g. Sunset, Early Morning" /></InputGroup>
                        <InputGroup label="Vibe (Keywords)" description="Used by AI for matching. Comma separated."><StyledInput value={(editingPlace.vibe || []).join(', ')} onChange={e => setEditingPlace({...editingPlace, vibe: e.target.value.split(',').map(s => s.trim())})} placeholder="Romantic, Chill, Loud, Family" /></InputGroup>
                    </Section>

                    <Section title={t('admin_location')} icon="map-location-dot">
                        <InputGroup label={t('admin_address')}><StyledInput value={editingPlace.address || ''} onChange={e => setEditingPlace({...editingPlace, address: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-2 gap-4">
                             <InputGroup label="Lat"><StyledInput type="number" value={editingPlace.coords?.lat ?? ''} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords!, lat: parseFloat(e.target.value) }})} /></InputGroup>
                             <InputGroup label="Lng"><StyledInput type="number" value={editingPlace.coords?.lng ?? ''} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords!, lng: parseFloat(e.target.value) }})} /></InputGroup>
                        </div>
                        <button onClick={handleGetLocation} className="w-full py-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm flex items-center justify-center gap-2 mt-2 mb-2"><i className="fa-solid fa-location-crosshairs"></i> {t('admin_use_current_location')}</button>
                        <InputGroup label={t('admin_maps_link')}><StyledInput value={editingPlace.gmapsUrl || ''} onChange={e => setEditingPlace({...editingPlace, gmapsUrl: e.target.value})} /></InputGroup>
                        <InputGroup label={t('admin_default_zoom')}><StyledInput type="number" value={editingPlace.defaultZoom ?? ''} onChange={e => setEditingPlace({...editingPlace, defaultZoom: parseInt(e.target.value)})} placeholder="16" /></InputGroup>
                    </Section>

                    <Section title={t('admin_media')} icon="image">
                         <div className="relative w-full aspect-video bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden mb-4" onClick={() => fileInputRef.current?.click()}>
                            {editingPlace.imageUrl ? <img src={editingPlace.imageUrl} className="w-full h-full object-cover" /> : <div className="text-center p-4 text-slate-500"><i className="fa-solid fa-cloud-arrow-up text-3xl mb-2"></i><p className="font-bold">{t('admin_tap_to_upload')}</p></div>}
                            {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        <InputGroup label={t('admin_image_url')}><StyledInput value={editingPlace.imageUrl || ''} onChange={e => setEditingPlace({...editingPlace, imageUrl: e.target.value})} /></InputGroup>
                        <InputGroup label="Video URL"><StyledInput value={editingPlace.videoUrl || ''} onChange={e => setEditingPlace({...editingPlace, videoUrl: e.target.value})} placeholder="YouTube / Vimeo link" /></InputGroup>
                        <InputGroup label={t('admin_image_alt_text')}><StyledTextArea value={editingPlace.imageAlt || ''} onChange={e => setEditingPlace({...editingPlace, imageAlt: e.target.value})} />
                        <button onClick={handleAiGenerateAltText} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-2 rounded-xl mt-2">{t('admin_ai_generate_alt_text')}</button></InputGroup>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                             {['top', 'center', 'bottom'].map(pos => <button key={pos} onClick={() => setEditingPlace({...editingPlace, imagePosition: pos})} className={`py-2 rounded-lg border text-xs font-bold uppercase ${editingPlace.imagePosition === pos ? 'bg-teal-600 border-teal-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>{pos}</button>)}
                        </div>
                    </Section>

                    <Section title={t('admin_details_amenities')} icon="list-check">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Toggle label={t('admin_visible_open')} checked={editingPlace.status === 'open'} onChange={v => setEditingPlace({...editingPlace, status: v ? 'open' : 'closed'})} icon="eye" />
                            <Toggle label={t('admin_verified')} checked={editingPlace.isVerified || false} onChange={v => setEditingPlace({...editingPlace, isVerified: v})} icon="certificate" />
                            <Toggle label={t('admin_featured')} checked={editingPlace.is_featured || false} onChange={v => setEditingPlace({...editingPlace, is_featured: v})} icon="star" />
                            <Toggle label={t('admin_landing_spot')} checked={editingPlace.isLanding || false} onChange={v => setEditingPlace({...editingPlace, isLanding: v})} icon="map-pin" />
                            <Toggle label={t('admin_pet_friendly')} checked={editingPlace.isPetFriendly || false} onChange={v => setEditingPlace({...editingPlace, isPetFriendly: v})} icon="dog" />
                            <Toggle label={t('admin_restrooms')} checked={editingPlace.hasRestroom || false} onChange={v => setEditingPlace({...editingPlace, hasRestroom: v})} icon="restroom" />
                            <Toggle label="Showers" checked={editingPlace.hasShowers || false} onChange={v => setEditingPlace({...editingPlace, hasShowers: v})} icon="shower" />
                            <Toggle label="Accessible" checked={editingPlace.isHandicapAccessible || false} onChange={v => setEditingPlace({...editingPlace, isHandicapAccessible: v})} icon="wheelchair" />
                            <Toggle label={t('admin_generator')} checked={editingPlace.hasGenerator || false} onChange={v => setEditingPlace({...editingPlace, hasGenerator: v})} icon="bolt" />
                            <Toggle label={t('admin_paid_parking')} checked={editingPlace.parking === ParkingStatus.PAID} onChange={v => setEditingPlace({...editingPlace, parking: v ? ParkingStatus.PAID : ParkingStatus.FREE})} icon="square-parking" />
                            <Toggle label="Mobile / Delivery" checked={editingPlace.isMobile || false} onChange={v => setEditingPlace({...editingPlace, isMobile: v})} icon="truck-fast" />
                            <Toggle label="Secret Spot" checked={editingPlace.isSecret || false} onChange={v => setEditingPlace({...editingPlace, isSecret: v})} icon="user-secret" />
                         </div>
                         <div className="mt-4 space-y-4">
                            <InputGroup label="Sponsor Weight (0-100)"><StyledInput type="number" value={editingPlace.sponsor_weight ?? 0} onChange={e => setEditingPlace({...editingPlace, sponsor_weight: parseInt(e.target.value)})} /></InputGroup>
                            <InputGroup label={t('admin_el_veci_tip')}>
                                <StyledTextArea value={editingPlace.tips || ''} onChange={e => setEditingPlace({...editingPlace, tips: e.target.value})} />
                                <button onClick={handleAiGenerateTip} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-2 rounded-xl mt-2">{t('admin_ai_generate_tip')}</button>
                            </InputGroup>
                            <InputGroup label={t('admin_advanced_contact_info')} description={t('admin_advanced_contact_info_desc')}><StyledTextArea className="font-mono text-xs h-24 bg-slate-950 text-emerald-400 border-slate-800" value={jsonString} onChange={e => setJsonString(e.target.value)} placeholder="{}" /></InputGroup>
                         </div>
                    </Section>

                    <Section title={t('admin_operations_hours')} icon="clock">
                        {/* ... (Hours logic unchanged) ... */}
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">{t('admin_hours_strategy')}</label>
                        <div className="bg-slate-900/50 p-1 rounded-xl border border-slate-700 flex mb-4">
                            {['fixed', '24_7', 'sunrise_sunset'].map(type => (
                                <button key={type} onClick={() => setEditingPlace({...editingPlace, opening_hours: { ...(editingPlace.opening_hours || {}), type: type as any } })} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-colors ${editingPlace.opening_hours?.type === type || (!editingPlace.opening_hours?.type && type === 'fixed') ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                                    {type === '24_7' ? '24/7' : type.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        {(!editingPlace.opening_hours?.type || editingPlace.opening_hours?.type === 'fixed') && (
                            <div className="space-y-4">
                                <InputGroup label={t('admin_display_note')}><StyledInput value={editingPlace.opening_hours?.note || ''} onChange={e => setEditingPlace({...editingPlace, opening_hours: { ...editingPlace.opening_hours, note: e.target.value }})} /></InputGroup>
                                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center"><span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{t('admin_weekly_schedule')}</span><button onClick={applyMonToFri} className="text-[10px] bg-teal-600/20 text-teal-400 px-2 py-1 rounded hover:bg-teal-600/30 transition-colors font-bold">{t('admin_apply_mon_to_fri')}</button></div>
                                    {getStructuredHours().map((dayData, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                                            <div className="w-8 text-xs font-bold text-slate-400 uppercase">{DAYS[index]}</div>
                                            <div className="flex-1 flex items-center gap-2">
                                                {!dayData.isClosed ? <><input type="time" value={dayData.open} onChange={e => updateScheduleDay(index, 'open', e.target.value)} className="bg-slate-800 text-white text-sm rounded-lg p-1 border border-slate-600 focus:border-teal-500 outline-none w-24 text-center" /><span className="text-slate-600 font-bold">-</span><input type="time" value={dayData.close} onChange={e => updateScheduleDay(index, 'close', e.target.value)} className="bg-slate-800 text-white text-sm rounded-lg p-1 border border-slate-600 focus:border-teal-500 outline-none w-24 text-center" /></> : <span className="text-xs text-slate-500 italic flex-1 text-center font-medium bg-slate-800/50 py-1.5 rounded-lg">{t('admin_closed')}</span>}
                                            </div>
                                            <button onClick={() => updateScheduleDay(index, 'isClosed', !dayData.isClosed)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dayData.isClosed ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><i className={`fa-solid ${dayData.isClosed ? 'fa-ban' : 'fa-check'}`}></i></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <InputGroup label={t('admin_phone')}><StyledInput type="tel" value={editingPlace.phone || ''} onChange={e => setEditingPlace({...editingPlace, phone: e.target.value})} /></InputGroup>
                        <InputGroup label={t('admin_website')}><StyledInput value={editingPlace.website || ''} onChange={e => setEditingPlace({...editingPlace, website: e.target.value})} /></InputGroup>
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
                        <button onClick={handleGenerateMarketing} disabled={isGeneratingMarketing || !editingPlace.name} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 rounded-xl mb-4 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">{isGeneratingMarketing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} {t('admin_generate_copy')}</button>
                        {marketingResult && <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 relative group"><textarea className="w-full bg-transparent text-slate-300 text-sm h-32 outline-none resize-none font-mono" value={marketingResult} readOnly /><button onClick={() => { navigator.clipboard.writeText(marketingResult); showToast(t('copied'), 'success'); }} className="absolute top-2 right-2 bg-slate-800 text-slate-400 hover:text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-regular fa-copy"></i></button></div>}
                    </Section>
                    <div className="h-12"></div>
                </div>
            ) : bulkMode ? (
                // ... (Bulk Mode logic unchanged) ...
                <div className="p-8 max-w-4xl mx-auto animate-slide-up h-full flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <i className="fa-solid fa-layer-group text-purple-500"></i>
                            Bulk Operations
                        </h2>
                        <button onClick={() => setBulkMode(false)} className="text-slate-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
                        <div className="flex flex-col gap-4">
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Import Mode</label>
                                <div className="flex bg-slate-900 rounded-lg p-1">
                                    <button onClick={() => setBulkType('ai_magic')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${bulkType === 'ai_magic' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>Magic List (AI + Scout)</button>
                                    <button onClick={() => setBulkType('scout')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${bulkType === 'scout' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>Google Scout</button>
                                    <button onClick={() => setBulkType('json')} className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${bulkType === 'json' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>Raw JSON</button>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Input Data</label>
                                <textarea 
                                    className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs font-mono text-emerald-400 outline-none focus:border-purple-500 resize-none" 
                                    placeholder={bulkType === 'json' ? "[ { \"name\": \"Place Name\", ... }, ... ]" : "Paste a raw list of places here...\ne.g.\nTacos Don Rafa\nPlaya Buye\nFarmacia Belmonte"}
                                    value={bulkInput}
                                    onChange={(e) => setBulkInput(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={handleBulkImport} 
                                disabled={isBulkProcessing || !bulkInput}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isBulkProcessing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-play"></i>}
                                <span>Start Processing</span>
                            </button>
                        </div>

                        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-y-auto font-mono text-xs flex flex-col">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 sticky top-0 bg-slate-950 pb-2 border-b border-slate-800">Execution Log</label>
                            <div className="space-y-1">
                                {bulkLogs.length === 0 && <span className="text-slate-600 italic">Ready to process...</span>}
                                {bulkLogs.map((log, i) => (
                                    <div key={i} className={`flex gap-2 ${log.status === 'error' ? 'text-red-400' : log.status === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                        <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                                        <span>{log.msg}</span>
                                    </div>
                                ))}
                                {isBulkProcessing && <div className="text-purple-400 animate-pulse">Processing next item...</div>}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center text-slate-500 opacity-50"><i className="fa-solid fa-hand-pointer text-4xl mb-4"></i><p>{t('admin_select_item')}</p></div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
