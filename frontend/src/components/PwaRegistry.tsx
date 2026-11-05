'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export function PwaRegistry() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 0. Automatically inject 'ngrok-skip-browser-warning' on any fetch call targeting an ngrok tunnel
    const origFetch = window.fetch;
    if (!(window as any).__reachNgrokPatched) {
      (window as any).__reachNgrokPatched = true;
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (urlStr.includes('ngrok')) {
          const headers = new Headers(init?.headers || {});
          headers.set('ngrok-skip-browser-warning', 'true');
          return origFetch(input, { ...init, headers });
        }
        return origFetch(input, init);
      };
    }

    // 1. Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // 2. Listen for Android/Desktop Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const dismissed = sessionStorage.getItem('reach_pwa_dismissed');
      if (!dismissed) {
        setDeferredPrompt(e);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Detect iPhone / iPad Safari when not already installed in standalone mode
    const isIos =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !(window.navigator as any).standalone &&
      !window.matchMedia('(display-mode: standalone)').matches;

    const iosDismissed = localStorage.getItem('reach_ios_pwa_dismissed');
    if (isIos && !iosDismissed) {
      const timer = setTimeout(() => setShowIosGuide(true), 3500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const dismissAndroid = () => {
    sessionStorage.setItem('reach_pwa_dismissed', '1');
    setDeferredPrompt(null);
  };

  const dismissIos = () => {
    localStorage.setItem('reach_ios_pwa_dismissed', '1');
    setShowIosGuide(false);
  };

  if (!deferredPrompt && !showIosGuide) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-6 sm:right-auto sm:w-[360px] z-40 bg-[#202222]/95 backdrop-blur-md border border-[#53b8bb]/40 rounded-2xl p-4 shadow-2xl">
      <button
        onClick={deferredPrompt ? dismissAndroid : dismissIos}
        className="absolute top-3 right-3 p-1 rounded-full text-[#8e9293] hover:text-white transition"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-5">
        <img
          src="/apple-touch-icon.png"
          alt="Reach News App"
          className="w-11 h-11 rounded-xl border border-white/10 shrink-0"
        />
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-[#ececec]">
            Instalar App Reach News
          </h4>
          {deferredPrompt ? (
            <>
              <p className="text-[11px] text-[#9ba0a1] mt-0.5 leading-snug">
                Adicione o Reach News à sua tela inicial para abrir em tela cheia como aplicativo.
              </p>
              <button
                onClick={handleInstallClick}
                className="mt-2.5 px-3.5 py-1.5 rounded-full bg-[#53b8bb] text-[#111313] font-semibold text-[11px] inline-flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                <span>Instalar Aplicativo</span>
              </button>
            </>
          ) : (
            <p className="text-[11px] text-[#9ba0a1] mt-1 leading-relaxed">
              No iPhone, toque em{' '}
              <span className="inline-flex items-center gap-0.5 text-[#53b8bb] font-medium">
                <Share className="w-3 h-3 inline" /> Compartilhar
              </span>{' '}
              na barra do Safari e selecione{' '}
              <span className="inline-flex items-center gap-0.5 text-[#ececec] font-medium">
                <PlusSquare className="w-3 h-3 inline text-[#53b8bb]" /> Adicionar à Tela de Início
              </span>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
