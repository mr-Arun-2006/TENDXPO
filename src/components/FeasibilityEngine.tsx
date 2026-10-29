import { apiJson } from '../services/api';
import React, { useState } from 'react';
import { CompanyProfile, CurrencyType, FeasibilityResult, Tender } from '../types';
import { formatTenderValue, getFitScoreColor } from '../utils/formatters';
import {
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  CheckCircle,
  XCircle,
  BarChart3,
  Building,
  HardHat,
  Scale,
  Award,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface FeasibilityEngineProps {
  tender: Tender;
  companyProfile: CompanyProfile;
  currency: CurrencyType;
  onProceedToCosting: (tender: Tender) => void;
  onUpdateTenderFitScore: (tenderId: string, score: number) => void;
}

export const FeasibilityEngine: React.FC<FeasibilityEngineProps> = ({
  tender,
  companyProfile,
  currency,
  onProceedToCosting,
  onUpdateTenderFitScore,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAuditResult, setAiAuditResult] = useState<FeasibilityResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const requiredTurnover = Number(tender.eligibilityCriteria?.minAnnualTurnover || 0);
  const turnoverRatio =
    requiredTurnover > 0 &&
    companyProfile.annualTurnover > 0 &&
    companyProfile.currency === tender.currency
      ? companyProfile.annualTurnover / requiredTurnover
      : null;
  const capacityKnown =
    companyProfile.maxProjectCapacity > 0 &&
    Number.isFinite(companyProfile.currentCapacityUtilizationPercent) &&
    companyProfile.currentCapacityUtilizationPercent >= 0 &&
    companyProfile.currentCapacityUtilizationPercent <= 100;
  const availableCapacity = capacityKnown ? 100 - companyProfile.currentCapacityUtilizationPercent : null;
  const companyProfileReady = Boolean(companyProfile.name.trim() && companyProfile.annualTurnover > 0);

  const handleRunAiAudit = async () => {
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const data = await apiJson('/api/gemini/analyze-bid', {
        method: 'POST',
        body: JSON.stringify({ tender, profile: companyProfile }),
      });
      if (data.status === 'success' && data.data) {
        setAiAuditResult(data.data);
        if (typeof data.data.fitScore === 'number') {
          onUpdateTenderFitScore(tender.id, data.data.fitScore);
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currentFitScore = aiAuditResult ? aiAuditResult.fitScore : null;
  const fit = getFitScoreColor(currentFitScore ?? 0);

  return (
    <div className="space-y-6">
      {/* Header Context */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#4d6b2f]/10 text-[#3f5724] border border-[#4d6b2f]/30">
              Pre-Bid Criteria Evaluation
            </span>
            <span className="text-xs text-stone-500 font-mono font-bold">{tender.refNumber}</span>
          </div>
          <h2 className="text-xl font-black text-stone-900 tracking-tight">{tender.title}</h2>
          <p className="text-xs text-stone-500 mt-1">
            Tender Value: <strong className="text-[#3f5724] font-mono font-black">{formatTenderValue(tender.budget, tender.currency)}</strong> | Authority: {tender.authority}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunAiAudit}
            disabled={isAnalyzing || !companyProfileReady}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Auditing with Gemini AI...' : 'Run AI Feasibility Audit'}</span>
          </button>
          {aiError && (
            <span role="alert" className="text-xs font-semibold text-rose-700">{aiError}</span>
          )}

          <button
            onClick={() => onProceedToCosting(tender)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-bold text-xs transition"
          >
            <span>Proceed to Costing</span>
            <ChevronRight className="w-4 h-4 text-[#4d6b2f]" />
          </button>
        </div>
      </div>

      {!companyProfileReady && (
        <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          Complete your company name and annual turnover in Company Settings before running eligibility analysis.
        </div>
      )}
      {tender.dataSource === 'sample' && (
        <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          Sample tender only — this is not a verified bidding opportunity. Do not use its dates, values or requirements for a real bid.
        </div>
      )}

      {/* Score Overview and Verdict Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Company Fit Score Gauge */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col items-center justify-center text-center">
          <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-2">
            Company Fit Score
          </p>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-stone-100"
                strokeWidth="3.8"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={currentFitScore !== null && currentFitScore >= 80 ? 'text-[#4d6b2f]' : 'text-amber-500'}
                strokeDasharray={`${currentFitScore ?? 0}, 100`}
                strokeWidth="3.8"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-stone-900 font-mono">{currentFitScore === null ? '—' : String(currentFitScore) + '%'}</span>
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wide">Alignment</span>
            </div>
          </div>

          <div
            className={`mt-4 px-3.5 py-1 rounded-full text-xs font-bold border ${aiAuditResult ? fit.bg + ' ' + fit.border + ' ' + fit.text : 'bg-stone-100 border-stone-200 text-stone-600'}`}
          >
            {aiAuditResult?.verdict || 'Not analyzed'}
          </div>
        </div>

        {/* Operational Capacity & Bandwidth */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">
              Operational Bandwidth
            </p>
            <Building className="w-4 h-4 text-[#4d6b2f]" />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5 font-medium">
              <span className="text-stone-600">Active Commitments:</span>
              <span className="font-bold text-stone-900 font-mono">
                {companyProfile.maxProjectCapacity > 0 ? `${companyProfile.activeProjectsCount} of ${companyProfile.maxProjectCapacity} maximum` : 'Not provided'}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-lime-600 to-[#4d6b2f]"
                style={{ width: `${capacityKnown ? companyProfile.currentCapacityUtilizationPercent : 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-stone-500 mt-1.5">
              <span>{capacityKnown ? `${companyProfile.currentCapacityUtilizationPercent}% occupied` : 'Capacity data not provided'}</span>
              <span className="text-[#3f5724] font-bold">{availableCapacity === null ? 'Not calculated' : `${availableCapacity}% available headroom`}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-stone-100 space-y-2 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Available Skilled Workforce:</span>
              <span className="text-stone-900 font-bold font-mono">{companyProfile.skilledWorkforceCount > 0 ? `${companyProfile.skilledWorkforceCount} reported` : 'Not provided'}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Machinery & Heavy Plant:</span>
              <span className="text-stone-900 font-bold font-mono">{companyProfile.heavyMachineryCount > 0 ? `${companyProfile.heavyMachineryCount} reported` : 'Not provided'}</span>
            </div>
          </div>
        </div>

        {/* Financial Solvency & Past Performance */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">
              Financial Solvency (INR)
            </p>
            <Scale className="w-4 h-4 text-[#4d6b2f]" />
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Company Annual Turnover:</span>
              <span className="font-bold text-stone-900 font-mono">
                {companyProfile.annualTurnover > 0 ? formatTenderValue(companyProfile.annualTurnover, companyProfile.currency) : 'Not provided'}
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Required Tender Turnover:</span>
              <span className="font-bold text-stone-700 font-mono">
                {requiredTurnover > 0 ? formatTenderValue(requiredTurnover, tender.currency) : 'Not stated in structured record'}
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Turnover Coverage Ratio:</span>
              <span className="font-bold text-[#3f5724] font-mono">
                {turnoverRatio === null ? 'Not calculable from available data' : `${turnoverRatio.toFixed(2)}x (reported values; verify currency and evidence)`}
              </span>
            </div>
            <div className="flex justify-between text-stone-600 pt-1 border-t border-stone-100">
              <span>Past Performance Rating:</span>
              <span className="font-bold text-amber-600 font-mono">
                {companyProfile.pastPerformanceRating > 0 ? `${companyProfile.pastPerformanceRating} / 5.0 (company-reported)` : 'Not provided'}
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Historical Bid Win Rate:</span>
              <span className="font-bold text-[#4d6b2f] font-mono">
                {companyProfile.historicalWinRate > 0 ? `${companyProfile.historicalWinRate}% (company-reported)` : 'Not provided'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Qualification Criteria Checklist Table */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#4d6b2f]" />
          <span>Pre-Qualification & Mandatory Criteria Matrix</span>
        </h3>

        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-stone-600 uppercase text-[10px] tracking-wider border-b border-stone-200 font-bold">
              <tr>
                <th className="py-2.5 px-4">Evaluation Criteria</th>
                <th className="py-2.5 px-4">Tender Mandatory Requirement</th>
                <th className="py-2.5 px-4">Our Company Capability</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {aiAuditResult?.bidNoBidChecklist ? (
                aiAuditResult.bidNoBidChecklist.map((c, i) => (
                  <tr key={i} className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-bold text-stone-900">{c.criteria}</td>
                    <td className="py-3 px-4 text-stone-600 font-mono">{c.required}</td>
                    <td className="py-3 px-4 text-stone-600 font-mono">{c.companyValue}</td>
                    <td className="py-3 px-4 text-center">
                      {c.passed ? (
                        <span className="inline-flex items-center gap-1 text-[#3f5724] font-bold">
                          <CheckCircle className="w-4 h-4 text-[#4d6b2f]" /> Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                          <XCircle className="w-4 h-4 text-rose-500" /> Non-Compliant
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-stone-500">
                    Run the AI feasibility audit to generate a tender-specific checklist. No eligibility criteria are marked as passed before analysis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Win Recommendations & Risk Mitigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
          <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#4d6b2f]" />
            <span>Evidence-backed Strengths</span>
          </h4>
          <ul className="space-y-2 text-xs text-stone-600">
            {(aiAuditResult?.strengths || ['Run the feasibility audit to list strengths supported by the available tender and company evidence.']).map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4d6b2f] shrink-0 mt-1.5"></span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
          <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Risks & Missing Evidence</span>
          </h4>
          <ul className="space-y-2 text-xs text-stone-600">
            {(aiAuditResult?.riskFactors || ['Run the feasibility audit to identify tender-specific risks and missing evidence. Verify material prices with current supplier quotations.']).map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5"></span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
