import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

function formatDate(value, fmt) {
  if (!value) return '—';
  const parsed = dayjs(value);
  if (!parsed.isValid()) return '—';
  return parsed.format(fmt);
}

export default function AdminCallLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', limit);
      if (search.trim()) {
        params.set('search', search.trim());
      }
      const response = await fetch(`/api/incoming-calls/log?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Nu am putut încărca call log-ul');
      }
      const payload = await response.json();
      setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      console.error('[AdminCallLog] loadData failed', err);
      setError('Nu am putut încărca lista de apeluri. Încearcă din nou.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [limit, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const emptyState = !loading && !entries.length && !error;

  const rows = useMemo(() => entries.map((entry) => ({
    id: entry.id,
    date: formatDate(entry.received_at, 'DD.MM.YYYY'),
    time: formatDate(entry.received_at, 'HH:mm:ss'),
    phone: entry.phone || entry.digits || '—',
    name: entry.caller_name || 'Fără nume asociat',
  })), [entries]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">📞 Call Log administrare</h1>
          <p className="text-sm text-gray-600">Vezi ultimele apeluri primite cu numărul și numele asociat.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-3 items-center">
          <label className="text-sm text-gray-700 flex items-center gap-2">
            Afișează
            <select
              className="border rounded px-2 py-1 text-sm"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 50)}
            >
              {[25, 50, 100, 200, 300, 500].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            apeluri
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Caută după telefon sau nume"
              className="border rounded px-3 py-1 text-sm w-56"
            />
            <button
              type="button"
              onClick={loadData}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Caută
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {lastUpdatedAt && (
        <p className="text-xs text-gray-500">
          Ultima actualizare: {formatDate(lastUpdatedAt, 'DD.MM.YYYY HH:mm:ss')}
        </p>
      )}

      {loading && (
        <div className="text-gray-600">Se încarcă lista de apeluri...</div>
      )}

      {emptyState && (
        <div className="border border-dashed rounded p-6 text-center text-gray-500">
          Nu există apeluri în istoricul recent.
        </div>
      )}

      {!loading && !!rows.length && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border border-gray-200">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-2 py-1 border-b border-gray-200">Data</th>
                <th className="px-2 py-1 border-b border-gray-200">Ora (cu secunde)</th>
                <th className="px-2 py-1 border-b border-gray-200">Telefon</th>
                <th className="px-2 py-1 border-b border-gray-200">Nume asociat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                  <td className="px-2 py-1 align-top whitespace-nowrap leading-tight">{row.date}</td>
                  <td className="px-2 py-1 align-top whitespace-nowrap font-mono leading-tight">{row.time}</td>
                  <td className="px-2 py-1 align-top leading-tight font-mono">{row.phone}</td>
                  <td className="px-2 py-1 align-top leading-tight text-gray-700">{row.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
