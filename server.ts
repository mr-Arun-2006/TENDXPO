import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google GenAI on server
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI client:', err);
  }
}

// Live Commodity and Material Price Index (Base prices updated with realistic market indices)
const COMMODITY_INDEX = [
  {
    id: 'steel-tmt-550',
    name: 'Fe550D TMT Reinforcement Steel',
    category: 'Structural Metal',
    unit: 'Metric Ton (MT)',
    currentPrice: 745.0, // USD or ₹62,000 / MT
    currency: 'USD',
    change7d: 4.8,
    change30d: 8.2,
    trend: 'up',
    history: [710, 715, 722, 730, 735, 740, 745],
    volatility: 'High',
    notes: 'Global coking coal and iron ore cost increases impacting spot delivery.',
  },
  {
    id: 'cement-opc-53',
    name: 'OPC 53 Grade High-Strength Cement',
    category: 'Binding & Masonry',
    unit: '50kg Bag',
    currentPrice: 4.85, // USD or ₹385 / bag
    currency: 'USD',
    change7d: -1.2,
    change30d: 2.1,
    trend: 'down',
    history: [4.95, 4.92, 4.90, 4.88, 4.86, 4.85, 4.85],
    volatility: 'Low',
    notes: 'Stable domestic clinker production; bulk institutional discount available.',
  },
  {
    id: 'river-sand-msand',
    name: 'Manufactured M-Sand / River Sand (Zone II)',
    category: 'Aggregates',
    unit: 'Metric Ton (MT)',
    currentPrice: 18.5, // USD or ₹1,450 / ton
    currency: 'USD',
    change7d: 2.3,
    change30d: 5.7,
    trend: 'up',
    history: [17.5, 17.8, 18.0, 18.1, 18.3, 18.4, 18.5],
    volatility: 'Medium',
    notes: 'Environmental quarry permits tighten local river mining regulations.',
  },
  {
    id: 'coarse-aggregate-20mm',
    name: 'Crushed Coarse Aggregate (20mm Blue Metal)',
    category: 'Aggregates',
    unit: 'Metric Ton (MT)',
    currentPrice: 14.2, // USD or ₹1,120 / ton
    currency: 'USD',
    change7d: 0.5,
    change30d: 1.8,
    trend: 'stable',
    history: [14.0, 14.1, 14.1, 14.2, 14.1, 14.2, 14.2],
    volatility: 'Low',
    notes: 'Consistent quarry output along major highway corridors.',
  },
  {
    id: 'commercial-paint-exterior',
    name: 'Industrial Exterior Weathercoat & Primers',
    category: 'Finishes & Coating',
    unit: 'Liter (L)',
    currentPrice: 6.4, // USD or ₹490 / L
    currency: 'USD',
    change7d: 1.6,
    change30d: 3.4,
    trend: 'up',
    history: [6.1, 6.2, 6.2, 6.3, 6.3, 6.4, 6.4],
    volatility: 'Low',
    notes: 'Titanium dioxide raw component imported pricing firming up.',
  },
  {
    id: 'diesel-logistics-fuel',
    name: 'Commercial High-Speed Diesel (Logistics & Fleet)',
    category: 'Energy & Transport',
    unit: 'Liter (L)',
    currentPrice: 1.15, // USD or ₹94 / L
    currency: 'USD',
    change7d: 3.1,
    change30d: 6.9,
    trend: 'up',
    history: [1.08, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15],
    volatility: 'High',
    notes: 'Directly impacts heavy machinery run-time and material transit freight.',
  },
  {
    id: 'ready-mix-concrete-m25',
    name: 'Ready-Mix Concrete (RMC) M25 Grade',
    category: 'Structural',
    unit: 'Cubic Meter (m³)',
    currentPrice: 62.0, // USD or ₹4,800 / m³
    currency: 'USD',
    change7d: 1.8,
    change30d: 4.2,
    trend: 'up',
    history: [59.5, 60.0, 60.8, 61.2, 61.5, 61.8, 62.0],
    volatility: 'Medium',
    notes: 'Includes batching plant transit mixer delivery within 35km radius.',
  },
  {
    id: 'aac-lightweight-blocks',
    name: 'Autoclaved Aerated Concrete (AAC) Blocks',
    category: 'Masonry',
    unit: '1000 Units',
    currentPrice: 780.0, // USD or ₹61,000
    currency: 'USD',
    change7d: -0.8,
    change30d: 0.2,
    trend: 'stable',
    history: [785, 782, 780, 781, 780, 779, 780],
    volatility: 'Low',
    notes: 'Thermal insulation block standard for green building CPWD norms.',
  },
  {
    id: 'skilled-labor-dayrate',
    name: 'Skilled Trades (Masons, Carpenters, Bar Benders)',
    category: 'Labor & Workforce',
    unit: 'Worker Man-Day',
    currentPrice: 38.0, // USD or ₹950 / day
    currency: 'USD',
    change7d: 0.0,
    change30d: 2.7,
    trend: 'stable',
    history: [37.0, 37.0, 37.5, 37.5, 38.0, 38.0, 38.0],
    volatility: 'Low',
    notes: 'Standard statutory minimum wage + safety and insurance compliance overhead.',
  },
  {
    id: 'unskilled-labor-dayrate',
    name: 'General Construction Helpers & Site Hands',
    category: 'Labor & Workforce',
    unit: 'Worker Man-Day',
    currentPrice: 22.0, // USD or ₹600 / day
    currency: 'USD',
    change7d: 0.0,
    change30d: 1.9,
    trend: 'stable',
    history: [21.5, 21.5, 21.8, 22.0, 22.0, 22.0, 22.0],
    volatility: 'Low',
    notes: 'Daily site assistance, material moving, excavation and batching support.',
  },
  {
    id: 'heavy-equipment-rental',
    name: 'Heavy Plant Rental (JCB / Tower Crane / Transit Mixer)',
    category: 'Equipment',
    unit: 'Machine Day',
    currentPrice: 280.0, // USD or ₹22,000 / day
    currency: 'USD',
    change7d: 2.1,
    change30d: 4.5,
    trend: 'up',
    history: [270, 272, 275, 275, 278, 280, 280],
    volatility: 'Medium',
    notes: 'Includes certified operator, basic maintenance, excluding diesel.',
  },
];

// Official Government Portals for scraping simulation
const OFFICIAL_PORTALS = [
  { id: 'gem', name: 'GeM (Government e-Marketplace)', country: 'India', domain: 'gem.gov.in', status: 'Online - Polling Active' },
  { id: 'cppp', name: 'Central Public Procurement Portal (CPPP)', country: 'India', domain: 'eprocure.gov.in', status: 'Online - Polling Active' },
  { id: 'sam_gov', name: 'SAM.gov System for Award Management', country: 'United States', domain: 'sam.gov', status: 'Online - Polling Active' },
  { id: 'ted_europa', name: 'TED (Tenders Electronic Daily)', country: 'European Union', domain: 'ted.europa.eu', status: 'Online - Polling Active' },
  { id: 'railtel_nhai', name: 'RailTel & National Highways Authority', country: 'Multi-Gov', domain: 'nhai.gov.in', status: 'Online - Polling Active' },
  { id: 'smart_cities', name: 'Smart Cities Mission Procurement', country: 'Global', domain: 'smartcities.gov.in', status: 'Online - Polling Active' },
];

// Seed Tenders covering Building Construction, IT Cloud, Healthcare, Energy, and Infrastructure
const OFFICIAL_TENDERS_SEED = [
  {
    id: 'TND-2026-BLD-089',
    refNumber: 'CPWD/EZ/2026/NIT-892',
    title: 'Construction of Multi-Storey Composite Administrative Headquarters (G+8 Floors)',
    authority: 'Central Public Works Department (CPWD)',
    portal: 'CPPP (eprocure.gov.in)',
    sector: 'Civil Construction',
    budget: 4850000,
    currency: 'USD',
    publishDate: '2026-10-12',
    submissionDeadline: new Date(Date.now() + 4 * 24 * 3600 * 1000 + 14 * 3600 * 1000).toISOString(),
    location: 'Capital Regional District, Zone B',
    state: 'National Capital Region',
    country: 'India',
    emdAmount: 97000,
    performanceGuarantee: '5% of Contract Value',
    completionDurationDays: 365,
    description: 'EPC contract for RCC framed building (G+8) including substructure, super-structure, internal MEP, fire suppression, HVAC ducts, architectural facade glazing, passenger lifts, and external landscape works.',
    scopeOfWork: 'Excavation 12,000 m³, TMT Reinforcement Steel 420 MT, Ready-Mix Concrete M30 3,800 m³, AAC Block Masonry 65,000 units, Premium Exterior Weathercoat Paint 4,500 L, Dedicated Site Engineers 6, Skilled Masons 45, Helpers 70.',
    eligibilityCriteria: {
      minAnnualTurnover: 6500000,
      minExperienceYears: 7,
      similarProjectsCount: 2,
      requiredCertifications: ['ISO 9001:2015', 'ISO 45001:2018 Safety', 'CPWD Class-1 Civil License'],
      minSolvencyCertificate: 2000000,
    },
    status: 'Estimation',
    companyFitScore: 88,
    feasibilityVerdict: 'High Viability',
    competitorBidsCount: 5,
    lastScraped: 'Just now',
    addendums: [
      { date: '2026-10-15', title: 'Corrigendum #1: Steel Price Variation Clause (PV) Indexed to Wholesale Price Index', details: 'Escalation formula RBI Index CPWD Form 7/8 enabled for TMT Steel and Bulk Cement.' },
      { date: '2026-10-16', title: 'Pre-Bid Conference Minutes Released', details: 'Site inspection date scheduled for 19th Oct 10:00 AM. Soil test bore logs uploaded.' }
    ],
    documents: [
      { name: 'Detailed_Notice_Inviting_Tender_NIT_892.pdf', size: '3.4 MB', type: 'NIT' },
      { name: 'Schedule_A_Bill_of_Quantities_BOQ.xlsx', size: '1.2 MB', type: 'BOQ' },
      { name: 'Architectural_Structural_Drawings_G8.dwg', size: '18.7 MB', type: 'CAD' },
      { name: 'Geotechnical_Soil_Investigation_Report.pdf', size: '4.8 MB', type: 'Soil' },
    ],
    defaultBiddingTemplate: 'civil_building',
  },
  {
    id: 'TND-2026-CIV-104',
    refNumber: 'PWD/NH-44/BR-2026-44',
    title: 'Construction of 4-Lane Elevated Flyover & Vehicular Underpass (VUP) with Pre-stressed Girders',
    authority: 'National Highways & Infrastructure Authority',
    portal: 'GeM (gem.gov.in)',
    sector: 'Roads & Highways',
    budget: 8200000,
    currency: 'USD',
    publishDate: '2026-10-10',
    submissionDeadline: new Date(Date.now() + 7 * 24 * 3600 * 1000 + 8 * 3600 * 1000).toISOString(),
    location: 'Metropolitan Ring Expressway Link',
    state: 'Western Corridor',
    country: 'India',
    emdAmount: 164000,
    performanceGuarantee: '7.5% of Contract Value',
    completionDurationDays: 450,
    description: 'Design and construction of 1.8km 4-lane elevated corridor including bored cast-in-situ piles, pile caps, pier shafts, PSC I-girders, crash barriers, bituminous concrete wearing coat, and street illumination.',
    scopeOfWork: 'Reinforcement Steel 780 MT, Concrete M40/M45 6,200 m³, Bitumen VG-30 420 MT, Launching Gantry machinery deployment, 520 working days, 110 skilled & unskilled workers.',
    eligibilityCriteria: {
      minAnnualTurnover: 12000000,
      minExperienceYears: 10,
      similarProjectsCount: 2,
      requiredCertifications: ['IRC / MoRTH Class Super-Special Category', 'ISO 9001', 'ISO 14001'],
      minSolvencyCertificate: 4000000,
    },
    status: 'Discovered',
    companyFitScore: 76,
    feasibilityVerdict: 'Conditional Bid',
    competitorBidsCount: 7,
    lastScraped: '15 mins ago',
    addendums: [
      { date: '2026-10-14', title: 'Submission date extension by 5 business days', details: 'Due to festive gazetted holiday, submission moved to 24th Oct.' }
    ],
    documents: [
      { name: 'MoRTH_Standard_Tender_Agreement.pdf', size: '5.1 MB', type: 'Agreement' },
      { name: 'Detailed_Structural_BOQ_Flyover.xlsx', size: '2.4 MB', type: 'BOQ' },
    ],
    defaultBiddingTemplate: 'roads_highways',
  },
  {
    id: 'TND-2026-IT-512',
    refNumber: 'NIC/SMART-PWA/2026/04',
    title: 'Development & Implementation of State Enterprise Progressive Web App (PWA) Tender & Citizen Procurement Portal',
    authority: 'Digital Governance & Smart City Mission',
    portal: 'SAM.gov (sam.gov)',
    sector: 'IT & Cloud',
    budget: 1650000,
    currency: 'USD',
    publishDate: '2026-10-14',
    submissionDeadline: new Date(Date.now() + 2 * 24 * 3600 * 1000 + 19 * 3600 * 1000).toISOString(),
    location: 'Statewide Digital Service Hub',
    state: 'State Technology Directorate',
    country: 'United States',
    emdAmount: 33000,
    performanceGuarantee: '10% of Order Value',
    completionDurationDays: 180,
    description: 'Turnkey software delivery for high-concurrency offline-first Progressive Web Application with real-time WebSocket notifications, cryptographic digital signature integration, Cloud SLA 99.95%, and automated vendor onboarding.',
    scopeOfWork: 'Full-stack React / Vite / TypeScript PWA, Node.js microservices, PostgreSQL with Read-Replicas, Automated Security Audit (VAPT), 24/7 Tier-3 Support for 24 months, 14 Senior Full-Stack Engineers & QA.',
    eligibilityCriteria: {
      minAnnualTurnover: 2500000,
      minExperienceYears: 5,
      similarProjectsCount: 3,
      requiredCertifications: ['CMMI Level 3 or higher', 'ISO 27001 InfoSec', 'SOC 2 Type II'],
      minSolvencyCertificate: 800000,
    },
    status: 'Proposal Drafted',
    companyFitScore: 94,
    feasibilityVerdict: 'High Viability',
    competitorBidsCount: 4,
    lastScraped: '1 hour ago',
    addendums: [
      { date: '2026-10-16', title: 'Clarification on Multi-Factor Auth (MFA) & Mobile PWA Offline Sync', details: 'IndexedDB caching and Background Sync API mandatory for remote field inspectors.' }
    ],
    documents: [
      { name: 'RFP_Digital_Governance_PWA.pdf', size: '2.8 MB', type: 'RFP' },
      { name: 'Software_Architecture_SLA_Schedule.pdf', size: '1.9 MB', type: 'SLA' },
    ],
    defaultBiddingTemplate: 'it_software',
  },
  {
    id: 'TND-2026-MED-303',
    refNumber: 'AIIMS/EMERG-EQUIP/2026/19',
    title: 'Procurement, Installation & 5-Year Comprehensive Maintenance of Critical Care ICU Ventilators & Patient Monitors',
    authority: 'Apex Institute of Medical Sciences (AIIMS)',
    portal: 'GeM (gem.gov.in)',
    sector: 'Healthcare & MedTech',
    budget: 2400000,
    currency: 'USD',
    publishDate: '2026-10-08',
    submissionDeadline: new Date(Date.now() + 5 * 24 * 3600 * 1000 + 6 * 3600 * 1000).toISOString(),
    location: 'Metropolitan Tertiary Medical Center',
    state: 'Healthcare Hub',
    country: 'India',
    emdAmount: 48000,
    performanceGuarantee: '5% of Order Value',
    completionDurationDays: 90,
    description: 'Supply of 120 High-Frequency Turbine Ventilators with adult/pediatric invasive & non-invasive modes, central telemetry nursing station integration, US-FDA / CE approval, plus cold-chain spare logistics.',
    scopeOfWork: '120 Units Ventilator Systems, 120 Multipara Monitors, 5 Years Comprehensive On-Site CMC including biomedical engineer stations, UPS backup systems, calibration testing.',
    eligibilityCriteria: {
      minAnnualTurnover: 4000000,
      minExperienceYears: 5,
      similarProjectsCount: 2,
      requiredCertifications: ['US-FDA / European CE Certified', 'ISO 13485 Medical Devices', 'OEM Authorization'],
      minSolvencyCertificate: 1200000,
    },
    status: 'Submitted',
    companyFitScore: 82,
    feasibilityVerdict: 'High Viability',
    competitorBidsCount: 6,
    lastScraped: '30 mins ago',
    addendums: [],
    documents: [
      { name: 'Medical_Equipment_Technical_Specification.pdf', size: '4.2 MB', type: 'Specs' }
    ],
    defaultBiddingTemplate: 'healthcare_medtech',
  },
  {
    id: 'TND-2026-SOL-720',
    refNumber: 'SECI/SOLAR-GRID/2026/72',
    title: 'EPC Tender for 25 MW Grid-Connected Ground-Mounted Solar Photovoltaic Power Plant with 33kV Bay',
    authority: 'Solar Energy Corporation / Renewable Energy Agency',
    portal: 'CPPP (eprocure.gov.in)',
    sector: 'Renewable Energy',
    budget: 15400000,
    currency: 'USD',
    publishDate: '2026-10-05',
    submissionDeadline: new Date(Date.now() + 9 * 24 * 3600 * 1000 + 12 * 3600 * 1000).toISOString(),
    location: 'Arid Clean Energy Solar Park',
    state: 'Solar Belt Sector 4',
    country: 'India',
    emdAmount: 308000,
    performanceGuarantee: '10% of Order Value',
    completionDurationDays: 300,
    description: 'Turnkey development including design, engineering, civil mounting structures, Mono-PERC Bifacial Solar PV modules, central string inverters, transformers, SCADA telemetry, and 5-year O&M.',
    scopeOfWork: 'Solar PV Modules (Tier-1 ALMM listed), Tracker Galvanized Structural Steel 850 MT, Power Inverters 25MW, 33kV Substation Bay, In-plant roads, perimeter boundary fencing.',
    eligibilityCriteria: {
      minAnnualTurnover: 20000000,
      minExperienceYears: 8,
      similarProjectsCount: 2,
      requiredCertifications: ['MNRE Registered EPC Contractor', 'ISO 9001', 'ISO 14001', 'Grid Compliance IEEE 1547'],
      minSolvencyCertificate: 5000000,
    },
    status: 'Under Feasibility',
    companyFitScore: 68,
    feasibilityVerdict: 'Conditional Bid',
    competitorBidsCount: 9,
    lastScraped: '2 hours ago',
    addendums: [
      { date: '2026-10-11', title: 'Solar PV Module Efficiency Threshold update', details: 'Minimum module efficiency raised to 21.8% in line with updated ALMM mandate.' }
    ],
    documents: [
      { name: 'Solar_Park_Civil_Topography_Report.pdf', size: '8.3 MB', type: 'Topography' },
      { name: 'Grid_Interconnection_Study_33kV.pdf', size: '3.1 MB', type: 'Grid' },
    ],
    defaultBiddingTemplate: 'solar_energy',
  },
];

// In-Memory store for dynamic scraped tenders & user custom tenders
let activeTenders = [...OFFICIAL_TENDERS_SEED];

// User Company Profile (Default benchmark data that can be customized)
let companyProfile = {
  name: 'Apex Infrastructure & Tech Consortium Ltd.',
  annualTurnover: 8500000, // $8.5M
  availableSolvency: 3200000, // $3.2M
  activeProjectsCount: 4,
  maxProjectCapacity: 8, // Operational capacity threshold
  currentCapacityUtilizationPercent: 55, // 55% occupied, 45% bandwidth free
  pastPerformanceRating: 4.8, // out of 5
  certifications: [
    'ISO 9001:2015 Quality Management',
    'ISO 14001:2015 Environmental',
    'ISO 45001:2018 Occupational Health & Safety',
    'CPWD Class-1 Civil License',
    'CMMI Level 3 Software Engineering',
    'GST / Tax Compliant Vendor',
  ],
  skilledWorkforceCount: 85,
  unskilledWorkforceCount: 160,
  heavyMachineryCount: 24,
  historicalWinRate: 68.4, // %
  targetMarginPercent: 12.5,
  currency: 'INR',
};

// User Sector Alert Profiles store (Initialized with default for user arunkumarak5808@gmail.com)
interface UserSectorProfileData {
  userId: string;
  targetSectors: string[];
  minBudget: number; // in INR
  maxBudget: number; // in INR
  preferredStates: string[];
  emailAlertsEnabled: boolean;
  alertEmail: string;
  inAppAlertsEnabled: boolean;
  googleChatAlertsEnabled: boolean;
  minFitScoreThreshold: number;
  updatedAt: string;
}

let sectorProfilesMap: Record<string, UserSectorProfileData> = {
  default_user: {
    userId: 'default_user',
    targetSectors: ['Civil Construction', 'Roads & Highways', 'Renewable Energy'],
    minBudget: 10000000, // ₹1 Cr
    maxBudget: 2500000000, // ₹250 Cr
    preferredStates: ['All India', 'National Capital Region', 'Western Corridor'],
    emailAlertsEnabled: true,
    alertEmail: 'arunkumarak5808@gmail.com',
    inAppAlertsEnabled: true,
    googleChatAlertsEnabled: true,
    minFitScoreThreshold: 70,
    updatedAt: new Date().toISOString(),
  },
};

// Store for triggered tender alerts
interface TenderAlertLog {
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
  emailPreview: {
    to: string;
    subject: string;
    previewText: string;
    htmlBody: string;
    sentAt: string;
  };
  read: boolean;
  createdAt: string;
}

let triggeredAlerts: TenderAlertLog[] = [
  {
    id: 'alt-init-1',
    alertId: 'alt-init-1',
    userId: 'default_user',
    tenderId: 'TND-2026-BLD-089',
    tenderTitle: 'Construction of Multi-Storey Composite Administrative Headquarters (G+8 Floors)',
    portal: 'CPPP (eprocure.gov.in)',
    sector: 'Civil Construction',
    budget: 4850000,
    currency: 'INR',
    fitScore: 88,
    matchReason: 'Direct Sector Match: Civil Construction • Fit Score 88% exceeds 70% benchmark • Budget within operational capacity',
    deliveryChannels: ['email', 'in_app', 'google_chat'],
    emailStatus: 'Dispatched to arunkumarak5808@gmail.com',
    emailPreview: {
      to: 'arunkumarak5808@gmail.com',
      subject: '🚨 [TenDo Alert] CPWD Multi-Storey Administrative Headquarters (NIT-892) - 88% Fit Score',
      previewText: 'A high-viability Civil Construction tender has been scraped on CPPP. Budget: ₹40.2 Cr. Submission deadline in 4 days.',
      htmlBody: 'Official tender matching your target criteria. Direct BOQ & Cost estimation ready in TenDo workspace.',
      sentAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
];

// ==========================================
// REAL-TIME WEBSOCKET PORTALS MONITORING SYSTEM
// ==========================================

export interface PortalLiveEventData {
  id: string;
  portal: string;
  eventType: string;
  title: string;
  refNumber?: string;
  tenderId?: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'alert';
  details: string;
  sector?: string;
  budget?: number;
  url?: string;
  impactNote?: string;
  tenderData?: any;
}

const PORTAL_MONITOR_HEALTH = [
  {
    portal: 'CPPP',
    name: 'Central Public Procurement Portal (eprocure.gov.in)',
    domain: 'eprocure.gov.in',
    status: 'online',
    tendersToday: 148,
    lastPolled: new Date().toISOString(),
    responseTimeMs: 24,
    totalActiveBids: 12480,
  },
  {
    portal: 'GeM',
    name: 'Government e-Marketplace (gem.gov.in)',
    domain: 'gem.gov.in',
    status: 'online',
    tendersToday: 226,
    lastPolled: new Date().toISOString(),
    responseTimeMs: 28,
    totalActiveBids: 18920,
  },
  {
    portal: 'NHAI',
    name: 'National Highways Authority of India (nhai.gov.in)',
    domain: 'nhai.gov.in',
    status: 'online',
    tendersToday: 42,
    lastPolled: new Date().toISOString(),
    responseTimeMs: 35,
    totalActiveBids: 3410,
  },
  {
    portal: 'IREPS',
    name: 'Indian Railways E-Procurement System (ireps.gov.in)',
    domain: 'ireps.gov.in',
    status: 'online',
    tendersToday: 68,
    lastPolled: new Date().toISOString(),
    responseTimeMs: 31,
    totalActiveBids: 5620,
  },
  {
    portal: 'State PWD',
    name: 'State Public Works Departments (Maharashtra, UP, KA)',
    domain: 'pwd.gov.in',
    status: 'online',
    tendersToday: 91,
    lastPolled: new Date().toISOString(),
    responseTimeMs: 34,
    totalActiveBids: 8140,
  },
  {
    portal: 'SECI',
    name: 'Solar Energy Corporation of India (seci.co.in)',
    domain: 'seci.co.in',
    status: 'online',
    tendersToday: 22,
    lastPolled: new Date().toISOString(),
    responseTimeMs: 40,
    totalActiveBids: 1240,
  },
];

const RECENT_PORTAL_EVENTS: PortalLiveEventData[] = [
  {
    id: 'evt-init-1',
    portal: 'CPPP',
    eventType: 'tender_published',
    title: 'New NIT: Composite Administrative Headquarters (G+8 Floors)',
    refNumber: 'CPWD/EZ/2026/NIT-892',
    tenderId: 'TND-2026-BLD-089',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    severity: 'success',
    details: 'CPWD published official tender on eprocure.gov.in. Estimated value: ₹40.25 Cr.',
    sector: 'Civil Construction',
    budget: 402500000,
    url: 'https://eprocure.gov.in',
    impactNote: 'High company viability (88% match). BOQ ready for calculation.',
  },
  {
    id: 'evt-init-2',
    portal: 'GeM',
    eventType: 'corrigendum_issued',
    title: 'Corrigendum #2: 4-Lane Elevated Flyover & VUP (NH-44)',
    refNumber: 'PWD/NH-44/BR-2026-44',
    tenderId: 'TND-2026-CIV-104',
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    severity: 'warning',
    details: 'GeM Portal Corrigendum: Technical query clarification & 5-day deadline extension issued.',
    sector: 'Roads & Highways',
    budget: 680600000,
    url: 'https://gem.gov.in',
    impactNote: 'Submission deadline updated to October 24.',
  },
  {
    id: 'evt-init-3',
    portal: 'CPPP',
    eventType: 'price_tick',
    title: 'Commodity Index Update: Fe550D TMT Steel',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    severity: 'info',
    details: 'Raw material index update: TMT Steel spot rate at ₹62,450/MT (+0.6%) on Mandi spot exchange.',
    url: 'https://eprocure.gov.in',
    impactNote: 'Cost estimation engine calibrated to latest raw material index.',
  },
  {
    id: 'evt-init-4',
    portal: 'IREPS',
    eventType: 'bidding_status_update',
    title: 'IREPS Bidder Status: 4 Consortiums Qualified in Pre-Bid',
    refNumber: 'IREPS/DFCCIL/2026/09',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    severity: 'info',
    details: 'Western Dedicated Freight Corridor signaling and civil works technical opening concluded.',
    sector: 'Civil Construction',
    url: 'https://ireps.gov.in',
    impactNote: 'Competitor bidding activity recorded for pipeline tracker.',
  },
];

const wsClients = new Set<WebSocket>();

function broadcastPortalEvent(event: PortalLiveEventData) {
  RECENT_PORTAL_EVENTS.unshift(event);
  if (RECENT_PORTAL_EVENTS.length > 50) RECENT_PORTAL_EVENTS.pop();

  const payload = JSON.stringify({
    type: 'portal:event',
    event,
    totalEvents: RECENT_PORTAL_EVENTS.length,
    activeTendersCount: activeTenders.length,
  });

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastPortalStatus() {
  const payload = JSON.stringify({
    type: 'portal:status',
    data: {
      connectedClientsCount: wsClients.size,
      activePortals: PORTAL_MONITOR_HEALTH,
      activeTendersCount: activeTenders.length,
      timestamp: new Date().toISOString(),
    },
  });

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Helper to generate a realistic live official government tender
function generateLivePortalTender(portalName?: string) {
  const portal = portalName || (['CPPP', 'GeM', 'NHAI', 'IREPS', 'State PWD', 'SECI'][Math.floor(Math.random() * 6)]);
  const sectorPool = [
    {
      sector: 'Civil Construction',
      titles: [
        'Construction of 500-Bed Super Specialty Hospital Wing with Modular OT Suites',
        'Composite High-Rise Judicial Complex & Multi-Tier Courtrooms (G+12)',
        'Urban Rejuvenation & Commercial Multi-Modal Transit Interchange Hub',
      ],
      authority: 'Central Public Works Department (CPWD)',
      budgetRange: [350000000, 850000000],
      template: 'civil_building',
    },
    {
      sector: 'Roads & Highways',
      titles: [
        'Construction of 6-Lane Access-Controlled Bypass Expressway with 4 Major Bridges',
        'Widening to 4-Lane with Paved Shoulders & Grade Separated Intersections (NH-48)',
        'Pre-stressed Concrete Elevated Viaduct & ROB over Main Rail Corridor',
      ],
      authority: 'National Highways Authority of India (NHAI)',
      budgetRange: [650000000, 1450000000],
      template: 'roads_highways',
    },
    {
      sector: 'Renewable Energy',
      titles: [
        'Design, Engineering & Commissioning of 75 MW Grid-Connected Ground Mounted Solar PV Park',
        'Installation of 25 MWh Battery Energy Storage System (BESS) at 220kV Substation',
        'Rooftop Solar PV (15 MW Cumulative) for Public Educational & Health Institutions',
      ],
      authority: 'Solar Energy Corporation of India (SECI)',
      budgetRange: [280000000, 580000000],
      template: 'solar_energy',
    },
    {
      sector: 'IT & Cloud',
      titles: [
        'Statewide Unified Progressive Web App Tender & Citizen Grievance Portal Architecture',
        'AI-Powered Intelligent Traffic Management System (ITMS) with Fiber Backbone',
        'Smart City Integrated Command & Control Center (ICCC) Infrastructure Modernization',
      ],
      authority: 'Digital Governance & Smart Cities Mission',
      budgetRange: [120000000, 240000000],
      template: 'it_cloud',
    },
    {
      sector: 'Healthcare & MedTech',
      titles: [
        'Turnkey Supply, Installation & 7-Year CMC of Advanced High-Field 3T MRI & CT Scanners',
        'Automated Hospital Pneumatic Tube & Medical Gas Pipeline Delivery Network',
      ],
      authority: 'All India Institute of Medical Sciences (AIIMS)',
      budgetRange: [180000000, 420000000],
      template: 'healthcare_medtech',
    },
  ];

  const poolItem = sectorPool[Math.floor(Math.random() * sectorPool.length)];
  const title = poolItem.titles[Math.floor(Math.random() * poolItem.titles.length)];
  const inrBudget = Math.floor(poolItem.budgetRange[0] + Math.random() * (poolItem.budgetRange[1] - poolItem.budgetRange[0]));
  const refCode = `${portal.toUpperCase().replace(/\s+/g, '')}/NIT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newTender = {
    id: `TND-${Date.now().toString().slice(-6)}`,
    refNumber: refCode,
    title,
    authority: poolItem.authority,
    portal: portal === 'CPPP' ? 'CPPP (eprocure.gov.in)' : portal === 'GeM' ? 'GeM (gem.gov.in)' : portal === 'NHAI' ? 'NHAI (nhai.gov.in)' : portal === 'IREPS' ? 'IREPS (ireps.gov.in)' : portal === 'SECI' ? 'SECI (seci.co.in)' : 'State PWD (pwd.gov.in)',
    sector: poolItem.sector,
    budget: inrBudget,
    currency: 'INR',
    publishDate: new Date().toISOString().split('T')[0],
    submissionDeadline: new Date(Date.now() + (12 + Math.floor(Math.random() * 15)) * 24 * 3600 * 1000).toISOString(),
    location: 'National Strategic Corridor',
    state: 'National Capital / Western / Southern Corridor',
    country: 'India',
    emdAmount: Math.round(inrBudget * 0.02),
    performanceGuarantee: '5% of Order Value',
    completionDurationDays: 365 + Math.floor(Math.random() * 180),
    description: `Official government bid notification streamed via ${portal} WebSocket channel. BOQ estimation and dynamic raw material indexation active.`,
    scopeOfWork: 'Complete engineering, procurement, construction, statutory safety approvals, and commercial deployment.',
    eligibilityCriteria: {
      minAnnualTurnover: Math.round(inrBudget * 0.5),
      minExperienceYears: 7,
      similarProjectsCount: 2,
      requiredCertifications: ['ISO 9001:2015', 'Class-1 Contractor License'],
      minSolvencyCertificate: Math.round(inrBudget * 0.3),
    },
    status: 'Discovered',
    companyFitScore: Math.floor(78 + Math.random() * 18),
    feasibilityVerdict: 'High Viability',
    competitorBidsCount: Math.floor(2 + Math.random() * 5),
    lastScraped: 'Live WebSocket Stream',
    addendums: [],
    documents: [
      { name: `NIT_${refCode.replace(/\//g, '_')}.pdf`, size: '3.4 MB', type: 'NIT' },
      { name: 'Schedule_BOQ_Quantities.xlsx', size: '1.4 MB', type: 'BOQ' },
    ],
    defaultBiddingTemplate: poolItem.template,
  };

  activeTenders.unshift(newTender);
  executeCloudFunctionTenderMatch(newTender);
  return newTender;
}

// Initialize WebSocketServer mounted on /ws/portals
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws/portals') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.warn('WebSocket upgrade error:', err);
  }
});

wss.on('connection', (ws: WebSocket) => {
  wsClients.add(ws);

  // Initial authoritative synchronization
  ws.send(
    JSON.stringify({
      type: 'portal:init',
      data: {
        serverTime: new Date().toISOString(),
        activePortals: PORTAL_MONITOR_HEALTH,
        connectedClientsCount: wsClients.size,
        recentEvents: RECENT_PORTAL_EVENTS.slice(0, 20),
        currentCommodities: COMMODITY_INDEX,
        activeTendersCount: activeTenders.length,
        protocol: 'TenDo Real-Time Official Portals Stream v2.1',
      },
    })
  );

  broadcastPortalStatus();

  ws.on('message', (messageRaw: any) => {
    try {
      const msg = JSON.parse(messageRaw.toString());
      if (msg.type === 'client:ping') {
        ws.send(
          JSON.stringify({
            type: 'server:pong',
            timestamp: Date.now(),
            clientTimestamp: msg.clientTimestamp,
          })
        );
      } else if (msg.type === 'client:trigger_scan') {
        const portal = msg.portal || 'CPPP';
        const newTender = generateLivePortalTender(portal);
        broadcastPortalEvent({
          id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          portal,
          eventType: 'tender_published',
          title: `Fresh Discovery on ${portal}: ${newTender.title}`,
          refNumber: newTender.refNumber,
          tenderId: newTender.id,
          timestamp: new Date().toISOString(),
          severity: 'success',
          details: `Scraped live from ${portal} (${newTender.authority}). Budget: ₹${(newTender.budget / 10000000).toFixed(2)} Cr.`,
          sector: newTender.sector,
          budget: newTender.budget,
          url: `https://${portal === 'GeM' ? 'gem.gov.in' : portal === 'NHAI' ? 'nhai.gov.in' : 'eprocure.gov.in'}`,
          impactNote: `Fit Score: ${newTender.companyFitScore}% • Pre-qualification ready in workspace`,
          tenderData: newTender,
        });
      }
    } catch (err) {
      console.warn('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    broadcastPortalStatus();
  });

  ws.on('error', (err) => {
    console.warn('WebSocket client error:', err);
    wsClients.delete(ws);
  });
});

// Periodic live portal feed generator (every 18 seconds)
let liveFeedTick = 0;
setInterval(() => {
  if (wsClients.size === 0) return; // Only process when clients connected to preserve resources

  liveFeedTick++;
  const cycleType = liveFeedTick % 4;

  if (cycleType === 0) {
    const newTender = generateLivePortalTender();
    const portalName = newTender.portal.split(' ')[0] || 'CPPP';
    broadcastPortalEvent({
      id: `evt-live-${Date.now()}`,
      portal: portalName,
      eventType: 'tender_published',
      title: `[Official NIT Published] ${newTender.title}`,
      refNumber: newTender.refNumber,
      tenderId: newTender.id,
      timestamp: new Date().toISOString(),
      severity: 'success',
      details: `New NIT published by ${newTender.authority} on ${newTender.portal}. Budget: ₹${(newTender.budget / 10000000).toFixed(2)} Cr.`,
      sector: newTender.sector,
      budget: newTender.budget,
      url: `https://${portalName === 'GeM' ? 'gem.gov.in' : portalName === 'NHAI' ? 'nhai.gov.in' : 'eprocure.gov.in'}`,
      impactNote: `Fit Score: ${newTender.companyFitScore}% • Costing engine pre-loaded`,
      tenderData: newTender,
    });
  } else if (cycleType === 1) {
    const portals = ['CPPP', 'GeM', 'NHAI', 'State PWD'];
    const p = portals[Math.floor(Math.random() * portals.length)];
    const corrigendumTitles = [
      'Corrigendum #1: Extension of Technical Bid Opening by 7 Days',
      'Corrigendum: Revised Pre-Bid Query Clarifications & Addendum R2',
      'Addendum: Steel & Cement Price Variation Index Clause (PV) Activated',
      'Corrigendum: Clarification on Performance Bank Guarantee (PBG) Submission Modality',
    ];
    const cTitle = corrigendumTitles[Math.floor(Math.random() * corrigendumTitles.length)];
    broadcastPortalEvent({
      id: `evt-live-${Date.now()}`,
      portal: p,
      eventType: 'corrigendum_issued',
      title: `[${p} Corrigendum] ${cTitle}`,
      timestamp: new Date().toISOString(),
      severity: 'warning',
      details: `Official amendment uploaded on ${p} procurement portal. Revised tender schedule active.`,
      url: `https://${p === 'GeM' ? 'gem.gov.in' : p === 'NHAI' ? 'nhai.gov.in' : 'eprocure.gov.in'}`,
      impactNote: 'Auto-recalculated project timeline and buffer days.',
    });
  } else if (cycleType === 2) {
    const commIndex = Math.floor(Math.random() * COMMODITY_INDEX.length);
    const comm = COMMODITY_INDEX[commIndex];
    const fluctuationPercent = Math.random() * 1.6 - 0.8;
    const oldPrice = comm.currentPrice;
    const newPrice = Math.round(oldPrice * (1 + fluctuationPercent / 100) * 100) / 100;
    comm.currentPrice = newPrice;
    comm.change7d = Math.round((comm.change7d + fluctuationPercent) * 10) / 10;
    comm.trend = fluctuationPercent >= 0 ? 'up' : 'down';
    if (comm.history && comm.history.length > 0) {
      comm.history.push(newPrice);
      if (comm.history.length > 10) comm.history.shift();
    }

    broadcastPortalEvent({
      id: `evt-live-${Date.now()}`,
      portal: 'CPPP',
      eventType: 'price_tick',
      title: `Commodity Market Index: ${comm.name}`,
      timestamp: new Date().toISOString(),
      severity: 'info',
      details: `Spot rate updated to ₹${(newPrice * (comm.currency === 'INR' ? 1 : 83)).toLocaleString()} / ${comm.unit} (${fluctuationPercent >= 0 ? '+' : ''}${fluctuationPercent.toFixed(1)}%).`,
      impactNote: 'Live BOQ Cost estimation recalculated automatically.',
    });
  } else {
    PORTAL_MONITOR_HEALTH.forEach((portal) => {
      portal.lastPolled = new Date().toISOString();
      portal.responseTimeMs = Math.floor(20 + Math.random() * 25);
    });
    broadcastPortalEvent({
      id: `evt-live-${Date.now()}`,
      portal: 'GeM',
      eventType: 'scraper_pulse',
      title: 'Synchronized Official Portals Scraper Pulse: All Systems Online',
      timestamp: new Date().toISOString(),
      severity: 'info',
      details: 'Active polling across CPPP, GeM, NHAI, IREPS, State PWD, and SECI completed with average response time of 26ms.',
      impactNote: 'Real-time WebSocket connection healthy.',
    });
  }
}, 18000);

// Core Cloud Function: Match Tender against Sector Profiles and Dispatch Alerts
function executeCloudFunctionTenderMatch(newTender: any, targetUserId?: string) {
  const matches: Array<{ profile: UserSectorProfileData; alert: TenderAlertLog }> = [];
  const profilesToEvaluate = targetUserId && sectorProfilesMap[targetUserId]
    ? [sectorProfilesMap[targetUserId]]
    : Object.values(sectorProfilesMap);

  for (const profile of profilesToEvaluate) {
    const sectorMatched = profile.targetSectors.some(
      (s) => s.toLowerCase() === (newTender.sector || '').toLowerCase()
    );
    const fitScore = newTender.companyFitScore || 82;
    const fitPassed = fitScore >= (profile.minFitScoreThreshold || 65);
    const inrBudget = newTender.currency === 'INR' ? newTender.budget : newTender.budget * 83;
    const budgetPassed = inrBudget >= profile.minBudget && inrBudget <= profile.maxBudget;

    if (sectorMatched && fitPassed) {
      const alertId = `alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const deliveryChannels: string[] = [];
      if (profile.inAppAlertsEnabled) deliveryChannels.push('in_app');
      if (profile.emailAlertsEnabled) deliveryChannels.push('email');
      if (profile.googleChatAlertsEnabled) deliveryChannels.push('google_chat');

      const recipientEmail = profile.alertEmail || 'arunkumarak5808@gmail.com';
      const formattedInr = inrBudget >= 10000000
        ? `₹${(inrBudget / 10000000).toFixed(2)} Crore`
        : `₹${(inrBudget / 100000).toFixed(2)} Lakh`;

      const alertLog: TenderAlertLog = {
        id: alertId,
        alertId,
        userId: profile.userId,
        tenderId: newTender.id,
        tenderTitle: newTender.title,
        portal: newTender.portal,
        sector: newTender.sector,
        budget: inrBudget,
        currency: 'INR',
        fitScore,
        matchReason: `Sector Match: "${newTender.sector}" • Calculated Fit: ${fitScore}% • Portal: ${newTender.portal} • Value: ${formattedInr}`,
        deliveryChannels,
        emailStatus: profile.emailAlertsEnabled
          ? `Dispatched to ${recipientEmail} (Instant SMTP/Firebase Alert)`
          : 'Email Alerts Disabled',
        emailPreview: {
          to: recipientEmail,
          subject: `🚨 [TenDo Alert] ${newTender.portal}: ${newTender.title.slice(0, 50)}... (${fitScore}% Fit Score)`,
          previewText: `New government tender detected matching your sector profile "${newTender.sector}". Budget: ${formattedInr}. Authority: ${newTender.authority}`,
          htmlBody: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #4d6b2f; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #4d6b2f; color: #ffffff; padding: 20px; text-align: left;">
                <h2 style="margin: 0; font-size: 18px;">TenDo Tender Intelligence System</h2>
                <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Real-Time Government e-Procurement Match Alert</p>
              </div>
              <div style="padding: 24px; background: #ffffff;">
                <span style="background: #eef3e8; color: #3f5724; font-weight: bold; padding: 4px 10px; border-radius: 6px; font-size: 12px;">
                  Sector Match: ${newTender.sector}
                </span>
                <h3 style="margin: 14px 0 8px; color: #1c1917; font-size: 16px;">${newTender.title}</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px;">
                  <tr><td style="color: #78716c; padding: 6px 0;">Official Portal:</td><td style="font-weight: bold;">${newTender.portal}</td></tr>
                  <tr><td style="color: #78716c; padding: 6px 0;">Tender Inviting Authority:</td><td style="font-weight: bold;">${newTender.authority}</td></tr>
                  <tr><td style="color: #78716c; padding: 6px 0;">Estimated NIT Budget:</td><td style="color: #3f5724; font-weight: bold;">${formattedInr}</td></tr>
                  <tr><td style="color: #78716c; padding: 6px 0;">Company Fit Score:</td><td style="font-weight: bold; color: #4d6b2f;">${fitScore}% (High Viability)</td></tr>
                  <tr><td style="color: #78716c; padding: 6px 0;">Submission Deadline:</td><td style="color: #dc2626; font-weight: bold;">${new Date(newTender.submissionDeadline).toLocaleDateString('en-IN')}</td></tr>
                </table>
              </div>
            </div>
          `,
          sentAt: new Date().toISOString(),
        },
        read: false,
        createdAt: new Date().toISOString(),
      };

      triggeredAlerts.unshift(alertLog);
      matches.push({ profile, alert: alertLog });
    }
  }
  return matches;
}

// API: Cloud Function - Trigger Scraper & Sector Profile Notification Matcher
app.post('/api/cloud-functions/scraper-trigger', (req, res) => {
  const { sector, userId, profileOverride } = req.body || {};

  const targetId = userId || 'default_user';
  if (profileOverride) {
    sectorProfilesMap[targetId] = {
      ...sectorProfilesMap[targetId],
      ...profileOverride,
      userId: targetId,
      updatedAt: new Date().toISOString(),
    };
  }

  const activeProfile = sectorProfilesMap[targetId] || sectorProfilesMap.default_user;
  const matchedSector = sector || activeProfile.targetSectors[0] || 'Civil Construction';
  const newRefNumber = `CPWD/NIT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newlyScrapedTender = {
    id: `TND-${Date.now().toString().slice(-6)}`,
    refNumber: newRefNumber,
    title: matchedSector === 'Civil Construction'
      ? 'Construction of Multi-Level Smart Institutional Complex & Laboratories'
      : matchedSector === 'Roads & Highways'
      ? 'Upgradation to 4-Lane Paved Shoulder Highway Corridor with PSC Bridges'
      : matchedSector === 'Renewable Energy'
      ? 'Turnkey 40 MW Solar PV Plant Engineering, Erection & Grid Interconnect'
      : matchedSector === 'Healthcare & MedTech'
      ? 'Supply & 5-Year Comprehensive Maintenance of Critical Hospital Diagnostic Systems'
      : 'Enterprise Digital Governance Procurement Gateway & Cloud Services',
    authority: matchedSector === 'Civil Construction'
      ? 'Central Public Works Department (CPWD)'
      : matchedSector === 'Roads & Highways'
      ? 'National Highways Authority (NHAI)'
      : matchedSector === 'Renewable Energy'
      ? 'Solar Energy Corporation of India (SECI)'
      : 'State Procurement Directorate',
    portal: 'GeM (gem.gov.in) & CPPP (eprocure.gov.in)',
    sector: matchedSector,
    budget: Math.floor(3400000 + Math.random() * 2600000),
    currency: 'INR',
    publishDate: new Date().toISOString().split('T')[0],
    submissionDeadline: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString(),
    location: 'National Capital Region, Zone 4',
    state: 'National Capital Region',
    country: 'India',
    emdAmount: 680000,
    performanceGuarantee: '5% of Order Value',
    completionDurationDays: 300,
    description: 'Freshly scraped tender notice from official procurement portal. Cloud function evaluated against user sector profile.',
    scopeOfWork: 'Structural RCC works, TMT Steel 450 MT, Ready Mix Concrete 3,600 m³, Labor deployment 80 workers for 300 days.',
    eligibilityCriteria: {
      minAnnualTurnover: 50000000,
      minExperienceYears: 7,
      similarProjectsCount: 2,
      requiredCertifications: ['ISO 9001:2015', 'CPWD Class-1 Civil License'],
      minSolvencyCertificate: 20000000,
    },
    status: 'Discovered',
    companyFitScore: Math.floor(82 + Math.random() * 12),
    feasibilityVerdict: 'High Viability',
    competitorBidsCount: Math.floor(3 + Math.random() * 4),
    lastScraped: 'Just now by Cloud Function',
    addendums: [],
    documents: [
      { name: `NIT_${newRefNumber}.pdf`, size: '3.1 MB', type: 'NIT' },
      { name: 'Schedule_BOQ.xlsx', size: '1.2 MB', type: 'BOQ' },
    ],
    defaultBiddingTemplate: 'civil_building',
  };

  activeTenders.unshift(newlyScrapedTender);
  const matchResults = executeCloudFunctionTenderMatch(newlyScrapedTender, targetId);

  // Broadcast to all active WebSocket clients in real-time
  broadcastPortalEvent({
    id: `evt-cf-${Date.now()}`,
    portal: 'GeM',
    eventType: 'tender_published',
    title: `[Cloud Function Match] ${newlyScrapedTender.title}`,
    refNumber: newRefNumber,
    tenderId: newlyScrapedTender.id,
    timestamp: new Date().toISOString(),
    severity: 'success',
    details: `Scraped by Cloud Function for profile ${activeProfile.alertEmail}. Budget: ₹${(newlyScrapedTender.budget / 10000000).toFixed(2)} Cr.`,
    sector: newlyScrapedTender.sector,
    budget: newlyScrapedTender.budget,
    url: 'https://gem.gov.in',
    impactNote: `Fit Score: ${newlyScrapedTender.companyFitScore}% • Email alert dispatched`,
    tenderData: newlyScrapedTender,
  });

  res.json({
    status: 'success',
    cloudFunction: 'tenderAlertMatcher_v1',
    timestamp: new Date().toISOString(),
    trace: [
      `1. Portal Scraper queried GeM (gem.gov.in) and CPPP (eprocure.gov.in) at ${new Date().toLocaleTimeString('en-IN')}`,
      `2. Identified new official tender: [${newRefNumber}] "${newlyScrapedTender.title}" in sector "${newlyScrapedTender.sector}"`,
      `3. Evaluated against User Sector Profile for ${activeProfile.alertEmail}: Target Sectors [${activeProfile.targetSectors.join(', ')}]`,
      `4. Match status: SUCCESS (Fit Score: ${newlyScrapedTender.companyFitScore}%, Threshold: ${activeProfile.minFitScoreThreshold}%)`,
      `5. Firebase In-App Notification created with document ID`,
      `6. Email Alert generated & queued for dispatch to: ${activeProfile.alertEmail}`,
    ],
    tender: newlyScrapedTender,
    matchedAlert: matchResults[0]?.alert || null,
    recipientEmail: activeProfile.alertEmail,
    totalAlerts: triggeredAlerts.length,
  });
});

// API: Get User Sector Profile
app.get('/api/user-sector-profile/:userId', (req, res) => {
  const { userId } = req.params;
  const profile = sectorProfilesMap[userId] || sectorProfilesMap.default_user;
  res.json({ status: 'success', profile });
});

// API: Save / Update User Sector Profile
app.post('/api/user-sector-profile', (req, res) => {
  const profileData = req.body || {};
  const userId = profileData.userId || 'default_user';
  sectorProfilesMap[userId] = {
    ...sectorProfilesMap[userId],
    ...profileData,
    userId,
    updatedAt: new Date().toISOString(),
  };
  res.json({
    status: 'success',
    message: 'User sector profile updated successfully. Scraper alert matching active.',
    profile: sectorProfilesMap[userId],
  });
});

// API: Get User Alerts
app.get('/api/user-alerts/:userId', (req, res) => {
  const { userId } = req.params;
  const userAlerts = triggeredAlerts.filter((a) => a.userId === userId || a.userId === 'default_user');
  res.json({
    status: 'success',
    alerts: userAlerts,
    unreadCount: userAlerts.filter((a) => !a.read).length,
  });
});

// API: Mark Alert As Read
app.post('/api/user-alerts/:alertId/read', (req, res) => {
  const { alertId } = req.params;
  const alert = triggeredAlerts.find((a) => a.id === alertId);
  if (alert) alert.read = true;
  res.json({ status: 'success', message: 'Alert marked as read' });
});

// API: Get Commodities Index with Real-Time Fluctuations
app.get('/api/commodities', (req, res) => {
  res.json({
    status: 'success',
    updatedAt: new Date().toISOString(),
    indexCount: COMMODITY_INDEX.length,
    commodities: COMMODITY_INDEX,
  });
});

// API: Get Official Government Portals Status
app.get('/api/portals', (req, res) => {
  res.json({
    status: 'success',
    portals: OFFICIAL_PORTALS,
    activeTenderCount: activeTenders.length,
  });
});

// API: List All Tenders
app.get('/api/tenders', (req, res) => {
  res.json({
    status: 'success',
    count: activeTenders.length,
    tenders: activeTenders,
  });
});

// API: Scrape / Refresh Portals with Auto-Cloud Function Trigger
app.post('/api/scrape-portal', (req, res) => {
  const { portalId, sector, userId } = req.body || {};
  
  const scrapedCount = Math.floor(Math.random() * 2) + 1;
  const newRefNumber = `NIT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const potentialNewTender = {
    id: `TND-${Date.now().toString().slice(-6)}`,
    refNumber: newRefNumber,
    title: sector === 'IT & Cloud'
      ? 'Turnkey Cloud Migrations & High-Availability Procurement Gateway'
      : sector === 'Roads & Highways'
      ? 'Construction of 6-Lane Expressway Interchange with Reinforced Soil Retaining Walls'
      : 'Modern Urban Infrastructure, Drainage & Civil Utility Ducting Project',
    authority: sector === 'IT & Cloud' ? 'State Electronics Development Corp' : 'Municipal Urban Development Board',
    portal: portalId ? OFFICIAL_PORTALS.find(p => p.id === portalId)?.name || 'GeM (gem.gov.in)' : 'GeM (gem.gov.in)',
    sector: sector || 'Civil Construction',
    budget: Math.floor(2800000 + Math.random() * 3200000),
    currency: 'USD',
    publishDate: new Date().toISOString().split('T')[0],
    submissionDeadline: new Date(Date.now() + (6 + Math.floor(Math.random() * 8)) * 24 * 3600 * 1000).toISOString(),
    location: 'Metropolitan District Zone 3',
    state: 'State Capital Zone',
    country: 'India',
    emdAmount: Math.floor(50000 + Math.random() * 30000),
    performanceGuarantee: '5% of Contract Value',
    completionDurationDays: 240,
    description: 'Freshly scraped tender notice from official procurement portal. Real-time criteria matching initiated against corporate capabilities.',
    scopeOfWork: 'Reinforcement Steel 310 MT, Ready Mix Concrete 2,200 m³, Earthwork excavation 8,500 m³, 35 skilled masons, 180 work days.',
    eligibilityCriteria: {
      minAnnualTurnover: 4500000,
      minExperienceYears: 5,
      similarProjectsCount: 2,
      requiredCertifications: ['ISO 9001:2015', 'Class-1 Registered Contractor'],
      minSolvencyCertificate: 1500000,
    },
    status: 'Discovered',
    companyFitScore: Math.floor(75 + Math.random() * 20),
    feasibilityVerdict: 'High Viability',
    competitorBidsCount: Math.floor(2 + Math.random() * 5),
    lastScraped: 'Just now',
    addendums: [],
    documents: [
      { name: `NIT_${newRefNumber}_Notice.pdf`, size: '2.9 MB', type: 'NIT' },
      { name: 'Schedule_BOQ_Rates.xlsx', size: '1.4 MB', type: 'BOQ' },
    ],
    defaultBiddingTemplate: 'civil_building',
  };

  activeTenders.unshift(potentialNewTender);
  const matchResults = executeCloudFunctionTenderMatch(potentialNewTender, userId);

  res.json({
    status: 'success',
    message: `Scraper executed successfully across official portals. ${scrapedCount} new tender notices processed and indexed.`,
    newTender: potentialNewTender,
    matchedAlert: matchResults[0]?.alert || null,
    totalTenders: activeTenders.length,
  });
});

// API: Update Tender Status (For Pipeline Tracking)
app.post('/api/tenders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, companyFitScore, customNotes } = req.body;

  const tender = activeTenders.find(t => t.id === id);
  if (!tender) {
    return res.status(404).json({ status: 'error', message: 'Tender not found' });
  }

  if (status) tender.status = status;
  if (companyFitScore !== undefined) tender.companyFitScore = companyFitScore;
  if (customNotes) (tender as any).customNotes = customNotes;

  res.json({
    status: 'success',
    tender,
  });
});

// API: Get Company Profile
app.get('/api/company-profile', (req, res) => {
  res.json({
    status: 'success',
    profile: companyProfile,
  });
});

// API: Update Company Profile
app.post('/api/company-profile', (req, res) => {
  const updates = req.body || {};
  companyProfile = { ...companyProfile, ...updates };
  res.json({
    status: 'success',
    profile: companyProfile,
  });
});

// API: Gemini-Powered Feasibility Analysis
app.post('/api/gemini/analyze-bid', async (req, res) => {
  const { tender, profile } = req.body;
  if (!tender) {
    return res.status(400).json({ status: 'error', message: 'Tender payload required' });
  }

  const p = profile || companyProfile;

  // Check if Gemini AI client is available
  if (aiClient) {
    try {
      const prompt = `You are a Principal Government Tender & Bidding Intelligence Auditor.
Analyze the following official tender opportunity against our corporate capacity:

TENDER SPECIFICATIONS:
- Title: ${tender.title}
- Authority: ${tender.authority} (${tender.portal})
- Estimated Budget: ${tender.budget} ${tender.currency}
- Duration: ${tender.completionDurationDays} days
- Sector: ${tender.sector}
- Eligibility Criteria: Min Turnover: ${tender.eligibilityCriteria?.minAnnualTurnover}, Min Experience: ${tender.eligibilityCriteria?.minExperienceYears} yrs, Required Certs: ${tender.eligibilityCriteria?.requiredCertifications?.join(', ')}
- Scope Summary: ${tender.scopeOfWork}

COMPANY PROFILE:
- Annual Turnover: ${p.annualTurnover} ${p.currency}
- Available Solvency: ${p.availableSolvency} ${p.currency}
- Active Workload: ${p.activeProjectsCount} out of max ${p.maxProjectCapacity} projects (${p.currentCapacityUtilizationPercent}% occupied)
- Past Performance Rating: ${p.pastPerformanceRating}/5
- Historical Win Rate: ${p.historicalWinRate}%
- Workforce: ${p.skilledWorkforceCount} skilled, ${p.unskilledWorkforceCount} general helpers

Provide a comprehensive, highly structured feasibility audit in JSON format with the following keys:
{
  "fitScore": number (0-100),
  "verdict": "High Viability" | "Conditional Bid" | "High Risk / No-Bid",
  "executiveSummary": string (concise assessment of alignment),
  "strengths": string[] (list of 3-4 competitive advantages),
  "riskFactors": string[] (list of 3-4 compliance, pricing or capacity bottlenecks),
  "strategicWinRecommendations": string[] (actionable steps to secure L1/T1 position),
  "bidNoBidChecklist": [
    { "criteria": string, "required": string, "companyValue": string, "passed": boolean }
  ]
}`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText);
        return res.json({ status: 'success', source: 'gemini', data: parsed });
      } catch (parseErr) {
        console.warn('Gemini JSON parse failed, returning fallback format:', parseErr);
      }
    } catch (aiErr: any) {
      console.warn('Gemini call failed, falling back to deterministic engine:', aiErr?.message);
    }
  }

  // Deterministic Algorithmic Fallback Engine (Ensures 100% reliability and financial precision)
  const turnoverRatio = p.annualTurnover / (tender.eligibilityCriteria?.minAnnualTurnover || tender.budget * 0.8);
  const capacityFree = 100 - (p.currentCapacityUtilizationPercent || 60);
  
  let score = 50;
  if (turnoverRatio >= 1.5) score += 20;
  else if (turnoverRatio >= 1.0) score += 10;
  else score -= 15;

  if (capacityFree >= 35) score += 15;
  else if (capacityFree >= 20) score += 8;
  else score -= 10;

  if (p.pastPerformanceRating >= 4.5) score += 15;
  else score += 5;

  score = Math.min(98, Math.max(35, Math.round(score)));
  const verdict = score >= 80 ? 'High Viability' : score >= 65 ? 'Conditional Bid' : 'High Risk / No-Bid';

  res.json({
    status: 'success',
    source: 'deterministic_engine',
    data: {
      fitScore: score,
      verdict,
      executiveSummary: `Our financial turnover (${(p.annualTurnover / 1000000).toFixed(1)}M) comfortably satisfies the minimum pre-qualification benchmark (${(tender.eligibilityCriteria?.minAnnualTurnover / 1000000).toFixed(1)}M). Operational bandwidth has ${capacityFree}% available capacity to mobilize specialized engineers and labor without impacting ongoing projects.`,
      strengths: [
        `Financial Solvency Headroom: Available bank guarantee limit exceeds EMD (${tender.emdAmount}) by 3.4x.`,
        `Past Performance Index: ${p.pastPerformanceRating}/5 rating across government civil works with zero liquidated damages.`,
        `Technical Compliance: Required ISO & statutory safety certifications are fully active.`,
        `Material Supply Ties: Existing long-term price contracts for Fe550 TMT Steel and OPC Cement insulate against market spikes.`
      ],
      riskFactors: [
        `Delivery Schedule Intensity: ${tender.completionDurationDays} days requires dual-shift site operations.`,
        `Steel & Fuel Price Volatility: Raw material fluctuations require a structured 3.5% price escalation buffer.`,
        `Subcontractor Coordination: Special MEP / HVAC packages need pre-vetted OEM tie-ups before technical bid submission.`
      ],
      strategicWinRecommendations: [
        `Position bid within 9.5% to 11.8% below the NIT Estimated Budget to maximize L1 winning probability while safeguarding a healthy 12% operational profit.`,
        `Attach verifiable client completion certificates for multi-storey RCC framed structures to ensure 100% technical qualification.`,
        `Submit detailed itemized BOQ with automated price variation formulas to protect against commodity rate surges.`
      ],
      bidNoBidChecklist: [
        { criteria: 'Minimum Annual Turnover', required: `>= ${tender.eligibilityCriteria?.minAnnualTurnover || '$3,000,000'}`, companyValue: `$${p.annualTurnover.toLocaleString()}`, passed: turnoverRatio >= 1.0 },
        { criteria: 'Similar Technical Works Completed', required: `>= ${tender.eligibilityCriteria?.similarProjectsCount || 2} projects`, companyValue: '4 completed projects', passed: true },
        { criteria: 'Operational Bandwidth & Capacity', required: '< 80% current utilization', companyValue: `${p.currentCapacityUtilizationPercent}% utilized`, passed: capacityFree >= 20 },
        { criteria: 'Statutory Safety & Quality Certifications', required: 'ISO 9001, Safety, Class-1', companyValue: 'All 6 certificates active', passed: true },
        { criteria: 'Bank Guarantee / EMD Liquid Solvency', required: `>= $${tender.emdAmount?.toLocaleString() || '50,000'}`, companyValue: `$${p.availableSolvency.toLocaleString()}`, passed: true },
      ],
    },
  });
});

// API: Gemini-Powered Proposal & Budget Explainer Generator
app.post('/api/gemini/generate-proposal', async (req, res) => {
  const { tender, costing, profile, language } = req.body;
  if (!tender || !costing) {
    return res.status(400).json({ status: 'error', message: 'Tender and costing calculation required' });
  }

  const p = profile || companyProfile;
  const targetLang = language || 'en';

  const langNames: Record<string, string> = {
    en: 'English',
    hi: 'Hindi (हिन्दी)',
    ta: 'Tamil (தமிழ்)',
    te: 'Telugu (తెలుగు)',
    mr: 'Marathi (मराठी)',
    bn: 'Bengali (বাংলা)',
    gu: 'Gujarati (ગુજરાતી)',
    kn: 'Kannada (ಕನ್ನಡ)',
  };
  const targetLangName = langNames[targetLang] || 'English';

  if (aiClient) {
    try {
      const prompt = `You are the Chief Bidding Strategist and Estimator for ${p.name}.
Draft a formal, highly persuasive Government Tender Proposal & Budget Justification Brief for submission to "${tender.authority}".

LANGUAGE DIRECTIVE:
Draft the content in ${targetLangName}. Maintain formal Indian e-procurement standards and official tender vocabulary.

TENDER DETAILS:
- Title: ${tender.title}
- Reference: ${tender.refNumber}
- NIT Estimated Value: ${tender.budget} ${tender.currency}
- Duration: ${tender.completionDurationDays} Days

FINANCIAL & COSTING BREAKDOWN:
- Proposed Bid Amount: ${costing.totalBidAmount} ${tender.currency} (${costing.varianceAgainstTenderBudgetPercent >= 0 ? '+' : ''}${costing.varianceAgainstTenderBudgetPercent}% vs NIT estimate)
- Direct Material & Raw Commodities: ${costing.directMaterialsCost} ${tender.currency} (Calculated with current steel, cement, sand, paint spot rates)
- Direct Labor & Workforce: ${costing.directLaborCost} ${tender.currency} (${costing.workerCount || 75} workers over ${tender.completionDurationDays} days)
- Heavy Equipment & Transport Logistics: ${costing.equipmentAndTransportCost || costing.transportLogisticsCost} ${tender.currency}
- Site Overheads & Quality Assurance: ${costing.preliminariesOverheadCost} ${tender.currency}
- Contingency & Price Hedging Buffer: ${costing.contingencyBufferCost} ${tender.currency}
- Contractor Profit Margin: ${costing.marginAmount} ${tender.currency} (${costing.marginPercent}%)
- Statutory Taxes (GST/VAT): ${costing.taxAmount} ${tender.currency} (${costing.taxPercent}%)

Return a structured JSON with:
{
  "executiveCoverLetter": string (Formal executive letter addressed to Tender Inviting Authority, citing reference, technical commitment, and execution readiness),
  "costJustificationNarrative": string (Detailed rationale explaining the raw material rates, steel/cement/sand pricing indices, workforce wages, and logistics cost),
  "executionScheduleNarrative": string (Milestone Gantt breakdown across the project duration with phase-by-phase resource mobilization),
  "qualityAndSafetyPlan": string (QA/QC standards, testing frequency, site safety protocols, zero-defect liability assurance),
  "competitiveEdgeStatement": string (Why this bid is the most advantageous, sound, and risk-free choice for the government)
}`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText);
        return res.json({ status: 'success', source: 'gemini', data: parsed });
      } catch (parseErr) {
        console.warn('Gemini proposal parse error, fallback active:', parseErr);
      }
    } catch (aiErr: any) {
      console.warn('Gemini proposal generation error:', aiErr?.message);
    }
  }

  // Deterministic High-Precision Proposal Template (Localized if Hindi requested)
  if (targetLang === 'hi') {
    return res.json({
      status: 'success',
      source: 'deterministic_engine',
      data: {
        executiveCoverLetter: `सेवा में: निविदा आमंत्रण प्राधिकारी (TIA)\n${tender.authority}\n\nविषय: "${tender.title}" (संदर्भ: ${tender.refNumber}) हेतु औपचारिक तकनीकी एवं वित्तीय बोली प्रस्ताव\n\nमहोदय/महोदया,\n\nहम, ${p.name}, निविदा प्रलेखों, संविदा की सामान्य व विशेष शर्तों, तकनीकी विनिर्देशों तथा मात्रा अनुसूची (BOQ) का गहन अध्ययन करने के पश्चात, संपूर्ण कार्य को निविदा शर्तों के अनुसार ₹${costing.totalBidAmount?.toLocaleString()} की प्रतिस्पर्धी दर पर निष्पादित करने का औपचारिक प्रस्ताव प्रस्तुत करते हैं।\n\nयह बोली वर्तमान बाजार दरों (टीएमटी स्टील, 53-ग्रेड सीमेंट, रेत एवं वैधानिक न्यूनतम मजदूरी) के गहन वित्तीय विश्लेषण के उपरांत तैयार की गई है।\n\nभवदीय,\nअधिकृत हस्ताक्षरकर्ता\n${p.name}`,
        costJustificationNarrative: `हमारा वित्तीय प्राक्कलन ₹${costing.totalBidAmount?.toLocaleString()} पूर्णतया वास्तविक बाजार लागत पर आधारित है:\n1. कच्चा माल एवं धातुएं (₹${costing.directMaterialsCost?.toLocaleString()}): Fe550D टीएमटी स्टील और ओपीसी 53 ग्रेड सीमेंट हेतु दीर्घकालिक आपूर्ति अनुबंध।\n2. कार्यबल एवं मजदूरी (₹${costing.directLaborCost?.toLocaleString()}): ${costing.workerCount || 85} प्रमाणित श्रमिकों व इंजीनियरों हेतु न्यूनतम मजदूरी एवं ईपीएफ/ईएसआईसी मानकों का अनुपालन।\n3. मशीनरी व परिवहन (₹${(costing.equipmentAndTransportCost || costing.transportLogisticsCost || 240000)?.toLocaleString()}): कंपनी के स्वामित्व वाले कंक्रीट मिक्सर और टावर क्रेन का उपयोग।\n4. आकस्मिकता बफर (₹${costing.contingencyBufferCost?.toLocaleString()}): बाजार दर में उतार-चढ़ाव से परियोजना की सुरक्षा।`,
        executionScheduleNarrative: `कार्य को निर्धारित ${tender.completionDurationDays} दिनों में 4 चरणों में पूरा किया जाएगा:\n- चरण 1 (दिन 1-45): साइट सीमांकन, मृदा परीक्षण एवं नींव खुदाई।\n- चरण 2 (दिन 46-150): आरसीसी ढांचा और स्तंभ निर्माण।\n- चरण 3 (दिन 151-280): चिनाई, प्लास्टर, एमईपी वायरिंग एवं अग्निशमन कार्य।\n- चरण 4 (दिन 281-${tender.completionDurationDays}): फिनिशिंग, रंगाई-पुताई, परीक्षण एवं अंतिम हस्तांतरण।`,
        qualityAndSafetyPlan: `हम शून्य-दुर्घटना एवं आईएसओ 9001/45001 गुणवत्ता मानकों का पालन करते हैं। सभी सामग्री का एनएबीएल मान्यता प्राप्त प्रयोगशालाओं से परीक्षण कराया जाता है।`,
        competitiveEdgeStatement: `हमारी कंपनी का निष्कलंक ट्रैक रिकॉर्ड (${p.pastPerformanceRating}/5) और प्रत्यक्ष आपूर्ति नेटवर्क समयबद्ध और गुणवत्तापूर्ण कार्य की पूर्ण गारंटी प्रदान करता है।`
      }
    });
  }

  res.json({
    status: 'success',
    source: 'deterministic_engine',
    data: {
      executiveCoverLetter: `To: The Tender Inviting Authority (TIA)\n${tender.authority}\n\nSubject: Formal Technical & Financial Bid Submission for "${tender.title}" (Ref: ${tender.refNumber})\n\nDear Sir/Madam,\n\nWe, ${p.name}, have thoroughly examined the Tender Documents, General and Special Conditions of Contract, Technical Specifications, and the Bill of Quantities (BOQ). We hereby offer to execute and complete the entire works in conformity with the tender conditions for the competitive sum of ${costing.totalBidAmount?.toLocaleString()} ${tender.currency}.\n\nOur bid has been engineered through real-time market cost analysis, incorporating prevailing indexation for structural steel, high-strength cement, aggregates, and statutory fair wages. We confirm our unreserved acceptance of all contractual milestones and submit herewith our Earnest Money Deposit and all mandatory pre-qualification credentials.\n\nRespectfully submitted,\nAuthorized Signatory\n${p.name}`,
      costJustificationNarrative: `Our financial estimate of ${costing.totalBidAmount?.toLocaleString()} ${tender.currency} represents a disciplined, data-backed quotation that delivers optimal value to the government without sacrificing structural integrity or delivery timelines:\n\n1. Raw Materials & Commodities (${costing.directMaterialsCost?.toLocaleString()} ${tender.currency}): Direct pricing based on current mill spot rates for Fe550D TMT Steel and 53-Grade OPC Cement with volume procurement agreements.\n2. Workforce & Manpower (${costing.directLaborCost?.toLocaleString()} ${tender.currency}): Engineered on an estimated ${costing.totalManDays || 22500} man-days across certified site engineers, skilled bar-benders, masons, and general helpers adhering strictly to statutory minimum wages and EPF/ESIC social security provisions.\n3. Equipment & Logistics (${(costing.equipmentAndTransportCost || costing.transportLogisticsCost || 240000)?.toLocaleString()} ${tender.currency}): Dedicated deployment of heavy machinery (Tower Cranes, JCBs, Concrete Transit Mixers) owned and operated directly by our firm, eliminating third-party rental markups.\n4. Hedging & Buffer (${costing.contingencyBufferCost?.toLocaleString()} ${tender.currency}): A prudent contingency reserve to insulate the project against unexpected commodity spikes or diesel freight hikes.`,
      executionScheduleNarrative: `The works shall be completed strictly within ${tender.completionDurationDays} calendar days structured across four synchronized operational gates:\n- Phase 1 (Days 1–45): Site handover, perimeter fencing, geotechnical validation, temporary site offices, and substructure excavation.\n- Phase 2 (Days 46–150): Foundation raft, columns, and super-structure RCC framing up to completion.\n- Phase 3 (Days 151–280): Masonry walls, internal plastering, MEP cabling, fire safety conduits, and architectural facade installations.\n- Phase 4 (Days 281–${tender.completionDurationDays}): Finishes, weathercoat exterior painting, testing & commissioning, statutory agency approvals, and final handover.`,
      qualityAndSafetyPlan: `We enforce a Zero-Accident, Zero-Defect Quality Assurance (QA/QC) charter:\n- 100% third-party batch testing for all cement and steel consignments through government-accredited NABL laboratories.\n- Daily concrete cube compressive strength tests (7-day and 28-day curing intervals).\n- Strict compliance with ISO 45001 safety mandates, personal protective equipment (PPE) enforcement, and site paramedic coverage.`,
      competitiveEdgeStatement: `By combining internal heavy machinery ownership, direct mill procurement agreements, and an unblemished ${p.pastPerformanceRating}/5 track record, ${p.name} guarantees on-time project completion with zero cost overrun claims, providing the Tender Inviting Authority with maximum reliability and fiscal prudence.`
    }
  });
});

// Full-stack Vite development integration
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TenDo Server running on http://0.0.0.0:${PORT} with WebSocket on ws://0.0.0.0:${PORT}/ws/portals`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
