import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Foody — Best Food in Surat & Vadodara',
  description: 'Genuine food reviews by local testers. Find the best dishes and restaurants in Surat and Vadodara, Gujarat.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-orange-50 text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
