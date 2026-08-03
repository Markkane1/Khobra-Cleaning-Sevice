'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
    }
  }
}

const TEST_SITE_KEY = '1x00000000000000000000AA'

export function Turnstile({ onVerify }: { onVerify: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let widgetId = ''
    let cancelled = false
    const render = () => {
      if (cancelled || !container.current || !window.turnstile) return
      widgetId = window.turnstile.render(container.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE_KEY,
        theme: 'auto',
        size: 'flexible',
        callback: onVerify,
        'expired-callback': () => onVerify(''),
        'error-callback': () => onVerify(''),
      })
    }
    if (window.turnstile) render()
    else {
      let script = document.querySelector<HTMLScriptElement>('script[data-khobra-turnstile]')
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.dataset.khobraTurnstile = 'true'
        document.head.appendChild(script)
      }
      script.addEventListener('load', render, { once: true })
    }
    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onVerify])

  return <div ref={container} className="min-h-[65px] w-full overflow-hidden rounded-lg" aria-label="Bot verification" />
}
