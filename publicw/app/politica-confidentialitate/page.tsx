import Navbar from '@/components/Navbar'
import { operatorDetails } from '@/lib/companyInfo'

export const metadata = {
  title: 'Politica de confidențialitate - Pris Com',
  description: 'Politica de confidențialitate, cookie-uri și reclamații aplicabilă platformei www.pris-com.ro.',
}

const policySections = [
  {
    title: '2. Ce date colectăm',
    paragraphs: [
      'Date de identificare și contact, date despre călătorie, adrese IP, cookie-uri și date tranzacționale (fără date de card).',
    ],
  },
  {
    title: '3. Cum colectăm datele',
    paragraphs: [
      'Colectăm informații prin formularele disponibile în site, prin utilizarea platformei și prin procesatorul de plăți.',
    ],
  },
  {
    title: '4. Scopurile prelucrării',
    paragraphs: [
      'Emiterea biletelor, procesarea plăților, comunicări privind călătoria, îndeplinirea obligațiilor legale și analiza/securitatea platformei.',
    ],
  },
  {
    title: '5. Temeiul legal',
    paragraphs: [
      'Executarea contractului de transport, consimțământul utilizatorului, îndeplinirea obligațiilor legale și interesul legitim.',
    ],
  },
  {
    title: '6. Cui dezvăluim datele',
    paragraphs: [
      'ING WebPay, furnizori IT, parteneri pentru mentenanță și autoritățile competente, atunci când este necesar.',
    ],
  },
  {
    title: '7. Securitatea datelor',
    paragraphs: [
      'Datele sunt protejate prin conexiuni HTTPS, acces controlat și politici interne de backup.',
    ],
  },
  {
    title: '8. Durata păstrării',
    paragraphs: ['Datele se păstrează 5 ani pentru obligații contabile sau atât timp cât este necesar scopului declarat.'],
  },
  {
    title: '9. Drepturile utilizatorilor',
    paragraphs: [
      'Utilizatorii au drept de acces, rectificare, ștergere, restricționare, opoziție și portabilitate a datelor.',
    ],
  },
  {
    title: '10. Politica de cookie-uri',
    paragraphs: [
      'Folosim cookie-uri necesare, de analiză, de preferințe și marketing. Preferințele se pot gestiona din browser.',
    ],
  },
  {
    title: '11. Politica de reclamații',
    paragraphs: [
      'Sesizările se transmit în maximum 3 zile la rezervari@pris-com.ro. Termenul de răspuns este de 30 de zile.',
    ],
  },
  {
    title: '12. Modificări',
    paragraphs: ['Orice actualizare a politicii va fi publicată pe site.'],
  },
  {
    title: '13. Legislație aplicabilă',
    paragraphs: ['Legislația română și GDPR.'],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slatebg text-white">
      <Navbar />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-sm uppercase tracking-wide text-white/50">Document oficial</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Politica cookies/confidențialitate/reclamații</h1>
          <p className="mt-3 text-sm text-white/70">
            Informațiile sunt preluate din documentul „Politica_confidentialitate_priscom.docx” și descriu modul în care Pris Com
            colectează, utilizează și protejează datele personale.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-xl font-semibold">1. Operatorii datelor</h2>
          <p className="mt-3 text-sm text-white/70">
            Datele sunt administrate de operatorii Pris Com enumerați mai jos. Pentru orice solicitare scrie-ne la{' '}
            <a href="mailto:rezervari@pris-com.ro" className="text-white hover:text-brand">
              rezervari@pris-com.ro
            </a>{' '}
            sau sună la{' '}
            <a href="tel:0740470996" className="text-white hover:text-brand">
              0740 470 996
            </a>
            .
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {operatorDetails.map((operator) => (
              <div key={operator.name} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                <p className="font-semibold text-white">{operator.name}</p>
                <p>{operator.cui}</p>
                <p>{operator.reg}</p>
                <p>{operator.address}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {policySections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm text-white/70">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
