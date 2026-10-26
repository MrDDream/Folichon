// Codes à usage unique (TOTP, RFC 6238) compatibles Google Authenticator, Aegis,
// 2FAS, Bitwarden… : HMAC-SHA1, 6 chiffres, un nouveau code toutes les 30 secondes.
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;
const DIGITS = 6;

function toBase32(buf) {
  let bits = 0,
    value = 0,
    out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(str) {
  const clean = String(str)
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0,
    value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// Clé de 160 bits, la taille recommandée pour HMAC-SHA1.
export function newSecret() {
  return toBase32(crypto.randomBytes(20));
}

export function counterAt(time = Date.now()) {
  return Math.floor(time / 1000 / STEP);
}

export function codeAt(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hash = crypto.createHmac('sha1', fromBase32(secret)).update(msg).digest();
  const offset = hash[hash.length - 1] & 15;
  const num = (hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(num).padStart(DIGITS, '0');
}

// Accepte le code courant et ses voisins (± 30 s de décalage d'horloge).
// Renvoie le compteur reconnu, ou -1. Un compteur déjà utilisé est refusé (pas de rejeu).
export function check(secret, input, lastUsed = -1, time = Date.now()) {
  const candidate = String(input ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(candidate)) return -1;
  const now = counterAt(time);
  for (const counter of [now - 1, now, now + 1]) {
    if (counter <= lastUsed) continue;
    if (crypto.timingSafeEqual(Buffer.from(codeAt(secret, counter)), Buffer.from(candidate))) return counter;
  }
  return -1;
}

export function otpauthUri(secret, issuer, account) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP)
  });
  return `otpauth://totp/${label}?${params}`;
}

// « JBSWY3DPEHPK3PXP » → « JBSW Y3DP EHPK 3PXP », plus facile à recopier à la main.
export function groupSecret(secret) {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}
