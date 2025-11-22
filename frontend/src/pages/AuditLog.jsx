import { useState, useEffect } from 'react';

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', action: '' });
  const [stationNames, setStationNames] = useState({});

  const parseJson = (value) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (err) {
      console.warn('Invalid JSON în audit log', err);
      return null;
    }
  };

  const formatValue = (val, key) => {
    if (val === null || val === undefined || val === '') return '—';
    if (key === 'board_station_id' || key === 'exit_station_id') {
      const lookupKey = String(val);
      const stationLabel = stationNames[lookupKey];
      if (stationLabel) return stationLabel;
    }
    return val;
  };

  const renderDetails = (row) => {
    const before = parseJson(row.before_json);
    const after = parseJson(row.after_json);
    const watchedFields = [
      { key: 'name', label: 'Nume' },
      { key: 'phone', label: 'Telefon' },
      { key: 'seat_id', label: 'Loc' },
      { key: 'board_station_id', label: 'Stație urcare' },
      { key: 'exit_station_id', label: 'Stație coborâre' },
      { key: 'observations', label: 'Observații' },
    ];

    const diffs = watchedFields
      .map(({ key, label }) => {
        const beforeVal = before ? before[key] : undefined;
        const afterVal = after ? after[key] : undefined;

        const bothMissing = beforeVal === undefined && afterVal === undefined;
        if (bothMissing || beforeVal === afterVal) return null;

        const formattedBefore = formatValue(beforeVal, key);
        const formattedAfter = formatValue(afterVal, key);

        if (before && after) {
          return `${label}: ${formattedBefore} → ${formattedAfter}`;
        }
        if (!before && after) {
          return `${label}: setat la ${formattedAfter}`;
        }
        if (before && !after) {
          return `${label}: șters (era ${formattedBefore})`;
        }
        return null;
      })
      .filter(Boolean);

    if (diffs.length) return diffs.join('; ');
    return row.note || '';
  };

  const load = () => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    fetch(`/api/audit-logs?${qs}`)
      .then(r => r.json())
      .then(setRows)
      .catch(console.error);
  };

  useEffect(load, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/stations')
      .then((r) => r.json())
      .then((data) => {
        if (ignore || !Array.isArray(data)) return;
        const map = {};
        data.forEach((station) => {
          const id = station?.id ?? station?.station_id;
          if (id == null) return;
          map[String(id)] = station?.name || `Stație #${id}`;
        });
        setStationNames(map);
      })
      .catch((err) => {
        console.error('AuditLog: nu am putut încărca stațiile', err);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">🕓 Jurnal operațiuni</h1>
      <div className="flex gap-2 mb-4">
        <input placeholder="De la (YYYY-MM-DD)" value={filters.from} onChange={e=>setFilters({...filters, from:e.target.value})} />
        <input placeholder="Până la (YYYY-MM-DD)" value={filters.to} onChange={e=>setFilters({...filters, to:e.target.value})} />
        <input placeholder="Acțiune" value={filters.action} onChange={e=>setFilters({...filters, action:e.target.value})} />
        <button onClick={load} className="bg-blue-600 text-white px-3 py-1 rounded">Filtrează</button>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Dată</th>
            <th className="border p-2">Acțiune</th>
            <th className="border p-2">Rezervare</th>
        <th className="border p-2">Din</th>
           <th className="border p-2">Data cursă</th>
           <th className="border p-2">Traseu</th>
           <th className="border p-2">Ora</th>
            <th className="border p-2">Segment</th>
            <th className="border p-2">Loc</th>
            <th className="border p-2">Actor</th>
            <th className="border p-2">Sumă</th>
            <th className="border p-2">Metodă</th>
            <th className="border p-2">Channel</th>
            <th className="border p-2">Detalii modificări</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.event_id}>
              <td className="border p-2">{r.at}</td>
              <td className="border p-2">{r.action_label || r.action}</td>
              <td className="border p-2">
                <a href={`/rezervare/${r.reservation_id}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  #{r.reservation_id}
                </a>
              </td>
          <td className="border p-2">
            {r.from_reservation_id ? (
              <span>
                {r.from_trip_date || ''}{r.from_hour ? ` ${r.from_hour}` : ''}{' '}
                {r.from_route_name ? `| ${r.from_route_name}` : ''}{' '}
                {r.from_segment ? `| ${r.from_segment}` : ''}{' '}
                {r.from_seat ? `| loc ${r.from_seat}` : ''}
              </span>
            ) : ''}
          </td>
          <td className="border p-2">{r.trip_date || ''}</td>
              <td className="border p-2">{r.route_name}</td>
              <td className="border p-2">{r.hour}</td>
              <td className="border p-2">{r.segment}</td>
              <td className="border p-2">{r.seat}</td>
              <td className="border p-2">{r.actor_name || r.actor_id}</td>
              <td className="border p-2">{r.amount ?? ''}</td>
              <td className="border p-2">{r.payment_method ?? ''}</td>
              <td className="border p-2">{r.channel ?? ''}</td>
              <td className="border p-2 max-w-xs break-words whitespace-pre-wrap text-left">{renderDetails(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
