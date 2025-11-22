import Navbar from '@/components/Navbar'
import { operatorDetails } from '@/lib/companyInfo'

export const metadata = {
  title: 'Termeni și condiții - Pris Com',
  description:
    'Termenii și condițiile serviciilor de rezervare și vânzare bilete operate pe www.pris-com.ro.',
}

const termsSections = [
  {
    title: '2. Obiectul serviciului (vânzare bilete)',
    paragraphs: [
      'Site-ul permite rezervarea și achiziția de bilete de călătorie pentru curse operate de transportatori.',
      'Prin finalizarea comenzii se încheie un contract de transport între client și operatorul cursei.',
    ],
  },
  {
    title: '3. Prețuri și modalități de plată',
    paragraphs: [
      'Tarifele sunt afișate în RON și pot fi actualizate fără notificare prealabilă.',
      'Plata se efectuează exclusiv prin ING WebPay, iar site-ul nu stochează datele cardului.',
      'Eventualele comisioane ING sunt afișate în timpul comenzii, înainte de finalizare.',
    ],
  },
  {
    title: '4. Livrarea produsului (biletul)',
    paragraphs: ['Biletul este livrat electronic prin email după confirmarea plății.'],
  },
  {
    title: '5. Anulare, retur și rambursare',
    paragraphs: [
      'Anularea este posibilă până la limita afișată în sistem și poate implica reținerea taxelor procesatorului ING.',
      'Reprogramarea este permisă în limita locurilor disponibile.',
      'În caz de no-show nu se acordă rambursare. Rambursările aprobate se procesează în același cont/card în 3–7 zile.',
    ],
  },
  {
    title: '6. Întârzieri și modificări',
    paragraphs: [
      'Transportatorul nu este responsabil pentru întârzieri cauzate de trafic, vreme, controale sau închideri de drum.',
      'În cazul unei defecțiuni majore, vehiculul este înlocuit în maximum 24 de ore.',
    ],
  },
  {
    title: '7. Reclamații',
    paragraphs: [
      'Reclamațiile se trimit în maximum 3 zile de la călătorie la rezervari@pris-com.ro sau la 0740 470 996.',
      'Termenul de răspuns este de cel mult 30 de zile.',
    ],
  },
  {
    title: '8. Reduceri copii',
    paragraphs: [
      'Reducerile sunt afișate în sistem și pot necesita prezentarea unui document justificativ la urcare.',
    ],
  },
  {
    title: '9. Forța majoră',
    paragraphs: ['Situațiile de forță majoră exonerează transportatorul de orice răspundere.'],
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slatebg text-white">
      <Navbar />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-sm uppercase tracking-wide text-white/50">Document oficial</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Termeni și condiții</h1>
          <p className="mt-3 text-sm text-white/70">
            Termenii sunt extrași din documentul „Termeni_conditii_priscom.docx” și descriu condițiile comerciale aplicabile
            serviciilor Pris Com.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-xl font-semibold">1. Informații despre operatori</h2>
          <p className="mt-3 text-sm text-white/70">
            Serviciile de transport sunt efectuate de următorii operatori, iar platforma www.pris-com.ro este administrată
            tehnic de SC AUTO DIMAS SRL.
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
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
            <p className="font-semibold text-white">Contact suport rezervări</p>
            <p>
              Email:{' '}
              <a href="mailto:rezervari@pris-com.ro" className="text-white hover:text-brand">
                rezervari@pris-com.ro
              </a>
            </p>
            <p>
              Telefon:{' '}
              <a href="tel:0740470996" className="text-white hover:text-brand">
                0740 470 996
              </a>
            </p>
          </div>
        </section>

        <section className="space-y-6">
          {termsSections.map((section) => (
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
