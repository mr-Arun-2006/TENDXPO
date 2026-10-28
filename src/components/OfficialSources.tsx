import React, { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck, Info } from 'lucide-react';
import { apiJson } from '../services/api';

interface Source {
  id: string;
  name: string;
  url: string;
  access: 'live-api' | 'link-only';
  note: string;
  lastSync?: string | null;
  lastError?: string | null;
  liveCount?: number;
}

export const OfficialSources: React.FC = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ sources: Source[]; sampleDataNotice: string }>('/api/sources');
      setSources(data.sources);
      setNotice(data.sampleDataNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900">Official data sources</h2>
          <p className="text-sm text-stone-600 mt-1">Where tender data comes from, and how much of it TenDo can fetch automatically.</p>
        </div>
        <button onClick={load} className="h-10 px-3 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-700 flex items-center gap-2 hover:bg-stone-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {notice && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex gap-2.5">
          <Info className="w-4 h-4 mt-0.5 shrink-0" /> <span>{notice}</span>
        </div>
      )}
      {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        {sources.map((s) => (
          <article key={s.id} className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-stone-900 leading-snug">{s.name}</h3>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                s.access === 'live-api' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}>
                {s.access === 'live-api' ? 'Live API' : 'Link-out'}
              </span>
            </div>
            <p className="text-sm text-stone-600">{s.note}</p>
            {s.access === 'live-api' && (
              <p className="text-xs text-stone-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4d6b2f]" />
                {s.lastError
                  ? `Last sync failed: ${s.lastError}`
                  : s.lastSync
                  ? `Last sync ${new Date(s.lastSync).toLocaleString()} · ${s.liveCount ?? 0} notices`
                  : 'Not synced yet. Open Tenders to fetch.'}
              </p>
            )}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-[#3f5724] hover:underline">
              Open official portal <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
};
