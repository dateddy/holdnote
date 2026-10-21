'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const noSubscription = () => () => {};
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * "Cài app" in Settings: the browser prompt where it exists, a how-to on iOS Safari, a plain
 * note once the app is installed.
 */
export function InstallApp() {
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

  if (standalone || justInstalled) return <p className="text-sm">{t('installed')}</p>;
  if (prompt) {
    return (
      <Button
        variant="secondary"
        onClick={async () => {
          await prompt.prompt();
          setPrompt(null);
        }}
      >
        {t('install')}
      </Button>
    );
  }
  return <p className="text-sm text-muted">{ios ? t('iosHint') : t('otherHint')}</p>;
}
