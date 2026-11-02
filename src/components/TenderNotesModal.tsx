import React, { useState } from 'react';
import { FileText, Plus, Trash2, X } from 'lucide-react';
import { Tender } from '../types';
import { EvaluationNotes, MAX_CUSTOM_FIELDS, serializeNotes } from '../services/tenderNotes';
import { generateTenderNotesPdf } from '../utils/exportTenderPdf';

interface Props {
  tender: Tender;
  initial: EvaluationNotes;
  onSave: (notes: EvaluationNotes) => Promise<void>;
  onClose: () => void;
}

const field = 'w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b2f]/40';

export const TenderNotesModal: React.FC<Props> = ({ tender, initial, onSave, onClose }) => {
  const [notes, setNotes] = useState<EvaluationNotes>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EvaluationNotes>(key: K, value: EvaluationNotes[K]) => setNotes((n) => ({ ...n, [key]: value }));

  const updateCustom = (i: number, patch: Partial<{ label: string; value: string }>) =>
    set('customFields', notes.customFields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const handleSave = async () => {
    setError(null);
    try {
      serializeNotes(notes); // validate length before the network call
    } catch (err: any) {
      setError(err.message);
      return;
    }
    setSaving(true);
    try {
      await onSave(notes);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save notes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Evaluation notes">
      <div className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#3f5724]">Evaluation notes</p>
            <h2 className="text-base font-extrabold text-stone-900 leading-snug">{tender.title}</h2>
            <p className="text-xs text-stone-500 mt-1">Saving also follows this tender.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-stone-100 shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="block"><span className="text-xs font-bold text-stone-600">Partner</span>
            <input className={field} value={notes.partner} onChange={(e) => set('partner', e.target.value)} placeholder="JV or sub-contractor" /></label>
          <label className="block"><span className="text-xs font-bold text-stone-600">Payment types accepted</span>
            <input className={field} value={notes.paymentTypes} onChange={(e) => set('paymentTypes', e.target.value)} placeholder="e.g. DD, e-payment, BG" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-bold text-stone-600">Bank certificate amount</span>
              <input className={field} value={notes.bankCertificateAmount} onChange={(e) => set('bankCertificateAmount', e.target.value)} /></label>
            <label className="block"><span className="text-xs font-bold text-stone-600">Bank guarantee amount</span>
              <input className={field} value={notes.bankGuaranteeAmount} onChange={(e) => set('bankGuaranteeAmount', e.target.value)} /></label>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Custom fields ({notes.customFields.length}/{MAX_CUSTOM_FIELDS})</span>
              {notes.customFields.length < MAX_CUSTOM_FIELDS && (
                <button type="button" onClick={() => set('customFields', [...notes.customFields, { label: '', value: '' }])}
                  className="text-xs font-bold text-[#3f5724] flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add field</button>
              )}
            </div>
            {notes.customFields.map((f, i) => (
              <div key={i} className="mt-2 grid grid-cols-[1fr_1.5fr_auto] gap-2 items-center">
                <input className={field} value={f.label} placeholder="Label" onChange={(e) => updateCustom(i, { label: e.target.value })} />
                <input className={field} value={f.value} placeholder="Value" onChange={(e) => updateCustom(i, { value: e.target.value })} />
                <button type="button" aria-label="Remove field" onClick={() => set('customFields', notes.customFields.filter((_, idx) => idx !== i))}
                  className="p-2 rounded-lg hover:bg-stone-100"><Trash2 className="w-4 h-4 text-stone-500" /></button>
              </div>
            ))}
          </div>

          <label className="block"><span className="text-xs font-bold text-stone-600">Remarks</span>
            <textarea className={`${field} min-h-[88px]`} value={notes.remarks} onChange={(e) => set('remarks', e.target.value)} /></label>
        </div>

        {error && <p className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button type="button"
            onClick={() => generateTenderNotesPdf({ refNumber: tender.refNumber, title: tender.title, authority: tender.authority, portal: tender.portal, budget: tender.budget, currency: tender.currency, submissionDeadline: tender.submissionDeadline, sourceUrl: (tender as any).sourceUrl }, notes)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Export PDF
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#4d6b2f] hover:bg-[#3f5724] text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Save & follow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
