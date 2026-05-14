import Navbar from '@/components/ui/Navbar'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      <footer className="bg-white border-t border-orange-100 py-8 text-center text-sm text-gray-500 mt-12">
        <p>© 2025 Foody — Genuine food reviews for Surat & Vadodara</p>
      </footer>
    </>
  )
}
