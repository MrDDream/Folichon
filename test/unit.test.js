import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as h from '../src/helpers.js';
import { createAuth } from '../src/auth.js';
import { createImageSizer } from '../src/images.js';
import { createStore } from '../src/store.js';
import { isNewer, releaseUrl } from '../src/version.js';
import zlib from 'node:zlib';
import { createZip, crc32, readZip, ZipError } from '../src/zip.js';
import { cardSvg, headlineWords, measure, renderCard, wrap } from '../src/share-card.js';

test('siteTheme : seuls les thèmes connus passent, sinon le thème par défaut', () => {
  for (const name of h.siteThemes) assert.equal(h.siteTheme(name), name);
  for (const bad of [undefined, '', 'inconnu', '" onload="x', 42, null]) assert.equal(h.siteTheme(bad), 'folichon');
});

test('fontCss : polices de la liste ou fichier envoyé, rien d’autre', () => {
  assert.equal(h.fontCss({}), '');
  assert.equal(h.fontCss({ fontDisplay: 'inconnue' }), '');
  assert.match(h.fontCss({ fontDisplay: 'mono' }), /--f-display:'JetBrains Mono'/);
  const custom = h.fontCss({ fontBody: 'custom', fontBodyFile: '/uploads/abc-123.woff2' });
  assert.match(
    custom,
    /@font-face\{font-family:'Folichon Texte';src:url\('\/uploads\/abc-123\.woff2'\) format\('woff2'\)/
  );
  assert.match(custom, /--f-body:'Folichon Texte'/);
  for (const bad of [
    "/uploads/x.woff2');}body{display:none",
    'https://evil.example/x.woff2',
    '/uploads/../x.ttf',
    '/uploads/x.svg'
  ]) {
    assert.equal(h.fontCss({ fontBody: 'custom', fontBodyFile: bad }), '');
  }
});

test('safeUrl : seuls les liens sûrs passent', () => {
  for (const ok of [
    'https://a.fr',
    'http://a.fr/x',
    'mailto:a@b.fr',
    'tel:+33600000000',
    '#projets',
    '/uploads/a.png'
  ]) {
    assert.equal(h.safeUrl(ok), ok);
  }
  for (const bad of [
    'javascript:alert(1)',
    ' JaVaScRiPt:x',
    'data:text/html,x',
    '//evil.fr',
    '/\\evil.fr',
    'ftp://a',
    42,
    null
  ]) {
    assert.equal(h.safeUrl(bad), '', String(bad));
  }
});

test('helpers : cas limites', () => {
  assert.equal(h.slug('Élise Ça Va !'), 'elise-ca-va');
  assert.deepEqual(h.bulletLines('- un\n\n• deux\n  * trois  '), ['un', 'deux', 'trois']);
  assert.equal(h.brandOf('https://www.linkedin.com/in/x'), 'linkedin');
  assert.equal(h.brandOf('https://github.com.evil.fr/'), '');
  assert.equal(h.brandOf('pas une adresse'), '');
  assert.equal(h.social('__proto__'), h.social('website'));
  assert.equal(h.icon('constructor'), h.icon('code'));
  assert.equal(h.color('red', '#000'), '#000');
  assert.match(h.highlight('<b>*x*</b>'), /^&lt;b&gt;<span class="hl">x<\/span>&lt;\/b&gt;$/);
});

function fakeReq(cookie = '') {
  return { headers: { cookie }, secure: false };
}
function fakeRes() {
  const res = { headers: {} };
  res.setHeader = (k, v) => (res.headers[k] = v);
  return res;
}
const cookieOf = (res, name) =>
  [res.headers['Set-Cookie']]
    .flat()
    .find((c) => c.startsWith(`${name}=`))
    .split(';')[0];

test('auth : la session change avec le mot de passe ou la clé 2FA, et la déconnexion la révoque', () => {
  let version = 'cle-1';
  const opts = { secret: 's', cookiePath: '/adm', sessionVersion: () => version };
  const auth = createAuth({ ...opts, password: 'mot-de-passe-1' });
  const res = fakeRes();
  auth.login(fakeReq(), res);
  const cookie = cookieOf(res, 'pf_admin');
  assert.ok(auth.isLoggedIn(fakeReq(cookie)));

  // Autre mot de passe → l'ancien cookie ne vaut plus rien.
  assert.equal(createAuth({ ...opts, password: 'mot-de-passe-2' }).isLoggedIn(fakeReq(cookie)), false);
  // Nouvelle clé 2FA → idem.
  version = 'cle-2';
  assert.equal(auth.isLoggedIn(fakeReq(cookie)), false);
  version = 'cle-1';

  auth.logout(fakeReq(cookie), fakeRes());
  assert.equal(auth.isLoggedIn(fakeReq(cookie)), false);
  // Jetons trafiqués ou mal formés.
  assert.equal(auth.isLoggedIn(fakeReq('pf_admin=a.b.c')), false);
  assert.equal(auth.isLoggedIn(fakeReq('pf_admin=%E0%A4%A')), false);
});

test('auth : limite par IP et limite globale (contre les IP qui changent sans cesse)', () => {
  const auth = createAuth({ password: 'mot-de-passe', secret: 's', cookiePath: '/adm' });
  for (let i = 0; i < 5; i++) auth.check('1.1.1.1', 'faux');
  assert.ok(auth.blocked('1.1.1.1'));
  assert.equal(auth.blocked('2.2.2.2'), false);
  for (let i = 0; i < 30; i++) auth.check(`10.0.0.${i}`, 'faux');
  assert.ok(auth.blocked('3.3.3.3'), 'au-delà de 30 échecs au total, tout le monde attend');
});

test('images : dimensions lues dans les fichiers, sans sortir du dossier', () => {
  const size = createImageSizer({ '/assets/': path.resolve('public') });
  // Images d'exemple (SVG) et logo (PNG).
  assert.deepEqual(size('/assets/img/example-phone-home.svg'), { width: 390, height: 844 });
  assert.deepEqual(size('/assets/img/example-browser.svg'), { width: 1600, height: 960 });
  const png = createImageSizer({ '/docs/': path.resolve('docs') })('/docs/logo.png');
  assert.deepEqual(png, { width: 512, height: 512 });
  assert.equal(size('/assets/../package.json'), null);
  assert.equal(size('/assets/%2e%2e/package.json'), null);
  assert.equal(size('/ailleurs/x.png'), null);
  assert.equal(size('/assets/img/absente.png'), null);
});

test('store : les éléments vides sont retirés, le reste est gardé', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folichon-store-'));
  try {
    const store = createStore(dir);
    store.write({ projects: [null, { name: 'A', bullets: ['x', null] }], stats: [null] });
    const saved = store.read();
    assert.deepEqual(saved, { projects: [{ name: 'A', bullets: ['x'] }], stats: [] });
    assert.throws(() => store.write([]));
    // Révision : une version périmée est refusée, et un changement fait à la main est relu.
    const rev = store.revision();
    assert.throws(() => store.write({ a: 1 }, 'perimee'), /modifié ailleurs/);
    fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify({ site: { title: 'À la main' } }));
    fs.utimesSync(path.join(dir, 'content.json'), new Date(), new Date(Date.now() + 5000));
    assert.equal(store.read().site.title, 'À la main');
    assert.notEqual(store.revision(), rev);
    assert.ok(fs.existsSync(path.join(dir, 'content.backup.json')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('versions : comparaison nombre par nombre', () => {
  assert.equal(isNewer('1.10.0', '1.9.2'), true);
  assert.equal(isNewer('v2.0.0', '1.99.99'), true);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('1.0.0', '1.0.1'), false);
});

test('versions : le lien de la note de version reste sur le dépôt Folichon', () => {
  const ok = 'https://github.com/MrDDream/Folichon/releases/tag/v0.2.0';
  assert.equal(releaseUrl(ok), ok);
  for (const bad of [
    'javascript:alert(1)',
    'https://evil.example/MrDDream/Folichon/',
    'https://github.com/autre/depot/',
    null
  ]) {
    assert.equal(releaseUrl(bad), 'https://github.com/MrDDream/Folichon/releases');
  }
});

test('zip : aller-retour, fichiers compressés (deflate) et archives abîmées', () => {
  const files = [
    { name: 'content.json', data: Buffer.from('{"a":"é"}') },
    { name: 'uploads/photo.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]) }
  ];
  const zip = createZip(files);
  assert.deepEqual(readZip(zip), files);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);

  // Même archive, mais le premier fichier compressé comme le font les outils du système.
  const text = Buffer.from('bonjour '.repeat(50));
  const packed = zlib.deflateRawSync(text);
  const deflated = createZip([{ name: 'a.txt', data: packed }]);
  deflated.writeUInt16LE(8, 8); // méthode, en-tête local
  deflated.writeUInt32LE(crc32(text), 14);
  deflated.writeUInt32LE(text.length, 22);
  const central = deflated.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  deflated.writeUInt16LE(8, central + 10);
  deflated.writeUInt32LE(crc32(text), central + 16);
  deflated.writeUInt32LE(text.length, central + 24);
  assert.deepEqual(readZip(deflated), [{ name: 'a.txt', data: text }]);
  assert.throws(() => readZip(deflated, { maxEntrySize: 100 }), ZipError);

  const broken = Buffer.from(zip);
  broken[44] ^= 0xff; // un octet du contenu change : le CRC ne correspond plus
  assert.throws(() => readZip(broken), ZipError);
  assert.throws(() => readZip(Buffer.from('pas une archive')), ZipError);
  assert.throws(() => readZip(Buffer.alloc(0)), ZipError);
});

test("carte d'aperçu : mots colorés, retour à la ligne, texte échappé", () => {
  assert.deepEqual(headlineWords('Je crée des *apps Android* ici'), [
    { text: 'Je', hl: false },
    { text: 'crée', hl: false },
    { text: 'des', hl: false },
    { text: 'apps', hl: true },
    { text: 'Android', hl: true },
    { text: 'ici', hl: false }
  ]);
  const font = ['Inter', 700];
  assert.ok(measure('MMMM', font, 32) > measure('iiii', font, 32));
  const long = headlineWords('un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze');
  const lines = wrap(long, font, 32, 300, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => measure(l.map((w) => w.text).join(' '), font, 32) <= 300));
  assert.match(lines[1].at(-1).text, /…$/);

  const svg = cardSvg({ name: 'Ada <script>', headline: 'a & b', kicker: '"x"', accent: '#4F3BF5', stats: [] });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /Ada &lt;script&gt;/);
  assert.match(svg, /a &amp; b/);
  // Sans photo : les initiales dans le rond.
  assert.match(svg, />AS<\/text>/);
  const png = renderCard({
    name: 'Ada Lovelace',
    accent: '#4F3BF5',
    stats: [{ value: '3', label: 'apps', bg: '#FFD84D', text: '#2B2200' }]
  });
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});
