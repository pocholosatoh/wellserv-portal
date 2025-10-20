'use client';
import { useEffect } from 'react';

type Props = {
  pageId: string;          // your numeric FB Page ID
  themeColor?: string;     // e.g. "#44969b"
  minimized?: boolean;     // keep bubble minimized on load
};

export default function FBMessenger({
  pageId,
  themeColor = '#44969b',
  minimized = true,
}: Props) {
  useEffect(() => {
    if (!pageId) return;

    // Create required containers (client-only)
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

    chat.setAttribute('page_id', pageId);
    chat.setAttribute('attribution', 'biz_inbox');
    chat.setAttribute('theme_color', themeColor);
    chat.setAttribute('greeting_dialog_display', minimized ? 'hide' : 'show');

    // Load the general FB SDK (avoids CORS issues)
    if (!(window as any).FB) {
      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: 'v19.0' });
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
      (window as any).FB?.XFBML?.parse();
    }
  }, [pageId, themeColor, minimized]);

  return null; // render nothing on the server
}
