import React, { useEffect, useMemo, useState } from 'react';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MAX_ADVANCE_DAYS = 365;
const MAX_ADVANCE_MINUTES = MAX_ADVANCE_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR;

function clampAdvanceInputs(days, hours) {
  const safeDays = Math.max(0, Math.min(MAX_ADVANCE_DAYS, Math.floor(Number(days) || 0)));
  const maxHours = safeDays >= MAX_ADVANCE_DAYS ? 0 : HOURS_PER_DAY - 1;
  const safeHours = Math.max(0, Math.min(maxHours, Math.floor(Number(hours) || 0)));
  return { days: safeDays, hours: safeHours };
}

function splitAdvanceMinutes(totalMinutes) {
  const numeric = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  if (numeric <= 0) {
    return { days: 0, hours: 0 };
  }
  const clamped = Math.min(numeric, MAX_ADVANCE_MINUTES);
  const days = Math.floor(clamped / (HOURS_PER_DAY * MINUTES_PER_HOUR));
  const leftover = clamped - days * HOURS_PER_DAY * MINUTES_PER_HOUR;
  const hours = Math.floor(leftover / MINUTES_PER_HOUR);
  return clampAdvanceInputs(days, hours);
}

function buildAdvanceMinutes(days, hours) {
  const { days: safeDays, hours: safeHours } = clampAdvanceInputs(days, hours);
  return safeDays * HOURS_PER_DAY * MINUTES_PER_HOUR + safeHours * MINUTES_PER_HOUR;
}

const DEFAULTS = {
  blockPastReservations: true,
  publicMinNoticeMinutes: 0,
  publicMaxAdvanceMinutes: 0,
};

function minutesToLabel(value) {
  const minutes = Number(value) || 0;
  if (minutes <= 0) return 'Imediat';
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'oră' : 'ore'}`;
  }
  return `${minutes} minute`;
}

export default function AdminOnlineSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [initialValues, setInitialValues] = useState(DEFAULTS);
  const [form, setForm] = useState(DEFAULTS);
  const [maxAdvanceInputs, setMaxAdvanceInputs] = useState(() =>
    splitAdvanceMinutes(DEFAULTS.publicMaxAdvanceMinutes),
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch('/api/online-settings', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Nu am putut încărca setările.');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const maxAdvanceMinutes = (() => {
          if (data?.publicMaxAdvanceMinutes != null) {
            return Math.max(0, Math.min(MAX_ADVANCE_MINUTES, Math.floor(Number(data.publicMaxAdvanceMinutes)) || 0));
          }
          if (data?.publicMaxDaysAhead != null) {
            const fromDays = Math.floor(Number(data.publicMaxDaysAhead) || 0) * HOURS_PER_DAY * MINUTES_PER_HOUR;
            return Math.max(0, Math.min(MAX_ADVANCE_MINUTES, fromDays));
          }
          return DEFAULTS.publicMaxAdvanceMinutes;
        })();
        const normalized = {
          blockPastReservations: !!data?.blockPastReservations,
          publicMinNoticeMinutes: Number(data?.publicMinNoticeMinutes) || 0,
          publicMaxAdvanceMinutes: maxAdvanceMinutes,
        };
        setInitialValues(normalized);
        setForm(normalized);
        setMaxAdvanceInputs(splitAdvanceMinutes(maxAdvanceMinutes));
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Nu am putut încărca setările.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isDirty = useMemo(() => {
    return (
      form.blockPastReservations !== initialValues.blockPastReservations ||
      form.publicMinNoticeMinutes !== initialValues.publicMinNoticeMinutes ||
      form.publicMaxAdvanceMinutes !== initialValues.publicMaxAdvanceMinutes
    );
  }, [form, initialValues]);

  const handleToggle = (event) => {
    setForm((prev) => ({
      ...prev,
      blockPastReservations: event.target.checked,
    }));
  };

  const handleNumberChange = (key) => (event) => {
    const value = Number(event.target.value);
    setForm((prev) => ({
      ...prev,
      [key]: Number.isFinite(value) ? Math.max(0, value) : 0,
    }));
  };

  const handleAdvanceChange = (field) => (event) => {
    const value = Number(event.target.value);
    setMaxAdvanceInputs((prev) => {
      const nextRaw = {
        days: field === 'days' ? value : prev.days,
        hours: field === 'hours' ? value : prev.hours,
      };
      const next = clampAdvanceInputs(nextRaw.days, nextRaw.hours);
      const minutes = buildAdvanceMinutes(next.days, next.hours);
      setForm((prevForm) => ({
        ...prevForm,
        publicMaxAdvanceMinutes: minutes,
      }));
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/online-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Nu am putut salva setările.');
      }
      const data = await res.json().catch(() => null);
      const settings = data?.settings || form;
      const savedAdvanceMinutes = (() => {
        if (settings?.publicMaxAdvanceMinutes != null) {
          return Math.floor(Number(settings.publicMaxAdvanceMinutes) || 0);
        }
        if (settings?.publicMaxDaysAhead != null) {
          return Math.floor(Number(settings.publicMaxDaysAhead) || 0) * HOURS_PER_DAY * MINUTES_PER_HOUR;
        }
        return DEFAULTS.publicMaxAdvanceMinutes;
      })();
      const normalized = {
        blockPastReservations: !!settings.blockPastReservations,
        publicMinNoticeMinutes: Number(settings.publicMinNoticeMinutes) || 0,
        publicMaxAdvanceMinutes: Math.max(0, Math.min(MAX_ADVANCE_MINUTES, savedAdvanceMinutes)),
      };
      setInitialValues(normalized);
      setForm(normalized);
      setMaxAdvanceInputs(splitAdvanceMinutes(normalized.publicMaxAdvanceMinutes));
      setSuccess('Setările au fost salvate.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.message || 'Nu am putut salva setările.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-4">Setări rezervări online</h2>
      {loading && <div>Se încarcă setările…</div>}
      {!loading && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-start gap-3">
            <input
              id="blockPastReservations"
              type="checkbox"
              className="mt-1"
              checked={form.blockPastReservations}
              onChange={handleToggle}
            />
            <label htmlFor="blockPastReservations" className="flex-1">
              <span className="font-medium">Blochează rezervările pentru curse din trecut</span>
              <p className="text-sm text-gray-600">
                Atunci când este activă, curselor care au plecat deja nu li se mai pot adăuga rezervări noi din aplicația internă sau din site-ul public.
              </p>
            </label>
          </div>

          <div>
            <label htmlFor="publicMinNoticeMinutes" className="block font-medium">
              Închide rezervările online înainte de plecare
            </label>
            <p className="text-sm text-gray-600 mb-2">
              Specifică numărul de minute înainte de plecare după care rezervările online nu mai sunt permise. Valoarea 0 înseamnă că se pot face rezervări până la plecare.
            </p>
            <div className="flex items-center gap-3">
              <input
                id="publicMinNoticeMinutes"
                type="number"
                min={0}
                max={20160}
                value={form.publicMinNoticeMinutes}
                onChange={handleNumberChange('publicMinNoticeMinutes')}
                className="w-32 rounded border border-gray-300 px-2 py-1"
              />
              <span className="text-sm text-gray-500">{minutesToLabel(form.publicMinNoticeMinutes)}</span>
            </div>
          </div>

          <div>
            <label htmlFor="publicMaxAdvanceDays" className="block font-medium">
              Permite rezervări online cu cel mult … zile și ore în avans
            </label>
            <p className="text-sm text-gray-600 mb-2">
              Setează 0 zile și 0 ore pentru a permite rezervări pentru orice dată disponibilă.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  id="publicMaxAdvanceDays"
                  type="number"
                  min={0}
                  max={MAX_ADVANCE_DAYS}
                  value={maxAdvanceInputs.days}
                  onChange={handleAdvanceChange('days')}
                  className="w-24 rounded border border-gray-300 px-2 py-1"
                />
                <span className="text-sm text-gray-600">zile</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="publicMaxAdvanceHours"
                  type="number"
                  min={0}
                  max={23}
                  value={maxAdvanceInputs.hours}
                  onChange={handleAdvanceChange('hours')}
                  disabled={maxAdvanceInputs.days >= MAX_ADVANCE_DAYS}
                  className="w-24 rounded border border-gray-300 px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-600">ore</span>
              </label>
            </div>
          </div>

          {error && <div className="text-red-600">{error}</div>}
          {success && <div className="text-green-600">{success}</div>}

          <button
            type="submit"
            disabled={saving || !isDirty}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Se salvează…' : 'Salvează setările'}
          </button>
        </form>
      )}
    </div>
  );
}
