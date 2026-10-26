// Authentification de l'administration en deux étapes : mot de passe, puis code
// à 6 chiffres d'une application d'authentification (voir totp.js).
// Après le mot de passe, un jeton « en attente » valable 5 minutes permet de saisir
// le code ; la vraie session (12 h) n'est donnée qu'après le code. Les jetons sont
// signés et rangés dans des cookies HttpOnly.
//
// La clé de signature dépend du mot de passe et de la clé 2FA : changer l'un ou
// l'autre déconnecte toutes les sessions. Une déconnexion révoque le jeton côté
// serveur. Les échecs sont limités par IP et au total (contre les attaques
// réparties sur beaucoup d'adresses).
import crypto from 'node:crypto';

const COOKIE = 'pf_admin';
const PENDING = 'pf_2fa';
const TTL_MS = 12 * 60 * 60 * 1000;
const PENDING_TTL_MS = 5 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_TOTAL = 30;
const MAX_TRACKED_IPS = 10_000;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

export function createAuth({ password, secret, cookiePath, sessionVersion = () => '' }) {
  const expected = sha256(password);
  const fails = new Map(); // ip → { count, first }
  let totalFails = { count: 0, first: Date.now() };
  const revoked = new Map(); // id du jeton → date d'expiration

  // Ménage régulier : échecs trop anciens et jetons révoqués déjà expirés.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of fails) if (now - entry.first > WINDOW_MS) fails.delete(ip);
    for (const [id, exp] of revoked) if (exp < now) revoked.delete(id);
  }, WINDOW_MS).unref();

  function signingKey() {
    return crypto.createHmac('sha256', secret).update(`${password}\n${sessionVersion()}`).digest();
  }

  function sign(payload) {
    return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
  }

  function issue(data, ttl) {
    const body = { ...data, id: crypto.randomBytes(9).toString('base64url'), exp: Date.now() + ttl };
    const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
    return `${payload}.${sign(payload)}`;
  }

  // Renvoie le contenu du jeton s'il est intact, pas expiré et pas révoqué, sinon null.
  function verify(token) {
    if (typeof token !== 'string') return null;
    const [payload, sig, extra] = token.split('.');
    if (!payload || !sig || extra !== undefined) return null;
    const good = sign(payload);
    if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (typeof data.exp !== 'number' || data.exp <= Date.now() || revoked.has(data.id)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function readCookie(req, name) {
    for (const part of (req.headers.cookie || '').split(';')) {
      const [key, ...value] = part.trim().split('=');
      if (key === name) {
        try {
          return decodeURIComponent(value.join('='));
        } catch {
          return '';
        }
      }
    }
    return '';
  }

  function cookie(req, name, value, maxAgeMs) {
    const secure = req.secure ? '; Secure' : '';
    return `${name}=${value}; Max-Age=${Math.floor(maxAgeMs / 1000)}; Path=${cookiePath}; HttpOnly; SameSite=Strict${secure}`;
  }

  function windowExpired(entry) {
    return Date.now() - entry.first > WINDOW_MS;
  }

  function fail(ip) {
    if (windowExpired(totalFails)) totalFails = { count: 0, first: Date.now() };
    totalFails.count += 1;
    if (fails.size >= MAX_TRACKED_IPS && !fails.has(ip)) fails.delete(fails.keys().next().value);
    const entry = fails.get(ip);
    if (!entry || windowExpired(entry)) fails.set(ip, { count: 1, first: Date.now() });
    else entry.count += 1;
  }

  return {
    isLoggedIn(req) {
      return verify(readCookie(req, COOKIE))?.stage === 'full';
    },
    // Mot de passe validé, code pas encore saisi. `enroll` contient la clé en cours
    // d'enregistrement lors de la première connexion.
    pending(req) {
      const data = verify(readCookie(req, PENDING));
      return data?.stage === 'password' ? data : null;
    },
    blocked(ip) {
      if (!windowExpired(totalFails) && totalFails.count >= MAX_FAILS_TOTAL) return true;
      const entry = fails.get(ip);
      return Boolean(entry) && !windowExpired(entry) && entry.count >= MAX_FAILS_PER_IP;
    },
    check(ip, candidate) {
      const ok = crypto.timingSafeEqual(sha256(candidate ?? ''), expected);
      if (!ok) fail(ip);
      return ok;
    },
    fail,
    succeed(ip) {
      fails.delete(ip);
    },
    startPending(req, res, extra = {}) {
      res.setHeader(
        'Set-Cookie',
        cookie(req, PENDING, issue({ stage: 'password', ...extra }, PENDING_TTL_MS), PENDING_TTL_MS)
      );
    },
    login(req, res) {
      res.setHeader('Set-Cookie', [
        cookie(req, COOKIE, issue({ stage: 'full' }, TTL_MS), TTL_MS),
        cookie(req, PENDING, '', 0)
      ]);
    },
    logout(req, res) {
      for (const name of [COOKIE, PENDING]) {
        const data = verify(readCookie(req, name));
        if (data) revoked.set(data.id, data.exp);
      }
      res.setHeader('Set-Cookie', [cookie(req, COOKIE, '', 0), cookie(req, PENDING, '', 0)]);
    }
  };
}
