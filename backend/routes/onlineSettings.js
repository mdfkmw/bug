const express = require('express');
const router = express.Router();

const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getOnlineSettings,
  saveOnlineSettings,
  DEFAULT_ONLINE_SETTINGS,
} = require('../utils/onlineSettings');

function normalizeBoolean(value, fallback) {
  if (value === true || value === false) return value;
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function clampNumber(value, { min = 0, max = null, fallback = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  let result = Math.round(parsed);
  if (Number.isFinite(min)) result = Math.max(result, min);
  if (Number.isFinite(max)) result = Math.min(result, max);
  return result;
}

router.get(
  '/',
  requireAuth,
  requireRole('admin', 'operator_admin', 'agent'),
  async (_req, res) => {
    try {
      const settings = await getOnlineSettings();
      res.json(settings);
    } catch (err) {
      console.error('[GET /api/online-settings] error', err);
      res.status(500).json({ error: 'Nu am putut încărca setările online.' });
    }
  },
);

router.put('/', requireAuth, requireRole('admin', 'operator_admin'), async (req, res) => {
  try {
    const body = req.body || {};
    const blockPast = normalizeBoolean(
      body.blockPastReservations,
      DEFAULT_ONLINE_SETTINGS.blockPastReservations,
    );
    const minNotice = clampNumber(body.publicMinNoticeMinutes, {
      min: 0,
      max: 60 * 24 * 14, // până la 14 zile în minute
      fallback: DEFAULT_ONLINE_SETTINGS.publicMinNoticeMinutes,
    });

    const rawMaxAdvanceMinutes = clampNumber(body.publicMaxAdvanceMinutes, {
      min: 0,
      max: 60 * 24 * 365,
      fallback: null,
    });

    let maxAdvanceMinutes = Number.isFinite(rawMaxAdvanceMinutes)
      ? rawMaxAdvanceMinutes
      : null;

    if (!Number.isFinite(maxAdvanceMinutes)) {
      const legacyDays = clampNumber(body.publicMaxDaysAhead, {
        min: 0,
        max: 365,
        fallback: null,
      });
      if (Number.isFinite(legacyDays)) {
        maxAdvanceMinutes = legacyDays * 24 * 60;
      }
    }

    if (!Number.isFinite(maxAdvanceMinutes)) {
      maxAdvanceMinutes = DEFAULT_ONLINE_SETTINGS.publicMaxAdvanceMinutes;
    }

    const saved = await saveOnlineSettings({
      blockPastReservations: blockPast,
      publicMinNoticeMinutes: minNotice,
      publicMaxAdvanceMinutes: maxAdvanceMinutes,
    });

    res.json({ ok: true, settings: saved });
  } catch (err) {
    console.error('[PUT /api/online-settings] error', err);
    res.status(500).json({ error: 'Nu am putut salva setările online.' });
  }
});

module.exports = router;
