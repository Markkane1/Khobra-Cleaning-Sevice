import type { Metadata } from 'next'
import { PublicLanding } from '@/components/khobra-cleaning/public-site'

export const metadata: Metadata = { title: 'Khobra Cleaning | A cleaner space, effortlessly', description: 'Professional home and commercial cleaning in Dubai. Explore services and book online in under a minute.' }
export default function PublicHomePage() { return <PublicLanding /> }
