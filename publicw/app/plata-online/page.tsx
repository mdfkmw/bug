import Navbar from '@/components/Navbar'
import CardBrandLogos from '@/components/CardBrandLogos'

export const metadata = {
  title: 'Plată online ING WebPay - Pris Com',
  description:
    'Detalii despre plata online prin ING WebPay, termeni și condiții, politica de confidențialitate și obligațiile legale ale magazinului online Pris Com.',
}

const ingRoles = [
  {
    title: 'User API',
    description: 'inițiază tranzacțiile și validează răspunsurile WebPay în aplicația de rezervări.',
  },
  {
    title: 'User Tranzacționare',
    description: 'poate modifica sau anula tranzacții (preautorizare, reversal, refund) în consola ING WebPay.',
  },
  {
    title: 'User Raportare',
    description: 'vizualizează și exportă rapoarte cu tranzacțiile autorizate sau returnate.',
  },
]

const complianceChecklist = [
  'Produse/servicii și tarife comunicate în lei pe pagina de rezervare.',
  'Termeni și condiții afișați mai jos, actualizați 2025.',
  'Politică de confidențialitate, cookie-uri și reclamații.',
  'Datele firmelor (CUI, denumire, adresă, telefon, e-mail, țară) afișate atât aici cât și în footer.',
  'Link către ANPC/SOL și informații de contact pentru reclamații.',
  'Afișarea siglelor Visa și Mastercard pentru plățile card.',
]

const productsAndServices = [
  {
    title: 'Bilete de transport persoane',
    description:
      'Rezervări și vânzări de bilete pentru curse regulate operate de SC PRIS COM UNIVERS SRL și SC AUTO DIMAS SRL. Tarifele afișate în interfață sunt exprimate în RON și includ TVA.',
  },
  {
    title: 'Servicii conexe',
    description:
      'Reprogramări în limita locurilor disponibile, reduceri pentru copii conform tarifelor afișate, emiterea documentelor fiscale și transmiterea biletelor electronice.',
  },
]

const operatori = [
  {
    title: 'SC PRIS COM UNIVERS SRL',
    content: [
      'CUI 4584735',
      'Nr. Reg. Comerțului J07/842/11.08.1993',
      'Sediu: Str. Principală, Flămânzi, județul Botoșani, România',
    ],
  },
  {
    title: 'SC AUTO DIMAS SRL',
    content: [
      'CUI RO14327313',
      'Nr. Reg. Comerțului J2001001104227',
      'Sediu: Șos. Moara de Foc nr. 15A, Iași, România',
    ],
  },
]

const termsSections = [
  {
    title: '1. Informații despre operatori',
    points: [
      'Serviciile de transport sunt efectuate de SC PRIS COM UNIVERS SRL și SC AUTO DIMAS SRL.',
      'Platforma www.pris-com.ro este administrată tehnic de SC AUTO DIMAS SRL.',
      'Suport rezervări: rezervari@pris-com.ro / 0740 470 996.',
    ],
  },
  {
    title: '2. Obiectul serviciului',
    points: [
      'Site-ul permite rezervarea și achiziția de bilete de călătorie pentru curse operate de transportatori.',
      'Prin finalizarea comenzii se încheie un contract de transport între client și operatorul cursei.',
    ],
  },
  {
    title: '3. Prețuri și modalități de plată',
    points: [
      'Tarifele sunt afișate în RON și pot include reduceri afișate în interfață.',
      'Plata se efectuează exclusiv online prin ING WebPay, iar site-ul nu stochează datele cardului.',
      'Eventualele comisioane ING sunt afișate în timpul comenzii.',
    ],
  },
  {
    title: '4. Livrarea produsului (biletul)',
    points: ['Biletul este livrat electronic prin email după confirmarea plății.'],
  },
  {
    title: '5. Anulare, retur și rambursare',
    points: [
      'Anularea este posibilă până la limita afișată în sistem; taxele procesatorului ING pot fi reținute.',
      'Reprogramarea este permisă în limita locurilor disponibile.',
      'No-show nu generează rambursare; rambursările aprobate se fac în același cont/card în 3–7 zile.',
    ],
  },
  {
    title: '6. Întârzieri și modificări',
    points: [
      'Transportatorul nu este responsabil pentru întârzieri cauzate de trafic, vreme, controale sau lucrări.',
      'În caz de defecțiune majoră, vehiculul este înlocuit în maximum 24 de ore.',
    ],
  },
  {
    title: '7. Reclamații',
    points: [
      'Reclamațiile se trimit în maximum 3 zile de la călătorie la rezervari@pris-com.ro sau 0740 470 996.',
      'Termenul de răspuns este de maximum 30 de zile.',
    ],
  },
  {
    title: '8. Reduceri copii',
    points: ['Reducerile sunt afișate în sistem și pot necesita document justificativ la urcarea în autocar.'],
  },
  {
    title: '9. Forța majoră',
    points: ['Situațiile de forță majoră exonerează transportatorul de orice răspundere.'],
  },
]

const privacySections = [
  {
    title: '1. Operatorii datelor',
    points: [
      'SC PRIS COM UNIVERS SRL și SC AUTO DIMAS SRL procesează datele colectate prin www.pris-com.ro.',
      'Contact date personale: rezervari@pris-com.ro | 0740 470 996.',
    ],
  },
  {
    title: '2. Ce date colectăm',
    points: [
      'Date de identificare și contact ale pasagerilor.',
      'Date despre călătorie, IP, cookie-uri și date tranzacționale fără stocarea datelor de card.',
    ],
  },
  {
    title: '3. Cum colectăm datele',
    points: ['Prin formularele de rezervare, utilizarea site-ului și prin procesatorul de plăți ING WebPay.'],
  },
  {
    title: '4. Scopurile prelucrării',
    points: [
      'Emiterea biletelor și procesarea plăților.',
      'Comunicări operaționale și obligații legale.',
      'Analiză și securitate pentru prevenirea fraudelor.',
    ],
  },
  {
    title: '5. Temeliul legal',
    points: ['Executarea contractului, consimțământ, obligație legală și interes legitim.'],
  },
  {
    title: '6. Destinatari',
    points: ['ING WebPay, furnizori IT și autorități atunci când legea impune.'],
  },
  {
    title: '7. Securitate & păstrare',
    points: [
      'Infrastructura folosește HTTPS, acces controlat și backup-uri periodice.',
      'Datele sunt păstrate 5 ani pentru obligații contabile sau cât este necesar pentru scopul colectării.',
    ],
  },
  {
    title: '8. Drepturile utilizatorilor',
    points: [
      'Acces, rectificare, ștergere, restricționare, opoziție și portabilitate.',
      'Solicitările se transmit la rezervari@pris-com.ro și sunt soluționate în maximum 30 de zile.',
    ],
  },
  {
    title: '9. Politica de cookie-uri și reclamații',
    points: [
      'Folosim cookie-uri necesare, de analiză, preferințe și marketing conform opțiunilor din browser.',
      'Sesizările privind prelucrarea datelor sau experiența de plată se trimit în maximum 3 zile de la eveniment.',
    ],
  },
  {
    title: '10. Modificări și legislație',
    points: ['Actualizările politicii se publică pe site. Se aplică legislația română și GDPR.'],
  },
]

const termsDocParagraphs = [
  'TERMENI ȘI CONDIȚII – www.pris-com.ro',
  'Actualizat: 2025',
  '1. Informații despre operatori',
  'Serviciile de transport sunt efectuate de:',
  'SC PRIS COM UNIVERS SRL',
  'J07/842/11.08.1993',
  'CUI 4584735',
  'Str. Principală, Flămânzi, Botoșani',
  'SC AUTO DIMAS SRL',
  'J2001001104227',
  'CUI RO14327313',
  'Sos. Moara de Foc nr. 15A, Iași',
  'Platforma www.pris-com.ro este administrată tehnic de SC AUTO DIMAS SRL.',
  'Contact suport rezervări:',
  'Email: rezervari@pris-com.ro',
  'Telefon: 0740 470 996',
  '2. Obiectul serviciului (vânzare bilete)',
  'Site-ul permite rezervarea și achiziția de bilete de călătorie pentru curse operate de transportatori.',
  'Prin finalizarea comenzii se încheie un contract de transport între client și operatorul cursei.',
  '3. Prețuri și modalități de plată',
  'Tarifele sunt afișate în RON.',
  'Plata se efectuează prin ING WebPay.',
  'Site-ul nu stochează datele cardului.',
  'Eventualele comisioane ING sunt afișate în timpul comenzii.',
  '4. Livrarea produsului (biletul)',
  'Biletul este livrat electronic prin email după confirmarea plății.',
  '5. Anulare, retur și rambursare',
  'Anularea este posibilă până la limita afișată în sistem.',
  'La anulare se pot reține taxele procesatorului ING.',
  'Reprogramarea este permisă în limita locurilor disponibile.',
  'No-show = fără rambursare.',
  'Rambursarea se face în același cont/card în 3–7 zile.',
  '6. Întârzieri și modificări',
  'Transportatorul nu este responsabil pentru întârzieri cauzate de trafic, vreme, controale, închideri de drum etc.',
  'În caz de defecțiune majoră, vehiculul este înlocuit în max. 24h.',
  '7. Reclamații',
  'Reclamațiile se trimit în max. 3 zile de la călătorie.',
  'Email: rezervari@pris-com.ro',
  'Telefon: 0740 470 996',
  'Răspuns în max. 30 zile.',
  '8. Reduceri copii',
  'Reducerile sunt afișate în sistem și pot necesita document justificativ.',
  '9. Forța majoră',
  'Exonerează transportatorul de orice răspundere.',
]

const privacyDocParagraphs = [
  'POLITICA DE CONFIDENȚIALITATE, COOKIE-URI & RECLAMAȚII — www.pris-com.ro',
  '1. Operatorii datelor',
  'Datele cu caracter personal procesate prin intermediul site-ului www.pris-com.ro sunt administrate de:',
  '- SC PRIS COM UNIVERS SRL',
  '- SC AUTO DIMAS SRL',
  'Contact: rezervari@pris-com.ro | Tel: 0740 470 996',
  '2. Ce date colectăm',
  'Date de identificare, contact, călătorie, IP, cookie-uri, date tranzacționale (fără date card).',
  '3. Cum colectăm datele',
  'Prin formulare, prin utilizarea site-ului, prin procesatorul de plăți.',
  '4. Scopurile prelucrării',
  'Emiterea biletelor, procesarea plăților, comunicări, obligații legale, analiză și securitate.',
  '5. Temeliul legal',
  'Executarea contractului, consimțământ, obligație legală, interes legitim.',
  '6. Cui dezvăluim datele',
  'ING WebPay, furnizori IT, autorități.',
  '7. Securitatea datelor',
  'Protecție prin HTTPS, acces controlat, backup-uri.',
  '8. Durata păstrării',
  '5 ani pentru obligații contabile, sau cât este necesar.',
  '9. Drepturile utilizatorilor',
  'Acces, rectificare, ștergere, restricționare, opoziție, portabilitate.',
  '10. Politica de cookie-uri',
  'Cookie-uri necesare, analiză, preferințe, marketing.',
  '11. Politica de reclamații',
  'Sesizări în max. 3 zile la rezervari@pris-com.ro. Termen răspuns: 30 zile.',
  '12. Modificări ale politicii',
  'Actualizările vor fi publicate pe site.',
  '13. Legislație aplicabilă',
  'Legea română, GDPR.',
]

function SectionCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/70">{description}</p>
    </div>
  )
}

function ListSection({ title, points }: { title: string; points: string[] }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm text-white/70">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span className="mt-1 size-1 rounded-full bg-brand"></span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

export default function OnlinePaymentPage() {
  return (
    <main className="min-h-screen bg-slatebg text-white">
      <Navbar />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/60 to-brandTeal/10 p-8 text-white">
          <p className="text-sm uppercase tracking-wide text-white/60">Plată online</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Plăți securizate prin ING WebPay</h1>
          <p className="mt-4 text-base text-white/80">
            Această pagină conține toate informațiile obligatorii pentru integrarea ING WebPay conform „E-commerce Services Guide” și
            normelor ANPC: descrierea serviciilor, termeni contractuali, politica de confidențialitate și datele societăților.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {ingRoles.map((role) => (
              <div key={role.title} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-white/50">{role.title}</p>
                <p className="mt-2 text-white/80">{role.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <CardBrandLogos size="lg" />
            <p className="text-sm text-white/70">Datele cardului sunt introduse exclusiv în fereastra securizată ING WebPay.</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-2xl font-semibold">Conformitate e-shop</h2>
          <p className="mt-2 text-sm text-white/70">
            Checklist-ul de mai jos este bifat pentru a respecta ghidul ING și cerințele ANPC pentru magazine online:
          </p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {complianceChecklist.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-1 inline-flex size-4 items-center justify-center rounded-full bg-brand text-xs text-black">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-white/70">
            Link ANPC / SOL: <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noreferrer" className="text-white font-semibold underline">https://anpc.ro/ce-este-sal/</a>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Produse și servicii comercializate</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {productsAndServices.map((entry) => (
              <SectionCard key={entry.title} title={entry.title} description={entry.description} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Date de identificare și contact</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {operatori.map((operator) => (
              <div key={operator.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h3 className="text-lg font-semibold">{operator.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  {operator.content.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                  <li>
                    Email: <a href="mailto:rezervari@pris-com.ro" className="text-white hover:text-brand">rezervari@pris-com.ro</a>
                  </li>
                  <li>
                    Telefon: <a href="tel:0740470996" className="text-white hover:text-brand">0740 470 996</a>
                  </li>
                  <li>Țară: România</li>
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Termeni și condiții (actualizați 2025)</h2>
          <div className="space-y-4">
            {termsSections.map((section) => (
              <ListSection key={section.title} title={section.title} points={section.points} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Politica de confidențialitate, cookie-uri & reclamații</h2>
          <div className="space-y-4">
            {privacySections.map((section) => (
              <ListSection key={section.title} title={section.title} points={section.points} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Documentele oficiale furnizate (text integral)</h2>
          <p className="text-sm text-white/70">
            Mai jos sunt reproduse fidel documentele din folderul „de_implementat”: Termenii și condițiile și Politica de
            confidențialitate / cookie-uri / reclamații. Conținutul este afișat integral pentru a reflecta exact versiunile
            livrate de clientul Pris Com.
          </p>
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="text-xl font-semibold text-white">Termeni și condiții – document DOCX</h3>
            <div className="mt-4 space-y-2 text-sm text-white/80">
              {termsDocParagraphs.map((paragraph, idx) => (
                <p key={`terms-doc-${idx}`}>{paragraph}</p>
              ))}
            </div>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="text-xl font-semibold text-white">Politica de confidențialitate – document DOCX</h3>
            <div className="mt-4 space-y-2 text-sm text-white/80">
              {privacyDocParagraphs.map((paragraph, idx) => (
                <p key={`privacy-doc-${idx}`}>{paragraph}</p>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-brand/10 p-6 text-white">
          <h2 className="text-2xl font-semibold">Suport plăți ING WebPay</h2>
          <p className="mt-2 text-sm text-white/80">
            Pentru orice problemă la plată sau solicitări de refund trimite un email la rezervari@pris-com.ro cu numărul tranzacției ING.
            Echipa noastră verifică statusul în consola ING (User Tranzacționare) și oferă răspuns în maximum 30 de zile.
          </p>
          <p className="mt-4 text-sm text-white/80">
            În cazul în care disputa nu se rezolvă amiabil, poți apela la{' '}
            <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noreferrer" className="font-semibold underline">
              ANPC / SOL
            </a>{' '}
            sau la banca emitentă pentru inițierea unei proceduri de chargeback conform regulamentelor Visa/Mastercard.
          </p>
        </section>
      </div>
    </main>
  )
}
