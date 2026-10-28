import React from 'react';

interface PublicNavProps {
  onSignIn: () => void;
  onRegister: () => void;
}

export const PublicNav: React.FC<PublicNavProps> = ({ onSignIn, onRegister }) => (
  <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 pt-[env(safe-area-inset-top)]">
    <div className="max-w-7xl mx-auto h-14 sm:h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#4d6b2f] text-white flex items-center justify-center font-black">TD</div>
        <span className="text-lg font-extrabold tracking-tight text-stone-900">TenDo</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSignIn} className="h-10 px-4 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100">Sign in</button>
        <button onClick={onRegister} className="h-10 px-4 rounded-xl text-sm font-bold bg-[#4d6b2f] hover:bg-[#3f5724] text-white">Get started</button>
      </div>
    </div>
  </header>
);
