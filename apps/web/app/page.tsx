"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Hero from "@/components/home/Hero";
import WhyCards from "@/components/home/WhyCards";
import Promo from "@/components/home/Promo";
import Testimonials from "@/components/home/Testimonials";
import Branches from "@/components/home/Branches";
import ResultsPortal from "@/components/home/ResultsPortal";
import { Analytics } from "@vercel/analytics/react";
import FBMessenger from "@/components/FBMessenger";
import Highlights from "@/components/home/Highlights";

export default function HomePage() {
  const [showSticky, setShowSticky] = useState(false); // show after scroll
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 220);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[rgb(248,250,251)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[520px] bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.18),_rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-y-0 right-[-30%] z-0 h-[520px] w-[60%] rounded-full bg-[radial-gradient(circle,_rgba(68,150,155,0.12),_rgba(255,255,255,0))] blur-3xl" />
      <div className="relative z-10">
        {/* Top banner with soft gradient */}
        <div
          className="relative isolate"
          style={{
            background:
              "linear-gradient(135deg, rgba(68,150,155,0.12) 0%, rgba(68,150,155,0.05) 45%, rgba(255,255,255,0.0) 100%)",
          }}
        >
          <header className="section py-3 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-3">
                <img
                  src="/wellserv-logo.png"
                  alt="WELLSERV® Medical Corporation"
                  className="block h-16 w-auto object-contain sm:h-14"
                />
                <span className="sr-only">WELLSERV®</span>
              </Link>

              {/* Top actions */}
              <nav className="flex items-center gap-2 sm:gap-3">
                <a href="#branches" className="hidden text-sm sm:inline link-accent">
                  Branches
                </a>
                <Link href="/pricelist" className="hidden text-sm sm:inline link-accent">
                  Prices
                </Link>

                {/* 4) Conspicuous “View My Results” */}
                <Link
                  href="/patient/"
                  className="inline-flex items-center justify-center rounded-2xl border border-accent/40 bg-white/80 px-5 py-2 text-sm font-semibold text-accent shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg sm:px-6"
                  aria-label="View my results online"
                >
                  View My Results
                </Link>

                {/* Book button visible on desktop (mobile gets sticky later) */}
                <a
                  href="#book"
                  className="hidden rounded-xl px-4 py-2 font-medium text-white md:inline-flex"
                  style={{ backgroundColor: accent }}
                >
                  Book ₱999 Promo
                </a>
              </nav>
            </div>
          </header>

          {/* Hero lives inside gradient header for a unified top */}
          <div className="section pt-0 pb-6">
            <Hero />
          </div>
        </div>

        <Highlights />

        {/* Core sections */}
        <section className="section pb-0">
          <WhyCards />
        </section>

        {/* Anchor for CTAs */}
        <div id="book" className="sr-only" />

        <section className="section">
          <Promo />
        </section>

        <section className="section pt-0">
          <Testimonials />
        </section>

        <section id="branches" className="section pt-0">
          <Branches />
        </section>

        <section className="section pt-0">
          <ResultsPortal />
        </section>

        {/* 2) Sticky “Book ₱999” – only after scroll */}
        {showSticky && (
          <a
            href="#book"
            className="fixed left-4 bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] z-40 btn md:hidden shadow-lg"
            aria-label="Book ₱999 Promo"
          >
            Book ₱999
          </a>
        )}

        {/* 3) “Message us” visible on mobile & desktop */}
        <a
          href="https://m.me/100882935339577"
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] right-4 z-40 inline-flex items-center gap-2 rounded-full border border-accent/70 bg-white/90 px-4 py-2 text-sm font-medium text-accent shadow-xl backdrop-blur transition hover:bg-accent/10"
        >
          Message us
        </a>

        {/* Footer */}
        <footer className="section text-sm text-gray-600">
          <div className="border-t pt-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p>
                © {new Date().getFullYear()} WELLSERV® Medical Corporation • DOH Licensed
                Facilities
              </p>
              <div className="flex items-center gap-4">
                <a className="hover:underline" href="/patient/">
                  Results Portal
                </a>
                <a className="hover:underline" href="#branches">
                  Branches
                </a>
                <a className="hover:underline" href="/pricelist">
                  Price List
                </a>
                <a className="hover:underline" href="/privacy">
                  Privacy Policy
                </a>
                <a
                  className="hover:underline"
                  href="https://facebook.com/wellservmedicalcorporation"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
                </a>
              </div>
            </div>
          </div>
          <Analytics />
        </footer>

        {/* FB loader (keeps minimized) */}
        <FBMessenger pageId={process.env.NEXT_PUBLIC_FB_PAGE_ID!} themeColor="#44969b" minimized />
      </div>
    </main>
  );
}
