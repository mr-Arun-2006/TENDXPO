import React from 'react';
import { CommodityPrice, CurrencyType } from '../types';
import { formatRawAmount } from '../utils/formatters';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react';

interface CommodityTrackerProps {
  commodities: CommodityPrice[];
  currency: CurrencyType;
  onRefresh: () => void;
}

export const CommodityTracker: React.FC<CommodityTrackerProps> = ({
  commodities,
  currency,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Advisory Banner */}
      <div className="p-5 rounded-3xl bg-amber-50/80 border border-amber-200 flex items-start gap-4 shadow-xs">
        <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-extrabold text-amber-900 text-sm">
            Indicative reference rates — not live market quotations
          </h3>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            These figures are illustrative starting assumptions and are not connected to a verified commodity-price provider.
            Replace them with supplier quotations or approved market-rate references before relying on a BOQ or submitting a bid.
            No mandatory escalation percentage is implied by this demo dataset.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
          <span>Reload reference rates</span>
        </button>
      </div>

      {/* Grid of Commodity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {commodities.map((comm) => {
          const isUp = comm.trend === 'up';
          const isDown = comm.trend === 'down';

          return (
            <div
              key={comm.id}
              className="p-5 rounded-3xl bg-white border border-stone-200 hover:border-[#4d6b2f]/50 hover:shadow-sm transition shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                    {comm.category}
                  </span>
                  <div
                    className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      isUp
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : isDown
                        ? 'bg-[#4d6b2f]/10 text-[#3f5724] border border-[#4d6b2f]/20'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>{comm.change7d > 0 ? `+${comm.change7d}%` : `${comm.change7d}%`} (7d)</span>
                  </div>
                </div>

                <h4 className="font-extrabold text-stone-900 text-sm mt-2">{comm.name}</h4>
                <p className="text-[11px] text-stone-500">{comm.unit}</p>

                {/* Spot Price Display in INR */}
                <div className="flex items-baseline gap-2 mt-3 font-mono">
                  <span className="text-2xl font-black text-stone-900">
                    {formatRawAmount(comm.currentPrice, comm.currency)}
                  </span>
                  <span className="text-xs text-stone-500 font-sans">/ {comm.unit.split(' ')[0]}</span>
                </div>

                {/* Mini SVG Sparkline Trend in Olive Green */}
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <div className="flex justify-between text-[10px] text-stone-500 mb-1 font-medium">
                    <span>Illustrative sample history</span>
                    <span className="font-bold text-stone-700">Volatility: {comm.volatility}</span>
                  </div>
                  <div className="h-10 w-full flex items-end gap-1">
                    {comm.history.map((val, idx) => {
                      const min = Math.min(...comm.history);
                      const max = Math.max(...comm.history);
                      const heightPercent = max === min ? 50 : Math.round(((val - min) / (max - min)) * 70 + 25);
                      return (
                        <div
                          key={idx}
                          className="flex-1 rounded-t transition-all hover:bg-[#3f5724] cursor-pointer"
                          style={{
                            height: `${heightPercent}%`,
                            backgroundColor: '#4d6b2f',
                            opacity: 0.35 + (idx / comm.history.length) * 0.65,
                          }}
                          title={`Day ${idx + 1}: ₹${val * 83}`}
                        ></div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-stone-500 italic pt-2 border-t border-stone-100 line-clamp-2">
                {comm.notes}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
