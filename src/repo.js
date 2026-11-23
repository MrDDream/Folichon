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
import { Resvg } from '@resvg/resvg-js';
import { techFor } from './helpers.js';
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

// Lit une adresse https (redirections suivies, chacune vérifiée de la même façon) et
// renvoie le corps de la réponse, sans dépasser maxBytes.
function getRaw(url, { allowPrivate = false, redirects = 3, maxBytes = MAX_BYTES, accept = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return reject(new RepoError('Adresse invalide.'));
    }
    if (target.protocol !== 'https:') return reject(new RepoError('Seuls les liens https sont acceptés.'));
    // Une adresse IP écrite telle quelle ne passe pas par la résolution DNS : vérifiée ici.
    const literal = target.hostname.replace(/^\[|\]$/g, '');
    if (!allowPrivate && net.isIP(literal) && isPrivateAddress(literal)) {
      return reject(new RepoError('Cette adresse mène au réseau local : import refusé.'));
    }
    const req = https.get(
      target,
      {
        headers: { Accept: accept, 'User-Agent': `Folichon/${VERSION}` },
        lookup: allowPrivate ? undefined : publicLookup,
        timeout: TIMEOUT_MS
      },
      (res) => {
        const { statusCode = 0, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          if (redirects <= 0) return reject(new RepoError('Trop de redirections.'));
          const next = new URL(headers.location, target);
          return getRaw(next.href, { allowPrivate, redirects: redirects - 1, maxBytes, accept }).then(resolve, reject);
        }
        if (statusCode !== 200) {
          res.resume();
          return reject(new HttpError(statusCode));
        }
        if (Number(headers['content-length']) > maxBytes) {
          res.resume();
          return reject(new RepoError('Fichier trop lourd.'));
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new RepoError('Fichier trop lourd.'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new RepoError('Le site du dépôt ne répond pas.')));
    req.on('error', reject);
  });
}

async function getJson(url, opts = {}) {
  const body = await getRaw(url, opts);
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new RepoError('Réponse illisible.');
  }
}

const getText = async (url, opts = {}) => (await getRaw(url, { ...opts, accept: 'text/plain, */*' })).toString('utf8');

// Image choisie dans l'admin parmi celles du dépôt : téléchargée par le serveur (15 Mo au
// plus) pour être servie depuis /uploads, comme une image envoyée à la main.
export async function downloadImage(url, { allowPrivate = false } = {}) {
  try {
    return await getRaw(String(url ?? ''), {
      allowPrivate,
      maxBytes: 15 * 1024 * 1024,
      accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5'
    });
  } catch (err) {
    if (err instanceof RepoError) throw err;
    if (err?.status === 429) throw new RepoError('Le site limite les requêtes : réessaie dans un instant.');
    if (err instanceof HttpError) throw new RepoError(`Image introuvable (${err.status}).`);
    throw new RepoError("Impossible de télécharger l'image.");
  }
}

// Un SVG (format de la plupart des logos) n'est pas accepté tel quel dans /uploads : il
// pourrait contenir du script. On le convertit en PNG ; les images qu'il appellerait
// (fichiers du serveur, adresses externes) sont retirées avant le rendu.
export function isSvg(data) {
  const head = data
    .subarray(0, 1024)
    .toString('utf8')
    .replace(/^\uFEFF/, '');
  return /^\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i.test(head);
}

export function svgToPng(data, size = 512) {
  if (data.length > 2 * 1024 * 1024) throw new RepoError('Ce SVG est trop lourd.');
  const svg = data
    .toString('utf8')
    .replace(/\s(?:xlink:)?href\s*=\s*(["'])(?!data:|#)[^"']*\1/gi, ' ')
    .replace(/@import[^;]*;?/gi, '');
  try {
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } });
    return resvg.render().asPng();
  } catch {
    throw new RepoError('Ce SVG est illisible.');
  }
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
  android: ['android', 'android-app', 'android-application', 'jetpack-compose', 'wear-os', 'f-droid', 'fdroid'],
  ios: ['ios', 'ios-app', 'iphone', 'ipad', 'swiftui'],
  windows: ['windows', 'win32', 'windows-app', 'winui', 'wpf'],
  linux: ['linux', 'linux-app', 'gtk', 'flatpak'],
  macos: ['macos', 'osx', 'mac', 'macos-app'],
  'raspberry-pi': ['raspberry-pi', 'raspberrypi', 'raspberry'],
  web: ['web', 'webapp', 'web-app', 'pwa', 'website', 'browser-extension', 'chrome-extension', 'firefox-addon']
};
const WEB_LANGUAGES = new Set(['Vue', 'Svelte', 'Astro']);
const PLATFORM_TECHS = new Set(['android', 'linux', 'raspberry-pi']);

export function guessPlatforms(topics = [], languages = {}) {
  const set = new Set(topics.map((t) => String(t).toLowerCase()));
  const found = Object.keys(PLATFORM_TOPICS).filter((id) => PLATFORM_TOPICS[id].some((t) => set.has(t)));
  const langs = languages && typeof languages === 'object' ? Object.keys(languages) : [];
  if (!found.includes('web') && langs.some((l) => WEB_LANGUAGES.has(l))) found.push('web');
  return found;
}

// Technologies : langages principaux, puis sujets du dépôt qui sont des technologies
// connues (avec un logo), sous leur nom habituel. Huit au plus.
export function guessStack(topics = [], languages = {}) {
  const names = [...topLanguages(languages)];
  if (languages && typeof languages === 'object' && 'Dockerfile' in languages) names.push('Docker');
  // Les sujets qui sont déjà des plateformes (android, linux…) n'y sont pas répétés.
  for (const topic of topics) {
    const tech = techFor(topic);
    if (tech && !PLATFORM_TECHS.has(tech.id)) names.push(topic);
  }
  const seen = new Set();
  const stack = [];
  for (const name of names) {
    const tech = techFor(name);
    const label = tech ? tech.name : name;
    const key = tech ? tech.id : label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    stack.push(label);
  }
  return stack.slice(0, 8);
}

// ---------- README : description et images ----------

// Texte brut d'un morceau de Markdown/HTML : liens gardés comme texte, images retirées.
function plain(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (all, n) => String.fromCodePoint(Number(n)))
    .replace(/(\*\*|__|`)/g, '')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?)]|$)/g, '$1$2')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Coupe un texte trop long à la fin d'une phrase.
function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max / 3 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

// Premier vrai paragraphe du README (pas un titre, des badges, un tableau ou du code),
// complété du suivant s'il est court. Différent de la description du dépôt.
export function readmeSummary(md, description = '') {
  if (typeof md !== 'string' || !md) return '';
  const body = md
    .replace(/\r\n?/g, '\n')
    .replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, '\n')
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<(table|pre|code|picture|details|svg)\b[\s\S]*?<\/\1>/gi, '\n');
  const known = plain(description).toLowerCase();
  const paragraphs = [];
  for (const block of body.split(/\n\s*\n/)) {
    const raw = block.trim();
    if (!raw || /^(#|\||[-*+] |\d+\. |={3,}|-{3,}|>\s*\[!)/.test(raw) || /^\s*[^\n]*\n(=+|-+)\s*$/.test(raw)) continue;
    const text = plain(raw);
    // Une ligne de liens (« Site · Installer · English ») n'est pas une description.
    const outsideLinks = plain(raw.replace(/\[[^\]]*\]\([^)]*\)/g, ' ').replace(/<a\b[\s\S]*?<\/a>/gi, ' '));
    if (outsideLinks.replace(/[^\p{L}]/gu, '').length < 20) continue;
    if (text.length < 40 || !/[a-zà-ÿ]{3,}.*\s.*[a-zà-ÿ]{3,}/i.test(text)) continue;
    if (text.toLowerCase() === known) continue;
    paragraphs.push(text);
    if (paragraphs.join(' ').length >= 160 || paragraphs.length === 2) break;
  }
  return clip(paragraphs.join('\n\n'), 600);
}

const BADGE_HOSTS =
  /(^|\.)(shields\.io|badgen\.net|badge\.fury\.io|codecov\.io|coveralls\.io|travis-ci\.(org|com)|circleci\.com|app\.codacy\.com|sonarcloud\.io|api\.netlify\.com|deepscan\.io|snyk\.io|bestpractices\.coreinfrastructure\.org|repobeats\.axiom\.co|star-history\.com|api\.star-history\.com|contrib\.rocks|ossinsight\.io|next\.ossinsight\.io|ko-fi\.com|buymeacoffee\.com|liberapay\.com|hosted\.weblate\.org|translate\.codeberg\.org|img\.buymeacoffee\.com|stars\.medv\.io|komarev\.com|visitor-badge\.laobi\.icu|github-readme-stats\.vercel\.app|f-droid\.org|play\.google\.com|developer\.apple\.com|tools\.applemediaservices\.com)$/i;

// Images du README, en adresses complètes. Les chemins relatifs sont résolus depuis le
// dossier du README brut ; les badges et les SVG (refusés à l'envoi) sont écartés.
export function readmeImages(md, { rawBase = '', siteBase = '' } = {}) {
  if (typeof md !== 'string') return [];
  const found = [];
  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g)) found.push(m[1]);
  for (const m of md.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) found.push(m[1]);
  for (const m of md.matchAll(/^\s*\[[^\]]+\]:\s*<?(\S+?\.(?:png|jpe?g|webp|gif|avif))>?/gim)) found.push(m[1]);
  const out = [];
  for (const src of found) {
    let url;
    try {
      if (src.startsWith('/') && !src.startsWith('//') && siteBase) url = new URL(siteBase + src);
      else url = new URL(src, rawBase || undefined);
    } catch {
      continue;
    }
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:') continue;
    // github.com/moi/projet/blob/main/x.png → le fichier lui-même.
    const blob = /^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/.exec(url.pathname);
    if (url.hostname === 'github.com' && blob) {
      url = new URL(`https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`);
    }
    const file = url.pathname.toLowerCase();
    if (BADGE_HOSTS.test(url.hostname) || /\.svg$/.test(file) || /\/badges?\b|badge\.(svg|png)$/.test(file)) continue;
    if (/[?&](style|logo|label)=/.test(url.search)) continue;
    const href = url.href;
    if (!out.includes(href)) out.push(href);
    if (out.length >= 24) break;
  }
  return out;
}

const dirOf = (url) => (url ? url.replace(/[^/]*$/, '') : '');
const fromBase64 = (value) => (typeof value === 'string' ? Buffer.from(value, 'base64').toString('utf8') : '');

// ---------- Sites de dépôts ----------

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v) => (Number.isFinite(v) ? v : null);
const strings = (v) => (Array.isArray(v) ? v.filter((t) => typeof t === 'string') : []);

function result({
  provider,
  name,
  description,
  url,
  homepage,
  topics,
  languages,
  stars,
  license,
  readme,
  extraImages,
  logos
}) {
  const langs = languages || {};
  const tags = strings(topics).slice(0, 30);
  const md = readme?.text || '';
  const images = readmeImages(md, { rawBase: readme?.rawBase, siteBase: readme?.siteBase });
  for (const img of extraImages || []) if (!images.includes(img)) images.push(img);
  const logo = repoLogos(images, logos);
  return {
    provider,
    name: str(name),
    description: str(description),
    readme: readmeSummary(md, str(description)),
    url: str(url),
    homepage: /^https?:\/\//i.test(str(homepage)) ? str(homepage) : '',
    topics: tags,
    languages: topLanguages(langs),
    stack: guessStack(tags, langs),
    platforms: guessPlatforms(tags, langs),
    stars: num(stars),
    license: str(license),
    images,
    logo: logo.best,
    logos: logo.all
  };
}

const LOGO_FILE = /(^|[/_.-])(logo|icon|favicon|brand|mark)[^/]*$/i;
const LOGO_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const SKIPPED_DIRS =
  /(^|\/)(node_modules|vendor|third[_-]?party|\.git|test|tests|__tests__|fixtures|examples?|\.github\/ISSUE_TEMPLATE)\//i;

// Fichiers du dépôt qui ressemblent à son logo, du plus probable au moins probable :
// « logo.* » avant « …logo… », puis les icônes (la plus grande d'abord), près de la racine.
export function logoFiles(paths) {
  const scored = [];
  for (const file of paths || []) {
    if (typeof file !== 'string' || !LOGO_EXT.test(file) || SKIPPED_DIRS.test(file)) continue;
    const name = file.split('/').pop().toLowerCase();
    const stem = name.replace(LOGO_EXT, '');
    let rank;
    if (stem === 'logo') rank = 0;
    else if (/logo/.test(stem)) rank = 1;
    else if (/^(app[-_]?)?(icon|icone)\b|^icon/.test(stem)) rank = 2;
    else if (/^(favicon|apple-touch-icon|android-chrome)/.test(stem)) rank = 3;
    else continue;
    if (/(dark|white|light|mono|inverse|banner|wordmark|text|full)/.test(stem)) rank += 0.5;
    const px = Math.max(0, ...[...stem.matchAll(/(\d{2,4})/g)].map((m) => Number(m[1])));
    if (px && px < 64) rank += 2;
    const depth = file.split('/').length - 1;
    scored.push({ file, score: rank * 100 + depth * 10 - Math.min(px, 1024) / 128 });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((s) => s.file);
}
const httpsUrl = (value, base) => {
  try {
    const url = new URL(str(value), base);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

// Logos possibles d'un dépôt, du plus probable au moins probable : une image du README
// nommée « logo »/« icon », l'avatar du projet, celui de l'organisation. L'avatar d'une
// personne est proposé sans être choisi d'office (c'est sa photo, pas le logo du projet).
export function repoLogos(images = [], { files = [], project = [], owner = [], person = [] } = {}) {
  const fromReadme = images.filter((src) => {
    try {
      return LOGO_FILE.test(new URL(src).pathname);
    } catch {
      return false;
    }
  });
  const strong = [...files, ...fromReadme, ...project, ...owner].filter(Boolean);
  const all = [...new Set([...strong, ...person.filter(Boolean)])].slice(0, 8);
  return { best: strong[0] || '', all };
}

const optional = (promise) => promise.catch(() => null);

async function fromGitHub([owner, repo], opts) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const [r, languages, readme, tree] = await Promise.all([
    getJson(base, opts),
    optional(getJson(`${base}/languages`, opts)),
    optional(getJson(`${base}/readme`, opts)),
    optional(getJson(`${base}/git/trees/HEAD?recursive=1`, { ...opts, maxBytes: 8 * MAX_BYTES }))
  ]);
  const fullName = str(r.full_name) || `${owner}/${repo}`;
  const files = logoFiles(Array.isArray(tree?.tree) ? tree.tree.map((f) => f.path) : []).map(
    (f) => `https://raw.githubusercontent.com/${fullName}/HEAD/${f.split('/').map(encodeURIComponent).join('/')}`
  );
  return result({
    provider: 'GitHub',
    name: r.name,
    description: r.description,
    url: r.html_url,
    homepage: r.homepage,
    topics: r.topics,
    languages,
    stars: r.stargazers_count,
    license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : '',
    readme: readme && {
      text: fromBase64(readme.content),
      rawBase: dirOf(str(readme.download_url)),
      siteBase: `https://github.com/${fullName}/raw/HEAD`
    },
    // Carte d'aperçu que GitHub dessine pour chaque dépôt (ou l'image choisie par l'auteur).
    extraImages: [`https://opengraph.githubassets.com/1/${fullName}`],
    logos: {
      files,
      [r.owner?.type === 'Organization' ? 'owner' : 'person']: [httpsUrl(r.owner?.avatar_url)]
    }
  });
}

async function fromGitLab(host, parts, opts) {
  const base = `https://${host}/api/v4/projects/${encodeURIComponent(parts.join('/'))}`;
  const [r, languages, tree] = await Promise.all([
    getJson(`${base}?license=true`, opts),
    optional(getJson(`${base}/languages`, opts)),
    optional(getJson(`${base}/repository/tree?recursive=true&per_page=100`, opts))
  ]);
  if (!r || typeof r !== 'object' || !('path_with_namespace' in r)) throw new HttpError(404);
  const readmeUrl = str(r.readme_url).replace('/-/blob/', '/-/raw/');
  const text = readmeUrl.startsWith(`https://${host}/`) ? await optional(getText(readmeUrl, opts)) : null;
  return result({
    provider: 'GitLab',
    name: r.name,
    description: r.description,
    url: r.web_url,
    homepage: '',
    topics: r.topics || r.tag_list,
    languages,
    stars: r.star_count,
    license: r.license?.nickname || r.license?.name || '',
    // Dans un README GitLab, « /uploads/… » désigne les fichiers joints au projet.
    readme: text && { text, rawBase: dirOf(readmeUrl), siteBase: str(r.web_url) },
    extraImages: /^https:\/\//.test(str(r.avatar_url)) ? [str(r.avatar_url)] : [],
    logos: {
      files: logoFiles(Array.isArray(tree) ? tree.filter((f) => f?.type === 'blob').map((f) => f.path) : []).map(
        (f) => `${str(r.web_url)}/-/raw/HEAD/${f.split('/').map(encodeURIComponent).join('/')}`
      ),
      project: [httpsUrl(r.avatar_url, `https://${host}`)],
      [r.namespace?.kind === 'group' ? 'owner' : 'person']: [httpsUrl(r.namespace?.avatar_url, `https://${host}`)]
    }
  });
}

async function fromGitea(host, [owner, repo], opts) {
  const base = `https://${host}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const [r, languages, topics, readme] = await Promise.all([
    getJson(base, opts),
    optional(getJson(`${base}/languages`, opts)),
    optional(getJson(`${base}/topics`, opts)),
    optional(getJson(`${base}/contents/README.md`, opts))
  ]);
  if (!r || typeof r !== 'object' || !('full_name' in r)) throw new HttpError(404);
  const branch = encodeURIComponent(str(r.default_branch) || 'main');
  const tree = await optional(getJson(`${base}/git/trees/${branch}?recursive=true&per_page=10000`, opts));
  const files = logoFiles(Array.isArray(tree?.tree) ? tree.tree.map((f) => f.path) : []).map(
    (f) => `${str(r.html_url)}/raw/branch/${branch}/${f.split('/').map(encodeURIComponent).join('/')}`
  );
  return result({
    provider: host === 'codeberg.org' ? 'Codeberg' : 'Gitea',
    name: r.name,
    description: r.description,
    url: r.html_url,
    homepage: r.website,
    topics: topics?.topics || r.topics,
    languages,
    stars: r.stars_count,
    license: strings(r.licenses)[0] || '',
    readme: readme && { text: fromBase64(readme.content), rawBase: dirOf(str(readme.download_url)) },
    extraImages: /^https:\/\//.test(str(r.avatar_url)) ? [str(r.avatar_url)] : [],
    // Gitea ne dit pas si le propriétaire est une organisation : son avatar reste une proposition.
    logos: { files, project: [httpsUrl(r.avatar_url)], person: [httpsUrl(r.owner?.avatar_url)] }
  });
}

async function fromBitbucket([owner, repo], opts) {
  const path = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const r = await getJson(`https://api.bitbucket.org/2.0/repositories/${path}`, opts);
  const rawBase = `https://bitbucket.org/${path}/raw/HEAD/`;
  const text = await optional(getText(`${rawBase}README.md`, opts));
  return result({
    provider: 'Bitbucket',
    name: r.name,
    description: r.description,
    url: r.links?.html?.href,
    homepage: r.website,
    topics: [],
    languages: r.language ? { [r.language.replace(/^./, (c) => c.toUpperCase())]: 1 } : {},
    stars: null,
    license: '',
    readme: text && { text, rawBase }
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
