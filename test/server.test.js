import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { codeAt, counterAt } from '../src/totp.js';

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = '/admin-test';
const PASSWORD = 'mot-de-passe-test';
let proc;
let dataDir;
let cookie = '';

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folichon-'));
  proc = spawn(process.execPath, ['src/server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      ADMIN_PATH: ADMIN,
      ADMIN_PASSWORD: PASSWORD,
      UPDATE_CHECK: 'false'
    },
    stdio: 'ignore'
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Le serveur ne démarre pas');
});

after(() => {
  proc?.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('la page publique affiche le contenu par défaut', async () => {
  const res = await fetch(BASE);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Appli mobile/);
  assert.match(html, /Service web/);
  assert.match(html, /<html [^>]*data-style="folichon"/);
  assert.ok(res.headers.get('content-security-policy'));

  const icon = await fetch(`${BASE}/favicon.svg`);
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await icon.text(), /<svg[\s\S]*<\/svg>/);
  assert.equal((await fetch(`${BASE}/apple-touch-icon.png`)).headers.get('content-type'), 'image/png');
  const ico = await fetch(`${BASE}/favicon.ico`, { redirect: 'manual' });
  assert.equal(ico.headers.get('location'), '/favicon.svg');
});

test("l'admin demande un mot de passe", async () => {
  const res = await fetch(BASE + ADMIN);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Mot de passe/);
  assert.equal((await fetch(`${BASE + ADMIN}/api/content`)).status, 401);
});

test('un mauvais mot de passe est refusé', async () => {
  const res = await fetch(`${BASE + ADMIN}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'password=faux'
  });
  assert.equal(res.status, 401);
});

// Envoie un formulaire et renvoie la réponse + les cookies posés (nom=valeur).
async function post(url, body, cookies = '') {
  const res = await fetch(BASE + ADMIN + url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookies },
    body: new URLSearchParams(body)
  });
  const set = Object.fromEntries(res.headers.getSetCookie().map((c) => c.split(';')[0].split(/=(.*)/s).slice(0, 2)));
  return { res, set };
}

test('double authentification : configuration par QR code, puis code à chaque connexion', async () => {
  // Mot de passe correct : on n'est pas encore connecté, il faut le code.
  const step1 = await post('/login', { password: PASSWORD });
  assert.equal(step1.res.status, 303);
  assert.ok(step1.set.pf_2fa);
  assert.equal(step1.set.pf_admin, undefined);
  const pending = `pf_2fa=${step1.set.pf_2fa}`;
  assert.equal((await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie: pending } })).status, 401);

  // Première connexion : QR code et clé à recopier.
  const page = await (await fetch(BASE + ADMIN, { headers: { cookie: pending } })).text();
  assert.match(page, /<svg[\s\S]*<\/svg>/);
  const secret = page.match(/id="totp-secret">([A-Z2-7 ]+)</)[1].replace(/ /g, '');

  const good = codeAt(secret, counterAt());
  const wrong = await post('/2fa', { code: good === '000000' ? '111111' : '000000' }, pending);
  assert.equal(wrong.res.status, 401);

  const ok = await post('/2fa', { code: good }, pending);
  assert.equal(ok.res.status, 303);
  assert.ok(ok.set.pf_admin);
  cookie = `pf_admin=${ok.set.pf_admin}`;
  assert.equal((await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie } })).status, 200);
  assert.ok(fs.existsSync(path.join(dataDir, 'totp.json')));

  // Connexion suivante : plus de QR code, le code est exigé et ne peut pas resservir.
  const again = await post('/login', { password: PASSWORD });
  const pending2 = `pf_2fa=${again.set.pf_2fa}`;
  const page2 = await (await fetch(BASE + ADMIN, { headers: { cookie: pending2 } })).text();
  assert.doesNotMatch(page2, /totp-secret/);
  assert.match(page2, /Code à 6 chiffres/);
  assert.equal((await post('/2fa', { code: good }, pending2)).res.status, 401);
  const next = await post('/2fa', { code: codeAt(secret, counterAt() + 1) }, pending2);
  assert.equal(next.res.status, 303);
});

test('connexion, modification et page publique mise à jour', async () => {
  const content = await (await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie } })).json();
  content.profile.name = 'Ada Test';
  content.profile.headline = 'Un *mot* <script>alert(1)</script>';
  content.socials[0].url = 'javascript:alert(1)';
  content.contact.email = 'ada@example.com';
  content.site.theme = 'pop';

  const noHeader = await fetch(`${BASE + ADMIN}/api/content`, {
    method: 'PUT',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(content)
  });
  assert.equal(noHeader.status, 400);

  const crossSite = await fetch(`${BASE + ADMIN}/api/content`, {
    method: 'PUT',
    headers: {
      cookie,
      'Content-Type': 'application/json',
      'X-Requested-With': 'folichon-admin',
      Origin: 'https://evil.example'
    },
    body: JSON.stringify(content)
  });
  assert.equal(crossSite.status, 403);

  const saved = await fetch(`${BASE + ADMIN}/api/content`, {
    method: 'PUT',
    headers: { cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'folichon-admin' },
    body: JSON.stringify(content)
  });
  assert.equal(saved.status, 200);

  const html = await (await fetch(BASE)).text();
  assert.match(html, /Ada Test/);
  assert.match(html, /<html [^>]*data-style="pop"/);
  assert.match(html, /<span class="hl">mot<\/span>/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /javascript:alert/);
  // L'adresse e-mail ne doit jamais apparaître en clair dans la page.
  assert.doesNotMatch(html, /ada@example\.com/);
  assert.match(html, /data-mail="[A-Za-z0-9+/=]+"/);
});

test("l'envoi d'image fonctionne et refuse le SVG", async () => {
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4f30000000049454e44ae426082',
    'hex'
  );
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png');
  const res = await fetch(`${BASE + ADMIN}/api/upload`, {
    method: 'POST',
    headers: { cookie, 'X-Requested-With': 'folichon-admin' },
    body: fd
  });
  assert.equal(res.status, 200);
  const { url } = await res.json();
  assert.equal((await fetch(BASE + url)).status, 200);

  const svg = new FormData();
  svg.append('file', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }), 'x.svg');
  const bad = await fetch(`${BASE + ADMIN}/api/upload`, {
    method: 'POST',
    headers: { cookie, 'X-Requested-With': 'folichon-admin' },
    body: svg
  });
  assert.equal(bad.status, 400);
});

test("police envoyée : acceptée d'après son contenu, puis utilisée par la page", async () => {
  const send = async (bytes, name, type = 'application/octet-stream') => {
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type }), name);
    return fetch(`${BASE + ADMIN}/api/upload`, {
      method: 'POST',
      headers: { cookie, 'X-Requested-With': 'folichon-admin' },
      body: fd
    });
  };
  // Les navigateurs envoient souvent les polices sans type précis : l'extension et le contenu suffisent.
  const woff2 = Buffer.concat([Buffer.from('wOF2', 'latin1'), Buffer.alloc(60)]);
  const ok = await send(woff2, 'MaPolice.woff2');
  assert.equal(ok.status, 200);
  const { url } = await ok.json();
  assert.match(url, /^\/uploads\/[a-z0-9-]+\.woff2$/);

  // Un faux fichier nommé .ttf est refusé.
  assert.equal((await send(Buffer.from('<html>pas une police</html>'), 'x.ttf')).status, 400);

  const content = await (await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie } })).json();
  content.site.fontDisplay = 'custom';
  content.site.fontDisplayFile = url;
  content.site.fontBody = 'serif';
  const saved = await fetch(`${BASE + ADMIN}/api/content`, {
    method: 'PUT',
    headers: { cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'folichon-admin' },
    body: JSON.stringify(content)
  });
  assert.equal(saved.status, 200);
  const html = await (await fetch(BASE)).text();
  assert.ok(html.includes(`src:url('${url}') format('woff2')`));
  assert.match(html, /--f-body:'Iowan Old Style'/);
});

test('un faux fichier (texte annoncé comme PNG) est refusé', async () => {
  const fake = new FormData();
  fake.append('file', new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }), 'x.png');
  const res = await fetch(`${BASE + ADMIN}/api/upload`, {
    method: 'POST',
    headers: { cookie, 'X-Requested-With': 'folichon-admin' },
    body: fake
  });
  assert.equal(res.status, 400);
});

test('un contenu abîmé (éléments vides) ne fait pas planter la page', async () => {
  const content = await (await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie } })).json();
  content.projects.push(null);
  content.stats = [null];
  content.timeline.unshift(null);
  const saved = await fetch(`${BASE + ADMIN}/api/content`, {
    method: 'PUT',
    headers: { cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'folichon-admin' },
    body: JSON.stringify(content)
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { ok: true });
  assert.equal((await fetch(BASE)).status, 200);
});

test('aperçus de partage : adresses complètes et en-têtes de sécurité', async () => {
  const res = await fetch(BASE);
  const html = await res.text();
  assert.match(html, /<meta property="og:url" content="http:\/\/127\.0\.0\.1:\d+\/">/);
  assert.match(html, /<meta name="twitter:card"/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  assert.ok(res.headers.get('permissions-policy'));
  assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
  // Images locales : dimensions présentes pour éviter les sauts de mise en page.
  assert.match(html, /<img src="\/assets\/img\/[^"]+" width="\d+" height="\d+"/);
});

test("deux onglets : l'enregistrement d'une version périmée est refusé (409)", async () => {
  const first = await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie } });
  const rev = first.headers.get('x-content-revision');
  const content = await first.json();
  assert.match(rev, /^[0-9a-f]{16}$/);
  const put = (rev2) =>
    fetch(`${BASE + ADMIN}/api/content`, {
      method: 'PUT',
      headers: {
        cookie,
        'Content-Type': 'application/json',
        'X-Requested-With': 'folichon-admin',
        'X-Content-Revision': rev2
      },
      body: JSON.stringify({ ...content, footer: { left: `Onglet ${rev2}` } })
    });
  const ok = await put(rev);
  assert.equal(ok.status, 200);
  // Le second onglet a toujours l'ancienne révision : refusé.
  const stale = await put(rev);
  assert.equal(stale.status, 409);
  // Avec la nouvelle révision renvoyée par le serveur, c'est accepté.
  assert.equal((await put(ok.headers.get('x-content-revision'))).status, 200);
});

test('JSON mal formé : réponse 400 courte, sans détail interne', async () => {
  const res = await fetch(`${BASE + ADMIN}/api/content`, {
    method: 'PUT',
    headers: { cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'folichon-admin' },
    body: '{ pas du json'
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.deepEqual(body, { error: 'Requête invalide.' });
});

test("l'admin connaît sa version (vérification GitHub désactivée pendant les tests)", async () => {
  const res = await fetch(`${BASE + ADMIN}/api/version`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const info = await res.json();
  assert.match(info.version, /^\d+\.\d+\.\d+/);
  assert.equal(info.latest, null);
  assert.equal((await fetch(`${BASE + ADMIN}/api/version`)).status, 401);
});

test('page publique en anglais quand la langue du site est « en »', async () => {
  const content = await (await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie } })).json();
  content.site.lang = 'en';
  const put = await fetch(`${BASE + ADMIN}/api/content`, {
    method: 'PUT',
    headers: { cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'folichon-admin' },
    body: JSON.stringify(content)
  });
  assert.equal(put.status, 200);
  const html = await (await fetch(BASE)).text();
  assert.match(html, /<html lang="en"[ >]/);
  assert.match(html, /View code ↗/);
  assert.match(html, /data-copied="Link copied ✓"/);
  assert.doesNotMatch(html, /Voir le code|Copier le lien|Partager la page/);
});

test('la déconnexion révoque la session côté serveur', async () => {
  const before = await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie } });
  assert.equal(before.status, 200);
  const out = await fetch(`${BASE + ADMIN}/logout`, { method: 'POST', redirect: 'manual', headers: { cookie } });
  assert.equal(out.status, 303);
  // Même en renvoyant l'ancien cookie, l'accès est refusé.
  assert.equal((await fetch(`${BASE + ADMIN}/api/content`, { headers: { cookie } })).status, 401);
});
