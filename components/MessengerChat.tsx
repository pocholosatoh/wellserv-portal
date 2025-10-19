'use client';

import { useEffect } from 'react';

type Props = {
  pageId: string;           // e.g. process.env.NEXT_PUBLIC_FB_PAGE_ID
  themeColor?: string;      // hex color for the bubble, e.g. '#44969b'
  greeting?: string;        // optional greeting
};

export default function MessengerChat({ pageId, themeColor = '#44969b', greeting }: Props) {
  useEffect(() => {
    // Create the chatbox container if it doesn't exist
    const chatboxId = 'fb-customer-chat';
    if (!document.getElementById(chatboxId)) {
      const div = document.createElement('div');
      div.id = chatboxId;
      div.className = 'fb-customerchat';
      document.body.appendChild(div);
    }

    // Set attributes required by the plugin
    const chatbox = document.getElementById(chatboxId);
    chatbox?.setAttribute('page_id', pageId);
    chatbox?.setAttribute('attribution', 'biz_inbox');
    chatbox?.setAttribute('logged_in_greeting', 'Hi! How can we help?');
    if (themeColor) chatbox?.setAttribute('theme_color', themeColor);
    if (greeting) chatbox?.setAttribute('greeting_dialog_display', 'show');
    // greeting_dialog_delay can be 0, 5, 10, etc.
    // chatbox?.setAttribute('greeting_dialog_delay', '5');

    // Load the SDK once
    if (!(window as any).fbAsyncInit) {
      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({
          xfbml: true,
          version: 'v19.0', // use current Graph version your Page supports
        });
      };

      // Insert SDK script
      const id = 'facebook-jssdk';
      if (!document.getElementById(id)) {
        const js = document.createElement('script');
        js.id = id;
        js.src = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
        js.async = true;
        document.body.appendChild(js);
      }
    } else {
      // If already loaded, just parse again
      (window as any).FB?.XFBML?.parse();
    }
  }, [pageId, themeColor, greeting]);

  // Required root element for the SDK
  return <div id="fb-root" />;
}
