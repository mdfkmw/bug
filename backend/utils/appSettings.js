const db = require('../db');

const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
`;

let ensureTablePromise = null;

async function ensureAppSettingsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.query(TABLE_SQL).catch((err) => {
      ensureTablePromise = null;
      throw err;
    });
  }
  return ensureTablePromise;
}

async function getAppSetting(key, defaultValue = null) {
  if (!key) return defaultValue;
  await ensureAppSettingsTable();
  const { rows } = await db.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
    [key]
  );
  if (!rows || rows.length === 0) return defaultValue;
  const value = rows[0]?.setting_value;
  return value == null ? defaultValue : value;
}

async function getAppSettings(keys) {
  const map = new Map();
  if (!Array.isArray(keys) || keys.length === 0) {
    return map;
  }
  await ensureAppSettingsTable();
  const placeholders = keys.map(() => '?').join(',');
  const { rows } = await db.query(
    `SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (${placeholders})`,
    keys
  );
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row.setting_key !== 'string') continue;
      map.set(row.setting_key, row.setting_value == null ? null : row.setting_value);
    }
  }
  return map;
}

async function setAppSetting(key, value) {
  if (!key) return;
  await ensureAppSettingsTable();
  const normalized = value == null ? '' : String(value).trim();
  await db.query(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [key, normalized]
  );
}

module.exports = {
  ensureAppSettingsTable,
  getAppSetting,
  getAppSettings,
  setAppSetting,
};
