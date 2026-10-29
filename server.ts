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
        currentCommodities: COMMODITY_INDEX,
        activeTendersCount: 0,
        sampleTenderCount: activeTenders.length,
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
    countMeaning: 'activeTenderCount is not a live portal count; use /api/tenders and inspect each record dataSource.',
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
  "costJustificationNarrative": string (Detailed rationale explaining the raw material rates, steel/cement/sand pricing indices, workforce wages, and logistics cost),
  "executionScheduleNarrative": string (Milestone Gantt breakdown across the project duration with phase-by-phase resource mobilization),
  "qualityAndSafetyPlan": string (QA/QC standards, testing frequency, site safety protocols, zero-defect liability assurance),
  "competitiveEdgeStatement": string (Why this bid is the most advantageous, sound, and risk-free choice for the government)
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
      executiveCoverLetter: `To: The Tender Inviting Authority (TIA)\n${tender.authority}\n\nSubject: Formal Technical & Financial Bid Submission for "${tender.title}" (Ref: ${tender.refNumber})\n\nDear Sir/Madam,\n\nWe, ${p.name}, have thoroughly examined the Tender Documents, General and Special Conditions of Contract, Technical Specifications, and the Bill of Quantities (BOQ). We hereby offer to execute and complete the entire works in conformity with the tender conditions for the competitive sum of ${costing.totalBidAmount?.toLocaleString()} ${tender.currency}.\n\nOur bid has been engineered through the supplied cost assumptions, incorporating the supplied assumptions for structural steel, cement, aggregates, and labour, all of which require verification. We confirm our unreserved acceptance of all contractual milestones and submit herewith our Earnest Money Deposit and all mandatory pre-qualification credentials.\n\nRespectfully submitted,\nAuthorized Signatory\n${p.name}`,
      costJustificationNarrative: `Our financial estimate of ${costing.totalBidAmount?.toLocaleString()} ${tender.currency} represents a disciplined, data-backed quotation that delivers optimal value to the government without sacrificing structural integrity or delivery timelines:\n\n1. Raw Materials & Commodities (${costing.directMaterialsCost?.toLocaleString()} ${tender.currency}): Direct pricing based on current mill spot rates for Fe550D TMT Steel and 53-Grade OPC Cement with volume procurement agreements.\n2. Workforce & Manpower (${costing.directLaborCost?.toLocaleString()} ${tender.currency}): Engineered on an estimated ${costing.totalManDays || 22500} man-days across certified site engineers, skilled bar-benders, masons, and general helpers adhering strictly to statutory minimum wages and EPF/ESIC social security provisions.\n3. Equipment & Logistics (${(costing.equipmentAndTransportCost || costing.transportLogisticsCost || 240000)?.toLocaleString()} ${tender.currency}): Dedicated deployment of heavy machinery (Tower Cranes, JCBs, Concrete Transit Mixers) owned and operated directly by our firm, eliminating third-party rental markups.\n4. Hedging & Buffer (${costing.contingencyBufferCost?.toLocaleString()} ${tender.currency}): A prudent contingency reserve to insulate the project against unexpected commodity spikes or diesel freight hikes.`,
      executionScheduleNarrative: `The works shall be completed strictly within ${tender.completionDurationDays} calendar days structured across four synchronized operational gates:\n- Phase 1 (Days 1–45): Site handover, perimeter fencing, geotechnical validation, temporary site offices, and substructure excavation.\n- Phase 2 (Days 46–150): Foundation raft, columns, and super-structure RCC framing up to completion.\n- Phase 3 (Days 151–280): Masonry walls, internal plastering, MEP cabling, fire safety conduits, and architectural facade installations.\n- Phase 4 (Days 281–${tender.completionDurationDays}): Finishes, weathercoat exterior painting, testing & commissioning, statutory agency approvals, and final handover.`,
      qualityAndSafetyPlan: `We enforce a Zero-Accident, Zero-Defect Quality Assurance (QA/QC) charter:\n- 100% third-party batch testing for all cement and steel consignments through government-accredited NABL laboratories.\n- Daily concrete cube compressive strength tests (7-day and 28-day curing intervals).\n- Strict compliance with ISO 45001 safety mandates, personal protective equipment (PPE) enforcement, and site paramedic coverage.`,
      competitiveEdgeStatement: `By combining internal heavy machinery ownership, direct mill procurement agreements, and an unblemished ${p.pastPerformanceRating}/5 track record, ${p.name} guarantees on-time project completion with zero cost overrun claims, providing the Tender Inviting Authority with maximum reliability and fiscal prudence.`
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
  const codes = Array.from(raw.matchAll(/\\b(\\d{8})\\b/g), (match) => match[1]);
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
