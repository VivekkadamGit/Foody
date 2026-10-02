'use client'

import { useEffect, type ReactNode } from 'react'

/**
 * Right-hand slide-over; full screen below md. Esc/✕/backdrop call onClose — the
 * caller decides whether unsaved changes need a confirm().
 */
export default function SidePanel({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl md:w-[480px] animate-[slidein_.18s_ease-out]">
        <header className="flex items-start justify-between gap-3 border-b border-warm-100 px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate font-anek text-xl font-bold text-charcoal">{title}</h2>
            {subtitle && <p className="truncate font-anek text-[13.5px] text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-warm-100 hover:text-charcoal">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-warm-100 bg-cream/60 px-6 py-4">{footer}</footer>}
      </aside>
    </div>
  )
}
