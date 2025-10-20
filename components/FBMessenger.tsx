'use client';
import { useEffect } from 'react';

export default function FBMessenger({
  pageId,
  themeColor = '#44969b',
  minimized = true,
}: { pageId: string; themeColor?: string; minimized?: boolean }) {
  useEffect(() => {
    if (!pageId) return;

    // Ensure containers
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

    // REQUIRED: use data-* attributes
    chat.setAttribute('data-page_id', pageId);
    chat.setAttribute('data-attribution', 'biz_inbox');
    chat.setAttribute('data-theme_color', themeColor);
    chat.setAttribute('data-greeting_dialog_display', minimized ? 'hide' : 'show');

    // Load the **customer chat** SDK (not the generic sdk.js)
    const boot = () => {
      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: 'v19.0' });
        // Parse, then log events for visibility
        (window as any).FB?.XFBML.parse();
        (window as any).FB?.Event.subscribe('xfbml.render', () => console.log('[FB] xfbml.render'));
        (window as any).FB?.Event.subscribe('customerchat.load', () => console.log('[FB] customerchat.load'));
        (window as any).FB?.Event.subscribe('customerchat.show', () => console.log('[FB] customerchat.show'));
      };

      if (!document.getElementById('facebook-jssdk')) {
        const s = document.createElement('script');
        s.id = 'facebook-jssdk';
        s.async = true;
        s.defer = true;
        // IMPORTANT: use xfbml.customerchat.js here
        s.src = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
        document.body.appendChild(s);
      } else {
        (window as any).FB?.XFBML.parse();
      }
    };

    boot();
  }, [pageId, themeColor, minimized]);

  return null;
}
