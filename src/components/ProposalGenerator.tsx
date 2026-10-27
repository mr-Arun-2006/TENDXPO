import React, { useState, useEffect } from 'react';
import { BidCalculation, BOQItem, CompanyProfile, CurrencyType, ProposalDocument, SupportedLanguage, Tender } from '../types';
import { formatCurrency } from '../utils/formatters';
import { generateProposalPdf } from '../utils/generateProposalPdf';
import { useTranslation } from '../context/LanguageContext';
import {
  FileText,
  Copy,
  Printer,
  Sparkles,
  CheckCircle2,
  Download,
  Building,
  Calendar,
  Layers,
  ShieldCheck,
  Send,
  Award,
  HardHat,
  TrendingUp,
  FileCheck2,
  Languages,
} from 'lucide-react';

interface ProposalGeneratorProps {
  tender: Tender;
  calculation: BidCalculation;
  boqItems: BOQItem[];
  companyProfile: CompanyProfile;
  currency: CurrencyType;
  onAdvanceToSubmitted: () => void;
}

export const ProposalGenerator: React.FC<ProposalGeneratorProps> = ({
  tender,
  calculation,
  boqItems,
  companyProfile,
  currency,
  onAdvanceToSubmitted,
}) => {
  const { language, t, supportedLanguages } = useTranslation();
  const [proposalLanguage, setProposalLanguage] = useState<SupportedLanguage>(language);
  const [proposal, setProposal] = useState<ProposalDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Sync proposalLanguage with global language initially if user changes it
  useEffect(() => {
    setProposalLanguage(language);
  }, [language]);

  const handleGenerateProposal = async (langToUse = proposalLanguage) => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/gemini/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tender,
          costing: calculation,
          profile: companyProfile,
          language: langToUse,
        }),
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setProposal(data.data);
      }
    } catch (err) {
      console.error('Failed to generate proposal:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    handleGenerateProposal(proposalLanguage);
  }, [tender.id, calculation.totalBidAmount]);

  const handleCopy = () => {
    if (!proposal) return;
    const fullText = `
GOVERNMENT OF INDIA TENDER PROPOSAL & BOQ JUSTIFICATION BRIEF
============================================================
Tender: ${tender.title}
Reference: ${tender.refNumber}
Authority: ${tender.authority}
Proposed Bid Price: ${formatCurrency(calculation.totalBidAmount, 'INR')}
Execution Timeline: ${tender.completionDurationDays} Calendar Days

${proposal.executiveCoverLetter}

1. COST & BUDGET JUSTIFICATION (INR)
------------------------------------
${proposal.costJustificationNarrative}

2. EXECUTION SCHEDULE & MANPOWER TIMELINE
-----------------------------------------
${proposal.executionScheduleNarrative}

3. QUALITY ASSURANCE & SAFETY PLAN
----------------------------------
${proposal.qualityAndSafetyPlan}

4. COMPETITIVE ADVANTAGE
------------------------
${proposal.competitiveEdgeStatement}
    `;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    setIsDownloadingPdf(true);
    try {
      generateProposalPdf({
        tender,
        calculation,
        boqItems,
        companyProfile,
        proposal,
        currency,
      });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to generate proposal PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Toolbar */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#4d6b2f]/10 text-[#3f5724] border border-[#4d6b2f]/30">
              {t('officialProposalTitle', 'Official Proposal & Budget Explainer (INR)')}
            </span>
            <span className="text-xs text-stone-500 font-mono font-bold">{tender.refNumber}</span>
          </div>
          <h2 className="text-xl font-black text-stone-900">{tender.title}</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Target Price:{' '}
            <strong className="text-[#3f5724] text-sm font-mono font-black">
              {formatCurrency(calculation.totalBidAmount, 'INR')}
            </strong>{' '}
            ({calculation.varianceAgainstTenderBudgetPercent >= 0 ? '+' : ''}
            {calculation.varianceAgainstTenderBudgetPercent}% vs NIT Estimate)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Proposal Drafting Language Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs">
            <Languages className="w-3.5 h-3.5 text-[#4d6b2f]" />
            <span className="text-[11px] text-stone-500 font-medium hidden sm:inline">
              {t('proposalLang', 'Proposal Lang')}:
            </span>
            <select
              value={proposalLanguage}
              onChange={(e) => {
                const newLang = e.target.value as SupportedLanguage;
                setProposalLanguage(newLang);
                handleGenerateProposal(newLang);
              }}
              className="bg-transparent font-bold text-stone-800 text-xs focus:outline-none cursor-pointer"
              title="Change language for proposal narrative drafting"
            >
              {supportedLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.nativeName} ({l.name})
                </option>
              ))}
            </select>
          </div>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50"
            title="Download complete formatted proposal as a multi-page PDF reflecting company credentials"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>{t('pdfDownloaded', 'PDF Downloaded!')}</span>
              </>
            ) : (
              <>
                <Download className={`w-3.5 h-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
                <span>{isDownloadingPdf ? t('generatingPdf', 'Generating PDF...') : t('downloadPdf', 'Download PDF')}</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleGenerateProposal(proposalLanguage)}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-[#3f5724] border border-stone-200 text-xs font-bold transition disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 text-[#4d6b2f] ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating...' : t('regenerateGemini', 'Regenerate')}</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-semibold transition"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4d6b2f]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('copiedText', 'Copied') : t('copyText', 'Copy Text')}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5 text-stone-500" />
            <span>{t('printView', 'Print View')}</span>
          </button>

          <button
            onClick={onAdvanceToSubmitted}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t('markSubmitted', 'Mark Submitted')}</span>
          </button>
        </div>
      </div>

      {/* Proposal Document Preview Container (Crisp White with Olive Green) */}
      <div className="p-8 sm:p-10 rounded-3xl bg-white border border-stone-200 shadow-md text-stone-900 max-w-4xl mx-auto space-y-8 font-sans print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <div className="border-b border-stone-200 pb-6">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#4d6b2f] font-black font-mono">
                GOVERNMENT OF INDIA &bull; FORMAL BID QUOTATION & BOQ JUSTIFICATION
              </span>
              <h1 className="text-2xl font-black text-stone-900 mt-1 tracking-tight">
                {companyProfile.name}
              </h1>
              <p className="text-xs text-stone-500 mt-1 font-medium">
                CPWD Class-1 Registered Engineering Consortium | ISO 9001:2015 & ISO 45001 Certified
              </p>
            </div>
            <div className="text-right text-xs text-stone-500 font-mono">
              <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
              <div>Ref: TD/SUB/{tender.refNumber}</div>
              <div className="text-[#3f5724] font-black mt-1">Official Submission</div>
            </div>
          </div>

          {/* Company Profile Credentials & Capacity Banner inside Document */}
          <div className="mt-5 p-4 rounded-2xl bg-stone-50 border border-stone-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-stone-500 uppercase font-bold block">Annual Turnover</span>
              <span className="font-bold text-stone-900 font-mono">
                {formatCurrency(companyProfile.annualTurnover, 'INR')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-500 uppercase font-bold block">Liquid Solvency</span>
              <span className="font-bold text-stone-900 font-mono">
                {formatCurrency(companyProfile.availableSolvency, 'INR')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-500 uppercase font-bold block">Capacity Free</span>
              <span className="font-bold text-[#3f5724] font-mono">
                {100 - companyProfile.currentCapacityUtilizationPercent}% ({companyProfile.maxProjectCapacity - companyProfile.activeProjectsCount} slots)
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-500 uppercase font-bold block">Past Track Record</span>
              <span className="font-bold text-stone-900 font-mono">
                {companyProfile.pastPerformanceRating} / 5.0 Star Rating
              </span>
            </div>
          </div>
        </div>

        {/* Loading Spinner during Gemini generation */}
        {isGenerating ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-3 border-[#4d6b2f]/30 border-t-[#4d6b2f] rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-stone-600">
              Drafting data-driven government proposal with commodity index backing...
            </p>
          </div>
        ) : proposal ? (
          <>
            {/* Executive Cover Letter */}
            <section className="space-y-4">
              <div className="whitespace-pre-line text-sm text-stone-800 leading-relaxed font-serif bg-stone-50/70 p-6 rounded-2xl border border-stone-200">
                {proposal.executiveCoverLetter}
              </div>
            </section>

            {/* Section 1: Financial & BOQ Cost Justification */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b-2 border-[#4d6b2f] pb-1">
                <span className="w-6 h-6 rounded-md bg-[#4d6b2f] text-white flex items-center justify-center font-mono text-xs font-bold">
                  1
                </span>
                <h3 className="font-extrabold text-stone-900 text-base">
                  Financial Quotation & Raw Material Cost Justification (INR)
                </h3>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                {proposal.costJustificationNarrative}
              </p>

              {/* Itemized BOQ Summary Table */}
              <div className="overflow-x-auto rounded-2xl border border-stone-200 mt-4">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-3">BOQ Category</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-right">Quantity / Unit</th>
                      <th className="py-2.5 px-3 text-right">Market Unit Rate</th>
                      <th className="py-2.5 px-3 text-right">Subtotal (INR ₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {boqItems.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50">
                        <td className="py-2 px-3 font-semibold text-[#3f5724]">{item.category}</td>
                        <td className="py-2 px-3 font-medium text-stone-900">{item.name}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {item.quantity.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          {formatCurrency(item.unitRate, 'INR')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-stone-900">
                          {formatCurrency(item.total, 'INR')}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-stone-50 font-bold border-t-2 border-stone-300">
                      <td colSpan={4} className="py-2.5 px-3 text-right text-stone-900">
                        Total Base Estimated Cost:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-900">
                        {formatCurrency(calculation.baseCost, 'INR')}
                      </td>
                    </tr>
                    <tr className="bg-stone-50 font-bold">
                      <td colSpan={4} className="py-2 px-3 text-right text-[#3f5724]">
                        Contractor Margin ({calculation.marginPercent}%) + Price Hedge Buffer:
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[#3f5724]">
                        {formatCurrency(calculation.marginAmount + calculation.contingencyBufferCost, 'INR')}
                      </td>
                    </tr>
                    <tr className="bg-stone-50 font-bold">
                      <td colSpan={4} className="py-2 px-3 text-right text-stone-700">
                        Statutory GST ({calculation.taxPercent}%):
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-stone-700">
                        {formatCurrency(calculation.taxAmount, 'INR')}
                      </td>
                    </tr>
                    <tr className="bg-[#4d6b2f]/10 text-[#3f5724] font-black text-sm border-t-2 border-[#4d6b2f]">
                      <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider">
                        Final Net Lump-Sum Bid Price:
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-base">
                        {formatCurrency(calculation.totalBidAmount, 'INR')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 2: Execution Schedule & Manpower Plan */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b-2 border-[#4d6b2f] pb-1">
                <span className="w-6 h-6 rounded-md bg-[#4d6b2f] text-white flex items-center justify-center font-mono text-xs font-bold">
                  2
                </span>
                <h3 className="font-extrabold text-stone-900 text-base">
                  Operational Execution Schedule & Resource Mobilization
                </h3>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                {proposal.executionScheduleNarrative}
              </p>

              {/* Resource Metrics cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                  <div className="flex items-center gap-2 text-[#4d6b2f] mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold">Contract Horizon</span>
                  </div>
                  <div className="text-lg font-black text-stone-900 font-mono">
                    {tender.completionDurationDays} Days
                  </div>
                  <div className="text-[11px] text-stone-500">Milestone gated delivery</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                  <div className="flex items-center gap-2 text-[#4d6b2f] mb-1">
                    <HardHat className="w-4 h-4" />
                    <span className="text-xs font-bold">Dedicated Labor</span>
                  </div>
                  <div className="text-lg font-black text-stone-900 font-mono">
                    {calculation.workerCount || 75} Workers / Day
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {calculation.totalManDays.toLocaleString()} cumulative man-days
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                  <div className="flex items-center gap-2 text-[#4d6b2f] mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-bold">L1 Win Probability</span>
                  </div>
                  <div className="text-lg font-black text-[#3f5724] font-mono">
                    {calculation.winProbability}% Score
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Optimal competitive positioning
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Quality & Safety Charter */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b-2 border-[#4d6b2f] pb-1">
                <span className="w-6 h-6 rounded-md bg-[#4d6b2f] text-white flex items-center justify-center font-mono text-xs font-bold">
                  3
                </span>
                <h3 className="font-extrabold text-stone-900 text-base">
                  Quality Assurance, NABL Testing Protocols & ISO 45001 Safety
                </h3>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                {proposal.qualityAndSafetyPlan}
              </p>
            </section>

            {/* Section 4: Competitive Advantage */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b-2 border-[#4d6b2f] pb-1">
                <span className="w-6 h-6 rounded-md bg-[#4d6b2f] text-white flex items-center justify-center font-mono text-xs font-bold">
                  4
                </span>
                <h3 className="font-extrabold text-stone-900 text-base">
                  Consortium Strategic Advantage & Value Proposition
                </h3>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                {proposal.competitiveEdgeStatement}
              </p>
            </section>

            {/* Formal Signature & Seal Block */}
            <div className="pt-8 border-t border-stone-200 grid grid-cols-2 gap-6 text-xs">
              <div>
                <p className="text-stone-500 uppercase text-[10px] font-bold">Technical Sign-off</p>
                <div className="mt-4 font-mono font-bold text-stone-900">
                  Chief Engineer / Head of Estimating
                </div>
                <div className="text-[11px] text-stone-500">{companyProfile.name}</div>
                <div className="text-[10px] text-stone-400 mt-1">Verified with Digital Token (Class-3 DSC)</div>
              </div>

              <div className="text-right">
                <p className="text-stone-500 uppercase text-[10px] font-bold">Corporate Execution Authorization</p>
                <div className="mt-4 font-mono font-bold text-stone-900">Managing Director</div>
                <div className="text-[11px] text-stone-500">Board Resolution No. BR/2025-26/19</div>
                <div className="text-[10px] text-[#3f5724] font-bold mt-1">
                  Enclosures: EMD FDR, Bank Guarantee & NABL Affidavits
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
