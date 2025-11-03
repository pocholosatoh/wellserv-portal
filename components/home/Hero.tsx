'use client';

import { motion } from 'framer-motion';
import { Clock4, HeartPulse, ShieldCheck, Sparkles } from 'lucide-react';

const heroHighlights = [
  { label: 'Same-day results release', icon: Clock4 },
  { label: 'Board-certified physicians on-site', icon: ShieldCheck },
  { label: 'Heart & wellness focused care', icon: HeartPulse },
];

const statCards = [
  { value: '35K+', label: 'Patients served', accent: 'from-accent/80 to-sky-200/80' },
  { value: 'Licensed facility', label: 'DOH Certified', accent: 'from-teal-500/80 to-emerald-200/80' },
];

export default function Hero() {
  return (
    <section className="section pt-8 pb-12">
      <div className="grid items-center gap-10 md:grid-cols-2">
        {/* LEFT column */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <span className="pill gap-2 text-sm">
            <Sparkles className="h-4 w-4" />
            Trusted • Affordable • Convenient
          </span>
          <h1 className="text-4xl/tight font-semibold sm:text-5xl/tight">
            Complete Laboratory Tests — Just <span className="text-accent">₱999</span>
          </h1>
          <p className="max-w-prose text-gray-600">
            CBC, Urinalysis, FBS, Cholesterol, LDL, HDL, Triglycerides (Lipid Profile), Uric Acid, ALT, Creatinine.
            Consult fee only ₱350 if package is availed.
          </p>
          <motion.ul
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
            className="grid gap-3 sm:grid-cols-2"
          >
            {heroHighlights.map(({ label, icon: Icon }) => (
              <motion.li
                key={label}
                variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
                className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-white/70 p-3 text-sm text-gray-700 shadow-sm backdrop-blur"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1 leading-tight">{label}</span>
              </motion.li>
            ))}
          </motion.ul>
          <div className="flex flex-wrap gap-3">
            <a href="#book" className="btn">
              Book ₱999 Promo
            </a>
            <a href="#branches" className="btn-outline">
              View Branches
            </a>
          </div>
          <p className="text-xs text-gray-500">*Requires 10–12 hours fasting.</p>
        </motion.div>

        {/* RIGHT column */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative isolate"
        >
          <div className="absolute inset-6 -z-10 rounded-[32px] bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.28),_rgba(68,150,155,0))]" />
          <div className="card overflow-hidden border-none bg-white/80 p-6 shadow-lg backdrop-blur">
            <div className="rounded-[24px] bg-gradient-to-br from-accent/15 via-white to-white p-6">
              <svg viewBox="0 0 512 256" className="h-64 w-full">
                <path d="M16 128 H496" fill="none" stroke="rgba(0,0,0,.06)" strokeWidth="8" />
                <path
                  d="M16 128 H120 L160 90 L200 166 L240 92 L300 128 H496"
                  fill="none"
                  stroke="rgb(68,150,155)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="600"
                  strokeDashoffset="600"
                >
                  <animate attributeName="stroke-dashoffset" from="600" to="0" dur="2.8s" repeatCount="indefinite" />
                </path>
              </svg>
            </div>
          </div>

          {/* Floating stat cards */}
          <div className="absolute -top-10 left-1/2 flex w-max -translate-x-1/2 flex-col gap-3 md:-top-6 md:left-auto md:right-10 md:translate-x-0">
            {statCards.map(({ value, label, accent }, idx) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: 0.2 + idx * 0.1 }}
                className="rounded-2xl bg-white/80 p-4 shadow-md backdrop-blur"
              >
                <div className={`inline-flex rounded-xl bg-gradient-to-br ${accent} px-3 py-1 text-xs font-semibold text-white`}>
                  {label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
