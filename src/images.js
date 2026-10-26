// Dimensions des images locales (PNG, JPEG, GIF, WebP, SVG), lues dans l'en-tête du fichier
// et gardées en cache : avec width/height dans le HTML, le navigateur réserve la place
// de l'image et la page ne « saute » pas pendant le chargement.
import fs from 'node:fs';
import path from 'node:path';

const HEAD_BYTES = 512 * 1024; // assez pour trouver la taille d'un JPEG même avec de grosses données EXIF
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function readSize(buf) {
  const ascii = (start, end) => buf.subarray(start, end).toString('latin1');
  const svg = /<svg\b[^>]*>/i.exec(ascii(0, Math.min(buf.length, 4096)));
  if (svg) {
    const attr = (name) => Number(new RegExp(`\\s${name}="([\\d.]+)(px)?"`, 'i').exec(svg[0])?.[1]);
    const box = /viewBox="[\d.\s-]+?\s([\d.]+)\s+([\d.]+)"/i.exec(svg[0]);
    const width = attr('width') || Number(box?.[1]);
    const height = attr('height') || Number(box?.[2]);
    return width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : null;
  }
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 10 && ascii(0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const chunk = ascii(12, 16);
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const [b0, b1, b2, b3] = buf.subarray(21, 25);
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
      };
    }
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    return null;
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (JPEG_SOF.has(marker)) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
        i += marker === 0xff ? 1 : 2;
        continue;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

// roots : { '/assets/': dossier public, '/uploads/': dossier des envois }
export function createImageSizer(roots) {
  const cache = new Map(); // fichier → { mtimeMs, size }

  return function imageSize(url) {
    if (typeof url !== 'string') return null;
    const prefix = Object.keys(roots).find((p) => url.startsWith(p));
    if (!prefix) return null;
    const root = path.resolve(roots[prefix]);
    let rel;
    try {
      rel = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
    } catch {
      return null;
    }
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep)) return null; // pas de sortie du dossier (../)
    try {
      const { mtimeMs } = fs.statSync(file);
      const hit = cache.get(file);
      if (hit && hit.mtimeMs === mtimeMs) return hit.size;
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(HEAD_BYTES);
      const read = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
      fs.closeSync(fd);
      const size = readSize(buf.subarray(0, read));
      cache.set(file, { mtimeMs, size });
      return size;
    } catch {
      return null;
    }
  };
}
