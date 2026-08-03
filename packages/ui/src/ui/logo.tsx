import React from 'react'

interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
  textClassName?: string
  subtextClassName?: string
}

export function Logo({
  size = 48,
  showText = true,
  className = '',
  textClassName = 'font-bold text-sm truncate',
  subtextClassName = 'text-[10px] text-muted-foreground truncate',
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="relative overflow-hidden rounded-xl shadow-sm border border-emerald-500/20 shrink-0 flex items-center justify-center bg-white"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Khobra Cleaning Service Logo"
          className="w-full h-full object-contain"
        />
      </div>
      {showText && (
        <div className="flex-1 min-w-0 leading-tight">
          <h2 className={textClassName}>Khobra Cleaning</h2>
          <p className={subtextClassName}>Service Operations</p>
        </div>
      )}
    </div>
  )
}


