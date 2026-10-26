import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { ConflictError, createStore } from './store.js';
import { createAuth } from './auth.js';
import { createImageSizer } from './images.js';
import * as totp from './totp.js';
import { updateInfo } from './version.js';
import * as helpers from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// ---------- Configuration ----------
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(root, 'public');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function persisted(name, make) {
  const file = path.join(DATA_DIR, name);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const value = make();
  fs.writeFileSync(file, value, { mode: 0o600 });
  return value;
}

function normalizeAdminPath(value) {
  let p = String(value || '').trim();
  if (!p) return '';
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/+$/, '');
  if (!/^(\/[A-Za-z0-9_-]+)+$/.test(p) || p.length < 4 || ['/assets', '/uploads', '/healthz'].includes(p)) {
    throw new Error(`ADMIN_PATH invalide : "${value}" (lettres, chiffres, - et _ uniquement, 3 caractères minimum).`);
  }
  return p;
}

// Proxys à croire pour connaître l'IP des visiteurs (limite de tentatives, cookie Secure).
// « true » croirait n'importe quel en-tête X-Forwarded-For : on le remplace par les
// adresses locales, où se trouvent les reverse proxys habituels.
function trustProxySetting(value) {
  const v = String(value || '').trim();
  if (!v || v === 'false') return false;
  if (v === 'true' || v === '*') {
    console.warn(
      '[folichon] TRUST_PROXY=true permettrait de falsifier son IP : « loopback, uniquelocal » utilisé à la place.'
    );
    return 'loopback, uniquelocal';
  }
  return /^\d+$/.test(v) ? Number(v) : v;
}

// Adresse publique du site (aperçus de partage). Sans elle, on la déduit de la requête.
function normalizeSiteUrl(value) {
  const v = String(value || '')
    .trim()
    .replace(/\/+$/, '');
  if (!v) return '';
  if (!/^https?:\/\/[^/\s]+$/i.test(v))
    throw new Error(`SITE_URL invalide : "${value}" (exemple : https://exemple.fr).`);
  return v;
}

const ADMIN_PATH =
  normalizeAdminPath(process.env.ADMIN_PATH) ||
  persisted('admin-path.txt', () => `/gestion-${crypto.randomBytes(5).toString('hex')}`);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || persisted('.session-secret', () => crypto.randomBytes(32).toString('hex'));
const SITE_URL = normalizeSiteUrl(process.env.SITE_URL);
const adminEnabled =
  ADMIN_PASSWORD.length >= 8 && !['changeme', 'password', 'motdepasse'].includes(ADMIN_PASSWORD.toLowerCase());

// Double authentification : la clé est créée à la première connexion et gardée dans
// DATA_DIR/totp.json. Supprimer ce fichier (puis redémarrer) relance l'enregistrement.
const TOTP_FILE = path.join(DATA_DIR, 'totp.json');
let totpSecret = '';
try {
  totpSecret = JSON.parse(fs.readFileSync(TOTP_FILE, 'utf8')).secret || '';
} catch {
  /* pas encore configurée */
}
let totpLastCounter = -1;

const store = createStore(DATA_DIR);
// Les sessions dépendent aussi de la clé 2FA : la changer déconnecte tout le monde.
const auth = createAuth({
  password: ADMIN_PASSWORD,
  secret: SECRET,
  cookiePath: ADMIN_PATH,
  sessionVersion: () => totpSecret
});
const imageSize = createImageSizer({ '/assets/': PUBLIC_DIR, '/uploads/': UPLOAD_DIR });

// ---------- Application ----------
const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.set('trust proxy', trustProxySetting(process.env.TRUST_PROXY));
// Change à chaque démarrage : les navigateurs rechargent CSS et JS après une mise à jour.
app.locals.assetVersion = Date.now().toString(36);

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
});
app.use(compression());

app.use('/assets', express.static(PUBLIC_DIR, { maxAge: '7d' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

app.get('/', (req, res) => {
  res.render('index', {
    c: store.read(),
    h: helpers,
    imageSize,
    pageUrl: `${SITE_URL || `${req.protocol}://${req.get('host')}`}/`
  });
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Favicon : le logo Folichon (et sa version PNG pour l'écran d'accueil des iPhone).
const FAVICON = path.join(PUBLIC_DIR, 'folichon.svg');
app.get('/favicon.svg', (req, res) => res.set('Cache-Control', 'public, max-age=86400').sendFile(FAVICON));
app.get('/apple-touch-icon.png', (req, res) =>
  res.set('Cache-Control', 'public, max-age=86400').sendFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'))
);
// Certains navigateurs demandent /favicon.ico d'office.
app.get('/favicon.ico', (req, res) => res.redirect(302, '/favicon.svg'));

// ---------- Fichiers envoyés depuis l'admin ----------
// Le type annoncé par le navigateur est vérifié sur le contenu réel du fichier.
const ascii = (buf, start, end) => buf.subarray(start, end).toString('latin1');
const UPLOAD_TYPES = {
  'image/png': { ext: '.png', looksRight: (b) => b.readUInt32BE(0) === 0x89504e47 },
  'image/jpeg': { ext: '.jpg', looksRight: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: '.webp', looksRight: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
  'image/gif': { ext: '.gif', looksRight: (b) => ascii(b, 0, 4) === 'GIF8' },
  'image/avif': { ext: '.avif', looksRight: (b) => ascii(b, 4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(b, 8, 12)) },
  'application/pdf': { ext: '.pdf', looksRight: (b) => ascii(b, 0, 5) === '%PDF-' }
};

function fileMatchesType(file, mimetype) {
  const head = Buffer.alloc(16);
  const fd = fs.openSync(file, 'r');
  try {
    const read = fs.readSync(fd, head, 0, head.length, 0);
    return read >= 12 && UPLOAD_TYPES[mimetype].looksRight(head);
  } finally {
    fs.closeSync(fd);
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${UPLOAD_TYPES[file.mimetype].ext}`)
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, Object.hasOwn(UPLOAD_TYPES, file.mimetype))
});

// Supprime les envois qui ne servent plus (ni dans le contenu, ni dans sa sauvegarde),
// en gardant ceux de moins de 24 h : ils peuvent attendre le prochain « Enregistrer ».
const UPLOAD_GRACE_MS = 24 * 60 * 60 * 1000;
async function pruneUploads() {
  try {
    let referenced = JSON.stringify(store.read());
    try {
      referenced += await fs.promises.readFile(path.join(DATA_DIR, 'content.backup.json'), 'utf8');
    } catch {
      /* pas encore de sauvegarde */
    }
    for (const name of await fs.promises.readdir(UPLOAD_DIR)) {
      if (referenced.includes(`/uploads/${name}`)) continue;
      const file = path.join(UPLOAD_DIR, name);
      const stats = await fs.promises.stat(file);
      if (stats.isFile() && Date.now() - stats.mtimeMs > UPLOAD_GRACE_MS) await fs.promises.unlink(file);
    }
  } catch (err) {
    console.error(`[folichon] Nettoyage des envois impossible : ${err.message}`);
  }
}

// ---------- Administration cachée ----------
const admin = express.Router();
const readForm = express.urlencoded({ extended: false, limit: '4kb' });

admin.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  if (!adminEnabled) {
    return res
      .status(503)
      .type('text')
      .send('Administration désactivée : définis ADMIN_PASSWORD (8 caractères minimum).');
  }
  next();
});

// Refuse les requêtes d'écriture venant d'un autre site.
function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      /* origine invalide */
    }
    if (host !== req.get('host')) return res.status(403).json({ error: 'Origine refusée.' });
  }
  next();
}

function requireLogin(req, res, next) {
  if (auth.isLoggedIn(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Session expirée, reconnecte-toi.' });
  return res.redirect(ADMIN_PATH);
}

function requireAjax(req, res, next) {
  if (req.get('x-requested-with') !== 'folichon-admin') return res.status(400).json({ error: 'Requête invalide.' });
  next();
}

const TOO_MANY = 'Trop de tentatives. Réessaie dans 15 minutes.';

function renderPasswordStep(res, status, error) {
  res.status(status).render('login', { base: ADMIN_PATH, step: 'password', error });
}

// Page de connexion selon l'étape : mot de passe, code, ou première configuration (QR code).
async function renderLogin(req, res, error = '', status = 200) {
  const pending = auth.pending(req);
  if (pending && totpSecret) {
    return res.status(status).render('login', { base: ADMIN_PATH, step: 'code', error });
  }
  if (!pending?.enroll) return renderPasswordStep(res, status, error);
  const uri = totp.otpauthUri(pending.enroll, 'Folichon', req.hostname);
  const qr = await QRCode.toString(uri, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#15131FFF', light: '#FFFFFFFF' }
  });
  res.status(status).render('login', {
    base: ADMIN_PATH,
    step: 'enroll',
    error,
    qr,
    secret: totp.groupSecret(pending.enroll)
  });
}

admin.get('/', (req, res) => {
  if (!auth.isLoggedIn(req)) return renderLogin(req, res);
  res.render('admin', { base: ADMIN_PATH, socialTypes: helpers.socialTypes, iconNames: helpers.iconNames });
});

admin.post('/login', sameOrigin, readForm, (req, res) => {
  if (auth.blocked(req.ip)) return renderPasswordStep(res, 429, TOO_MANY);
  if (!auth.check(req.ip, req.body?.password)) return renderPasswordStep(res, 401, 'Mot de passe incorrect.');
  // Étape 2 : code de l'application. À la toute première connexion, on prépare une clé à enregistrer.
  auth.startPending(req, res, totpSecret ? {} : { enroll: totp.newSecret() });
  res.redirect(303, ADMIN_PATH);
});

admin.post('/2fa', sameOrigin, readForm, async (req, res) => {
  const pending = auth.pending(req);
  const secret = totpSecret || pending?.enroll;
  if (!pending || !secret) return res.redirect(303, ADMIN_PATH);
  if (auth.blocked(req.ip)) return renderLogin(req, res, TOO_MANY, 429);

  const counter = totp.check(secret, req.body?.code, totpLastCounter);
  if (counter < 0) {
    auth.fail(req.ip);
    // Un code ne sert qu'une fois : on le dit clairement plutôt que « code incorrect ».
    const reused = totp.check(secret, req.body?.code) >= 0;
    const message = reused
      ? 'Ce code vient déjà de servir : attends le suivant (30 secondes au plus).'
      : 'Code incorrect ou expiré.';
    return renderLogin(req, res, message, 401);
  }
  totpLastCounter = counter;
  if (!totpSecret) {
    fs.writeFileSync(TOTP_FILE, JSON.stringify({ secret, createdAt: new Date().toISOString() }, null, 2), {
      mode: 0o600
    });
    totpSecret = secret;
    console.log("[folichon] Double authentification activée pour l'administration.");
  }
  auth.succeed(req.ip);
  auth.login(req, res);
  res.redirect(303, ADMIN_PATH);
});

admin.post('/logout', sameOrigin, (req, res) => {
  auth.logout(req, res);
  res.redirect(303, ADMIN_PATH);
});

const REVISION_HEADER = 'X-Content-Revision';

// Version installée et, si possible, dernière version publiée sur GitHub.
admin.get('/api/version', requireLogin, async (req, res) => {
  res.json(await updateInfo({ enabled: process.env.UPDATE_CHECK !== 'false' }));
});

admin.get('/api/content', requireLogin, (req, res) => {
  const content = store.read();
  res.set(REVISION_HEADER, store.revision()).json(content);
});

admin.put('/api/content', requireLogin, sameOrigin, requireAjax, express.json({ limit: '2mb' }), (req, res) => {
  let revision;
  try {
    // Sans en-tête de révision (anciens clients, scripts), l'enregistrement est accepté tel quel.
    revision = store.write(req.body, req.get(REVISION_HEADER));
  } catch (err) {
    return res.status(err instanceof ConflictError ? 409 : 400).json({ error: err.message });
  }
  res.set(REVISION_HEADER, revision).json({ ok: true });
  pruneUploads();
});

admin.post('/api/upload', requireLogin, sameOrigin, requireAjax, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop lourd (15 Mo max).' : err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Formats acceptés : PNG, JPG, WebP, GIF, AVIF ou PDF.' });
    if (!fileMatchesType(req.file.path, req.file.mimetype)) {
      fs.rmSync(req.file.path, { force: true });
      return res
        .status(400)
        .json({ error: 'Le contenu du fichier ne correspond pas à son type (fichier abîmé ou renommé ?).' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

app.use(ADMIN_PATH, admin);

app.use((req, res) => res.status(404).type('text').send('Page introuvable.'));

// Erreurs inattendues (JSON mal formé, fichier illisible…) : réponse courte, jamais de
// détail interne, et trace complète dans les logs pour les vraies pannes.
// Express reconnaît un gestionnaire d'erreurs à ses 4 paramètres, même si le dernier ne sert pas.
app.use((err, req, res, _next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error('[folichon]', err);
  const message = status === 500 ? 'Erreur interne du serveur.' : 'Requête invalide.';
  if (req.path.includes('/api/')) return res.status(status).json({ error: message });
  res.status(status).type('text').send(message);
});

const server = app.listen(PORT, () => {
  console.log(`[folichon] Site sur http://localhost:${PORT}`);
  if (adminEnabled) {
    console.log(`[folichon] Administration cachée : http://localhost:${PORT}${ADMIN_PATH}`);
    console.log(
      totpSecret
        ? '[folichon] Double authentification : active.'
        : '[folichon] Double authentification : à configurer à la prochaine connexion (QR code).'
    );
  } else {
    console.warn('[folichon] Administration désactivée : définis ADMIN_PASSWORD (8 caractères minimum).');
  }
  pruneUploads();
});

// Arrêt propre (docker stop) : on finit les requêtes en cours puis on quitte.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
