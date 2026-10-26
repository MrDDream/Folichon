// Lecture / écriture du contenu de la page dans DATA_DIR/content.json.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.join(here, 'default-content.json');

// Retire des listes les éléments vides (null) : un seul suffirait à faire planter la
// page publique (import d'un fichier abîmé, modification à la main…).
function clean(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null).map(clean);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
  }
  return value;
}

function revisionOf(content) {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16);
}

export class ConflictError extends Error {}

export function createStore(dataDir) {
  const file = path.join(dataDir, 'content.json');
  const backup = path.join(dataDir, 'content.backup.json');
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(file)) {
    fs.copyFileSync(DEFAULT_FILE, file);
    console.log(`[contenu] Contenu par défaut créé dans ${file}`);
  }

  let cache = null;
  let cacheMtime = -1;
  let revision = '';

  function mtimeOf() {
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return 0;
    }
  }

  // Relit le fichier s'il a changé sur le disque (modifié à la main, restauré…).
  function read() {
    const mtime = mtimeOf();
    if (cache && mtime === cacheMtime) return cache;
    try {
      cache = clean(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (err) {
      console.error(`[contenu] ${file} illisible (${err.message}), contenu par défaut utilisé.`);
      cache = JSON.parse(fs.readFileSync(DEFAULT_FILE, 'utf8'));
    }
    if (!cache || typeof cache !== 'object' || Array.isArray(cache)) cache = {};
    cacheMtime = mtime;
    revision = revisionOf(cache);
    return cache;
  }

  // Empreinte du contenu actuel : l'admin la renvoie à l'enregistrement pour ne pas
  // écraser une version plus récente (autre onglet, fichier modifié entre-temps).
  function currentRevision() {
    read();
    return revision;
  }

  function write(content, expectedRevision) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new Error('Le contenu doit être un objet JSON.');
    }
    if (expectedRevision && expectedRevision !== currentRevision()) {
      throw new ConflictError('Le contenu a été modifié ailleurs depuis le chargement de cette page.');
    }
    const cleaned = clean(content);
    if (fs.existsSync(file)) fs.copyFileSync(file, backup);
    // Écriture dans un fichier temporaire puis renommage : jamais de fichier à moitié écrit.
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cleaned, null, 2));
    fs.renameSync(tmp, file);
    cache = cleaned;
    cacheMtime = mtimeOf();
    revision = revisionOf(cleaned);
    return revision;
  }

  return { read, write, revision: currentRevision };
}
