'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ERRORS = ['key_rejected', 'bad_request', 'offline', 'unauthorized', 'server_error'] as const;
import { INPUT_CLASS as INPUT } from '@/components/ui/input';

type Props = { hasKey: boolean; model: string | null };

/** Own OpenRouter key: sent once to the server, which keeps it in Vault. Never shown again. */
export function AiKeyForm({ hasKey, model }: Props) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(model ?? '');
  const [status, setStatus] = useState<'idle' | 'busy' | 'saved' | 'removed' | string>('idle');

  async function send(method: 'PUT' | 'DELETE') {
    setStatus('busy');
    try {
      const res = await fetch('/api/settings/ai', {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'PUT' ? JSON.stringify({ api_key: apiKey, model: modelId }) : undefined,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus(`error:${body?.error ?? 'server_error'}`);
        return;
      }
      setApiKey('');
      setStatus(method === 'PUT' ? 'saved' : 'removed');
      router.refresh();
    } catch {
      setStatus('error:offline');
    }
  }

  const error = status.startsWith('error:') ? status.slice(6) : null;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {t('apiKey')}
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          placeholder={hasKey ? t('apiKeySet') : 'sk-or-…'}
          onChange={(e) => {
            setStatus('idle');
            setApiKey(e.target.value);
          }}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('model')}
        <input
          value={modelId}
          placeholder={t('modelDefault')}
          onChange={(e) => {
            setStatus('idle');
            setModelId(e.target.value);
          }}
          className={INPUT}
        />
      </label>

      {status === 'saved' && (
        <p role="status" className="text-sm">
          {t('keySaved')}
        </p>
      )}
      {status === 'removed' && (
        <p role="status" className="text-sm">
          {t('keyRemoved')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-loss">
          {t(`error_${ERRORS.find((e) => e === error) ?? 'server_error'}`)}
        </p>
      )}

      <button
        type="button"
        disabled={status === 'busy' || apiKey.trim().length < 10}
        onClick={() => send('PUT')}
        className="h-12 rounded-xl bg-accent text-base font-medium text-accent-foreground disabled:opacity-40"
      >
        {status === 'busy' ? t('saving') : t('saveKey')}
      </button>
      {hasKey && (
        <button
          type="button"
          disabled={status === 'busy'}
          onClick={() => send('DELETE')}
          className="h-12 rounded-xl border border-line bg-surface text-base disabled:opacity-40"
        >
          {t('removeKey')}
        </button>
      )}
    </div>
  );
}
