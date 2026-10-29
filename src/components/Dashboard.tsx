import React, { useMemo } from 'react';
import { User } from 'firebase/auth';
import { ArrowRight, Bell, Clock, FolderOpen, Search, Sparkles, FileCheck, Calculator } from 'lucide-react';
import { Tender } from '../types';

interface DashboardProps {
  user: User;
  tenders: Tender[];
  unreadCount: number;
  onNavigate: (tab: string) => void;
  onOpenTender: (tender: Tender) => void;
}

const DAY = 86_400_000;

function daysLeft(deadline: string): number | null {
  const t = Date.parse(deadline);
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / DAY);
}

function formatValue(t: Tender): string {
  if (!t.budget) return 'Value not stated';
  if (t.currency === 'INR') {
    return t.budget >= 10_000_000
      ? `₹${(t.budget / 10_000_000).toFixed(2)} Cr`
      : `₹${(t.budget / 100_000).toFixed(2)} Lakh`;
  }
  return `${t.currency} ${t.budget.toLocaleString()}`;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, tenders, unreadCount, onNavigate, onOpenTender }) => {
  const name = (user.displayName || user.email?.split('@')[0] || 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const { open, closingSoon, inProgress } = useMemo(() => {
    const withDays = tenders.map((t) => ({ t, d: daysLeft(t.submissionDeadline) }));
    const openList = withDays.filter((x) => x.d === null || x.d >= 0);
    return {
      open: openList.length,
      closingSoon: openList
        .filter((x) => x.d !== null && x.d <= 7)
        .sort((a, b) => (a.d as number) - (b.d as number))
        .slice(0, 5),
      inProgress: tenders.filter((t) => t.status !== 'Discovered' && t.status !== 'Won' && t.status !== 'Lost').length,
    };
  }, [tenders]);

  const stats = [
    { label: 'Open tenders', value: open, icon: FolderOpen, go: 'tenders' },
    { label: 'Closing in 7 days', value: closingSoon.length, icon: Clock, go: 'tenders' },
    { label: 'My bids in progress', value: inProgress, icon: FileCheck, go: 'pipeline' },
    { label: 'New alerts', value: unreadCount, icon: Bell, go: 'account' },
  ];

  const actions = [
    { label: 'Find tenders', hint: 'Browse and search', icon: Search, go: 'tenders' },
    { label: 'Ask AI', hint: 'Get answers in plain words', icon: Sparkles, go: 'assistant' },
    { label: 'Can I bid?', hint: 'Check if you qualify', icon: FileCheck, go: 'feasibility' },
    { label: 'Price my bid', hint: 'Work out your cost', icon: Calculator, go: 'costing' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-stone-900">{greeting}, {name}</h2>
        <p className="text-sm sm:text-base text-stone-600 mt-1">Here is what needs your attention today.</p>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => onNavigate(s.go)}
              className="text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#4d6b2f] transition"
            >
              <Icon className="w-5 h-5 text-[#4d6b2f]" />
              <p className="mt-3 text-3xl font-black text-stone-900">{s.value}</p>
              <p className="text-sm text-stone-600">{s.label}</p>
            </button>
          );
        })}
      </section>

      <section aria-label="What do you want to do?">
        <h3 className="text-base font-extrabold text-stone-900 mb-3">What do you want to do?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => onNavigate(a.go)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-stone-200 hover:border-[#4d6b2f] hover:bg-[#4d6b2f]/5 transition text-left"
              >
                <span className="w-11 h-11 rounded-xl bg-[#4d6b2f]/10 text-[#3f5724] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-stone-900">{a.label}</span>
                  <span className="block text-sm text-stone-500">{a.hint}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Closing soon" className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-extrabold text-stone-900">Closing soon</h3>
          <button onClick={() => onNavigate('tenders')} className="text-sm font-bold text-[#3f5724] hover:underline">See all</button>
        </div>
        {closingSoon.length === 0 ? (
          <p className="py-4 text-sm text-stone-500">Nothing closes in the next 7 days.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {closingSoon.map(({ t, d }) => (
              <li key={t.id}>
                <button onClick={() => onOpenTender(t)} className="w-full text-left py-3 flex items-center gap-3 hover:bg-stone-50 rounded-lg px-1">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-stone-900 truncate">{t.title}</span>
                    <span className="block text-xs text-stone-500 truncate">{t.authority} · {formatValue(t)}</span>
                  </span>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${(d as number) <= 2 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                    {(d as number) === 0 ? 'Today' : (d as number) === 1 ? '1 day left' : `${d} days left`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
