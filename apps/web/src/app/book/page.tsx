import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PublicBooking } from '@/components/khobra-cleaning/public-booking'

export const metadata: Metadata = { title: 'Book a Cleaning | Khobra Cleaning', description: 'Choose a Khobra cleaning service, date and crew, then book instantly.' }
export default function PublicBookingPage() { return <Suspense><PublicBooking /></Suspense> }
