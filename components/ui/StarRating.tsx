export default function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sizeCls = size === 'md' ? 'text-xl' : 'text-sm'
  return (
    <span className={`${sizeCls} tracking-tight`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(rating) ? 'text-amber-400' : 'text-gray-300'}>★</span>
      ))}
    </span>
  )
}
