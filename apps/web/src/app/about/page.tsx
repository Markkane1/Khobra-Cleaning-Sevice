import type { Metadata } from 'next'
import { ArrowRight, CalendarCheck, CheckCircle2, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { Logo } from '@/components/ui/logo'

export const metadata: Metadata = {
  title: 'About Us | Khobraa Alsahraa Cleaning Services',
  description: 'Professional residential and commercial cleaning services in Dubai, UAE.',
}

const principles = [
  { icon: ShieldCheck, title: 'Dependable service', text: 'Clear booking details, accountable teams, and a process designed around your schedule.' },
  { icon: Sparkles, title: 'Care in every space', text: 'A thoughtful approach to homes, offices, and the places where everyday life happens.' },
  { icon: CheckCircle2, title: 'Simple from the start', text: 'Straightforward service choices, visible estimates, and an easy path from request to completion.' },
]

export default function AboutPage() {
  return <main className="min-h-dvh overflow-hidden bg-[#f3fbf8] text-slate-950">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <a href="/" className="flex min-h-11 items-center" aria-label="Khobra Cleaning home"><Logo size={42} textClassName="text-sm font-black" subtextClassName="text-[10px] text-emerald-600" /></a>
      <nav className="flex items-center gap-2 text-sm font-bold text-slate-600">
        <a href="/" className="flex min-h-11 items-center rounded-xl px-3 transition hover:bg-white hover:text-slate-950">Home</a>
        <a href="/privacy-policy" className="hidden min-h-11 items-center rounded-xl px-3 transition hover:bg-white hover:text-slate-950 sm:flex">Privacy</a><a href="/book" className="flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700">Book now</a>
      </nav>
    </header>

    <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pt-20">
      <div className="absolute -left-36 top-4 h-96 w-96 rounded-full bg-emerald-300/25 blur-3xl" />
      <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[.24em] text-emerald-700">Dubai, UAE</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[1.02] tracking-[-.05em] sm:text-6xl">Professional cleaning for homes and workplaces.</h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">Khobra Cleaning connects customers with professional cleaning services through a clear, modern booking experience. We focus on making every step—from choosing a service to receiving a booking reference—easy to understand.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href="/book" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-7 font-bold text-white shadow-xl transition hover:bg-emerald-700">Book a service <ArrowRight className="h-5 w-5" /></a>
          <a href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-7 font-bold text-slate-800 transition hover:border-emerald-300">Create an account</a>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-xl">
        <div className="absolute -inset-5 rotate-3 rounded-[3rem] bg-gradient-to-br from-emerald-400 to-cyan-400 opacity-20 blur-2xl" />
        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-[0_40px_90px_-30px_rgba(6,78,59,.55)] sm:p-10">
          <div className="flex items-center justify-between"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Sparkles className="h-7 w-7" /></div><span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white/60">Professional care</span></div>
          <h2 className="mt-10 text-3xl font-black tracking-tight">Clear booking. Reliable service.</h2>
          <p className="mt-4 leading-7 text-white/60">Transparent cleaner-hour pricing, materials options, and clear booking updates from request to service.</p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><CalendarCheck className="h-6 w-6 text-emerald-300" /><p className="mt-4 font-bold">Convenient booking</p><p className="mt-1 text-sm leading-6 text-white/50">Choose the service, date, time, and crew size online.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><UsersRound className="h-6 w-6 text-cyan-300" /><p className="mt-4 font-bold">Human service</p><p className="mt-1 text-sm leading-6 text-white/50">Your request goes directly to the operations team.</p></div>
          </div>
        </div>
      </div>
    </section>

    <section className="bg-white/70 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[.24em] text-emerald-700">What guides us</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">A better service experience starts before arrival.</h2></div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">{principles.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-[2rem] border border-slate-100 bg-white p-7 shadow-[0_22px_60px_-35px_rgba(15,118,110,.35)]"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Icon className="h-6 w-6" /></div><h3 className="mt-7 text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></article>)}</div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-6 py-24"><div className="overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-emerald-600 to-teal-500 p-9 text-white shadow-2xl sm:flex sm:items-center sm:justify-between sm:gap-10 sm:p-14"><div><h2 className="text-3xl font-black tracking-tight sm:text-4xl">Ready for a cleaner space?</h2><p className="mt-3 text-white/80">Book as a guest now, or create an account for easier repeat bookings.</p></div><a href="/book" className="mt-7 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-6 font-black text-emerald-700 shadow-xl sm:mt-0">Start booking <ArrowRight className="h-5 w-5" /></a></div></section>

    <footer className="border-t border-emerald-900/10 bg-white/60"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 py-8 sm:flex-row"><Logo size={38}/><p className="text-center text-sm text-slate-500">Khobraa Alsahraa Cleaning Services · +971 50 618 4182 · Dubai, UAE</p><div className="flex gap-2 text-sm font-semibold"><a href="/privacy-policy" className="flex min-h-11 items-center px-3">Privacy</a><a href="/book" className="flex min-h-11 items-center px-3">Book</a><a href="/signup" className="flex min-h-11 items-center px-3">Sign up</a></div></div></footer>
  </main>
}
