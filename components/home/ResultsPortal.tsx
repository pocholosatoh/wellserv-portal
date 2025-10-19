'use client'
import { motion } from 'framer-motion'


export default function ResultsPortal() {
return (
<section className="section">
<div className="grid md:grid-cols-2 gap-8 items-center">
<motion.div
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.3 }}
transition={{ duration: 0.5 }}
className="space-y-4"
>
<h2 className="text-3xl font-semibold">Get your results online</h2>
<p className="text-gray-600 max-w-prose">Fast, secure, and accessible anywhere. View, download, and share your laboratory results via the WELLSERV Patient Portal.</p>
<div className="flex gap-3">
<a href="/patient" className="btn">Access Results Portal</a>
<a href="#branches" className="btn-outline">Visit a Branch</a>
</div>
</motion.div>


<motion.div
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.3 }}
transition={{ duration: 0.5, delay: 0.08 }}
className="card p-4 md:p-6"
>
<div className="card p-4 md:p-6">
  <img
    src="/screens/portal.png"
    alt="WELLSERV Patient Portal"
    className="w-full h-auto rounded-xl border border-gray-100"
    loading="lazy"
  />
</div>
</motion.div>
</div>
</section>
)
}