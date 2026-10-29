import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Building,
  Bell,
  Mail,
  Sliders,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Send,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  Clock,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { SectorType, Tender, TenderAlert, UserSectorProfile } from '../types';
import { getUserAlerts, getUserSectorProfile, markAlertAsRead, saveUserSectorProfile } from '../services/firebase';

interface UserAccountProps {
  currentUser: User | null;
  onLogout: () => void;
  onSelectTender: (tenderId: string) => void;
  tenders: Tender[];
  showToast: (msg: string) => void;
}

const ALL_SECTORS: SectorType[] = [
  'Civil Construction',
  'Roads & Highways',
  'Renewable Energy',
  'IT & Cloud',
  'Healthcare & MedTech',
  'Logistics & Defense',
];

export const UserAccount: React.FC<UserAccountProps> = ({
  currentUser,
  onLogout,
  onSelectTender,
  tenders,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'sector_alerts' | 'history'>('sector_alerts');

  // Sector Profile State
  const [targetSectors, setTargetSectors] = useState<SectorType[]>([
    'Civil Construction',
    'Roads & Highways',
    'Renewable Energy',
  ]);
  const [minBudget, setMinBudget] = useState<number>(10000000); // ₹1 Cr
  const [maxBudget, setMaxBudget] = useState<number>(2500000000); // ₹250 Cr
  const [alertEmail, setAlertEmail] = useState<string>(
    currentUser?.email || ''
  );
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState<boolean>(false);
  const [inAppAlertsEnabled, setInAppAlertsEnabled] = useState<boolean>(true);
  const [googleChatAlertsEnabled, setGoogleChatAlertsEnabled] = useState<boolean>(false);
  const [minFitScoreThreshold, setMinFitScoreThreshold] = useState<number>(70);

  // Cloud Function execution state
  const [isExecutingCloudFunction, setIsExecutingCloudFunction] = useState<boolean>(false);
  const [cloudFunctionLogs, setCloudFunctionLogs] = useState<string[]>([]);
  const [lastDispatchedAlert, setLastDispatchedAlert] = useState<any | null>(null);

  // Alerts History
  const [userAlerts, setUserAlerts] = useState<TenderAlert[]>([]);
  const [selectedAlertForPreview, setSelectedAlertForPreview] = useState<any | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Load existing profile & alerts on mount
  useEffect(() => {
    const loadProfileAndAlerts = async () => {
      if (!currentUser) return;
      try {
        // Use the authenticated user's Firestore records; the server no longer provides shared in-memory preferences.
        const p = await getUserSectorProfile(currentUser.uid);
        if (p) {
          setTargetSectors(p.targetSectors || ['Civil Construction']);
          setMinBudget(p.minBudget ?? 0);
          setMaxBudget(p.maxBudget ?? 0);
          setAlertEmail(p.alertEmail || currentUser.email || '');
          setEmailAlertsEnabled(p.emailAlertsEnabled ?? false);
          setInAppAlertsEnabled(p.inAppAlertsEnabled ?? true);
          setGoogleChatAlertsEnabled(p.googleChatAlertsEnabled ?? false);
          setMinFitScoreThreshold(p.minFitScoreThreshold ?? 70);
        }

        const alerts = await getUserAlerts(currentUser.uid);
        setUserAlerts(alerts);
      } catch (err) {
        console.warn('Could not load user-scoped sector preferences or alerts:', err);
        showToast('Could not load saved alert preferences. Check Firestore rules and connection.');
      }
    };

    loadProfileAndAlerts();
  }, [currentUser]);

  // Toggle sector selection
  const handleToggleSector = (sector: SectorType) => {
    setTargetSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  };

  // Save Sector Profile to Firestore & Server
  const handleSaveSectorProfile = async () => {
    setIsSavingProfile(true);
    const uid = currentUser?.uid || '';
    const profilePayload: Partial<UserSectorProfile> = {
      userId: uid,
      targetSectors,
      minBudget,
      maxBudget,
      preferredStates: ['All India', 'National Capital Region', 'Western Corridor'],
      emailAlertsEnabled,
      alertEmail,
      inAppAlertsEnabled,
      googleChatAlertsEnabled,
      minFitScoreThreshold,
    };

    try {
      if (!currentUser?.uid) throw new Error('Sign in to save alert preferences.');
      await saveUserSectorProfile(currentUser.uid, profilePayload);
      showToast('Sector preferences saved to your private account. Automatic delivery is not configured yet.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Report the current integration state without fabricating a successful scrape or alert.
  const handleRunCloudFunction = async () => {
    setIsExecutingCloudFunction(true);
    setLastDispatchedAlert(null);
    setCloudFunctionLogs([
      'Verified live connectors configured: TED (European Union) only.',
      'GeM and CPPP are currently link-out sources; no automated scan was performed.',
      'No tender was fabricated and no email or external notification was sent.',
      'Alert delivery requires a verified feed, persistent scheduler, and configured delivery provider.',
    ]);
    showToast('Connector status checked. No tender scan or alert was triggered.');
    setIsExecutingCloudFunction(false);
  };

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const email = currentUser?.email || alertEmail;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* User Header Profile Card with Circle Shape Avatar */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Circle Shape for Photo or Name First Letter */}
          <div className="w-16 h-16 rounded-full bg-[#4d6b2f] text-white flex items-center justify-center font-black text-2xl shadow-md border-3 border-white ring-2 ring-[#4d6b2f]/30 shrink-0 overflow-hidden">
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-stone-900">{displayName}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4d6b2f]/10 text-[#3f5724] border border-[#4d6b2f]/30">
                Bid Estimator
              </span>
            </div>
            <p className="text-xs text-stone-500 font-mono">{email}</p>
            <p className="text-xs text-stone-600 font-medium">
              Signed in with {currentUser?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'email'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-stone-200 gap-2">
        <button
          onClick={() => setActiveSubTab('sector_alerts')}
          className={`py-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === 'sector_alerts'
              ? 'border-[#4d6b2f] text-[#3f5724]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Zap className="w-4 h-4 text-[#4d6b2f]" />
          <span>Sector Alerts & Preferences</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`py-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === 'history'
              ? 'border-[#4d6b2f] text-[#3f5724]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Bell className="w-4 h-4 text-[#4d6b2f]" />
          <span>Dispatched Alerts History ({userAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('profile')}
          className={`py-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === 'profile'
              ? 'border-[#4d6b2f] text-[#3f5724]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Building className="w-4 h-4 text-[#4d6b2f]" />
          <span>Company Operational Capacity</span>
        </button>
      </div>

      {/* Tab 1: Sector Profile & Cloud Function Trigger (Main User Request) */}
      {activeSubTab === 'sector_alerts' && (
        <div className="space-y-6">
          {/* Cloud Function Scraper Action Banner */}
          <div className="p-6 rounded-3xl bg-linear-to-r from-stone-900 to-stone-800 text-white shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#4d6b2f]/30 text-[#a3cb78] text-[10px] font-bold uppercase tracking-wider">
                  <Zap className="w-3 h-3" />
                  <span>Connector status</span>
                </div>
                <h3 className="text-lg font-black">Tender alert preferences</h3>
                <p className="text-xs text-stone-300 max-w-xl leading-relaxed">
                  Your sector, budget and notification preferences are saved to your account. Automatic GeM/CPPP monitoring and delivery are not enabled; only configured source integrations can trigger real alerts.
                </p>
              </div>

              <button
                onClick={handleRunCloudFunction}
                disabled={isExecutingCloudFunction}
                className="px-5 py-3 rounded-2xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-xs shadow-lg transition active:scale-95 flex items-center gap-2 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${isExecutingCloudFunction ? 'animate-spin' : ''}`} />
                <span>{isExecutingCloudFunction ? 'Executing Cloud Function...' : 'Check connector status'}</span>
              </button>
            </div>

            {/* Cloud Function Execution Trace Box */}
            {cloudFunctionLogs.length > 0 && (
              <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-700/60 font-mono text-xs space-y-1.5 text-stone-300">
                <p className="text-[11px] font-bold text-[#86a95f] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connector status report:</span>
                </p>
                {cloudFunctionLogs.map((log, i) => (
                  <p key={i} className="text-[11px] leading-relaxed">
                    {log}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Alert Preview Card if just fired */}
          {lastDispatchedAlert && (
            <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                  <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                    Recorded alert:
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 font-bold">
                  {lastDispatchedAlert.emailStatus}
                </span>
              </div>
              <p className="text-sm font-bold text-stone-900">{lastDispatchedAlert.tenderTitle}</p>
              <p className="text-xs text-stone-600">{lastDispatchedAlert.matchReason}</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onSelectTender(lastDispatchedAlert.tenderId)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#4d6b2f] text-white text-xs font-bold hover:bg-[#3f5724] transition flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Open in BOQ Costing Engine</span>
                </button>
                <button
                  onClick={() => setSelectedAlertForPreview(lastDispatchedAlert)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-[#4d6b2f]" />
                  <span>Preview Email Alert Body</span>
                </button>
              </div>
            </div>
          )}

          {/* Sector Profile Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Target Sectors & Filter Rules */}
            <div className="lg:col-span-2 space-y-5 p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs">
              <div>
                <h3 className="text-base font-black text-stone-900">Target Procurement Sectors</h3>
                <p className="text-xs text-stone-500">
                  Select which sectors the scraper monitors for your organization.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ALL_SECTORS.map((sector) => {
                  const isSelected = targetSectors.includes(sector);
                  return (
                    <button
                      key={sector}
                      type="button"
                      onClick={() => handleToggleSector(sector)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                        isSelected
                          ? 'border-[#4d6b2f] bg-[#4d6b2f]/10 text-stone-900 font-bold'
                          : 'border-stone-200 hover:border-stone-300 text-stone-600'
                      }`}
                    >
                      <span className="text-xs">{sector}</span>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-[#4d6b2f] text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-stone-300" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Budget Range Threshold */}
              <div className="pt-4 border-t border-stone-100 space-y-3">
                <h4 className="text-xs font-black text-stone-800 uppercase tracking-wider">
                  Tender Budget Range Criteria (INR)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Minimum Budget</label>
                    <select
                      value={minBudget}
                      onChange={(e) => setMinBudget(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono font-bold bg-white"
                    >
                      <option value={2500000}>₹25 Lakh ($30K)</option>
                      <option value={5000000}>₹50 Lakh ($60K)</option>
                      <option value={10000000}>₹1.0 Crore ($120K)</option>
                      <option value={50000000}>₹5.0 Crore ($600K)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Maximum Budget</label>
                    <select
                      value={maxBudget}
                      onChange={(e) => setMaxBudget(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono font-bold bg-white"
                    >
                      <option value={500000000}>₹50 Crore ($6M)</option>
                      <option value={1000000000}>₹100 Crore ($12M)</option>
                      <option value={2500000000}>₹250 Crore ($30M)</option>
                      <option value={10000000000}>₹1,000 Crore+ ($120M)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Minimum Fit Score Slider */}
              <div className="pt-4 border-t border-stone-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800">Minimum Fit Score Threshold</label>
                  <span className="text-xs font-mono font-black text-[#3f5724]">{minFitScoreThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={minFitScoreThreshold}
                  onChange={(e) => setMinFitScoreThreshold(Number(e.target.value))}
                  className="w-full accent-[#4d6b2f]"
                />
                <p className="text-[11px] text-stone-500">
                  Use this threshold when matching is connected. Live matching and automatic delivery are not configured yet.
                </p>
              </div>
            </div>

            {/* Right Col: Notification Channels & Email Address */}
            <div className="space-y-5 p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs">
              <div>
                <h3 className="text-base font-black text-stone-900">Notification Delivery</h3>
                <p className="text-xs text-stone-500">Channels used to broadcast new matching tenders.</p>
              </div>

              <div className="space-y-3">
                {/* Email Alert Channel */}
                <div className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#4d6b2f]" />
                      <span className="text-xs font-bold text-stone-900">Email Alerts</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailAlertsEnabled}
                      onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#4d6b2f]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-500 mb-1 uppercase">
                      Recipient Email Address
                    </label>
                    <input
                      type="email"
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-mono focus:outline-none focus:border-[#4d6b2f] bg-white"
                    />
                  </div>
                </div>

                {/* In-App Firebase Alert Channel */}
                <div className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#4d6b2f]" />
                    <div>
                      <p className="text-xs font-bold text-stone-900">Firebase In-App Alerts</p>
                      <p className="text-[10px] text-stone-500">Bell badge and real-time toast</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={inAppAlertsEnabled}
                    onChange={(e) => setInAppAlertsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#4d6b2f]"
                  />
                </div>

                {/* Google Chat War Room Channel */}
                <div className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#4d6b2f]" />
                    <div>
                      <p className="text-xs font-bold text-stone-900">Google Chat Webhook</p>
                      <p className="text-[10px] text-stone-500">Post card to bidding space</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={googleChatAlertsEnabled}
                    onChange={(e) => setGoogleChatAlertsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#4d6b2f]"
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveSectorProfile}
                disabled={isSavingProfile}
                className="w-full py-3 rounded-2xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingProfile ? 'Saving...' : 'Save Sector Alert Profile'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Dispatched Alerts History */}
      {activeSubTab === 'history' && (
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-stone-900">Dispatched Tender Notifications</h3>
              <p className="text-xs text-stone-500">
                Alerts recorded for your account. Automatic alert creation is not enabled until verified feeds and delivery services are configured.
              </p>
            </div>
            <button
              onClick={handleRunCloudFunction}
              disabled={isExecutingCloudFunction}
              className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold border border-stone-200 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#4d6b2f] ${isExecutingCloudFunction ? 'animate-spin' : ''}`} />
              <span>Simulate New Match</span>
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {userAlerts.map((alert) => (
              <div
                key={alert.id}
                className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#4d6b2f]/10 text-[#3f5724]">
                      {alert.sector}
                    </span>
                    <span className="text-[11px] font-mono text-stone-500">{alert.portal}</span>
                    <span className="text-[11px] text-stone-400">• {new Date(alert.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">{alert.tenderTitle}</h4>
                  <p className="text-xs text-stone-500">{alert.matchReason}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedAlertForPreview(alert)}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#4d6b2f]" />
                    <span>View Email</span>
                  </button>
                  <button
                    onClick={() => onSelectTender(alert.tenderId)}
                    className="px-3 py-1.5 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold transition"
                  >
                    Open Tender
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Company Operational Capacity */}
      {activeSubTab === 'profile' && (
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xs space-y-4">
          <h3 className="text-base font-black text-stone-900">Company Capacity & Statutory Credentials</h3>
          <p className="text-xs text-stone-500">
            These metrics feed directly into the AI Feasibility Engine to calculate pre-qualification pass/fail.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-500 uppercase">Annual Turnover</span>
              <p className="text-lg font-black font-mono text-stone-900 mt-1">₹70.5 Crore</p>
              <p className="text-[11px] text-[#3f5724] font-medium"> audited FY 2025-26</p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-500 uppercase">Bank Solvency Limit</span>
              <p className="text-lg font-black font-mono text-stone-900 mt-1">₹26.5 Crore</p>
              <p className="text-[11px] text-[#3f5724] font-medium">State Bank of India (Consortium)</p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-500 uppercase">CPWD Registration</span>
              <p className="text-lg font-black font-mono text-stone-900 mt-1">Class-1 (Super Special)</p>
              <p className="text-[11px] text-[#3f5724] font-medium">Civil, Buildings & Highway Works</p>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {selectedAlertForPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#4d6b2f] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="font-bold text-xs">Email Alert Dispatch Preview</span>
              </div>
              <button
                onClick={() => setSelectedAlertForPreview(null)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-left">
              <div className="text-xs space-y-1 border-b border-stone-200 pb-3">
                <p>
                  <strong className="text-stone-500">To:</strong>{' '}
                  <span className="font-mono">{selectedAlertForPreview.emailPreview?.to || alertEmail}</span>
                </p>
                <p>
                  <strong className="text-stone-500">Subject:</strong>{' '}
                  <span className="font-bold text-stone-900">{selectedAlertForPreview.emailPreview?.subject}</span>
                </p>
                <p>
                  <strong className="text-stone-500">Status:</strong>{' '}
                  <span className="text-[#3f5724] font-bold">{selectedAlertForPreview.emailStatus}</span>
                </p>
              </div>

              <div
                className="prose prose-stone text-xs max-w-none"
                dangerouslySetInnerHTML={{
                  __html: selectedAlertForPreview.emailPreview?.htmlBody || selectedAlertForPreview.matchReason,
                }}
              />
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setSelectedAlertForPreview(null)}
                className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
