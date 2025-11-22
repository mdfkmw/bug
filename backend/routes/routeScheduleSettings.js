const express = require('express');
const router = express.Router();

const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

async function loadSchedule(scheduleId) {
  const id = Number(scheduleId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const { rows } = await db.query(
    `SELECT rs.id, rs.route_id, rs.operator_id, rs.direction, TIME_FORMAT(rs.departure, '%H:%i') AS departure
       FROM route_schedules rs
      WHERE rs.id = ?
      LIMIT 1`,
    [id]
  );
  if (!rows.length) return null;
  return {
    id: Number(rows[0].id),
    route_id: Number(rows[0].route_id),
    operator_id: rows[0].operator_id != null ? Number(rows[0].operator_id) : null,
    direction: rows[0].direction || 'tur',
    departure: rows[0].departure || null,
  };
}

function ensureOperatorAccess(req, schedule) {
  if (!schedule) return false;
  if (req.user?.role === 'operator_admin') {
    const scheduleOperatorId = schedule.operator_id || null;
    const userOperatorId = req.user.operator_id || null;
    if (!scheduleOperatorId || Number(scheduleOperatorId) !== Number(userOperatorId)) {
      return false;
    }
  }
  return true;
}

router.use('/route_schedules', requireAuth, requireRole('admin', 'operator_admin'));

router.get('/route_schedules/:scheduleId/default-vehicle', async (req, res) => {
  try {
    const schedule = await loadSchedule(req.params.scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Programarea nu există.' });
    }
    if (!ensureOperatorAccess(req, schedule)) {
      return res.status(403).json({ error: 'Nu ai acces la această programare.' });
    }

    const { rows } = await db.query(
      `SELECT d.vehicle_id, v.name, v.plate_number
         FROM route_schedule_default_vehicles d
         LEFT JOIN vehicles v ON v.id = d.vehicle_id
        WHERE d.route_schedule_id = ?
        LIMIT 1`,
      [schedule.id]
    );
    if (!rows.length) {
      return res.json({ schedule_id: schedule.id, vehicle: null });
    }
    const row = rows[0];
    return res.json({
      schedule_id: schedule.id,
      vehicle: {
        id: Number(row.vehicle_id),
        name: row.name || null,
        plate_number: row.plate_number || null,
      },
    });
  } catch (err) {
    console.error('[GET /api/route_schedules/:id/default-vehicle] error', err);
    res.status(500).json({ error: 'Eroare internă' });
  }
});

router.put('/route_schedules/:scheduleId/default-vehicle', async (req, res) => {
  const scheduleId = Number(req.params.scheduleId);
  const vehicleRaw = req.body?.vehicle_id;
  const hasVehicle = vehicleRaw !== undefined && vehicleRaw !== null && vehicleRaw !== '';
  const vehicleId = hasVehicle ? Number(vehicleRaw) : null;
  if (hasVehicle && (!Number.isInteger(vehicleId) || vehicleId <= 0)) {
    return res.status(400).json({ error: 'vehicle_id invalid' });
  }

  try {
    const schedule = await loadSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Programarea nu există.' });
    }
    if (!ensureOperatorAccess(req, schedule)) {
      return res.status(403).json({ error: 'Nu ai acces la această programare.' });
    }

    if (!hasVehicle) {
      await db.query('DELETE FROM route_schedule_default_vehicles WHERE route_schedule_id = ?', [schedule.id]);
      return res.json({ success: true, default_vehicle_id: null });
    }

    const { rows: vehicleRows } = await db.query(
      `SELECT id, operator_id, name, plate_number FROM vehicles WHERE id = ? LIMIT 1`,
      [vehicleId]
    );
    if (!vehicleRows.length) {
      return res.status(404).json({ error: 'Vehiculul nu există.' });
    }
    const vehicle = vehicleRows[0];
    if (schedule.operator_id && Number(vehicle.operator_id) !== Number(schedule.operator_id)) {
      return res.status(400).json({ error: 'Vehiculul nu aparține operatorului acestei curse.' });
    }

    await db.query(
      `INSERT INTO route_schedule_default_vehicles (route_schedule_id, vehicle_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE vehicle_id = VALUES(vehicle_id)`,
      [schedule.id, vehicleId]
    );

    return res.json({
      success: true,
      default_vehicle_id: vehicleId,
      vehicle: {
        id: vehicleId,
        name: vehicle.name || null,
        plate_number: vehicle.plate_number || null,
      },
    });
  } catch (err) {
    console.error('[PUT /api/route_schedules/:id/default-vehicle] error', err);
    res.status(500).json({ error: 'Eroare internă' });
  }
});

router.get('/route_schedules/:scheduleId/seat-blocks', async (req, res) => {
  try {
    const schedule = await loadSchedule(req.params.scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Programarea nu există.' });
    }
    if (!ensureOperatorAccess(req, schedule)) {
      return res.status(403).json({ error: 'Nu ai acces la această programare.' });
    }

    const vehicleId = req.query.vehicle_id ? Number(req.query.vehicle_id) : null;
    const params = [schedule.id];
    let sql = `
      SELECT b.vehicle_id, b.seat_id, b.block_online, s.label, s.row, s.seat_col
        FROM route_schedule_seat_blocks b
        JOIN seats s ON s.id = b.seat_id
       WHERE b.route_schedule_id = ?`;
    if (Number.isInteger(vehicleId) && vehicleId > 0) {
      sql += ' AND b.vehicle_id = ?';
      params.push(vehicleId);
    }
    sql += ' ORDER BY s.row, s.seat_col, s.id';

    const { rows } = await db.query(sql, params);

    if (Number.isInteger(vehicleId) && vehicleId > 0) {
      return res.json({
        schedule_id: schedule.id,
        vehicle_id: vehicleId,
        seats: rows.map((row) => ({
          seat_id: Number(row.seat_id),
          label: row.label || null,
          row: row.row != null ? Number(row.row) : null,
          seat_col: row.seat_col != null ? Number(row.seat_col) : null,
          block_online: row.block_online ? 1 : 0,
        })),
      });
    }

    const grouped = {};
    for (const row of rows) {
      const key = Number(row.vehicle_id);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        seat_id: Number(row.seat_id),
        label: row.label || null,
        row: row.row != null ? Number(row.row) : null,
        seat_col: row.seat_col != null ? Number(row.seat_col) : null,
        block_online: row.block_online ? 1 : 0,
      });
    }

    return res.json({ schedule_id: schedule.id, vehicles: grouped });
  } catch (err) {
    console.error('[GET /api/route_schedules/:id/seat-blocks] error', err);
    res.status(500).json({ error: 'Eroare internă' });
  }
});

router.put('/route_schedules/:scheduleId/seat-blocks', async (req, res) => {
  const scheduleId = Number(req.params.scheduleId);
  const vehicleId = Number(req.body?.vehicle_id);
  const seatIdsRaw = Array.isArray(req.body?.seat_ids) ? req.body.seat_ids : [];
  const seatIds = Array.from(new Set(seatIdsRaw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));

  if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
    return res.status(400).json({ error: 'scheduleId invalid' });
  }
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    return res.status(400).json({ error: 'vehicle_id invalid' });
  }

  try {
    const schedule = await loadSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ error: 'Programarea nu există.' });
    }
    if (!ensureOperatorAccess(req, schedule)) {
      return res.status(403).json({ error: 'Nu ai acces la această programare.' });
    }

    if (schedule.operator_id) {
      const { rows: vehicleRows } = await db.query(
        `SELECT id FROM vehicles WHERE id = ? AND operator_id = ? LIMIT 1`,
        [vehicleId, schedule.operator_id]
      );
      if (!vehicleRows.length) {
        return res.status(400).json({ error: 'Vehiculul nu aparține operatorului acestei curse.' });
      }
    }

    if (seatIds.length) {
      const placeholders = seatIds.map(() => '?').join(',');
      const { rows: seatRows } = await db.query(
        `SELECT id FROM seats WHERE vehicle_id = ? AND id IN (${placeholders})`,
        [vehicleId, ...seatIds]
      );
      if (seatRows.length !== seatIds.length) {
        return res.status(400).json({ error: 'Lista de locuri conține elemente invalide.' });
      }
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `DELETE FROM route_schedule_seat_blocks WHERE route_schedule_id = ? AND vehicle_id = ?`,
        [schedule.id, vehicleId]
      );

      if (seatIds.length) {
        const values = seatIds.map(() => '(?, ?, ?, 1)').join(',');
        const params = [];
        seatIds.forEach((seatId) => {
          params.push(schedule.id, vehicleId, seatId);
        });
        await conn.query(
          `INSERT INTO route_schedule_seat_blocks (route_schedule_id, vehicle_id, seat_id, block_online)
           VALUES ${values}`,
          params
        );
      }

      await conn.commit();
      conn.release();
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }

    return res.json({
      success: true,
      schedule_id: schedule.id,
      vehicle_id: vehicleId,
      blocked_count: seatIds.length,
      seat_ids: seatIds,
    });
  } catch (err) {
    console.error('[PUT /api/route_schedules/:id/seat-blocks] error', err);
    res.status(500).json({ error: 'Eroare internă' });
  }
});

module.exports = router;
