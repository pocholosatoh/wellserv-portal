"use client";
import { useEffect } from "react";

const SDK_CUSTOMER = "https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js";
const SDK_GENERIC = "https://connect.facebook.net/en_US/sdk.js";

function addScript(src: string, onload?: () => void, onerror?: () => void) {
  // ensure single insertion
  const id = "facebook-jssdk";
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.defer = true;
  s.src = src;
  if (onload) s.onload = onload;
  if (onerror) s.onerror = onerror;
  document.body.appendChild(s);
}

export default function FBMessenger({
  pageId,
  themeColor = "#44969b",
  minimized = true,
}: {
  pageId: string;
  themeColor?: string;
  minimized?: boolean;
}) {
  useEffect(() => {
    if (!pageId) return;

    // host check: treat wellserv.co as production for bubble attempts
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const onProdHost = /(^|\.)wellserv\.co$/i.test(host);

    // required containers
    if (!document.getElementById("fb-root")) {
      const root = document.createElement("div");
      root.id = "fb-root";
      document.body.appendChild(root);
    }
    let chat = document.getElementById("fb-customer-chat") as HTMLDivElement | null;
    if (!chat) {
      chat = document.createElement("div");
      chat.id = "fb-customer-chat";
      chat.className = "fb-customerchat";
      document.body.appendChild(chat);
    }

    // set data-* attributes (FB requires data- prefix)
    chat.setAttribute("data-page_id", pageId);
    chat.setAttribute("data-attribution", "biz_inbox");
    chat.setAttribute("data-theme_color", themeColor);
    chat.setAttribute("data-greeting_dialog_display", minimized ? "hide" : "show");

    // init + parse when FB is ready
    const boot = () => {
      (window as any).fbAsyncInit = function () {
        (window as any).FB?.init({ xfbml: true, version: "v19.0" });
        (window as any).FB?.XFBML.parse();
        (window as any).FB?.Event.subscribe("xfbml.render", () => console.log("[FB] xfbml.render"));
        (window as any).FB?.Event.subscribe("customerchat.load", () =>
          console.log("[FB] customerchat.load"),
        );
      };
    };

    if ((window as any).FB?.XFBML) {
      (window as any).FB.XFBML.parse();
      return;
    }

    boot();

    // On production, try customer chat SDK; if it fails (500), fall back to generic sdk.js
    if (onProdHost) {
      console.log("[FB] try customerchat SDK");
      addScript(
        SDK_CUSTOMER,
        () => console.log("[FB] customerchat SDK loaded"),
        () => {
          console.warn("[FB] customerchat SDK failed → fallback to generic sdk.js");
          addScript(SDK_GENERIC);
        },
      );
    } else {
      // Previews/dev: generic only (customerchat often 500s)
      console.log("[FB] load generic sdk.js (preview/dev)");
      addScript(SDK_GENERIC);
    }
  }, [pageId, themeColor, minimized]);

  return null;
}
