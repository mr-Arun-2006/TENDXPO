// Pure helpers for AI tender analysis. No I/O here so they can be tested directly.

/** The fields of a tender that are sent to the model. Nothing else leaves the server. */
export interface AnalysisInput {
  title: string;
  authority: string;
  portal: string;
  sector: string;
  currency: string;
  /** Estimated value stated by the source notice. 0 or missing means not stated. */
  budget: number;
  submissionDeadline: string;
  description: string;
  scopeOfWork: string;
  sourceUrl: string;
}

export interface AnalysisLineItem {
  item: string;
  basis: string;
  estimatedAmount: number | null;
  assumption: string;
}

export interface TenderAnalysis {
  summary: string;
  keyDates: { label: string; date: string }[];
  eligibility: { criterion: string; requirement: string; note: string }[];
  risks: string[];
  budget: {
    currency: string;
    /** Taken from the source notice, never from the model. null when the notice states no value. */
    statedEstimate: number | null;
    /** AI-built breakdown. Always an estimate, never the official budget. */
    lineItems: AnalysisLineItem[];
    /** Sum of line items with numeric amounts. null when no line has an amount. */
    modelEstimateTotal: number | null;
    contingencyPct: number;
    notes: string;
  };
  dataGaps: string[];
}

export const SYSTEM_PROMPT =
  'You analyse public procurement notices for a contractor. Use ONLY the notice text supplied. ' +
  'Never invent eligibility limits, dates, quantities or prices. If something is not stated, say so in dataGaps and use null. ' +
  'Reply with one JSON object and nothing else.';

const clip = (s: string, n: number) => (s || '').toString().slice(0, n);

export function sanitizeInput(raw: any): AnalysisInput {
  const num = Number(raw?.budget);
  return {
    title: clip(raw?.title, 300),
    authority: clip(raw?.authority, 200),
    portal: clip(raw?.portal, 100),
    sector: clip(raw?.sector, 100),
    currency: clip(raw?.currency, 5) || 'INR',
    budget: Number.isFinite(num) && num > 0 ? num : 0,
    submissionDeadline: clip(raw?.submissionDeadline, 40),
    description: clip(raw?.description, 4000),
    scopeOfWork: clip(raw?.scopeOfWork, 2000),
    sourceUrl: clip(raw?.sourceUrl, 300),
  };
}

export function buildAnalysisPrompt(t: AnalysisInput): string {
  const stated = t.budget > 0 ? `${t.budget} ${t.currency}` : 'NOT STATED in the notice';
  return `${SYSTEM_PROMPT}

NOTICE
- Title: ${t.title}
- Authority: ${t.authority}
- Portal: ${t.portal}
- Sector: ${t.sector}
- Stated estimated value: ${stated}
- Submission deadline: ${t.submissionDeadline || 'not stated'}
- Description: ${t.description || 'not stated'}
- Scope of work: ${t.scopeOfWork || 'not stated'}

Return JSON with exactly these keys:
{
  "summary": string (3-5 sentences on what is being procured),
  "keyDates": [{"label": string, "date": string}],
  "eligibility": [{"criterion": string, "requirement": string, "note": string}],
  "risks": [string],
  "budget": {
    "lineItems": [{"item": string, "basis": string, "estimatedAmount": number|null, "assumption": string}],
    "contingencyPct": number,
    "notes": string
  },
  "dataGaps": [string]
}
Rules for budget: line items are an ESTIMATE built from the scope. Every amount must have an assumption. If the scope gives no quantities or rates, set estimatedAmount to null rather than guessing.`;
}

/** Pull the first JSON object out of a model reply (handles ```json fences and stray text). */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Reply contained no JSON object');
  return JSON.parse(body.slice(start, end + 1));
}

const str = (v: any, n = 500) => (typeof v === 'string' ? v.slice(0, n) : '');
const arr = <T>(v: any, f: (x: any) => T | null, max = 20): T[] =>
  (Array.isArray(v) ? v : []).map(f).filter((x): x is T => x !== null).slice(0, max);

/**
 * Validate and normalise a model reply. The stated estimate is always taken from the
 * source notice, so the model cannot overwrite the official value.
 */
export function parseAnalysis(raw: string, t: AnalysisInput): TenderAnalysis {
  const j: any = extractJson(raw);
  if (!j || typeof j !== 'object') throw new Error('Reply was not an object');

  const lineItems = arr(j.budget?.lineItems, (x) => {
    if (!x || typeof x !== 'object') return null;
    const amt = Number(x.estimatedAmount);
    return {
      item: str(x.item, 200),
      basis: str(x.basis, 300),
      estimatedAmount: x.estimatedAmount === null || !Number.isFinite(amt) ? null : amt,
      assumption: str(x.assumption, 300),
    };
  }, 40);
  const amounts = lineItems.map((l) => l.estimatedAmount).filter((n): n is number => n !== null);
  const contingency = Number(j.budget?.contingencyPct);

  return {
    summary: str(j.summary, 1200),
    keyDates: arr(j.keyDates, (x) => (x ? { label: str(x.label, 120), date: str(x.date, 60) } : null)),
    eligibility: arr(j.eligibility, (x) =>
      x ? { criterion: str(x.criterion, 200), requirement: str(x.requirement, 300), note: str(x.note, 300) } : null
    ),
    risks: arr(j.risks, (x) => (typeof x === 'string' && x ? x.slice(0, 300) : null), 15),
    budget: {
      currency: t.currency,
      statedEstimate: t.budget > 0 ? t.budget : null,
      lineItems,
      modelEstimateTotal: amounts.length ? amounts.reduce((a, b) => a + b, 0) : null,
      contingencyPct: Number.isFinite(contingency) && contingency >= 0 && contingency <= 30 ? contingency : 5,
      notes: str(j.budget?.notes, 600),
    },
    dataGaps: arr(j.dataGaps, (x) => (typeof x === 'string' && x ? x.slice(0, 300) : null), 15),
  };
}
