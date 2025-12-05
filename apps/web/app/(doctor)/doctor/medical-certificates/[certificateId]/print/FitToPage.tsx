'use client';

import { type ReactNode, useEffect, useRef } from "react";

const MM_TO_PX = 96 / 25.4;

function mmToPx(mm: number) {
  return mm * MM_TO_PX;
}

type Props = {
  widthMm: number;
  heightMm: number;
  className?: string;
  children: ReactNode;
};

export function FitToPage({ widthMm, heightMm, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const targetHeightPx = mmToPx(heightMm);
  const targetWidthPx = mmToPx(widthMm);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const updateScale = () => {
      if (!el) return;
      const hScale = targetHeightPx / el.scrollHeight;
      const wScale = targetWidthPx / el.scrollWidth;
      const next = Math.min(1, hScale, wScale);
      el.style.setProperty("--mc-scale", next.toFixed(3));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [targetHeightPx, targetWidthPx]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
