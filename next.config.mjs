/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server for the AWS container (Dockerfile). Vercel ignores it.
  output: 'standalone',
  images: {
    remotePatterns: [
      // Supabase storage
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      // Common image CDNs
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default nextConfig;
