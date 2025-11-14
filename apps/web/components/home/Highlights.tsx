'use client';

import { motion } from 'framer-motion';
import { CalendarClock, Microscope, UserCheck } from 'lucide-react';

const highlights = [
  {
    value: '15+',
    label: 'Diagnostic services',
    note: 'Comprehensive lab work, imaging partners, and pharmacy support.',
    icon: Microscope,
  },
  {
    value: '6 days',
    label: 'Mon–Sat service',
    note: 'Doors open 6:30 AM to accommodate fasting patients.',
    icon: CalendarClock,
  },
  {
    value: '99%',
    label: 'Patient satisfaction',
    note: 'Consistently high ratings for gentle, caring staff.',
    icon: UserCheck,
  },
];

export default function Highlights() {
  return (
    <section className="section py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
        className="rounded-[32px] border border-white/60 bg-white/80 px-6 py-10 shadow-xl backdrop-blur"
      >
        <div className="grid gap-8 md:grid-cols-3">
          {highlights.map(({ value, label, note, icon: Icon }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: idx * 0.08 }}
              className="flex flex-col gap-3 text-center md:text-left"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent md:mx-0">
                <Icon className="h-6 w-6" />
              </div>
              <div className="text-3xl font-semibold text-gray-900">{value}</div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-accent">{label}</div>
              <p className="text-sm text-gray-600">{note}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
