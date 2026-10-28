import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import { apiJson } from '../services/api';
import { Tender } from '../types';
import { useTranslation } from '../context/LanguageContext';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

interface AssistantChatProps {
  tender: Tender | null;
}

const SUGGESTIONS = [
  'What is EMD and how is it refunded?',
  'Explain the eligibility criteria of this tender in simple words',
  'What documents do I need for a CPPP technical bid?',
  'How should I price to be L1 without losing margin?',
];

export const AssistantChat: React.FC<AssistantChatProps> = ({ tender }) => {
  const { language } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: 'user', text: content }];
    setMessages(next);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const data = await apiJson<{ reply: string }>('/api/gemini/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: next, tenderId: tender?.id, language }),
      });
      setMessages([...next, { role: 'assistant', text: data.reply || '(No response)' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the assistant.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col h-[calc(100dvh-9.5rem)] lg:h-[calc(100dvh-8rem)] rounded-3xl bg-white border border-stone-200 overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-stone-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-extrabold text-stone-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4d6b2f]" /> TenDo Assistant
          </h2>
          <p className="text-xs text-stone-500 truncate">
            {tender ? `Context: ${tender.refNumber} (${tender.dataSource === 'live-ted' ? 'official TED notice' : 'sample data'})` : 'General procurement help. Select a tender for tender-specific answers.'}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => { setMessages([]); setError(null); }}
            className="h-9 px-3 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-100 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="max-w-xl mx-auto text-center pt-6">
            <p className="text-sm text-stone-600">
              Ask about tender terms, eligibility, BOQ or bid strategy. Answers are AI-generated: confirm anything important on the official portal.
            </p>
            <div className="mt-4 grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 hover:border-[#4d6b2f] hover:bg-[#4d6b2f]/5 text-stone-700 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                m.role === 'user' ? 'bg-[#4d6b2f] text-white rounded-br-md' : 'bg-stone-100 text-stone-900 rounded-bl-md'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-stone-100 text-stone-500 text-sm">Thinking…</div>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-3 border-t border-stone-200 flex items-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Ask a question…"
          className="flex-1 resize-none max-h-32 min-h-11 px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b2f]/40 focus:border-[#4d6b2f]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="h-11 w-11 shrink-0 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white flex items-center justify-center disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </section>
  );
};
