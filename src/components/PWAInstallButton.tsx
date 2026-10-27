import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Check } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4d6b2f]/10 border border-[#4d6b2f]/30 text-[#3f5724] text-xs font-semibold">
        <Check className="w-3.5 h-3.5" />
        <span>PWA Installed</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition active:scale-95"
        title="Install TenDo app to your home screen or desktop"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-xl border border-[#4d6b2f]/30 bg-[#4d6b2f]/10 hover:bg-[#4d6b2f]/20 px-3 py-1.5 text-xs font-semibold text-[#3f5724] transition"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-stone-200 p-6 shadow-2xl text-stone-900">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#4d6b2f]" />
                  <h3 className="font-bold text-stone-900">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4d6b2f]/15 text-[#4d6b2f] text-xs font-bold shrink-0 mt-0.5">1</span>
                  <span>Tap the <strong>Share button</strong> in the bottom toolbar of Safari.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4d6b2f]/15 text-[#4d6b2f] text-xs font-bold shrink-0 mt-0.5">2</span>
                  <span>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4d6b2f]/15 text-[#4d6b2f] text-xs font-bold shrink-0 mt-0.5">3</span>
                  <span>Tap <strong>Add</strong> in the top-right corner to launch TenDo directly from your phone.</span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] py-2.5 text-sm font-bold text-white transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Default button for demo/test environments
  return (
    <button
      onClick={() => alert('To install TenDo, use Chrome / Edge / Safari and click "Install app" in your browser address bar or menu.')}
      className="hidden sm:flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 px-3 py-1.5 text-xs font-medium transition"
      title="PWA ready for offline caching and installation"
    >
      <Download className="w-3.5 h-3.5 text-[#4d6b2f]" />
      <span>Install PWA</span>
    </button>
  );
};
