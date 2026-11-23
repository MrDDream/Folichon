// Import d'un dépôt de code (GitHub, GitLab, Codeberg, Gitea, Forgejo, Bitbucket) pour
// pré-remplir un grand projet dans l'admin. Seules les API publiques sont lues, sans jeton.
//
// Le serveur va chercher une adresse donnée dans l'admin : pour qu'elle ne serve pas à
// sonder le réseau local (box, NAS, autres conteneurs…), seules les adresses https sont
// suivies, et les noms qui pointent vers une adresse privée sont refusés au moment même de
// la connexion. REPO_IMPORT_ALLOW_PRIVATE=true lève ce verrou (GitLab ou Gitea sur le réseau local).
import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';
import { VERSION } from './version.js';

export class RepoError extends Error {}

const TIMEOUT_MS = 8000;
const MAX_BYTES = 1024 * 1024;

const privateRanges = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3]
]) {
  privateRanges.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
]) {
  privateRanges.addSubnet(address, prefix, 'ipv6');
}

export function isPrivateAddress(address) {
  if (net.isIPv6(address)) {
    // ::ffff:10.0.0.1 → adresse IPv4 déguisée en IPv6.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return privateRanges.check(mapped[1], 'ipv4');
    return privateRanges.check(address, 'ipv6');
  }
  return net.isIPv4(address) ? privateRanges.check(address, 'ipv4') : true;
}

// Résolution DNS qui refuse les adresses privées : vérifiée à la connexion elle-même,
// donc un nom qui change d'adresse entre deux requêtes ne passe pas non plus.
function publicLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const allowed = addresses.filter((a) => !isPrivateAddress(a.address));
    if (!allowed.length) {
      return callback(new RepoError('Cette adresse mène au réseau local : import refusé.'));
    }
    if (options.all) return callback(null, allowed);
    callback(null, allowed[0].address, allowed[0].family);
  });
}

class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function getJson(url, { allowPrivate = false, redirects = 2 } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== 'https:') return reject(new RepoError('Seuls les liens https sont acceptés.'));
    // Une adresse IP écrite telle quelle ne passe pas par la résolution DNS : vérifiée ici.
    const literal = target.hostname.replace(/^\[|\]$/g, '');
    if (!allowPrivate && net.isIP(literal) && isPrivateAddress(literal)) {
      return reject(new RepoError('Cette adresse mène au réseau local : import refusé.'));
    }
    const req = https.get(
      target,
      {
        headers: { Accept: 'application/json', 'User-Agent': `Folichon/${VERSION}` },
        lookup: allowPrivate ? undefined : publicLookup,
        timeout: TIMEOUT_MS
      },
      (res) => {
        const { statusCode = 0, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          if (redirects <= 0) return reject(new RepoError('Trop de redirections.'));
          const next = new URL(headers.location, target);
          return getJson(next.href, { allowPrivate, redirects: redirects - 1 }).then(resolve, reject);
        }
        if (statusCode !== 200) {
          res.resume();
          return reject(new HttpError(statusCode));
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(new RepoError('Réponse trop grande.'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new RepoError('Réponse illisible.'));
          }
        });
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new RepoError('Le site du dépôt ne répond pas.')));
    req.on('error', reject);
  });
}

// « https://github.com/moi/projet/tree/main » → { host: 'github.com', path: ['moi', 'projet'] }.
// Les adresses sans protocole (github.com/moi/projet) et celles en .git sont acceptées.
export function parseRepoUrl(value) {
  let v = String(value ?? '').trim();
  if (!v) throw new RepoError('Colle le lien du dépôt.');
  // git@github.com:moi/projet.git
  const ssh = /^git@([^:/\s]+):(.+)$/.exec(v);
  if (ssh) v = `https://${ssh[1]}/${ssh[2]}`;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`;
  let url;
  try {
    url = new URL(v);
  } catch {
    throw new RepoError('Ce lien ne ressemble pas à une adresse de dépôt.');
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new RepoError('Seuls les liens https sont acceptés.');
  const host = url.host.toLowerCase();
  let parts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));
  // GitLab met les pages d'un projet après « /-/ » (…/projet/-/tree/main).
  const dash = parts.indexOf('-');
  if (dash >= 0) parts = parts.slice(0, dash);
  if (parts.length) parts[parts.length - 1] = parts[parts.length - 1].replace(/\.git$/i, '');
  const twoParts = ['github.com', 'www.github.com', 'codeberg.org', 'bitbucket.org', 'gitea.com'].includes(host);
  // Les autres sites gardent tout le chemin (sous-groupes GitLab), sauf les pages
  // propres à Gitea/Forgejo qui suivent le nom du dépôt (src, releases, issues…).
  if (twoParts) parts = parts.slice(0, 2);
  else {
    const giteaPage = parts.findIndex(
      (p, i) => i >= 2 && ['src', 'releases', 'issues', 'pulls', 'wiki', 'tree', 'blob', 'commits'].includes(p)
    );
    if (giteaPage >= 0) parts = parts.slice(0, giteaPage);
  }
  if (parts.length < 2 || parts.some((p) => !/^[\w.-]+$/.test(p))) {
    throw new RepoError('Ce lien ne ressemble pas à une adresse de dépôt (site/propriétaire/projet).');
  }
  return { host, path: parts };
}

// Langages triés du plus utilisé au moins utilisé, sans ceux qui ne disent rien du projet.
const NOISE_LANGUAGES = new Set([
  'Dockerfile',
  'Makefile',
  'Batchfile',
  'Procfile',
  'CMake',
  'Roff',
  'Nix',
  'go-html-template'
]);
function topLanguages(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
  const entries = Object.entries(map).filter(([, v]) => typeof v === 'number' && v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  return entries
    .sort((a, b) => b[1] - a[1])
    .filter(([name, v]) => !NOISE_LANGUAGES.has(name) && v / total >= 0.03)
    .slice(0, 5)
    .map(([name]) => name);
}

// Plateformes devinées d'après les sujets (topics) du dépôt et ses langages.
const PLATFORM_TOPICS = {
  android: ['android', 'android-app', 'android-application', 'jetpack-compose', 'wear-os'],
  ios: ['ios', 'ios-app', 'iphone', 'ipad', 'swiftui'],
  macos: ['macos', 'osx', 'mac', 'macos-app'],
  windows: ['windows', 'win32', 'windows-app', 'winui', 'wpf'],
  linux: ['linux', 'linux-app', 'gtk', 'flatpak'],
  web: ['web', 'webapp', 'web-app', 'pwa', 'website'],
  docker: ['docker', 'docker-compose', 'docker-image', 'dockerfile', 'container'],
  kubernetes: ['kubernetes', 'k8s', 'helm', 'helm-chart'],
  'raspberry-pi': ['raspberry-pi', 'raspberrypi', 'raspberry'],
  'home-assistant': ['home-assistant', 'homeassistant', 'hacs', 'hacs-integration'],
  esphome: ['esphome'],
  arduino: ['arduino', 'esp32', 'esp8266'],
  chrome: ['chrome-extension', 'chrome', 'chromium-extension'],
  firefox: ['firefox-extension', 'firefox-addon', 'firefox'],
  edge: ['edge-extension'],
  safari: ['safari-extension'],
  'google-play': ['google-play'],
  'app-store': ['app-store', 'appstore'],
  'f-droid': ['f-droid', 'fdroid'],
  steam: ['steam'],
  'steam-deck': ['steam-deck', 'steamdeck'],
  playstation: ['playstation', 'ps4', 'ps5'],
  xbox: ['xbox'],
  switch: ['nintendo-switch', 'switch-homebrew'],
  proxmox: ['proxmox', 'proxmox-ve'],
  unraid: ['unraid'],
  truenas: ['truenas'],
  ubuntu: ['ubuntu'],
  debian: ['debian'],
  arch: ['archlinux', 'arch-linux', 'aur'],
  fedora: ['fedora'],
  freebsd: ['freebsd'],
  nixos: ['nixos', 'nix-flake']
};

export function guessPlatforms(topics = [], languages = {}) {
  const set = new Set(topics.map((t) => String(t).toLowerCase()));
  const found = Object.keys(PLATFORM_TOPICS).filter((id) => PLATFORM_TOPICS[id].some((t) => set.has(t)));
  if (languages && typeof languages === 'object' && 'Dockerfile' in languages && !found.includes('docker')) {
    found.push('docker');
  }
  return found;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v) => (Number.isFinite(v) ? v : null);
const strings = (v) => (Array.isArray(v) ? v.filter((t) => typeof t === 'string') : []);

function result({ provider, name, description, url, homepage, topics, languages, stars, license }) {
  const langs = languages || {};
  return {
    provider,
    name: str(name),
    description: str(description),
    url: str(url),
    homepage: /^https?:\/\//i.test(str(homepage)) ? str(homepage) : '',
    topics: strings(topics).slice(0, 20),
    languages: topLanguages(langs),
    platforms: guessPlatforms(strings(topics), langs),
    stars: num(stars),
    license: str(license)
  };
}

const optional = (promise) => promise.catch(() => null);

async function fromGitHub([owner, repo], opts) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const [r, languages] = await Promise.all([getJson(base, opts), optional(getJson(`${base}/languages`, opts))]);
  return result({
    provider: 'GitHub',
    name: r.name,
    description: r.description,
    url: r.html_url,
    homepage: r.homepage,
    topics: r.topics,
    languages,
    stars: r.stargazers_count,
    license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : ''
  });
}

async function fromGitLab(host, parts, opts) {
  const base = `https://${host}/api/v4/projects/${encodeURIComponent(parts.join('/'))}`;
  const [r, languages] = await Promise.all([
    getJson(`${base}?license=true`, opts),
    optional(getJson(`${base}/languages`, opts))
  ]);
  if (!r || typeof r !== 'object' || !('path_with_namespace' in r)) throw new HttpError(404);
  return result({
    provider: 'GitLab',
    name: r.name,
    description: r.description,
    url: r.web_url,
    homepage: '',
    topics: r.topics || r.tag_list,
    languages,
    stars: r.star_count,
    license: r.license?.nickname || r.license?.name || ''
  });
}

async function fromGitea(host, [owner, repo], opts) {
  const base = `https://${host}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const [r, languages, topics] = await Promise.all([
    getJson(base, opts),
    optional(getJson(`${base}/languages`, opts)),
    optional(getJson(`${base}/topics`, opts))
  ]);
  if (!r || typeof r !== 'object' || !('full_name' in r)) throw new HttpError(404);
  return result({
    provider: host === 'codeberg.org' ? 'Codeberg' : 'Gitea',
    name: r.name,
    description: r.description,
    url: r.html_url,
    homepage: r.website,
    topics: topics?.topics || r.topics,
    languages,
    stars: r.stars_count,
    license: strings(r.licenses)[0] || ''
  });
}

async function fromBitbucket([owner, repo], opts) {
  const r = await getJson(
    `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    opts
  );
  return result({
    provider: 'Bitbucket',
    name: r.name,
    description: r.description,
    url: r.links?.html?.href,
    homepage: r.website,
    topics: [],
    languages: r.language ? { [r.language.replace(/^./, (c) => c.toUpperCase())]: 1 } : {},
    stars: null,
    license: ''
  });
}

// Lit les informations publiques d'un dépôt. Pour un site inconnu (GitLab ou Gitea
// installé chez soi), on essaie l'API de GitLab puis celle de Gitea/Forgejo.
export async function fetchRepo(value, { allowPrivate = false } = {}) {
  const { host, path } = parseRepoUrl(value);
  const opts = { allowPrivate };
  try {
    if (host === 'github.com' || host === 'www.github.com') return await fromGitHub(path, opts);
    if (host === 'bitbucket.org') return await fromBitbucket(path, opts);
    if (host === 'gitlab.com') return await fromGitLab(host, path, opts);
    if (host === 'codeberg.org' || host === 'gitea.com') return await fromGitea(host, path, opts);
    try {
      return await fromGitLab(host, path, opts);
    } catch (err) {
      // Seule une réponse « pas ici » fait essayer l'autre API ; un site injoignable, non.
      if (!(err instanceof HttpError) || path.length !== 2) throw err;
      return await fromGitea(host, path, opts);
    }
  } catch (err) {
    if (err instanceof RepoError) throw err;
    if (err instanceof HttpError) {
      if (err.status === 404) throw new RepoError('Dépôt introuvable (il est peut-être privé).');
      if (err.status === 403 || err.status === 429) {
        throw new RepoError('Le site du dépôt limite les requêtes : réessaie dans quelques minutes.');
      }
      throw new RepoError(`Le site du dépôt a répondu par une erreur (${err.status}).`);
    }
    if (err?.code === 'ENOTFOUND' || err?.code === 'EAI_AGAIN') throw new RepoError('Site du dépôt introuvable.');
    throw new RepoError('Impossible de joindre le site du dépôt.');
  }
}
