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

    // Use data-* attributes (required by FB)
    chat.setAttribute('data-page_id', pageId);
    chat.setAttribute('data-attribution', 'biz_inbox');
    chat.setAttribute('data-theme_color', themeColor);
    chat.setAttribute('data-greeting_dialog_display', minimized ? 'hide' : 'show');

    // Load the general SDK (reliable)
    if (!(window as any).FB) {
      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: 'v19.0' });
        (window as any).FB?.XFBML.parse();
      };
      if (!document.getElementById('facebook-jssdk')) {
        const s = document.createElement('script');
        s.id = 'facebook-jssdk';
        s.async = true;
        s.defer = true;
        s.src = 'https://connect.facebook.net/en_US/sdk.js';
        document.body.appendChild(s);
      }
    } else {
      (window as any).FB.XFBML.parse();
    }
  }, [pageId, themeColor, minimized]);

  return null;
}
