import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { integerBounds, normalizeInteger, stepInteger } from "./number-input"

const inputClasses = [
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:opacity-50",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive max-sm:h-11 max-sm:text-base",
]

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, value, onChange, min, max, disabled, readOnly, ...props }, ref) => {
  const innerRef = React.useRef<HTMLInputElement>(null)
  React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)

  if (type !== "number") {
    return <input type={type} value={value} data-slot="input" ref={innerRef} disabled={disabled} readOnly={readOnly} className={cn(inputClasses, className)} onChange={onChange} {...props} />
  }

  const bounds = integerBounds(min, max)
  const current = normalizeInteger(value, min, max) ?? bounds.min
  const label = props["aria-label"] || props.name || "value"
  const emit = (next: number) => {
    const input = innerRef.current
    if (!input || !onChange) return
    input.value = String(next)
    onChange({ target: input, currentTarget: input } as React.ChangeEvent<HTMLInputElement>)
  }

  return (
    <div data-slot="number-input" className="relative w-full min-w-0">
      <input
        {...props}
        ref={innerRef}
        type="number"
        inputMode="numeric"
        step={1}
        min={bounds.min}
        max={Number.isFinite(bounds.max) ? bounds.max : undefined}
        value={current}
        disabled={disabled}
        readOnly={readOnly}
        data-slot="input"
        className={cn(inputClasses, "px-12 text-center tabular-nums", className)}
        onChange={event => {
          const next = normalizeInteger(event.currentTarget.value, min, max)
          if (next === null) {
            event.currentTarget.value = String(current)
            return
          }
          event.currentTarget.value = String(next)
          onChange?.(event)
        }}
      />
      <button type="button" aria-label={`Decrease ${label}`} disabled={disabled || readOnly || current <= bounds.min} className="absolute inset-y-0 left-0 grid min-h-11 w-11 place-items-center rounded-l-md border-r text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 sm:min-h-9" onClick={() => emit(stepInteger(current, -1, min, max))}>
        <Minus className="h-4 w-4" />
      </button>
      <button type="button" aria-label={`Increase ${label}`} disabled={disabled || readOnly || current >= bounds.max} className="absolute inset-y-0 right-0 grid min-h-11 w-11 place-items-center rounded-r-md border-l text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 sm:min-h-9" onClick={() => emit(stepInteger(current, 1, min, max))}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
})
Input.displayName = "Input"

export { Input }
