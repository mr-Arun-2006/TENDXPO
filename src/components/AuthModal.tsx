import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Building,
  Shield,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { emailPasswordSignIn, emailPasswordSignUp, googleSignIn } from '../services/firebase';
import { SectorType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onAuthSuccess: (user: User, token?: string | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('Apex Infrastructure & Tech Consortium Ltd.');
  const [primarySector, setPrimarySector] = useState<SectorType>('Civil Construction');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (!email || !password) {
          throw new Error('Please provide email and password');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        const user = await emailPasswordSignUp(email, password, displayName, companyName);
        onAuthSuccess(user, null);
        onClose();
      } else {
        if (!email || !password) {
          throw new Error('Please provide email and password');
        }
        const user = await emailPasswordSignIn(email, password);
        onAuthSuccess(user, null);
        onClose();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = err?.message || 'Authentication failed. Please check credentials.';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        msg = 'Invalid email or password. You can also use Quick Demo Sign-In.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'This email is already registered. Please switch to Sign In.';
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthSuccess(res.user, res.accessToken);
        onClose();
      }
      // If res is null, user simply closed or cancelled the popup without error
    } catch (err: any) {
      const errorCode = err?.code || '';
      if (
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request' ||
        errorCode === 'auth/user-cancelled'
      ) {
        // User closed or cancelled popup
        return;
      }
      if (errorCode === 'auth/popup-blocked') {
        setErrorMessage('Sign-in popup was blocked by browser. Please allow popups or use One-Click Demo Sign-In.');
        return;
      }
      console.error('Google Sign-In failed:', err);
      setErrorMessage(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoSignIn = () => {
    setIsLoading(true);
    setTimeout(() => {
      const mockUser = {
        uid: 'demo_estimator_uid',
        email: 'arunkumarak5808@gmail.com',
        displayName: 'Arun Kumar (Chief Estimator)',
        photoURL: '',
        emailVerified: true,
      } as unknown as User;
      onAuthSuccess(mockUser, 'demo_access_token');
      setIsLoading(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-[#4d6b2f] p-6 text-white text-left relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold tracking-wider uppercase mb-2">
            <Shield className="w-3 h-3" />
            <span>Secure Firebase Authentication</span>
          </div>
          <h3 className="text-xl font-black">
            {mode === 'login' ? 'Welcome Back to TenDo' : 'Create Your TenDo Account'}
          </h3>
          <p className="text-xs text-stone-100 opacity-90 mt-1">
            {mode === 'login'
              ? 'Access real-time official tender feeds and automated BOQ models'
              : 'Set up your contractor profile to receive automated sector alerts'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-bold transition border-b-2 ${
              mode === 'login'
                ? 'border-[#4d6b2f] text-[#3f5724] bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-bold transition border-b-2 ${
              mode === 'register'
                ? 'border-[#4d6b2f] text-[#3f5724] bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Register Profile
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold text-xs flex items-center justify-center gap-2.5 transition shadow-2xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google Workspace</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-stone-200" />
            <span className="text-[10px] text-stone-400 uppercase font-bold">Or with Email</span>
            <div className="flex-1 border-t border-stone-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Arun Kumar"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#4d6b2f]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Company / Contractor Name</label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Infrastructure Consortium"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#4d6b2f]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Primary Target Sector</label>
                  <select
                    value={primarySector}
                    onChange={(e) => setPrimarySector(e.target.value as SectorType)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#4d6b2f] bg-white"
                  >
                    <option value="Civil Construction">Civil Construction (Buildings, CPWD, PWD)</option>
                    <option value="Roads & Highways">Roads & Highways (NHAI, State Expressways)</option>
                    <option value="Renewable Energy">Renewable Energy (Solar, SECI)</option>
                    <option value="IT & Cloud">IT & Cloud (State Portals, Smart Cities)</option>
                    <option value="Healthcare & MedTech">Healthcare & MedTech (AIIMS, Hospitals)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. arunkumarak5808@gmail.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#4d6b2f]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#4d6b2f]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-xs shadow-md shadow-[#4d6b2f]/20 transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>{isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account & Enable Alerts'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Access Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleQuickDemoSignIn}
              disabled={isLoading}
              className="w-full py-2 px-3 rounded-xl bg-[#4d6b2f]/10 hover:bg-[#4d6b2f]/15 border border-[#4d6b2f]/30 text-[#3f5724] text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>One-Click Demo Access (Arun Kumar - Chief Estimator)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
