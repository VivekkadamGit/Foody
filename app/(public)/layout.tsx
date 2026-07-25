import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 pt-24 pb-10">{children}</main>
      <Footer />
    </>
  )
}
