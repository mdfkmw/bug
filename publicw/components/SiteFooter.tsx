import Link from 'next/link'
import CardBrandLogos from './CardBrandLogos'
import { operatorDetails } from '@/lib/companyInfo'

const policyLinks = [
  { href: '/termeni-si-conditii', label: 'Termeni și condiții' },
  { href: '/politica-confidentialitate', label: 'Politica cookies/confidențialitate/reclamații' },
  { href: '/contact', label: 'Contact' },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/40 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row md:justify-between">
        <div className="space-y-4 text-sm text-white/70 md:max-w-lg">
          <h2 className="text-lg font-semibold text-white">Operatori și date de identificare</h2>
          <div className="space-y-3">
            {operatorDetails.map((operator) => (
              <div key={operator.name}>
                <p className="font-semibold text-white">{operator.name}</p>
                <p>{operator.cui} • {operator.reg}</p>
                <p>{operator.address}</p>
              </div>
            ))}
          </div>
          <p>
            Pentru sesizări rapide ne poți scrie la{' '}
            <a href="mailto:rezervari@pris-com.ro" className="text-white hover:text-brand font-medium">
              rezervari@pris-com.ro
            </a>{' '}sau la telefon{' '}
            <a href="tel:0740470996" className="text-white hover:text-brand font-medium">
              0740 470 996
            </a>.
          </p>
        </div>

        <div className="space-y-4 text-sm text-white/70 md:w-72">
          <h2 className="text-lg font-semibold text-white">Resurse utile</h2>
          <ul className="space-y-2">
            {policyLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-brand">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="https://reclamatiisal.anpc.ro/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-brand"
              >
                Link ANPC / SOL
              </a>
            </li>
          </ul>
          <div>
            <h3 className="text-base font-semibold text-white">Plăți securizate ING WebPay</h3>
            <p className="mt-2">
              E-shopul nu stochează datele cardului. Tranzacțiile sunt securizate și monitorizate de ING Bank.
            </p>
            <CardBrandLogos size="md" className="mt-4" />
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Pris Com. Toate drepturile rezervate.
      </div>
    </footer>
  )
}
