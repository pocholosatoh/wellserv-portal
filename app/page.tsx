// app/page.tsx
import Hero from "@/components/home/Hero";
import WhyCards from "@/components/home/WhyCards";
import Promo from "@/components/home/Promo";
import Testimonials from "@/components/home/Testimonials";
import Branches from "@/components/home/Branches";
import ResultsPortal from "@/components/home/ResultsPortal";
import { Analytics } from "@vercel/analytics/react";

export default function HomePage() {
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  return (
    <main className="min-h-dvh bg-[rgb(248,250,251)]">
      {/* Top banner with soft gradient */}
      <div
        className="relative isolate"
        style={{
          background:
            "linear-gradient(135deg, rgba(68,150,155,0.12) 0%, rgba(68,150,155,0.05) 45%, rgba(255,255,255,0.0) 100%)",
        }}
      >
        <header className="section py-3 sm:py-4">
            <div className="flex items-center justify-center sm:justify-between">
                <a href="/" className="flex items-center gap-3">
                <img
                    src="/wellserv-logo.png"
                    alt="WELLSERV Medical Corporation"
                    className="block h-24 sm:h-20= w-auto object-contain mx-auto sm:mx-0" // 👈 note: block
                />
                <span className="sr-only">WELLSERV</span>
                </a>

                <nav className="hidden sm:flex items-center gap-3">
                <a href="#branches" className="link-accent text-sm">Branches</a>
                <a href="/patient/" className="link-accent text-sm">Results Portal</a>
                <a href="#book" className="btn-outline rounded-xl px-4 py-2">Book ₱999 Promo</a>
                </nav>
            </div>
        </header>


        {/* Mobile sticky CTA */}
        <a
          href="#book"
          aria-label="Book ₱999 Promo"
          className="fixed bottom-4 right-4 z-40 sm:hidden rounded-2xl px-5 py-3 text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          Book ₱999 Promo
        </a>

        {/* Hero lives inside gradient header for a unified top */}
        <div className="section pt-0 pb-6">
          <Hero />
        </div>
      </div>

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

      {/* Footer */}
      <footer className="section text-sm text-gray-600">
        <div className="border-t pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} WELLSERV Medical Corporation • DOH Licensed Facilities</p>
            <div className="flex items-center gap-4">
              <a className="hover:underline" href="/patient/">
                Results Portal
              </a>
              <a className="hover:underline" href="#branches">
                Branches
              </a>
              <a
                className="hover:underline"
                href="http://facebook.com/wellservmedicalcorporation"
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
    </main>
  );
}
