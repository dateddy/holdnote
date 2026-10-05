'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const noSubscription = () => () => {};
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** "Add to home screen": the browser prompt where it exists, a how-to on iOS Safari. */
export function InstallHint() {
  const t = useTranslations('pwa');
  // The server snapshot hides everything; the browser value takes over after hydration.
  const standalone = useSyncExternalStore(noSubscription, isStandalone, () => true);
  const ios = useSyncExternalStore(noSubscription, isIos, () => false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setJustInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (standalone || justInstalled) return null;
  if (prompt) {
    return (
      <button
        type="button"
        onClick={async () => {
          await prompt.prompt();
          setPrompt(null);
        }}
        className="h-12 rounded-md border border-current/20 text-base"
      >
        {t('install')}
      </button>
    );
  }
  if (ios) return <p className="text-sm opacity-70">{t('iosHint')}</p>;
  return null;
}
