const db = require('../db');

async function resolveDefaultVehicleId(scheduleId, operatorId) {
  const scheduleNumeric = Number(scheduleId);
  const operatorNumeric = Number(operatorId);

  if (Number.isInteger(scheduleNumeric) && scheduleNumeric > 0) {
    try {
      const { rows: defaultRows } = await db.query(
        `SELECT vehicle_id FROM route_schedule_default_vehicles WHERE route_schedule_id = ? LIMIT 1`,
        [scheduleNumeric]
      );

      if (defaultRows.length) {
        const candidateId = Number(defaultRows[0].vehicle_id);
        if (Number.isInteger(candidateId) && candidateId > 0) {
          const params = [candidateId];
          let sql = 'SELECT id FROM vehicles WHERE id = ?';
          if (Number.isInteger(operatorNumeric) && operatorNumeric > 0) {
            sql += ' AND operator_id = ?';
            params.push(operatorNumeric);
          }
          sql += ' LIMIT 1';

          const { rows: vehicleRows } = await db.query(sql, params);
          if (vehicleRows.length) {
            return Number(vehicleRows[0].id);
          }
        }
      }
    } catch (err) {
      console.error('[scheduleDefaults] resolveDefaultVehicleId failed', err);
    }
  }

  if (Number.isInteger(operatorNumeric) && operatorNumeric > 0) {
    try {
      const { rows } = await db.query(
        `SELECT id FROM vehicles WHERE operator_id = ? ORDER BY id ASC LIMIT 1`,
        [operatorNumeric]
      );
      if (rows.length) {
        return Number(rows[0].id);
      }
    } catch (err) {
      console.error('[scheduleDefaults] fallback operator vehicle failed', err);
    }
  }

  return null;
}

module.exports = {
  resolveDefaultVehicleId,
};
