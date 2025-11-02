'use client';

import { motion } from 'framer-motion';
import { Clock4, MapPin, Phone } from 'lucide-react';

const branches = [
  {
    name: 'San Isidro Branch',
    address: 'AIA Bldg., Jose Abad Santos Ave., Brgy. Malapit, San Isidro, Nueva Ecija',
    hours: 'Mon–Sat, 6:30 AM – 3:00 PM',
    phone: '+639939854927',
    maps: 'https://maps.app.goo.gl/vo9kyUrNH2z2suv59',
  },
  {
    name: 'San Leonardo Branch',
    address: 'JBR Bldg., Maharlika Hwy., Brgy. Diversion, San Leonardo, Nueva Ecija',
    hours: 'Mon–Sat, 6:30 AM – 3:00 PM',
    phone: '+639942760253',
    maps: 'https://maps.app.goo.gl/X9Zqa2pvE6H3t3Lf7',
  },
];

export default function Branches() {
  return (
    <section id="branches" className="section relative">
      <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-[radial-gradient(circle,_rgba(68,150,155,0.12),_rgba(255,255,255,0))] blur-3xl" />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Branches</h2>
          <p className="mt-1 text-sm text-gray-600">Drop by early for the shortest queue. Doors open at 6:30 AM.</p>
        </div>
        <a href="#book" className="btn-outline rounded-full px-4 py-2 text-sm">
          Book ₱999 Promo
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {branches.map((b, i) => (
          <motion.div
            key={b.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
            className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur"
          >
            <div className="absolute -top-24 -right-16 h-48 w-48 rounded-full bg-accent/5 blur-2xl" />
            <h3 className="text-lg font-semibold text-gray-900">{b.name}</h3>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-accent">
                  <MapPin className="h-5 w-5" />
                </span>
                <p>{b.address}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-accent">
                  <Clock4 className="h-5 w-5" />
                </span>
                <p>{b.hours}</p>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <a
                  className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent"
                  href={`tel:${b.phone.replace(/\s/g, '')}`}
                >
                  <Phone className="h-4 w-4" />
                  {b.phone}
                </a>
                <a className="btn-outline px-4 py-2" href={b.maps} target="_blank" rel="noreferrer">
                  Directions
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
