import React, { useEffect, useMemo, useState } from 'react';

function formatScheduleOption(schedule) {
  if (!schedule) return '';
  const pieces = [schedule.departure || '00:00'];
  if (schedule.direction) pieces.push(schedule.direction);
  if (schedule.operator_name) {
    pieces.push(`(${schedule.operator_name})`);
  } else if (schedule.operator_id) {
    pieces.push(`(operator #${schedule.operator_id})`);
  }
  return pieces.join(' · ');
}

function SeatBadge({ seat, blocked, onToggle, positionStyle }) {
  const label = seat.label || seat.seat_number || `#${seat.id}`;
  const isService = seat.seat_type === 'driver' || seat.seat_type === 'guide';
  const className = [
    'px-3 py-2 rounded-lg border text-sm flex flex-col gap-1 items-start',
    blocked ? 'bg-red-50 border-red-400 text-red-700' : 'bg-gray-50 border-gray-300 text-gray-700',
    isService ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700 cursor-pointer',
  ].join(' ');
  return (
    <button
      type="button"
      className={className}
      onClick={() => !isService && onToggle(seat)}
      disabled={isService}
      style={positionStyle}
    >
      <span className="font-medium">{label}</span>
      <span className="text-xs text-gray-500">
        rând {seat.row ?? '-'}, col {seat.seat_col ?? '-'}
        {seat.seat_type && seat.seat_type !== 'normal' && ` · ${seat.seat_type}`}
      </span>
      {blocked && <span className="text-xs text-red-600">Blocat online</span>}
      {isService && <span className="text-xs">Loc de serviciu</span>}
    </button>
  );
}

export default function AdminRouteVehicleDefaults() {
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [defaultVehicleId, setDefaultVehicleId] = useState('');
  const [savingDefault, setSavingDefault] = useState(false);
  const [seatVehicleId, setSeatVehicleId] = useState('');
  const [seats, setSeats] = useState([]);
  const [blockedSeatIds, setBlockedSeatIds] = useState(new Set());
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const seatLayout = useMemo(() => {
    if (!seats || seats.length === 0) {
      return null;
    }

    let minRow = null;
    let maxRow = null;
    let maxCol = null;

    seats.forEach((seat) => {
      const row = Number.isFinite(Number(seat.row)) ? Number(seat.row) : 0;
      const col = Number.isFinite(Number(seat.seat_col)) ? Number(seat.seat_col) : 1;

      if (minRow === null || row < minRow) minRow = row;
      if (maxRow === null || row > maxRow) maxRow = row;
      if (maxCol === null || col > maxCol) maxCol = col;
    });

    if (minRow === null || maxRow === null || maxCol === null) {
      return null;
    }

    const totalRows = maxRow - minRow + 1;
    const totalCols = maxCol;

    return {
      minRow,
      totalRows,
      totalCols,
    };
  }, [seats]);

  const selectedSchedule = useMemo(() => {
    if (!selectedScheduleId) return null;
    const numericId = Number(selectedScheduleId);
    if (!Number.isFinite(numericId)) return null;
    return schedules.find((s) => Number(s.id) === numericId) || null;
  }, [schedules, selectedScheduleId]);

  useEffect(() => {
    const loadRoutes = async () => {
      setRoutesLoading(true);
      try {
        const res = await fetch('/api/routes');
        const data = await res.json();
        setRoutes(Array.isArray(data) ? data : []);
        if (!selectedRouteId && Array.isArray(data) && data.length > 0) {
          setSelectedRouteId(String(data[0].id));
        }
      } catch (err) {
        console.error('Eroare la încărcarea rutelor', err);
        setRoutes([]);
      } finally {
        setRoutesLoading(false);
      }
    };
    loadRoutes();
  }, []); // only once

  useEffect(() => {
    if (!selectedRouteId) {
      setSchedules([]);
      setSelectedScheduleId('');
      return;
    }
    const loadSchedules = async () => {
      setSchedulesLoading(true);
      try {
        const res = await fetch(`/api/routes/${selectedRouteId}/schedules?include_defaults=1`);
        const data = await res.json();
        setSchedules(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Eroare la încărcarea programelor', err);
        setSchedules([]);
      } finally {
        setSchedulesLoading(false);
      }
    };
    loadSchedules();
    setSelectedScheduleId('');
  }, [selectedRouteId]);

  useEffect(() => {
    if (!selectedSchedule) {
      setDefaultVehicleId('');
      setVehicles([]);
      setSeatVehicleId('');
      setSeats([]);
      setBlockedSeatIds(new Set());
      return;
    }

    setDefaultVehicleId(
      selectedSchedule.default_vehicle_id ? String(selectedSchedule.default_vehicle_id) : ''
    );

    const operatorId = selectedSchedule.operator_id;
    if (!operatorId) {
      setVehicles([]);
      setSeatVehicleId('');
      setSeats([]);
      setBlockedSeatIds(new Set());
      return;
    }

    const loadVehicles = async () => {
      setVehiclesLoading(true);
      try {
        const res = await fetch(`/api/vehicles?operator_id=${operatorId}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setVehicles(list);
        const defaultId = selectedSchedule.default_vehicle_id
          ? String(selectedSchedule.default_vehicle_id)
          : '';
        if (defaultId && list.some((v) => String(v.id) === defaultId)) {
          setSeatVehicleId(defaultId);
        } else if (list.length) {
          setSeatVehicleId(String(list[0].id));
        } else {
          setSeatVehicleId('');
        }
      } catch (err) {
        console.error('Eroare la încărcarea vehiculelor', err);
        setVehicles([]);
        setSeatVehicleId('');
      } finally {
        setVehiclesLoading(false);
      }
    };
    loadVehicles();
  }, [selectedSchedule]);

  useEffect(() => {
    if (!selectedSchedule || !seatVehicleId) {
      setSeats([]);
      setBlockedSeatIds(new Set());
      return;
    }

    const loadSeats = async () => {
      setSeatsLoading(true);
      try {
        const [seatRes, blockRes] = await Promise.all([
          fetch(`/api/vehicles/${seatVehicleId}/seats`),
          fetch(`/api/route_schedules/${selectedSchedule.id}/seat-blocks?vehicle_id=${seatVehicleId}`),
        ]);
        const seatData = await seatRes.json();
        const blockData = await blockRes.json();
        setSeats(Array.isArray(seatData) ? seatData : []);
        const blocked = new Set();
        if (blockData && Array.isArray(blockData.seats)) {
          blockData.seats.forEach((item) => {
            blocked.add(Number(item.seat_id));
          });
        }
        setBlockedSeatIds(blocked);
      } catch (err) {
        console.error('Eroare la încărcarea locurilor', err);
        setSeats([]);
        setBlockedSeatIds(new Set());
      } finally {
        setSeatsLoading(false);
      }
    };
    loadSeats();
  }, [selectedSchedule, seatVehicleId]);

  const handleSaveDefault = async () => {
    if (!selectedSchedule) return;
    setSavingDefault(true);
    setFeedback('');
    try {
      const payload = defaultVehicleId
        ? { vehicle_id: Number(defaultVehicleId) }
        : { vehicle_id: null };
      const res = await fetch(`/api/route_schedules/${selectedSchedule.id}/default-vehicle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error || 'Nu s-a putut salva vehiculul implicit.';
        alert(msg);
        return;
      }
      setFeedback('Vehiculul implicit a fost actualizat.');
      // reîncarcă programele pentru a actualiza numele din listă
      const refresh = await fetch(`/api/routes/${selectedRouteId}/schedules?include_defaults=1`);
      const refreshData = await refresh.json();
      setSchedules(Array.isArray(refreshData) ? refreshData : []);
    } catch (err) {
      console.error('Eroare la salvarea vehiculului implicit', err);
      alert('Nu s-a putut salva vehiculul implicit.');
    } finally {
      setSavingDefault(false);
    }
  };

  const toggleSeat = (seat) => {
    setBlockedSeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) {
        next.delete(seat.id);
      } else {
        next.add(seat.id);
      }
      return next;
    });
  };

  const handleSaveBlocks = async () => {
    if (!selectedSchedule || !seatVehicleId) return;
    setFeedback('');
    try {
      const payload = {
        vehicle_id: Number(seatVehicleId),
        seat_ids: Array.from(blockedSeatIds.values()),
      };
      const res = await fetch(`/api/route_schedules/${selectedSchedule.id}/seat-blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error || 'Nu s-au putut salva blocările.';
        alert(msg);
        return;
      }
      setFeedback('Blocările de locuri au fost actualizate.');
    } catch (err) {
      console.error('Eroare la salvarea blocărilor de locuri', err);
      alert('Nu s-au putut salva blocările.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Vehicule implicite & Blocări locuri</h2>
        <p className="text-sm text-gray-600">
          Alege ruta și ora pentru a seta vehiculul implicit al cursei și pentru a bloca locuri indisponibile online.
        </p>
      </div>

      {feedback && (
        <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{feedback}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Rută</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
            >
              <option value="">— alege ruta —</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
            </select>
            {routesLoading && <p className="text-xs text-gray-500">Se încarcă rutele…</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Oră / sens</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              disabled={!schedules.length || schedulesLoading}
            >
              <option value="">— alege plecarea —</option>
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>{formatScheduleOption(schedule)}</option>
              ))}
            </select>
            {schedulesLoading && <p className="text-xs text-gray-500">Se încarcă orele…</p>}
          </div>

          {selectedSchedule && (
            <div className="space-y-3 rounded border border-gray-200 bg-white p-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Vehicul implicit</label>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={defaultVehicleId}
                  onChange={(e) => setDefaultVehicleId(e.target.value)}
                  disabled={vehiclesLoading}
                >
                  <option value="">Primul vehicul al operatorului</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                      {vehicle.plate_number ? ` (${vehicle.plate_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={handleSaveDefault}
                disabled={savingDefault}
              >
                {savingDefault ? 'Se salvează…' : 'Salvează vehiculul implicit'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Vehicul pentru blocări</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={seatVehicleId}
              onChange={(e) => setSeatVehicleId(e.target.value)}
              disabled={!vehicles.length}
            >
              <option value="">— selectează vehiculul —</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                  {vehicle.plate_number ? ` (${vehicle.plate_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {!seatVehicleId && <p className="text-sm text-gray-500">Selectează o rută și un vehicul pentru a vedea locurile.</p>}

          {seatVehicleId && (
            <div className="space-y-3 rounded border border-gray-200 bg-white p-4">
              {seatsLoading && <p className="text-sm text-gray-500">Se încarcă locurile…</p>}
              {!seatsLoading && seats.length === 0 && (
                <p className="text-sm text-gray-500">Vehiculul selectat nu are locuri definite.</p>
              )}
              {!seatsLoading && seats.length > 0 && (
                <>
                  <div
                    className="inline-grid gap-2 bg-gray-50 p-4 rounded"
                    style={{
                      gridTemplateColumns: seatLayout
                        ? `repeat(${seatLayout.totalCols}, minmax(60px, 1fr))`
                        : undefined,
                      gridTemplateRows: seatLayout
                        ? `repeat(${seatLayout.totalRows}, auto)`
                        : undefined,
                      gridAutoFlow: 'dense',
                    }}
                  >
                    {seats.map((seat) => {
                      const row = Number.isFinite(Number(seat.row)) ? Number(seat.row) : 0;
                      const col = Number.isFinite(Number(seat.seat_col)) ? Number(seat.seat_col) : 1;
                      const rowIndex = seatLayout ? row - seatLayout.minRow + 1 : 1;
                      const normalizedRow = rowIndex >= 1 ? rowIndex : 1;
                      const colIndex = col >= 1 ? col : 1;

                      return (
                        <SeatBadge
                          key={seat.id}
                          seat={{ ...seat, row, seat_col: colIndex }}
                          blocked={blockedSeatIds.has(seat.id)}
                          onToggle={toggleSeat}
                          positionStyle={{
                            gridRow: `${normalizedRow}`,
                            gridColumn: `${colIndex}`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                    onClick={handleSaveBlocks}
                  >
                    Salvează blocările
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
