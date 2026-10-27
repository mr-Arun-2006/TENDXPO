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
    { name: 'Civil Construction', icon: Building2, count: '1,420+ Bids', color: 'text-amber-700 bg-amber-50' },
    { name: 'Roads & Highways', icon: Truck, count: '890+ Bids', color: 'text-stone-700 bg-stone-100' },
    { name: 'Renewable Energy', icon: SunMedium, count: '640+ Bids', color: 'text-emerald-700 bg-emerald-50' },
    { name: 'IT & Cloud Services', icon: Cpu, count: '1,120+ Bids', color: 'text-blue-700 bg-blue-50' },
    { name: 'Healthcare & MedTech', icon: HeartPulse, count: '410+ Bids', color: 'text-rose-700 bg-rose-50' },
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
            <span>Govt. of India e-Procurement • GeM & CPPP Real-Time Intelligence</span>
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
            Automate government tender scraping across CPWD, GeM, and NHAI. Receive instant Cloud Function email alerts matching your sector profile, model commodity price fluctuations in INR, and draft winning proposals in minutes.
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
              <span>CPWD Class-1 Standard BOQ Formulas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#4d6b2f]" />
              <span>Real-Time Cloud Function Sector Alerts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#4d6b2f]" />
              <span>Zero-Trust Firebase Firestore Security</span>
            </div>
          </div>
        </div>
      </section>

      {/* Target Sectors Quick Strip */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-stone-900">Covered Procurement Sectors</h2>
            <p className="text-xs text-stone-500">Official tenders scraped and indexed across central and state ministries</p>
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
          <h3 className="text-base font-bold text-stone-900">Official Portal Scraper</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Direct real-time scraping of official notices from GeM, CPPP (eprocure.gov.in), NHAI, and CPWD with instant BOQ parsing and corrigendum tracking.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/10 text-[#3f5724] flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Cloud Function Alerts</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Background triggers match new tenders against your specific sector profile, dispatching real-time email alerts and Firebase notifications before competitors react.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/10 text-[#3f5724] flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Real-Time Commodity Index</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Track daily market price swings for Fe550D TMT Steel, OPC-53 Cement, M-Sand, diesel logistics, and labor wage inflation to insulate profit margins.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/10 text-[#3f5724] flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900">AI Proposal & PDF Export</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Draft formal, multi-lingual executive cover letters and itemized BOQ justifications with digital signature stamps and export official print-ready PDFs.
          </p>
        </div>
      </section>

      {/* Live Discovered Tenders Showcase */}
      <section className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4d6b2f] animate-pulse" />
              <h2 className="text-xl font-black text-stone-900">Live Discovered Government Bids</h2>
            </div>
            <p className="text-xs text-stone-500">Official opportunities waiting for feasibility analysis and BOQ costing</p>
          </div>
          <button
            onClick={onExploreWorkspace}
            className="px-4 py-2 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <span>Open All in Pipeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-stone-100">
          {tenders.slice(0, 4).map((tender) => {
            const formattedBudget =
              tender.budget >= 10000000
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
                    <p className="text-[10px] font-bold text-[#3f5724]">{tender.companyFitScore}% Fit Score</p>
                  </div>

                  <button
                    onClick={() => onOpenTender(tender)}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-[#4d6b2f] hover:text-white text-stone-800 text-xs font-bold border border-stone-200 transition"
                  >
                    Analyze & Cost
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
          <p className="text-xs text-stone-400">From official portal scrape to DSC signed PDF proposal submission</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-2.5">
            <div className="w-8 h-8 rounded-full bg-[#4d6b2f] text-white font-black text-xs flex items-center justify-center">
              1
            </div>
            <h3 className="text-sm font-bold text-white">Target Sector Scrape & Alert</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Define target sectors (Civil, Roads, Energy). TenDo’s Cloud Function monitors GeM and CPPP portals 24/7 and triggers instant email & Firebase alerts.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-2.5">
            <div className="w-8 h-8 rounded-full bg-[#4d6b2f] text-white font-black text-xs flex items-center justify-center">
              2
            </div>
            <h3 className="text-sm font-bold text-white">Feasibility & Live Cost Modeling</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Auto-calculate pre-qualification scores against your company capacity, factoring in spot rates for TMT steel, OPC cement, labor, and machinery.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-2.5">
            <div className="w-8 h-8 rounded-full bg-[#4d6b2f] text-white font-black text-xs flex items-center justify-center">
              3
            </div>
            <h3 className="text-sm font-bold text-white">Proposal Generation & PDF Export</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Generate localized bid explainer letters in Hindi, Tamil, Telugu, or English, complete with contractor licenses, BOQ schedules, and exportable PDF packages.
            </p>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onGetStarted}
            className="px-8 py-3.5 rounded-2xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-sm shadow-lg shadow-[#4d6b2f]/30 transition transform active:scale-95"
          >
            Create Your Account & Configure Alerts
          </button>
        </div>
      </section>
    </div>
  );
};
