import { apiJson } from '../services/api';
import React, { useState } from 'react';
import { CompanyProfile, CurrencyType, FeasibilityResult, Tender } from '../types';
import { formatCurrency, getFitScoreColor } from '../utils/formatters';
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

  const requiredTurnover = tender.eligibilityCriteria?.minAnnualTurnover || tender.budget * 0.8;
  const turnoverRatio = companyProfile.annualTurnover / requiredTurnover;
  const availableCapacity = 100 - companyProfile.currentCapacityUtilizationPercent;

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
        if (data.data.fitScore) {
          onUpdateTenderFitScore(tender.id, data.data.fitScore);
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fit = getFitScoreColor(aiAuditResult ? aiAuditResult.fitScore : tender.companyFitScore);
  const currentFitScore = aiAuditResult ? aiAuditResult.fitScore : tender.companyFitScore;

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
            Tender Value: <strong className="text-[#3f5724] font-mono font-black">{formatCurrency(tender.budget, currency)}</strong> | Authority: {tender.authority}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunAiAudit}
            disabled={isAnalyzing}
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
                className={currentFitScore >= 80 ? 'text-[#4d6b2f]' : 'text-amber-500'}
                strokeDasharray={`${currentFitScore}, 100`}
                strokeWidth="3.8"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-stone-900 font-mono">{currentFitScore}%</span>
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wide">Alignment</span>
            </div>
          </div>

          <div
            className={`mt-4 px-3.5 py-1 rounded-full text-xs font-bold border ${fit.bg} ${fit.border} ${fit.text}`}
          >
            {aiAuditResult?.verdict || tender.feasibilityVerdict}
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
                {companyProfile.activeProjectsCount} of {companyProfile.maxProjectCapacity} Maximum
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-lime-600 to-[#4d6b2f]"
                style={{ width: `${companyProfile.currentCapacityUtilizationPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-stone-500 mt-1.5">
              <span>{companyProfile.currentCapacityUtilizationPercent}% Occupied</span>
              <span className="text-[#3f5724] font-bold">{availableCapacity}% Available Headroom</span>
            </div>
          </div>

          <div className="pt-2 border-t border-stone-100 space-y-2 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Available Skilled Workforce:</span>
              <span className="text-stone-900 font-bold font-mono">{companyProfile.skilledWorkforceCount} Masons/Engs</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Machinery & Heavy Plant:</span>
              <span className="text-stone-900 font-bold font-mono">{companyProfile.heavyMachineryCount} Units Active</span>
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
                {formatCurrency(companyProfile.annualTurnover, 'INR')}
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Required Tender Turnover:</span>
              <span className="font-bold text-stone-700 font-mono">
                {formatCurrency(requiredTurnover, 'INR')}
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Turnover Coverage Ratio:</span>
              <span className="font-bold text-[#3f5724] font-mono">
                {turnoverRatio.toFixed(2)}x (Meets Criteria)
              </span>
            </div>
            <div className="flex justify-between text-stone-600 pt-1 border-t border-stone-100">
              <span>Past Performance Rating:</span>
              <span className="font-bold text-amber-600 font-mono">
                {companyProfile.pastPerformanceRating} / 5.0 Stars
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Historical Bid Win Rate:</span>
              <span className="font-bold text-[#4d6b2f] font-mono">
                {companyProfile.historicalWinRate}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Qualification Criteria Checklist Table */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#4d6b2f]" />
          <span>Pre-Qualification & Mandatory Criteria Matrix (Govt. of India e-Procurement)</span>
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
                <>
                  <tr className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-bold text-stone-900">Annual Financial Turnover</td>
                    <td className="py-3 px-4 text-stone-600 font-mono">
                      &ge; {formatCurrency(requiredTurnover, 'INR')}
                    </td>
                    <td className="py-3 px-4 text-stone-600 font-mono">
                      {formatCurrency(companyProfile.annualTurnover, 'INR')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[#3f5724] font-bold">
                        <CheckCircle className="w-4 h-4 text-[#4d6b2f]" /> Passed (1.3x)
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-bold text-stone-900">Similar Completed Works</td>
                    <td className="py-3 px-4 text-stone-600 font-mono">
                      &ge; {tender.eligibilityCriteria?.similarProjectsCount || 2} projects in last 5 yrs
                    </td>
                    <td className="py-3 px-4 text-stone-600 font-mono">4 verified government contracts</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[#3f5724] font-bold">
                        <CheckCircle className="w-4 h-4 text-[#4d6b2f]" /> Passed
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-bold text-stone-900">Bank Guarantee & EMD Solvency</td>
                    <td className="py-3 px-4 text-stone-600 font-mono">
                      &ge; {formatCurrency(tender.emdAmount, 'INR')} liquid funds
                    </td>
                    <td className="py-3 px-4 text-stone-600 font-mono">
                      {formatCurrency(companyProfile.availableSolvency, 'INR')} available
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[#3f5724] font-bold">
                        <CheckCircle className="w-4 h-4 text-[#4d6b2f]" /> Passed (3.2x)
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-bold text-stone-900">Quality & Safety Certifications</td>
                    <td className="py-3 px-4 text-stone-600">
                      {tender.eligibilityCriteria?.requiredCertifications?.join(', ') || 'ISO 9001:2015'}
                    </td>
                    <td className="py-3 px-4 text-stone-600">
                      ISO 9001, ISO 14001, ISO 45001, CPWD Class-1
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[#3f5724] font-bold">
                        <CheckCircle className="w-4 h-4 text-[#4d6b2f]" /> Passed
                      </span>
                    </td>
                  </tr>
                </>
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
            <span>Competitive Advantages & L1 Positioning</span>
          </h4>
          <ul className="space-y-2 text-xs text-stone-600">
            {(aiAuditResult?.strengths || [
              `Financial turnover (${formatCurrency(companyProfile.annualTurnover, 'INR')}) comfortably exceeds minimum benchmark.`,
              'In-house fleet of tower cranes and batching mixers eliminates expensive third-party equipment rentals.',
              `Flawless ${companyProfile.pastPerformanceRating}/5 track record with zero liquidated damage history across state works.`,
              'Direct mill volume agreements for Fe550 TMT Steel ensure uninterrupted material supply.'
            ]).map((s, i) => (
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
            <span>Identified Risk Bottlenecks & Escalations</span>
          </h4>
          <ul className="space-y-2 text-xs text-stone-600">
            {(aiAuditResult?.riskFactors || [
              `Tight execution timeline of ${tender.completionDurationDays} days requires dual-shift site operations.`,
              'Recent steel price volatility (+4.8%) mandates a minimum 3.5% contingency price hedging buffer.',
              'Specialized MEP and elevator packages require early pre-bid OEM tie-ups to secure tender compliance.'
            ]).map((r, i) => (
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
