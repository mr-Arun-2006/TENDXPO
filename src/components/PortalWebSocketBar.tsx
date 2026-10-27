import React, { useState } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  BellOff,
  ExternalLink,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { OfficialPortal, PortalConnectionState, PortalLiveEvent } from '../types';

interface PortalWebSocketBarProps {
  connectionState: PortalConnectionState;
  latestEvent?: PortalLiveEvent | null;
  onOpenRadar: () => void;
  onTriggerScan: (portal?: OfficialPortal) => void;
  isSoundOn: boolean;
  onToggleSound: () => void;
}

export const PortalWebSocketBar: React.FC<PortalWebSocketBarProps> = ({
  connectionState,
  latestEvent,
  onOpenRadar,
  onTriggerScan,
  isSoundOn,
  onToggleSound,
}) => {
  const [isTriggering, setIsTriggering] = useState(false);

  const handleScanClick = () => {
    setIsTriggering(true);
    onTriggerScan();
    setTimeout(() => setIsTriggering(false), 1200);
  };

  const isConnected = connectionState.connected;

  return (
    <div className="w-full bg-[#374c22] border-b border-[#4d6b2f] text-stone-100 px-3 sm:px-6 py-2 shadow-inner">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Left: Connection telemetry & Portal Status chips */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="inline-flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              )}
            </span>
            <span className="font-extrabold uppercase tracking-wider text-[11px] text-emerald-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>{isConnected ? 'PORTALS WEBSOCKET: LIVE' : 'WS: RECONNECTING'}</span>
            </span>
            <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded-md font-mono text-stone-300 border border-white/10">
              {connectionState.latencyMs}ms ping
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-white/15">
            <span className="text-[10px] text-stone-300 font-medium">Monitored:</span>
            {connectionState.activePortals.slice(0, 5).map((p) => (
              <span
                key={p.portal}
                className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-stone-200 border border-white/10 hover:bg-white/20 transition cursor-pointer"
                title={`${p.name} • ${p.domain} • ${p.tendersToday} tenders today`}
                onClick={() => onTriggerScan(p.portal)}
              >
                {p.portal}
              </span>
            ))}
          </div>
        </div>

        {/* Center: Live Portal Events Ticker */}
        <div className="flex-1 w-full md:w-auto flex items-center justify-center md:justify-start overflow-hidden px-2">
          {latestEvent ? (
            <div
              onClick={onOpenRadar}
              className="flex items-center gap-2 text-stone-200 hover:text-white transition cursor-pointer truncate max-w-full group"
            >
              <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-black text-[10px] uppercase shrink-0 border border-amber-400/30">
                {latestEvent.portal}
              </span>
              <span className="truncate font-medium text-[11px] group-hover:underline">
                {latestEvent.title}
              </span>
              <span className="text-[10px] opacity-75 shrink-0 hidden sm:inline">
                • {new Date(latestEvent.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ) : (
            <span className="text-stone-300 text-[11px] italic">
              Listening for official GeM, CPPP, and NHAI tender broadcasts...
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
          <button
            onClick={handleScanClick}
            disabled={isTriggering}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] transition flex items-center gap-1.5 border border-white/15 active:scale-95 shadow-2xs"
            title="Send client:trigger_scan over WebSocket"
          >
            <RefreshCw className={`w-3 h-3 ${isTriggering ? 'animate-spin text-amber-300' : ''}`} />
            <span>{isTriggering ? 'Scanning...' : 'Scan Portals'}</span>
          </button>

          <button
            onClick={onToggleSound}
            className={`p-1.5 rounded-lg border text-white transition ${
              isSoundOn
                ? 'bg-emerald-600/30 border-emerald-400/40 text-emerald-200'
                : 'bg-white/10 border-white/15 text-stone-400'
            }`}
            title={isSoundOn ? 'Mute new tender audio chime' : 'Enable audio chime for newly published tenders'}
          >
            {isSoundOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onOpenRadar}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] transition flex items-center gap-1 shadow-sm active:scale-95"
          >
            <span>Live Radar</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
