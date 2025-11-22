const express = require('express');
const db = require('../db');

const router = express.Router();

const listeners = new Set();
let lastCall = null;
let sequence = 0;
let secretWarningLogged = false;
const MAX_HISTORY = 500;
const callHistory = [];

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

router.post('/', (req, res) => {
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

  const event = {
    id: String(++sequence),
    phone: display || digits,
    digits,
    extension: extension || null,
    source: source || null,
    received_at: new Date().toISOString(),
  };

  const status = normalizeStatus(req.body?.status);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;
  const entry = {
    ...event,
    status,
    note: note || null,
    meta: {
      callerName: typeof req.body?.name === 'string' ? req.body.name.trim() || null : null,
      personId: req.body?.person_id ?? null,
    },
  };

  storeInHistory(entry);
  lastCall = entry;
  broadcast(entry);

  return res.json({ success: true });
});

router.get('/stream', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'auth required' });
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

router.get('/last', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'auth required' });
  }
  res.json({ call: lastCall });
});

router.get('/log', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'auth required' });
  }

  const limit = Math.max(1, Math.min(Number.parseInt(req.query?.limit, 10) || 100, MAX_HISTORY));
  const slice = callHistory.slice(0, limit);
  const digits = Array.from(new Set(slice.map((entry) => entry.digits).filter(Boolean)));

  let peopleByPhone = {};
  if (digits.length) {
    try {
      const placeholders = digits.map(() => '?').join(',');
      const rowsRes = await db.query(
        `SELECT id, name, phone FROM people WHERE phone IN (${placeholders})`,
        digits,
      );
      for (const row of rowsRes.rows || []) {
        if (!row) continue;
        const key = row.phone ? String(row.phone).trim() : null;
        if (!key || key === '') continue;
        if (Object.prototype.hasOwnProperty.call(peopleByPhone, key)) continue;
        peopleByPhone[key] = {
          id: row.id,
          name: row.name,
        };
      }
    } catch (err) {
      console.error('[incoming-calls] Nu am putut încărca numele persoanelor:', err);
    }
  }

  const entries = slice.map((entry) => {
    const person = entry.digits ? peopleByPhone[entry.digits] : null;
    return {
      id: entry.id,
      phone: entry.phone,
      digits: entry.digits,
      received_at: entry.received_at,
      extension: entry.extension,
      source: entry.source,
      status: entry.status,
      note: entry.note,
      caller_name: entry.meta?.callerName || person?.name || null,
      person_id: entry.meta?.personId || person?.id || null,
    };
  });

  res.json({ entries });
});

module.exports = router;
