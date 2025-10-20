'use client'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  TestTubes,
  Droplet,
  FlaskConical,
  HeartPulse,
  ShieldCheck,   // ✅ use this instead of ShieldHeart
  Activity,
  Beaker,
} from 'lucide-react'

type TestItem = { name: string; note: string; icon: React.ElementType }

const tests: TestItem[] = [
  { name: 'CBC + Platelet Count',      note: 'General health',        icon: TestTubes },
  { name: 'Urinalysis',                note: 'Kidney/UT health',      icon: Droplet },
  { name: 'Fasting Blood Sugar (FBS)', note: 'Diabetes check',        icon: Activity },
  { name: 'Cholesterol',               note: 'Heart health',          icon: HeartPulse },
  { name: 'LDL',                       note: '“Bad” cholesterol',     icon: ShieldCheck },
  { name: 'HDL',                       note: '“Good” cholesterol',    icon: ShieldCheck },
  { name: 'Triglycerides',             note: 'Heart health',          icon: HeartPulse },
  { name: 'Uric Acid (BUA)',           note: 'Gout check',            icon: Beaker },
  { name: 'ALT',                       note: 'Liver check',           icon: FlaskConical },
  { name: 'Creatinine',                note: 'Kidney check',          icon: Droplet },
]

export default function Promo() {
  return (
    <section id="book" className="section">
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="space-y-3"
        >
          <h2 className="text-3xl font-semibold">₱999 Complete Laboratory Promo</h2>
          <p className="text-gray-600">
            All-in-one baseline health check. Consult fee only <span className="font-medium">₱350</span> if availing package.
          </p>
        </motion.div>

        <motion.ul
          initial="off"
          whileInView="on"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {tests.map((t, i) => {
            const Icon = t.icon
            return (
              <motion.li
                key={t.name}
                variants={{
                  off: { opacity: 0, y: 8 },
                  on:  { opacity: 1, y: 0, transition: { duration: 0.28, delay: i * 0.03 } },
                }}
                className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs hover:shadow-sm transition-shadow"
              >
                <div className="mt-0.5 grid place-items-center h-8 w-8 rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.note}</div>
                </div>
                <CheckCircle2 className="ml-auto mt-0.5 h-5 w-5 text-green-600 shrink-0" />
              </motion.li>
            )
          })}
        </motion.ul>

        <p className="text-xs text-gray-500">*Requires 10–12 hours fasting.</p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="card p-6 space-y-4"
        >
          <div className="flex flex-wrap gap-3">
            <a href="tel:+639939854927" className="btn">Call Now</a>
            <a href="#branches" className="btn-outline">Find a Branch</a>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">How it works</h3>
            <ol className="list-decimal list-inside text-gray-700 space-y-1">
              <li>Visit your nearest branch (hindi kailangan ng reseta)</li>
              <li>10–12 hours fasting for Blood Sugar and Lipid Profile</li>
              <li>Get results online via the WELLSERV® Patient Portal</li>
            </ol>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
