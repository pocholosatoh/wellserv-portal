// ===============================
// REPLACE the entire file: app/api/config/route.ts
// (This file must contain ONLY TypeScript for the API route — no CSS.)
// ===============================
import { NextResponse } from "next/server";
import { readConfig } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cfg = await readConfig();
    return NextResponse.json({ config: cfg });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

/*
=================================
WHERE THE WATERMARK CSS BELONGS
=================================

Put your watermark CSS INSIDE the <style>{` ... `}</style> of app/portal/page.tsx,
NOT in route.ts.

Add (or keep) these rules in page.tsx's <style> block:

  .wm-layer { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
  .wm-text, .wm-image { opacity: var(--wm-opacity, 0.12); transform: rotate(var(--wm-angle, -30deg)); }
  .wm-text { font-weight: 700; color: #000; letter-spacing: 0.1em; font-size: var(--wm-size, 60vw); white-space: nowrap; text-transform: uppercase; mix-blend-mode: multiply; }
  .wm-img { width: var(--wm-size, 60vw); height: auto; opacity: var(--wm-opacity, 0.12); transform: rotate(var(--wm-angle, -30deg)); filter: grayscale(100%); mix-blend-mode: multiply; }
  @media print { .wm-layer { display: flex !important; } .wm-layer[data-print="off"] { display: none !important; } .wm-text, .wm-image, .wm-img { opacity: var(--wm-opacity-print, 0.08); } }

Then the JSX in page.tsx should render either text or an <img className="wm-img" ... /> based on Config.
*/
