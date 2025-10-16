// app/page.tsx
import { Suspense } from 'react'
import Hero from '@/components/home/Hero'
import WhyCards from '@/components/home/WhyCards'
import Promo from '@/components/home/Promo'
import Testimonials from '@/components/home/Testimonials'
import Branches from '@/components/home/Branches'
import ResultsPortal from '@/components/home/ResultsPortal'
import { Analytics } from '@vercel/analytics/react'


export default function HomePage() {
return (
<main className="min-h-dvh">
{/* Sticky floating CTA on mobile */}
<a
href="#book"
className="fixed bottom-4 right-4 z-40 btn md:hidden"
aria-label="Book 999 Promo"
>
Book ₱999 Promo
</a>


<Hero />
<WhyCards />
<Promo />
<Testimonials />
<Branches />
<ResultsPortal />


<footer className="section text-sm text-gray-600">
<div className="border-t pt-6">
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
<p>© 2025 WELLSERV Medical Corporation • DOH Licensed Facilities</p>
<div className="flex items-center gap-4">
<a className="hover:underline" href="/patient">Results Portal</a>
<a className="hover:underline" href="#branches">Branches</a>
<a className="hover:underline" href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
</div>
</div>
</div>
<Analytics />
</footer>
</main>
)
}