'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Google Sign-In via Google Identity Services.
 *
 * GIS hands back an ID token straight to this callback, which we POST to
 * /api/auth/google. No redirect, no callback URL, and nothing that sends the
 * user off to another page to finish signing in.
 *
 * Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID. If it is missing the component says so
 * out loud rather than rendering a button that silently does nothing, because a
 * dead sign-in button at the last step before payment is the worst place in the
 * product to have a mystery.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: {
            client_id: string;
            callback: (r: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SRC = 'https://accounts.google.com/gsi/client';

export function GoogleSignIn({
  onToken,
  disabled = false,
}: {
  onToken: (idToken: string) => void;
  disabled?: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unconfigured' | 'failed'>('loading');
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      setState('unconfigured');
      return;
    }

    function render() {
      const gis = window.google?.accounts.id;
      if (!gis || !holder.current) return setState('failed');
      gis.initialize({
        client_id: clientId!,
        callback: (r) => r.credential && onToken(r.credential),
      });
      gis.renderButton(holder.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 320,
      });
      setState('ready');
    }

    if (window.google?.accounts?.id) return render();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.src = SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    script.addEventListener('error', () => setState('failed'));
    return () => script.removeEventListener('load', render);
  }, [clientId, onToken]);

  if (state === 'unconfigured') {
    return (
      <p className="rounded-xl border-2 border-red-900 bg-red-950/20 p-3 font-mono text-xs text-red-500">
        Google sign-in is not configured: set NEXT_PUBLIC_GOOGLE_CLIENT_ID. Use
        email and password below in the meantime.
      </p>
    );
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
      <div ref={holder} className="flex justify-center" />
      {state === 'loading' && (
        <p className="text-center font-mono text-xs text-zinc-500">loading Google…</p>
      )}
      {state === 'failed' && (
        <p className="font-mono text-xs text-red-500">
          Google sign-in could not load. Use email and password below.
        </p>
      )}
    </div>
  );
}
