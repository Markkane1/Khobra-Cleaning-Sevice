'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, CalendarCheck, Clock3, Sparkles, WandSparkles } from 'lucide-react'
import { Logo } from '@/components/ui/logo'

export type PublicService = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  baseRate: number
  minDuration: number
  galleryImages?: string[] | null
  heroImages?: string[] | null
}

export function usePublicServices() {
  return useQuery<{ services: PublicService[]; business: { name: string; currency: string; firstBookingTime: string; lastWorkingTime: string } | null }>({
    queryKey: ['public-services'],
    queryFn: async () => {
      const response = await fetch('/api/khobra-cleaning/public/services')
      if (!response.ok) throw new Error('Could not load services')
      return response.json()
    },
  })
}

const categoryArt: Record<string, string> = {
  Cleaning: 'from-emerald-400 via-teal-500 to-cyan-700',
  Specialized: 'from-cyan-400 via-sky-500 to-indigo-700',
  Commercial: 'from-amber-300 via-orange-500 to-rose-700',
}

export function ServiceVisual({ service, className = '' }: { service: PublicService; className?: string }) {
  const images = [...(Array.isArray(service.heroImages) ? service.heroImages : []), ...(Array.isArray(service.galleryImages) ? service.galleryImages : [])]
  const [active, setActive] = useState(0)
  const image = images[active]

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${categoryArt[service.category || ''] || categoryArt.Cleaning} ${className}`}>
      {image ? <img src={image} alt={`${service.name} service`} className="absolute inset-0 h-full w-full object-cover transition duration-700 hover:scale-105" /> : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-28 w-28 rounded-[2rem] border border-white/30 bg-white/15 shadow-2xl backdrop-blur-md rotate-12 grid place-items-center">
            <Sparkles className="h-12 w-12 text-white drop-shadow-lg -rotate-12" />
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-white/10" />
      {images.length > 1 && <div className="absolute bottom-3 right-3 flex gap-1.5" aria-label="Service images">
        {images.slice(0, 5).map((_, index) => <button key={index} aria-label={`Show image ${index + 1}`} onClick={() => setActive(index)} className={`h-1.5 rounded-full transition-all ${active === index ? 'w-6 bg-white' : 'w-1.5 bg-white/60'}`} />)}
      </div>}
    </div>
  )
}

export function ServiceCards({ limit }: { limit?: number }) {
  const { data, isLoading, isError, refetch } = usePublicServices()
  const services = limit ? data?.services.slice(0, limit) : data?.services
  const currency = data?.business?.currency || 'AED'

  if (isLoading) return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="h-[430px] animate-pulse rounded-[2rem] bg-white/60" />)}</div>
  if (isError) return <div role="alert" className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-center"><h3 className="font-black text-slate-900">Services are temporarily unavailable</h3><p className="mt-2 text-sm text-slate-600">Please try loading the service list again.</p><button type="button" onClick={() => void refetch()} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Try again</button></div>
  if (!services?.length) return <div className="rounded-[2rem] border border-slate-200 bg-white/70 p-8 text-center text-sm font-semibold text-slate-600">No services are available for online booking right now.</div>
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
    {services?.map((service, index) => <motion.article key={service.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .05 }} whileHover={{ y: -8 }} className="group overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_22px_60px_-28px_rgba(15,118,110,.45)] backdrop-blur-xl">
      <ServiceVisual service={service} className="h-56" />
      <div className="p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-emerald-700">{service.category || 'Cleaning'}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Clock3 className="h-3.5 w-3.5" /> {service.minDuration}h min</span>
        </div>
        <h3 className="text-xl font-black tracking-tight text-slate-900">{service.name}</h3>
        <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">{service.description || 'Professional care, tailored to your space.'}</p>
        <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-5">
          <div><span className="text-xs text-slate-400">From</span><p className="text-2xl font-black text-slate-900"><span className="text-sm font-bold text-emerald-600">{currency}</span> {service.baseRate.toLocaleString()}</p></div>
          <a href={`/book?service=${service.id}`} className="flex h-11 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-lg transition group-hover:bg-emerald-600">Book <ArrowRight className="h-4 w-4" /></a>
        </div>
      </div>
    </motion.article>)}
  </div>
}

export function PublicLanding() {
  const { data } = usePublicServices()
  const featured = useMemo(() => data?.services[0], [data])
  const currency = data?.business?.currency || 'AED'
  return <main className="min-h-screen overflow-hidden bg-[#f3fbf8] text-slate-950">
    <header className="fixed inset-x-0 top-0 z-50 mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-xl shadow-emerald-950/5 backdrop-blur-xl sm:px-6">
      <a href="/"><Logo size={40} textClassName="font-black text-sm text-slate-950" subtextClassName="text-[10px] text-emerald-600" /></a>
      <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex"><a href="#services">Services</a><a href="#why">Why Khobra</a><a href="#process">How it works</a></nav>
      <div className="flex items-center gap-2"><a href="/login" className="hidden px-4 py-2 text-sm font-bold sm:block">Sign in</a><a href="/book" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25">Book now</a></div>
    </header>

    <section className="relative mx-auto grid min-h-[820px] max-w-7xl items-center gap-12 px-6 pb-20 pt-36 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
      <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-emerald-300/30 blur-3xl" /><div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="relative z-10">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-700 shadow-sm"><WandSparkles className="h-4 w-4" /> Dubai&apos;s effortless clean</div>
        <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.055em] sm:text-7xl">A cleaner space.<br/><span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent">A lighter life.</span></h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">Browse currently configured services, see hourly pricing, and send your booking request directly to the operations team.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row"><a href="/book" className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-7 py-4 font-bold text-white shadow-2xl shadow-slate-950/20 transition hover:-translate-y-1">Book your clean <ArrowRight className="h-5 w-5" /></a><a href="#services" className="rounded-2xl border border-slate-200 bg-white/70 px-7 py-4 text-center font-bold backdrop-blur">Explore services</a></div>
        <div className="mt-9 flex flex-wrap gap-5 text-sm font-semibold text-slate-600"><span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-600" /> Configured services</span><span className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-emerald-600" /> Hourly estimates</span><span className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-emerald-600" /> Online requests</span></div>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: .9, rotateY: -12 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} transition={{ duration: .8 }} className="relative mx-auto w-full max-w-[560px] [perspective:1200px]">
        <div className="absolute -inset-6 rotate-3 rounded-[3rem] bg-gradient-to-br from-emerald-400 to-cyan-500 opacity-20 blur-2xl" />
        <div className="relative rotate-[2deg] overflow-hidden rounded-[2.6rem] border-[10px] border-white bg-slate-900 shadow-[0_45px_90px_-25px_rgba(6,78,59,.55)]">
          {featured ? <ServiceVisual service={featured} className="h-[550px]" /> : <div className="h-[550px] bg-gradient-to-br from-emerald-400 to-teal-800" />}
          <div className="absolute inset-x-6 bottom-6 rounded-[1.7rem] border border-white/20 bg-slate-950/70 p-5 text-white backdrop-blur-xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Featured service</p><p className="mt-1 text-2xl font-black">{featured?.name || 'Service catalogue'}</p><div className="mt-3 flex justify-between text-sm text-white/70"><span>{featured ? `${featured.minDuration}h minimum` : 'Loading current services'}</span>{featured ? <span className="font-bold text-white">from {currency} {featured.baseRate.toLocaleString()}</span> : null}</div></div>
        </div>
      </motion.div>
    </section>

    <section id="services" className="mx-auto max-w-7xl px-6 py-24 lg:px-10"><div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[.25em] text-emerald-600">Made for your space</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Cleaning that fits your life.</h2></div><p className="max-w-md text-slate-500">Every service uses the exact gallery and hero imagery configured by your Khobra team.</p></div><ServiceCards /></section>

    <section id="why" className="mx-auto max-w-6xl px-6 py-20"><div className="grid overflow-hidden rounded-[2.5rem] bg-slate-950 text-white shadow-2xl lg:grid-cols-2"><div className="p-8 sm:p-14"><Sparkles className="h-10 w-10 text-emerald-400"/><h2 className="mt-7 text-3xl font-black leading-tight sm:text-4xl">A direct path from service selection to a tracked booking request.</h2><p className="mt-6 max-w-lg leading-7 text-white/60">Choose from the live service catalogue, review the estimate, select a time, and keep the booking reference for follow-up.</p></div><div className="grid grid-cols-2 gap-px bg-white/10"><Stat value="01" label="choose a service"/><Stat value="02" label="select a time"/><Stat value="03" label="enter the location"/><Stat value="04" label="receive a reference"/></div></div></section>

    <section id="process" className="mx-auto max-w-6xl px-6 py-24"><div className="text-center"><p className="text-xs font-black uppercase tracking-[.25em] text-emerald-600">Three tiny steps</p><h2 className="mt-3 text-4xl font-black">From messy to effortless.</h2></div><div className="mt-14 grid gap-5 md:grid-cols-3"><Step icon={Sparkles} number="01" title="Choose your clean" text="Browse clear service details and real imagery."/><Step icon={CalendarCheck} number="02" title="Pick a time" text="Choose your date, crew size and duration."/><Step icon={BadgeCheck} number="03" title="We handle it" text="Your request lands directly with operations."/></div></section>

    <section className="mx-auto max-w-6xl px-6 pb-24"><div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-emerald-600 to-teal-500 p-9 text-white shadow-2xl sm:p-14"><div className="absolute -right-12 -top-20 h-72 w-72 rounded-full border-[45px] border-white/10"/><h2 className="relative max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">Your fresh start is one tap away.</h2><p className="relative mt-4 text-white/80">See your price before you confirm. No calls, no confusion.</p><a href="/book" className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 font-black text-emerald-700 shadow-xl">Book a service <ArrowRight className="h-5 w-5"/></a></div></section>
    <footer className="border-t border-emerald-900/10 bg-white/60"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 py-8 sm:flex-row"><Logo size={38}/><p className="text-sm text-slate-500">Professional cleaning, beautifully simple.</p><div className="flex gap-5 text-sm font-semibold"><a href="/book">Book</a><a href="/login">Customer login</a></div></div></footer>
  </main>
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="grid min-h-40 place-content-center p-5 text-center"><p className="text-3xl font-black text-emerald-300">{value}</p><p className="mt-1 text-xs uppercase tracking-widest text-white/50">{label}</p></div> }
function Step({ icon: Icon, number, title, text }: { icon: typeof Sparkles; number: string; title: string; text: string }) { return <div className="rounded-[2rem] border border-white bg-white/70 p-7 shadow-xl shadow-emerald-950/5 backdrop-blur"><div className="flex items-center justify-between"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Icon className="h-6 w-6"/></div><span className="text-4xl font-black text-emerald-950/10">{number}</span></div><h3 className="mt-8 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div> }
