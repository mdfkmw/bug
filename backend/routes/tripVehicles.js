const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('./audit');
// toți utilizatorii AUTENTIFICAȚI cu aceste roluri au voie aici
router.use(requireAuth, requireRole('admin','operator_admin','agent'));
/* ================================================================
   GET /api/trip-vehicles?trip_id=...
   Returnează toate vehiculele asociate unei curse (trip)
   ================================================================ */
router.get('/', async (req, res) => {
  const { trip_id } = req.query;
  if (!trip_id) return res.status(400).json({ error: 'trip_id este obligatoriu' });

  try {
    const sql = `
      SELECT 
        tv.id AS trip_vehicle_id,
        tv.trip_id,
        tv.vehicle_id,
        v.name AS vehicle_name,
        v.plate_number,
        v.operator_id,
        tv.is_primary,
        tv.notes
      FROM trip_vehicles tv
      JOIN vehicles v ON v.id = tv.vehicle_id
      WHERE tv.trip_id = ?
      ORDER BY tv.is_primary DESC, v.id
    `;
    const { rows } = await db.query(sql, [trip_id]);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/trip-vehicles error:', err);
    res.status(500).json({ error: 'Eroare la încărcarea vehiculelor cursei' });
  }
});

/* ================================================================
   POST /api/trip-vehicles
   Body: { trip_id, vehicle_id, is_primary }
   Adaugă un vehicul (dublură) la o cursă.
   ================================================================ */
router.post('/', async (req, res) => {
  const { trip_id, vehicle_id, is_primary } = req.body;
  if (!trip_id || !vehicle_id)
    return res.status(400).json({ error: 'trip_id și vehicle_id sunt obligatorii' });

  // 🔒 Validare operator: vehiculul trebuie să aparțină aceluiași operator ca și cursa
  try {
    const { rows: tripRows } = await db.query(
      `SELECT rs.operator_id
         FROM trips t
         JOIN route_schedules rs ON rs.id = t.route_schedule_id
        WHERE t.id = ?
        LIMIT 1`,
      [trip_id]
    );
    if (!tripRows.length) {
      return res.status(404).json({ error: 'Cursa nu există.' });
    }
    const tripOperator = Number(tripRows[0]?.operator_id) || null;

    const { rows: vehicleRows } = await db.query(
      `SELECT operator_id FROM vehicles WHERE id = ? LIMIT 1`,
      [vehicle_id]
    );
    if (!vehicleRows.length) {
      return res.status(404).json({ error: 'Vehicul inexistent.' });
    }
    const vehicleOperator = Number(vehicleRows[0]?.operator_id) || null;

    if (tripOperator && vehicleOperator && tripOperator !== vehicleOperator) {
      return res.status(400).json({ error: 'Vehiculul aparține altui operator.' });
    }
  } catch (err) {
    console.error('POST /api/trip-vehicles validation error:', err);
    return res.status(500).json({ error: 'Eroare internă la validarea operatorului' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // verificăm dacă există deja combinația
    const [existing] = await conn.execute(
      `SELECT id FROM trip_vehicles WHERE trip_id = ? AND vehicle_id = ?`,
      [trip_id, vehicle_id]
    );
    if (existing.length) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Vehiculul este deja asociat acestei curse.' });
    }

    // inserăm vehiculul
    const normalizedPrimary = is_primary ? 1 : 0;
    const [insertRes] = await conn.execute(
      `INSERT INTO trip_vehicles (trip_id, vehicle_id, is_primary) VALUES (?, ?, ?)`,
      [trip_id, vehicle_id, normalizedPrimary]
    );
    const insertedId = insertRes.insertId;

    if (normalizedPrimary) {
      await conn.execute(
        `UPDATE trip_vehicles SET is_primary = 0 WHERE trip_id = ? AND id <> ?`,
        [trip_id, insertedId]
      );
      await conn.execute(`UPDATE trip_vehicles SET is_primary = 1 WHERE id = ?`, [insertedId]);
    } else {
      const [primaryCount] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM trip_vehicles WHERE trip_id = ? AND is_primary = 1`,
        [trip_id]
      );
      if (!primaryCount[0]?.cnt) {
        await conn.execute(`UPDATE trip_vehicles SET is_primary = 1 WHERE id = ?`, [insertedId]);
      }
    }

    await conn.commit();
    conn.release();

    const { rows } = await db.query(
      `SELECT tv.*, v.name AS vehicle_name, v.plate_number
       FROM trip_vehicles tv
       JOIN vehicles v ON v.id = tv.vehicle_id
       WHERE tv.id = ?`,
      [insertedId]
    );

    const created = rows[0];

    await logAuditEvent({
      actorId: req.user?.id || null,
      entity: 'trip',
      entityId: Number(trip_id) || trip_id || null,
      action: 'trip.vehicle.duplicate.add',
      relatedEntity: 'vehicle',
      relatedId: vehicle_id,
      note: `Adăugat vehicul ${created?.vehicle_name || ''}${created?.plate_number ? ` (${created.plate_number})` : ''} ca dublură`,
      after: {
        trip_vehicle_id: insertedId,
        vehicle_id,
        is_primary: Boolean(normalizedPrimary),
      },
    });

    res.json(created);
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /api/trip-vehicles error:', err);
    res.status(500).json({ error: 'Eroare la adăugarea vehiculului la cursă' });
  }
});

/* ================================================================
   PATCH /api/trip-vehicles/:tvId
   Body: { is_primary?, notes? }
   Actualizează informații despre vehiculul asociat cursei
   ================================================================ */
router.patch('/:tvId', async (req, res) => {
  const tvId = req.params.tvId;
  const { is_primary, notes } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [tv] = await conn.execute(
      `SELECT trip_id, vehicle_id FROM trip_vehicles WHERE id = ?`,
      [tvId]
    );
    if (!tv.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'trip_vehicle inexistent' });
    }
    const { trip_id } = tv[0];

    if (is_primary !== undefined) {
      const flag = is_primary ? 1 : 0;
      if (flag) {
        await conn.execute(
          `UPDATE trip_vehicles SET is_primary = 0 WHERE trip_id = ? AND id <> ?`,
          [trip_id, tvId]
        );
        await conn.execute(`UPDATE trip_vehicles SET is_primary = 1 WHERE id = ?`, [tvId]);
      } else {
        await conn.execute(`UPDATE trip_vehicles SET is_primary = 0 WHERE id = ?`, [tvId]);
        const [primaryCount] = await conn.execute(
          `SELECT COUNT(*) AS cnt FROM trip_vehicles WHERE trip_id = ? AND is_primary = 1`,
          [trip_id]
        );
        if (!primaryCount[0]?.cnt) {
          await conn.execute(`UPDATE trip_vehicles SET is_primary = 1 WHERE id = ?`, [tvId]);
        }
      }
    }

    if (notes !== undefined) {
      await conn.execute(`UPDATE trip_vehicles SET notes = ? WHERE id = ?`, [notes, tvId]);
    }

    await conn.commit();
    conn.release();

    const { rows } = await db.query(
      `SELECT tv.*, v.name AS vehicle_name, v.plate_number
       FROM trip_vehicles tv
       JOIN vehicles v ON v.id = tv.vehicle_id
       WHERE tv.id = ?`,
      [tvId]
    );

    res.json(rows[0]);
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('PATCH /api/trip-vehicles/:tvId error:', err);
    res.status(500).json({ error: 'Eroare la actualizarea vehiculului' });
  }
});

/* ================================================================
   DELETE /api/trip-vehicles/:tvId
   Șterge vehiculul dintr-o cursă (doar dacă nu are rezervări).
   ================================================================ */
router.delete('/:tvId', async (req, res) => {
  const tvId = req.params.tvId;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [tv] = await conn.execute(
      `SELECT trip_id, vehicle_id, is_primary FROM trip_vehicles WHERE id = ?`,
      [tvId]
    );
    if (!tv.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'trip_vehicle inexistent' });
    }

    const { trip_id, vehicle_id, is_primary } = tv[0];

    const { rows: vehicleInfoRows } = await db.query(
      `SELECT name, plate_number FROM vehicles WHERE id = ? LIMIT 1`,
      [vehicle_id]
    );
    const vehicleMeta = vehicleInfoRows[0] || null;

    // verificăm rezervările pe acest vehicul
    const [rez] = await conn.execute(
      `SELECT COUNT(*) AS count
       FROM reservations r
       JOIN seats s ON s.id = r.seat_id
       WHERE r.trip_id = ? AND s.vehicle_id = ?`,
      [trip_id, vehicle_id]
    );
    if (rez[0].count > 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Nu se poate șterge, există rezervări pe acest vehicul.' });
    }

    // ștergere efectivă
    await conn.execute(`DELETE FROM trip_vehicles WHERE id = ?`, [tvId]);

    if (is_primary) {
      const [nextPrimary] = await conn.execute(
        `SELECT id FROM trip_vehicles WHERE trip_id = ? ORDER BY id LIMIT 1`,
        [trip_id]
      );
      if (nextPrimary.length) {
        await conn.execute(`UPDATE trip_vehicles SET is_primary = 1 WHERE id = ?`, [nextPrimary[0].id]);
      }
    }

    await conn.commit();
    conn.release();

    const label = vehicleMeta?.name || vehicleMeta?.plate_number
      ? `${vehicleMeta?.name || 'Vehicul'}${vehicleMeta?.plate_number ? ` (${vehicleMeta.plate_number})` : ''}`
      : `Vehicul #${vehicle_id}`;

    await logAuditEvent({
      actorId: req.user?.id || null,
      entity: 'trip',
      entityId: Number(trip_id) || trip_id || null,
      action: 'trip.vehicle.duplicate.remove',
      relatedEntity: 'vehicle',
      relatedId: vehicle_id,
      note: `Dublură ștearsă: ${label}`,
      before: {
        trip_vehicle_id: Number(tvId),
        vehicle_id,
        is_primary: Boolean(is_primary),
      },
    });

    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('DELETE /api/trip-vehicles/:tvId error:', err);
    res.status(500).json({ error: 'Eroare la ștergerea vehiculului din cursă' });
  }
});

module.exports = router;
