import React, { useState } from 'react';
import { CurrencyType, SectorType, Tender } from '../types';
import { formatCurrency, formatTenderValue, getTimeRemaining, getSectorBadgeColor, getFitScoreColor } from '../utils/formatters';
import { useTranslation } from '../context/LanguageContext';
import {
  Search,
  SlidersHorizontal,
  Clock,
  Building,
  Landmark,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface TenderListProps {
  tenders: Tender[];
  currency: CurrencyType;
  onSelectTenderForFeasibility: (tender: Tender) => void;
  onSelectTenderForCosting: (tender: Tender) => void;
  onSelectTenderForProposal: (tender: Tender) => void;
  onAddNewTender: (newTender: Partial<Tender>) => void;
}

const MetricCard: React.FC<{ label: string; value: number; detail: string; icon: React.ReactNode }> = ({ label, value, detail, icon }) => (
  <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className="text-2xl font-black text-stone-900 mt-1 font-mono">{value}</p>
      <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">{detail}</p>
    </div>
    <div className="w-11 h-11 shrink-0 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600">
      {icon}
    </div>
  </div>
);

export const TenderList: React.FC<TenderListProps> = ({
  tenders,
  currency,
  onSelectTenderForFeasibility,
  onSelectTenderForCosting,
  onSelectTenderForProposal,
  onAddNewTender,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('All');
  const [selectedPortal, setSelectedPortal] = useState<string>('All');
  const [minBudget, setMinBudget] = useState<number>(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // New tender form state
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthority, setCustomAuthority] = useState('');
  const [customSector, setCustomSector] = useState<SectorType>('Civil Construction');
  const [customBudget, setCustomBudget] = useState(35000000); // ₹3.5 Cr default
  const [customDays, setCustomDays] = useState(240);

  const sectors: (SectorType | 'All')[] = [
    'All',
    'Civil Construction',
    'Roads & Highways',
    'IT & Cloud',
    'Healthcare & MedTech',
    'Renewable Energy',
  ];

  const filteredTenders = tenders.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.authority.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.refNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSector = selectedSector === 'All' || t.sector === selectedSector;
    const matchesPortal =
      selectedPortal === 'All' || t.portal.toLowerCase().includes(selectedPortal.toLowerCase());
    const matchesBudget = t.budget >= minBudget;

    return matchesSearch && matchesSector && matchesPortal && matchesBudget;
  });

  const handleCreateCustomTender = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle || !customAuthority) return;

    onAddNewTender({
      title: customTitle.trim(),
      authority: customAuthority.trim(),
      sector: customSector,
      budget: Number(customBudget),
      currency: 'INR',
      completionDurationDays: Number(customDays),
      portal: 'Manual entry — source not verified',
      dataSource: 'user',
      refNumber: `MANUAL-${new Date().getFullYear()}-${Date.now()}`,
      location: 'Not provided',
      state: '',
      country: 'India',
      emdAmount: 0,
      performanceGuarantee: 'Not provided',
      description: 'User-entered tender record. Verify all details against the original notice before relying on it.',
      scopeOfWork: 'Not provided. Upload the original tender documents to extract and verify the scope of work.',
      eligibilityCriteria: {
        minAnnualTurnover: 0,
        minExperienceYears: 0,
        similarProjectsCount: 0,
        requiredCertifications: [],
        minSolvencyCertificate: 0,
      },
      status: 'Discovered',
      companyFitScore: 0,
      feasibilityVerdict: 'Not analyzed',
      competitorBidsCount: 0,
      lastScraped: '',
      addendums: [],
      documents: [],
      defaultBiddingTemplate: customSector === 'IT & Cloud' ? 'it_software' : 'civil_building',
    });

    setShowAddModal(false);
    setCustomTitle('');
    setCustomAuthority('');
  };

  return (
    <div className="space-y-6">
      {/* Provenance-aware workspace metrics. Mixed-currency totals and fake live-sync claims are intentionally omitted. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Workspace records"
          value={tenders.length}
          detail={`${tenders.filter((t) => t.dataSource === 'live-ted').length} live TED · ${tenders.filter((t) => t.dataSource === 'sample').length} sample · ${tenders.filter((t) => t.dataSource === 'user').length} user-entered`}
          icon={<Landmark className="w-5 h-5" />}
        />
        <MetricCard
          label="Analyzed matches"
          value={tenders.filter((t) => t.dataSource !== 'sample' && t.companyFitScore > 0).length}
          detail="Fit score calculated in this session"
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <MetricCard
          label="Deadlines within 7 days"
          value={tenders.filter((t) => {
            if (t.dataSource === 'sample' || !t.submissionDeadline) return false;
            const due = Date.parse(t.submissionDeadline);
            const days = (due - Date.now()) / 86400000;
            return Number.isFinite(due) && days >= 0 && days <= 7;
          }).length}
          detail="Only records with a stated deadline"
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          label="Deadlines not stated"
          value={tenders.filter((t) => t.dataSource !== 'sample' && !t.submissionDeadline).length}
          detail="Check the original notice"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder', 'Search by tender title, CPWD/GeM ref, authority, or city...')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#4d6b2f] transition"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Add Custom Tender Intake */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Intake New Tender</span>
            </button>
          </div>
        </div>

        {/* Sectors Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-stone-500 font-semibold mr-1 flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5" />
            Sector:
          </span>
          {sectors.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition font-semibold ${
                selectedSector === sec
                  ? 'bg-[#4d6b2f] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Tender Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredTenders.map((tender) => {
          const time = getTimeRemaining(tender.submissionDeadline);
          const hasFitScore = tender.companyFitScore > 0;
          const fit = getFitScoreColor(hasFitScore ? tender.companyFitScore : 0);

          return (
            <div
              key={tender.id}
              className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-[#4d6b2f]/60 hover:shadow-md transition flex flex-col justify-between group shadow-xs"
            >
              <div>
                {/* Header tags: Sector, Portal & Fit Score */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getSectorBadgeColor(
                        tender.sector
                      )}`}
                    >
                      {tender.sector}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                      {tender.portal}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] text-stone-500 font-mono">
                      {tender.refNumber}
                    </span>
                    {tender.dataSource === 'live-ted' ? (
                      <a
                        href={tender.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:underline"
                      >
                        Official notice ↗
                      </a>
                    ) : tender.dataSource === 'user' ? (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">Entered by you</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Illustrative demo data, not a real notice">Sample</span>
                    )}
                  </div>

                  {/* Fit Score Badge */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${hasFitScore ? fit.bg + ' ' + fit.border + ' ' + fit.text : 'bg-stone-100 border-stone-200 text-stone-600'}`}
                    title={hasFitScore ? "Fit score from the latest analysis in this session" : "Run an analysis to calculate a fit score"}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{hasFitScore ? `${tender.companyFitScore}% Match` : 'Not analyzed'}</span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-bold text-stone-900 text-base group-hover:text-[#3f5724] transition line-clamp-2">
                  {tender.title}
                </h3>

                {/* Authority & Location */}
                <div className="flex items-center gap-3 text-xs text-stone-500 mt-2">
                  <div className="flex items-center gap-1.5 truncate font-medium">
                    <Landmark className="w-3.5 h-3.5 text-[#4d6b2f] shrink-0" />
                    <span className="truncate">{tender.authority}</span>
                  </div>
                  <span className="text-stone-300">&bull;</span>
                  <div className="shrink-0">{tender.location}</div>
                </div>

                {/* Key Metrics Row: Budget, Duration, Deadline */}
                <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                  <div>
                    <span className="text-[11px] text-stone-500 block">Tender Value</span>
                    <span className="font-black text-stone-900 text-sm font-mono">
                      {formatTenderValue(tender.budget, tender.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-500 block">Duration</span>
                    <span className="font-bold text-stone-800">
                      {tender.completionDurationDays > 0 ? `${tender.completionDurationDays} Days` : 'Not stated'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-500 block">Submission Due</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        time.isUrgent ? 'text-amber-700 font-extrabold' : 'text-stone-700'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {time.text}
                    </span>
                  </div>
                </div>

                {/* Scope & Materials preview */}
                <p className="text-xs text-stone-600 mt-3 line-clamp-2 leading-relaxed">
                  {tender.scopeOfWork}
                </p>

                {/* Addendums notice if any */}
                {tender.addendums.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span className="truncate">
                      Corrigendum: {tender.addendums[0].title}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[11px] text-stone-500 font-mono font-medium">
                  <span>EMD: {formatCurrency(tender.emdAmount, currency)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectTenderForFeasibility(tender)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-[#3f5724] border border-stone-200 transition"
                  >
                    {t('checkFeasibility', 'Feasibility')}
                  </button>

                  <button
                    onClick={() => onSelectTenderForCosting(tender)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#4d6b2f] hover:bg-[#3f5724] text-white shadow-xs transition"
                  >
                    {t('runCosting', 'Estimate BOQ')}
                  </button>

                  <button
                    onClick={() => onSelectTenderForProposal(tender)}
                    className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition"
                    title={t('draftProposal', 'Draft Strategic Proposal')}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Tender Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-stone-200 p-6 sm:p-8 shadow-2xl text-stone-900">
            <h3 className="text-lg font-black text-stone-900 mb-1">Add a tender record</h3>
            <p className="text-xs text-stone-500 mb-4">
              Enter the fields you know. Missing requirements, dates and values must be verified from the original notice before analysis or bidding.
            </p>

            <form onSubmit={handleCreateCustomTender} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tender Title / Works Description
                </label>
                <input
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Construction of 500-Bed Super Specialty Hospital Wing"
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-medium focus:outline-none focus:border-[#4d6b2f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Authority / Department
                  </label>
                  <input
                    type="text"
                    required
                    value={customAuthority}
                    onChange={(e) => setCustomAuthority(e.target.value)}
                    placeholder="e.g. CPWD / AIIMS / NHAI"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-medium focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Sector
                  </label>
                  <select
                    value={customSector}
                    onChange={(e) => setCustomSector(e.target.value as SectorType)}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-medium focus:outline-none focus:border-[#4d6b2f]"
                  >
                    <option value="Civil Construction">Civil Construction</option>
                    <option value="Roads & Highways">Roads & Highways</option>
                    <option value="IT & Cloud">IT & Cloud</option>
                    <option value="Healthcare & MedTech">Healthcare & MedTech</option>
                    <option value="Renewable Energy">Renewable Energy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Estimated Budget (INR ₹)
                  </label>
                  <input
                    type="number"
                    min="100000"
                    required
                    value={customBudget}
                    onChange={(e) => setCustomBudget(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Completion Days
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="1500"
                    required
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#4d6b2f] hover:bg-[#3f5724] text-white shadow-xs"
                >
                  Add Tender & Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
