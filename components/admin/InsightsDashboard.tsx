
import React, { useState, useEffect } from 'react';
import { InsightSnapshot } from '../../types';
import { getAdminLogs, getLatestInsights, saveInsightSnapshot } from '../../services/supabase';
import { analyzeUserDemand, generateAdminReport } from '../../services/aiService';

interface InsightsDashboardProps {
  places: { total: number; verified: number; withImages: number; withHours: number };
  eventsThisWeek: number;
  onNavigatePlaces: () => void;
  onNavigateEvents: () => void;
  onBulkVerify: () => void;
  categories: { id: string }[];
  showToast: (msg: string, type: 'success' | 'error') => void;
}

const BotPerformance = () => {
  const [botData, setBotData] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    import('../../services/supabase').then(({ supabase }) => {
      supabase
        .from('messages')
        .select('context')
        .eq('direction', 'outbound')
        .eq('intent', 'ai_places')
        .then(({ data }: any) => {
          if (!data) {
            setLoading(false);
            return;
          }
          const counts: Record<string, number> = {};
          for (const m of data) {
            const name = m.context?.recommended_name;
            if (name) counts[name] = (counts[name] || 0) + 1;
          }
          const sorted = Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);
          setBotData(sorted);
          setLoading(false);
        });
    });
  }, []);

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
      <h3 className="text-lg font-bold text-teal-400 mb-4 flex items-center gap-2">
        <i className="fa-solid fa-robot"></i> Bot *7711 Performance
      </h3>
      {loading ? (
        <div className="text-center py-4 text-slate-400">
          <i className="fa-solid fa-circle-notch fa-spin"></i> Loading...
        </div>
      ) : botData.length === 0 ? (
        <p className="text-slate-500 text-sm">No recommendation data yet.</p>
      ) : (
        <div className="space-y-2">
          {botData.map((b, i) => (
            <div key={i} className="flex justify-between items-center py-1 border-b border-slate-700/50">
              <span className="text-slate-300 text-sm truncate flex-1">{b.name}</span>
              <span className="text-teal-400 font-bold text-sm ml-2">{b.count}x</span>
            </div>
          ))}
          <p className="text-[10px] text-slate-500 mt-2">Data from bot *7711 + website chat recommendations</p>
        </div>
      )}
    </div>
  );
};

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  places,
  eventsThisWeek,
  onNavigatePlaces,
  onNavigateEvents,
  onBulkVerify,
  categories,
  showToast,
}) => {
  const [topSearches, setTopSearches] = useState<{ term: string; count: number }[]>([]);
  const [demandAnalysis, setDemandAnalysis] = useState<InsightSnapshot | null>(null);
  const [isAnalyzingDemand, setIsAnalyzingDemand] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    getAdminLogs(500).then((fetchedLogs) => {
      const uLogs = fetchedLogs.filter((l) => l.action === 'USER_SEARCH');
      const searchCounts: Record<string, number> = {};
      uLogs.forEach((l) => {
        const term = l.place_name.trim().toLowerCase();
        if (term.length > 2) searchCounts[term] = (searchCounts[term] || 0) + 1;
      });
      const sortedSearches = Object.entries(searchCounts)
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setTopSearches(sortedSearches);
    });

    getLatestInsights().then((history) => {
      if (history.length > 0) setDemandAnalysis(history[0]);
    });
  }, []);

  const handleRunDemandAnalysis = async () => {
    setIsAnalyzingDemand(true);
    try {
      const searchTerms = topSearches.map((s) => s.term);
      const categoryIds = categories.map((c) => c.id);
      if (searchTerms.length === 0) {
        showToast('No search data available yet.', 'error');
        setIsAnalyzingDemand(false);
        return;
      }
      const analysis = await analyzeUserDemand(searchTerms, categoryIds);
      if (analysis) {
        setDemandAnalysis(analysis);
        saveInsightSnapshot(analysis);
        showToast('Analysis Complete', 'success');
      } else {
        showToast('Analysis Failed', 'error');
      }
    } catch (e) {
      showToast('Error running analysis', 'error');
    } finally {
      setIsAnalyzingDemand(false);
    }
  };

  const handleGenerateReport = async (range: 'weekly' | 'monthly') => {
    setIsGeneratingReport(true);
    setReportText('');
    try {
      const report = await generateAdminReport(range);
      if (report) {
        setReportText(report);
        showToast('Report Generated', 'success');
      } else {
        showToast('Failed to generate report', 'error');
      }
    } catch (e) {
      showToast('Error generating report', 'error');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExportReport = () => {
    if (!reportText) return;
    const element = document.createElement('a');
    const file = new Blob([reportText], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `Executive_Report_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Report Exported', 'success');
  };

  const noImage = places.total - places.withImages;
  const noHours = places.total - places.withHours;
  const unverified = places.total - places.verified;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button
          onClick={onNavigatePlaces}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-left hover:border-teal-500/50 transition-colors group"
        >
          <div className="text-3xl font-black text-white mb-1 group-hover:text-teal-400 transition-colors">
            {places.total}
          </div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Places</div>
        </button>

        <button
          onClick={onNavigatePlaces}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-left hover:border-emerald-500/50 transition-colors group"
        >
          <div className="text-3xl font-black text-emerald-400 mb-1">{places.verified}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Verified</div>
          {unverified > 0 && (
            <div className="text-[10px] text-amber-400 mt-1 font-bold">{unverified} unverified</div>
          )}
        </button>

        <button
          onClick={onNavigatePlaces}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-left hover:border-amber-500/50 transition-colors group"
        >
          <div className="text-3xl font-black text-amber-400 mb-1">{noImage}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">No Image</div>
          <div className="text-[10px] text-slate-500 mt-1">{places.withImages} have images</div>
        </button>

        <button
          onClick={onNavigateEvents}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-left hover:border-purple-500/50 transition-colors group"
        >
          <div className="text-3xl font-black text-purple-400 mb-1">{eventsThisWeek}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Events This Week</div>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onBulkVerify}
            className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-circle-check"></i> Bulk Verify All
          </button>
          <button
            onClick={handleRunDemandAnalysis}
            disabled={isAnalyzingDemand}
            className="bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isAnalyzingDemand ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            )}
            Run AI Categorization
          </button>
        </div>
      </div>

      {/* Executive Reports */}
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-file-contract text-blue-400"></i> Executive Reports
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleGenerateReport('weekly')}
              disabled={isGeneratingReport}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isGeneratingReport && <i className="fa-solid fa-circle-notch fa-spin"></i>} Weekly
            </button>
            <button
              onClick={() => handleGenerateReport('monthly')}
              disabled={isGeneratingReport}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isGeneratingReport && <i className="fa-solid fa-circle-notch fa-spin"></i>} Monthly
            </button>
          </div>
        </div>
        {isGeneratingReport && (
          <div className="text-center py-8 text-slate-400">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
            <p className="text-xs">Generating report...</p>
          </div>
        )}
        {reportText && !isGeneratingReport && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-600 relative group max-h-96 overflow-y-auto custom-scrollbar">
            <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono leading-relaxed">{reportText}</pre>
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(reportText);
                  showToast('Copied to clipboard', 'success');
                }}
                className="bg-slate-800 text-slate-400 hover:text-white p-2 rounded-lg border border-slate-700"
              >
                <i className="fa-regular fa-copy"></i>
              </button>
              <button
                onClick={handleExportReport}
                className="bg-slate-800 text-slate-400 hover:text-white p-2 rounded-lg border border-slate-700"
              >
                <i className="fa-solid fa-download"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Searches + Demand Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-lg font-bold text-teal-400 mb-4">Top Searches</h3>
          <div className="space-y-3">
            {topSearches.map((s, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-slate-300">{s.term}</span>
                <span className="text-slate-500">{s.count}</span>
              </div>
            ))}
            {topSearches.length === 0 && <p className="text-slate-500 text-sm">No search data yet.</p>}
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-lg font-bold text-purple-400 mb-2">Demand Analysis</h3>
          {demandAnalysis ? (
            <div className="animate-fade-in">
              <p className="text-sm text-slate-200 mb-2">{demandAnalysis.recommendation}</p>
              <p className="text-xs text-slate-400 italic">User Intent: {demandAnalysis.user_intent_prediction}</p>
            </div>
          ) : (
            <button
              onClick={handleRunDemandAnalysis}
              disabled={isAnalyzingDemand}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isAnalyzingDemand ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              )}
              Run Analysis
            </button>
          )}
        </div>
      </div>

      {/* Bot Performance */}
      <BotPerformance />
    </div>
  );
};
