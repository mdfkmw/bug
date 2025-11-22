const { getAppSettings, setAppSetting, ensureAppSettingsTable } = require('./appSettings');

const ONLINE_SETTING_KEYS = {
  blockPastReservations: 'online_block_past_reservations',
  publicMinNoticeMinutes: 'online_public_min_notice_minutes',
  publicMaxAdvanceMinutes: 'online_public_max_advance_minutes',
  legacyPublicMaxDaysAhead: 'online_public_max_days_ahead',
};

const DEFAULT_ONLINE_SETTINGS = {
  blockPastReservations: true,
  publicMinNoticeMinutes: 0,
  publicMaxAdvanceMinutes: 0,
};

function parseBoolean(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseNonNegativeInteger(value, fallback) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return rounded < 0 ? 0 : rounded;
}

function normalizeDateInput(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = value.getMonth() + 1;
    const day = value.getDate();
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;

  const year = match[1];
  const month = String(Number(match[2])).padStart(2, '0');
  const day = String(Number(match[3])).padStart(2, '0');
  if (!/^[0-9]{4}$/.test(year)) return null;

  return `${year}-${month}-${day}`;
}

function buildDateTimeFromDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const normalizedDate = normalizeDateInput(dateStr);
  if (!normalizedDate) return null;
  const dateParts = normalizedDate.split('-');
  if (dateParts.length < 3) return null;
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const timeParts = String(timeStr).split(':');
  if (timeParts.length < 2) return null;
  const hours = Number(timeParts[0]);
  const minutes = Number(timeParts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function minutesToDays(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.floor(minutes / (60 * 24));
}

async function getOnlineSettings() {
  await ensureAppSettingsTable();
  const keys = Object.values(ONLINE_SETTING_KEYS);
  const map = await getAppSettings(keys);
  const storedAdvanceMinutes = parseNonNegativeInteger(
    map.get(ONLINE_SETTING_KEYS.publicMaxAdvanceMinutes),
    null,
  );
  const legacyDays = parseNonNegativeInteger(
    map.get(ONLINE_SETTING_KEYS.legacyPublicMaxDaysAhead),
    null,
  );
  const derivedAdvanceMinutes = Number.isFinite(storedAdvanceMinutes)
    ? storedAdvanceMinutes
    : Number.isFinite(legacyDays)
    ? legacyDays * 24 * 60
    : DEFAULT_ONLINE_SETTINGS.publicMaxAdvanceMinutes;
  return {
    blockPastReservations: parseBoolean(
      map.get(ONLINE_SETTING_KEYS.blockPastReservations),
      DEFAULT_ONLINE_SETTINGS.blockPastReservations,
    ),
    publicMinNoticeMinutes: parseNonNegativeInteger(
      map.get(ONLINE_SETTING_KEYS.publicMinNoticeMinutes),
      DEFAULT_ONLINE_SETTINGS.publicMinNoticeMinutes,
    ),
    publicMaxAdvanceMinutes: derivedAdvanceMinutes,
    publicMaxDaysAhead: minutesToDays(derivedAdvanceMinutes),
  };
}

async function saveOnlineSettings(settings) {
  const payload = {
    blockPastReservations: settings.blockPastReservations ? '1' : '0',
    publicMinNoticeMinutes: String(parseNonNegativeInteger(
      settings.publicMinNoticeMinutes,
      DEFAULT_ONLINE_SETTINGS.publicMinNoticeMinutes,
    )),
    publicMaxAdvanceMinutes: String(parseNonNegativeInteger(
      settings.publicMaxAdvanceMinutes,
      DEFAULT_ONLINE_SETTINGS.publicMaxAdvanceMinutes,
    )),
  };

  const advanceMinutesNumber = Number(payload.publicMaxAdvanceMinutes);
  const legacyDays = minutesToDays(advanceMinutesNumber);

  await Promise.all([
    setAppSetting(ONLINE_SETTING_KEYS.blockPastReservations, payload.blockPastReservations),
    setAppSetting(ONLINE_SETTING_KEYS.publicMinNoticeMinutes, payload.publicMinNoticeMinutes),
    setAppSetting(ONLINE_SETTING_KEYS.publicMaxAdvanceMinutes, payload.publicMaxAdvanceMinutes),
    setAppSetting(ONLINE_SETTING_KEYS.legacyPublicMaxDaysAhead, String(legacyDays)),
  ]);

  return {
    blockPastReservations: payload.blockPastReservations === '1',
    publicMinNoticeMinutes: Number(payload.publicMinNoticeMinutes),
    publicMaxAdvanceMinutes: advanceMinutesNumber,
    publicMaxDaysAhead: legacyDays,
  };
}

module.exports = {
  ONLINE_SETTING_KEYS,
  DEFAULT_ONLINE_SETTINGS,
  getOnlineSettings,
  saveOnlineSettings,
  buildDateTimeFromDateAndTime,
};
