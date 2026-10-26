// Version de Folichon et vérification des nouvelles versions publiées sur GitHub.
// Désactivable avec UPDATE_CHECK=false. La réponse de GitHub est gardée en mémoire
// (12 h, ou 1 h si GitHub n'a pas répondu) pour ne pas l'interroger à chaque visite.
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const VERSION = pkg.version;

const REPO = 'MrDDream/Folichon';
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const TTL_MS = 12 * 60 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000;
let cache = null; // { at, ttl, info }

// « 1.10.0 » est plus récent que « 1.9.2 » : on compare nombre par nombre.
export function isNewer(candidate, current) {
  const parse = (v) =>
    String(v)
      .replace(/^v/i, '')
      .split(/[.-]/)
      .slice(0, 3)
      .map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parse(candidate), parse(current)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

// Lien affiché dans l'admin : seulement une page de ce dépôt sur GitHub, sinon la liste des versions.
export function releaseUrl(value) {
  return typeof value === 'string' && value.startsWith(`https://github.com/${REPO}/`) ? value : RELEASES_URL;
}

export async function updateInfo({ enabled = true } = {}) {
  const base = { version: VERSION, latest: null, upToDate: null, url: RELEASES_URL };
  if (!enabled) return base;
  if (cache && Date.now() - cache.at < cache.ttl) return { ...base, ...cache.info };
  let info = {};
  let ttl = RETRY_MS;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Folichon/${VERSION}` },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const release = await res.json();
      const latest = String(release.tag_name || '').replace(/^v/i, '');
      if (latest) {
        info = { latest, upToDate: !isNewer(latest, VERSION), url: releaseUrl(release.html_url) };
        ttl = TTL_MS;
      }
    }
  } catch {
    /* hors ligne ou GitHub indisponible : version affichée sans comparaison */
  }
  cache = { at: Date.now(), ttl, info };
  return { ...base, ...info };
}
