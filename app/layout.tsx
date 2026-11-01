import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import RecoveryRedirect from '@/components/RecoveryRedirect'

// Font files live in app/fonts (Latin subset, from Google Fonts, OFL licence) so the build
// never downloads them: Google sometimes answers build servers with links next/font/google can't read.
const playfair = localFont({
  src: './fonts/playfair-display.woff2',
  weight: '400 900',
  variable: '--font-playfair',
  display: 'swap',
})

const dmSans = localFont({
  src: './fonts/dm-sans.woff2',
  weight: '300 700',
  variable: '--font-dm-sans',
  display: 'swap',
})

const anekLatin = localFont({
  src: './fonts/anek-latin.woff2',
  weight: '400 800',
  variable: '--font-anek',
  display: 'swap',
})

const barlowCondensed = localFont({
  src: [
    { path: './fonts/barlow-condensed-500.woff2', weight: '500' },
    { path: './fonts/barlow-condensed-600.woff2', weight: '600' },
    { path: './fonts/barlow-condensed-700.woff2', weight: '700' },
  ],
  variable: '--font-barlow',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Chakh — The Honest Food Guide',
  description: 'Genuine food reviews by local testers. Find the best dishes and restaurants across India.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${dmSans.variable} ${anekLatin.variable} ${barlowCondensed.variable} font-body bg-cream text-charcoal antialiased`}>
        <RecoveryRedirect />
        {children}
      </body>
    </html>
  )
}
