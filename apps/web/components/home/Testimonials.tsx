"use client";

import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

const reviews = [
  {
    quote:
      "I highly recommend this Laboratory because the price is affordable than others so i can recommend this Laboratory to my friends and relatives, thankyou for the good service of your staff ❤️️",
    name: "Michelle Santos (Facebook Review)",
  },
  {
    quote:
      "I highly recommend this clinic kasi bukod sa malinis ang kanilang laboratory, maasikaso at mababait ang kanilang staff and then accurate din yung mga tests results. Bukod don meron din silang pharmacy kung saan mabibili mo na din yung mga nireseta ni doc.",
    name: "Joycelyn Franco (Facebook Review)",
  },
  {
    quote:
      "Highly recommended ko po nag WellServ - Diagnostic Laboratory, Pharmacy & Medical Clinic., napakamaayos ng kanilang serbisyo. Mabilis at magiliw ang kanilang mga staff at mga doktor. Malinis at maayos din ang kanilang clinic. Hindi rin masakit ang mga procedure na ginawa sa akin. Hindi ko ramdam ang pagtusok sa akin ng karayom ng kanilang medical technologist sa pagkuha ng aking dugo para sa mga laboratory tests.",
    name: "Kristel Yanson (Facebook Review)",
  },
];

export default function Testimonials() {
  return (
    <section className="section relative">
      <div className="pointer-events-none absolute inset-x-6 -top-12 -z-10 h-64 rounded-[48px] bg-[radial-gradient(circle,_rgba(68,150,155,0.14),_rgba(255,255,255,0))] blur-3xl" />
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold md:text-4xl">What our patients say</h2>
          <p className="max-w-xl text-gray-600">
            Consistently rated 5★ for gentle procedures, accurate results, and friendly staff who go
            the extra mile.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-accent shadow-md backdrop-blur">
          <Star className="h-4 w-4 fill-current" />
          4.9 out of 5 on Facebook Reviews
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {reviews.map((r, i) => (
          <motion.figure
            key={r.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
            className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg backdrop-blur"
          >
            <Quote className="absolute -top-8 -right-6 h-32 w-32 -rotate-12 text-accent/10" />
            <blockquote className="relative text-gray-800">
              <span className="text-4xl font-serif text-accent/40">“</span>
              {r.quote}
            </blockquote>
            <figcaption className="mt-4 text-sm font-medium text-gray-600">— {r.name}</figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
