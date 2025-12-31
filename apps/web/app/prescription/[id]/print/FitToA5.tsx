"use client";

import { type ReactNode, useEffect, useRef } from "react";

type Props = {
  className?: string;
  children: ReactNode;
};

const MM_TO_PX = 96 / 25.4;
const PAGE_HEIGHT_PX = 210 * MM_TO_PX; // A5 height in px
const PAGE_WIDTH_PX = 148 * MM_TO_PX; // A5 width in px

export function FitToA5({ className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const updateScale = () => {
      if (!el) return;
      const hScale = PAGE_HEIGHT_PX / el.scrollHeight;
      const wScale = PAGE_WIDTH_PX / el.scrollWidth;
      const next = Math.min(1, hScale, wScale);
      el.style.setProperty("--rx-scale", next.toFixed(3));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
