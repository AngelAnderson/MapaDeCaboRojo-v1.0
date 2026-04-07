
import React, { useState, useEffect } from 'react';
import { Place, Event, Category, AdminLog, Person } from '../../types';
import {
  updatePlace,
  deletePlace,
  createPlace,
  updateEvent,
  deleteEvent,
  createEvent,
  getAdminLogs,
  loginAdmin,
  checkSession,
  createCategory,
  updateCategory,
  deleteCategory,
  createPerson,
  updatePerson,
  deletePerson,
  getPeople,
  uploadImage,
} from '../../services/supabase';
import { useLanguage } from '../../i18n/LanguageContext';
import { Toast } from './shared';
import { PlacesManager } from './PlacesManager';
import { EventsManager } from './EventsManager';
import { CategoriesManager } from './CategoriesManager';
import { PeopleManager } from './PeopleManager';
import { BulkTools } from './BulkTools';
import { InsightsDashboard } from './InsightsDashboard';
import { AdminLogs } from './AdminLogs';
import { useRef } from 'react';

interface AdminShellProps {
  onClose: () => void;
  places: Place[];
  events: Event[];
  categories?: Category[];
  onUpdate: () => void;
}

type Tab = 'dashboard' | 'inbox' | 'places' | 'events' | 'logs' | 'categories' | 'people';

export const AdminShell: React.FC<AdminShellProps> = ({
  onClose,
  places,
  events,
  categories = [],
  onUpdate,
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [bulkMode, setBulkMode] = useState(false);

  // ─── Editing state ────────────────────────────────────────────────────────────
  const [editingPlace, setEditingPlace] = useState<Partial<Place> | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingPerson, setEditingPerson] = useState<Partial<Person> | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  // ─── Shared form state ────────────────────────────────────────────────────────
  const [jsonString, setJsonString] = useState('{}');
  const [seoOptions, setSeoOptions] = useState<{ metaTitle: string; metaDescription: string }[]>([]);

  // ─── Logs ────────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<AdminLog[]>([]);

  // ─── UI ──────────────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ─── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkSession().then((hasSession) => {
      if (hasSession) setIsAuthenticated(true);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'people') getPeople().then(setPeople);
    if (activeTab === 'logs') {
      getAdminLogs(50).then(setLogs);
    }
  }, [activeTab, isAuthenticated]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const clearEditing = () => {
    setEditingPlace(null);
    setEditingEvent(null);
    setEditingCategory(null);
    setEditingPerson(null);
    setBulkMode(false);
  };

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) return showToast(t('admin_enter_credentials'), 'error');
    setAuthLoading(true);
    const res = await loginAdmin(email, password);
    setAuthLoading(false);
    if (res.user) setIsAuthenticated(true);
    else showToast(res.error || t('admin_login_failed'), 'error');
  };

  // ─── Place CRUD ───────────────────────────────────────────────────────────────
  const handleSavePlace = async (autoApprove = false) => {
    if (!editingPlace || !editingPlace.name) return showToast(t('admin_name_required'), 'error');
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

  // ─── Event CRUD ───────────────────────────────────────────────────────────────
  const handleSaveEvent = async () => {
    if (!editingEvent || !editingEvent.title) return showToast(t('admin_title_required'), 'error');
    setIsSaving(true);
    try {
      if (editingEvent.id) {
        const res = await updateEvent(editingEvent.id, editingEvent);
        if (!res.success) throw new Error(res.error);
      } else {
        const res = await createEvent(editingEvent);
        if (!res.success) throw new Error(res.error);
      }
      await onUpdate();
      showToast(t('admin_event_saved'), 'success');
      setEditingEvent(null);
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
      } catch (e) {
        showToast(t('admin_unexpected_delete_error'), 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // ─── Category CRUD ────────────────────────────────────────────────────────────
  const handleSaveCategory = async () => {
    if (!editingCategory || !editingCategory.id || !editingCategory.label_es)
      return showToast('ID and Label (ES) required', 'error');
    setIsSaving(true);
    try {
      const exists = categories.find((c) => c.id === editingCategory.id);
      if (exists) {
        await updateCategory(editingCategory.id, editingCategory);
      } else {
        await createCategory(editingCategory as Category);
      }
      await onUpdate();
      showToast('Category saved', 'success');
      setEditingCategory(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Delete category?')) {
      setIsSaving(true);
      try {
        await deleteCategory(id);
        await onUpdate();
        showToast('Category deleted', 'success');
        setEditingCategory(null);
      } catch (e) {
        showToast('Error', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // ─── Person CRUD ──────────────────────────────────────────────────────────────
  const handleSavePerson = async () => {
    if (!editingPerson || !editingPerson.name) return showToast('Name required', 'error');
    setIsSaving(true);
    try {
      if (editingPerson.id) {
        await updatePerson(editingPerson.id, editingPerson);
      } else {
        await createPerson(editingPerson);
      }
      setPeople(await getPeople());
      await onUpdate();
      showToast('Person saved', 'success');
      setEditingPerson(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePerson = async (id: string) => {
    if (confirm('Delete Person?')) {
      setIsSaving(true);
      try {
        await deletePerson(id);
        setPeople(await getPeople());
        await onUpdate();
        showToast('Deleted', 'success');
        setEditingPerson(null);
      } catch (e) {
        showToast('Error', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // ─── Image upload (shared for places + people) ────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadImage(file);
      if (res.success && res.url) {
        if (editingPerson) setEditingPerson((prev) => ({ ...prev!, imageUrl: res.url }));
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

  // ─── Bulk verify all ──────────────────────────────────────────────────────────
  const handleBulkVerify = async () => {
    const unverified = places.filter((p) => !p.isVerified && p.status === 'open');
    if (unverified.length === 0) return showToast('All places already verified!', 'success');
    if (!confirm(`Verify ${unverified.length} places?`)) return;
    setIsSaving(true);
    try {
      for (const p of unverified) {
        await updatePlace(p.id, { isVerified: true });
      }
      await onUpdate();
      showToast(`Verified ${unverified.length} places!`, 'success');
    } catch (e) {
      showToast('Error during bulk verify', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Computed stats for dashboard ────────────────────────────────────────────
  const openPlaces = places.filter((p) => p.status === 'open');
  const pendingPlaces = places.filter((p) => p.status === 'pending');
  const dashboardStats = {
    total: openPlaces.length,
    verified: openPlaces.filter((p) => p.isVerified).length,
    withImages: openPlaces.filter((p) => !!p.imageUrl).length,
    withHours: openPlaces.filter((p) => !!p.opening_hours).length,
  };
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const eventsThisWeek = events.filter((e) => {
    const d = new Date(e.startTime);
    return d >= now && d <= weekFromNow;
  }).length;

  const isEditing = editingPlace || editingEvent || editingCategory || editingPerson;
  const showSearchBar =
    !isEditing &&
    (activeTab === 'places' || activeTab === 'inbox' || activeTab === 'events' || activeTab === 'categories' || activeTab === 'people');
  const showSidebar = activeTab !== 'logs' && activeTab !== 'dashboard';

  // ─── Login screen ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 z-[5000] flex items-center justify-center p-4 backdrop-blur-md">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <div className="bg-slate-800 border border-slate-700 w-full max-w-md p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
          >
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
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                {t('admin_email_placeholder')}
              </label>
              <input
                type="email"
                className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl focus:border-teal-500 outline-none transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">
                {t('admin_password_placeholder')}
              </label>
              <input
                type="password"
                className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl focus:border-teal-500 outline-none transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={authLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {authLoading ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <i className="fa-solid fa-arrow-right-to-bracket"></i>
              )}
              <span>{t('admin_login_button')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main shell ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900 z-[5000] flex flex-col font-sans text-slate-200">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 p-3 flex justify-between items-center shadow-md z-20 h-16 shrink-0">
        {isEditing || bulkMode ? (
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={clearEditing}
              className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 active:bg-slate-700 transition-colors"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('admin_editing')}</h2>
              <p className="text-white font-bold truncate">
                {editingPlace?.name ||
                  editingEvent?.title ||
                  editingCategory?.id ||
                  editingPerson?.name ||
                  (bulkMode ? 'Bulk Tools' : t('admin_new_item'))}
              </p>
            </div>
            {!bulkMode && (
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
            )}
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
              {(
                [
                  { id: 'dashboard', label: 'Dashboard', icon: 'gauge' },
                  { id: 'inbox', label: t('admin_inbox'), badge: pendingPlaces.length },
                  { id: 'places', label: t('admin_places') },
                  { id: 'events', label: t('admin_events') },
                  { id: 'people', label: 'People' },
                  { id: 'categories', label: 'Cats' },
                  { id: 'logs', label: t('admin_logs') },
                ] as { id: Tab; label: string; icon?: string; badge?: number }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    clearEditing();
                    setSearchTerm('');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 whitespace-nowrap ${
                    activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-500'
                  }`}
                >
                  {tab.icon && <i className={`fa-solid fa-${tab.icon} text-[10px]`}></i>}
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="bg-red-500 text-white px-1.5 rounded-full text-[9px]">{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-700"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Sidebar */}
        {showSidebar && !bulkMode && (
          <div
            className={`w-full md:w-80 border-r border-slate-700 bg-slate-900 flex flex-col ${
              isEditing ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Search bar */}
            {showSearchBar && (
              <div className="p-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-500 transition-colors">
                    <i className="fa-solid fa-magnifying-glass text-xs"></i>
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('admin_search_placeholder') || 'Search...'}
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

            {/* Tab-specific sidebar content */}
            {(activeTab === 'places' || activeTab === 'inbox') && (
              <PlacesManager
                places={places}
                searchTerm={searchTerm}
                editingPlace={editingPlace}
                setEditingPlace={setEditingPlace}
                onSavePlace={handleSavePlace}
                onDeletePlace={handleDeletePlace}
                onBulkMode={() => setBulkMode(true)}
                categories={categories}
                isSaving={isSaving}
                isUploading={isUploading}
                setIsUploading={setIsUploading}
                showToast={showToast}
                jsonString={jsonString}
                setJsonString={setJsonString}
                seoOptions={seoOptions}
                setSeoOptions={setSeoOptions}
                inboxMode={activeTab === 'inbox'}
              />
            )}

            {activeTab === 'events' && (
              <EventsManager
                events={events}
                searchTerm={searchTerm}
                editingEvent={editingEvent}
                setEditingEvent={setEditingEvent}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                isSaving={isSaving}
              />
            )}

            {activeTab === 'categories' && (
              <CategoriesManager
                categories={categories}
                searchTerm={searchTerm}
                editingCategory={editingCategory}
                setEditingCategory={setEditingCategory}
                onSave={handleSaveCategory}
                onDelete={handleDeleteCategory}
                isSaving={isSaving}
              />
            )}

            {activeTab === 'people' && (
              <PeopleManager
                people={people}
                searchTerm={searchTerm}
                editingPerson={editingPerson}
                setEditingPerson={setEditingPerson}
                onSave={handleSavePerson}
                onDelete={handleDeletePerson}
                onImageUpload={handleImageUpload}
                fileInputRef={fileInputRef}
                isUploading={isUploading}
                isSaving={isSaving}
              />
            )}
          </div>
        )}

        {/* Main content area */}
        <div
          className={`flex-1 bg-slate-900 overflow-y-auto custom-scrollbar ${
            isEditing || bulkMode ? 'absolute inset-0 z-10 md:static' : ''
          }`}
        >
          {/* Dashboard */}
          {activeTab === 'dashboard' && !isEditing && (
            <InsightsDashboard
              places={dashboardStats}
              eventsThisWeek={eventsThisWeek}
              onNavigatePlaces={() => { setActiveTab('places'); clearEditing(); }}
              onNavigateEvents={() => { setActiveTab('events'); clearEditing(); }}
              onBulkVerify={handleBulkVerify}
              categories={categories}
              showToast={showToast}
            />
          )}

          {/* Bulk mode */}
          {bulkMode && (
            <BulkTools
              categories={categories}
              onUpdate={onUpdate}
              onCancel={() => setBulkMode(false)}
              showToast={showToast}
            />
          )}

          {/* Place editor (md+ shows inline, mobile overlays) */}
          {(activeTab === 'places' || activeTab === 'inbox') && editingPlace && (
            <PlacesManager
              places={places}
              searchTerm={searchTerm}
              editingPlace={editingPlace}
              setEditingPlace={setEditingPlace}
              onSavePlace={handleSavePlace}
              onDeletePlace={handleDeletePlace}
              onBulkMode={() => setBulkMode(true)}
              categories={categories}
              isSaving={isSaving}
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              showToast={showToast}
              jsonString={jsonString}
              setJsonString={setJsonString}
              seoOptions={seoOptions}
              setSeoOptions={setSeoOptions}
              inboxMode={activeTab === 'inbox'}
            />
          )}

          {/* Event editor */}
          {activeTab === 'events' && editingEvent && (
            <EventsManager
              events={events}
              searchTerm={searchTerm}
              editingEvent={editingEvent}
              setEditingEvent={setEditingEvent}
              onSave={handleSaveEvent}
              onDelete={handleDeleteEvent}
              isSaving={isSaving}
            />
          )}

          {/* Category editor */}
          {activeTab === 'categories' && editingCategory && (
            <CategoriesManager
              categories={categories}
              searchTerm={searchTerm}
              editingCategory={editingCategory}
              setEditingCategory={setEditingCategory}
              onSave={handleSaveCategory}
              onDelete={handleDeleteCategory}
              isSaving={isSaving}
            />
          )}

          {/* Person editor */}
          {activeTab === 'people' && editingPerson && (
            <PeopleManager
              people={people}
              searchTerm={searchTerm}
              editingPerson={editingPerson}
              setEditingPerson={setEditingPerson}
              onSave={handleSavePerson}
              onDelete={handleDeletePerson}
              onImageUpload={handleImageUpload}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              isSaving={isSaving}
            />
          )}

          {/* Logs */}
          {activeTab === 'logs' && <AdminLogs logs={logs} />}

          {/* Empty state */}
          {!isEditing &&
            !bulkMode &&
            activeTab !== 'logs' &&
            activeTab !== 'dashboard' && (
              <div className="hidden md:flex flex-col items-center justify-center h-full text-center text-slate-500 opacity-50">
                <i className="fa-solid fa-hand-pointer text-4xl mb-4"></i>
                <p>{t('admin_select_item')}</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
