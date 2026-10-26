import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as h from '../src/helpers.js';
import { createAuth } from '../src/auth.js';
import { createImageSizer } from '../src/images.js';
import { createStore } from '../src/store.js';
import { isNewer } from '../src/version.js';

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
