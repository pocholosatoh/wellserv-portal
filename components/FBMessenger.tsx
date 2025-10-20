'use client';
import { useEffect } from 'react';

export default function FBMessenger({
  pageId,
  themeColor = '#44969b',
  minimized = true,
}: { pageId: string; themeColor?: string; minimized?: boolean }) {
  useEffect(() => {
    if (!pageId) return;

    // 1) Ensure containers exist client-side
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

    // 2) REQUIRED: data-* attributes (not page_id/theme_color)
    chat.setAttribute('data-page_id', pageId);
    chat.setAttribute('data-attribution', 'biz_inbox');
    chat.setAttribute('data-theme_color', themeColor);
    chat.setAttribute('data-greeting_dialog_display', minimized ? 'hide' : 'show');

    // 3) Load SDK then parse + force show
    const afterFBReady = () => {
      try {
        (window as any).FB.XFBML.parse();
        (window as any).FB.Event.subscribe('xfbml.render', () => {
          console.log('[FB] xfbml.render');
          // Attempt to force show the bubble (keeps it minimized by default UI)
          try {
            (window as any).FB.CustomerChat.show(false);
            console.log('[FB] CustomerChat.show(false) called');
          } catch (e) {
            console.warn('[FB] CustomerChat.show error', e);
          }
        });
        (window as any).FB.Event.subscribe('customerchat.load', () => console.log('[FB] customerchat.load'));
        (window as any).FB.Event.subscribe('customerchat.show', () => console.log('[FB] customerchat.show'));
        (window as any).FB.Event.subscribe('customerchat.hide', () => console.log('[FB] customerchat.hide'));
      } catch (e) {
        console.warn('[FB] parse error', e);
      }
    };

    if ((window as any).FB) {
      afterFBReady();
    } else {
      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: 'v19.0' });
        afterFBReady();
      };
      if (!document.getElementById('facebook-jssdk')) {
        const s = document.createElement('script');
        s.id = 'facebook-jssdk';
        s.async = true; s.defer = true;
        s.src = 'https://connect.facebook.net/en_US/sdk.js';
        document.body.appendChild(s);
      }
    }
  }, [pageId, themeColor, minimized]);

  return null;
}
