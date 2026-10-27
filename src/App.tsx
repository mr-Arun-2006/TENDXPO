import React, { useState, useEffect } from 'react';
import { BidCalculation, BOQItem, CommodityPrice, CompanyProfile, CurrencyType, PortalNotification, Tender, TenderStatus } from './types';
import { DEFAULT_COMPANY_PROFILE, INITIAL_NOTIFICATIONS, SECTOR_BOQ_TEMPLATES } from './data/initialData';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
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
import { PortalWebSocketBar } from './components/PortalWebSocketBar';
import { PortalWebSocketModal } from './components/PortalWebSocketModal';
import { usePortalWebSocket } from './hooks/usePortalWebSocket';
import { User } from 'firebase/auth';
import { initAuth, logout, testFirestoreConnection } from './services/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('landing');
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
  const [showPortalRadarModal, setShowPortalRadarModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-Time Official Portals WebSocket Hook
  const { connectionState, liveEvents, triggerScan, toggleSound, isSoundOn } = usePortalWebSocket();

  // Firebase & Google Workspace Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
          return [latest.tenderData!, ...prev];
        });

        const notif: PortalNotification = {
          id: `notif-${latest.id}`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          type: 'New Tender',
          title: `🚨 [${latest.portal}] New Tender Published`,
          message: `${latest.title} (₹${((latest.budget || 0) / 10000000).toFixed(2)} Cr)`,
          tenderId: latest.tenderData.id,
          severity: 'success',
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);
        showToast(`⚡ [${latest.portal}] Official Tender: ${latest.title.slice(0, 38)}...`);
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

  // Fetch initial tenders
  const fetchTenders = async () => {
    try {
      const res = await fetch('/api/tenders');
      const data = await res.json();
      if (data.status === 'success' && data.tenders) {
        setTenders(data.tenders);
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

    // Test Firestore connection on boot (Firebase Integration Skill constraint)
    testFirestoreConnection();

    // Listen to Firebase Auth state
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        if (token) setGoogleAccessToken(token);
      },
      () => {
        // Fallback or unauthenticated state
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Trigger Live Portal Scrape
  const handleTriggerScrape = async () => {
    setIsScraping(true);
    showToast('Connecting to GeM, CPPP, SAM.gov & TED Europa portals...');
    try {
      const res = await fetch('/api/scrape-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.uid || 'default_user' }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        if (data.newTender) {
          setTenders((prev) => [data.newTender, ...prev]);
          // Add notification
          const newNotif: PortalNotification = {
            id: `notif-${Date.now()}`,
            timestamp: 'Just now',
            type: 'New Tender',
            title: `New Scraped Bid: ${data.newTender.title.slice(0, 40)}...`,
            message: `Official Portal: ${data.newTender.portal}. NIT Budget: ₹${data.newTender.budget.toLocaleString()}. Cloud function evaluated.`,
            tenderId: data.newTender.id,
            severity: 'info',
            read: false,
          };
          setNotifications((prev) => [newNotif, ...prev]);
        }
        showToast(data.message || 'Scraping complete. Fresh official bids indexed.');
      }
    } catch (err) {
      showToast('Offline mode: Local tenders maintained.');
    } finally {
      setIsScraping(false);
    }
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
      await fetch(`/api/tenders/${tenderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="min-h-full flex flex-col bg-stone-50 text-stone-900 font-sans selection:bg-[#4d6b2f] selection:text-white">
      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currency={currency}
        setCurrency={setCurrency}
        isScraping={isScraping}
        onTriggerScrape={handleTriggerScrape}
        notifications={notifications}
        onOpenNotifications={() => setShowNotificationsModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenGoogleChat={() => setShowGoogleChatModal(true)}
        isGoogleChatConnected={!!currentUser}
        companyName={companyProfile.name}
        activeBidsCount={tenders.length}
        profilePhoto={currentUser?.photoURL || companyProfile.profilePhoto}
        currentUser={currentUser}
        onOpenAuth={() => {
          setAuthMode('login');
          setShowAuthModal(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Landing Page View */}
        {activeTab === 'landing' && (
          <LandingPage
            onGetStarted={() => {
              setAuthMode('register');
              setShowAuthModal(true);
            }}
            onSignIn={() => {
              setAuthMode('login');
              setShowAuthModal(true);
            }}
            onExploreWorkspace={() => setActiveTab('tenders')}
            onOpenTender={(t) => {
              setSelectedTender(t);
              setActiveTab('costing');
            }}
            tenders={tenders}
            commodities={commodities}
          />
        )}

        {/* User Account / Sector Alerts View */}
        {activeTab === 'account' && (
          <UserAccount
            currentUser={currentUser}
            onLogout={async () => {
              await logout();
              setCurrentUser(null);
              setGoogleAccessToken(null);
              showToast('Signed out of TenDo account.');
              setActiveTab('landing');
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

        {/* Official Portals View */}
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

        {/* BOQ Cost Estimation Engine */}
        {activeTab === 'costing' && selectedTender && (
          <CostEstimationEngine
            tender={selectedTender}
            currency={currency}
            commodities={commodities}
            companyProfile={companyProfile}
            onProceedToProposal={handleProceedToProposalFromCosting}
            onRefreshCommodities={fetchCommodities}
          />
        )}

        {/* Bid Feasibility Matrix */}
        {activeTab === 'feasibility' && selectedTender && (
          <FeasibilityEngine
            tender={selectedTender}
            companyProfile={companyProfile}
            currency={currency}
            onProceedToCosting={handleSelectForCosting}
            onUpdateTenderFitScore={handleUpdateFitScore}
          />
        )}

        {/* Pipeline Tracker */}
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

        {/* Proposal Explainer & PDF Generator */}
        {activeTab === 'proposal' && selectedTender && (
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
        )}

        {/* Commodity Volatility Tracker */}
        {activeTab === 'commodities' && (
          <CommodityTracker
            commodities={commodities}
            currency={currency}
            onRefresh={() => {
              fetchCommodities();
              showToast('Commodity index refreshed with spot rates.');
            }}
          />
        )}
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-white border border-[#4d6b2f]/40 text-xs font-bold text-stone-900 shadow-xl backdrop-blur-md animate-fade-in flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4d6b2f] animate-ping"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PWA Offline Banner */}
      <OfflineIndicator />

      {/* Authentication Modal (Register & Login) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
        onAuthSuccess={(user, token) => {
          setCurrentUser(user);
          if (token) setGoogleAccessToken(token);
          showToast(`Welcome ${user.displayName || user.email}!`);
          setActiveTab('account');
        }}
      />

      {/* Profile Modal */}
      <CompanyProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={companyProfile}
        currency={currency}
        onSaveProfile={(updated) => {
          setCompanyProfile((prev) => ({ ...prev, ...updated }));
          showToast('Updated company operational capacity.');
        }}
      />

      {/* Notifications Drawer Modal */}
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

      {/* Google Chat Collaboration Modal */}
      <GoogleChatModal
        isOpen={showGoogleChatModal}
        onClose={() => setShowGoogleChatModal(false)}
        currentUser={currentUser}
        accessToken={googleAccessToken}
        onAuthSuccess={(user, token) => {
          setCurrentUser(user);
          setGoogleAccessToken(token);
          showToast(`Connected to Google as ${user.displayName || user.email}`);
        }}
        onAuthLogout={() => {
          setCurrentUser(null);
          setGoogleAccessToken(null);
          showToast('Signed out of Google Workspace.');
        }}
        activeTender={selectedTender}
      />
    </div>
  );
}
