'use client'
import { motion } from 'framer-motion'


const reviews = [
{ quote: 'I highly recommend this Laboratory because the price is affordable than others so i can recommend this Laboratory to my friends and relatives, thankyou for the good service of your staff ❤️️', name: 'Michelle Santos (Facebook Review)' },
{ quote: 'I highly recommend this clinic kasi bukod sa malinis ang kanilang laboratory, maasikaso at mababait ang kanilang staff and then accurate din yung mga tests results. Bukod don meron din silang pharmacy kung saan mabibili mo na din yung mga nireseta ni doc.', name: 'Joycelyn Franco (Facebook Review)' },
{ quote: 'Highly recommended ko po nag WellServ - Diagnostic Laboratory, Pharmacy & Medical Clinic., napakamaayos ng kanilang serbisyo. Mabilis at magiliw ang kanilang mga staff at mga doktor. Malinis at maayos din ang kanilang clinic. Hindi rin masakit ang mga procedure na ginawa sa akin. Hindi ko ramdam ang pagtusok sa akin ng karayom ng kanilang medical technologist sa pagkuha ng aking dugo para sa mga laboratory tests.', name: 'Kristel Yanson (Facebook Review)' },
]


export default function Testimonials() {
return (
<section className="section">
<h2 className="text-3xl font-semibold mb-6">What our patients say:</h2>
<div className="grid md:grid-cols-3 gap-5">
{reviews.map((r, i) => (
<motion.figure
key={r.name}
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.3 }}
transition={{ duration: 0.45, delay: i * 0.05 }}
className="card p-6"
>
<blockquote className="text-gray-800">“{r.quote}”</blockquote>
<figcaption className="mt-3 text-sm text-gray-500">— {r.name}</figcaption>
</motion.figure>
))}
</div>
</section>
)
}