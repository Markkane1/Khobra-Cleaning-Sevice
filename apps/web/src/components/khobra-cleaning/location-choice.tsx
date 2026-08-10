'use client'

import { useState } from 'react'
import { Loader2, Map, MapPin, PenLine } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export type Coordinates = { latitude?: number; longitude?: number }

export function LocationChoice({ value, onChange }: { value: Coordinates; onChange: (value: Coordinates) => void }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const hasPin = value.latitude !== undefined && value.longitude !== undefined

  const useCurrentLocation = async () => {
    setError('')
    setLocating(true)
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions({ permissions: ['location'] })
        if (permission.location !== 'granted') throw new Error('Location permission was not granted.')
      }
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 })
      onChange({ latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) })
    } catch (locationError) {
      const message = locationError instanceof Error ? locationError.message : ''
      setError(/permission|denied|0003/i.test(message)
        ? 'Location permission was not granted. You can still enter the address manually.'
        : 'Your location could not be detected. Check GPS and try again, or enter the address manually.')
    } finally {
      setLocating(false)
    }
  }

  const mapsUrl = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${value.latitude},${value.longitude}`)}`
    : ''

  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold text-slate-700">How would you like to provide the location?</legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Address entry method">
        <button type="button" aria-pressed={!hasPin} onClick={() => { onChange({}); setError('') }} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${!hasPin ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
          <PenLine className="h-4 w-4" /> Enter manually
        </button>
        <button type="button" aria-pressed={hasPin} disabled={locating} onClick={() => void useCurrentLocation()} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition disabled:opacity-60 ${hasPin ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {locating ? 'Finding GPS...' : 'Use phone GPS'}
        </button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">{error}</p>}
      {hasPin && <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-bold">GPS pin saved</p><p className="text-xs text-emerald-800">{value.latitude}, {value.longitude}</p></div>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 font-bold text-emerald-800 shadow-sm"><Map className="h-4 w-4" /> View pin in Maps</a>
      </div>}
    </fieldset>
  )
}
