"use client";

import { motion } from "framer-motion";
import { FileDown, Laptop, Lock } from "lucide-react";

const perks = [
  { label: "View all results anytime", icon: Laptop },
  { label: "Download PDF copies anytime", icon: FileDown },
  { label: "Secure data with encrypted storage", icon: Lock },
];

export default function ResultsPortal() {
  return (
    <section className="section relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white via-white to-accent/10" />
      <div className="grid items-center gap-10 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="space-y-5"
        >
          <h2 className="text-3xl font-semibold md:text-4xl">Get your results online</h2>
          <p className="max-w-prose text-gray-600">
            Fast, secure, and accessible anywhere. View, download, and share your laboratory results
            via the WELLSERV Patient Portal.
          </p>
          <motion.ul
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            className="space-y-3"
          >
            {perks.map(({ label, icon: Icon }) => (
              <motion.li
                key={label}
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-gray-600 shadow-sm backdrop-blur"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1">{label}</span>
              </motion.li>
            ))}
          </motion.ul>
          <div className="flex flex-wrap gap-3 pt-1">
            <a href="/patient" className="btn">
              Access Results Portal
            </a>
            <a href="#branches" className="btn-outline">
              Visit a Branch
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="relative rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-2xl backdrop-blur"
        >
          <div className="absolute -left-8 top-12 h-36 w-36 rounded-full bg-accent/10 blur-2xl" />
          <div className="absolute -right-10 bottom-6 h-32 w-32 rounded-full bg-emerald-200/30 blur-2xl" />
          <div className="rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-inner">
            <img
              src="/screens/portal.png"
              alt="WELLSERV Patient Portal"
              className="h-auto w-full rounded-2xl border border-white/60 shadow-md"
              loading="lazy"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
