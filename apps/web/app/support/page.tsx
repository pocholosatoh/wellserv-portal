import "server-only";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { LifeBuoy, Mail, MessageCircle, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Support | WellServ",
  description: "Get help with the WELLSERV Patient app, account access, and lab results.",
};

export default function SupportPage() {
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[rgb(248,250,251)]"
      style={
        {
          ["--accent" as any]: accent,
          ["--accent-10" as any]: `${accent}1A`,
          ["--accent-33" as any]: `${accent}33`,
        } as CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.18),_rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute -right-[20%] top-40 z-0 h-[420px] w-[60%] rounded-full bg-[radial-gradient(circle,_rgba(68,150,155,0.14),_rgba(255,255,255,0))] blur-3xl" />

      <div className="sticky top-0 z-30 border-b border-white/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-white/80 px-3 py-1.5 text-sm text-accent shadow-sm transition hover:bg-accent/10"
          >
            Back to Home
          </Link>
          <a
            href="https://m.me/100882935339577"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            Message us
          </a>
        </div>
      </div>

      <div className="relative z-10">
        <section className="mx-auto max-w-6xl space-y-10 px-4 pb-16 pt-10 md:px-6 lg:px-8">
          <header className="relative overflow-hidden rounded-[40px] border border-white/60 bg-white/90 px-6 py-10 shadow-xl backdrop-blur md:px-10 md:py-14">
            <div className="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-12 h-60 w-60 rounded-full bg-emerald-200/40 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                  <LifeBuoy className="h-4 w-4" />
                  App Support
                </span>
                <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl md:text-5xl">
                  WELLSERV Patient Support
                </h1>
                <p className="max-w-xl text-base text-gray-600 md:text-lg">
                  Need help signing in, resetting your PIN, or viewing results? Our team can assist
                  with access issues and app-related questions.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href="https://m.me/100882935339577"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition hover:opacity-90"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message us on Messenger
                  </a>
                  <a
                    href="mailto:wellservmedicalcorporation@gmail.com"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10"
                  >
                    <Mail className="h-4 w-4" />
                    Email support
                  </a>
                </div>
              </div>
              <div className="grid w-full max-w-sm gap-4 rounded-3xl border border-white/60 bg-white/85 p-5 shadow-lg backdrop-blur lg:max-w-xs">
                <p className="text-sm font-semibold text-gray-900">What to include</p>
                <p className="text-sm text-gray-600">
                  Share your patient ID, visit date, and branch. Avoid sending full medical results
                  in chat; we can confirm details securely.
                </p>
              </div>
            </div>
          </header>

          <section className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-lg backdrop-blur md:p-8">
            <h2 className="text-2xl font-semibold text-gray-900">Account Deletion Request</h2>
            <p className="mt-3 text-sm text-gray-600">
              To request account deletion, follow the steps below. This process is informational
              only and is handled by our support team.
            </p>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-5">
                <p className="text-sm font-semibold text-gray-900">How to request deletion</p>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
                  <li>
                    Contact us via Facebook Messenger or email{" "}
                    <a
                      className="text-accent hover:underline"
                      href="mailto:wellservmedicalcorporation@gmail.com"
                    >
                      wellservmedicalcorporation@gmail.com
                    </a>
                    .
                  </li>
                  <li>Include your full name and the clinic/branch where records were created.</li>
                  <li>Identity verification is required before deletion is processed.</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-5">
                <p className="text-sm font-semibold text-gray-900">What will be deleted</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
                  <li>App access credentials.</li>
                  <li>Patient portal access.</li>
                  <li>Linked account identifiers.</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-5">
                <p className="text-sm font-semibold text-gray-900">Data that may be retained</p>
                <p className="mt-3 text-sm text-gray-600">
                  Medical and laboratory records may be retained as required by Philippine health
                  regulations and applicable laws.
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-5">
                <p className="text-sm font-semibold text-gray-900">Processing time</p>
                <p className="mt-3 text-sm text-gray-600">Typically within 30 days.</p>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),280px] lg:gap-8">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-lg backdrop-blur">
                <h2 className="text-xl font-semibold text-gray-900">How we can help</h2>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  <li>Login, PIN reset, and access code questions.</li>
                  <li>Viewing lab results, prescriptions, and visit history.</li>
                  <li>Reporting an issue in the WELLSERV Patient app.</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-lg backdrop-blur">
                <h2 className="text-xl font-semibold text-gray-900">Clinic concerns</h2>
                <p className="mt-3 text-sm text-gray-600">
                  For same-day clinical needs, please contact your WELLSERV branch directly during
                  business hours.
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-lg backdrop-blur">
                <h2 className="text-xl font-semibold text-gray-900">Privacy and security</h2>
                <p className="mt-3 text-sm text-gray-600">
                  We only use your information to provide care and support. Review our privacy
                  policy for details on how your data is handled.
                </p>
                <Link className="mt-4 inline-flex items-center gap-2 text-sm text-accent" href="/privacy">
                  <ShieldCheck className="h-4 w-4" />
                  View privacy policy
                </Link>
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-lg backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                  Resources
                </p>
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                  <Link className="flex items-center gap-2 hover:text-accent" href="/patient/">
                    Results Portal
                  </Link>
                  <Link className="flex items-center gap-2 hover:text-accent" href="/pricelist">
                    Price List
                  </Link>
                  <a
                    className="flex items-center gap-2 hover:text-accent"
                    href="https://facebook.com/wellservmedicalcorporation"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Facebook
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <footer className="section text-sm text-gray-600">
          <div className="border-t pt-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p>(c) {new Date().getFullYear()} WELLSERV Medical Corporation - DOH Licensed Facilities</p>
              <div className="flex flex-wrap items-center gap-4">
                <a className="hover:underline" href="/patient/">
                  Results Portal
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
        </footer>
      </div>
    </main>
  );
}
