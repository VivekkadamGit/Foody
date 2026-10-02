'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { DishStatus } from '@/lib/admin/dishStatus'

const VARIANTS = {
  primary: 'bg-ember text-white hover:bg-[#c43e23] disabled:bg-warm-200 disabled:text-muted',
  secondary: 'bg-white text-charcoal border border-warm-200 hover:border-ember/60',
  danger: 'bg-white text-spice border border-spice/40 hover:bg-spice hover:text-white',
  ghost: 'text-muted hover:text-charcoal',
} as const

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-anek text-[14px] font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  )
}

export function Field({ label, hint, error, htmlFor, children }: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-anek text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="font-anek text-[13px] text-spice">{error}</p>
      ) : hint ? (
        <p className="font-anek text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL =
  'w-full rounded-lg border border-warm-200 bg-cream px-3.5 py-2.5 font-anek text-[15px] text-charcoal placeholder:text-muted/70 focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20'

// forwardRef so callers (e.g. Google Places autocomplete) can attach a ref to the real <input>.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input {...props} ref={ref} className={`${CONTROL} ${props.className ?? ''}`} />
})

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} resize-none ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ''}`} />
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-anek text-[13px] font-medium transition-colors ${
        selected ? 'border-ember bg-ember text-white' : 'border-warm-200 bg-white text-charcoal hover:border-ember/60'
      }`}
    >
      {children}
    </button>
  )
}

const BADGE: Record<DishStatus, { cls: string; text: string }> = {
  needs_tags: { cls: 'bg-[#fdf0ea] text-spice-dark border-[#f2c9bb]', text: 'Needs tags' },
  needs_score: { cls: 'bg-[#fff6e6] text-[#8a5a12] border-[#f1d9a8]', text: 'Needs score' },
  scored: { cls: 'bg-[#eaf7f0] text-[#1f7a52] border-[#bfe6d2]', text: 'Scored' },
  deleted: { cls: 'bg-warm-100 text-muted border-warm-200', text: 'Deleted' },
}

export function StatusBadge({ status }: { status: DishStatus }) {
  const b = BADGE[status]
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 font-anek text-[11.5px] font-semibold ${b.cls}`}>
      {b.text}
    </span>
  )
}

export function EmptyState({ icon = '🍽️', text, action }: { icon?: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-warm-200 bg-white/60 px-6 py-12 text-center">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <p className="mt-2 font-anek text-[15px] text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
