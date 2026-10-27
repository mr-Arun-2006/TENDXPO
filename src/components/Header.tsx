import React, { useState, useRef, useEffect } from 'react';
import { CurrencyType, PortalNotification, SupportedLanguage } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useTranslation } from '../context/LanguageContext';
import {
  Bell,
  RefreshCw,
  SlidersHorizontal,
  FileSpreadsheet,
  Kanban,
  FileCheck,
  TrendingUp,
  Globe2,
  Settings,
  Languages,
  Check,
  ChevronDown,
  MessageSquare,
  Home,
  Zap,
  LogIn,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currency: CurrencyType;
  setCurrency?: (curr: CurrencyType) => void;
  isScraping: boolean;
  onTriggerScrape: () => void;
  notifications: PortalNotification[];
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenGoogleChat?: () => void;
  isGoogleChatConnected?: boolean;
  companyName: string;
  activeBidsCount?: number;
  profilePhoto?: string;
  currentUser?: User | null;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isScraping,
  onTriggerScrape,
  notifications,
  onOpenNotifications,
  onOpenProfile,
  onOpenGoogleChat,
  isGoogleChatConnected = false,
  companyName,
  activeBidsCount = 5,
  profilePhoto,
  currentUser,
  onOpenAuth,
}) => {
  const { language, setLanguage, t, supportedLanguages } = useTranslation();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const firstLetter =
    currentUser?.displayName?.trim()?.charAt(0)?.toUpperCase() ||
    companyName?.trim()?.charAt(0)?.toUpperCase() ||
    'A';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLangObj = supportedLanguages.find((l) => l.code === language) || supportedLanguages[0];

  const navTabs = [
    { id: 'landing', label: t('tabHome', 'Home'), icon: Home },
    { id: 'tenders', label: t('tabTenders', 'Official Portals (GeM / CPPP)'), icon: Globe2 },
    { id: 'costing', label: t('tabCosting', 'Costing & BOQ Estimator'), icon: FileSpreadsheet },
    { id: 'feasibility', label: t('tabFeasibility', 'Bid Feasibility Matrix'), icon: SlidersHorizontal },
    { id: 'pipeline', label: t('tabPipeline', 'Bid Submission Tracker'), icon: Kanban },
    { id: 'proposal', label: t('tabProposal', 'AI Proposal Explainer'), icon: FileCheck },
    { id: 'commodities', label: t('tabCommodities', 'Commodity Volatility Index'), icon: TrendingUp },
    { id: 'account', label: t('tabAccount', 'Sector Alerts & Account'), icon: Zap },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      {/* Top utility bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand (Clicking goes to landing) */}
          <button
            type="button"
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0 text-left hover:opacity-95 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-[#4d6b2f] flex items-center justify-center shadow-md shadow-[#4d6b2f]/20 text-white font-black text-xl shrink-0">
              TD
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-lg text-stone-900 tracking-tight">TenDo</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#4d6b2f]/10 text-[#3f5724] border border-[#4d6b2f]/30 shadow-2xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4d6b2f] animate-pulse"></span>
                  {t('govBadge', 'Govt. of India e-Procurement')}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 hidden sm:block truncate">
                {t('brandSubtitle', 'Tender Intelligence, CPWD/GeM BOQ Costing & Real-Time INR Financials')}
              </p>
            </div>
          </button>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Multilingual Selector Dropdown */}
            <div className="relative" ref={langDropdownRef}>
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                  langDropdownOpen
                    ? 'bg-[#4d6b2f]/10 text-[#3f5724] border-[#4d6b2f]'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                }`}
                title="Select Language / भाषा चुनें / மொழி மாற்றவும்"
                aria-label="Language Selector"
              >
                <Languages className="w-3.5 h-3.5 text-[#4d6b2f]" />
                <span className="text-sm leading-none">{currentLangObj.flag}</span>
                <span className="font-semibold hidden sm:inline">{currentLangObj.nativeName}</span>
                <span className="font-semibold uppercase sm:hidden">{currentLangObj.code}</span>
                <ChevronDown className={`w-3 h-3 text-stone-500 transition-transform duration-200 ${langDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-stone-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 border-b border-stone-100 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Select Language / भाषा
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {supportedLanguages.map((l) => {
                      const isSelected = l.code === language;
                      return (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => {
                            setLanguage(l.code);
                            setLangDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition ${
                            isSelected
                              ? 'bg-[#4d6b2f]/10 text-[#3f5724] font-bold'
                              : 'text-stone-700 hover:bg-stone-50 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{l.flag}</span>
                            <div className="text-left">
                              <p className="font-bold text-stone-900 leading-tight">{l.nativeName}</p>
                              <p className="text-[10px] text-stone-500">{l.name}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#4d6b2f]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Scrape Portals Trigger */}
            <button
              onClick={onTriggerScrape}
              disabled={isScraping}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 ${
                isScraping
                  ? 'bg-[#4d6b2f]/15 text-[#3f5724] border border-[#4d6b2f]/30'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
              }`}
              title="Poll Indian Official Portals: GeM, CPPP, NHAI, Railways, CPWD"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#4d6b2f] shrink-0 ${isScraping ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline font-medium">
                {isScraping ? t('pollingPortals', 'Polling Portals...') : t('syncPortals', 'Sync Portals (GeM/CPPP)')}
              </span>
            </button>

            {/* Indian Govt Only Badge (INR Official) */}
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold font-mono">
              <span className="text-[#4d6b2f]">₹</span>
              <span>{t('inrCurrency', 'INR (₹ Lakh / Cr)')}</span>
            </div>

            {/* Google Chat Collaboration Button */}
            <button
              onClick={onOpenGoogleChat}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                isGoogleChatConnected
                  ? 'bg-[#4d6b2f]/10 text-[#3f5724] border-[#4d6b2f]/30 hover:bg-[#4d6b2f]/20'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
              }`}
              title="Google Chat: Team Collaboration & Automated Bid Alerts"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#4d6b2f]" />
              <span className="hidden sm:inline">Google Chat</span>
              {isGoogleChatConnected && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#4d6b2f] animate-pulse"></span>
              )}
            </button>

            {/* Notifications Button */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 transition shrink-0"
              title="View proposal notifications and deadline alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Settings Quick Button */}
            <button
              onClick={onOpenProfile}
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 transition shrink-0"
              title={t('pwaSettings', 'PWA Settings & Capacity Parameters')}
            >
              <Settings className="w-4 h-4 text-stone-600" />
            </button>

            {/* Circular Profile Avatar with Real-time Active Bids Badge */}
            {currentUser ? (
              <button
                onClick={() => setActiveTab('account')}
                className={`flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-full border transition shadow-2xs group shrink-0 ${
                  activeTab === 'account'
                    ? 'bg-[#4d6b2f]/15 border-[#4d6b2f]'
                    : 'bg-stone-100 hover:bg-stone-200 border-stone-200'
                }`}
                title="Click to view User Account, Sector Alerts & Profile"
              >
                {/* Circular Shape for Photo or Name First Letter */}
                <div className="w-8 h-8 rounded-full bg-[#4d6b2f] text-white flex items-center justify-center font-bold text-sm shadow-xs border-2 border-white ring-1 ring-[#4d6b2f]/30 shrink-0 overflow-hidden">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt={companyName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{firstLetter}</span>
                  )}
                </div>

                {/* Active Bids Badge next to circle profile */}
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#4d6b2f]/10 border border-[#4d6b2f]/30 text-[#3f5724] font-bold text-[11px] font-mono shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4d6b2f] animate-pulse"></span>
                  <span>{activeBidsCount} {t('activeShort', 'Active')}</span>
                </span>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold shadow-xs transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* PWA Install Button */}
            <PWAInstallButton />
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none border-t border-stone-200 -mx-3 px-3 sm:mx-0 sm:px-0">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 ${
                  isActive
                    ? 'bg-[#4d6b2f] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
