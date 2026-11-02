import { jsPDF } from 'jspdf';
import type { EvaluationNotes } from '../services/tenderNotes';

export interface PdfTender {
  refNumber: string;
  title: string;
  authority: string;
  portal: string;
  budget: number;
  currency: string;
  submissionDeadline: string;
  sourceUrl?: string;
}

/** One-page tender summary with evaluation notes. Uses plain currency codes (the PDF font has no ₹ glyph). */
export function generateTenderNotesPdf(t: PdfTender, notes: EvaluationNotes): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  const width = 180;
  let y = 20;

  const write = (text: string, size = 10, bold = false, gap = 6) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text || '-', width);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += gap;
    }
  };

  write('Tender evaluation notes', 16, true, 9);
  write(t.title, 12, true, 7);
  write(`Reference: ${t.refNumber}`);
  write(`Authority: ${t.authority}`);
  write(`Portal: ${t.portal}`);
  write(`Estimated value (as stated in notice): ${t.budget > 0 ? `${t.currency} ${t.budget.toLocaleString('en-IN')}` : 'Not stated'}`);
  write(`Deadline: ${t.submissionDeadline || 'Not stated'}`);
  if (t.sourceUrl) write(`Source: ${t.sourceUrl}`);

  y += 4;
  write('Evaluation notes', 12, true, 7);
  write(`Partner: ${notes.partner || '-'}`);
  write(`Payment types: ${notes.paymentTypes || '-'}`);
  write(`Bank certificate amount: ${notes.bankCertificateAmount || '-'}`);
  write(`Bank guarantee amount: ${notes.bankGuaranteeAmount || '-'}`);
  notes.customFields.forEach((f) => write(`${f.label || 'Custom'}: ${f.value || '-'}`));
  y += 2;
  write('Remarks', 10, true);
  write(notes.remarks || '-');

  y += 6;
  write('Generated from the notice and your own notes. Verify on the official portal before bidding.', 8);

  const safe = (t.refNumber || 'tender').replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`${safe}_notes.pdf`);
}
