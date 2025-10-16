'use client'
import { motion } from 'framer-motion'


const branches = [
{ name: 'San Isidro Branch', address: 'AIA Bldg., Jose Abad Santos Ave., Brgy. Malapit, San Isidro, Nueva Ecija', hours: 'Mon–Sat, 6:30 AM – 3:00 PM', phone: '+639939854927', maps: 'https://maps.app.goo.gl/vo9kyUrNH2z2suv59' },
{ name: 'San Leonardo Branch', address: 'JBR Bldg., Maharlika Hwy., Brgy. Diversion, San Leonardo, Nueva Ecija', hours: 'Mon–Sat, 6:30 AM – 3:00 PM', phone: '+639942760253', maps: 'https://maps.app.goo.gl/X9Zqa2pvE6H3t3Lf7' },
]


export default function Branches() {
return (
<section id="branches" className="section">
<div className="flex items-end justify-between mb-6">
<h2 className="text-3xl font-semibold">Branches</h2>
<a href="#book" className="btn-outline">Book ₱999 Promo</a>
</div>


<div className="grid md:grid-cols-2 gap-5">
{branches.map((b, i) => (
<motion.div
key={b.name}
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.3 }}
transition={{ duration: 0.45, delay: i * 0.05 }}
className="card p-6 space-y-2"
>
<h3 className="text-lg font-semibold">{b.name}</h3>
<p className="text-gray-600">{b.address}</p>
<p className="text-gray-600">{b.hours}</p>
<div className="flex flex-wrap gap-3 pt-2">
<a className="btn" href={`tel:${b.phone.replace(/\s/g,'')}`}>Call</a>
<a className="btn-outline" href={b.maps} target="_blank" rel="noreferrer">Directions</a>
</div>
</motion.div>
))}
</div>
</section>
)
}