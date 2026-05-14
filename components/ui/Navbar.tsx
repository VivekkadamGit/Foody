'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-orange-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🍽️</span>
          <span className="text-xl font-bold text-orange-600">Foody</span>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link
            href="/surat"
            className={`hover:text-orange-600 transition-colors ${pathname.startsWith('/surat') ? 'text-orange-600' : 'text-gray-600'}`}
          >
            Surat
          </Link>
          <Link
            href="/vadodara"
            className={`hover:text-orange-600 transition-colors ${pathname.startsWith('/vadodara') ? 'text-orange-600' : 'text-gray-600'}`}
          >
            Vadodara
          </Link>
          <Link
            href="/suggest"
            className={`hover:text-orange-600 transition-colors ${pathname === '/suggest' ? 'text-orange-600' : 'text-gray-600'}`}
          >
            🤖 AI Suggest
          </Link>
        </div>
      </div>
    </nav>
  )
}
