import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  FileCheck,
  FileSpreadsheet,
  Globe2,
  Kanban,
  Languages,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  User as UserIcon,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';
import { useTranslation } from '../context/LanguageContext';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean; // shown in the mobile bottom bar
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'tenders', label: 'Tenders', icon: Globe2, primary: true },
  { id: 'assistant', label: 'AI Assistant', icon: Sparkles, primary: true },
  { id: 'pipeline', label: 'Pipeline', icon: Kanban, primary: true },
  { id: 'feasibility', label: 'Feasibility', icon: SlidersHorizontal },
  { id: 'costing', label: 'Costing & BOQ', icon: FileSpreadsheet },
  { id: 'proposal', label: 'Proposal', icon: FileCheck },
  { id: 'commodities', label: 'Commodity prices', icon: TrendingUp },
  { id: 'sources', label: 'Official sources', icon: ShieldCheck },
  { id: 'account', label: 'Account & alerts', icon: UserIcon },
];

interface AppShellProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  user: User;
  unreadCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenGoogleChat: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onNavigate,
  user,
  unreadCount,
  isRefreshing,
  onRefresh,
  onOpenNotifications,
  onOpenProfile,
  onOpenGoogleChat,
  onLogout,
  children,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = (user.displayName || user.email || 'U').trim().charAt(0).toUpperCase();
  const name = user.displayName || user.email?.split('@')[0] || 'User';
  const current = NAV_ITEMS.find((n) => n.id === activeTab);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const go = (id: string) => {
    setMenuOpen(false);
    onNavigate(id);
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        type="button"
        onClick={() => go(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-semibold transition ${
          active ? 'bg-[#4d6b2f] text-white' : 'text-stone-700 hover:bg-stone-100'
        }`}
      >
        <Icon className={`w-4.5 h-4.5 ${active ? 'text-white' : 'text-stone-500'}`} />
        {item.label}
      </button>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-stone-50 text-stone-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-stone-200 z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-stone-200">
          <div className="w-9 h-9 rounded-xl bg-[#4d6b2f] text-white flex items-center justify-center font-black">TD</div>
          <span className="text-lg font-extrabold tracking-tight">TenDo</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main">
          {NAV_ITEMS.map((item) => <NavButton key={item.id} item={item} />)}
        </nav>
        <div className="p-3 border-t border-stone-200">
          <div className="flex items-center gap-3 p-2">
            <Avatar user={user} initial={initial} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{name}</p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={onLogout} className="mt-1 w-full h-10 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-100 flex items-center gap-2 px-3">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200 lg:ml-64 pt-[env(safe-area-inset-top)]">
        <div className="h-14 lg:h-16 px-3 sm:px-6 flex items-center gap-2">
          <div className="lg:hidden w-8 h-8 rounded-lg bg-[#4d6b2f] text-white flex items-center justify-center font-black text-sm">TD</div>
          <h1 className="text-base lg:text-lg font-extrabold truncate flex-1">{current?.label || 'TenDo'}</h1>

          <LanguageMenu />

          <IconBtn label="Refresh tender feed" onClick={onRefresh}>
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </IconBtn>
          <IconBtn label="Google Chat" onClick={onOpenGoogleChat} className="hidden sm:flex">
            <MessageSquare className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Notifications" onClick={onOpenNotifications} className="relative">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </IconBtn>
          <IconBtn label="Company settings" onClick={onOpenProfile} className="hidden sm:flex">
            <Settings className="w-4 h-4" />
          </IconBtn>
          <div className="hidden md:block"><PWAInstallButton /></div>
        </div>
      </header>

      {/* Content */}
      <main className="lg:ml-64 px-3 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-8 max-w-[1400px]">{children}</main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]"
      >
        {NAV_ITEMS.filter((n) => n.primary).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`h-16 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${active ? 'text-[#3f5724]' : 'text-stone-500'}`}
            >
              <Icon className="w-5 h-5" />
              {item.label.replace('AI ', '')}
            </button>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          aria-haspopup="dialog"
          className={`h-16 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
            NAV_ITEMS.some((n) => !n.primary && n.id === activeTab) ? 'text-[#3f5724]' : 'text-stone-500'
          }`}
        >
          <MenuIcon className="w-5 h-5" />
          Menu
        </button>
      </nav>

      {/* Mobile menu sheet */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 max-h-[85dvh] overflow-y-auto bg-white rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar user={user} initial={initial} />
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{name}</p>
                  <p className="text-xs text-stone-500 truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => <NavButton key={item.id} item={item} />)}
              <button onClick={() => { setMenuOpen(false); onOpenGoogleChat(); }} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-100">
                <MessageSquare className="w-4.5 h-4.5 text-stone-500" /> Google Chat
              </button>
              <button onClick={() => { setMenuOpen(false); onOpenProfile(); }} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-100">
                <Settings className="w-4.5 h-4.5 text-stone-500" /> Company settings
              </button>
              <button onClick={() => { setMenuOpen(false); onLogout(); }} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50">
                <LogOut className="w-4.5 h-4.5" /> Sign out
              </button>
            </div>
            <div className="mt-3 md:hidden"><PWAInstallButton /></div>
          </div>
        </div>
      )}
    </div>
  );
};

const Avatar: React.FC<{ user: User; initial: string }> = ({ user, initial }) => (
  <div className="w-9 h-9 rounded-full bg-[#4d6b2f] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
    {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : initial}
  </div>
);

const IconBtn: React.FC<{ label: string; onClick: () => void; className?: string; children: React.ReactNode }> = ({ label, onClick, className = '', children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`w-10 h-10 shrink-0 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 flex items-center justify-center ${className}`}
  >
    {children}
  </button>
);

const LanguageMenu: React.FC = () => {
  const { language, setLanguage, supportedLanguages } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = supportedLanguages.find((l) => l.code === language) || supportedLanguages[0];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className="h-10 px-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-xs font-bold text-stone-700 flex items-center gap-1.5"
      >
        <Languages className="w-4 h-4 text-[#4d6b2f]" />
        <span className="uppercase">{current.code}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-stone-200 shadow-xl py-1.5 z-50 max-h-72 overflow-y-auto">
          {supportedLanguages.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); setOpen(false); }}
              className="w-full flex items-center justify-between px-3.5 h-10 text-sm hover:bg-stone-50"
            >
              <span className="font-semibold">{l.nativeName} <span className="text-xs text-stone-400 font-normal">{l.name}</span></span>
              {l.code === language && <Check className="w-4 h-4 text-[#4d6b2f]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
