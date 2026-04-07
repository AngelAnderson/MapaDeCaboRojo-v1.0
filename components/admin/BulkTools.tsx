
import React, { useState } from 'react';
import { Category, Place } from '../../types';
import { createPlace } from '../../services/supabase';
import { parseBulkPlaces } from '../../services/aiService';
import { Section, StyledTextArea, StyledSelect } from './shared';
import { useLanguage } from '../../i18n/LanguageContext';

interface BulkToolsProps {
  categories: Category[];
  onUpdate: () => void;
  onCancel: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const BulkTools: React.FC<BulkToolsProps> = ({ categories, onUpdate, onCancel, showToast }) => {
  const { t } = useLanguage();
  const [bulkTab, setBulkTab] = useState<'osm' | 'wikidata' | 'jca' | 'social'>('osm');
  const [bulkInput, setBulkInput] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<Partial<Place>[]>([]);
  const [osmCategory, setOsmCategory] = useState('FOOD');
  const [osmLoading, setOsmLoading] = useState(false);

  const handleBulkMagic = async () => {
    if (!bulkInput) return;
    setBulkProcessing(true);
    try {
      const results = await parseBulkPlaces(bulkInput);
      if (Array.isArray(results) && results.length > 0) {
        setBulkResults(results);
        showToast(`Parsed ${results.length} items! Review and save.`, 'success');
      } else {
        showToast('No items parsed.', 'error');
      }
    } catch (e) {
      showToast('Bulk AI Failed.', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleOsmImport = async () => {
    setOsmLoading(true);
    try {
      const res = await fetch('/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import-osm', categoryKey: osmCategory }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.results.length > 0) {
          setBulkResults((prev) => [...prev, ...data.results]);
          showToast(t('admin_osm_success', { count: data.count }), 'success');
        } else {
          showToast(t('admin_osm_no_new'), 'error');
        }
      } else {
        showToast(data.error || 'OSM Import Failed', 'error');
      }
    } catch (e) {
      showToast('Network Error', 'error');
    } finally {
      setOsmLoading(false);
    }
  };

  const handleWikidataImport = async () => {
    setOsmLoading(true);
    try {
      const res = await fetch('/api/ops', {
        method: 'POST',
        body: JSON.stringify({ action: 'import-wikidata' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.results.length > 0) {
          setBulkResults((prev) => [...prev, ...data.results]);
          showToast(`Found ${data.results.length} historic/cultural sites!`, 'success');
        } else {
          showToast('No new historic sites found.', 'error');
        }
      } else {
        showToast(data.error || 'Wikidata Error', 'error');
      }
    } catch (e) {
      showToast('Network Error', 'error');
    } finally {
      setOsmLoading(false);
    }
  };

  const handleJcaAnalysis = async () => {
    if (!bulkInput) return showToast('Paste report text first.', 'error');
    setBulkProcessing(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze-jca', payload: { reportText: bulkInput } }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Updated ${data.updates.length} beaches!`, 'success');
        setBulkInput('');
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast('Error', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleSocialTrendAnalysis = async () => {
    if (!bulkInput) return showToast('Paste social text.', 'error');
    setBulkProcessing(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze-trends', payload: { socialText: bulkInput } }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBulkResults(data.results);
        showToast(`Found ${data.results.length} trending spots!`, 'success');
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) {
      showToast('Error', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const saveBulkItem = async (index: number) => {
    const item = bulkResults[index];
    if (!item) return;
    try {
      const res = await createPlace({ ...item, status: 'pending', isVerified: false, defaultZoom: 16 });
      if (res.success) {
        const newResults = [...bulkResults];
        newResults.splice(index, 1);
        setBulkResults(newResults);
        onUpdate();
        showToast(`Saved ${item.name} to Pending Review`, 'success');
      } else {
        showToast('Error saving item', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-white">Magic Import & Bulk Tools</h2>
        <button
          onClick={onCancel}
          className="bg-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-lg border border-slate-700 text-sm font-bold"
        >
          Cancel
        </button>
      </div>

      <div className="flex bg-slate-800 p-1 rounded-xl mb-6">
        {(['osm', 'wikidata', 'jca', 'social'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setBulkTab(tab)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
              bulkTab === tab ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'
            }`}
          >
            {{ osm: 'OpenStreetMap', wikidata: 'Wikidata', jca: 'JCA Water', social: 'Social Trends' }[tab]}
          </button>
        ))}
      </div>

      {bulkTab === 'osm' && (
        <Section title={t('admin_osm_import_title')} icon="map">
          <p className="text-xs text-slate-400 mb-2">{t('admin_osm_import_desc')}</p>
          <div className="flex gap-2">
            <StyledSelect value={osmCategory} onChange={(e) => setOsmCategory(e.target.value)} className="flex-1">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label_es}
                </option>
              ))}
              <option value="SERVICE">Servicios</option>
            </StyledSelect>
            <button
              onClick={handleOsmImport}
              disabled={osmLoading}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              {osmLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-satellite-dish"></i>}
              {t('admin_osm_scan_btn')}
            </button>
          </div>
        </Section>
      )}

      {bulkTab === 'wikidata' && (
        <Section title="Wikidata Historic Import" icon="landmark">
          <p className="text-xs text-slate-400 mb-2">
            Fetches monuments, historic sites, and cultural landmarks directly from Wikidata (SPARQL).
          </p>
          <button
            onClick={handleWikidataImport}
            disabled={osmLoading}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            {osmLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-book-atlas"></i>}
            Scan History & Landmarks
          </button>
        </Section>
      )}

      {bulkTab === 'jca' && (
        <Section title="JCA Water Quality Sync" icon="water">
          <p className="text-xs text-slate-400 mb-2">
            Paste the text of the latest JCA/DRNA report. AI will update the status of matching beaches (Safe/Unsafe).
          </p>
          <StyledTextArea
            placeholder="Paste report text here..."
            className="h-48 font-mono text-xs mb-3"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
          />
          <button
            onClick={handleJcaAnalysis}
            disabled={bulkProcessing || !bulkInput}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            {bulkProcessing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-vial"></i>}
            Update Beach Status
          </button>
        </Section>
      )}

      {bulkTab === 'social' && (
        <Section title="Social Trend Scout" icon="hashtag">
          <p className="text-xs text-slate-400 mb-2">
            Paste captions/descriptions from Instagram/TikTok. AI will extract mentioned places as "New Trends".
          </p>
          <StyledTextArea
            placeholder="Paste social media captions here..."
            className="h-48 font-mono text-xs mb-3"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
          />
          <button
            onClick={handleSocialTrendAnalysis}
            disabled={bulkProcessing || !bulkInput}
            className="w-full bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            {bulkProcessing ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            )}
            Extract Trending Spots
          </button>
        </Section>
      )}

      {bulkTab === 'osm' && (
        <Section title="AI Magic Parser (Raw Text)" icon="wand-magic-sparkles">
          <p className="text-xs text-slate-400 mb-2">
            Paste a raw list of places (names, descriptions, addresses) and let AI structure them for you.
          </p>
          <StyledTextArea
            placeholder={`Example: El Meson Sandwiches, Cabo Rojo - Good breakfast place. Open 6am.\nPlaya Buyé - Beautiful beach with calm waters.`}
            className="h-48 font-mono text-xs"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
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
      )}

      {bulkResults.length > 0 && (
        <div className="space-y-3 mt-6">
          <h3 className="font-bold text-white mb-2">Results ({bulkResults.length})</h3>
          {bulkResults.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group"
            >
              <div>
                <h4 className="font-bold text-white">{item.name}</h4>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded mr-2">{item.category}</span>
                <span className="text-xs text-slate-500">{item.description?.substring(0, 50)}...</span>
              </div>
              <button
                onClick={() => saveBulkItem(idx)}
                className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white p-2 rounded-lg transition-colors"
              >
                <i className="fa-solid fa-plus"></i> {t('save')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
