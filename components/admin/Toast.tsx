'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const ToastContext = createContext<(text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null)
  const toast = useCallback((t: string) => {
    setText(t)
    window.setTimeout(() => setText((cur) => (cur === t ? null : cur)), 2500)
  }, [])
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[60]">
        {text && (
          <div className="rounded-xl bg-ink px-4 py-3 font-anek text-[14px] font-medium text-[#fdf9f4] shadow-xl">✓ {text}</div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
