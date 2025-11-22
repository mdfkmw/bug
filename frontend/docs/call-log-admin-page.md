# Pagina de administrare "Call Log"

Această notă documentează implementarea efectivă a paginii de administrare pentru monitorizarea apelurilor primite (Call Log). Cerința confirmată: afișarea datei, orei și secundei fiecărui apel, numărul de telefon și numele asociat (dacă există în baza de date) și statusul (răspuns/nepreluat/respins), fără câmp de durată.

## Locație și routing
- Componenta React este definită în `frontend/src/pages/AdminCallLog.jsx` și este expusă la ruta `/admin/call-log` (protejată pentru rolurile `admin` și `operator_admin`).
- Link-ul „Call log” apare în bara de navigație doar pentru utilizatorii cu aceste roluri.

## Structura de date
Backend-ul colectează evenimente prin `POST /api/incoming-calls` și le normalizează în memorie în obiecte de forma:
```ts
{
  id: string;
  received_at: string; // ISO timestamp
  phone: string;
  digits: string;
  status: 'answered' | 'missed' | 'rejected' | 'ringing';
  caller_name?: string;
  note?: string;
}
```
Nu se calculează/afișează durata apelului.

## Flux de date
1. **Webhook PBX** – `POST /api/incoming-calls` salvează până la 500 de evenimente recente, marcând statusul (`ringing`, `answered`, `missed`, `rejected`).
2. **Îmbogățire nume** – `GET /api/incoming-calls/log?limit=...` caută în tabela `people` după telefon și anexează numele disponibil. Dacă PBX trimite deja un nume (câmpul `name`), acesta are prioritate.
3. **Front-end** – `AdminCallLog.jsx` folosește fetch (cu `credentials: 'include'`) pentru a încărca logul, afișând data, ora (cu secunde), telefonul, numele și statusul. Nu există coloană de durată; cerința specifică „fără durata apelului”.

## Elemente UI
1. **Header** – titlu „📞 Call Log administrare” + descriere că se afișează statusuri fără durată.
2. **Controale** – selector pentru numărul de rânduri (25–500) și buton „Reîncarcă”.
3. **Tabel principal** – coloane Dată, Ora (HH:mm:ss), Telefon/Nume, Status și Observații. Fiecare status folosește un badge colorat (verde pentru răspuns, galben pentru nepreluat, roșu pentru respins, albastru pentru sună).
4. **Indicatori** – stări de `loading`, `error` și empty-state („Nu există apeluri în istoricul recent.”).

## Stări UX importante
- **Nume inexistent** – text auxiliar „Fără nume asociat”.
- **Eroare la încărcare** – mesaj în card roșu + log în consolă.
- **Istoric gol** – card cu border punctat și mesaj explicit.

## Extensii viitoare
- Export CSV pentru perioada selectată.
- Actualizare live prin SSE/WebSocket reutilizând evenimentele de la `/api/incoming-calls/stream`.
- Legarea unui rând din Call Log cu rezervări sau fișa clientului (ex: click => panel lateral).
