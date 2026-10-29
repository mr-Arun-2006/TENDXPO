import React, { useState, useEffect } from 'react';
import { BidCalculation, BOQItem, CommodityPrice, CompanyProfile, CurrencyType, PortalNotification, Tender, TenderStatus } from './types';
import { DEFAULT_COMPANY_PROFILE, INITIAL_NOTIFICATIONS, SECTOR_BOQ_TEMPLATES } from './data/initialData';
import { AppShell } from './components/AppShell';
import { PublicNav } from './components/PublicNav';
import { LandingPage } from './components/LandingPage';
import { AuthPage, AuthMode } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { AssistantChat } from './components/AssistantChat';
import { OfficialSources } from './components/OfficialSources';
import { UserAccount } from './components/UserAccount';
import { TenderList } from './components/TenderList';
import { CostEstimationEngine } from './components/CostEstimationEngine';
import { FeasibilityEngine } from './components/FeasibilityEngine';
import { PipelineTracker } from './components/PipelineTracker';
import { ProposalGenerator } from './components/ProposalGenerator';
import { CommodityTracker } from './components/CommodityTracker';
import { CompanyProfileModal } from './components/CompanyProfileModal';
import { NotificationsModal } from './components/NotificationsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { GoogleChatModal } from './components/GoogleChatModal';
import { usePortalWebSocket } from './hooks/usePortalWebSocket';
import { User } from 'firebase/auth';
import { initAuth, logout } from './services/firebase';
import { apiFetch } from './services/api';

const APP_TABS = ['dashboard','tenders','assistant','pipeline','feasibility','costing','proposal','commodities','sources','account'];

/** Hash routes: '' (landing), 'login', 'register', or 'app/<tab>'. */
function parseHash(): string {
  return window.location.hash.replace(/^#\/?/, '');
}

function navigateTo(route: string) {
  const next = route ? `#/${route}` : '#/';
  if (window.location.hash !== next) window.location.hash = next;
}

export default function App() {
  const [route, setRoute] = useState<string>(() => parseHash());
  const [currency, setCurrency] = useState<CurrencyType>('INR');
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [commodities, setCommodities] = useState<CommodityPrice[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(DEFAULT_COMPANY_PROFILE);
  const [notifications, setNotifications] = useState<PortalNotification[]>(INITIAL_NOTIFICATIONS);

  // Active selected tender for deep dive
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);

  // Active calculated costing model
  const [activeCalculation, setActiveCalculation] = useState<BidCalculation | null>(null);
  const [activeBOQItems, setActiveBOQItems] = useState<BOQItem[]>(SECTOR_BOQ_TEMPLATES.civil_building.items);

  // UI state
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [showGoogleChatModal, setShowGoogleChatModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-Time Official Portals WebSocket Hook
  const { connectionState, liveEvents, triggerScan, toggleSound, isSoundOn } = usePortalWebSocket();

  // Firebase & Google Workspace Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Real-time synchronization when WebSocket receives official portal events
  useEffect(() => {
    if (liveEvents.length > 0) {
      const latest = liveEvents[0];
      if (latest.eventType === 'tender_published' && latest.tenderData) {
        setTenders((prev) => {
          // Idempotency check: guard against duplicate tenders
          if (prev.some((t) => t.id === latest.tenderData!.id || t.refNumber === latest.tenderData!.refNumber)) {
            return prev;
          }
          return [{ ...latest.tenderData!, dataSource: 'sample' as const }, ...prev];
        });

        const notif: PortalNotification = {
          id: `notif-${latest.id}`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          type: 'New Tender',
          title: `[Simulated feed] ${latest.portal}: new tender`,
          message: `${latest.title} (₹${((latest.budget || 0) / 10000000).toFixed(2)} Cr)`,
          tenderId: latest.tenderData.id,
          severity: 'success',
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);
        showToast(`Simulated feed: ${latest.title.slice(0, 38)}...`);
      } else if (latest.eventType === 'corrigendum_issued') {
        const notif: PortalNotification = {
          id: `notif-${latest.id}`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          type: 'Corrigendum',
          title: `⚠️ [${latest.portal}] Corrigendum Released`,
          message: latest.title,
          tenderId: latest.tenderId || '',
          severity: 'warning',
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);
      } else if (latest.eventType === 'price_tick') {
        fetchCommodities();
      }
    }
  }, [liveEvents]);

  // Fetch tenders (official TED notices + clearly labelled sample data)
  const fetchTenders = async (refresh = false) => {
    try {
      const res = await fetch(refresh ? '/api/tenders?refresh=1' : '/api/tenders');
      const data = await res.json();
      if (data.status === 'success' && data.tenders) {
        // Keep tenders the user entered by hand; everything else comes from the server.
        setTenders((prev) => [
          ...data.tenders,
          ...prev.filter((t) => t.dataSource === 'user' && !data.tenders.some((x: Tender) => x.id === t.id)),
        ]);
        if (!selectedTender && data.tenders.length > 0) {
          setSelectedTender(data.tenders[0]);
        }
      }
    } catch (err) {
      console.warn('Using local fallback tenders:', err);
    }
  };

  // Fetch commodities
  const fetchCommodities = async () => {
    try {
      const res = await fetch('/api/commodities');
      const data = await res.json();
      if (data.status === 'success' && data.commodities) {
        setCommodities(data.commodities);
      }
    } catch (err) {
      console.warn('Commodities fetch error:', err);
    }
  };

  // Fetch company profile
  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/company-profile');
      const data = await res.json();
      if (data.status === 'success' && data.profile) {
        setCompanyProfile(data.profile);
      }
    } catch (err) {
      console.warn('Profile fetch error:', err);
    }
  };

  useEffect(() => {
    fetchTenders();
    fetchCommodities();
    fetchProfile();

    // Listen to Firebase Auth state
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        if (token) setGoogleAccessToken(token);
        setAuthReady(true);
      },
      () => {
        setCurrentUser(null);
        setGoogleAccessToken(null);
        setAuthReady(true);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Keep route in sync with the URL hash (back/forward buttons work).
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Route guard: private pages need a session; signed-in users skip the public pages.
  useEffect(() => {
    if (!authReady) return;
    const isApp = route.startsWith('app/');
    const isPublicAuth = route === 'login' || route === 'register';
    if (isApp && !currentUser) {
      navigateTo('login');
    } else if (currentUser && (route === '' || isPublicAuth)) {
      navigateTo('app/dashboard');
    } else if (isApp && !APP_TABS.includes(route.slice(4))) {
      navigateTo('app/dashboard');
    }
  }, [authReady, currentUser, route]);

  const activeTab = route.startsWith('app/') ? route.slice(4) : 'landing';
  const setActiveTab = (tab: string) => navigateTo(tab === 'landing' ? '' : `app/${tab}`);

  // Refresh the tender feed from official sources
  const handleRefreshFeed = async () => {
    setIsScraping(true);
    await fetchTenders(true);
    setIsScraping(false);
    showToast('Tender feed refreshed from official sources.');
  };

  // User adds custom tender
  const handleAddNewTender = (newTenderData: Partial<Tender>) => {
    const fullTender = newTenderData as Tender;
    setTenders((prev) => [fullTender, ...prev]);
    setSelectedTender(fullTender);
    showToast(`Added tender "${fullTender.title.slice(0, 30)}..." to pipeline.`);
  };

  // Update status (e.g., from Kanban or table)
  const handleUpdateTenderStatus = async (tenderId: string, status: TenderStatus, notes?: string) => {
    setTenders((prev) =>
      prev.map((t) => (t.id === tenderId ? { ...t, status, customNotes: notes || t.customNotes } : t))
    );
    try {
      await apiFetch(`/api/tenders/${tenderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, customNotes: notes }),
      });
      showToast(`Updated tender stage to "${status}".`);
    } catch (err) {
      // Local state is already updated
    }
  };

  // Navigation handlers
  const handleSelectForFeasibility = (tender: Tender) => {
    setSelectedTender(tender);
    setActiveTab('feasibility');
  };

  const handleSelectForCosting = (tender: Tender) => {
    setSelectedTender(tender);
    setActiveTab('costing');
  };

  const handleSelectForProposal = (tender: Tender) => {
    setSelectedTender(tender);
    setActiveTab('proposal');
  };

  const handleProceedToProposalFromCosting = (
    tender: Tender,
    calc: BidCalculation,
    items: BOQItem[]
  ) => {
    setSelectedTender(tender);
    setActiveCalculation(calc);
    setActiveBOQItems(items);
    setActiveTab('proposal');
    showToast('Costing & BOQ breakdown transferred to proposal document.');
  };

  const handleUpdateFitScore = (tenderId: string, score: number) => {
    setTenders((prev) =>
      prev.map((t) => (t.id === tenderId ? { ...t, companyFitScore: score } : t))
    );
  };

  // If activeCalculation is null, compute a default for the selected tender
  const currentCalc =
    activeCalculation || {
      directMaterialsCost: 777065,
      directLaborCost: 1238000,
      transportLogisticsCost: 215900,
      equipmentMachineryCost: 215900,
      preliminariesOverheadCost: 88400,
      contingencyBufferCost: 81400,
      baseCost: 2400765,
      marginPercent: 12.5,
      marginAmount: 300095,
      taxPercent: 18.0,
      taxAmount: 486155,
      totalBidAmount: 3187015,
      varianceAgainstTenderBudgetPercent: -34.3,
      winProbability: 82,
      strategyType: 'Balanced (Optimal)',
      totalManDays: 38600,
      workerCount: 121,
    };

  const goLogin = () => navigateTo('login');
  const goRegister = () => navigateTo('register');

  const emptyState = (
    <div className="p-8 rounded-3xl bg-white border border-stone-200 text-center">
      <p className="text-sm text-stone-600">Pick a tender first, then come back here.</p>
      <button onClick={() => setActiveTab('tenders')} className="mt-4 h-10 px-5 rounded-xl bg-[#4d6b2f] text-white text-sm font-bold">
        Find tenders
      </button>
    </div>
  );

  // Splash while Firebase restores the session (prevents a login-page flash).
  if (!authReady) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-stone-50">
        <div className="w-10 h-10 border-4 border-[#4d6b2f]/25 border-t-[#4d6b2f] rounded-full animate-spin" role="status" aria-label="Loading" />
      </div>
    );
  }

  // ---------- Public flow: landing -> register / login ----------
  if (!currentUser) {
    if (route === 'login' || route === 'register') {
      return (
        <>
          <AuthPage
            mode={route as AuthMode}
            onModeChange={(m) => navigateTo(m)}
            onBack={() => navigateTo('')}
            onSuccess={(user) => {
              setCurrentUser(user);
              navigateTo('app/dashboard');
            }}
          />
          <OfflineIndicator />
        </>
      );
    }
    return (
      <div className="min-h-[100dvh] bg-stone-50 text-stone-900">
        <PublicNav onSignIn={goLogin} onRegister={goRegister} />
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <LandingPage
            onGetStarted={goRegister}
            onSignIn={goLogin}
            onExploreWorkspace={goLogin}
            onOpenTender={goLogin}
            tenders={tenders}
            commodities={commodities}
          />
        </main>
        <OfflineIndicator />
      </div>
    );
  }

  // ---------- Private app ----------
  return (
    <>
      <AppShell
        activeTab={activeTab}
        onNavigate={setActiveTab}
        user={currentUser}
        unreadCount={notifications.filter((n) => !n.read).length}
        isRefreshing={isScraping}
        onRefresh={handleRefreshFeed}
        onOpenNotifications={() => setShowNotificationsModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenGoogleChat={() => setShowGoogleChatModal(true)}
        onLogout={async () => {
          await logout();
          setCurrentUser(null);
          setGoogleAccessToken(null);
          showToast('Signed out.');
          navigateTo('');
        }}
      >
        {activeTab === 'account' && (
          <UserAccount
            currentUser={currentUser}
            onLogout={async () => {
              await logout();
              setCurrentUser(null);
              setGoogleAccessToken(null);
              navigateTo('');
            }}
            onSelectTender={(tenderId) => {
              const t = tenders.find((item) => item.id === tenderId);
              if (t) {
                setSelectedTender(t);
                setActiveTab('costing');
              } else {
                setActiveTab('tenders');
              }
            }}
            tenders={tenders}
            showToast={showToast}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            user={currentUser}
            tenders={tenders}
            unreadCount={notifications.filter((n) => !n.read).length}
            onNavigate={setActiveTab}
            onOpenTender={(t) => {
              setSelectedTender(t);
              setActiveTab('feasibility');
            }}
          />
        )}

        {activeTab === 'tenders' && (
          <TenderList
            tenders={tenders}
            currency={currency}
            onSelectTenderForFeasibility={handleSelectForFeasibility}
            onSelectTenderForCosting={handleSelectForCosting}
            onSelectTenderForProposal={handleSelectForProposal}
            onAddNewTender={handleAddNewTender}
          />
        )}

        {activeTab === 'assistant' && <AssistantChat tender={selectedTender} />}

        {activeTab === 'sources' && <OfficialSources />}

        {activeTab === 'costing' &&
          (selectedTender ? (
            <CostEstimationEngine
              tender={selectedTender}
              currency={currency}
              commodities={commodities}
              companyProfile={companyProfile}
              onProceedToProposal={handleProceedToProposalFromCosting}
              onRefreshCommodities={fetchCommodities}
            />
          ) : emptyState)}

        {activeTab === 'feasibility' &&
          (selectedTender ? (
            <FeasibilityEngine
              tender={selectedTender}
              companyProfile={companyProfile}
              currency={currency}
              onProceedToCosting={handleSelectForCosting}
              onUpdateTenderFitScore={handleUpdateFitScore}
            />
          ) : emptyState)}

        {activeTab === 'pipeline' && (
          <PipelineTracker
            tenders={tenders}
            currency={currency}
            onUpdateTenderStatus={handleUpdateTenderStatus}
            onSelectTender={(t) => {
              setSelectedTender(t);
              setActiveTab('costing');
            }}
          />
        )}

        {activeTab === 'proposal' &&
          (selectedTender ? (
            <ProposalGenerator
              tender={selectedTender}
              calculation={currentCalc}
              boqItems={activeBOQItems}
              companyProfile={companyProfile}
              currency={currency}
              onAdvanceToSubmitted={() => {
                handleUpdateTenderStatus(selectedTender.id, 'Submitted');
                setActiveTab('pipeline');
              }}
            />
          ) : emptyState)}

        {activeTab === 'commodities' && (
          <CommodityTracker
            commodities={commodities}
            currency={currency}
            onRefresh={() => {
              fetchCommodities();
              showToast('Commodity index refreshed.');
            }}
          />
        )}
      </AppShell>

      {toastMessage && (
        <div
          role="status"
          className="fixed z-50 left-3 right-3 sm:left-auto sm:right-6 bottom-24 lg:bottom-6 px-4 py-3 rounded-2xl bg-stone-900 text-white text-sm font-semibold shadow-xl"
        >
          {toastMessage}
        </div>
      )}

      <OfflineIndicator />

      <CompanyProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={companyProfile}
        currency={currency}
        onSaveProfile={(updated) => {
          setCompanyProfile((prev) => ({ ...prev, ...updated }));
          showToast('Company profile updated.');
        }}
      />

      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          showToast('Marked all notifications as read.');
        }}
        onSelectTenderById={(id) => {
          const t = tenders.find((item) => item.id === id);
          if (t) {
            setSelectedTender(t);
            setActiveTab('costing');
          }
        }}
      />

      <GoogleChatModal
        isOpen={showGoogleChatModal}
        onClose={() => setShowGoogleChatModal(false)}
        currentUser={currentUser}
        accessToken={googleAccessToken}
        onAuthSuccess={(user, token) => {
          setCurrentUser(user);
          setGoogleAccessToken(token);
          showToast(`Connected to Google Chat as ${user.displayName || user.email}`);
        }}
        onAuthLogout={() => {
          setCurrentUser(null);
          setGoogleAccessToken(null);
          navigateTo('');
        }}
        activeTender={selectedTender}
      />
    </>
  );
}
