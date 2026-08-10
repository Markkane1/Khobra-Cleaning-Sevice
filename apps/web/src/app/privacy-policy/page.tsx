import type { Metadata } from 'next'
import { Logo } from '@/components/ui/logo'

export const metadata: Metadata = {
  title: 'Privacy Policy | Khobra Cleaning',
  description: 'How Khobra Cleaning collects, uses, stores, and protects personal data.',
}

const privacyEmail = 'info@khobraaalsahraa.com'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f3fbf8] text-slate-900">
      <header className="border-b border-emerald-900/10 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="/home" className="flex min-h-11 items-center" aria-label="Khobra Cleaning home">
            <Logo size={40} textClassName="text-sm font-black text-slate-950" subtextClassName="text-[10px] text-emerald-600" />
          </a>
          <a href="/home" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50">Back to home</a>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Legal</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm font-semibold text-slate-500">Effective date: 11 August 2026</p>

          <div role="note" className="mt-7 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>Company contact:</strong> Khobraa Alsahraa Cleaning Services, UAE. Phone: +971 50 618 4182.
          </div>

          <div className="mt-10 space-y-10 text-base leading-7 text-slate-700">
            <PolicySection title="1. Who we are">
              <p>Khobraa Alsahraa Cleaning Services, operating in the UAE, is the controller responsible for the personal data described in this policy.</p>
              <ul>
                <li>Privacy email: {privacyEmail}</li>
                <li>Business address: Office no. F1-281, Green Community Lake Apartment building 4, DIP 1, Dubai, UAE</li>
              </ul>
            </PolicySection>

            <PolicySection title="2. Scope">
              <p>This policy applies to the Khobra Cleaning website, customer booking service, native mobile applications, mobile web wrapper, and operational portals used by authorized customers, administrators, cleaners, drivers, and other personnel.</p>
              <p>It explains what personal data we process, why we process it, who may receive it, how long we keep it, and the choices and rights available to you.</p>
            </PolicySection>

            <PolicySection title="3. Personal data we process">
              <p>Depending on how you use Khobra Cleaning, we may process:</p>
              <ul>
                <li><strong>Account and profile data:</strong> name, email, phone number, password hash, profile photo, role, account status, and last login information.</li>
                <li><strong>Address, optional GPS, and booking data:</strong> saved addresses, service address, city, area, optional precise latitude and longitude when you choose phone GPS, requested service, appointment details, duration, crew size, notes, preferences, recurrence, status, cancellation or no-show information, and staff assignments.</li>
                <li><strong>Payment and transaction data:</strong> payment method, invoices, amounts, bank transfer details, payment proof, verification remarks, and transaction history. The current service does not collect payment card numbers.</li>
                <li><strong>Communications and content:</strong> complaints, responses, resolution notes, ratings, comments, and files or images you choose to upload.</li>
                <li><strong>Notification data:</strong> in-app notification records, browser push subscriptions, and mobile push tokens.</li>
                <li><strong>Workforce and operational data:</strong> contact and address details, employee or driver identifiers, skills, attendance, leave, payroll or salary information, driver licence and vehicle information, trips, mileage, expenses, fuel costs, and receipts.</li>
                <li><strong>Technical and security data:</strong> IP address used for rate limits and security, session identifiers, request identifiers, device or browser security signals, and limited server error records.</li>
                <li><strong>Device permissions and local storage:</strong> foreground location permission only when you choose phone GPS, optional notification permission, secure native session storage, and limited mobile wrapper storage for push status, tokens, and pending navigation.</li>
              </ul>
              <p>Manual address entry remains available. The app requests a one-time foreground GPS reading only after you select <strong>Use phone GPS</strong>. It stores the resulting latitude and longitude with the saved service address and booking. It does not collect background or continuous location. We do not currently use advertising SDKs, behavioral advertising trackers, contacts, microphone, or broad device storage access.</p>
            </PolicySection>

            <PolicySection title="4. How we use personal data">
              <p>We use personal data to:</p>
              <ul>
                <li>create and secure accounts;</li>
                <li>provide estimates, manage bookings, and deliver cleaning services;</li>
                <li>assign cleaners and drivers and coordinate service delivery;</li>
                <li>send account, booking, payment, complaint, and operational communications;</li>
                <li>process and verify payments and maintain transaction records;</li>
                <li>provide support and resolve complaints or disputes;</li>
                <li>manage authorized workforce operations, payroll, dispatch, expenses, and permissions;</li>
                <li>prevent fraud, abuse, unauthorized access, and excessive automated requests;</li>
                <li>maintain and secure the service; and</li>
                <li>comply with legal, accounting, regulatory, and law enforcement obligations.</li>
              </ul>
              <p>We do not use personal data for third-party behavioral advertising and we do not sell personal data.</p>
            </PolicySection>

            <PolicySection title="5. Legal grounds">
              <p>Where the UAE Federal Personal Data Protection Law applies, we rely on contract necessity, applicable legal obligations, permitted security and legal-claim purposes, permitted employment administration, or consent where consent is required.</p>
              <p>When consent is the applicable ground, you may withdraw it at any time. Withdrawal does not affect earlier lawful processing or processing permitted on another legal ground.</p>
            </PolicySection>

            <PolicySection title="6. Who receives personal data">
              <p>We disclose only information reasonably needed for the relevant purpose to:</p>
              <ul>
                <li>authorized administrators, support personnel, cleaners, and drivers;</li>
                <li>our hosting and database providers;</li>
                <li>Cloudinary for user-selected images and files;</li>
                <li>Cloudflare Turnstile for bot and misuse detection;</li>
                <li>Google Firebase Cloud Messaging, Apple Push Notification service, and browser push providers for notifications;</li>
                <li>Google Maps, only when you choose to open a saved GPS pin in Maps, which receives the coordinates included in that link;</li>
                <li>professional advisers, auditors, insurers, or corporate transaction participants where necessary; and</li>
                <li>courts, regulators, or law enforcement where disclosure is required or permitted by law.</li>
              </ul>
              <p>Service providers may process personal data only for the services they provide to us, subject to their contracts and applicable law. We do not permit them to use Khobra Cleaning data for their own advertising.</p>
            </PolicySection>

            <PolicySection title="7. Cookies, sessions, and similar storage">
              <p>The web service uses an essential secure session cookie. The native app stores its session token in secure device storage. The mobile web wrapper uses limited local storage for push status and navigation. We do not currently use analytics or advertising cookies.</p>
            </PolicySection>

            <PolicySection title="8. International processing">
              <p>Some providers may process or store personal data outside the UAE. Before a transfer, we are responsible for assessing the destination and applying contractual or other safeguards required by applicable UAE data protection law.</p>
            </PolicySection>

            <PolicySection title="9. Retention and deletion">
              <p>We keep personal data only as long as reasonably needed to provide the service, maintain account and transaction history, handle complaints and disputes, prevent fraud, and meet legal, accounting, tax, employment, or regulatory requirements.</p>
              <p>Different records require different periods. When data is no longer needed, we will delete it, anonymize it, or securely isolate it until deletion is possible. Account deactivation does not automatically delete associated records that must be retained for a permitted purpose.</p>
            </PolicySection>

            <PolicySection title="10. Security">
              <p>Our safeguards include password hashing, encrypted HTTPS connections for the production mobile service, secure session controls, role-based access restrictions, and protected device storage for native app sessions. No system is completely secure. Please protect your password and notify us if you believe your account or personal data has been compromised.</p>
            </PolicySection>

            <PolicySection title="11. Your privacy rights">
              <p>Subject to applicable law and its exceptions, you may request information, access, portable data, correction, deletion, restriction, objection, consent withdrawal, or an end to certain processing. You may also complain to the competent data protection authority.</p>
              <p>Contact {privacyEmail} for these requests. We may verify your identity and clarify the request&apos;s scope. We may retain or refuse to delete information where an exception or legal obligation applies and will explain the reason when required.</p>
            </PolicySection>

            <PolicySection title="12. Account deletion">
              <p>Customers can delete an authenticated account in Profile → Security, or submit a <a className="font-semibold text-emerald-700 underline" href="/delete-account">public deletion request</a>. Information that we are legally permitted or required to retain remains protected and limited to the permitted purpose. This policy is draft-only until legal company details and a monitored privacy contact are supplied.</p>
            </PolicySection>

            <PolicySection title="13. Notifications">
              <p>Push notifications are optional and can be disabled in your device or browser settings. This does not stop essential service communications that we are permitted to send through other channels.</p>
            </PolicySection>

            <PolicySection title="14. Children">
              <p>Khobra Cleaning is not designed for children under 18, and we do not knowingly seek to create accounts for them. Contact {privacyEmail} if you believe a child has provided personal data.</p>
            </PolicySection>

            <PolicySection title="15. Changes to this policy">
              <p>We may update this policy when our service, providers, or legal obligations change. We will publish the updated policy with a new effective date and provide additional notice when required.</p>
            </PolicySection>

            <PolicySection title="16. UAE legal framework">
              <p>This policy is designed with reference to UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data and applies to Khobraa Alsahraa Cleaning Services&apos; UAE operations.</p>
              <p><a className="font-bold text-emerald-700 underline underline-offset-4" href="https://uaelegislation.gov.ae/en/legislations/1972" rel="noreferrer" target="_blank">Read the official UAE legislation</a></p>
            </PolicySection>
          </div>
        </div>
      </article>
    </main>
  )
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      <div className="space-y-4 [&_li]:ml-5 [&_li]:pl-1 [&_li]:marker:text-emerald-600 [&_ul]:list-disc [&_ul]:space-y-2">{children}</div>
    </section>
  )
}
