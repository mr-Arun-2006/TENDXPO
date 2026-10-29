export type SectorType =
  | 'Civil Construction'
  | 'Roads & Highways'
  | 'IT & Cloud'
  | 'Healthcare & MedTech'
  | 'Renewable Energy'
  | 'Logistics & Defense'
  | 'Unclassified';

export type CurrencyType = 'USD' | 'INR' | 'EUR';

export type TenderStatus =
  | 'Discovered'
  | 'Under Feasibility'
  | 'Estimation'
  | 'Proposal Drafted'
  | 'Submitted'
  | 'Technical Qualified'
  | 'Won'
  | 'Lost';

export type FeasibilityVerdict = 'Not analyzed' | 'High Viability' | 'Conditional Bid' | 'High Risk / No-Bid';

export interface EligibilityCriteria {
  minAnnualTurnover: number;
  minExperienceYears: number;
  similarProjectsCount: number;
  requiredCertifications: string[];
  minSolvencyCertificate: number;
}

export interface TenderAddendum {
  date: string;
  title: string;
  details: string;
}

export interface TenderDocument {
  name: string;
  size: string;
  type: string;
  url?: string;
}

export interface Tender {
  id: string;
  refNumber: string;
  title: string;
  authority: string;
  portal: string;
  sector: SectorType;
  budget: number;
  currency: CurrencyType;
  publishDate: string;
  submissionDeadline: string;
  location: string;
  state: string;
  country: string;
  emdAmount: number;
  performanceGuarantee: string;
  completionDurationDays: number;
  description: string;
  scopeOfWork: string;
  eligibilityCriteria: EligibilityCriteria;
  status: TenderStatus;
  companyFitScore: number;
  feasibilityVerdict: FeasibilityVerdict;
  competitorBidsCount: number;
  lastScraped: string;
  addendums: TenderAddendum[];
  documents: TenderDocument[];
  defaultBiddingTemplate: string;
  customNotes?: string;
  /** 'live-ted' = fetched from an official API; 'sample' = demo data; 'user' = entered manually */
  dataSource?: 'live-ted' | 'sample' | 'user';
  sourceUrl?: string;
}

export interface CompanyProfile {
  name: string;
  annualTurnover: number;
  availableSolvency: number;
  activeProjectsCount: number;
  maxProjectCapacity: number;
  currentCapacityUtilizationPercent: number;
  pastPerformanceRating: number;
  certifications: string[];
  skilledWorkforceCount: number;
  unskilledWorkforceCount: number;
  heavyMachineryCount: number;
  historicalWinRate: number;
  targetMarginPercent: number;
  currency: CurrencyType;
  profilePhoto?: string;
}

export interface CommodityPrice {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentPrice: number;
  currency: CurrencyType;
  change7d: number;
  change30d: number;
  trend: 'up' | 'down' | 'stable';
  history: number[];
  volatility: 'Low' | 'Medium' | 'High';
  notes: string;
}

export interface BOQItem {
  id: string;
  category: 'Materials' | 'Labor' | 'Equipment & Transport' | 'Subcontracting' | 'Overhead & Compliance';
  name: string;
  unit: string;
  quantity: number;
  unitRate: number;
  total: number;
  isFluctuating?: boolean;
  priceBufferPercent?: number;
  notes?: string;
}

export interface BidCalculation {
  directMaterialsCost: number;
  directLaborCost: number;
  transportLogisticsCost: number;
  equipmentMachineryCost: number;
  preliminariesOverheadCost: number;
  contingencyBufferCost: number;
  baseCost: number;
  marginPercent: number;
  marginAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalBidAmount: number;
  varianceAgainstTenderBudgetPercent: number;
  winProbability: number;
  strategyType: 'Aggressive (L1)' | 'Balanced (Optimal)' | 'Defensive (Premium)';
  totalManDays: number;
  workerCount: number;
  equipmentAndTransportCost?: number;
}

export interface FeasibilityResult {
  fitScore: number;
  verdict: FeasibilityVerdict;
  executiveSummary: string;
  strengths: string[];
  riskFactors: string[];
  strategicWinRecommendations: string[];
  bidNoBidChecklist: Array<{
    criteria: string;
    required: string;
    companyValue: string;
    passed: boolean;
  }>;
}

export interface ProposalDocument {
  executiveCoverLetter: string;
  costJustificationNarrative: string;
  executionScheduleNarrative: string;
  qualityAndSafetyPlan: string;
  competitiveEdgeStatement: string;
}

export interface PortalNotification {
  id: string;
  timestamp: string;
  type: 'New Tender' | 'Price Alert' | 'Deadline Warning' | 'Corrigendum' | 'Bid Won';
  title: string;
  message: string;
  tenderId?: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  read: boolean;
}

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te' | 'mr' | 'bn' | 'gu' | 'kn';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}


export interface UserSectorProfile {
  userId: string;
  targetSectors: SectorType[];
  minBudget: number; // in INR
  maxBudget: number; // in INR
  preferredStates: string[];
  emailAlertsEnabled: boolean;
  alertEmail: string;
  inAppAlertsEnabled: boolean;
  googleChatAlertsEnabled: boolean;
  minFitScoreThreshold: number; // e.g. 70
  updatedAt?: string;
}

export interface TenderAlert {
  id: string;
  alertId?: string;
  userId: string;
  tenderId: string;
  tenderTitle: string;
  portal: string;
  sector: string;
  budget: number;
  currency: string;
  fitScore: number;
  matchReason: string;
  deliveryChannels: string[];
  emailStatus: string;
  read: boolean;
  createdAt: string;
}

export interface UserAccountData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'bid_manager' | 'estimator' | 'admin' | 'viewer';
  companyName: string;
  contractorLicenseClass?: string;
  phone?: string;
  createdAt: string;
  sectorProfile?: UserSectorProfile;
}

// WebSocket Real-Time Official Portals Monitoring Types
export type OfficialPortal = 'CPPP' | 'GeM' | 'NHAI' | 'IREPS' | 'State PWD' | 'SECI';

export type PortalEventType =
  | 'tender_published'
  | 'corrigendum_issued'
  | 'price_tick'
  | 'bidding_status_update'
  | 'scraper_pulse'
  | 'pre_bid_meeting';

export interface PortalLiveEvent {
  id: string;
  portal: OfficialPortal;
  eventType: PortalEventType;
  title: string;
  refNumber?: string;
  tenderId?: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'alert';
  details: string;
  sector?: SectorType;
  budget?: number; // in INR
  url?: string;
  impactNote?: string;
  tenderData?: Tender;
}

export interface PortalMonitorHealth {
  portal: OfficialPortal;
  name: string;
  domain: string;
  status: 'online' | 'degraded' | 'syncing';
  tendersToday: number;
  lastPolled: string;
  responseTimeMs: number;
  totalActiveBids: number;
}

export interface PortalConnectionState {
  connected: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  latencyMs: number;
  lastPing: string | null;
  activePortals: PortalMonitorHealth[];
  connectedClientsCount: number;
  totalEventsReceived: number;
  lastEventTime?: string;
}

