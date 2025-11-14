import { motion } from 'framer-motion';
import {
  Activity,
  Beaker,
  CheckCircle2,
  Droplet,
  FlaskConical,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  TestTubes,
} from 'lucide-react';

type TestItem = { name: string; note: string; icon: React.ElementType };

const tests: TestItem[] = [
  { name: 'CBC + Platelet Count', note: 'General health', icon: TestTubes },
  { name: 'Urinalysis', note: 'Kidney/UT health', icon: Droplet },
  { name: 'Fasting Blood Sugar (FBS)', note: 'Diabetes check', icon: Activity },
  { name: 'Cholesterol', note: 'Heart health', icon: HeartPulse },
  { name: 'LDL', note: '“Bad” cholesterol', icon: ShieldCheck },
  { name: 'HDL', note: '“Good” cholesterol', icon: ShieldCheck },
  { name: 'Triglycerides', note: 'Heart health', icon: HeartPulse },
  { name: 'Uric Acid (BUA)', note: 'Gout check', icon: Beaker },
  { name: 'ALT', note: 'Liver check', icon: FlaskConical },
  { name: 'Creatinine', note: 'Kidney check', icon: Droplet },
];

export default function Promo() {
  return (
    <section id="book" className="section relative">
      <div className="pointer-events-none absolute inset-x-0 top-10 -z-10 h-[420px] bg-[radial-gradient(circle,_rgba(68,150,155,0.22),_rgba(255,255,255,0))] blur-3xl" />
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="space-y-3 text-center md:text-left"
        >
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent md:mx-0">
            <Sparkles className="h-3.5 w-3.5" />
            Limited-Time Bundle
          </div>
          <h2 className="text-3xl font-semibold md:text-4xl">₱999 Complete Laboratory Promo</h2>
          <p className="text-gray-600 md:text-lg">
            All-in-one baseline health check. Consult fee only <span className="font-medium">₱350</span> if availing package.
          </p>
        </motion.div>

        <motion.ul
          initial="off"
          whileInView="on"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {tests.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.li
                key={t.name}
                variants={{
                  off: { opacity: 0, y: 8 },
                  on: { opacity: 1, y: 0, transition: { duration: 0.28, delay: i * 0.03 } },
                }}
                className="group flex items-start gap-3 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-md ring-1 ring-accent/10 backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent/15 via-white to-white text-accent shadow-inner">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.note}</div>
                </div>
                <CheckCircle2 className="ml-auto mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              </motion.li>
            );
          })}
        </motion.ul>

        <p className="text-xs text-gray-500">*Requires 10–12 hours fasting.</p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="grid gap-6 rounded-3xl bg-gradient-to-br from-white via-white to-accent/10 p-6 shadow-lg md:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Need help booking?</h3>
            <p className="text-sm text-gray-600">
              Our care team can assist you with prep instructions, availability, and follow-up reminders.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="tel:+639939854927" className="btn">
                Call Now
              </a>
              <a href="#branches" className="btn-outline">
                Find a Branch
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 p-5 text-sm text-gray-700 shadow-inner backdrop-blur">
            <h4 className="text-base font-semibold text-gray-900">How it works</h4>
            <ol className="mt-3 space-y-2 text-gray-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  1
                </span>
                Visit your nearest branch (hindi kailangan ng reseta)
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  2
                </span>
                10–12 hours fasting for Blood Sugar and Lipid Profile
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  3
                </span>
                Get results online via the WELLSERV® Patient Portal
              </li>
            </ol>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
