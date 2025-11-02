'use client';

import { motion } from 'framer-motion';
import { GraduationCap, HeartPulse, ShieldCheck } from 'lucide-react';

const items = [
  {
    title: 'Licensed Diagnostic Facilities',
    desc: 'DOH & NEQAS certified quality you can trust.',
    icon: ShieldCheck,
    accent: 'from-sky-100 via-white to-white',
  },
  {
    title: 'One-Stop Health Partner',
    desc: 'Laboratory • Clinic • Pharmacy — in one place.',
    icon: HeartPulse,
    accent: 'from-emerald-100 via-white to-white',
  },
  {
    title: 'Trusted by Thousands',
    desc: 'Serving Nueva Ecija communities everyday.',
    icon: GraduationCap,
    accent: 'from-amber-100 via-white to-white',
  },
];

export default function WhyCards() {
  return (
    <section className="section relative">
      <div className="pointer-events-none absolute inset-x-10 top-0 z-0 h-[420px] rounded-[48px] bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.18),_rgba(255,255,255,0))] blur-3xl" />
      <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-white/80 p-7 shadow-md backdrop-blur"
            >
              <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${it.accent} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{it.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{it.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
