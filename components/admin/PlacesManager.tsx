
import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Place, Category, ParkingStatus, DaySchedule } from '../../types';
import { uploadImage } from '../../services/supabase';
import {
  generateMarketingCopy,
  categorizeAndTagPlace,
  enhanceDescription,
  generateElVeciTip,
  generateImageAltText,
  generateSeoMetaTags,
  parsePlaceFromRawText,
  parseHoursFromText,
} from '../../services/aiService';
import { fetchPlaceDetails, autocompletePlace, generateSessionToken } from '../../services/placesService';
import { Section, InputGroup, StyledInput, StyledSelect, StyledTextArea, Toggle, SocialCardTemplate } from './shared';
import { useLanguage } from '../../i18n/LanguageContext';
import { DEFAULT_PLACE_ZOOM } from '../../constants';

interface PlacesManagerProps {
  places: Place[];
  searchTerm: string;
  editingPlace: Partial<Place> | null;
  setEditingPlace: (p: Partial<Place> | null) => void;
  onSavePlace: (autoApprove?: boolean) => void;
  onDeletePlace: (id: string) => void;
  onBulkMode: () => void;
  categories: Category[];
  isSaving: boolean;
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  jsonString: string;
  setJsonString: (s: string) => void;
  seoOptions: { metaTitle: string; metaDescription: string }[];
  setSeoOptions: (opts: { metaTitle: string; metaDescription: string }[]) => void;
  inboxMode?: boolean;
}

export const PlacesManager: React.FC<PlacesManagerProps> = ({
  places,
  searchTerm,
  editingPlace,
  setEditingPlace,
  onSavePlace,
  onDeletePlace,
  onBulkMode,
  categories,
  isSaving,
  isUploading,
  setIsUploading,
  showToast,
  jsonString,
  setJsonString,
  seoOptions,
  setSeoOptions,
  inboxMode = false,
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socialCardRef = useRef<HTMLDivElement>(null);

  // Local AI states
  const [isAiGeneratingCategoryTags, setIsAiGeneratingCategoryTags] = useState(false);
  const [isAiEnhancingDescription, setIsAiEnhancingDescription] = useState(false);
  const [isAiGeneratingTip, setIsAiGeneratingTip] = useState(false);
  const [isAiGeneratingAltText, setIsAiGeneratingAltText] = useState(false);
  const [isAiGeneratingSeo, setIsAiGeneratingSeo] = useState(false);
  const [isAiParsingHours, setIsAiParsingHours] = useState(false);
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [marketingPlatform, setMarketingPlatform] = useState<'instagram' | 'radio' | 'email' | 'campaign_bundle'>('instagram');
  const [marketingTone, setMarketingTone] = useState<'hype' | 'chill' | 'professional'>('hype');
  const [marketingResult, setMarketingResult] = useState('');
  const [hoursText, setHoursText] = useState('');
  const [showHoursParser, setShowHoursParser] = useState(false);

  const [importQuery, setImportQuery] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const autocompleteTimeoutRef = useRef<number | null>(null);
  const [sessionToken, setSessionToken] = useState(() => generateSessionToken());

  // Reset SEO options when place changes
  useEffect(() => {
    if (editingPlace) {
      setJsonString(JSON.stringify(editingPlace.contact_info || {}, null, 2));
      setSeoOptions([]);
      setMarketingResult('');
    }
  }, [editingPlace?.id]);

  // Autocomplete
  useEffect(() => {
    if (autocompleteTimeoutRef.current) clearTimeout(autocompleteTimeoutRef.current);
    if (importQuery.length > 2) {
      autocompleteTimeoutRef.current = window.setTimeout(async () => {
        try {
          const suggestions = await autocompletePlace(importQuery, sessionToken);
          setAutocompleteSuggestions(suggestions);
        } catch (e) {
          setAutocompleteSuggestions([]);
        }
      }, 300);
    } else {
      setAutocompleteSuggestions([]);
    }
    return () => {
      if (autocompleteTimeoutRef.current) clearTimeout(autocompleteTimeoutRef.current);
    };
  }, [importQuery, sessionToken]);

  // ─── Filter ─────────────────────────────────────────────────────────────────
  const searchLower = searchTerm.toLowerCase();
  const filtered = places.filter(
    (p) =>
      (inboxMode ? p.status === 'pending' : p.status !== 'pending') &&
      (!searchTerm ||
        p.name?.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower) ||
        p.tags?.join(' ').toLowerCase().includes(searchLower) ||
        p.id?.toLowerCase().includes(searchLower))
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleGetLocation = () => {
    if (!navigator.geolocation) return showToast(t('admin_geolocation_not_supported'), 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (editingPlace) {
          setEditingPlace({
            ...editingPlace,
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          showToast(t('admin_gps_updated'), 'success');
        }
      },
      (err) => showToast(`${t('admin_error_getting_location')}: ${err.message}`, 'error'),
      { enableHighAccuracy: true }
    );
  };

  const handleGoogleSync = async () => {
    if (!editingPlace?.id) return showToast('Save place first to get an ID.', 'error');
    setIsSyncing(true);
    let gId = '';
    if (editingPlace.gmapsUrl && editingPlace.gmapsUrl.includes('place_id:')) {
      gId = editingPlace.gmapsUrl.split('place_id:')[1].split('&')[0];
    }
    if (!gId && editingPlace.name) {
      try {
        const suggestions = await autocompletePlace(editingPlace.name);
        if (suggestions.length > 0) gId = suggestions[0].place_id;
      } catch (e) {
        console.error(e);
      }
    }
    if (!gId) {
      setIsSyncing(false);
      return showToast('Cannot sync: Google Place ID not found via URL or Name.', 'error');
    }
    try {
      const res = await fetch('/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-place', placeId: editingPlace.id, googlePlaceId: gId }),
      });
      const data = await res.json();
      if (res.ok) {
        const updates = data.data;
        const newCoords =
          updates.lat && updates.lon
            ? { lat: updates.lat, lng: updates.lon }
            : editingPlace.coords;
        setEditingPlace({
          ...editingPlace!,
          address: updates.address,
          phone: updates.phone,
          website: updates.website,
          status: updates.status,
          rating: updates.rating,
          priceLevel: updates.price_level,
          coords: newCoords,
          gmapsUrl: `https://www.google.com/maps/place/?q=place_id:${gId}`,
        });
        showToast('Sync Successful! Data updated.', 'success');
      } else {
        showToast(data.error || 'Sync Failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network Error during Sync', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSmartImport = async (text: string) => {
    if (!text) return;
    setImportLoading(true);
    setAutocompleteSuggestions([]);
    try {
      if (text.includes('http') || text.includes('maps')) {
        const details = await fetchPlaceDetails(text, sessionToken);
        if (details) {
          setEditingPlace({ ...editingPlace, ...details });
          showToast('Imported from Google Maps!', 'success');
        } else {
          showToast('Could not resolve URL.', 'error');
        }
      } else {
        const details = await fetchPlaceDetails(text, sessionToken);
        if (details) {
          setEditingPlace({ ...editingPlace, ...details });
          showToast('Imported from Google!', 'success');
        } else {
          const parsed = await parsePlaceFromRawText(text);
          if (parsed && parsed.name) {
            setEditingPlace({ ...editingPlace, ...parsed, status: 'open', isVerified: true });
            showToast('AI Parsed Text!', 'success');
          } else {
            showToast('AI could not understand text.', 'error');
          }
        }
      }
    } catch (e) {
      showToast('Import failed.', 'error');
    } finally {
      setImportLoading(false);
      setImportQuery('');
      setSessionToken(generateSessionToken());
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadImage(file);
      if (res.success && res.url) {
        setEditingPlace({ ...editingPlace!, imageUrl: res.url });
        showToast('Image uploaded successfully', 'success');
      } else {
        showToast(res.error || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Upload error', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAiEnhanceDescription = async () => {
    if (!editingPlace?.name || !editingPlace?.description)
      return showToast('Need name & desc first', 'error');
    setIsAiEnhancingDescription(true);
    try {
      const enhanced = await enhanceDescription(editingPlace.name, editingPlace.description);
      if (enhanced) setEditingPlace({ ...editingPlace, description: enhanced });
      else showToast('AI failed', 'error');
    } catch (e) {
      showToast('Error', 'error');
    } finally {
      setIsAiEnhancingDescription(false);
    }
  };

  const handleAiGenerateTip = async () => {
    if (!editingPlace?.name || !editingPlace?.category)
      return showToast('Need name & category', 'error');
    setIsAiGeneratingTip(true);
    try {
      const tip = await generateElVeciTip(
        editingPlace.name,
        editingPlace.category,
        editingPlace.description || ''
      );
      if (tip) setEditingPlace({ ...editingPlace, tips: tip });
      else showToast('AI failed', 'error');
    } catch (e) {
      showToast('Error', 'error');
    } finally {
      setIsAiGeneratingTip(false);
    }
  };

  const handleAiSuggestCategoryAndTags = async () => {
    if (!editingPlace?.name) return showToast('Need place name', 'error');
    setIsAiGeneratingCategoryTags(true);
    try {
      const res = await categorizeAndTagPlace(editingPlace.name, editingPlace.description || '');
      if (res) {
        setEditingPlace({
          ...editingPlace,
          category: res.category,
          tags: res.tags,
          parking: (res.amenities?.parking as ParkingStatus) || editingPlace?.parking,
          hasRestroom: res.amenities?.hasRestroom ?? editingPlace?.hasRestroom,
          isPetFriendly: res.amenities?.isPetFriendly ?? editingPlace?.isPetFriendly,
          isHandicapAccessible: res.amenities?.isHandicapAccessible ?? editingPlace?.isHandicapAccessible,
          hasGenerator: res.amenities?.hasGenerator ?? editingPlace?.hasGenerator,
        });
        showToast('AI detected Category, Tags & Amenities!', 'success');
      } else {
        showToast('AI categorization failed', 'error');
      }
    } catch (e) {
      showToast('Error connecting to AI', 'error');
    } finally {
      setIsAiGeneratingCategoryTags(false);
    }
  };

  const handleAiGenerateAltText = async () => {
    if (!editingPlace?.imageUrl) return showToast('Need image URL first', 'error');
    setIsAiGeneratingAltText(true);
    try {
      const alt = await generateImageAltText(editingPlace.imageUrl);
      if (alt) {
        setEditingPlace({ ...editingPlace, imageAlt: alt });
        showToast('AI Alt Text generated!', 'success');
      } else {
        showToast('AI failed to generate alt text', 'error');
      }
    } catch (e) {
      showToast('Error connecting to AI', 'error');
    } finally {
      setIsAiGeneratingAltText(false);
    }
  };

  const handleAiGenerateSeo = async () => {
    if (!editingPlace?.name || !editingPlace?.category)
      return showToast('Need name & category', 'error');
    setIsAiGeneratingSeo(true);
    try {
      const seo = await generateSeoMetaTags(
        editingPlace.name,
        editingPlace.description || '',
        editingPlace.category
      );
      if (seo && seo.options && seo.options.length > 0) {
        setSeoOptions(seo.options);
        showToast('AI Generated 3 SEO Options!', 'success');
      } else {
        showToast('AI failed to generate SEO tags', 'error');
      }
    } catch (e) {
      showToast('Error connecting to AI', 'error');
    } finally {
      setIsAiGeneratingSeo(false);
    }
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

  const handleParseHours = async () => {
    if (!hoursText) return;
    setIsAiParsingHours(true);
    try {
      const parsed = await parseHoursFromText(hoursText);
      if (parsed && parsed.structured) {
        setEditingPlace({
          ...editingPlace!,
          opening_hours: {
            type: 'fixed',
            note: parsed.note || hoursText,
            structured: parsed.structured,
          },
        });
        showToast('Hours parsed & applied!', 'success');
        setShowHoursParser(false);
      } else {
        showToast("AI couldn't parse hours.", 'error');
      }
    } catch (e) {
      showToast('Error parsing hours', 'error');
    } finally {
      setIsAiParsingHours(false);
    }
  };

  const handleGenerateSocialCard = async () => {
    if (!socialCardRef.current || !editingPlace) return;
    setIsGeneratingCard(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const canvas = await html2canvas(socialCardRef.current, {
        useCORS: true,
        scale: 1,
        backgroundColor: '#0f172a',
      });
      const link = document.createElement('a');
      link.download = `CaboRojo_Story_${editingPlace.slug || 'place'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Social Card Downloaded!', 'success');
    } catch (e) {
      showToast('Failed to generate image.', 'error');
    } finally {
      setIsGeneratingCard(false);
    }
  };

  const formatTime12 = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const date = new Date();
    date.setHours(parseInt(h), parseInt(m));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
  };

  const getStructuredHours = () => {
    const existing = editingPlace?.opening_hours?.structured;
    if (existing && existing.length === 7) return existing;
    return Array.from({ length: 7 }, (_, i) => {
      const found = existing?.find((e) => e.day === i);
      return found || { day: i, open: '09:00', close: '17:00', isClosed: false };
    });
  };

  const updateScheduleDay = (idx: number, field: keyof DaySchedule, val: any) => {
    if (!editingPlace) return;
    const structured = [...getStructuredHours()];
    structured[idx] = { ...structured[idx], [field]: val };
    setEditingPlace({
      ...editingPlace,
      opening_hours: {
        ...(editingPlace.opening_hours || {}),
        type: editingPlace.opening_hours?.type || 'fixed',
        structured,
      },
    });
  };

  const applyMonToFri = () => {
    if (!editingPlace) return;
    const structured = [...getStructuredHours()];
    const mon = structured[1];
    for (let i = 2; i <= 5; i++) {
      structured[i] = { ...structured[i], open: mon.open, close: mon.close, isClosed: mon.isClosed };
    }
    setEditingPlace({
      ...editingPlace,
      opening_hours: {
        ...(editingPlace.opening_hours || {}),
        type: editingPlace.opening_hours?.type || 'fixed',
        structured,
      },
    });
    showToast(t('admin_applied_mon_to_fri'), 'success');
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  // Sidebar list (no editing in progress)
  if (!editingPlace) {
    return (
      <>
        {!inboxMode && (
          <div className="flex gap-2 p-2">
            <button
              onClick={() => {
                setEditingPlace({
                  name: '',
                  category: 'FOOD',
                  status: 'open',
                  plan: 'free',
                  parking: ParkingStatus.FREE,
                  defaultZoom: DEFAULT_PLACE_ZOOM,
                });
                setJsonString('{}');
              }}
              className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-teal-500 hover:text-teal-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"
            >
              <i className="fa-solid fa-plus text-lg"></i>
              <span className="text-[10px]">Add New</span>
            </button>
            <button
              onClick={onBulkMode}
              className="flex-1 p-4 rounded-xl border-2 border-dashed border-slate-700 text-purple-400 hover:border-purple-500 hover:text-purple-500 hover:bg-purple-900/10 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"
            >
              <i className="fa-solid fa-layer-group text-lg"></i>
              <span className="text-[10px]">Bulk Ops</span>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center p-8 text-slate-500 text-xs font-bold">
              {inboxMode ? 'No pending places' : 'No places found'}
            </div>
          )}
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setEditingPlace(p);
                setJsonString(JSON.stringify(p.contact_info || {}, null, 2));
              }}
              className="p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] bg-slate-800 border-slate-700 hover:bg-slate-700"
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-sm text-slate-200 truncate">{p.name}</h4>
                <div className="flex items-center gap-2">
                  {!p.imageUrl && (
                    <span className="text-amber-500 text-[10px]" title="No image">
                      <i className="fa-solid fa-image-slash"></i>
                    </span>
                  )}
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 ${
                      p.status === 'open'
                        ? 'bg-emerald-500'
                        : p.status === 'pending'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-red-500'
                    }`}
                  ></div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="uppercase tracking-wider font-bold">{p.category}</span>
                {p.isVerified && <i className="fa-solid fa-circle-check text-teal-500"></i>}
                {p.is_featured && <i className="fa-solid fa-star text-amber-500"></i>}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ─── Place Editor ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
      {/* Smart Import (only for new places) */}
      {!editingPlace.id && (
        <div className="mb-6 relative bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-2xl p-4 flex gap-2 items-center shadow-lg">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/30">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <div className="flex-1 relative">
            <input
              className="w-full bg-transparent text-white placeholder-blue-300/50 outline-none text-sm font-bold"
              placeholder="Paste Google Maps Link or Raw Text to Auto-Fill..."
              value={importQuery}
              onChange={(e) => setImportQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSmartImport(importQuery)}
            />
            {autocompleteSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl mt-3 z-50 shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                {autocompleteSuggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => handleSmartImport(s.description)}
                    className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0 transition-colors"
                  >
                    <p className="text-sm font-bold text-white">
                      {s.structured_formatting?.main_text || s.description}
                    </p>
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
            {importLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Magic Fill / Parse'}
          </button>
        </div>
      )}

      {/* ID + action bar */}
      <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <span className="font-mono text-xs text-slate-500">{editingPlace.id || 'NEW RECORD'}</span>
        <div className="flex items-center gap-3">
          {editingPlace.status === 'pending' && (
            <button
              onClick={() => onSavePlace(true)}
              className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-900/20"
            >
              <i className="fa-solid fa-check mr-2"></i> Approve & Publish
            </button>
          )}
          {editingPlace.id && (
            <button
              onClick={() => onDeletePlace(editingPlace.id!)}
              className="text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors"
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          )}
        </div>
      </div>

      {/* ── Basic Info ── */}
      <Section title={t('admin_basic_info')} icon="circle-info">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label={t('admin_name')}>
            <StyledInput
              value={editingPlace.name || ''}
              onChange={(e) => setEditingPlace({ ...editingPlace, name: e.target.value })}
            />
          </InputGroup>
          <InputGroup label="Slug (URL)">
            <StyledInput
              value={editingPlace.slug || ''}
              onChange={(e) => setEditingPlace({ ...editingPlace, slug: e.target.value })}
              placeholder="place-name-cabo-rojo"
            />
          </InputGroup>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label="Category">
            <StyledSelect
              value={editingPlace.category}
              onChange={(e) => setEditingPlace({ ...editingPlace, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label_es}
                </option>
              ))}
              <option value="HISTORY">Historic / Landmark</option>
              <option value="PROJECT">Project / Development</option>
            </StyledSelect>
          </InputGroup>
          <InputGroup label="Custom Icon" description="e.g. pizza-slice">
            <div className="flex gap-2">
              <StyledInput
                value={editingPlace.customIcon || ''}
                onChange={(e) => setEditingPlace({ ...editingPlace, customIcon: e.target.value })}
                placeholder="pizza-slice"
              />
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 shrink-0">
                {editingPlace.customIcon && (
                  <i className={`fa-solid fa-${editingPlace.customIcon} text-xl text-white`}></i>
                )}
              </div>
            </div>
          </InputGroup>
        </div>
        <InputGroup label="Tags">
          <div className="flex gap-2">
            <StyledInput
              value={editingPlace.tags?.join(', ') || ''}
              onChange={(e) =>
                setEditingPlace({
                  ...editingPlace,
                  tags: e.target.value.split(',').map((t) => t.trim()),
                })
              }
              placeholder="beach, sunset, food"
            />
            <button
              onClick={handleAiSuggestCategoryAndTags}
              disabled={isAiGeneratingCategoryTags}
              className="bg-purple-600/20 text-purple-400 border border-purple-500/50 rounded-xl px-4 flex items-center justify-center shrink-0 font-bold text-[10px] whitespace-nowrap"
            >
              {isAiGeneratingCategoryTags ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <span>
                  <i className="fa-solid fa-wand-magic-sparkles"></i> Auto-Detect
                </span>
              )}
            </button>
          </div>
        </InputGroup>
        <InputGroup label={t('admin_description')}>
          <StyledTextArea
            value={editingPlace.description || ''}
            onChange={(e) => setEditingPlace({ ...editingPlace, description: e.target.value })}
          />
          <button
            onClick={handleAiEnhanceDescription}
            className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 font-bold text-sm py-2 rounded-xl mt-2 flex items-center justify-center gap-2 hover:bg-blue-600/30 transition-colors"
          >
            {isAiEnhancingDescription ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fa-solid fa-pencil"></i>
            )}
            {t('admin_ai_enhance_description')}
          </button>
        </InputGroup>
      </Section>

      {/* ── Location & Contact ── */}
      <Section title="Location & Contact" icon="map-location-dot">
        <InputGroup label="Address">
          <StyledInput
            value={editingPlace.address || ''}
            onChange={(e) => setEditingPlace({ ...editingPlace, address: e.target.value })}
          />
        </InputGroup>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label="Phone">
            <StyledInput
              value={editingPlace.phone || ''}
              onChange={(e) => setEditingPlace({ ...editingPlace, phone: e.target.value })}
            />
          </InputGroup>
          <InputGroup label="Website">
            <StyledInput
              value={editingPlace.website || ''}
              onChange={(e) => setEditingPlace({ ...editingPlace, website: e.target.value })}
            />
          </InputGroup>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <InputGroup label="Latitude">
            <StyledInput
              type="number"
              step="any"
              value={editingPlace.coords?.lat || ''}
              onChange={(e) =>
                setEditingPlace({
                  ...editingPlace,
                  coords: {
                    ...editingPlace.coords,
                    lat: parseFloat(e.target.value) || 0,
                    lng: editingPlace.coords?.lng || 0,
                  },
                })
              }
            />
          </InputGroup>
          <InputGroup label="Longitude">
            <div className="flex gap-2">
              <StyledInput
                type="number"
                step="any"
                value={editingPlace.coords?.lng || ''}
                onChange={(e) =>
                  setEditingPlace({
                    ...editingPlace,
                    coords: {
                      ...editingPlace.coords,
                      lng: parseFloat(e.target.value) || 0,
                      lat: editingPlace.coords?.lat || 0,
                    },
                  })
                }
              />
              <button
                onClick={handleGetLocation}
                className="bg-slate-700 text-white px-3 rounded-xl hover:bg-slate-600 transition-colors"
                title="Get GPS"
              >
                <i className="fa-solid fa-crosshairs"></i>
              </button>
            </div>
          </InputGroup>
        </div>
        <InputGroup label="Google Maps URL">
          <div className="flex gap-2">
            <StyledInput
              value={editingPlace.gmapsUrl || ''}
              onChange={(e) => setEditingPlace({ ...editingPlace, gmapsUrl: e.target.value })}
            />
            <button
              onClick={handleGoogleSync}
              disabled={isSyncing}
              className="bg-slate-700 text-white px-4 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-600 transition-colors"
            >
              {isSyncing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-brands fa-google"></i>}
              Sync
            </button>
          </div>
        </InputGroup>
      </Section>

      {/* ── Media ── */}
      <Section title="Media" icon="image">
        <InputGroup label="Image URL">
          <div className="flex gap-2">
            <StyledInput
              value={editingPlace.imageUrl || ''}
              onChange={(e) => setEditingPlace({ ...editingPlace, imageUrl: e.target.value })}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-slate-700 text-white px-4 rounded-xl flex items-center justify-center min-w-[50px] hover:bg-slate-600 transition-colors"
            >
              {isUploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
            </button>
            <button
              onClick={() => window.open(editingPlace.imageUrl, '_blank')}
              disabled={!editingPlace.imageUrl}
              className="bg-slate-700 text-white px-4 rounded-xl hover:bg-slate-600 transition-colors"
            >
              <i className="fa-solid fa-eye"></i>
            </button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        </InputGroup>
        {editingPlace.imageUrl && (
          <img
            src={editingPlace.imageUrl}
            alt="Preview"
            className="w-full h-48 object-cover rounded-xl mt-2 mb-4 border border-slate-700"
          />
        )}
        <InputGroup label="Image Position">
          <StyledSelect
            value={editingPlace.imagePosition || 'center'}
            onChange={(e) => setEditingPlace({ ...editingPlace, imagePosition: e.target.value })}
          >
            <option value="center">Center</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </StyledSelect>
        </InputGroup>
        <InputGroup label="Image Alt Text">
          <div className="flex gap-2">
            <StyledInput
              value={editingPlace.imageAlt || ''}
              onChange={(e) => setEditingPlace({ ...editingPlace, imageAlt: e.target.value })}
              placeholder="Describe image"
            />
            <button
              onClick={handleAiGenerateAltText}
              disabled={isAiGeneratingAltText || !editingPlace.imageUrl}
              className="bg-blue-600/20 text-blue-400 border border-blue-500/50 rounded-xl px-4 flex items-center justify-center shrink-0"
            >
              {isAiGeneratingAltText ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <i className="fa-solid fa-image"></i>
              )}
            </button>
          </div>
        </InputGroup>
        <InputGroup label="Video URL">
          <StyledInput
            value={editingPlace.videoUrl || ''}
            onChange={(e) => setEditingPlace({ ...editingPlace, videoUrl: e.target.value })}
          />
        </InputGroup>
      </Section>

      {/* ── Operations & Status ── */}
      <Section title="Operations & Status" icon="sliders">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <InputGroup label="Status">
            <StyledSelect
              value={editingPlace.status || 'open'}
              onChange={(e) => setEditingPlace({ ...editingPlace, status: e.target.value as any })}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="pending">Pending</option>
            </StyledSelect>
          </InputGroup>
          <InputGroup label="Price">
            <StyledSelect
              value={editingPlace.priceLevel || '$'}
              onChange={(e) => setEditingPlace({ ...editingPlace, priceLevel: e.target.value })}
            >
              <option value="$">$</option>
              <option value="$$">$$</option>
              <option value="$$$">$$$</option>
              <option value="$$$$">$$$$</option>
            </StyledSelect>
          </InputGroup>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <InputGroup label="Plan">
            <StyledSelect
              value={editingPlace.plan || 'free'}
              onChange={(e) => setEditingPlace({ ...editingPlace, plan: e.target.value as any })}
            >
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </StyledSelect>
          </InputGroup>
          <InputGroup label="Crowd">
            <StyledSelect
              value={editingPlace.crowdLevel || 'MEDIUM'}
              onChange={(e) => setEditingPlace({ ...editingPlace, crowdLevel: e.target.value as any })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </StyledSelect>
          </InputGroup>
        </div>
        <InputGroup label="Sponsor Weight">
          <StyledInput
            type="number"
            min="0"
            max="100"
            value={editingPlace.sponsor_weight || 0}
            onChange={(e) => setEditingPlace({ ...editingPlace, sponsor_weight: parseInt(e.target.value) || 0 })}
          />
        </InputGroup>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          <Toggle
            label="Featured"
            checked={editingPlace.is_featured || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, is_featured: v })}
            icon="star"
          />
          <Toggle
            label="Verified"
            checked={editingPlace.isVerified || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, isVerified: v })}
            icon="circle-check"
          />
          <Toggle
            label="Mobile"
            checked={editingPlace.isMobile || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, isMobile: v })}
            icon="truck-fast"
          />
          <Toggle
            label="Secret"
            checked={editingPlace.isSecret || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, isSecret: v })}
            icon="user-secret"
          />
          <Toggle
            label="Landing"
            checked={editingPlace.isLanding || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, isLanding: v })}
            icon="plane-arrival"
          />
        </div>
      </Section>

      {/* ── Schedule ── */}
      <Section title="Schedule" icon="clock">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label="Type">
            <StyledSelect
              value={editingPlace.opening_hours?.type || 'fixed'}
              onChange={(e) =>
                setEditingPlace({
                  ...editingPlace,
                  opening_hours: {
                    ...(editingPlace.opening_hours || {}),
                    type: e.target.value as any,
                  },
                })
              }
            >
              <option value="fixed">Fixed</option>
              <option value="24_7">24/7</option>
              <option value="sunrise_sunset">Nature</option>
            </StyledSelect>
          </InputGroup>
          <InputGroup label="Note">
            <div className="flex gap-2">
              <StyledInput
                value={editingPlace.opening_hours?.note || ''}
                onChange={(e) =>
                  setEditingPlace({
                    ...editingPlace,
                    opening_hours: {
                      ...(editingPlace.opening_hours || {}),
                      note: e.target.value,
                    },
                  })
                }
              />
              <button
                onClick={() => setShowHoursParser(!showHoursParser)}
                className="bg-slate-700 text-white px-3 rounded-xl hover:bg-slate-600 transition-colors"
              >
                <i className="fa-solid fa-paste"></i>
              </button>
            </div>
          </InputGroup>
        </div>
        {showHoursParser && (
          <div className="mt-3 bg-slate-900/50 p-3 rounded-xl border border-slate-600 animate-fade-in">
            <div className="flex gap-2">
              <StyledInput
                value={hoursText}
                onChange={(e) => setHoursText(e.target.value)}
                placeholder="Paste hours"
              />
              <button
                onClick={handleParseHours}
                disabled={isAiParsingHours || !hoursText}
                className="bg-purple-600 text-white px-4 rounded-xl text-xs font-bold hover:bg-purple-500 whitespace-nowrap"
              >
                {isAiParsingHours ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Parse'}
              </button>
            </div>
          </div>
        )}
        {(editingPlace.opening_hours?.type === 'fixed' || !editingPlace.opening_hours?.type) && (
          <div className="mt-4 bg-slate-900 rounded-xl p-3 border border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Weekly Schedule</h4>
              <button
                onClick={applyMonToFri}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-600 transition-colors"
              >
                Copy M-F
              </button>
            </div>
            <div className="space-y-1">
              {getStructuredHours().map((day, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="w-20 text-slate-400 font-medium">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]}
                  </span>
                  <div
                    className={`flex-1 flex items-center gap-2 ${day.isClosed ? 'opacity-30 pointer-events-none' : ''}`}
                  >
                    <input
                      type="time"
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white w-24"
                      value={day.open}
                      onChange={(e) => updateScheduleDay(idx, 'open', e.target.value)}
                    />
                    <span className="text-[10px] text-slate-500 font-mono w-14 text-center">
                      {formatTime12(day.open)}
                    </span>
                    <span className="text-slate-600">-</span>
                    <input
                      type="time"
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white w-24"
                      value={day.close}
                      onChange={(e) => updateScheduleDay(idx, 'close', e.target.value)}
                    />
                    <span className="text-[10px] text-slate-500 font-mono w-14 text-center">
                      {formatTime12(day.close)}
                    </span>
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={day.isClosed}
                      onChange={(e) => updateScheduleDay(idx, 'isClosed', e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-800 border-slate-700 accent-red-500"
                    />
                    <span
                      className={`text-[10px] uppercase font-bold ${day.isClosed ? 'text-red-500' : 'text-slate-600'}`}
                    >
                      Closed
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Amenities ── */}
      <Section title="Amenities" icon="bell-concierge">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <InputGroup label="Parking">
            <StyledSelect
              value={editingPlace.parking || 'FREE'}
              onChange={(e) => setEditingPlace({ ...editingPlace, parking: e.target.value as any })}
            >
              <option value="FREE">Free</option>
              <option value="PAID">Paid</option>
              <option value="NONE">None</option>
            </StyledSelect>
          </InputGroup>
          <InputGroup label="Best Time">
            <StyledInput
              value={editingPlace.bestTimeToVisit || ''}
              onChange={(e) => setEditingPlace({ ...editingPlace, bestTimeToVisit: e.target.value })}
            />
          </InputGroup>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Toggle
            label="Restroom"
            checked={editingPlace.hasRestroom || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, hasRestroom: v })}
            icon="restroom"
          />
          <Toggle
            label="Showers"
            checked={editingPlace.hasShowers || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, hasShowers: v })}
            icon="shower"
          />
          <Toggle
            label="Pet Friendly"
            checked={editingPlace.isPetFriendly || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, isPetFriendly: v })}
            icon="dog"
          />
          <Toggle
            label="Handicap"
            checked={editingPlace.isHandicapAccessible || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, isHandicapAccessible: v })}
            icon="wheelchair"
          />
          <Toggle
            label="Generator"
            checked={editingPlace.hasGenerator || false}
            onChange={(v) => setEditingPlace({ ...editingPlace, hasGenerator: v })}
            icon="bolt"
          />
        </div>
      </Section>

      {/* ── Vibe & Tips ── */}
      <Section title="Vibe & Tips" icon="wand-magic-sparkles">
        <InputGroup label="Vibe">
          <StyledInput
            value={editingPlace.vibe?.join(', ') || ''}
            onChange={(e) =>
              setEditingPlace({
                ...editingPlace,
                vibe: e.target.value.split(',').map((t) => t.trim()),
              })
            }
          />
        </InputGroup>
        <InputGroup label="Tip">
          <StyledTextArea
            value={editingPlace.tips || ''}
            onChange={(e) => setEditingPlace({ ...editingPlace, tips: e.target.value })}
          />
          <button
            onClick={handleAiGenerateTip}
            disabled={isAiGeneratingTip}
            className="w-full bg-orange-500/20 text-orange-400 border border-orange-500/50 font-bold text-sm py-2 rounded-xl mt-2 flex items-center justify-center gap-2"
          >
            {isAiGeneratingTip ? <i className="fa-solid fa-circle-notch fa-spin"></i> : null}
            {t('admin_ai_generate_tip')}
          </button>
        </InputGroup>
      </Section>

      {/* ── SEO ── */}
      <Section title="SEO" icon="magnifying-glass">
        <div className="flex justify-end mb-2">
          <button
            onClick={handleAiGenerateSeo}
            disabled={isAiGeneratingSeo || !editingPlace.name}
            className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            {isAiGeneratingSeo ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fa-solid fa-robot"></i>
            )}{' '}
            Generate
          </button>
        </div>
        {seoOptions.length > 0 && (
          <div className="grid grid-cols-1 gap-3 mb-4">
            {seoOptions.map((opt, i) => (
              <div
                key={i}
                onClick={() =>
                  setEditingPlace({
                    ...editingPlace,
                    metaTitle: opt.metaTitle,
                    metaDescription: opt.metaDescription,
                  })
                }
                className="bg-slate-900 border border-slate-700 p-3 rounded-xl cursor-pointer hover:bg-slate-800 hover:border-teal-500 transition-colors group"
              >
                <p className="text-xs font-bold text-teal-400 mb-1">Option {i + 1}</p>
                <p className="text-sm font-bold text-white mb-1">{opt.metaTitle}</p>
                <p className="text-xs text-slate-400">{opt.metaDescription}</p>
              </div>
            ))}
          </div>
        )}
        <InputGroup label="Meta Title">
          <StyledInput
            value={editingPlace.metaTitle || ''}
            onChange={(e) => setEditingPlace({ ...editingPlace, metaTitle: e.target.value })}
          />
        </InputGroup>
        <InputGroup label="Meta Description">
          <StyledTextArea
            value={editingPlace.metaDescription || ''}
            onChange={(e) => setEditingPlace({ ...editingPlace, metaDescription: e.target.value })}
            className="min-h-[80px]"
          />
        </InputGroup>
      </Section>

      {/* ── AI Marketing Studio ── */}
      <Section title={t('admin_ai_marketing_studio')} icon="bullhorn">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <InputGroup label={t('admin_platform')}>
            <StyledSelect
              value={marketingPlatform}
              onChange={(e) => setMarketingPlatform(e.target.value as any)}
            >
              <option value="instagram">Instagram</option>
              <option value="radio">Radio Script</option>
              <option value="email">Email</option>
              <option value="campaign_bundle">Campaign</option>
            </StyledSelect>
          </InputGroup>
          <InputGroup label={t('admin_tone')}>
            <StyledSelect value={marketingTone} onChange={(e) => setMarketingTone(e.target.value as any)}>
              <option value="hype">Hype</option>
              <option value="chill">Chill</option>
              <option value="professional">Pro</option>
            </StyledSelect>
          </InputGroup>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={handleGenerateMarketing}
            disabled={isGeneratingMarketing || !editingPlace.name}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isGeneratingMarketing ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            )}{' '}
            {t('admin_generate_copy')}
          </button>
          <button
            onClick={handleGenerateSocialCard}
            disabled={isGeneratingCard || !editingPlace.name || !editingPlace.imageUrl}
            className="w-full bg-slate-700 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-slate-600"
          >
            {isGeneratingCard ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fa-solid fa-image"></i>
            )}{' '}
            Generate Image
          </button>
        </div>
        {marketingResult && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 relative group">
            <textarea
              className="w-full bg-transparent text-slate-300 text-sm h-32 outline-none resize-none font-mono"
              value={marketingResult}
              readOnly
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(marketingResult);
                showToast(t('copied'), 'success');
              }}
              className="absolute top-2 right-2 bg-slate-800 text-slate-400 hover:text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <i className="fa-regular fa-copy"></i>
            </button>
          </div>
        )}
        <SocialCardTemplate ref={socialCardRef} place={editingPlace} />
      </Section>
      <div className="h-12"></div>
    </div>
  );
};
