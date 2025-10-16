'use client'
import { motion } from 'framer-motion'


const items = [
{ title: 'Licensed Diagnostic Facilities', desc: 'DOH & NEQAS certified quality you can trust.' },
{ title: 'One‑Stop Health Partner', desc: 'Laboratory • Clinic • Pharmacy — in one place.' },
{ title: 'Trusted by Thousands', desc: 'Serving Nueva Ecija communities everyday.' },
]


export default function WhyCards() {
return (
<section className="section">
<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
{items.map((it, i) => (
<motion.div
key={it.title}
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.4 }}
transition={{ duration: 0.5, delay: i * 0.05 }}
className="card p-6"
>
<h3 className="font-semibold text-lg mb-1">{it.title}</h3>
<p className="text-gray-600">{it.desc}</p>
</motion.div>
))}
</div>
</section>
)
}