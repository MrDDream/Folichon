// Image d'aperçu pour les partages (WhatsApp, LinkedIn, Discord…) : un cadre comme le haut
// de la page, avec l'accroche, le nom, la phrase d'accroche, la photo et les chiffres clés.
// Dessinée en SVG puis convertie en PNG par resvg : ces sites n'affichent pas le SVG.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'share-card');
// Versions fixes (non variables) des polices du site : resvg ne lit ni le WOFF2 ni
// les axes variables. widths.json : chasse de chaque caractère, en fraction de la taille.
const FONT_FILES = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.ttf'))
  .map((f) => path.join(dir, f));
const WIDTHS = JSON.parse(fs.readFileSync(path.join(dir, 'widths.json'), 'utf8'));

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const COLORS = { page: '#F1F0F5', surface: '#FFFFFF', ink: '#15131F', body: '#4A4659', muted: '#5E5A6E' };
const FONTS = {
  display: ['Bricolage Grotesque', 800],
  text: ['Inter', 400],
  medium: ['Inter', 500],
  bold: ['Inter', 700],
  mono: ['JetBrains Mono', 400]
};

const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Largeur d'un texte en pixels, d'après la chasse des glyphes (caractère inconnu : largeur moyenne).
export function measure(text, font, size, spacing = 0) {
  const table = WIDTHS[`${font[0]} ${font[1]}`];
  let em = 0;
  for (const ch of text) em += table[ch] ?? 0.6;
  return em * size + spacing * size * Math.max(0, [...text].length - 1);
}

// Découpe en lignes d'au plus maxWidth pixels ; « … » si le texte dépasse maxLines.
// words : [{ text, hl }] pour garder les mots colorés de la phrase d'accroche.
export function wrap(words, font, size, maxWidth, maxLines) {
  const lines = [];
  let line = [];
  const width = (ws) => measure(ws.map((w) => w.text).join(' '), font, size);
  for (const word of words) {
    if (line.length && width([...line, word]) > maxWidth) {
      lines.push(line);
      line = [];
    }
    line.push(word);
  }
  if (line.length) lines.push(line);
  if (lines.length > maxLines) {
    const last = lines[maxLines - 1];
    while (last.length > 1 && width([...last, { text: '…' }]) > maxWidth) last.pop();
    last[last.length - 1] = { ...last[last.length - 1], text: `${last[last.length - 1].text}…` };
    lines.length = maxLines;
  }
  return lines;
}

const words = (text, hl = false) =>
  String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ text: w, hl }));

// « Je crée des *apps Android* » → mots, ceux entre astérisques à la couleur d'accent.
export function headlineWords(text) {
  return String(text || '')
    .split(/\*([^*]+)\*/)
    .flatMap((part, i) => words(part, i % 2 === 1));
}

function textLine(line, x, y, font, size, fill, accent, extra = '') {
  // Un <tspan> par suite de mots de même couleur ; l'espace qui les sépare reste à la fin
  // du précédent, sinon resvg le place mal.
  const groups = [];
  for (const w of line) {
    const last = groups[groups.length - 1];
    if (last && last.hl === w.hl) last.words.push(w.text);
    else groups.push({ hl: w.hl, words: [w.text] });
  }
  const spans = groups
    .map(
      (g, i) =>
        `<tspan${g.hl ? ` fill="${accent}"` : ''}>${xml(g.words.join(' '))}${i < groups.length - 1 ? ' ' : ''}</tspan>`
    )
    .join('');
  return `<text x="${x}" y="${y}" font-family="${font[0]}" font-weight="${font[1]}" font-size="${size}" fill="${fill}" xml:space="preserve"${extra}>${spans}</text>`;
}

// Photo : PNG ou JPEG local, lu en data URI (resvg ne charge rien lui-même).
// Autres formats (WebP, AVIF…) ou adresse externe : les initiales à la place.
export function photoData(file) {
  if (!file) return '';
  try {
    const buf = fs.readFileSync(file);
    if (buf.length > 8 * 1024 * 1024) return '';
    if (buf.readUInt32BE(0) === 0x89504e47) return `data:image/png;base64,${buf.toString('base64')}`;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    /* fichier absent ou illisible */
  }
  return '';
}

// Première lettre (ou chiffre) des deux premiers mots qui en ont une.
const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

// data : { kicker, name, headline, accent, photo (data URI), host, stats: [{ value, label, bg, text }] }
export function cardSvg(data) {
  const accent = data.accent;
  const stats = (data.stats || []).filter((s) => s.value || s.label).slice(0, 3);
  const margin = 32;
  const gap = 16;
  const statsHeight = stats.length ? 126 : 0;
  const card = { x: margin, y: margin, w: CARD_WIDTH - 2 * margin };
  card.h = CARD_HEIGHT - 2 * margin - (stats.length ? statsHeight + gap : 0);
  const pad = 56;
  const photoSize = Math.min(300, card.h - 2 * 48);
  const cx = card.x + card.w - pad - photoSize / 2;
  const cy = card.y + card.h / 2;
  const textX = card.x + pad;
  const textWidth = cx - photoSize / 2 - 48 - textX;
  const out = [];

  out.push(
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${COLORS.page}"/>`,
    `<rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="32" fill="${COLORS.surface}"/>`
  );

  // Texte : de haut en bas, puis centré verticalement dans le cadre.
  const blocks = [];
  let y = 0;
  if (data.kicker) {
    const size = 22;
    const [line] = wrap(words(data.kicker), FONTS.mono, size, textWidth, 1);
    y += size;
    const at = y;
    blocks.push((dy) => textLine(line, textX, dy + at, FONTS.mono, size, COLORS.muted, accent));
    y += 22;
  }
  if (data.name) {
    const spacing = -0.045;
    const full = measure(data.name, FONTS.display, 1, spacing);
    const size = Math.max(48, Math.min(96, Math.floor(textWidth / full)));
    const lines = wrap(words(data.name), FONTS.display, size, textWidth, 2);
    for (const line of lines) {
      y += size * 0.92;
      const at = y;
      blocks.push((dy) =>
        textLine(line, textX, dy + at, FONTS.display, size, COLORS.ink, accent, ` letter-spacing="${spacing * size}"`)
      );
    }
    y += 30;
  }
  if (data.headline) {
    const size = 32;
    const lines = wrap(headlineWords(data.headline), FONTS.bold, size, textWidth, data.name ? 3 : 4);
    for (const line of lines) {
      y += size * 1.2;
      const at = y - size * 0.2;
      blocks.push((dy) =>
        textLine(line, textX, dy + at, FONTS.bold, size, COLORS.ink, accent, ` letter-spacing="${-0.015 * size}"`)
      );
    }
  }
  // L'adresse du site en bas du cadre, seulement s'il reste de la place sous le texte.
  const hostY = card.y + card.h - pad + 6;
  const withHost = data.host && card.y + pad + y + 64 <= hostY;
  const room = card.h - 2 * pad - (withHost ? 40 : 0);
  const top = card.y + pad + Math.max(0, (room - y) / 2);
  for (const block of blocks) out.push(block(top));
  if (withHost) {
    out.push(textLine(words(data.host), textX, hostY, FONTS.mono, 20, COLORS.muted, accent));
  }

  // Photo dans un anneau dégradé, avec un halo de la couleur d'accent, comme sur la page.
  const r = photoSize / 2;
  const ring = 8;
  const inner = r - ring - 8;
  out.push(
    `<defs>
      <linearGradient id="ring" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="${accent}"/><stop offset=".3" stop-color="#FF8FB1"/>
        <stop offset=".55" stop-color="#FFD84D"/><stop offset=".8" stop-color="#5BE49B"/><stop offset="1" stop-color="${accent}"/>
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26"/></filter>
      <clipPath id="photo"><circle cx="${cx}" cy="${cy}" r="${inner}"/></clipPath>
    </defs>`,
    `<circle cx="${cx}" cy="${cy + 26}" r="${r - 24}" fill="${accent}" opacity=".45" filter="url(#glow)"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ring)"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r - ring}" fill="${COLORS.surface}"/>`
  );
  if (data.photo) {
    out.push(
      `<image href="${data.photo}" x="${cx - inner}" y="${cy - inner}" width="${2 * inner}" height="${2 * inner}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/>`
    );
  } else {
    const letters = initials(data.name) || '★';
    const size = Math.round(inner * 0.8);
    out.push(
      `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="${accent}"/>`,
      `<text x="${cx}" y="${cy + size * 0.36}" text-anchor="middle" font-family="${FONTS.display[0]}" font-weight="800" font-size="${size}" fill="#FFFFFF">${xml(letters)}</text>`
    );
  }

  // Chiffres clés : des blocs colorés sous le cadre.
  if (stats.length) {
    const w = (card.w - gap * (stats.length - 1)) / stats.length;
    const sy = card.y + card.h + gap;
    stats.forEach((s, i) => {
      const sx = card.x + i * (w + gap);
      const valueSize = 60;
      const value = String(s.value || '').slice(0, 8);
      const valueWidth = measure(value, FONTS.display, valueSize, -0.04);
      out.push(
        `<rect x="${sx}" y="${sy}" width="${w}" height="${statsHeight}" rx="28" fill="${s.bg}"/>`,
        `<text x="${sx + 28}" y="${sy + statsHeight / 2 + valueSize * 0.34}" font-family="${FONTS.display[0]}" font-weight="800" font-size="${valueSize}" letter-spacing="${-0.04 * valueSize}" fill="${s.text}">${xml(value)}</text>`
      );
      const labelX = sx + 28 + (value ? valueWidth + 18 : 0);
      const lines = wrap(words(s.label || ''), FONTS.medium, 22, sx + w - 24 - labelX, 2);
      const first = sy + statsHeight / 2 - ((lines.length - 1) * 28) / 2 + 8;
      lines.forEach((line, j) => out.push(textLine(line, labelX, first + j * 28, FONTS.medium, 22, s.text, s.text)));
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">${out.join('')}</svg>`;
}

export function renderCard(data) {
  const resvg = new Resvg(cardSvg(data), {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Inter' },
    fitTo: { mode: 'width', value: CARD_WIDTH }
  });
  return resvg.render().asPng();
}
