import React, { useState } from 'react';
import {
  X,
  Radio,
  RefreshCw,
  ExternalLink,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FileText,
  Filter,
  Search,
  Sparkles,
  Zap,
  Globe,
  Sliders,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { OfficialPortal, PortalConnectionState, PortalEventType, PortalLiveEvent, Tender } from '../types';

interface PortalWebSocketModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState: PortalConnectionState;
  liveEvents: PortalLiveEvent[];
  onTriggerScan: (portal?: OfficialPortal) => void;
  onSelectTender?: (tender: Tender) => void;
}

export const PortalWebSocketModal: React.FC<PortalWebSocketModalProps> = ({
  isOpen,
  onClose,
  connectionState,
  liveEvents,
  onTriggerScan,
  onSelectTender,
}) => {
  const [selectedPortalFilter, setSelectedPortalFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScanPortal = (portal?: OfficialPortal) => {
    setIsScanning(true);
    setScanMessage(`Triggering real-time scrape cycle across ${portal || 'All Official Portals'} via WebSocket...`);
    onTriggerScan(portal);
    setTimeout(() => {
      setIsScanning(false);
      setScanMessage(`Scrape cycle complete. New bids & corrigendums synchronized across clients.`);
      setTimeout(() => setScanMessage(null), 3500);
    }, 1200);
  };

  const filteredEvents = liveEvents.filter((evt) => {
    if (selectedPortalFilter !== 'all' && evt.portal !== selectedPortalFilter) return false;
    if (selectedTypeFilter !== 'all' && evt.eventType !== selectedTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        evt.title.toLowerCase().includes(q) ||
        evt.details.toLowerCase().includes(q) ||
        (evt.refNumber && evt.refNumber.toLowerCase().includes(q)) ||
        (evt.sector && evt.sector.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getEventBadge = (type: PortalEventType) => {
    switch (type) {
      case 'tender_published':
        return { label: 'New Tender', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'corrigendum_issued':
        return { label: 'Corrigendum', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'price_tick':
        return { label: 'Price Index', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'bidding_status_update':
        return { label: 'Bid Status', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'scraper_pulse':
        return { label: 'Scraper Pulse', bg: 'bg-stone-100 text-stone-800 border-stone-200' };
      default:
        return { label: 'Portal Event', bg: 'bg-stone-50 text-stone-700 border-stone-200' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-3xl border border-stone-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#4d6b2f] p-5 sm:p-6 text-white text-left relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-[11px] font-black uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-300" />
              <span>Official Portals WebSocket Stream</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-mono border border-emerald-400/30">
              {connectionState.latencyMs}ms Latency • {connectionState.connectedClientsCount} Connected Client{connectionState.connectedClientsCount !== 1 ? 's' : ''}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-stone-200 text-xs font-mono">
              ws/portals • Server-Authoritative
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">
            Live Government e-Procurement Portal Radar
          </h2>
          <p className="text-xs sm:text-sm text-stone-100 opacity-90 mt-1 max-w-3xl">
            Real-time bidirectional WebSocket synchronization streaming fresh tenders, corrigendums, bidder qualifications, and raw material index ticks across official Indian portals.
          </p>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Official Portals Status Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#4d6b2f]" />
                <span>Monitored Official Portals (Govt. of India)</span>
              </h3>
              <button
                onClick={() => handleScanPortal()}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Polling Portals...' : 'Trigger Synchronized Scan'}</span>
              </button>
            </div>

            {scanMessage && (
              <div className="mb-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{scanMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {connectionState.activePortals.map((p) => (
                <div
                  key={p.portal}
                  className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 hover:border-[#4d6b2f]/40 transition space-y-2 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span className="font-black text-stone-900 text-sm">{p.portal}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold uppercase">
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 line-clamp-1">{p.name}</p>
                    </div>

                    <a
                      href={`https://${p.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-stone-200/60 hover:bg-[#4d6b2f] hover:text-white text-stone-600 transition"
                      title={`Open official portal: ${p.domain}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200 text-[11px]">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Indexed Today</span>
                      <span className="font-bold text-stone-800">{p.tendersToday} Bids</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Response Latency</span>
                      <span className="font-mono font-bold text-stone-800">{p.responseTimeMs} ms</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] text-stone-400 font-mono">
                      Domain: {p.domain}
                    </span>
                    <button
                      onClick={() => handleScanPortal(p.portal)}
                      disabled={isScanning}
                      className="text-[11px] text-[#4d6b2f] font-bold hover:underline flex items-center gap-0.5"
                    >
                      <span>Scan Now</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-Time Filter & Search Toolbar */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter events, tender ref, sector..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:border-[#4d6b2f]"
                />
              </div>

              {/* Portal Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <span className="text-[11px] font-bold text-stone-500 shrink-0">Portal:</span>
                {['all', 'CPPP', 'GeM', 'NHAI', 'IREPS', 'State PWD', 'SECI'].map((port) => (
                  <button
                    key={port}
                    onClick={() => setSelectedPortalFilter(port)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition shrink-0 ${
                      selectedPortalFilter === port
                        ? 'bg-[#4d6b2f] text-white'
                        : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {port === 'all' ? 'All Portals' : port}
                  </button>
                ))}
              </div>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-stone-200/60">
              <span className="text-[11px] font-bold text-stone-500 shrink-0">Event Type:</span>
              {[
                { id: 'all', label: 'All Streams' },
                { id: 'tender_published', label: 'Tenders' },
                { id: 'corrigendum_issued', label: 'Corrigendums' },
                { id: 'price_tick', label: 'Commodity Ticks' },
                { id: 'bidding_status_update', label: 'Bid Status' },
              ].map((typ) => (
                <button
                  key={typ.id}
                  onClick={() => setSelectedTypeFilter(typ.id)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition shrink-0 ${
                    selectedTypeFilter === typ.id
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-200/70 text-stone-700 hover:bg-stone-300'
                  }`}
                >
                  {typ.label}
                </button>
              ))}
              <span className="ml-auto text-[10px] font-mono text-stone-400">
                Showing {filteredEvents.length} events
              </span>
            </div>
          </div>

          {/* Live Events Stream Log */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#4d6b2f]" />
                <span>Live Portal Telemetry & Stream Log</span>
              </span>
              <span className="text-[10px] font-normal text-stone-500 font-mono">
                Auto-refreshed via WebSocket
              </span>
            </h3>

            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-stone-200 text-stone-500 text-xs">
                No events match your current filter. Real-time portal stream is active and awaiting incoming packets.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map((evt) => {
                  const badge = getEventBadge(evt.eventType);
                  return (
                    <div
                      key={evt.id}
                      className="p-3.5 rounded-2xl bg-white border border-stone-200 hover:border-[#4d6b2f]/50 hover:shadow-sm transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold">
                            {evt.portal}
                          </span>
                          {evt.refNumber && (
                            <span className="font-mono text-[10px] text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">
                              {evt.refNumber}
                            </span>
                          )}
                          <span className="text-[10px] text-stone-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(evt.timestamp).toLocaleTimeString('en-IN')}
                          </span>
                        </div>

                        <h4 className="font-bold text-stone-900 text-sm">{evt.title}</h4>
                        <p className="text-stone-600 text-xs leading-relaxed">{evt.details}</p>

                        {evt.impactNote && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3f5724] bg-[#4d6b2f]/10 px-2 py-0.5 rounded-md">
                            <Sparkles className="w-3 h-3 text-[#4d6b2f]" />
                            <span>{evt.impactNote}</span>
                          </div>
                        )}
                      </div>

                      {/* Right Action */}
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                        {evt.tenderData && onSelectTender && (
                          <button
                            onClick={() => {
                              onSelectTender(evt.tenderData!);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                          >
                            <span>Open in Estimator</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {evt.url && (
                          <a
                            href={evt.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition"
                            title="Open Official Portal Website"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 text-xs text-stone-500 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#4d6b2f]" />
            <span>
              Connected to <strong>TenDo Official Portals WebSocket Engine</strong> (eprocure.gov.in & gem.gov.in sync active)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleScanPortal()}
              className="text-xs font-bold text-[#4d6b2f] hover:underline"
            >
              Force Full Scan
            </button>
            <span>•</span>
            <button onClick={onClose} className="text-xs font-bold text-stone-700 hover:underline">
              Close Radar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
