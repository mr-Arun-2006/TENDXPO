import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Exported so Vercel can run the same Express app as a serverless function (api/index.ts).
export default app;
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// Firebase ID-token verification (no firebase-admin dependency).
// Verifies RS256 signature against Google's public keys + standard claims.
// ---------------------------------------------------------------------------
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  (() => {
    try {
      for (const dir of [__dirname, process.cwd()]) {
        try {
          return JSON.parse(
            fs.readFileSync(path.resolve(dir, 'firebase-applet-config.json'), 'utf8')
          ).projectId as string;
        } catch {
          /* try next location */
        }
      }
      return 'tenderxpo';
    } catch {
      return 'tenderxpo';
    }
  })();

const JWKS_URL =
  'https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com';
let jwksCache: { keys: Record<string, any>[]; expires: number } = { keys: [], expires: 0 };

async function getJwks() {
  if (Date.now() < jwksCache.expires && jwksCache.keys.length) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys: Record<string, any>[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  jwksCache = { keys: body.keys, expires: Date.now() + maxAge * 1000 };
  return body.keys;
}

const b64urlToBuf = (v: string) => Buffer.from(v.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; email?: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const header = JSON.parse(b64urlToBuf(parts[0]).toString('utf8'));
  const payload = JSON.parse(b64urlToBuf(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported token header');

  const jwk = (await getJwks()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key');
  const ok = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' }),
    b64urlToBuf(parts[2])
  );
  if (!ok) throw new Error('Bad signature');

  const now = Math.floor(Date.now() / 1000);
  if (!FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID not configured');
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('Wrong audience');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error('Wrong issuer');
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('Token expired');
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) throw new Error('Token issued in the future');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Missing subject');
  return { uid: payload.sub, email: payload.email };
}

type AuthedRequest = express.Request & { user?: { uid: string; email?: string } };

/** Requires `Authorization: Bearer <Firebase ID token>`. Sets req.user. */
const requireAuth: express.RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ status: 'error', message: 'Sign in required.' });
  try {
    (req as AuthedRequest).user = await verifyFirebaseIdToken(token);
    next();
  } catch (err: any) {
    res.status(401).json({ status: 'error', message: 'Invalid or expired session. Sign in again.' });
  }
};

/** Very small in-memory rate limiter for the AI endpoints (per user). */
const aiHits = new Map<string, number[]>();
const aiRateLimit: express.RequestHandler = (req, res, next) => {
  const uid = (req as AuthedRequest).user?.uid || req.ip || 'anon';
  const now = Date.now();
  const recent = (aiHits.get(uid) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 20) {
    return res.status(429).json({ status: 'error', message: 'Too many AI requests. Try again in a minute.' });
  }
  recent.push(now);
  aiHits.set(uid, recent);
  next();
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';


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

// Portal registry; status describes connector configuration, not whether a third-party site itself is online.
const OFFICIAL_PORTALS = [
  { id: 'gem', name: 'GeM (Government e-Marketplace)', country: 'India', domain: 'gem.gov.in', status: 'Link only — no live connector configured' },
  { id: 'cppp', name: 'Central Public Procurement Portal (CPPP)', country: 'India', domain: 'eprocure.gov.in', status: 'Link only — no live connector configured' },
  { id: 'sam_gov', name: 'SAM.gov System for Award Management', country: 'United States', domain: 'sam.gov', status: 'API key required — not configured' },
  { id: 'ted_europa', name: 'TED (Tenders Electronic Daily)', country: 'European Union', domain: 'ted.europa.eu', status: 'Live API configured' },
  { id: 'railtel_nhai', name: 'RailTel & National Highways Authority', country: 'Multi-Gov', domain: 'nhai.gov.in', status: 'Link only — no live connector configured' },
  { id: 'smart_cities', name: 'Smart Cities Mission Procurement', country: 'Global', domain: 'smartcities.gov.in', status: 'Link only — no live connector configured' },
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

// User Sector Alert Profiles store (Initialized with default for user demo@example.invalid)
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

let sectorProfilesMap: Record<string, UserSectorProfileData> = {};

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

let triggeredAlerts: TenderAlertLog[] = [];

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

const PORTAL_MONITOR_HEALTH: any[] = [];

const RECENT_PORTAL_EVENTS: PortalLiveEventData[] = [];

// WebSocket events are emitted only by a verified source integration.

// Synthetic portal tender generation is intentionally removed. Add a source adapter before publishing scan results.

// Connection bookkeeping only; an open socket does not mean an official portal is connected.
const wsClients = new Set<WebSocket>();

function broadcastPortalStatus(): void {
  const message = JSON.stringify({
    type: 'portal:status',
    data: {
      connectedClientsCount: wsClients.size,
      activePortals: [],
      liveSourceIds: SOURCE_REGISTRY.filter((source) => source.access === 'live-api').map((source) => source.id),
    },
  });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.warn('Could not broadcast WebSocket status:', err);
      }
    }
  }
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
        recentEvents: [],
        commodityDataSource: 'illustrative-sample-rates',
        activeTendersCount: 0,
        sampleTenderCount: activeTenders.length,
        protocol: 'TenDo WebSocket Status Stream v2.1 (live portal feeds not configured)',
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
        ws.send(JSON.stringify({
          type: 'portal:scan_unavailable',
          portal: msg.portal || 'CPPP',
          message: 'A verified live connector is not configured for this portal. Open the official source instead.',
          timestamp: new Date().toISOString(),
        }));
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

// No periodic synthetic events. Real notifications must be derived from source changes.

// Alert delivery remains disabled until verified source changes and durable user preferences are implemented.

// This endpoint intentionally does not fabricate tender records or alert-delivery receipts.
app.post('/api/cloud-functions/scraper-trigger', requireAuth, (_req, res) => {
  res.status(501).json({
    status: 'not_configured',
    message: 'A verified tender ingestion and notification backend is not configured for this source yet.',
    source: 'none',
  });
});

// API: Get User Sector Profile
app.get('/api/user-sector-profile', requireAuth, (req, res) => {
  const userId = (req as AuthedRequest).user!.uid;
  const profile = sectorProfilesMap[userId] || {
    userId,
    targetSectors: ['Civil Construction'],
    minBudget: 0,
    maxBudget: Number.MAX_SAFE_INTEGER,
    preferredStates: ['All India'],
    emailAlertsEnabled: false,
    alertEmail: (req as AuthedRequest).user?.email || '',
    inAppAlertsEnabled: true,
    googleChatAlertsEnabled: false,
    minFitScoreThreshold: 70,
    updatedAt: new Date().toISOString(),
  };
  sectorProfilesMap[userId] = profile;
  res.json({ status: 'success', profile });
});

// API: Save / Update User Sector Profile
app.post('/api/user-sector-profile', requireAuth, (req, res) => {
  const profileData = req.body || {};
  const userId = (req as AuthedRequest).user!.uid;
  const existing = sectorProfilesMap[userId] || {
    userId,
    targetSectors: ['Civil Construction'],
    minBudget: 0,
    maxBudget: Number.MAX_SAFE_INTEGER,
    preferredStates: ['All India'],
    emailAlertsEnabled: false,
    alertEmail: (req as AuthedRequest).user?.email || '',
    inAppAlertsEnabled: true,
    googleChatAlertsEnabled: false,
    minFitScoreThreshold: 70,
    updatedAt: new Date().toISOString(),
  };
  sectorProfilesMap[userId] = {
    ...existing,
    ...profileData,
    userId,
    updatedAt: new Date().toISOString(),
  };
  res.json({
    status: 'success',
    message: 'Sector preferences updated in memory for this server instance. Persistent alert delivery is not configured yet.',
    profile: sectorProfilesMap[userId],
  });
});

// API: Get User Alerts
app.get('/api/user-alerts', requireAuth, (req, res) => {
  const userId = (req as AuthedRequest).user!.uid;
  const userAlerts = triggeredAlerts.filter((a) => a.userId === userId);
  res.json({
    status: 'success',
    alerts: userAlerts,
    unreadCount: userAlerts.filter((a) => !a.read).length,
  });
});

// API: Mark Alert As Read
app.post('/api/user-alerts/:alertId/read', requireAuth, (req, res) => {
  const { alertId } = req.params;
  const alert = triggeredAlerts.find((a) => a.id === alertId && a.userId === (req as AuthedRequest).user!.uid);
  if (alert) alert.read = true;
  res.json({ status: 'success', message: 'Alert marked as read' });
});

// API: Get Commodities Index with Real-Time Fluctuations
app.get('/api/commodities', (_req, res) => {
  res.json({
    status: 'success',
    responseGeneratedAt: new Date().toISOString(),
    dataSource: 'illustrative-sample-rates',
    livePriceProviderConnected: false,
    warning: 'These rates and histories are illustrative assumptions, not live market quotations. Verify prices with suppliers before bidding.',
    indexCount: COMMODITY_INDEX.length,
    commodities: COMMODITY_INDEX,
  });
});

// API: Get Official Government Portals Status
app.get('/api/portals', (_req, res) => {
  res.json({
    status: 'success',
    portals: OFFICIAL_PORTALS,
    sourceOfTruth: '/api/sources',
    countMeaning: 'activeTenderCount counts verified records held in the live portal monitor; sampleTenderCount is a separate demo count.',
    liveSourceIds: SOURCE_REGISTRY.filter((source) => source.access === 'live-api').map((source) => source.id),
    activeTenderCount: 0,
    sampleTenderCount: activeTenders.length,
  });
});

// API: List All Tenders
app.get('/api/tenders', async (req, res) => {
  if (req.query.refresh === '1' && Date.now() - tedCache.at > 60_000) tedCache.at = 0;
  const live = await fetchTedTenders();
  const local = activeTenders.map((t: any) => ({ dataSource: 'sample', ...t }));
  const all = [...live, ...local];
  res.json({
    status: 'success',
    count: all.length,
    liveCount: live.length,
    tenders: all,
  });
});

// Do not report a scan as successful until a supported source adapter has returned verified notices.
app.post('/api/scrape-portal', requireAuth, (_req, res) => {
  res.status(501).json({
    status: 'not_configured',
    message: 'This portal connector is not configured. No tender was scraped or created.',
    source: 'none',
  });
});

// Personal bid stages are stored in the signed-in user's Firestore namespace by the frontend.
app.post('/api/tenders/:id/status', requireAuth, (_req, res) => {
  res.status(410).json({
    status: 'use_user_scoped_storage',
    message: 'This shared tender-stage endpoint is retired. Save personal pipeline state in your own user-scoped record.',
  });
});

// Company profiles are private Firestore documents owned by the signed-in user.
app.get('/api/company-profile', (_req, res) => {
  res.status(410).json({ status: 'retired', message: 'Company profiles are stored in authenticated user-scoped Firestore documents.' });
});
app.post('/api/company-profile', (_req, res) => {
  res.status(410).json({ status: 'retired', message: 'Company profiles are stored in authenticated user-scoped Firestore documents.' });
});

// API: Gemini-Powered Feasibility Analysis
app.post('/api/gemini/analyze-bid', requireAuth, aiRateLimit, async (req, res) => {
  const { tender, profile } = req.body;
  if (!tender) {
    return res.status(400).json({ status: 'error', message: 'Tender payload required' });
  }

  if (!profile || typeof profile !== 'object' || !String(profile.name || '').trim() || !(Number(profile.annualTurnover) > 0)) {
    return res.status(400).json({
      status: 'company_profile_required',
      message: 'Complete your company name and annual turnover before requesting a tender analysis.',
    });
  }
  const p = profile;

  // Check if Gemini AI client is available
  if (aiClient) {
    try {
      const prompt = `You are a Principal Government Tender & Bidding Intelligence Auditor.
Analyze the supplied tender record against the user-provided company profile. Source: ${tender.dataSource || 'unknown'}. Company values are user-reported and not independently verified. Never invent project references, certificates, contracts, market prices, competitor bids, win probabilities, or guaranteed outcomes. Explicitly flag missing evidence. Do not treat sample records as real opportunities:

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
  "strategicWinRecommendations": string[] (actions to verify eligibility and prepare a compliant bid; never guarantee an award),
  "bidNoBidChecklist": [
    { "criteria": string, "required": string, "companyValue": string, "passed": boolean }
  ]
}`;

      const response = await aiClient.models.generateContent({
        model: GEMINI_MODEL,
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

  // Rules-based preliminary check. Missing evidence is not treated as a pass or a win probability.
  const requiredTurnover = Number(tender.eligibilityCriteria?.minAnnualTurnover || 0);
  const annualTurnover = Number(p.annualTurnover || 0);
  const turnoverKnown = requiredTurnover > 0 && annualTurnover > 0;
  const turnoverPassed = turnoverKnown && annualTurnover >= requiredTurnover;

  const utilization = Number(p.currentCapacityUtilizationPercent);
  const capacityKnown = Number(p.maxProjectCapacity) > 0 &&
    Number.isFinite(utilization) && utilization >= 0 && utilization <= 100;
  const capacityFree = capacityKnown ? 100 - utilization : null;

  const rating = Number(p.pastPerformanceRating);
  const ratingKnown = Number.isFinite(rating) && rating > 0 && rating <= 5;

  const requiredCerts: string[] = Array.isArray(tender.eligibilityCriteria?.requiredCertifications)
    ? tender.eligibilityCriteria.requiredCertifications.map((value: unknown) => String(value))
    : [];
  const companyCerts: string[] = Array.isArray(p.certifications)
    ? p.certifications.map((value: unknown) => String(value))
    : [];
  const missingCerts = requiredCerts.filter((required) =>
    !companyCerts.some((held) =>
      held.trim().length > 0 &&
      (held.toLowerCase().includes(required.toLowerCase()) ||
       required.toLowerCase().includes(held.toLowerCase()))
    )
  );

  const emd = Number(tender.emdAmount || 0);
  const solvency = Number(p.availableSolvency || 0);
  const solvencyKnown = emd > 0 && solvency > 0 &&
    String(p.currency || '') === String(tender.currency || '');
  const solvencyPassed = solvencyKnown && solvency >= emd;

  const checks: Array<{ weight: number; known: boolean; passed: boolean }> = [
    { weight: 40, known: turnoverKnown, passed: turnoverPassed },
    { weight: 20, known: capacityKnown, passed: Boolean(capacityKnown && capacityFree !== null && capacityFree >= 20) },
    { weight: 15, known: ratingKnown, passed: ratingKnown && rating >= 4 },
    { weight: 15, known: requiredCerts.length > 0, passed: requiredCerts.length > 0 && missingCerts.length === 0 },
    { weight: 10, known: solvencyKnown, passed: solvencyPassed },
  ];
  const knownChecks = checks.filter((check) => check.known);
  const knownWeight = knownChecks.reduce((sum, check) => sum + check.weight, 0);
  const passedWeight = knownChecks.filter((check) => check.passed).reduce((sum, check) => sum + check.weight, 0);
  const score = knownWeight ? Math.round((passedWeight / knownWeight) * 100) : 0;

  const missingEvidence: string[] = [];
  if (!turnoverKnown) missingEvidence.push('Tender minimum turnover or company-reported turnover is missing.');
  if (!capacityKnown) missingEvidence.push('Operational capacity is not sufficiently recorded in the company profile.');
  if (!ratingKnown) missingEvidence.push('Past-performance rating is not recorded in the company profile.');
  if (requiredCerts.length && missingCerts.length) missingEvidence.push('Required certificates not evidenced in the company profile: ' + missingCerts.join(', ') + '.');
  const requiredExperience = Number(tender.eligibilityCriteria?.minExperienceYears || 0);
  if (requiredExperience > 0) missingEvidence.push('Verify the required ' + requiredExperience + ' years of experience against company records and original tender documents.');
  const similarProjects = Number(tender.eligibilityCriteria?.similarProjectsCount || 0);
  if (similarProjects > 0) missingEvidence.push('Verify the required ' + similarProjects + ' similar completed projects; they are not stored in the current company profile.');
  if (emd <= 0) missingEvidence.push('EMD is not stated in the normalized record; verify the original notice.');
  else if (!solvencyKnown) missingEvidence.push('EMD and available solvency cannot be compared reliably because company data or currency information is missing.');
  if (!(Number(tender.budget) > 0)) missingEvidence.push('Estimated tender value is not stated in the normalized record.');
  if (!tender.submissionDeadline) missingEvidence.push('Submission deadline is missing; verify it on the official source.');
  if (!tender.sourceUrl) missingEvidence.push('A direct source URL is not attached to this tender record.');
  if (tender.dataSource === 'sample') missingEvidence.push('This is sample data, not a real bidding opportunity.');

  const hardFailure = (turnoverKnown && !turnoverPassed) ||
    (requiredCerts.length > 0 && missingCerts.length > 0) ||
    (solvencyKnown && !solvencyPassed) ||
    tender.dataSource === 'sample';
  const verdict = hardFailure
    ? 'High Risk / No-Bid'
    : missingEvidence.length
    ? 'Conditional Bid'
    : score >= 80
    ? 'High Viability'
    : score >= 60
    ? 'Conditional Bid'
    : 'High Risk / No-Bid';

  const strengths: string[] = [];
  if (turnoverPassed) strengths.push('Company-reported turnover meets the stated threshold; supporting financial evidence has not been independently verified.');
  if (capacityKnown && capacityFree !== null && capacityFree >= 20) strengths.push('The company profile reports ' + capacityFree + '% available capacity.');
  if (ratingKnown && rating >= 4) strengths.push('The company reports a past-performance rating of ' + rating + '/5; references still need verification.');
  if (requiredCerts.length && missingCerts.length === 0) strengths.push('The company profile lists the certificates required by the normalized record; validity and authenticity must be checked.');
  if (!strengths.length) strengths.push('No substantive strength can be confirmed from the available structured inputs.');

  const riskFactors: string[] = [];
  if (turnoverKnown && !turnoverPassed) riskFactors.push('Company-reported turnover is below the stated tender threshold.');
  if (missingCerts.length) riskFactors.push('Required certificate evidence is missing or does not match: ' + missingCerts.join(', ') + '.');
  if (!capacityKnown) riskFactors.push('Operational capacity is incomplete, so mobilization readiness cannot be established.');
  if (requiredExperience > 0 || similarProjects > 0) riskFactors.push('Experience and similar-project eligibility need evidence from company records.');
  if (!tender.submissionDeadline) riskFactors.push('Submission deadline is unknown in the normalized record.');
  if (!(Number(tender.budget) > 0)) riskFactors.push('Tender value is missing from the normalized record.');
  if (tender.dataSource === 'sample') riskFactors.push('This notice is sample data; do not use it for a real bid/no-bid decision.');
  riskFactors.push('BOQ material rates must be verified against current local supplier quotations before a real bid.');

  const checklist: Array<{ criteria: string; required: string; companyValue: string; passed: boolean }> = [
    {
      criteria: 'Minimum Annual Turnover',
      required: turnoverKnown ? 'At least ' + requiredTurnover.toLocaleString() + ' ' + (tender.currency || p.currency || '') : 'Threshold or company value missing',
      companyValue: annualTurnover > 0 ? annualTurnover.toLocaleString() + ' ' + (p.currency || '') + ' (company-reported)' : 'Not recorded',
      passed: turnoverPassed,
    },
    {
      criteria: 'Operational Capacity',
      required: 'Sufficient capacity for the tender schedule',
      companyValue: capacityKnown ? utilization + '% utilized' : 'Not recorded in company profile',
      passed: Boolean(capacityKnown && capacityFree !== null && capacityFree >= 20),
    },
    {
      criteria: 'Past Performance',
      required: 'Review the tender’s actual performance requirements',
      companyValue: ratingKnown ? rating + '/5 (company-reported)' : 'Not recorded in company profile',
      passed: Boolean(ratingKnown && rating >= 4),
    },
  ];
  if (requiredCerts.length) checklist.push({
    criteria: 'Required Certifications',
    required: requiredCerts.join(', '),
    companyValue: missingCerts.length ? 'Missing or unverified: ' + missingCerts.join(', ') : companyCerts.join(', '),
    passed: missingCerts.length === 0,
  });
  if (requiredExperience > 0) checklist.push({
    criteria: 'Minimum Experience',
    required: requiredExperience + ' years',
    companyValue: 'Not recorded in current company profile',
    passed: false,
  });
  if (similarProjects > 0) checklist.push({
    criteria: 'Similar Projects Completed',
    required: similarProjects + ' projects',
    companyValue: 'Not recorded in current company profile',
    passed: false,
  });
  if (emd > 0) checklist.push({
    criteria: 'EMD / Solvency',
    required: emd.toLocaleString() + ' ' + (tender.currency || ''),
    companyValue: solvencyKnown ? solvency.toLocaleString() + ' ' + p.currency + ' (company-reported)' : 'Currency or solvency data incomplete',
    passed: solvencyPassed,
  });

  res.json({
    status: 'success',
    source: 'heuristic',
    data: {
      fitScore: score,
      verdict,
      executiveSummary: 'Preliminary rules-based fit score calculated from ' + knownChecks.length +
        ' available checks. Missing evidence is listed below. This is not a legal eligibility determination or a probability of winning.' +
        (tender.dataSource === 'sample' ? ' The selected record is sample data and must not be used to bid.' : ''),
      strengths,
      riskFactors,
      missingEvidence,
      strategicWinRecommendations: [
        'Review the original tender notice, all corrigenda, technical specifications, deadlines and eligibility clauses.',
        'Provide evidence for turnover, experience, similar projects, certificates, solvency and execution capacity before treating a requirement as satisfied.',
        'Do not apply a universal discount. Price the verified quantities using current supplier quotations, taxes, logistics, project risk and a viable margin.',
        'Follow the evaluation methodology specified in the tender (such as L1 or QCBS); do not infer win probability without reliable competitor and award data.',
      ],
      bidNoBidChecklist: checklist,
    },
  });
});

// API: Gemini-Powered Proposal & Budget Explainer Generator
app.post('/api/gemini/generate-proposal', requireAuth, aiRateLimit, async (req, res) => {
  const { tender, costing, profile, language } = req.body;
  if (!tender || !costing) {
    return res.status(400).json({ status: 'error', message: 'Tender and costing calculation required' });
  }

  if (!profile || typeof profile !== 'object' || !String(profile.name || '').trim() || !(Number(profile.annualTurnover) > 0)) {
    return res.status(400).json({
      status: 'company_profile_required',
      message: 'Complete your company name and annual turnover before requesting a tender analysis.',
    });
  }
  const p = profile;
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
Draft a factual working proposal and budget-justification template for human review for "${tender.authority}". Never invent company experience, certificates, owned equipment, supplier contracts, market quotations, completed checks, documents already submitted, or a guaranteed award. Mark missing facts as [TO BE VERIFIED].

LANGUAGE DIRECTIVE:
Draft the content in ${targetLangName}. Maintain formal Indian e-procurement standards and official tender vocabulary.

TENDER DETAILS:
- Title: ${tender.title}
- Reference: ${tender.refNumber}
- NIT Estimated Value: ${tender.budget} ${tender.currency}
- Duration: ${tender.completionDurationDays} Days

FINANCIAL & COSTING BREAKDOWN:
- Proposed Bid Amount: ${costing.totalBidAmount} ${tender.currency} (${costing.varianceAgainstTenderBudgetPercent >= 0 ? '+' : ''}${costing.varianceAgainstTenderBudgetPercent}% vs NIT estimate)
- Direct Material & Raw Commodities: ${costing.directMaterialsCost} ${tender.currency} (Calculated using supplied BOQ assumptions; verify rates against current supplier quotations)
- Direct Labor & Workforce: ${costing.directLaborCost} ${tender.currency} (${costing.workerCount || 75} workers over ${tender.completionDurationDays} days)
- Heavy Equipment & Transport Logistics: ${costing.equipmentAndTransportCost || costing.transportLogisticsCost} ${tender.currency}
- Site Overheads & Quality Assurance: ${costing.preliminariesOverheadCost} ${tender.currency}
- Contingency & Price Hedging Buffer: ${costing.contingencyBufferCost} ${tender.currency}
- Contractor Profit Margin: ${costing.marginAmount} ${tender.currency} (${costing.marginPercent}%)
- Statutory Taxes (GST/VAT): ${costing.taxAmount} ${tender.currency} (${costing.taxPercent}%)

Return a structured JSON with:
{
  "executiveCoverLetter": string (Formal executive letter addressed to Tender Inviting Authority, citing reference, technical commitment, and execution readiness),
  "costJustificationNarrative": string (Explain supplied BOQ assumptions and explicitly note that prices, quantities, wages, taxes and logistics need verification against current evidence),
  "executionScheduleNarrative": string (Milestone Gantt breakdown across the project duration with phase-by-phase resource mobilization),
  "qualityAndSafetyPlan": string (Proposed controls only; do not claim existing certificates, facilities or compliance unless provided as evidence),
  "competitiveEdgeStatement": string (Evidence-supported strengths and unresolved assumptions; never call the bid risk-free or guarantee an award)
}`;

      const response = await aiClient.models.generateContent({
        model: GEMINI_MODEL,
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
      source: 'template',
      data: {
        executiveCoverLetter: `सेवा में: निविदा आमंत्रण प्राधिकारी (TIA)\n${tender.authority}\n\nविषय: "${tender.title}" (संदर्भ: ${tender.refNumber}) हेतु कार्यशील प्रस्ताव मसौदा\n\nमहोदय/महोदया,\n\nयह मसौदा उपलब्ध संरचित निविदा विवरण और दर्ज लागत अनुमानों पर आधारित है। कृपया मूल निविदा, सभी संशोधन, पात्रता, BOQ, कर, समयसीमा और कंपनी के प्रमाणपत्रों की पुष्टि करें। केवल सत्यापित दस्तावेज़ ही अंतिम प्रस्ताव के साथ संलग्न करें।\n\nभवदीय,\n${p.name}`,
        costJustificationNarrative: "कार्यशील मसौदा: मात्रा, इकाइयों, वर्तमान स्थानीय आपूर्तिकर्ता कोटेशन, श्रम दरों, उपकरण और परिवहन लागत, करों तथा जोखिम मान्यताओं की पुष्टि करें। इन दरों को लाइव बाजार मूल्य नहीं माना जाना चाहिए.",
        executionScheduleNarrative: "प्रस्तावित माइलस्टोन: मोबिलाइजेशन और साइट सत्यापन; मुख्य कार्य; सेवाएं और फिनिशिंग; परीक्षण, वैधानिक अनुमोदन और हस्तांतरण। वास्तविक तारीखें मूल निविदा, कार्यक्षेत्र, निर्भरताओं और उपलब्ध संसाधनों के आधार पर तय करें.",
        qualityAndSafetyPlan: "प्रस्तावित गुणवत्ता और सुरक्षा नियंत्रण लागू निविदा शर्तों और कानूनों के अनुरूप होने चाहिए। वास्तविक प्रमाणपत्रों, कर्मचारियों, परीक्षण सुविधाओं, PPE और निरीक्षण रिकॉर्ड की पुष्टि करें.",
        competitiveEdgeStatement: "कंपनी की क्षमताओं, अनुभव और प्रदर्शन संबंधी सभी दावों को सत्यापित संदर्भों से समर्थित करें। इस मसौदे से किसी पुरस्कार, समय पर पूर्णता या लागत-सीमा की गारंटी नहीं दी जाती.",
      }
    });
  }

  res.json({
    status: 'success',
    source: 'template',
    data: {
      executiveCoverLetter: `To: ${tender.authority}\n\nSubject: Working draft for "${tender.title}" (Reference: ${tender.refNumber})\n\nDear Sir/Madam,\n\nThis is a working draft based on the structured tender fields and BOQ assumptions supplied for analysis. Review the original tender and all amendments, eligibility clauses, quantities, taxes, deadlines and company evidence before finalizing. Attach only verified documents that are actually available.\n\nRespectfully,\n${p.name}`,
      costJustificationNarrative: "Working draft: verify quantities, units, current written supplier quotations, labor rates, equipment ownership or rental, transport, taxes and risk assumptions. These figures are not verified live market quotations.",
      executionScheduleNarrative: "Indicative milestones: mobilization and site validation; primary work packages; services and finishes; testing, statutory approvals and handover. Set actual dates from the original tender, scope dependencies, resource availability and stated completion period.",
      qualityAndSafetyPlan: "Proposed quality and safety controls must follow the tender specifications and applicable laws. Confirm actual staff, certificates, testing facilities, PPE and inspection records before submission.",
      competitiveEdgeStatement: "Support all claims about company capacity, experience, equipment and performance with verifiable evidence. This template does not guarantee an award, on-time completion or zero cost overruns.",
    }
  });
});


// ---------------------------------------------------------------------------
// Official data sources + provenance
// Only sources with a public API are fetched live. Indian portals (GeM, CPPP)
// have no open API and use CAPTCHA, so they are link-outs, not scraped.
// ---------------------------------------------------------------------------
const SOURCE_REGISTRY = [
  { id: 'ted', name: 'TED - Tenders Electronic Daily (EU)', url: 'https://ted.europa.eu', access: 'live-api', note: 'Public Search API v3, no key required.' },
  { id: 'cppp', name: 'Central Public Procurement Portal (India)', url: 'https://eprocure.gov.in/eprocure/app', access: 'link-only', note: 'Official Govt. of India tender portal. No public API; open the portal to verify and download NIT documents.' },
  { id: 'gem', name: 'GeM - Government e-Marketplace (India)', url: 'https://gem.gov.in', access: 'link-only', note: 'Bids and reverse auctions require portal login.' },
  { id: 'sam', name: 'SAM.gov (USA)', url: 'https://sam.gov', access: 'link-only', note: 'Opportunities API needs a free API key; not configured.' },
];

type TedTender = Record<string, any>;
let tedCache: { at: number; tenders: TedTender[]; error?: string } = { at: 0, tenders: [] };

const pickLang = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return pickLang(v[0]);
  const val = v.eng ?? v.ENG ?? v.en ?? Object.values(v)[0];
  return pickLang(val);
};

function classifyTedSector(notice: any): string {
  const raw = JSON.stringify(notice?.['classification-cpv'] ?? '');
  const codes = Array.from(raw.matchAll(/\b(\d{8})\b/g), (match) => match[1]);
  if (codes.some((code) => code.startsWith('4523'))) return 'Roads & Highways';
  if (codes.some((code) => code.startsWith('45'))) return 'Civil Construction';
  if (codes.some((code) => code.startsWith('33'))) return 'Healthcare & MedTech';
  if (codes.some((code) => code.startsWith('48') || code.startsWith('72') || code.startsWith('30'))) return 'IT & Cloud';
  if (codes.some((code) => code.startsWith('09') || code.startsWith('31'))) return 'Renewable Energy';
  return 'Unclassified';
}

async function fetchTedTenders(): Promise<TedTender[]> {
  if (Date.now() - tedCache.at < 15 * 60_000 && (tedCache.tenders.length || tedCache.error)) {
    return tedCache.tenders;
  }
  try {
    const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10).replace(/-/g, '');
    const res = await fetch('https://api.ted.europa.eu/v3/notices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: `publication-date>=${since}`,
        fields: [
          'publication-number', 'notice-title', 'buyer-name', 'publication-date',
          'deadline-receipt-tender-date-lot', 'estimated-value-lot',
          'place-of-performance-country-lot', 'classification-cpv', 'links',
        ],
        page: 1,
        limit: 12,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`TED responded ${res.status}`);
    const body: any = await res.json();
    const tenders = (body.notices || []).map((n: any): TedTender => {
      const pubNo = String(n['publication-number'] || '');
      const htmlLinks = n.links?.html || {};
      const url = htmlLinks.ENG || htmlLinks.eng || (Object.values(htmlLinks)[0] as string) ||
        `https://ted.europa.eu/en/notice/-/detail/${pubNo}`;
      const deadline = pickLang(n['deadline-receipt-tender-date-lot']);
      const value = Array.isArray(n['estimated-value-lot']) ? Number(n['estimated-value-lot'][0]) || 0 : 0;
      return {
        id: `TED-${pubNo}`,
        refNumber: pubNo,
        title: pickLang(n['notice-title']) || `TED notice ${pubNo}`,
        authority: pickLang(n['buyer-name']) || 'Not stated',
        portal: 'TED (ted.europa.eu)',
        sector: classifyTedSector(n),
        budget: value,
        currency: 'EUR',
        publishDate: String(pickLang(n['publication-date'])).slice(0, 10),
        submissionDeadline: deadline || '',
        location: pickLang(n['place-of-performance-country-lot']) || 'EU',
        state: '',
        country: pickLang(n['place-of-performance-country-lot']) || 'EU',
        emdAmount: 0,
        performanceGuarantee: 'See notice',
        completionDurationDays: 0,
        description: `Official notice ${pubNo} published on TED. Open the source link for the full notice.`,
        scopeOfWork: 'See official notice.',
        eligibilityCriteria: { minAnnualTurnover: 0, minExperienceYears: 0, similarProjectsCount: 0, requiredCertifications: [], minSolvencyCertificate: 0 },
        status: 'Discovered',
        companyFitScore: 0,
        feasibilityVerdict: 'Conditional Bid',
        competitorBidsCount: 0,
        lastScraped: new Date().toISOString(),
        addendums: [],
        documents: [],
        defaultBiddingTemplate: 'civil_building',
        dataSource: 'live-ted',
        sourceUrl: url,
      };
    });
    tedCache = { at: Date.now(), tenders };
    return tenders;
  } catch (err: any) {
    console.warn('TED fetch failed:', err?.message);
    tedCache = { at: Date.now(), tenders: [], error: String(err?.message || err) };
    return [];
  }
}

app.get('/api/sources', (_req, res) => {
  res.json({
    status: 'success',
    sources: SOURCE_REGISTRY.map((s) =>
      s.id === 'ted'
        ? { ...s, lastSync: tedCache.at ? new Date(tedCache.at).toISOString() : null, lastError: tedCache.error || null, liveCount: tedCache.tenders.length }
        : s
    ),
    sampleDataNotice:
      'Tenders marked "Sample" are illustrative demo data, not real notices. Always verify on the official portal before bidding.',
  });
});

// ---------------------------------------------------------------------------
// AI assistant chat (authenticated, rate limited)
// ---------------------------------------------------------------------------
app.post('/api/gemini/chat', requireAuth, aiRateLimit, async (req, res) => {
  const { messages, tenderId, language } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ status: 'error', message: 'messages[] is required' });
  }
  if (!aiClient) {
    return res.status(503).json({
      status: 'error',
      message: 'AI assistant is not configured on the server. Set GEMINI_API_KEY and restart.',
    });
  }

  const history = messages.slice(-20).map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.text || '').slice(0, 4000) }],
  }));
  if (history[history.length - 1].role !== 'user') {
    return res.status(400).json({ status: 'error', message: 'Last message must be from the user' });
  }

  const tender = tenderId ? activeTenders.find((t: any) => t.id === tenderId) : null;
  const tenderContext = tender
    ? `\n\nThe user is looking at this tender:\n- Title: ${tender.title}\n- Authority: ${tender.authority}\n- Portal: ${tender.portal}\n- Ref: ${tender.refNumber}\n- Budget: ${tender.budget} ${tender.currency}\n- Deadline: ${tender.submissionDeadline}\n- Data source: ${(tender as any).dataSource || 'sample'}`
    : '';

  const system =
    'You are TenDo Assistant, an expert on public procurement and tendering (India: GFR 2017, CVC guidelines, GeM, CPPP, CPWD; also EU TED). ' +
    'Explain tender terms, eligibility, EMD, BOQ and bid strategy in plain language. ' +
    'Never invent tender numbers, deadlines, amounts or legal citations. If you are unsure, say so and tell the user to verify on the official portal. ' +
    'Items labelled sample are demo data, not real notices. Keep answers concise and practical.' +
    (language ? ` Reply in the language with code "${String(language).slice(0, 8)}".` : '') +
    tenderContext;

  try {
    const response = await aiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: history,
      config: { systemInstruction: system, temperature: 0.4, maxOutputTokens: 1024 },
    });
    res.json({ status: 'success', reply: response.text || '', model: GEMINI_MODEL });
  } catch (err: any) {
    console.warn('Gemini chat failed:', err?.message);
    res.status(502).json({ status: 'error', message: 'The AI service is unavailable right now. Try again shortly.' });
  }
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

// On Vercel the platform runs the app per request; do not open a port.
if (!process.env.VERCEL) startServer().catch(err => {
  console.error('Failed to start server:', err);
});
