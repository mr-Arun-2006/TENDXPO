import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Building, User as UserIcon, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User } from 'firebase/auth';
import {
  authErrorMessage,
  emailPasswordSignIn,
  emailPasswordSignUp,
  googleSignIn,
  sendPasswordReset,
} from '../services/firebase';
import { SectorType } from '../types';

export type AuthMode = 'login' | 'register';

interface AuthPageProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: (user: User) => void;
  onBack: () => void;
}

const SECTORS: SectorType[] = [
  'Civil Construction',
  'Roads & Highways',
  'Renewable Energy',
  'IT & Cloud',
  'Healthcare & MedTech',
  'Logistics & Defense',
];

const inputCls =
  'w-full pl-10 pr-3 h-11 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#4d6b2f]/40 focus:border-[#4d6b2f]';

export const AuthPage: React.FC<AuthPageProps> = ({ mode, onModeChange, onSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState<SectorType>('Civil Construction');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const switchMode = (m: AuthMode) => {
    setError(null);
    setInfo(null);
    onModeChange(m);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (isRegister && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const user = isRegister
        ? await emailPasswordSignUp(email, password, displayName.trim(), companyName.trim(), sector)
        : await emailPasswordSignIn(email, password);
      onSuccess(user);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const user = await googleSignIn();
      if (user) onSuccess(user);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError('Enter your email above, then choose "Forgot password".');
      return;
    }
    try {
      await sendPasswordReset(email);
      setInfo('If an account exists for that email, a reset link has been sent.');
    } catch (err) {
      const msg = authErrorMessage(err);
      // Do not reveal whether an account exists.
      if ((err as { code?: string })?.code === 'auth/user-not-found') {
        setInfo('If an account exists for that email, a reset link has been sent.');
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-stone-50">
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex lg:w-[42%] xl:w-[38%] bg-[#3f5724] text-white p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center font-black text-xl">TD</div>
            <span className="text-2xl font-extrabold tracking-tight">TenDo</span>
          </div>
          <h2 className="mt-16 text-4xl font-black leading-tight">
            Government tender intelligence you can verify.
          </h2>
          <p className="mt-4 text-white/80 leading-relaxed max-w-md">
            Track notices from official portals, estimate your bid with commodity-aware costing, and get AI explanations that point you back to the source.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-white/85">
          <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Sign-in secured by Firebase Authentication</li>
          <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Your data is private to your account</li>
          <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Every notice shows its data source</li>
        </ul>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex flex-col px-4 sm:px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onBack}
          className="self-start inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-stone-900 h-10"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </button>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#4d6b2f] text-white flex items-center justify-center font-black">TD</div>
              <span className="text-xl font-extrabold text-stone-900">TenDo</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-stone-900">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-sm text-stone-600">
              {isRegister
                ? 'Set up your contractor profile to get sector alerts and AI bid support.'
                : 'Sign in to open your tender workspace.'}
            </p>

            <div role="tablist" className="mt-6 grid grid-cols-2 p-1 rounded-xl bg-stone-200/70">
              {(['login', 'register'] as AuthMode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`h-10 rounded-lg text-sm font-bold transition ${
                    mode === m ? 'bg-white text-[#3f5724] shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            <div aria-live="polite" className="mt-4 space-y-2">
              {error && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {info && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{info}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={google}
              disabled={busy}
              className="mt-4 w-full h-11 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 font-bold text-sm flex items-center justify-center gap-2.5 transition disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-stone-400">
              <span className="flex-1 border-t border-stone-200" /> or with email <span className="flex-1 border-t border-stone-200" />
            </div>

            <form onSubmit={submit} className="space-y-3.5" noValidate={false}>
              {isRegister && (
                <>
                  <Field label="Full name" icon={<UserIcon className="w-4 h-4" />}>
                    <input className={inputCls} required autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                  </Field>
                  <Field label="Company / contractor name" icon={<Building className="w-4 h-4" />}>
                    <input className={inputCls} required autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your company" />
                  </Field>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1" htmlFor="sector">Primary sector</label>
                    <select
                      id="sector"
                      value={sector}
                      onChange={(e) => setSector(e.target.value as SectorType)}
                      className="w-full h-11 px-3 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4d6b2f]/40 focus:border-[#4d6b2f]"
                    >
                      {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}

              <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                <input className={inputCls} type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </Field>

              <Field label="Password" icon={<Lock className="w-4 h-4" />}>
                <input
                  className={`${inputCls} pr-11`}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={isRegister ? 8 : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1 w-9 h-9 flex items-center justify-center text-stone-500 hover:text-stone-800"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>

              {!isRegister && (
                <div className="text-right">
                  <button type="button" onClick={forgot} className="text-xs font-bold text-[#3f5724] hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-12 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
                {!busy && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-stone-600">
              {isRegister ? 'Already registered?' : 'New to TenDo?'}{' '}
              <button type="button" onClick={() => switchMode(isRegister ? 'login' : 'register')} className="font-bold text-[#3f5724] hover:underline">
                {isRegister ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

const Field: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <label className="block">
    <span className="block text-xs font-bold text-stone-700 mb-1">{label}</span>
    <span className="relative block">
      <span className="absolute left-3.5 top-3.5 text-stone-400 pointer-events-none">{icon}</span>
      {children}
    </span>
  </label>
);
