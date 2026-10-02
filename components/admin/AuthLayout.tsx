import type { ReactNode } from 'react'

const WORDS = ['Thali', 'Biryani', 'Dosa', 'Brownie', 'Pav Bhaji', 'Shawarma', 'Chaat', 'Filter Coffee']

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-cream">
      <section className="relative hidden w-[44%] overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0" aria-hidden>
          {WORDS.map((w, i) => (
            <span
              key={w}
              className="absolute font-anek font-bold text-white/[0.06]"
              style={{ top: `${8 + i * 11}%`, left: `${(i * 37) % 70}%`, fontSize: `${36 + (i % 3) * 18}px` }}
            >
              {w}
            </span>
          ))}
        </div>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-baseline">
            <span className="font-anek text-4xl font-extrabold tracking-tight text-ember-light">chakh</span>
            <span className="ml-1 h-2 w-2 rounded-full bg-ember" />
          </div>
          <div>
            <p className="font-anek text-[34px] font-bold leading-tight text-[#fdf9f4]">The honest food guide —<br />back office.</p>
            <p className="mt-3 font-anek text-[15px] text-sand">Score dishes, tag them for search, and keep the city&apos;s list honest.</p>
          </div>
        </div>
      </section>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-baseline lg:hidden">
            <span className="font-anek text-3xl font-extrabold tracking-tight text-ember">chakh</span>
            <span className="ml-1 h-2 w-2 rounded-full bg-ember" />
          </div>
          <h1 className="font-anek text-[28px] font-bold text-charcoal">{title}</h1>
          <p className="mb-7 mt-1 font-anek text-[15px] text-muted">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
