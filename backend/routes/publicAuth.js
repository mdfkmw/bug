const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { isMailerConfigured, sendMailSafe } = require('../utils/mailer');
const {
  PUBLIC_REFRESH_COOKIE,
  PUBLIC_REFRESH_TTL_SEC,
  PUBLIC_REFRESH_REMEMBER_TTL_SEC,
  signPublicAccessToken,
  signPublicRefreshToken,
  setPublicAuthCookies,
  clearPublicAuthCookies,
  requirePublicAuth,
} = require('../middleware/publicAuth');

const router = express.Router();

const EMAIL_VERIFICATION_TTL_HOURS = 48;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const GOOGLE_OAUTH_SCOPE = 'openid email profile';
const APPLE_OAUTH_SCOPE = 'name email';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 oră

const jwksCache = {
  google: { url: GOOGLE_JWKS_URL, fetchedAt: 0, pems: new Map() },
  apple: { url: APPLE_JWKS_URL, fetchedAt: 0, pems: new Map() },
};

function getPublicAppBaseUrl() {
  return (
    process.env.PUBLIC_APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.PUBLIC_SITE_BASE_URL ||
    process.env.PUBLIC_SITE_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    process.env.PUBLIC_WEB_URL ||
    'https://pris-com.ro'
  );
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEmail(raw) {
  if (!raw) return '';
  return String(raw).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function normalizePhone(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/\D/g, '');
  if (digits.length < 7) return null;
  const normalizedDigits = digits.slice(0, 20);
  if (hasPlus) {
    return `+${normalizedDigits}`;
  }
  if (normalizedDigits.startsWith('40') && normalizedDigits.length >= 10) {
    return `0${normalizedDigits.slice(-9)}`;
  }
  if (normalizedDigits.startsWith('0')) {
    return normalizedDigits;
  }
  if (normalizedDigits.length === 9) {
    return `0${normalizedDigits}`;
  }
  return normalizedDigits;
}

function normalizePhoneDigits(phone) {
  if (!phone) return null;
  return String(phone).replace(/\D/g, '').slice(0, 20) || null;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createCodeVerifier() {
  return base64UrlEncode(crypto.randomBytes(32));
}

function createCodeChallenge(verifier) {
  return base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
}

function createNonce() {
  return base64UrlEncode(crypto.randomBytes(16));
}

function sanitizeRedirectPath(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) {
      return null;
    }
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.origin === 'null') {
      return null;
    }
    // Accept numai URL-uri care indică aceeași origine ca aplicația publică
    const base = getPublicAppBaseUrl();
    const allowed = new URL(base);
    if (url.origin === allowed.origin) {
      return url.pathname + (url.search || '');
    }
  } catch (err) {
    return null;
  }
  return null;
}

function getGoogleConfig() {
  const clientId = process.env.PUBLIC_AUTH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.PUBLIC_AUTH_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

function getAppleConfig() {
  const clientId = process.env.PUBLIC_AUTH_APPLE_CLIENT_ID;
  if (!clientId) {
    return null;
  }
  return { clientId };
}

function buildBackendAbsoluteUrl(req, pathname, params = {}) {
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : typeof protoHeader === 'string'
      ? protoHeader.split(',')[0]
      : req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const base = `${proto || 'https'}://${host}`;
  const url = new URL(pathname, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function buildAppRedirectUrl(pathname, params = {}) {
  const base = getPublicAppBaseUrl();
  const safePath = pathname && typeof pathname === 'string' ? pathname : '/account';
  let url;
  try {
    url = new URL(safePath, base);
  } catch (_) {
    url = new URL('/account', base);
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function createOAuthState(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: OAUTH_STATE_TTL_SECONDS });
}

function verifyOAuthState(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

async function refreshJwks(provider) {
  const cache = jwksCache[provider];
  if (!cache) {
    throw new Error(`Provider necunoscut pentru JWKS: ${provider}`);
  }
  const response = await fetch(cache.url);
  if (!response.ok) {
    throw new Error(`Nu am putut descărca cheile publice pentru ${provider}.`);
  }
  const data = await response.json();
  cache.pems.clear();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  for (const jwk of keys) {
    if (!jwk || !jwk.kid) continue;
    try {
      const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      const pem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
      cache.pems.set(jwk.kid, pem);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[oauth] conversia JWK a eșuat pentru ${provider}:`, err?.message || err);
      }
    }
  }
  cache.fetchedAt = Date.now();
}

async function getPemForProvider(provider, kid) {
  const cache = jwksCache[provider];
  if (!cache) {
    throw new Error(`Provider necunoscut: ${provider}`);
  }
  const now = Date.now();
  if (!cache.pems.size || now - cache.fetchedAt > JWKS_CACHE_TTL_MS || !cache.pems.has(kid)) {
    await refreshJwks(provider);
  }
  return cache.pems.get(kid) || null;
}

let emailVerificationTableReady = false;
let oauthIdentityTableReady = false;

function mapUser(row) {
  const id = typeof row.id === 'bigint' ? Number(row.id) : Number(row.id);
  return {
    id,
    email: row.email,
    name: row.name || null,
    phone: row.phone || null,
    emailVerified: Boolean(row.email_verified_at),
    phoneVerified: Boolean(row.phone_verified_at),
  };
}

function buildSession(row, overrides = {}) {
  return {
    user: mapUser(row),
    ...overrides,
  };
}

async function ensureEmailVerificationTable() {
  if (emailVerificationTableReady) {
    return;
  }

  await db.query(
    `CREATE TABLE IF NOT EXISTS public_user_email_verifications (
      id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id bigint(20) UNSIGNED NOT NULL,
      token_hash char(64) NOT NULL,
      expires_at datetime NOT NULL,
      consumed_at datetime DEFAULT NULL,
      created_at datetime NOT NULL DEFAULT current_timestamp(),
      updated_at datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY idx_public_user_email_verifications_token (token_hash),
      KEY idx_public_user_email_verifications_user (user_id),
      CONSTRAINT fk_public_user_email_verifications_user FOREIGN KEY (user_id)
        REFERENCES public_users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  emailVerificationTableReady = true;
}

async function ensureOAuthIdentitiesTable() {
  if (oauthIdentityTableReady) {
    return;
  }

  await db.query(
    `CREATE TABLE IF NOT EXISTS public_user_oauth_identities (
      id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id bigint(20) UNSIGNED NOT NULL,
      provider varchar(32) NOT NULL,
      provider_user_id varchar(191) NOT NULL,
      email varchar(255) DEFAULT NULL,
      name varchar(255) DEFAULT NULL,
      raw_profile json DEFAULT NULL,
      created_at datetime NOT NULL DEFAULT current_timestamp(),
      updated_at datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY uq_public_user_oauth_identity (provider, provider_user_id),
      KEY idx_public_user_oauth_email (email),
      CONSTRAINT fk_public_user_oauth_user FOREIGN KEY (user_id)
        REFERENCES public_users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  oauthIdentityTableReady = true;
}

async function loadOAuthIdentity(provider, providerUserId) {
  await ensureOAuthIdentitiesTable();
  const { rows } = await db.query(
    `SELECT id, user_id, email, name
       FROM public_user_oauth_identities
      WHERE provider = ? AND provider_user_id = ?
      LIMIT 1`,
    [provider, providerUserId]
  );
  return rows && rows.length ? rows[0] : null;
}

async function linkOAuthIdentity(userId, provider, identityData) {
  await ensureOAuthIdentitiesTable();
  const cleanedEmail = identityData.email ? String(identityData.email).trim().slice(0, 255) : null;
  const cleanedName = identityData.name ? String(identityData.name).trim().slice(0, 255) : null;
  let rawProfile = null;
  if (identityData.rawProfile) {
    try {
      rawProfile = JSON.stringify(identityData.rawProfile);
      if (rawProfile.length > 65000) {
        rawProfile = rawProfile.slice(0, 65000);
      }
    } catch (_) {
      rawProfile = null;
    }
  }

  await db.query(
    `INSERT INTO public_user_oauth_identities
      (user_id, provider, provider_user_id, email, name, raw_profile, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       name = VALUES(name),
       raw_profile = VALUES(raw_profile),
       updated_at = NOW()`,
    [userId, provider, identityData.providerUserId, cleanedEmail, cleanedName, rawProfile]
  );
}

async function findOrCreateUserForOAuth(provider, identityData) {
  await ensureOAuthIdentitiesTable();

  const existingIdentity = await loadOAuthIdentity(provider, identityData.providerUserId);
  let email = identityData.email || null;
  if (!email && existingIdentity && existingIdentity.email) {
    email = existingIdentity.email;
  }

  let userRow = null;
  if (existingIdentity) {
    const userId = typeof existingIdentity.user_id === 'bigint' ? Number(existingIdentity.user_id) : existingIdentity.user_id;
    if (Number.isFinite(userId)) {
      userRow = await loadUserById(userId);
    }
  }

  let normalizedEmail = email ? normalizeEmail(email) : null;

  if (!userRow && normalizedEmail) {
    const { rows } = await db.query(
      `SELECT id, email_verified_at, name
         FROM public_users
        WHERE email_normalized = ?
        LIMIT 1`,
      [normalizedEmail]
    );
    if (rows && rows.length) {
      const found = rows[0];
      const userId = typeof found.id === 'bigint' ? Number(found.id) : found.id;
      if (Number.isFinite(userId)) {
        userRow = await loadUserById(userId);
      }
    }
  }

  if (!userRow) {
    if (!email || !normalizedEmail) {
      throw new Error('Nu am primit o adresă de email validă de la furnizorul de autentificare.');
    }

    const insert = await db.query(
      `INSERT INTO public_users
        (email, email_normalized, password_hash, name, phone, phone_normalized, email_verified_at, created_at, updated_at)
       VALUES (?, ?, NULL, ?, NULL, NULL, ?, NOW(), NOW())`,
      [
        String(email).trim().slice(0, 255),
        normalizedEmail,
        identityData.name ? String(identityData.name).trim().slice(0, 255) : null,
        identityData.emailVerified ? new Date() : null,
      ]
    );

    const newUserId = insert.insertId;
    userRow = await loadUserById(newUserId);
  } else {
    const updates = [];
    const params = [];

    if (identityData.emailVerified) {
      const { rows } = await db.query('SELECT email_verified_at FROM public_users WHERE id = ? LIMIT 1', [userRow.id]);
      const verifiedAt = rows && rows.length ? rows[0].email_verified_at : null;
      if (!verifiedAt) {
        updates.push('email_verified_at = NOW()');
      }
    }

    if (identityData.name) {
      const trimmed = String(identityData.name).trim().slice(0, 255);
      if (trimmed && !userRow.name) {
        updates.push('name = ?');
        params.push(trimmed);
      }
    }

    if (updates.length) {
      updates.push('updated_at = NOW()');
      params.push(userRow.id);
      await db.query(`UPDATE public_users SET ${updates.join(', ')} WHERE id = ?`, params);
      userRow = await loadUserById(userRow.id);
    }
  }

  if (!userRow) {
    throw new Error('Nu am putut crea sau încărca utilizatorul pentru autentificarea socială.');
  }

  await linkOAuthIdentity(userRow.id, provider, { ...identityData, email });

  return userRow;
}

async function verifyGoogleIdToken(idToken, expectedNonce, clientId) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.payload) {
    throw new Error('Tokenul Google nu a putut fi decodat.');
  }
  const pem = await getPemForProvider('google', decoded.header.kid);
  if (!pem) {
    throw new Error('Nu am putut valida semnătura tokenului Google.');
  }
  const payload = jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    audience: clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  });
  if (expectedNonce && payload.nonce && payload.nonce !== expectedNonce) {
    throw new Error('Nonce invalid pentru tokenul Google.');
  }
  return payload;
}

async function verifyAppleIdToken(idToken, expectedNonce, clientId) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.payload) {
    throw new Error('Tokenul Apple nu a putut fi decodat.');
  }
  const pem = await getPemForProvider('apple', decoded.header.kid);
  if (!pem) {
    throw new Error('Nu am putut valida semnătura tokenului Apple.');
  }
  const payload = jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    audience: clientId,
    issuer: 'https://appleid.apple.com',
  });
  if (expectedNonce && payload.nonce && payload.nonce !== expectedNonce) {
    throw new Error('Nonce invalid pentru tokenul Apple.');
  }
  return payload;
}

async function exchangeGoogleCodeForTokens(code, codeVerifier, callbackUrl, config) {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code',
  });
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    const message = payload.error_description || payload.error || 'Schimbul codului Google a eșuat.';
    throw new Error(message);
  }
  return payload;
}

function parseAppleUserInfo(raw) {
  if (!raw) {
    return { name: null };
  }
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const firstName = data?.name?.firstName ? String(data.name.firstName).trim() : '';
    const lastName = data?.name?.lastName ? String(data.name.lastName).trim() : '';
    const name = `${firstName} ${lastName}`.trim() || null;
    return { name };
  } catch (_) {
    return { name: null };
  }
}

async function createEmailVerificationToken(userId) {
  const numericUserId = typeof userId === 'bigint' ? Number(userId) : Number(userId);
  if (!Number.isFinite(numericUserId)) {
    throw new Error('invalid user id for email verification');
  }

  await ensureEmailVerificationTable();

  await db.query(
    `UPDATE public_user_email_verifications
        SET consumed_at = NOW(), updated_at = NOW()
      WHERE user_id = ? AND consumed_at IS NULL`,
    [numericUserId]
  );

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);

  await db.query(
    `INSERT INTO public_user_email_verifications (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [numericUserId, tokenHash, EMAIL_VERIFICATION_TTL_HOURS]
  );

  return token;
}

function buildVerificationUrl(token, redirect) {
  const base = getPublicAppBaseUrl();
  try {
    const url = new URL(base);
    url.pathname = '/verify-email';
    url.searchParams.set('token', token);
    if (redirect) {
      url.searchParams.set('redirect', redirect);
    }
    return url.toString();
  } catch (_) {
    const normalizedBase = base.replace(/\/$/, '');
    const params = new URLSearchParams({ token });
    if (redirect) {
      params.set('redirect', redirect);
    }
    return `${normalizedBase}/verify-email?${params.toString()}`;
  }
}

async function sendVerificationEmail(userRow, token, options = {}) {
  const displayName = userRow.name ? userRow.name.trim() : null;
  const verificationUrl = buildVerificationUrl(token, options.redirect);

  const textBody = [
    `Salut${displayName ? `, ${displayName}` : ''}!`,
    '',
    'Confirmă-ți adresa de email pentru a-ți activa contul Pris-Com.',
    verificationUrl,
    '',
    'Dacă nu tu ai creat contul, ignoră acest mesaj.',
  ].join('\n');

  const htmlBody = [
    '<!DOCTYPE html>',
    '<html lang="ro">',
    '  <body style="font-family: Arial, sans-serif; color: #111; background-color: #f7f7f8; padding: 24px;">',
    `    <h2 style="font-weight: 600; color: #111;">Salut${displayName ? `, ${escapeHtml(displayName)}` : ''}!</h2>`,
    '    <p>Mai ai un singur pas: confirmă-ți adresa de email pentru a-ți activa contul pe <strong>pris-com.ro</strong>.</p>',
    `    <p style="margin: 24px 0;"><a href="${escapeHtml(verificationUrl)}" style="display: inline-block; padding: 12px 20px; background-color: #facc15; color: #111; font-weight: 600; text-decoration: none; border-radius: 9999px;">Activează-ți contul</a></p>`,
    '    <p style="color: #444;">Dacă butonul nu merge, copiază și lipește în browser următorul link:</p>',
    `    <p style="word-break: break-all;"><a href="${escapeHtml(verificationUrl)}">${escapeHtml(verificationUrl)}</a></p>`,
    '    <p style="margin-top: 32px; color: #555;">Dacă nu tu ai creat acest cont, poți ignora mesajul.</p>',
    '    <p style="margin-top: 24px;">Mulțumim,<br /><strong>Echipa Pris-Com</strong></p>',
    '  </body>',
    '</html>',
  ].join('\n');

  return sendMailSafe({
    to: userRow.email,
    subject: 'Confirmă-ți contul Pris-Com',
    text: textBody,
    html: htmlBody,
    from: process.env.SMTP_FROM,
  });
}

async function issueEmailVerification(userRow, options = {}) {
  const token = await createEmailVerificationToken(userRow.id);
  const mailResult = await sendVerificationEmail(userRow, token, options);
  return { token, emailSent: Boolean(mailResult) };
}

async function loadUserById(id) {
  const { rows } = await db.query(
    `SELECT id, email, name, phone, phone_normalized, email_verified_at, phone_verified_at
       FROM public_users
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows && rows.length ? rows[0] : null;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim().slice(0, 64) || null;
  }
  return (req.ip || '').slice(0, 64) || null;
}

async function createSession(req, res, userRow, options = {}) {
  const remember = Boolean(options.remember);
  const ttlSec = options.refreshTtlSec || (remember ? PUBLIC_REFRESH_REMEMBER_TTL_SEC : PUBLIC_REFRESH_TTL_SEC);
  const sessionId = crypto.randomUUID();
  const userId = typeof userRow.id === 'bigint' ? Number(userRow.id) : Number(userRow.id);
  const accessPayload = {
    id: userId,
    email: userRow.email,
    name: userRow.name || null,
  };
  const refreshPayload = {
    sid: sessionId,
    userId,
    remember,
  };

  const accessToken = signPublicAccessToken(accessPayload);
  const refreshToken = signPublicRefreshToken(refreshPayload);
  const refreshHash = sha256(refreshToken);

  await db.query(
    `INSERT INTO public_user_sessions (user_id, token_hash, user_agent, ip_address, created_at, expires_at, persistent, rotated_from)
     VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?)`
    ,
    [
      userId,
      refreshHash,
      (req.headers['user-agent'] || '').slice(0, 255) || null,
      clientIp(req),
      ttlSec,
      remember ? 1 : 0,
      options.rotatedFromHash || null,
    ]
  );

  await db.query('UPDATE public_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?', [userId]);

  setPublicAuthCookies(res, accessToken, refreshToken, { remember, refreshTtlSec: ttlSec });
  const session = buildSession(userRow);

  if (options.redirectTo) {
    res.redirect(options.redirectTo);
    return session;
  }

  res.status(options.statusCode || 200).json({
    success: true,
    message: options.message || null,
    session,
  });

  return session;
}

router.get('/session', async (req, res) => {
  if (!req.publicUser) {
    return res.json({ success: true, session: null });
  }
  const userRow = await loadUserById(req.publicUser.id);
  if (!userRow) {
    clearPublicAuthCookies(res);
    return res.json({ success: true, session: null });
  }
  return res.json({ success: true, session: buildSession(userRow) });
});

router.put('/profile', requirePublicAuth, async (req, res) => {
  const { name, phone } = req.body || {};

  const cleanedPhone = normalizePhone(phone);
  if (!cleanedPhone) {
    return res.status(400).json({ error: 'Introdu un număr de telefon valid.' });
  }
  const normalizedDigits = normalizePhoneDigits(cleanedPhone);
  if (!normalizedDigits) {
    return res.status(400).json({ error: 'Introdu un număr de telefon valid.' });
  }

  const cleanedName =
    typeof name === 'string' && name.trim().length
      ? name.trim().slice(0, 255)
      : null;

  let existingPhone = null;
  try {
    const { rows } = await db.query('SELECT phone FROM public_users WHERE id = ? LIMIT 1', [req.publicUser.id]);
    if (rows.length) {
      existingPhone = rows[0].phone || null;
    }
  } catch (err) {
    console.error('[public/auth/profile] load current phone failed', err);
    return res.status(500).json({ error: 'Nu am putut actualiza profilul. Încearcă din nou.' });
  }

  const updateParts = ['name = ?', 'phone = ?', 'phone_normalized = ?', 'updated_at = NOW()'];
  const params = [cleanedName, cleanedPhone, normalizedDigits];

  if ((existingPhone || '') !== (cleanedPhone || '')) {
    updateParts.push('phone_verified_at = NULL');
  }

  params.push(req.publicUser.id);

  try {
    await db.query(`UPDATE public_users SET ${updateParts.join(', ')} WHERE id = ?`, params);
  } catch (err) {
    console.error('[public/auth/profile] update failed', err);
    return res.status(500).json({ error: 'Nu am putut actualiza profilul. Încearcă din nou.' });
  }

  const updatedUser = await loadUserById(req.publicUser.id);
  if (!updatedUser) {
    return res.status(500).json({ error: 'Nu am putut încărca datele actualizate ale contului.' });
  }

  return res.json({
    success: true,
    message: 'Profil actualizat cu succes.',
    session: buildSession(updatedUser),
  });
});

router.post('/register', async (req, res) => {
  const { email, password, name, phone } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Te rugăm să introduci o adresă de email validă.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Parola trebuie să aibă cel puțin 8 caractere.' });
  }

  const cleanedPhone = normalizePhone(phone);
  if (!cleanedPhone) {
    return res.status(400).json({ error: 'Numărul de telefon este obligatoriu.' });
  }
  const normalizedDigits = normalizePhoneDigits(cleanedPhone);
  if (!normalizedDigits) {
    return res.status(400).json({ error: 'Introdu un număr de telefon valid.' });
  }

  const existing = await db.query(
    'SELECT id FROM public_users WHERE email_normalized = ? LIMIT 1',
    [normalizedEmail]
  );
  if (existing.rows.length) {
    return res.json({ success: false, message: 'Există deja un cont pentru această adresă de email.' });
  }

  const hashedPassword = await bcrypt.hash(String(password), 12);

const insert = await db.query(
  `INSERT INTO public_users (email, email_normalized, password_hash, name, phone, phone_normalized, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [
    String(email).trim(),
    normalizedEmail,
    hashedPassword,
    name ? String(name).trim().slice(0, 255) : null,
    cleanedPhone,
    normalizedDigits,
  ]
);

  const userId = insert.insertId;
  const userRow = await loadUserById(userId);
  if (!userRow) {
    return res.status(500).json({ error: 'Nu am putut crea contul. Încearcă din nou.' });
  }

  const { emailSent } = await issueEmailVerification(userRow);

  let message;
  if (emailSent) {
    message = 'Ți-am trimis un email cu linkul de confirmare. Verifică inbox-ul pentru a activa contul.';
  } else if (!isMailerConfigured()) {
    message =
      'Contul a fost creat, dar trimiterea emailului de confirmare nu este disponibilă momentan. Te rugăm să contactezi echipa Pris-Com pentru activare.';
  } else {
    message =
      'Contul a fost creat, însă nu am reușit să trimitem emailul de confirmare. Încearcă din nou peste câteva minute sau contactează-ne.';
  }

  return res.status(201).json({
    success: true,
    message,
    pendingVerification: true,
    emailSent,
  });
});

router.post('/login', async (req, res) => {
  const { email, password, remember } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Introdu emailul și parola pentru autentificare.' });
  }

  const { rows } = await db.query(
    `SELECT id, email, name, phone, phone_normalized, password_hash, email_verified_at, phone_verified_at
       FROM public_users
      WHERE email_normalized = ?
      LIMIT 1`,
    [normalizedEmail]
  );

  if (!rows.length) {
    return res.json({ success: false, message: 'Email sau parolă incorecte.' });
  }

  const userRow = rows[0];
  if (!userRow.password_hash) {
    return res.json({ success: false, message: 'Acest cont este legat de autentificarea socială. Folosește Google sau Apple.' });
  }

  const ok = await bcrypt.compare(String(password), String(userRow.password_hash));
  if (!ok) {
    return res.json({ success: false, message: 'Email sau parolă incorecte.' });
  }

  if (!userRow.email_verified_at) {
    const { emailSent } = await issueEmailVerification(userRow);
    let message;
    if (emailSent) {
      message = 'Trebuie să îți confirmi adresa de email înainte de autentificare. Ți-am trimis un nou email cu linkul de activare.';
    } else if (!isMailerConfigured()) {
      message =
        'Trebuie să îți confirmi adresa de email înainte de autentificare, însă trimiterea automată a mesajului nu este disponibilă momentan. Te rugăm să contactezi echipa Pris-Com.';
    } else {
      message =
        'Trebuie să îți confirmi adresa de email înainte de autentificare. Nu am putut retrimite emailul de confirmare, încearcă din nou mai târziu sau contactează-ne.';
    }

    return res.json({ success: false, message, needsVerification: true, emailSent });
  }

  return createSession(req, res, userRow, {
    remember: Boolean(remember),
    message: 'Autentificare reușită.',
  });
});

router.post('/email/verify', async (req, res) => {
  const { token } = req.body || {};
  const rawToken = typeof token === 'string' ? token.trim() : '';
  if (!rawToken) {
    return res.status(400).json({ error: 'Tokenul de verificare lipsește.' });
  }

  await ensureEmailVerificationTable();

  const tokenHash = sha256(rawToken);
  const { rows } = await db.query(
    `SELECT v.id, v.user_id, v.expires_at, v.consumed_at, u.email_verified_at
       FROM public_user_email_verifications v
       JOIN public_users u ON u.id = v.user_id
      WHERE v.token_hash = ?
      LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) {
    return res.json({ success: false, message: 'Linkul de verificare nu este valid sau a expirat.', needsVerification: true });
  }

  const record = rows[0];
  const numericUserId = typeof record.user_id === 'bigint' ? Number(record.user_id) : Number(record.user_id);
  if (!Number.isFinite(numericUserId)) {
    return res.status(400).json({ error: 'Token de verificare invalid.' });
  }
  const expiresAt = record.expires_at ? new Date(record.expires_at) : null;

  if (record.consumed_at) {
    const userRow = await loadUserById(numericUserId);
    if (userRow && userRow.email_verified_at) {
      return createSession(req, res, userRow, {
        message: 'Emailul tău era deja confirmat. Te-am autentificat.',
      });
    }
    return res.json({ success: false, message: 'Linkul de verificare a fost deja folosit. Cere un link nou.', needsVerification: true });
  }

  if (expiresAt && expiresAt.getTime() < Date.now()) {
    await db.query(
      'UPDATE public_user_email_verifications SET consumed_at = NOW(), updated_at = NOW() WHERE id = ? AND consumed_at IS NULL',
      [record.id]
    );
    return res.json({ success: false, message: 'Linkul de verificare a expirat. Cere un link nou.', needsVerification: true, expired: true });
  }

  await db.query(
    'UPDATE public_user_email_verifications SET consumed_at = NOW(), updated_at = NOW() WHERE id = ? AND consumed_at IS NULL',
    [record.id]
  );
  await db.query(
    'UPDATE public_users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = ? AND email_verified_at IS NULL',
    [numericUserId]
  );

  const userRow = await loadUserById(numericUserId);
  if (!userRow) {
    return res.status(404).json({ error: 'Contul nu mai există.' });
  }

  return createSession(req, res, userRow, {
    message: 'Email confirmat! Contul tău a fost activat.',
  });
});

router.post('/email/resend', async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Te rugăm să introduci o adresă de email validă.' });
  }

  const { rows } = await db.query(
    `SELECT id, email, name, email_verified_at
       FROM public_users
      WHERE email_normalized = ?
      LIMIT 1`,
    [normalizedEmail]
  );

  if (!rows.length) {
    return res.json({
      success: true,
      message: 'Dacă există un cont pentru această adresă, vei primi în scurt timp un email de confirmare.',
    });
  }

  const userRow = rows[0];
  if (userRow.email_verified_at) {
    return res.json({ success: true, message: 'Emailul este deja confirmat. Te poți autentifica în cont.' });
  }

  const { emailSent } = await issueEmailVerification(userRow);

  let message;
  if (emailSent) {
    message = 'Ți-am trimis din nou emailul de confirmare. Verifică și folderele de spam sau promoții.';
  } else if (!isMailerConfigured()) {
    message =
      'Nu am putut trimite emailul de confirmare pentru că serviciul de email nu este configurat. Te rugăm să contactezi echipa Pris-Com pentru activare.';
  } else {
    message =
      'Nu am reușit să retrimitem emailul de confirmare. Încearcă din nou peste câteva minute sau contactează-ne.';
  }

  return res.json({ success: true, message, emailSent });
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.[PUBLIC_REFRESH_COOKIE];
  if (!refreshToken) {
    return res.status(401).json({ error: 'refresh lipsește' });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch (err) {
    clearPublicAuthCookies(res);
    return res.status(401).json({ error: 'refresh invalid' });
  }

  if (!payload || payload.type !== 'public_refresh' || !payload.sid || !payload.userId) {
    clearPublicAuthCookies(res);
    return res.status(401).json({ error: 'refresh invalid' });
  }

  const refreshHash = sha256(refreshToken);
  const { rows } = await db.query(
    `SELECT id, user_id, revoked_at, expires_at
       FROM public_user_sessions
      WHERE token_hash = ?
      LIMIT 1`,
    [refreshHash]
  );

  if (!rows.length) {
    clearPublicAuthCookies(res);
    return res.status(401).json({ error: 'refresh revocat' });
  }

  const session = rows[0];
  if (session.revoked_at) {
    clearPublicAuthCookies(res);
    return res.status(401).json({ error: 'refresh revocat' });
  }

  if (session.expires_at && new Date(session.expires_at) <= new Date()) {
    await db.query('UPDATE public_user_sessions SET revoked_at = NOW() WHERE id = ?', [session.id]);
    clearPublicAuthCookies(res);
    return res.status(401).json({ error: 'refresh expirat' });
  }

  await db.query('UPDATE public_user_sessions SET revoked_at = NOW(), rotated_from = ? WHERE id = ?', [refreshHash, session.id]);

  const userRow = await loadUserById(session.user_id);
  if (!userRow) {
    clearPublicAuthCookies(res);
    return res.status(401).json({ error: 'cont inexistent' });
  }

  return createSession(req, res, userRow, {
    remember: Boolean(payload.remember),
    rotatedFromHash: refreshHash,
  });
});

router.post('/logout', requirePublicAuth, async (req, res) => {
  const refreshToken = req.cookies?.[PUBLIC_REFRESH_COOKIE];
  if (refreshToken) {
    try {
      const refreshHash = sha256(refreshToken);
      await db.query('UPDATE public_user_sessions SET revoked_at = NOW() WHERE token_hash = ?', [refreshHash]);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[publicAuth] logout revoke failed:', err?.message || err);
      }
    }
  }
  clearPublicAuthCookies(res);
  return res.json({ success: true, message: 'Ai fost deconectat.' });
});

function normalizeRememberParam(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const lower = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lower)) {
    return 1;
  }
  if (['0', 'false', 'no', 'off'].includes(lower)) {
    return 0;
  }
  return null;
}

function normalizeVariant(value) {
  return value === 'register' ? 'register' : 'login';
}

function providerNotConfiguredReason(provider) {
  if (provider === 'google') {
    return 'Configurează PUBLIC_AUTH_GOOGLE_CLIENT_ID și PUBLIC_AUTH_GOOGLE_CLIENT_SECRET.';
  }
  if (provider === 'apple') {
    return 'Configurează PUBLIC_AUTH_APPLE_CLIENT_ID în backend.';
  }
  return 'Provider neconfigurat.';
}

router.get('/oauth/providers', (req, res) => {
  const redirectRaw = typeof req.query.redirect === 'string' ? req.query.redirect : null;
  const redirectPath = sanitizeRedirectPath(redirectRaw) || '/account';
  const variant = normalizeVariant(typeof req.query.variant === 'string' ? req.query.variant : null);
  const rememberFlag = normalizeRememberParam(req.query.remember);

  const providers = [];

  const googleConfig = getGoogleConfig();
  if (googleConfig) {
    providers.push({
      id: 'google',
      enabled: true,
      url: buildBackendAbsoluteUrl(req, '/api/public/auth/oauth/google', {
        redirect: redirectPath,
        variant,
        ...(rememberFlag != null ? { remember: rememberFlag } : {}),
      }),
    });
  } else {
    providers.push({ id: 'google', enabled: false, url: null, reason: providerNotConfiguredReason('google') });
  }

  const appleConfig = getAppleConfig();
  if (appleConfig) {
    providers.push({
      id: 'apple',
      enabled: true,
      url: buildBackendAbsoluteUrl(req, '/api/public/auth/oauth/apple', {
        redirect: redirectPath,
        variant,
        ...(rememberFlag != null ? { remember: rememberFlag } : {}),
      }),
    });
  } else {
    providers.push({ id: 'apple', enabled: false, url: null, reason: providerNotConfiguredReason('apple') });
  }

  return res.json({ providers });
});

async function startOAuth(req, res) {
  const provider = req.params.provider;
  const variant = normalizeVariant(typeof req.query.variant === 'string' ? req.query.variant : null);
  const redirectPath = sanitizeRedirectPath(typeof req.query.redirect === 'string' ? req.query.redirect : null) || '/account';
  const rememberFlag = normalizeRememberParam(req.query.remember);

  const baseState = {
    provider,
    redirect: redirectPath,
    variant,
    remember: rememberFlag === 1 ? 1 : 0,
  };

  try {
    if (provider === 'google') {
      const config = getGoogleConfig();
      if (!config) {
        return res.status(501).send('Autentificarea Google nu este configurată.');
      }
      const codeVerifier = createCodeVerifier();
      const nonce = createNonce();
      const state = createOAuthState({ ...baseState, codeVerifier, nonce });
      const callbackUrl = buildBackendAbsoluteUrl(req, '/api/public/auth/oauth/google/callback');
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', callbackUrl);
      authUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPE);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('code_challenge', createCodeChallenge(codeVerifier));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'select_account');
      authUrl.searchParams.set('nonce', nonce);
      return res.redirect(authUrl.toString());
    }

    if (provider === 'apple') {
      const config = getAppleConfig();
      if (!config) {
        return res.status(501).send('Autentificarea Apple nu este configurată.');
      }
      const codeVerifier = createCodeVerifier();
      const nonce = createNonce();
      const state = createOAuthState({ ...baseState, codeVerifier, nonce });
      const callbackUrl = buildBackendAbsoluteUrl(req, '/api/public/auth/oauth/apple/callback');
      const authUrl = new URL('https://appleid.apple.com/auth/authorize');
      authUrl.searchParams.set('response_type', 'code id_token');
      authUrl.searchParams.set('response_mode', 'form_post');
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', callbackUrl);
      authUrl.searchParams.set('scope', APPLE_OAUTH_SCOPE);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('nonce', nonce);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('code_challenge', createCodeChallenge(codeVerifier));
      return res.redirect(authUrl.toString());
    }

    return res.status(404).json({ error: 'provider necunoscut' });
  } catch (err) {
    console.error(`[publicAuth] start oauth ${provider} failed:`, err);
    const fallbackPath = normalizeVariant(baseState.variant) === 'register' ? '/register' : '/login';
    const params = {
      oauth: provider,
      status: 'error',
      reason: 'start_failed',
    };
    if (baseState.redirect) {
      params.redirect = baseState.redirect;
    }
    const fallback = buildAppRedirectUrl(fallbackPath, params);
    return res.redirect(fallback);
  }
}

function buildOAuthErrorRedirect(statePayload, provider, reason) {
  const variant = normalizeVariant(statePayload?.variant);
  const redirectTarget = variant === 'register' ? '/register' : '/login';
  const params = {
    oauth: provider,
    status: 'error',
    reason,
  };
  if (statePayload?.redirect) {
    params.redirect = statePayload.redirect;
  }
  return buildAppRedirectUrl(redirectTarget, params);
}

router.get('/oauth/:provider', startOAuth);
router.get('/oauth/:provider/start', startOAuth);

async function handleOAuthCallback(req, res) {
  const provider = req.params.provider;
  const params = req.method === 'POST' ? req.body || {} : req.query || {};
  const stateToken = typeof params.state === 'string' ? params.state : null;
  const fallback = buildAppRedirectUrl('/login', {
    oauth: provider,
    status: 'error',
    reason: 'missing_state',
  });

  if (!stateToken) {
    return res.redirect(fallback);
  }

  let statePayload;
  try {
    statePayload = verifyOAuthState(stateToken);
  } catch (err) {
    console.error(`[publicAuth] ${provider} oauth state invalid:`, err);
    return res.redirect(fallback);
  }

  if (!statePayload || statePayload.provider !== provider) {
    return res.redirect(fallback);
  }

  const remember = statePayload.remember === 1 || statePayload.remember === '1';
  const successRedirect = buildAppRedirectUrl(statePayload.redirect || '/account', {
    oauth: provider,
    status: 'success',
  });

  try {
    if (provider === 'google') {
      const config = getGoogleConfig();
      if (!config) {
        return res.redirect(buildOAuthErrorRedirect(statePayload, provider, 'not_configured'));
      }
      const code = typeof params.code === 'string' ? params.code : null;
      if (!code) {
        return res.redirect(buildOAuthErrorRedirect(statePayload, provider, 'missing_code'));
      }
      const callbackUrl = buildBackendAbsoluteUrl(req, '/api/public/auth/oauth/google/callback');
      const tokens = await exchangeGoogleCodeForTokens(code, statePayload.codeVerifier, callbackUrl, config);
      const idToken = tokens.id_token;
      if (!idToken) {
        return res.redirect(buildOAuthErrorRedirect(statePayload, provider, 'missing_token'));
      }
      const googlePayload = await verifyGoogleIdToken(idToken, statePayload.nonce, config.clientId);
      const fullName = googlePayload.name
        ? String(googlePayload.name)
        : `${googlePayload.given_name || ''} ${googlePayload.family_name || ''}`.trim() || null;
      const identity = {
        providerUserId: googlePayload.sub,
        email: googlePayload.email || null,
        emailVerified: googlePayload.email_verified === true || googlePayload.email_verified === 'true',
        name: fullName,
        rawProfile: {
          idToken: {
            sub: googlePayload.sub,
            email: googlePayload.email || null,
            email_verified: googlePayload.email_verified ?? null,
            name: fullName,
            given_name: googlePayload.given_name || null,
            family_name: googlePayload.family_name || null,
            locale: googlePayload.locale || null,
            picture: googlePayload.picture || null,
          },
          token: {
            scope: tokens.scope || null,
            expires_in: tokens.expires_in || null,
          },
        },
      };

      const userRow = await findOrCreateUserForOAuth(provider, identity);
      await createSession(req, res, userRow, {
        remember,
        redirectTo: successRedirect,
        message: 'Autentificare reușită.',
      });
      return;
    }

    if (provider === 'apple') {
      const config = getAppleConfig();
      if (!config) {
        return res.redirect(buildOAuthErrorRedirect(statePayload, provider, 'not_configured'));
      }
      const idToken = typeof params.id_token === 'string' ? params.id_token : null;
      if (!idToken) {
        return res.redirect(buildOAuthErrorRedirect(statePayload, provider, 'missing_token'));
      }
      const applePayload = await verifyAppleIdToken(idToken, statePayload.nonce, config.clientId);
      const userInfo = parseAppleUserInfo(params.user);
      const identity = {
        providerUserId: applePayload.sub,
        email: applePayload.email || null,
        emailVerified: applePayload.email_verified === true || applePayload.email_verified === 'true',
        name: userInfo.name || null,
        rawProfile: {
          idToken: {
            sub: applePayload.sub,
            email: applePayload.email || null,
            email_verified: applePayload.email_verified ?? null,
          },
        },
      };

      const userRow = await findOrCreateUserForOAuth(provider, identity);
      await createSession(req, res, userRow, {
        remember,
        redirectTo: successRedirect,
        message: 'Autentificare reușită.',
      });
      return;
    }

    return res.redirect(buildOAuthErrorRedirect(statePayload, provider, 'unknown_provider'));
  } catch (err) {
    console.error(`[publicAuth] ${provider} oauth callback failed:`, err);
    const reason =
      typeof err?.message === 'string' && err.message.toLowerCase().includes('email')
        ? 'missing_email'
        : 'oauth_failed';
    return res.redirect(buildOAuthErrorRedirect(statePayload, provider, reason));
  }
}

router.get('/oauth/:provider/callback', handleOAuthCallback);
router.post('/oauth/:provider/callback', handleOAuthCallback);

module.exports = router;
