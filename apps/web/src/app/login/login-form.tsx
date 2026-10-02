'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function LoginForm({ next }: { next: string }) {
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
      options: { emailRedirectTo: callbackUrl() },
    });
    setStatus(error ? 'error' : 'sent');
  }

  if (status === 'sent') {
    return (
      <p className="rounded-md bg-green-500/10 p-4 text-center text-sm">
        Đã gửi link đăng nhập tới <b>{email}</b>. Mở email và bấm vào link.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={signInWithGoogle}
        className="h-12 rounded-md border border-current/20 font-medium"
      >
        Đăng nhập bằng Google
      </button>

      <div className="flex items-center gap-3 text-xs opacity-60">
        <span className="h-px flex-1 bg-current/20" />
        hoặc
        <span className="h-px flex-1 bg-current/20" />
      </div>

      <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-md border border-current/20 bg-transparent px-3 text-base"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="h-12 rounded-md bg-foreground font-medium text-background disabled:opacity-50"
        >
          {status === 'sending' ? 'Đang gửi…' : 'Gửi link đăng nhập'}
        </button>
      </form>

      {status === 'error' && (
        <p role="alert" className="text-center text-sm text-red-600">
          Không gửi được. Kiểm tra email rồi thử lại.
        </p>
      )}
    </div>
  );
}
