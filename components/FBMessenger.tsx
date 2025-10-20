'use client';
import { useEffect } from 'react';

type Props = {
  pageId: string;                 // numeric FB Page ID
  themeColor?: string;            // eg '#44969b'
  minimized?: boolean;            // keep bubble minimized on load
};

// choose SDK by env: 'customer' on prod, generic everywhere else
const CHAT_MODE = process.env.NEXT_PUBLIC_FB_CHAT_MODE; // 'customer' on prod only
const SDK_CUSTOMER = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
const SDK_GENERIC  = 'https://connect.facebook.net/en_US/sdk.js';

export default function FBMessenger({
  pageId,
  themeColor = '#44969b',
  minimized = true,
}: Props) {
  useEffect(() => {
    if (!pageId) return;

    // Ensure containers exist (client-only)
    if (!document.getElementById('fb-root')) {
      const root = document.createElement('div');
      root.id = 'fb-root';
      document.body.appendChild(root);
    }
    let chat = document.getElementById('fb-customer-chat') as HTMLDivElement | null;
    if (!chat) {
      chat = document.createElement('div');
      chat.id = 'fb-customer-chat';
      chat.className = 'fb-customerchat';
      document.body.appendChild(chat);
    }

    // REQUIRED: data-* attributes (not page_id/theme_color)
    chat.setAttribute('data-page_id', pageId);
    chat.setAttribute('data-attribution', 'biz_inbox');
    chat.setAttribute('data-theme_color', themeColor);
    chat.setAttribute('data-greeting_dialog_display', minimized ? 'hide' : 'show');

    const load = (src: string, onErrorFallback?: () => void) => {
      // if FB already present, just parse
      if ((window as any).FB) {
        (window as any).FB.XFBML.parse();
        return;
      }

      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: 'v19.0' });
        (window as any).FB?.XFBML.parse();
      };

      const id = 'facebook-jssdk';
      let s = document.getElementById(id) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.id = id;
        s.async = true;
        s.defer = true;
        s.src = src;
        if (onErrorFallback) {
          s.onerror = () => {
            console.warn('[FB] SDK load failed, falling back to generic sdk.js');
            onErrorFallback();
          };
        }
        document.body.appendChild(s);
      }
    };

    // In production we try the Customer Chat SDK; if it 500s, fall back to generic.
    if (CHAT_MODE === 'customer') {
      load(SDK_CUSTOMER, () => load(SDK_GENERIC));
    } else {
      // preview/dev use generic SDK (more reliable on random preview hosts)
      load(SDK_GENERIC);
    }
  }, [pageId, themeColor, minimized]);

  return null;
}
