'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('login');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
    if (error) setStatus('error');
  }

  async function sendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // `locale` becomes user metadata, which the profile trigger reads for new accounts.
      options: { emailRedirectTo: callbackUrl(), data: { locale } },
    });
    setStatus(error ? 'error' : 'sent');
  }

  if (status === 'sent') {
    return (
      <p className="rounded-md bg-win/10 p-4 text-center text-sm">
        {t.rich('sent', { email, b: (chunks) => <b>{chunks}</b> })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={signInWithGoogle}
        className="h-12 rounded-md border border-line bg-surface font-medium"
      >
        {t('google')}
      </button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        {t('or')}
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('email')}
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-md border border-line bg-surface px-3 text-base"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="h-12 rounded-md bg-accent font-medium text-accent-foreground disabled:opacity-50"
        >
          {status === 'sending' ? t('sending') : t('sendLink')}
        </button>
      </form>

      {status === 'error' && (
        <p role="alert" className="text-center text-sm text-loss">
          {t('sendFailed')}
        </p>
      )}
    </div>
  );
}
