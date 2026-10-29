import React from 'react';
import {
  Globe2,
  Bell,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Building2,
  Truck,
  Cpu,
  HeartPulse,
  SunMedium,
  Users,
  Lock,
} from 'lucide-react';
import { CommodityPrice, Tender } from '../types';
import { useTranslation } from '../context/LanguageContext';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onExploreWorkspace: () => void;
  onOpenTender: (tender: Tender) => void;
  tenders: Tender[];
  commodities: CommodityPrice[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onSignIn,
  onExploreWorkspace,
  onOpenTender,
  tenders,
  commodities,
}) => {
  const { t } = useTranslation();

  const sectorIcons = [
    { name: 'Civil Construction', icon: Building2, count: 'CPWD · PWD · State works', color: 'text-amber-700 bg-amber-50' },
    { name: 'Roads & Highways', icon: Truck, count: 'NHAI · State highways', color: 'text-stone-700 bg-stone-100' },
    { name: 'Renewable Energy', icon: SunMedium, count: 'Solar · SECI', color: 'text-emerald-700 bg-emerald-50' },
    { name: 'IT & Cloud Services', icon: Cpu, count: 'Smart cities · State IT', color: 'text-blue-700 bg-blue-50' },
    { name: 'Healthcare & MedTech', icon: HeartPulse, count: 'Hospitals · Equipment', color: 'text-rose-700 bg-rose-50' },
  ];

  return (
    <div className="space-y-16 py-4 animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-white border border-stone-200 shadow-sm p-6 sm:p-10 lg:p-14">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-[#4d6b2f]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 rounded-full bg-[#4d6b2f]/5 blur-2xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4d6b2f]/10 border border-[#4d6b2f]/30 text-[#3f5724] text-xs font-bold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#4d6b2f] animate-ping" />
            <span>Tender intelligence for public procurement</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-900 tracking-tight leading-[1.15]">
            Smarter Government Bidding with{' '}
            <span className="text-[#3f5724] underline decoration-[#4d6b2f]/30 decoration-wavy underline-offset-8">
              TenDo Intelligence
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed">
            Follow government tenders from official sources, check your eligibility, estimate your bid with a BOQ costing model, and draft proposals with AI. Every notice shows where it came from, so you can verify it on the official portal.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-sm shadow-md shadow-[#4d6b2f]/25 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Get Started / Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreWorkspace}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm border border-stone-200 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Explore Live Workspace</span>
            </button>

            <button
              onClick={onSignIn}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-white hover:bg-stone-50 text-stone-700 font-bold text-sm border border-stone-300 transition active:scale-95"
            >
              <span>Sign In</span>
            </button>
          </div>

          {/* Trust Metric Badges */}
          <div className="pt-8 border-t border-stone-100 flex flex-wrap items-center justify-center gap-6 text-xs text-stone-500 font-medium">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#4d6b2f]" />
              <span>Editable BOQ costing templates</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#4d6b2f]" />
              <span>Sector and budget alert rules</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#4d6b2f]" />
              <span>Private per-user data (Firestore rules)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Target Sectors Quick Strip */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-stone-900">Covered Procurement Sectors</h2>
            <p className="text-xs text-stone-500">Sectors you can track and filter</p>
          </div>
          <button
            onClick={onExploreWorkspace}
            className="text-xs font-bold text-[#3f5724] hover:underline flex items-center gap-1"
          >
            <span>View All Bids</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {sectorIcons.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:border-[#4d6b2f]/40 transition group"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${sec.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-bold text-stone-900 group-hover:text-[#3f5724] transition">
                  {sec.name}
                </h3>
                <p className="text-[11px] text-stone-500 font-mono mt-0.5">{sec.count}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4 Feature Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1 */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/10 text-[#3f5724] flex items-center justify-center font-bold">
            <Globe2 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Official source tracking</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Pulls live notices from TED (EU) through its public API and links each record to its original page. CPPP and GeM have no public API, so TenDo links you to them for verification.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/10 text-[#3f5724] flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Sector alerts</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Set sector and budget rules. Matching notices appear in your account alerts.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/10 text-[#3f5724] flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Commodity price reference</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Indicative price trends for steel, cement and other inputs, used as defaults in your costing. Replace them with your own quotes before bidding.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/10 text-[#3f5724] flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900">AI Proposal & PDF Export</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Draft cover letters and BOQ justifications in several Indian languages with AI, review them, and export a PDF.
          </p>
        </div>
      </section>

      {/* Live Discovered Tenders Showcase */}
      <section className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4d6b2f] animate-pulse" />
              <h2 className="text-xl font-black text-stone-900">Recent notices</h2>
            </div>
            <p className="text-xs text-stone-500">Official notices and clearly labelled sample data</p>
          </div>
          <button
            onClick={onExploreWorkspace}
            className="px-4 py-2 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <span>Sign in to view all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-stone-100">
          {tenders.slice(0, 4).map((tender) => {
            const formattedBudget =
              !tender.budget
                ? 'Not stated'
                : tender.currency !== 'INR'
                ? `${tender.currency} ${tender.budget.toLocaleString()}`
                : tender.budget >= 10000000
                ? `₹${(tender.budget / 10000000).toFixed(2)} Cr`
                : `₹${(tender.budget / 100000).toFixed(2)} Lakh`;

            return (
              <div
                key={tender.id}
                className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:bg-stone-50/70 rounded-xl px-2 transition"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#4d6b2f]/10 text-[#3f5724]">
                      {tender.sector}
                    </span>
                    <span className="text-[11px] font-mono text-stone-400 font-semibold">{tender.refNumber}</span>
                    <span className="text-[11px] text-stone-500">• {tender.portal}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${tender.dataSource === 'live-ted' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                      {tender.dataSource === 'live-ted' ? 'Official notice' : 'Sample'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 group-hover:text-[#3f5724] transition">
                    {tender.title}
                  </h4>
                  <p className="text-xs text-stone-500">
                    Authority: <strong className="text-stone-700">{tender.authority}</strong> • Location: {tender.location}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <p className="text-[10px] text-stone-400 uppercase font-bold">Estimated NIT Value</p>
                    <p className="text-base font-black font-mono text-stone-900">{formattedBudget}</p>
                    {tender.companyFitScore > 0 && (
                      <p className="text-[10px] font-bold text-stone-500">Sample record · not analyzed</p>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenTender(tender)}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-[#4d6b2f] hover:text-white text-stone-800 text-xs font-bold border border-stone-200 transition"
                  >
                    Sign in to analyze
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3-Step Workflow */}
      <section className="p-8 rounded-3xl bg-stone-900 text-white space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold text-[#86a95f] uppercase tracking-wider">End-to-End Bidding Pipeline</span>
          <h2 className="text-2xl sm:text-3xl font-black">How TenDo Supercharges Your Bid Team</h2>
          <p className="text-xs text-stone-400">From finding a notice to a reviewed PDF proposal</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-2.5">
            <div className="w-8 h-8 rounded-full bg-[#4d6b2f] text-white font-black text-xs flex items-center justify-center">
              1
            </div>
            <h3 className="text-sm font-bold text-white">Track &amp; get alerts</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Choose your target sectors and budget range. TenDo lists matching notices from its official sources and flags them in your alerts.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-2.5">
            <div className="w-8 h-8 rounded-full bg-[#4d6b2f] text-white font-black text-xs flex items-center justify-center">
              2
            </div>
            <h3 className="text-sm font-bold text-white">Check feasibility &amp; cost it</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Score a tender against your company capacity, then build a BOQ using indicative rates for steel, cement, labour and machinery.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-2.5">
            <div className="w-8 h-8 rounded-full bg-[#4d6b2f] text-white font-black text-xs flex items-center justify-center">
              3
            </div>
            <h3 className="text-sm font-bold text-white">Proposal Generation & PDF Export</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Generate bid letters in Hindi, Tamil, Telugu or English with your BOQ schedule, then export a PDF. Always review before submitting.
            </p>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onGetStarted}
            className="px-8 py-3.5 rounded-2xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-sm shadow-lg shadow-[#4d6b2f]/30 transition transform active:scale-95"
          >
            Create your account
          </button>
        </div>
      </section>
    </div>
  );
};
