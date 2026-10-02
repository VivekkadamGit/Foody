'use client'

import { useEffect, useRef, type ReactNode } from 'react'

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
  const asideRef = useRef<HTMLElement>(null)
  const previousActiveRef = useRef<HTMLElement | null>(null)
  const previousOverflowRef = useRef<string>('')
  const titleId = useRef(`panel-title-${Math.random().toString(36).slice(2)}`).current

  useEffect(() => {
    if (!open) {
      // Restore focus and scroll
      if (previousActiveRef.current) {
        previousActiveRef.current.focus()
        previousActiveRef.current = null
      }
      if (previousOverflowRef.current !== '') {
        document.body.style.overflow = previousOverflowRef.current
        previousOverflowRef.current = ''
      }
      return
    }

    // Remember and lock
    previousActiveRef.current = document.activeElement as HTMLElement
    previousOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus panel
    if (asideRef.current) {
      asideRef.current.focus()
    }

    // Keyboard handlers
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      const focusableElements = asideRef.current ? Array.from(asideRef.current.querySelectorAll(focusableSelector)) : []

      if (focusableElements.length === 0) return

      const activeElement = document.activeElement
      const activeIndex = focusableElements.indexOf(activeElement as Element)

      if (e.shiftKey) {
        // Shift+Tab
        if (activeIndex <= 0) {
          e.preventDefault()
          ;(focusableElements[focusableElements.length - 1] as HTMLElement).focus()
        }
      } else {
        // Tab
        if (activeIndex >= focusableElements.length - 1) {
          e.preventDefault()
          ;(focusableElements[0] as HTMLElement).focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside ref={asideRef} tabIndex={-1} className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl md:w-[480px] animate-[slidein_.18s_ease-out] focus:outline-none">
        <header className="flex items-start justify-between gap-3 border-b border-warm-100 px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate font-anek text-xl font-bold text-charcoal">{title}</h2>
            {subtitle && <p className="truncate font-anek text-[13.5px] text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg h-11 w-11 flex items-center justify-center text-muted hover:bg-warm-100 hover:text-charcoal">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-warm-100 bg-cream/60 px-6 py-4">{footer}</footer>}
      </aside>
    </div>
  )
}
