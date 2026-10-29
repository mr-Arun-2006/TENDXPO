import React, { useEffect, useState } from 'react';
import { CompanyProfile, CurrencyType, SupportedLanguage } from '../types';
import { formatCurrency } from '../utils/formatters';
import { useTranslation } from '../context/LanguageContext';
import {
  Building2,
  X,
  Check,
  ShieldCheck,
  HardHat,
  Award,
  Percent,
  Camera,
  Palette,
  Sliders,
  Smartphone,
  RefreshCw,
  Languages,
} from 'lucide-react';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CompanyProfile;
  currency: CurrencyType;
  onSaveProfile: (updated: Partial<CompanyProfile>) => void;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  currency,
  onSaveProfile,
}) => {
  const { language, setLanguage, t, supportedLanguages } = useTranslation();
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'pwa'>('profile');

  const [name, setName] = useState(profile.name);
  const [photoUrl, setPhotoUrl] = useState(profile.profilePhoto || '');
  const [turnover, setTurnover] = useState(profile.annualTurnover);
  const [solvency, setSolvency] = useState(profile.availableSolvency);
  const [activeProjects, setActiveProjects] = useState(profile.activeProjectsCount);
  const [maxCapacity, setMaxCapacity] = useState(profile.maxProjectCapacity);
  const [utilization, setUtilization] = useState(profile.currentCapacityUtilizationPercent);
  const [pastRating, setPastRating] = useState(profile.pastPerformanceRating);
  const [skilledCount, setSkilledCount] = useState(profile.skilledWorkforceCount);
  const [unskilledCount, setUnskilledCount] = useState(profile.unskilledWorkforceCount);
  const [machineryCount, setMachineryCount] = useState(profile.heavyMachineryCount);
  const [targetMargin, setTargetMargin] = useState(profile.targetMarginPercent);

  // Sample quick avatars
  const sampleAvatars = [
    { label: 'Initial Letter', url: '' },
    { label: 'Architect', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
    { label: 'Engineer', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
    { label: 'Executive', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
  ];

  const firstLetter = name?.trim()?.charAt(0)?.toUpperCase() || 'A';
  useEffect(() => {
    if (!isOpen) return;
    setName(profile.name || '');
    setPhotoUrl(profile.profilePhoto || '');
    setTurnover(profile.annualTurnover || 0);
    setSolvency(profile.availableSolvency || 0);
    setActiveProjects(profile.activeProjectsCount || 0);
    setMaxCapacity(profile.maxProjectCapacity || 0);
    setUtilization(profile.currentCapacityUtilizationPercent || 0);
    setPastRating(profile.pastPerformanceRating || 0);
    setSkilledCount(profile.skilledWorkforceCount || 0);
    setUnskilledCount(profile.unskilledWorkforceCount || 0);
    setMachineryCount(profile.heavyMachineryCount || 0);
    setTargetMargin(profile.targetMarginPercent || 10);
  }, [isOpen, profile]);

  if (!isOpen) return null;


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      name,
      profilePhoto: photoUrl,
      annualTurnover: Number(turnover),
      availableSolvency: Number(solvency),
      activeProjectsCount: Number(activeProjects),
      maxProjectCapacity: Number(maxCapacity),
      currentCapacityUtilizationPercent: Number(utilization),
      pastPerformanceRating: Number(pastRating),
      skilledWorkforceCount: Number(skilledCount),
      unskilledWorkforceCount: Number(unskilledCount),
      heavyMachineryCount: Number(machineryCount),
      targetMarginPercent: Number(targetMargin),
      currency: 'INR',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white border border-stone-200 p-6 sm:p-8 shadow-2xl text-stone-900 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#4d6b2f]/15 text-[#4d6b2f] flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-lg">
                {t('settingsTitle', 'PWA Settings & Company Profile')}
              </h3>
              <p className="text-xs text-stone-500">
                {t('settingsSubtitle', 'Indian Government e-Procurement Parameters & Theme Preferences')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch between Profile & PWA Settings */}
        <div className="flex items-center gap-2 mt-4 p-1 rounded-2xl bg-stone-100 border border-stone-200">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('profile')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeSettingsTab === 'profile'
                ? 'bg-[#4d6b2f] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('tabProfile', 'Company Profile & Bidding Limits')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('pwa')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeSettingsTab === 'pwa'
                ? 'bg-[#4d6b2f] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('tabPwa', 'PWA Settings, Theme & Language')}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {activeSettingsTab === 'profile' ? (
            <>
              {/* Profile Photo / Avatar in Circle Shape */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Company Avatar / Profile Photo (Circular Shape)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#4d6b2f] text-white flex items-center justify-center font-black text-2xl shadow-md border-3 border-white ring-2 ring-[#4d6b2f]/40 overflow-hidden shrink-0">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span>{firstLetter}</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="url"
                      placeholder="Paste image URL (optional) or leave empty for first letter"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#4d6b2f]"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-stone-500">Quick options:</span>
                      {sampleAvatars.map((av, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPhotoUrl(av.url)}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white border border-stone-200 hover:border-[#4d6b2f] text-stone-700 transition"
                        >
                          {av.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Legal Name */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Company Name (Registered Legal Entity)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-semibold focus:outline-none focus:border-[#4d6b2f]"
                />
              </div>

              {/* Financial Solvency & Annual Turnover */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Annual Turnover (INR ₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={turnover}
                    onChange={(e) => setTurnover(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    Formatted: {formatCurrency(turnover, 'INR')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Liquid Solvency Certificate (INR ₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={solvency}
                    onChange={(e) => setSolvency(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    Formatted: {formatCurrency(solvency, 'INR')}
                  </p>
                </div>
              </div>

              {/* Operational Capacity & Rating */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Active Projects
                  </label>
                  <input
                    type="number"
                    value={activeProjects}
                    onChange={(e) => setActiveProjects(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Past Rating (0 - 5.0)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={pastRating}
                    onChange={(e) => setPastRating(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>
              </div>

              {/* Workforce & Machinery */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Skilled Engineers
                  </label>
                  <input
                    type="number"
                    value={skilledCount}
                    onChange={(e) => setSkilledCount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    General Labor
                  </label>
                  <input
                    type="number"
                    value={unskilledCount}
                    onChange={(e) => setUnskilledCount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Heavy Machinery
                  </label>
                  <input
                    type="number"
                    value={machineryCount}
                    onChange={(e) => setMachineryCount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-900 font-mono font-bold focus:outline-none focus:border-[#4d6b2f]"
                  />
                </div>
              </div>
            </>
          ) : (
            /* PWA Settings Tab: Multilingual Selection & White with Olive Green Theme */
            <div className="space-y-4">
              {/* Language Selector in Settings */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Languages className="w-5 h-5 text-[#4d6b2f]" />
                  <h4 className="font-bold text-stone-900 text-sm">
                    {t('languagePreference', 'भाषा चयन / Language Preference')}
                  </h4>
                </div>
                <p className="text-xs text-stone-500">
                  Select your preferred language for TenDo interface, bid cards, and costing explanations.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {supportedLanguages.map((l) => {
                    const isSelected = l.code === language;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => setLanguage(l.code)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition text-left ${
                          isSelected
                            ? 'bg-[#4d6b2f] text-white border-[#4d6b2f] shadow-xs'
                            : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-200'
                        }`}
                      >
                        <span className="text-base">{l.flag}</span>
                        <div className="min-w-0">
                          <p className="truncate leading-tight">{l.nativeName}</p>
                          <p className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-stone-400'}`}>
                            {l.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Preference */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-[#4d6b2f]" />
                  <h4 className="font-bold text-stone-900 text-sm">
                    {t('themeTitle', 'Color Theme')}
                  </h4>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border-2 border-[#4d6b2f] text-xs font-bold text-[#3f5724] shadow-xs">
                    <span className="w-4 h-4 rounded-full bg-[#4d6b2f] border border-white shadow-2xs"></span>
                    <span>{t('activeTheme', 'White & Olive Green')} (#4d6b2f)</span>
                  </div>
                </div>
                <p className="text-xs text-stone-500">
                  Optimized for high-contrast official government bid auditing, BOQ spreadsheets, and daytime field use.
                </p>
              </div>

              {/* PWA Offline & Cache Preferences */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#4d6b2f]" />
                  <h4 className="font-bold text-stone-900 text-sm">PWA Offline & Cache Preferences</h4>
                </div>
                <div className="space-y-2 text-xs text-stone-600">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-[#4d6b2f] focus:ring-[#4d6b2f]" />
                    <span>Cache active Indian government tenders for offline viewing</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-[#4d6b2f] focus:ring-[#4d6b2f]" />
                    <span>Offline BOQ draft saving into local device storage</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-[#4d6b2f] focus:ring-[#4d6b2f]" />
                    <span>Real-time portal notification alerts for closing bids (&lt;48h)</span>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <h4 className="font-bold text-stone-900 text-sm mb-1">Official Portal Scraper Sync</h4>
                <p className="text-xs text-stone-500 mb-3">
                  Autonomous background sync interval for GeM and CPPP portal notices.
                </p>
                <select
                  defaultValue="30"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-800 focus:outline-none focus:border-[#4d6b2f]"
                >
                  <option value="15">Every 15 minutes (High Alert Mode)</option>
                  <option value="30">Every 30 minutes (Standard)</option>
                  <option value="60">Hourly</option>
                  <option value="manual">Manual Trigger Only</option>
                </select>
              </div>
            </div>
          )}

          {/* Footer action buttons */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#4d6b2f] hover:bg-[#3f5724] text-white shadow-md transition active:scale-95"
            >
              {t('saveSettings', 'Save Settings & Profile')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
