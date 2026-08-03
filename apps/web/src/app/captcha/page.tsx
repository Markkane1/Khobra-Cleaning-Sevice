'use client'

import { Turnstile } from '@/components/khobra-cleaning/turnstile'

declare global {
  interface Window { ReactNativeWebView?: { postMessage: (message: string) => void } }
}

export default function CaptchaPage() {
  return <main className="grid min-h-screen place-items-center bg-transparent p-1">
    <Turnstile onVerify={token => token && window.ReactNativeWebView?.postMessage(token)} />
  </main>
}
