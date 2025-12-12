
import React, { useState, useEffect, useRef } from 'react';
import { Place, Event, PlaceCategory, ParkingStatus, EventCategory, AdminLog, DaySchedule } from '../types';
import { updatePlace, deletePlace, createPlace, updateEvent, deleteEvent, createEvent, getAdminLogs, uploadImage, loginAdmin, checkSession } from '../services/supabase';
import { generateMarketingCopy, categorizeAndTagPlace, enhanceDescription, generateElVeciTip, generateImageAltText, generateSeoMetaTags, analyzeUserDemand, parsePlaceFromRawText } from '../services/aiService'; 
import { fetchPlaceDetails, autocompletePlace } from '../services/placesService';
import { useLanguage } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import { DEFAULT_PLACE_ZOOM } from '../constants';

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

const Admin: React.FC<AdminProps> = ({ onClose, places, events, onUpdate }) => {
  const { t } = useLanguage(); // Use for translations

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // App State
  const [activeTab, setActiveTab] = useState<'inbox' | 'places' | 'events' | 'logs' | 'insights'>('places');
  const [editingPlace, setEditingPlace] = useState<Partial<Place> | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  
  // Safe JSON Editing State
  const [jsonString, setJsonString] = useState('');

  // Smart Import State
  const [importQuery, setImportQuery] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [magicParsing, setMagicParsing] = useState(false); // NEW State for AI Parser
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const autocompleteTimeoutRef = useRef<number | null>(null);

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
  const [demandAnalysis, setDemandAnalysis] = useState<any>(null);
  const [isAnalyzingDemand, setIsAnalyzingDemand] = useState(false);


  // Marketing State
  const [marketingPlatform, setMarketingPlatform] = useState<'instagram' | 'radio' | 'email' | 'campaign_bundle'>('instagram'); // Added 'campaign_bundle'
  const [marketingTone, setMarketingTone] = useState<'hype' | 'chill' | 'professional'>('hype');
  const [marketingResult, setMarketingResult] = useState('');
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- FILTER LISTS (Enhanced for Inbox) ---
  
  // 1. Pending Places (Inbox) - "Idiot Proof" Filter
  const pendingPlaces = places.filter(p => p.status === 'pending');
  
  // 2. Visible Places (My Places) - Exclude pending to clean up list
  const filteredPlaces = places.filter(p => 
      p.status !== 'pending' && 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // 3. Events
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
              // Basic normalization
              const term = l.place_name.trim().toLowerCase();
              if (term.length > 2) {
                  searchCounts[term] = (searchCounts[term] || 0) + 1;
              }
          });
          const sortedSearches = Object.entries(searchCounts)
              .map(([term, count]) => ({ term, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10);
          setTopSearches(sortedSearches);
      });
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
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }
    if (importQuery.length > 2) {
      autocompleteTimeoutRef.current = window.setTimeout(async () => {
        try {
          const suggestions = await autocompletePlace(importQuery);
          setAutocompleteSuggestions(suggestions);
        } catch (e) {
          console.error("Autocomplete fetch error:", e);
          setAutocompleteSuggestions([]);
        }
      }, 300); // Debounce time
    } else {
      setAutocompleteSuggestions([]);
    }
    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
    };
  }, [importQuery]);


  const handleLogin = async () => {
      if (!email || !password) return showToast(t('admin_enter_credentials'), 'error');
      setAuthLoading(true);
      const res = await loginAdmin(email, password);
      setAuthLoading(false);
      if (res.user) {
          setIsAuthenticated(true);
      } else {
          showToast(res.error || t('admin_login_failed'), 'error');
      }
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

  const handleSavePlace = async (autoApprove: boolean = false) => {
    if (!editingPlace || !editingPlace.name) return showToast(t('admin_name_required'), 'error');
    
    // Coordinate Validation (only if lat/lng are provided, not null)
    if (editingPlace.coords?.lat !== undefined && editingPlace.coords?.lat !== null) {
        if (editingPlace.coords.lat > 90 || editingPlace.coords.lat < -90) return showToast(t('admin_invalid_latitude'), 'error');
    }
    if (editingPlace.coords?.lng !== undefined && editingPlace.coords?.lng !== null) {
        if (editingPlace.coords.lng > 180 || editingPlace.coords.lng < -180) return showToast(t('admin_invalid_longitude'), 'error');
    }

    // Parse JSON
    try {
        const parsed = JSON.parse(jsonString);
        editingPlace.contact_info = parsed;
    } catch (e) {
        return showToast(t('admin_invalid_json'), 'error');
    }

    // Auto Approve Logic
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
      setEditingPlace(null); // Return to list on mobile/desktop
    } catch (e: any) {
      showToast(e.message || t('admin_error_saving'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlace = async (id: string) => {
    if (confirm(t('admin_confirm_delete_place'))) {
      setIsSaving(true); // Re-using isSaving to show spinner/block interactions
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

  const handleSaveEvent = async () => {
      if (!editingEvent || !editingEvent.title) return showToast(t('admin_title_required'), 'error');
      
      // Date Logic Validation
      if (editingEvent.startTime && editingEvent.endTime) {
          if (new Date(editingEvent.endTime) <= new Date(editingEvent.startTime)) {
              return showToast(t('admin_end_time_after_start'), 'error');
          }
      }

      setIsSaving(true);
      try {
          if (editingEvent.id) {
              await updateEvent(editingEvent.id, editingEvent);
          } else {
              await createEvent(editingEvent);
          }
          await onUpdate();
          setEditingEvent(null);
          showToast(t('admin_event_saved'), 'success');
      } catch (e: any) {
          showToast(e.message || t('admin_error_saving_event'), 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm(t('admin_confirm_delete_event'))) {
      setIsSaving(true);
      try {
        const res = await deleteEvent(id);
        if (res.success) {
          setEditingEvent(null);
          await onUpdate();
          showToast(t('admin_event_deleted'), 'success');
        } else {
          showToast(res.error || t('admin_failed_to_delete_event'), 'error');
        }
      } finally {
        setIsSaving(false);
      }
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

  const handleSmartImport = async (queryOrPlaceId: string) => {
      if (!queryOrPlaceId) return showToast(t('admin_enter_name_or_link'), 'error');
      setImportLoading(true);
      setAutocompleteSuggestions([]); // Clear suggestions once an import is initiated
      try {
          const details = await fetchPlaceDetails(queryOrPlaceId);
          if (details) {
              setEditingPlace(prev => ({
                  ...prev,
                  ...details,
                  id: prev?.id, // Preserve ID
                  status: prev?.status || 'open',
                  imageUrl: details.imageUrl || prev?.imageUrl || '', // Use imported image, then previous, then empty
                  gmapsUrl: details.gmapsUrl || prev?.gmapsUrl || '' // Use imported GMaps URL, then previous, then empty
              }));
              showToast(t('admin_import_successful'), 'success');
              setImportQuery('');
          } else {
              showToast(t('admin_could_not_find_details'), 'error');
          }
      } catch (e: any) {
          console.error("Smart Import Failed:", e);
          showToast(e.message || t('admin_import_failed'), 'error');
      } finally {
          setImportLoading(false);
      }
  };

  const handleMagicParse = async () => {
      if (!importQuery || importQuery.length < 5) return showToast("Paste some text first (at least 5 chars).", 'error');
      setMagicParsing(true);
      try {
          const parsed = await parsePlaceFromRawText(importQuery);
          if (parsed && parsed.name) {
              setEditingPlace(prev => ({
                  ...prev,
                  ...parsed,
                  id: prev?.id, // Preserve ID
                  status: prev?.status || 'open', // Preserve status
                  imageUrl: prev?.imageUrl || '', // Don't wipe existing image if parsing text
                  // Ensure category maps to Enum
                  category: Object.values(PlaceCategory).includes(parsed.category) ? parsed.category : PlaceCategory.SERVICE
              }));
              showToast("Magic Parse Successful!", 'success');
              setImportQuery('');
          } else {
              showToast("AI couldn't understand the text.", 'error');
          }
      } catch (e) {
          showToast("AI Parse Failed", 'error');
      } finally {
          setMagicParsing(false);
      }
  };

  const handleGenerateMarketing = async () => {
      if (!editingPlace?.name) return showToast(t('admin_need_name_first'), 'error');
      setIsGeneratingMarketing(true);
      const copy = await generateMarketingCopy(editingPlace.name, marketingPlatform, marketingTone);
      setMarketingResult(copy);
      setIsGeneratingMarketing(false);
  };

  // --- NEW AI HANDLERS ---
  const handleAiSuggestCategoryAndTags = async () => {
      if (!editingPlace?.name || !editingPlace.description) {
          return showToast("Need name and description to suggest categories/tags.", 'error');
      }
      setIsAiGeneratingCategoryTags(true);
      try {
          const result = await categorizeAndTagPlace(editingPlace.name, editingPlace.description);
          if (result) {
              setEditingPlace(prev => ({
                  ...prev,
                  category: result.category,
                  tags: result.tags
              }));
              showToast(t('admin_ai_suggest_category_tags_success'), 'success');
          } else {
              showToast(t('admin_ai_suggest_category_tags_fail'), 'error');
          }
      } catch (e) {
          showToast(t('admin_ai_suggest_category_tags_error'), 'error');
      } finally {
          setIsAiGeneratingCategoryTags(false);
      }
  };

  const handleAiEnhanceDescription = async () => {
      if (!editingPlace?.name || !editingPlace.description) {
          return showToast("Need name and description to enhance.", 'error');
      }
      setIsAiEnhancingDescription(true);
      try {
          const result = await enhanceDescription(editingPlace.name, editingPlace.description);
          if (result) {
              setEditingPlace(prev => ({ ...prev, description: result }));
              showToast(t('admin_ai_enhance_description_success'), 'success');
          } else {
              showToast(t('admin_ai_enhance_description_fail'), 'error');
          }
      } catch (e) {
          showToast(t('admin_ai_enhance_description_error'), 'error');
      } finally {
          setIsAiEnhancingDescription(false);
      }
  };

  const handleAiGenerateTip = async () => {
      if (!editingPlace?.name || !editingPlace.description || !editingPlace.category) {
          return showToast("Need name, description, and category to generate a tip.", 'error');
      }
      setIsAiGeneratingTip(true);
      try {
          const result = await generateElVeciTip(editingPlace.name, editingPlace.category, editingPlace.description);
          if (result) {
              setEditingPlace(prev => ({ ...prev, tips: result }));
              showToast(t('admin_ai_generate_tip_success'), 'success');
          } else {
              showToast(t('admin_ai_generate_tip_fail'), 'error');
          }
      } catch (e) {
          showToast(t('admin_ai_generate_tip_error'), 'error');
      } finally {
          setIsAiGeneratingTip(false);
      }
  };

  const handleAiGenerateAltText = async () => {
    if (!editingPlace?.imageUrl) {
        return showToast("Need an image URL to generate alt text.", 'error');
    }
    setIsAiGeneratingAltText(true);
    try {
        const result = await generateImageAltText(editingPlace.imageUrl);
        if (result) {
            setEditingPlace(prev => ({ ...prev, imageAlt: result }));
            showToast(t('admin_ai_generate_alt_text_success'), 'success');
        } else {
            showToast(t('admin_ai_generate_alt_text_fail'), 'error');
        }
    } catch (e) {
        showToast(t('admin_ai_generate_alt_text_error'), 'error');
    } finally {
        setIsAiGeneratingAltText(false);
    }
  };

  const handleAiGenerateSeo = async () => {
    if (!editingPlace?.name || !editingPlace.description || !editingPlace.category) {
        return showToast("Need name, description, and category to generate SEO tags.", 'error');
    }
    setIsAiGeneratingSeo(true);
    try {
        const result = await generateSeoMetaTags(editingPlace.name, editingPlace.description, editingPlace.category);
        if (result) {
            setEditingPlace(prev => ({ ...prev, metaTitle: result.metaTitle, metaDescription: result.metaDescription }));
            showToast(t('admin_ai_generate_seo_success'), 'success');
        } else {
            showToast(t('admin_ai_generate_seo_fail'), 'error');
        }
    } catch (e) {
        showToast(t('admin_ai_generate_seo_error'), 'error');
    } finally {
        setIsAiGeneratingSeo(false);
    }
  };

  const handleAnalyzeDemand = async () => {
      setIsAnalyzingDemand(true);
      try {
          // Extract plain text queries from USER_SEARCH and USER_CHAT logs
          const queries = userLogs.map(l => l.place_name || l.details);
          const currentCategories = Object.values(PlaceCategory);
          
          const analysis = await analyzeUserDemand(queries, currentCategories);
          setDemandAnalysis(analysis);
          showToast("Analysis Complete", 'success');
      } catch (e) {
          showToast("Analysis Failed", 'error');
      } finally {
          setIsAnalyzingDemand(false);
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
      // Fix: Explicitly cast to the key type for t() to address potential TS inference issues
      showToast(t('admin_applied_mon_to_fri' as keyof typeof translations.es), 'success');
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
                    <h1 className="text-2xl font-black text-white">{t('admin_access_title')}</h1>
                    <p className="text-slate-500 text-sm">{t('admin_access_subtitle')}</p>
                </div>

                <div className="space-y-4">
                    <input 
                        type="email" 
                        placeholder={t('admin_email_placeholder')} 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-teal-500 transition-colors"
                    />
                    <input 
                        type="password" 
                        placeholder={t('admin_password_placeholder')} 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-teal-500 transition-colors"
                    />
                    <button 
                        onClick={handleLogin} 
                        disabled={authLoading}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {authLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : t('admin_login_button')}
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
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('admin_editing')}</h2>
                    <p className="text-white font-bold truncate">{editingPlace?.name || editingEvent?.title || t('admin_new_item')}</p>
                </div>
                <button 
                    onClick={() => activeTab === 'places' || activeTab === 'inbox' ? handleSavePlace(false) : handleSaveEvent()} 
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
                    <div className="bg-teal-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
                        <i className="fa-solid fa-lock text-white text-xs"></i>
                    </div>
                    <span className="font-black text-lg tracking-tight">Admin</span>
                </div>
                
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('inbox')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 whitespace-nowrap ${activeTab === 'inbox' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>
                        {t('admin_inbox')}
                        {pendingPlaces.length > 0 && <span className="bg-red-500 text-white px-1.5 rounded-full text-[9px]">{pendingPlaces.length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('places')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'places' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{t('admin_places')}</button>
                    <button onClick={() => setActiveTab('events')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'events' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{t('admin_events')}</button>
                    <button onClick={() => setActiveTab('insights')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'insights' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Insights</button>
                    <button onClick={() => setActiveTab('logs')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${activeTab === 'logs' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{t('admin_logs')}</button>
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
        <div className={`w-full md:w-80 border-r border-slate-700 bg-slate-900 flex flex-col ${isEditing ? 'hidden md:flex' : 'flex'} ${activeTab === 'insights' ? 'hidden md:hidden' : ''}`}>
            {activeTab !== 'insights' && (
                <div className="p-4 border-b border-slate-700">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                        <input 
                            type="text" 
                            placeholder={t('admin_search_placeholder')} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:border-teal-500 outline-none"
                        />
                    </div>
                </div>
            )}
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {/* INBOX TAB (Pending) */}
                {activeTab === 'inbox' && (
                    <>
                    {pendingPlaces.length === 0 && <div className="text-slate-500 text-center text-xs py-10 opacity-50">No pending items.</div>}
                    {pendingPlaces.map(p => (
                        <div key={p.id} onClick={() => setEditingPlace(p)} className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] border-l-4 border-l-amber-500 ${editingPlace?.id === p.id ? 'bg-teal-900/20 border-teal-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-bold text-sm truncate ${editingPlace?.id === p.id ? 'text-teal-400' : 'text-slate-200'}`}>{p.name}</h4>
                                <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">{t('admin_pending_review')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="uppercase tracking-wider font-bold">{p.category}</span>
                            </div>
                        </div>
                    ))}
                    </>
                )}

                {/* PLACES TAB (Live) */}
                {activeTab === 'places' && (
                    <>
                    <button 
                        onClick={() => {
                            const newPlace: Partial<Place> = { 
                                name: '', 
                                category: PlaceCategory.FOOD, 
                                status: 'open', 
                                plan: 'free', 
                                coords: undefined, // Default to undefined
                                amenities: {}, 
                                parking: ParkingStatus.FREE,
                                defaultZoom: DEFAULT_PLACE_ZOOM, // Default zoom for new places
                            };
                            setEditingPlace(newPlace);
                            setJsonString('{}');
                        }} 
                        className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-teal-500 hover:text-teal-500 hover:bg-slate-800 transition-all font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-plus"></i> {t('admin_add_new_place')}
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
                            <i className="fa-solid fa-plus"></i> {t('admin_add_new_event')}
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
                                    <span className={`font-bold px-1.5 rounded ${['USER_SEARCH','USER_CHAT'].includes(log.action) ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>{log.action}</span>
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
        <div className={`flex-1 bg-slate-900 overflow-y-auto custom-scrollbar ${isEditing ? 'absolute inset-0 z-10 md:static' : (activeTab === 'insights' ? 'w-full' : 'hidden md:flex flex-col items-center justify-center')}`}>
            
            {activeTab === 'insights' ? (
                <div className="p-6 max-w-6xl mx-auto space-y-8 animate-slide-up">
                    <div className="flex justify-between items-end">
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Market Intelligence</h2>
                            <p className="text-slate-400">Analysis based on the last {logs.length} interactions.</p>
                        </div>
                        <button 
                            onClick={handleAnalyzeDemand} 
                            disabled={isAnalyzingDemand}
                            className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-teal-900/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            {isAnalyzingDemand ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                            Analyze Demand
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: USER ACTIVITY */}
                        <div className="space-y-6">
                            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
                                <h3 className="text-teal-400 font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-users-viewfinder"></i> User Intent (Top Searches)
                                </h3>
                                {topSearches.length > 0 ? (
                                    <div className="space-y-3">
                                        {topSearches.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">#{i+1}</span>
                                                    <span className="font-bold text-slate-200 capitalize">{s.term}</span>
                                                </div>
                                                <span className="bg-teal-900/30 text-teal-400 text-xs font-bold px-2 py-1 rounded-lg">{s.count} hits</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-center py-8">Not enough data yet.</p>
                                )}
                            </div>

                            {/* Recent Activity Log Preview */}
                            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
                                <h3 className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-comments"></i> Recent Questions
                                </h3>
                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                    {userLogs.slice(0, 10).map(l => (
                                        <div key={l.id} className="text-xs p-2 border-b border-slate-700/50">
                                            <span className="text-slate-500 mr-2">[{new Date(l.created_at).toLocaleTimeString()}]</span>
                                            <span className="text-slate-300">{l.place_name || l.details}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: AI ANALYSIS */}
                        <div className="space-y-6">
                            {demandAnalysis ? (
                                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-600 shadow-2xl p-6 animate-fade-in">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <i className="fa-solid fa-brain text-xl"></i>
                                        </div>
                                        <div>
                                            <h3 className="font-black text-xl text-white">AI Demand Report</h3>
                                            <p className="text-xs text-indigo-300">Generated just now</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Executive Summary</h4>
                                            <p className="text-slate-300 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
                                                {demandAnalysis.recommendation}
                                            </p>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2">Missing Content (High Priority)</h4>
                                            <div className="space-y-2">
                                                {demandAnalysis.content_gaps?.map((gap: any, i: number) => (
                                                    <div key={i} className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex justify-between items-start">
                                                        <div>
                                                            <div className="font-bold text-red-200">{gap.gap}</div>
                                                            <div className="text-xs text-red-300/70">{gap.description}</div>
                                                        </div>
                                                        <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">{gap.urgency}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2">Trending Topics</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {demandAnalysis.trending_topics?.map((t: any, i: number) => (
                                                    <span key={i} className="bg-emerald-900/30 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
                                                        {t.topic} <span className="opacity-50 ml-1">x{t.count}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full bg-slate-800/30 rounded-2xl border border-slate-700/50 border-dashed flex flex-col items-center justify-center p-10 text-center">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
                                        <i className="fa-solid fa-chart-pie text-2xl"></i>
                                    </div>
                                    <h3 className="text-slate-300 font-bold mb-2">No Analysis Yet</h3>
                                    <p className="text-slate-500 text-sm max-w-xs">
                                        Click "Analyze Demand" to have the AI process user search logs and identify missing opportunities.
                                    </p>
                                </div>
                            )}

                            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 opacity-60">
                                <h3 className="text-slate-400 font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-server"></i> System Audit Log
                                </h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {systemLogs.slice(0, 10).map(l => (
                                        <div key={l.id} className="text-xs p-2 border-b border-slate-700/50 flex justify-between">
                                            <span className="text-slate-300">{l.action}: {l.place_name}</span>
                                            <span className="text-slate-500">{new Date(l.created_at).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (activeTab === 'places' || activeTab === 'inbox') && editingPlace ? (
                <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
                    
                    {/* --- PROMINENT REVIEW SECTION FOR PENDING ITEMS --- */}
                    {editingPlace.status === 'pending' && (
                        <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-2xl p-6 mb-8 text-center animate-pulse-slow">
                            <div className="w-16 h-16 bg-amber-500 text-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg shadow-amber-500/20">
                                <i className="fa-solid fa-magnifying-glass-location"></i>
                            </div>
                            <h2 className="text-xl font-black text-amber-400 mb-2">{t('admin_review_alert')}</h2>
                            <p className="text-slate-400 mb-6 text-sm max-w-md mx-auto">This place was suggested by a user. Please verify details before publishing.</p>
                            
                            <div className="flex justify-center gap-4">
                                <button 
                                    onClick={() => editingPlace.id && handleDeletePlace(editingPlace.id)}
                                    className="bg-slate-800 text-red-400 border border-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-red-500/20 hover:border-red-500 transition-all flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-trash"></i> {t('admin_reject_delete')}
                                </button>
                                <button 
                                    onClick={() => handleSavePlace(true)} // Pass true to auto-approve
                                    className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/50 transition-all flex items-center gap-2 scale-105"
                                >
                                    <i className="fa-solid fa-check-circle"></i> {t('admin_approve_publish')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ID & Delete Header */}
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-mono text-xs text-slate-500">{editingPlace.id || 'NEW RECORD'}</span>
                        {editingPlace.id && editingPlace.status !== 'pending' && (
                            <button 
                                onClick={() => handleDeletePlace(editingPlace.id!)} 
                                disabled={isSaving}
                                className="text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-trash"></i>}
                                <span>{t('admin_delete_record')}</span>
                            </button>
                        )}
                    </div>

                    {/* SMART IMPORT */}
                    <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-4 rounded-2xl border border-indigo-500/30 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <i className="fa-solid fa-wand-magic-sparkles text-6xl text-white"></i>
                        </div>
                        <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-bolt text-yellow-400"></i> {t('admin_smart_import')}
                        </h3>
                        <div className="relative z-10">
                            <div className="flex flex-col gap-3">
                                <textarea 
                                    className="w-full bg-slate-900/80 border border-indigo-500/30 rounded-xl px-4 py-3 text-white placeholder:text-indigo-300/50 focus:border-indigo-400 outline-none resize-y min-h-[80px]" 
                                    placeholder={t('admin_import_placeholder')}
                                    value={importQuery}
                                    onChange={(e) => setImportQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && autocompleteSuggestions.length > 0) handleSmartImport(autocompleteSuggestions[0].description); }}
                                />
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleSmartImport(importQuery)}
                                        disabled={importLoading || !importQuery}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {importLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-download"></i>}
                                        <span>{t('admin_auto_fill')}</span>
                                    </button>
                                    <button 
                                        onClick={handleMagicParse}
                                        disabled={magicParsing || !importQuery}
                                        className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-fuchsia-900/50 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {magicParsing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                                        <span>Magic Parse</span>
                                    </button>
                                </div>
                            </div>
                            
                            {autocompleteSuggestions.length > 0 && (
                                <ul className="absolute left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl mt-2 max-h-48 overflow-y-auto shadow-lg z-20">
                                    {autocompleteSuggestions.map((suggestion, index) => (
                                        <li 
                                            key={suggestion.place_id} 
                                            onClick={() => {
                                                setImportQuery(suggestion.description);
                                                handleSmartImport(suggestion.place_id); // Use place_id for details
                                            }}
                                            className="px-4 py-3 text-sm text-white hover:bg-slate-700 cursor-pointer transition-colors border-b border-slate-700 last:border-b-0"
                                        >
                                            <span className="font-bold">{suggestion.structured_formatting?.main_text || suggestion.description}</span>
                                            <span className="text-slate-400 block text-xs">{suggestion.structured_formatting?.secondary_text}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <p className="text-[10px] text-indigo-300 mt-2 ml-1">
                            {t('admin_import_description')}
                        </p>
                    </div>

                    <Section title={t('admin_basic_info')} icon="circle-info">
                        <InputGroup label={t('admin_name')}><StyledInput value={editingPlace.name || ''} onChange={e => setEditingPlace({...editingPlace, name: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup label={t('admin_category')}>
                                <StyledSelect 
                                    value={editingPlace.category || PlaceCategory.FOOD} 
                                    onChange={e => setEditingPlace({...editingPlace, category: e.target.value as PlaceCategory})}
                                >
                                    {Object.values(PlaceCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label={t('admin_icon_name')}>
                                <div className="flex gap-2">
                                    <StyledInput value={editingPlace.customIcon || ''} onChange={e => setEditingPlace({...editingPlace, customIcon: e.target.value})} placeholder="pizza-slice" />
                                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 text-xl shrink-0">
                                        <i className={`fa-solid fa-${editingPlace.customIcon || 'icons'}`}></i>
                                    </div>
                                </div>
                            </InputGroup>
                        </div>
                        <button 
                            onClick={handleAiSuggestCategoryAndTags} 
                            disabled={isAiGeneratingCategoryTags || !editingPlace.name || !editingPlace.description}
                            className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform mt-2"
                        >
                            {isAiGeneratingCategoryTags ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-sparkles"></i>}
                            <span>{t('admin_ai_suggest_category_tags')}</span>
                        </button>
                        <InputGroup label={t('admin_description')}>
                            <StyledTextArea value={editingPlace.description || ''} onChange={e => setEditingPlace({...editingPlace, description: e.target.value})} />
                            <button 
                                onClick={handleAiEnhanceDescription} 
                                disabled={isAiEnhancingDescription || !editingPlace.name || !editingPlace.description}
                                className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform mt-2"
                            >
                                {isAiEnhancingDescription ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-star-half-stroke"></i>}
                                <span>{t('admin_ai_enhance_description')}</span>
                            </button>
                        </InputGroup>
                        <InputGroup label={t('admin_tags')}><StyledInput value={(editingPlace.tags || []).join(', ')} onChange={e => setEditingPlace({...editingPlace, tags: e.target.value.split(',').map(s => s.trim())})} /></InputGroup>
                        
                        {/* New: SEO Meta Tags */}
                        <InputGroup label={t('admin_meta_title')} description={t('admin_meta_title_desc')}>
                            <StyledInput value={editingPlace.metaTitle || ''} onChange={e => setEditingPlace({...editingPlace, metaTitle: e.target.value})} placeholder={t('admin_meta_title_placeholder')} maxLength={60} />
                        </InputGroup>
                        <InputGroup label={t('admin_meta_description')} description={t('admin_meta_description_desc')}>
                            <StyledTextArea value={editingPlace.metaDescription || ''} onChange={e => setEditingPlace({...editingPlace, metaDescription: e.target.value})} placeholder={t('admin_meta_description_placeholder')} maxLength={160} />
                            <button 
                                onClick={handleAiGenerateSeo} 
                                disabled={isAiGeneratingSeo || !editingPlace.name || !editingPlace.description || !editingPlace.category}
                                className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform mt-2"
                            >
                                {isAiGeneratingSeo ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-magnifying-glass-chart"></i>}
                                <span>{t('admin_ai_generate_seo')}</span>
                            </button>
                        </InputGroup>

                    </Section>

                    <Section title={t('admin_location')} icon="map-location-dot">
                        <InputGroup label={t('admin_address')}><StyledInput value={editingPlace.address || ''} onChange={e => setEditingPlace({...editingPlace, address: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-2 gap-4">
                             <InputGroup label="Lat"><StyledInput type="number" value={editingPlace.coords?.lat ?? ''} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords!, lat: e.target.value === '' ? null : parseFloat(e.target.value) }})} /></InputGroup>
                             <InputGroup label="Lng"><StyledInput type="number" value={editingPlace.coords?.lng ?? ''} onChange={e => setEditingPlace({...editingPlace, coords: { ...editingPlace.coords!, lng: e.target.value === '' ? null : parseFloat(e.target.value) }})} /></InputGroup>
                        </div>
                        <button onClick={handleGetLocation} className="w-full py-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                            <i className="fa-solid fa-location-crosshairs"></i> {t('admin_use_current_location')}
                        </button>
                        <InputGroup label={t('admin_maps_link')}><StyledInput value={editingPlace.gmapsUrl || ''} onChange={e => setEditingPlace({...editingPlace, gmapsUrl: e.target.value})} /></InputGroup>
                        <InputGroup label={t('admin_default_zoom')} description={t('admin_default_zoom_desc')}>
                            <StyledInput type="number" value={editingPlace.defaultZoom ?? ''} onChange={e => setEditingPlace({...editingPlace, defaultZoom: e.target.value === '' ? null : parseInt(e.target.value)})} placeholder="16" />
                        </InputGroup>
                    </Section>

                    <Section title={t('admin_operations_hours')} icon="clock">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">{t('admin_hours_strategy')}</label>
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
                                <InputGroup label={t('admin_display_note')} description={t('admin_display_note_desc')}>
                                    <StyledInput 
                                        value={editingPlace.opening_hours?.note || ''} 
                                        onChange={e => setEditingPlace({...editingPlace, opening_hours: { ...editingPlace.opening_hours, note: e.target.value }})} 
                                    />
                                </InputGroup>

                                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{t('admin_weekly_schedule')}</span>
                                        <button onClick={applyMonToFri} className="text-[10px] bg-teal-600/20 text-teal-400 px-2 py-1 rounded hover:bg-teal-600/30 transition-colors font-bold">
                                            {t('admin_apply_mon_to_fri')}
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
                                                    <span className="text-xs text-slate-500 italic flex-1 text-center font-medium bg-slate-800/50 py-1.5 rounded-lg">{t('admin_closed')}</span>
                                                )}
                                            </div>

                                            <button 
                                                onClick={() => updateScheduleDay(index, 'isClosed', !dayData.isClosed)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dayData.isClosed ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                title={dayData.isClosed ? t('admin_mark_as_open') : t('admin_mark_as_closed')}
                                            >
                                                <i className={`fa-solid ${dayData.isClosed ? 'fa-ban' : 'fa-check'}`}></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <InputGroup label={t('admin_phone')}><StyledInput type="tel" value={editingPlace.phone || ''} onChange={e => setEditingPlace({...editingPlace, phone: e.target.value})} /></InputGroup>
                        <InputGroup label={t('admin_website')}><StyledInput value={editingPlace.website || ''} onChange={e => setEditingPlace({...editingPlace, website: e.target.value})} /></InputGroup>
                    </Section>

                    <Section title={t('admin_media')} icon="image">
                         <div 
                            className="relative w-full aspect-video bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden mb-4"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {editingPlace.imageUrl ? (
                                <img src={editingPlace.imageUrl} className="w-full h-full object-cover" alt={editingPlace.imageAlt || editingPlace.name || "Place image"} />
                            ) : (
                                <div className="text-center p-4 text-slate-500">
                                    <i className="fa-solid fa-cloud-arrow-up text-3xl mb-2"></i>
                                    <p className="font-bold">{t('admin_tap_to_upload')}</p>
                                </div>
                            )}
                            {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        <InputGroup label={t('admin_image_url')}><StyledInput value={editingPlace.imageUrl || ''} onChange={e => setEditingPlace({...editingPlace, imageUrl: e.target.value})} /></InputGroup>
                        <InputGroup label={t('admin_image_alt_text')}> {/* Updated label */}
                            <StyledTextArea value={editingPlace.imageAlt || ''} onChange={e => setEditingPlace({...editingPlace, imageAlt: e.target.value})} placeholder={t('admin_image_alt_text_placeholder')} />
                            <button 
                                onClick={handleAiGenerateAltText} 
                                disabled={isAiGeneratingAltText || !editingPlace.imageUrl}
                                className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform mt-2"
                            >
                                {isAiGeneratingAltText ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-eye"></i>}
                                <span>{t('admin_ai_generate_alt_text')}</span>
                            </button>
                        </InputGroup>
                        
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

                    <Section title={t('admin_details_amenities')} icon="list-check">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Toggle label={t('admin_visible_open')} checked={editingPlace.status === 'open'} onChange={v => setEditingPlace({...editingPlace, status: v ? 'open' : 'closed'})} icon="eye" />
                            {/* Verified Toggle now sets status to open if true */}
                            <Toggle label={t('admin_verified')} checked={editingPlace.isVerified || false} onChange={v => setEditingPlace({...editingPlace, isVerified: v, status: v ? 'open' : editingPlace.status})} icon="certificate" />
                            <Toggle label={t('admin_featured')} checked={editingPlace.is_featured || false} onChange={v => setEditingPlace({...editingPlace, is_featured: v})} icon="star" />
                            <Toggle label={t('admin_landing_spot')} checked={editingPlace.isLanding || false} onChange={v => setEditingPlace({...editingPlace, isLanding: v})} icon="map-pin" />
                            <Toggle label={t('admin_pet_friendly')} checked={editingPlace.isPetFriendly || false} onChange={v => setEditingPlace({...editingPlace, isPetFriendly: v})} icon="dog" />
                            <Toggle label={t('admin_restrooms')} checked={editingPlace.hasRestroom || false} onChange={v => setEditingPlace({...editingPlace, hasRestroom: v})} icon="restroom" />
                            <Toggle label={t('admin_generator')} checked={editingPlace.hasGenerator || false} onChange={v => setEditingPlace({...editingPlace, hasGenerator: v})} icon="bolt" />
                            <Toggle label={t('admin_paid_parking')} checked={editingPlace.parking === ParkingStatus.PAID} onChange={v => setEditingPlace({...editingPlace, parking: v ? ParkingStatus.PAID : ParkingStatus.FREE})} icon="square-parking" />
                         </div>
                         <div className="mt-4 space-y-4">
                            <InputGroup label={t('admin_el_veci_tip')}>
                                <StyledTextArea value={editingPlace.tips || ''} onChange={e => setEditingPlace({...editingPlace, tips: e.target.value})} />
                                <button 
                                    onClick={handleAiGenerateTip} 
                                    disabled={isAiGeneratingTip || !editingPlace.name || !editingPlace.description || !editingPlace.category}
                                    className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform mt-2"
                                >
                                    {isAiGeneratingTip ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-lightbulb"></i>}
                                    <span>{t('admin_ai_generate_tip')}</span>
                                </button>
                            </InputGroup>
                            
                            <InputGroup label={t('admin_advanced_contact_info')} description={t('admin_advanced_contact_info_desc')}>
                                <StyledTextArea 
                                    className="font-mono text-xs h-24 bg-slate-950 text-emerald-400 border-slate-800"
                                    value={jsonString}
                                    onChange={e => setJsonString(e.target.value)} 
                                    placeholder="{}"
                                />
                            </InputGroup>
                         </div>
                    </Section>

                    {/* AI MARKETING STUDIO */}
                    <Section title={t('admin_ai_marketing_studio')} icon="bullhorn">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <InputGroup label={t('admin_platform')}>
                                <StyledSelect 
                                    value={marketingPlatform} 
                                    onChange={e => setMarketingPlatform(e.target.value as any)}
                                >
                                    <option value="instagram">Instagram</option>
                                    <option value="radio">Radio Script</option>
                                    <option value="email">Email Blast</option>
                                    <option value="campaign_bundle">Campaign Bundle</option> {/* New Option */}
                                </StyledSelect>
                            </InputGroup>
                            <InputGroup label={t('admin_tone')}>
                                <StyledSelect 
                                    value={marketingTone} 
                                    onChange={e => setMarketingTone(e.target.value as any)}
                                >
                                    <option value="hype">🔥 {t('admin_tone_hype')}</option>
                                    <option value="chill">🌴 {t('admin_tone_chill')}</option>
                                    <option value="professional">💼 {t('admin_tone_professional')}</option>
                                </StyledSelect>
                            </InputGroup>
                        </div>
                        
                        <button 
                            onClick={handleGenerateMarketing} 
                            disabled={isGeneratingMarketing || !editingPlace.name}
                            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 rounded-xl mb-4 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {isGeneratingMarketing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                            {t('admin_generate_copy')}
                        </button>

                        {marketingResult && (
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 relative group">
                                <textarea 
                                    className="w-full bg-transparent text-slate-300 text-sm h-32 outline-none resize-none font-mono"
                                    value={marketingResult}
                                    readOnly
                                />
                                <button 
                                    onClick={() => { navigator.clipboard.writeText(marketingResult); showToast(t('copied'), 'success'); }}
                                    className="absolute top-2 right-2 bg-slate-800 text-slate-400 hover:text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <i className="fa-regular fa-copy"></i>
                                </button>
                            </div>
                        )}
                    </Section>

                    <div className="h-12"></div>
                </div>
            ) : activeTab === 'events' && editingEvent ? (
                <div className="p-4 md:p-8 max-w-2xl mx-auto pb-32 animate-slide-up">
                    <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <span className="font-mono text-xs text-slate-500">{editingEvent.id || 'NEW EVENT'}</span>
                        {editingEvent.id && (
                            <button 
                                onClick={() => handleDeleteEvent(editingEvent.id!)} 
                                disabled={isSaving}
                                className="text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-trash"></i>}
                                <span>{t('admin_delete_event')}</span>
                            </button>
                        )}
                    </div>

                    <Section title={t('admin_event_details')} icon="calendar">
                        <InputGroup label={t('admin_title')}><StyledInput value={editingEvent.title || ''} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} /></InputGroup>
                        <InputGroup label={t('admin_description')}><StyledTextArea value={editingEvent.description || ''} onChange={e => setEditingEvent({...editingEvent, description: e.target.value})} /></InputGroup>
                        <InputGroup label={t('admin_start')}><StyledInput type="datetime-local" value={editingEvent.startTime?.slice(0, 16) || ''} onChange={e => setEditingEvent({...editingEvent, startTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                        <InputGroup label={t('admin_end')}><StyledInput type="datetime-local" value={editingEvent.endTime?.slice(0, 16) || ''} onChange={e => setEditingEvent({...editingEvent, endTime: new Date(e.target.value).toISOString()})} /></InputGroup>
                        <div 
                            className="relative w-full aspect-video bg-slate-800 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center overflow-hidden mt-4"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {editingEvent.imageUrl ? <img src={editingEvent.imageUrl} className="w-full h-full object-cover" alt={editingEvent.title || "Event image"} /> : <p>{t('admin_upload_image')}</p>}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </Section>
                </div>
            ) : (
                <div className="text-center text-slate-500 opacity-50">
                    <i className="fa-solid fa-hand-pointer text-4xl mb-4"></i>
                    <p>{t('admin_select_item')}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
