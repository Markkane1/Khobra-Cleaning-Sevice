'use client'

import { ArrowLeft } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

export function GlobalBackNavigation() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/captcha') return null

  const goBack = () => {
    if (window.history.length > 1) router.back()
    else if (pathname !== '/home') router.push('/home')
  }

  return <nav aria-label="Page navigation" className="border-b border-border/60 bg-background/90 px-3 py-1.5 backdrop-blur-md sm:px-5">
    <button type="button" onClick={goBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:bg-muted/80" aria-label="Go back">
      <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      <span>Back</span>
    </button>
  </nav>
}
