import Image from 'next/image'

interface CardBrandLogosProps {
  size?: 'md' | 'lg'
  className?: string
}

const createSvgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

const visaSvg = createSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">
    <rect width="120" height="40" rx="6" fill="#ffffff" stroke="#e5e7eb" />
    <text
      x="60"
      y="26"
      font-size="22"
      font-weight="700"
      font-family="'Arial Black', 'Segoe UI', sans-serif"
      text-anchor="middle"
      fill="#1a1f71"
    >
      VISA
    </text>
  </svg>
`)

const mastercardSvg = createSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">
    <rect width="120" height="40" rx="6" fill="#ffffff" stroke="#e5e7eb" />
    <circle cx="55" cy="20" r="12" fill="#ea001b" />
    <circle cx="65" cy="20" r="12" fill="#ff5f00" fill-opacity="0.85" />
    <circle cx="65" cy="20" r="12" fill="#f79e1b" fill-opacity="0.65" />
  </svg>
`)

const logos = [
  {
    src: visaSvg,
    alt: 'Logo Visa stilizat',
    width: 120,
    height: 40,
  },
  {
    src: mastercardSvg,
    alt: 'Logo Mastercard stilizat',
    width: 120,
    height: 40,
  },
]

export default function CardBrandLogos({ size = 'md', className }: CardBrandLogosProps) {
  const height = size === 'lg' ? 52 : 42
  const classes = ['flex items-center gap-4', className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      {logos.map((logo) => (
        <Image
          key={logo.alt}
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          style={{ height, width: (height / logo.height) * logo.width }}
          className="drop-shadow-sm"
          unoptimized
        />
      ))}
    </div>
  )
}
