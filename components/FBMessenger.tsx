'use client';
import { useEffect } from 'react';

const SDK_CUSTOMER = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
const SDK_GENERIC  = 'https://connect.facebook.net/en_US/sdk.js';

function addScript(src: string, onload?: () => void, onerror?: () => void) {
  if (document.getElementById('facebook-jssdk')) return;
  const s = document.createElement('script');
  s.id = 'facebook-jssdk';
  s.async = true;
  s.defer = true;
  s.src = src;
  if (onload)  s.onload  = onload;
  if (onerror) s.onerror = onerror;
  document.body.appendChild(s);
}

export default function FBMessenger({
  pageId,
  themeColor = '#44969b',
  minimized = true,
}: { pageId: string; themeColor?: string; minimized?: boolean }) {

  useEffect(() => {
    if (!pageId) return;

    // where are we?
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const onProdHost = /(^|\.)wellserv\.co$/i.test(host);
    const preferCustomerSDK =
      onProdHost || process.env.NEXT_PUBLIC_FB_CHAT_MODE === 'customer';

    // containers
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

    // REQUIRED: data-* attributes
    chat.setAttribute('data-page_id', pageId);
    chat.setAttribute('data-attribution', 'biz_inbox');
    chat.setAttribute('data-theme_color', themeColor);
    chat.setAttribute('data-greeting_dialog_display', minimized ? 'hide' : 'show');

    // boot
    const afterInit = () => {
      try {
        (window as any).FB?.XFBML.parse();
        (window as any).FB?.Event.subscribe('xfbml.render', () => console.log('[FB] xfbml.render'));
        (window as any).FB?.Event.subscribe('customerchat.load', () => console.log('[FB] customerchat.load'));
        (window as any).FB?.Event.subscribe('customerchat.show', () => console.log('[FB] customerchat.show'));
      } catch (e) {
        console.warn('[FB] parse error', e);
      }
    };

    const init = () => {
      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: 'v19.0' });
        afterInit();
      };
    };

    // if FB already present, just parse
    if ((window as any).FB?.XFBML) {
      afterInit();
      return;
    }

    init();

    // try Customer Chat SDK on prod; fallback to generic if it fails
    if (preferCustomerSDK) {
      console.log('[FB] loading customerchat SDK…');
      addScript(
        SDK_CUSTOMER,
        () => console.log('[FB] customerchat SDK loaded'),
        () => {
          console.warn('[FB] customerchat SDK failed → falling back to generic sdk.js');
          addScript(SDK_GENERIC);
        }
      );
    } else {
      console.log('[FB] loading generic sdk.js (preview/dev)');
      addScript(SDK_GENERIC);
    }
  }, [pageId, themeColor, minimized]);

  return null;
}
