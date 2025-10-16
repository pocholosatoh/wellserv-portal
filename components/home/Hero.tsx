'use client'
import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section className="section pt-16 pb-8">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        {/* LEFT column (unchanged) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="space-y-5"
        >
          <span className="pill">Trusted • Affordable • Convenient</span>
          <h1 className="text-4xl/tight sm:text-5xl/tight font-semibold">
            Complete Laboratory Tests — Just <span className="text-accent">₱999</span>
          </h1>
          <p className="text-gray-600 max-w-prose">
            CBC, Urinalysis, FBS, Cholesterol, LDL, HDL, Triglycerides (Lipid Profile),  Uric Acid, ALT, Creatinine.
            Consult fee only ₱350 if package is availed.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#book" className="btn">Book ₱999 Promo</a>
            <a href="#branches" className="btn-outline">View Branches</a>
          </div>
          <p className="text-xs text-gray-500">*Requires 10–12 hours fasting.</p>
        </motion.div>

        {/* RIGHT column (inline SVG animation) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          <div className="card p-4 md:p-6">
            <svg viewBox="0 0 512 256" className="block w-full h-[260px]">
              
              <path d="M16 128 H496" fill="none" stroke="rgba(0,0,0,.06)" strokeWidth="8" />
              <path
                id="ecg"
                d="M16 128 H120 L160 90 L200 166 L240 92 L300 128 H496"
                fill="none"
                stroke="rgb(68,150,155)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="600"
                strokeDashoffset="600"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="600"
                  to="0"
                  dur="2.8s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
