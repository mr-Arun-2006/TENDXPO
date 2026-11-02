// Evaluation notes for a followed tender. Stored as one JSON string in the bookmark's `notes` field,
// which the Firestore rules already allow (max 2048 characters).

export interface CustomField {
  label: string;
  value: string;
}

export interface EvaluationNotes {
  partner: string;
  paymentTypes: string;
  bankCertificateAmount: string;
  bankGuaranteeAmount: string;
  customFields: CustomField[];
  remarks: string;
}

export const MAX_CUSTOM_FIELDS = 4;
/** Must stay at or below the Firestore rule limit for bookmark notes. */
export const MAX_NOTES_CHARS = 2000;

export const emptyNotes = (): EvaluationNotes => ({
  partner: '',
  paymentTypes: '',
  bankCertificateAmount: '',
  bankGuaranteeAmount: '',
  customFields: [],
  remarks: '',
});

/** Read stored notes. Older plain-text notes are kept as remarks instead of being lost. */
export function parseNotes(raw?: string): EvaluationNotes {
  if (!raw) return emptyNotes();
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return { ...emptyNotes(), remarks: raw };
  try {
    const j = JSON.parse(trimmed);
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      partner: str(j.partner),
      paymentTypes: str(j.paymentTypes),
      bankCertificateAmount: str(j.bankCertificateAmount),
      bankGuaranteeAmount: str(j.bankGuaranteeAmount),
      customFields: Array.isArray(j.customFields)
        ? j.customFields
            .filter((f: any) => f && typeof f === 'object')
            .map((f: any) => ({ label: str(f.label), value: str(f.value) }))
            .slice(0, MAX_CUSTOM_FIELDS)
        : [],
      remarks: str(j.remarks),
    };
  } catch {
    return { ...emptyNotes(), remarks: raw };
  }
}

/** Serialise notes for storage. Throws if the result would exceed the stored limit. */
export function serializeNotes(n: EvaluationNotes): string {
  const clean: EvaluationNotes = {
    partner: n.partner.trim().slice(0, 200),
    paymentTypes: n.paymentTypes.trim().slice(0, 200),
    bankCertificateAmount: n.bankCertificateAmount.trim().slice(0, 60),
    bankGuaranteeAmount: n.bankGuaranteeAmount.trim().slice(0, 60),
    customFields: n.customFields
      .slice(0, MAX_CUSTOM_FIELDS)
      .map((f) => ({ label: f.label.trim().slice(0, 60), value: f.value.trim().slice(0, 300) }))
      .filter((f) => f.label || f.value),
    remarks: n.remarks.trim().slice(0, 600),
  };
  const out = JSON.stringify(clean);
  if (out.length > MAX_NOTES_CHARS) {
    throw new Error('These notes are too long to save. Shorten the remarks or custom fields.');
  }
  return out;
}

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export interface CsvRow {
  refNumber: string;
  title: string;
  authority: string;
  portal: string;
  budget: string;
  currency: string;
  submissionDeadline: string;
  sourceUrl: string;
  notes: EvaluationNotes;
}

/** CSV that opens directly in Excel. Notes are flattened into named columns. */
export function buildFollowedCsv(rows: CsvRow[]): string {
  const header = [
    'Reference', 'Title', 'Authority', 'Portal', 'Estimated value', 'Currency', 'Deadline', 'Source link',
    'Partner', 'Payment types', 'Bank certificate amount', 'Bank guarantee amount',
    'Custom 1', 'Custom 2', 'Custom 3', 'Custom 4', 'Remarks',
  ];
  const lines = rows.map((r) => {
    const cf = [0, 1, 2, 3].map((i) => {
      const f = r.notes.customFields[i];
      return f ? `${f.label}: ${f.value}` : '';
    });
    return [
      r.refNumber, r.title, r.authority, r.portal, r.budget, r.currency, r.submissionDeadline, r.sourceUrl,
      r.notes.partner, r.notes.paymentTypes, r.notes.bankCertificateAmount, r.notes.bankGuaranteeAmount,
      ...cf, r.notes.remarks,
    ].map(csvCell).join(',');
  });
  return [header.map(csvCell).join(','), ...lines].join('\r\n');
}
