'use client';
import { useEffect } from 'react';

type Props = {
  pageId: string;
  themeColor?: string;
  minimized?: boolean;
};

export default function FBMessenger({
  pageId,
  themeColor = '#44969b',
  minimized = true,
}: Props) {
  useEffect(() => {
    if (!pageId) {
      console.warn('[FB] missing pageId');
      return;
    }

    // 1) Ensure required containers exist
    let root = document.getElementById('fb-root');
    if (!root) {
      root = document.createElement('div');
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

    // 2) Set required attributes
    chat.setAttribute('page_id', pageId);
    chat.setAttribute('attribution', 'biz_inbox');
    chat.setAttribute('theme_color', themeColor);
    chat.setAttribute('greeting_dialog_display', minimized ? 'hide' : 'show');

    // 3) Load SDK if needed
    const loadSDK = () => {
      if ((window as any).FB) {
        try {
          (window as any).FB.XFBML.parse();
          (window as any).FB.Event.subscribe('xfbml.render', () =>
            console.log('[FB] xfbml.render')
          );
          (window as any).FB.Event.subscribe('customerchat.load', () =>
            console.log('[FB] customerchat.load')
          );
          (window as any).FB.Event.subscribe('customerchat.show', () =>
            console.log('[FB] customerchat.show')
          );
          (window as any).FB.Event.subscribe('customerchat.hide', () =>
            console.log('[FB] customerchat.hide')
          );
        } catch (e) {
          console.warn('[FB] parse error', e);
        }
        return;
      }

      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: 'v19.0' });
        loadSDK(); // parse & subscribe after init
      };

      if (!document.getElementById('facebook-jssdk')) {
        const s = document.createElement('script');
        s.id = 'facebook-jssdk';
        s.async = true;
        s.defer = true;
        s.src = 'https://connect.facebook.net/en_US/sdk.js';
        document.body.appendChild(s);
      }
    };

    loadSDK();
  }, [pageId, themeColor, minimized]);

  return null;
}
