'use client';

import { useEffect } from 'react';

type Props = {
  pageId: string;
  themeColor?: string;
  minimized?: boolean; // keep bubble minimized on load
};

export default function MessengerChat({ pageId, themeColor = '#44969b', minimized = true }: Props) {
  useEffect(() => {
    if (!pageId) {
      console.warn('MessengerChat: missing pageId');
      return;
    }

    // Root required by Facebook
    if (!document.getElementById('fb-root')) {
      const root = document.createElement('div');
      root.id = 'fb-root';
      document.body.appendChild(root);
    }

    // Chatbox container
    let chatbox = document.getElementById('fb-customer-chat') as HTMLDivElement | null;
    if (!chatbox) {
      chatbox = document.createElement('div');
      chatbox.id = 'fb-customer-chat';
      chatbox.className = 'fb-customerchat';
      document.body.appendChild(chatbox);
    }

    // Required attributes
    chatbox.setAttribute('page_id', pageId);
    chatbox.setAttribute('attribution', 'biz_inbox');
    chatbox.setAttribute('theme_color', themeColor);
    chatbox.setAttribute('greeting_dialog_display', minimized ? 'hide' : 'show');

    // Load SDK once
    if (!(window as any).fbAsyncInit) {
      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: 'v19.0' });
      };
      const id = 'facebook-jssdk';
      if (!document.getElementById(id)) {
        const js = document.createElement('script');
        js.id = id;
        js.async = true;
        js.crossOrigin = 'anonymous';
        js.src = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
        document.body.appendChild(js);
      }
    } else {
      // SDK exists → parse again (e.g., on route changes)
      (window as any).FB?.XFBML?.parse();
    }
  }, [pageId, themeColor, minimized]);

  return null;
}
