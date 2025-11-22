const express = require('express');
const db = require('../db');

const router = express.Router();

const listeners = new Set();
let lastCall = null;
let sequence = 0;
let secretWarningLogged = false;
const MAX_HISTORY = 500;
const callHistory = [];
let readyPromise = null;

const STATUS_LABELS = new Set(['ringing', 'answered', 'missed', 'rejected']);

function normalizeStatus(rawStatus) {
  if (!rawStatus) return 'ringing';
  const status = String(rawStatus).trim().toLowerCase();
  if (STATUS_LABELS.has(status)) return status;
  if (status === 'no_answer' || status === 'noanswer') return 'missed';
  return 'ringing';
}

function sanitizePhone(rawValue) {
  if (rawValue == null) {
    return { display: '', digits: '' };
  }
  const str = String(rawValue).trim();
  if (!str) {
    return { display: '', digits: '' };
  }

  let digits = str.replace(/\D/g, '');
  const startsWithPlus = str.startsWith('+');

  if (!digits) {
    return { display: '', digits: '' };
  }

  if (digits.length > 20) {
    digits = digits.slice(0, 20);
  }

  const display = startsWithPlus ? `+${digits}` : digits;
  return { display, digits };
}

function escapeLike(str) {
  return str.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function ensurePersistenceReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS incoming_calls (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            phone VARCHAR(50) NOT NULL,
            digits VARCHAR(30) NULL,
            extension VARCHAR(50) NULL,
            source VARCHAR(100) NULL,
            status VARCHAR(20) NULL,
            note TEXT NULL,
            caller_name VARCHAR(255) NULL,
            person_id BIGINT NULL,
            received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_received_at (received_at),
            INDEX idx_digits (digits)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        const { rows } = await db.query(
          `SELECT * FROM incoming_calls ORDER BY received_at DESC, id DESC LIMIT ?`,
          [MAX_HISTORY],
        );

        callHistory.length = 0;
        for (const row of rows || []) {
          callHistory.push({
            id: String(row.id),
            phone: row.phone,
            digits: row.digits,
            extension: row.extension,
            source: row.source,
            status: row.status,
            note: row.note,
            received_at: row.received_at,
            meta: {
              callerName: row.caller_name,
              personId: row.person_id,
            },
          });
          sequence = Math.max(sequence, Number(row.id) || 0);
        }

        if (callHistory.length) {
          lastCall = callHistory[0];
        }
      } catch (err) {
        console.error('[incoming-calls] Failed to prepare persistent storage:', err);
        throw err;
      }
    })();
  }

  return readyPromise;
}

function broadcast(event) {
  const payload = `id: ${event.id}\nevent: call\ndata: ${JSON.stringify(event)}\n\n`;
  for (const listener of Array.from(listeners)) {
    try {
      listener.res.write(payload);
    } catch (err) {
      cleanupListener(listener);
    }
  }
}

function cleanupListener(listener) {
  if (!listener) return;
  if (listener.heartbeat) {
    clearInterval(listener.heartbeat);
  }
  listeners.delete(listener);
}

function storeInHistory(entry) {
  callHistory.unshift(entry);
  if (callHistory.length > MAX_HISTORY) {
    callHistory.pop();
  }
}

router.post('/', async (req, res) => {
  try {
    await ensurePersistenceReady();
  } catch (err) {
    console.error('[incoming-calls] init failed', err);
    return res.status(500).json({ error: 'server error' });
  }

  const expectedSecret = process.env.PBX_WEBHOOK_SECRET;
  const providedSecret = req.get('x-pbx-secret') || req.body?.secret || req.query?.secret;

  if (expectedSecret) {
    if (!providedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'invalid secret' });
    }
  } else if (!secretWarningLogged) {
    console.warn('[incoming-calls] Atenție: PBX_WEBHOOK_SECRET nu este setat. Webhook-urile sunt acceptate fără autentificare.');
    secretWarningLogged = true;
  }

  const { display, digits } = sanitizePhone(req.body?.phone ?? req.body?.caller ?? req.body?.number ?? '');

  if (!display && !digits) {
    return res.status(400).json({ error: 'phone missing' });
  }

  const extension = req.body?.extension != null ? String(req.body.extension).trim() : null;
  const source = req.body?.source != null ? String(req.body.source).trim() : null;

  const receivedAt = new Date();

  const status = normalizeStatus(req.body?.status);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;
  const meta = {
    callerName: typeof req.body?.name === 'string' ? req.body.name.trim() || null : null,
    personId: req.body?.person_id ?? null,
  };

  try {
    const insertRes = await db.query(
      `
        INSERT INTO incoming_calls
          (phone, digits, extension, source, status, note, caller_name, person_id, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        display || digits,
        digits || null,
        extension || null,
        source || null,
        status,
        note || null,
        meta.callerName,
        meta.personId,
        receivedAt,
      ],
    );

    const id = insertRes.insertId ? String(insertRes.insertId) : String(++sequence);
    sequence = Math.max(sequence, Number(id) || sequence);

    const entry = {
      id,
      phone: display || digits,
      digits,
      extension: extension || null,
      source: source || null,
      received_at: receivedAt.toISOString(),
      status,
      note: note || null,
      meta,
    };

    storeInHistory(entry);
    lastCall = entry;
    broadcast(entry);

    return res.json({ success: true });
  } catch (err) {
    console.error('[incoming-calls] failed to persist call', err);
    return res.status(500).json({ error: 'server error' });
  }
});

router.get('/stream', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'auth required' });
  }

  try {
    await ensurePersistenceReady();
  } catch (err) {
    console.error('[incoming-calls] init failed', err);
    return res.status(500).json({ error: 'server error' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write('retry: 4000\n\n');

  const listener = { res };
  listener.heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch (err) {
      cleanupListener(listener);
    }
  }, 25000);

  req.on('close', () => cleanupListener(listener));
  req.on('end', () => cleanupListener(listener));
  res.on('close', () => cleanupListener(listener));
  res.on('finish', () => cleanupListener(listener));

  listeners.add(listener);

  if (lastCall) {
    res.write(`id: ${lastCall.id}\nevent: call\ndata: ${JSON.stringify(lastCall)}\n\n`);
  }
});

router.get('/last', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'auth required' });
  }
  try {
    await ensurePersistenceReady();
  } catch (err) {
    console.error('[incoming-calls] init failed', err);
    return res.status(500).json({ error: 'server error' });
  }
  res.json({ call: lastCall });
});

router.get('/log', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'auth required' });
  }

  try {
    await ensurePersistenceReady();
  } catch (err) {
    console.error('[incoming-calls] init failed', err);
    return res.status(500).json({ error: 'server error' });
  }

  const limit = Math.max(1, Math.min(Number.parseInt(req.query?.limit, 10) || 100, MAX_HISTORY));
  const search = typeof req.query?.search === 'string' ? req.query.search.trim() : '';
  const params = [];
  let where = '';

  if (search) {
    const like = `%${escapeLike(search)}%`;
    where = `
      WHERE (ic.phone LIKE ? ESCAPE '\\'
        OR ic.digits LIKE ? ESCAPE '\\'
        OR ic.caller_name LIKE ? ESCAPE '\\'
        OR p.name LIKE ? ESCAPE '\\')
    `;
    params.push(like, like, like, like);
  }

  const { rows } = await db.query(
    `
      SELECT
        ic.id,
        ic.phone,
        ic.digits,
        ic.received_at,
        ic.extension,
        ic.source,
        ic.status,
        ic.note,
        ic.caller_name,
        ic.person_id,
        p.id   AS linked_person_id,
        p.name AS person_name
      FROM incoming_calls ic
      LEFT JOIN people p ON p.phone = ic.digits
      ${where}
      ORDER BY ic.received_at DESC, ic.id DESC
      LIMIT ?
    `,
    [...params, limit],
  );

  const entries = (rows || []).map((row) => ({
    id: String(row.id),
    phone: row.phone,
    digits: row.digits,
    received_at: row.received_at,
    extension: row.extension,
    source: row.source,
    status: row.status,
    note: row.note,
    caller_name: row.caller_name || row.person_name || null,
    person_id: row.person_id || row.linked_person_id || null,
  }));

  res.json({ entries });
});

module.exports = router;
