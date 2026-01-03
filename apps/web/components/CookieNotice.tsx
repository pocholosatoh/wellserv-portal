"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "cookie_notice_acknowledged";
const BLOCKED_PREFIXES = ["/app", "/staff", "/doctor", "/admin"];

const isBlockedRoute = (pathname: string) =>
  BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export default function CookieNotice() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const isBlocked = isBlockedRoute(pathname);

  useEffect(() => {
    if (isBlocked) {
      setVisible(false);
      return;
    }

    try {
      const acknowledged = localStorage.getItem(STORAGE_KEY) === "1";
      setVisible(!acknowledged);
    } catch {
      setVisible(true);
    }
  }, [isBlocked]);

  const handleAcknowledge = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors and still hide the banner.
    }
    setVisible(false);
  };

  if (!visible || isBlocked) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
      <section
        className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 text-sm text-gray-700 shadow-lg backdrop-blur"
        role="region"
        aria-label="Cookie notice"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">Cookie Notice</p>
            <p className="text-sm text-gray-700">
              This website uses essential cookies to support secure access, system
              functionality, and service improvement.
            </p>
            <p className="text-sm text-gray-700">
              By continuing to browse, you acknowledge this use.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link
              href="/privacy"
              className="text-accent transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2"
            >
              Learn more
            </Link>
            <span aria-hidden="true" className="text-gray-400">
              ·
            </span>
            <button
              type="button"
              onClick={handleAcknowledge}
              className="rounded-full bg-accent/10 px-3 py-1.5 text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2"
            >
              OK
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
