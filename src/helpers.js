// Petites fonctions utilisées par les gabarits EJS : nettoyage des liens,
// des couleurs, mise en valeur du titre et icônes SVG.

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function color(value, fallback = '') {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : fallback;
}

// Thèmes de la page publique, choisis dans l'administration. Le premier est celui par défaut ;
// les styles de chacun sont à la fin de public/css/site.css.
export const siteThemes = ['folichon', 'editorial', 'terminal', 'minimal', 'pop'];

export function siteTheme(value) {
  return siteThemes.includes(value) ? value : siteThemes[0];
}

// N'autorise que les liens sûrs : http(s), mailto, tel, ancres et chemins locaux.
export function safeUrl(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v) return '';
  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(v)) return v;
  // Chemin local, mais pas « //site » ni « /\site » que les navigateurs lisent comme un autre site.
  if (v.startsWith('/') && !/^\/[/\\]/.test(v)) return v;
  return '';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// « Je fabrique des *apps Android* » → le texte entre astérisques prend la couleur d'accent.
export function highlight(value) {
  return escapeHtml(value).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>');
}

export function list(value) {
  return Array.isArray(value) ? value : [];
}

// Adresse e-mail illisible pour les robots qui aspirent les pages : inversée puis
// encodée en base64. public/js/site.js fait l'opération inverse au clic.
export function hideEmail(value) {
  return Buffer.from([...text(value)].reverse().join(''), 'utf8').toString('base64');
}

// Texte saisi ligne par ligne → liste de lignes, sans les tirets ou puces tapés au début.
export function bulletLines(value) {
  return text(value)
    .split('\n')
    .map((l) => l.replace(/^\s*[-–•*]\s*/, '').trim())
    .filter(Boolean);
}

// Liens du menu Partager (WhatsApp, Telegram, SMS, e-mail, réseaux), calculés côté
// serveur pour fonctionner même sans JavaScript.
export function shareLinks(url, title, description) {
  const enc = encodeURIComponent;
  return {
    whatsapp: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
    sms: `sms:?&body=${enc(`${title} ${url}`)}`,
    email: `mailto:?subject=${enc(title)}&body=${enc(`${description}\n\n${url}`.trim())}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    x: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`
  };
}

// Textes fixes de la page publique, selon la langue du site (réglée dans l'admin).
// Les variables s'écrivent {name} et se remplacent avec fill().
const SITE_TEXT = {
  fr: {
    home: 'Accueil',
    projects: 'Projets',
    timeline: 'Parcours',
    skills: 'Compétences',
    contact: 'Contact',
    seeProjects: 'Voir mes projets',
    downloadCv: 'Télécharger mon CV',
    findMe: 'Me retrouver',
    languages: 'Langues',
    emailButton: 'E-mail ↗',
    viewCode: 'Voir le code ↗',
    projectSite: 'Site du projet ↗',
    projectN: 'Projet {n}',
    photoOf: 'Photo de {name}',
    screenshot: '{name} : capture d’écran',
    screenshots: '{name} : captures d’écran',
    screen: '{name} : écran {n}',
    sectionsMenu: 'Menu des sections',
    pageOutline: 'Plan de la page',
    intro: 'Présentation',
    socials: 'Réseaux',
    share: 'Partager',
    sharePage: 'Partager la page',
    close: 'Fermer',
    copyLink: 'Copier le lien',
    linkCopied: 'Lien copié ✓',
    copyPrompt: 'Copie ce lien :',
    changeTheme: 'Changer de thème',
    toDark: 'Passer en mode sombre',
    toLight: 'Passer en mode clair'
  },
  en: {
    home: 'Home',
    projects: 'Projects',
    timeline: 'Experience',
    skills: 'Skills',
    contact: 'Contact',
    seeProjects: 'See my projects',
    downloadCv: 'Download my CV',
    findMe: 'Find me on',
    languages: 'Languages',
    emailButton: 'E-mail ↗',
    viewCode: 'View code ↗',
    projectSite: 'Project site ↗',
    projectN: 'Project {n}',
    photoOf: 'Photo of {name}',
    screenshot: '{name}: screenshot',
    screenshots: '{name}: screenshots',
    screen: '{name}: screen {n}',
    sectionsMenu: 'Sections',
    pageOutline: 'Page outline',
    intro: 'Introduction',
    socials: 'Social links',
    share: 'Share',
    sharePage: 'Share this page',
    close: 'Close',
    copyLink: 'Copy link',
    linkCopied: 'Link copied ✓',
    copyPrompt: 'Copy this link:',
    changeTheme: 'Change theme',
    toDark: 'Switch to dark mode',
    toLight: 'Switch to light mode'
  }
};

export function siteText(lang) {
  return text(lang).toLowerCase().startsWith('en') ? SITE_TEXT.en : SITE_TEXT.fr;
}

export function fill(template, vars) {
  return text(template).replace(/\{(\w+)\}/g, (all, name) => (name in vars ? text(vars[name]) : all));
}

// « Mon Projet ! » → « mon-projet », pour les ancres de la page.
export function slug(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function text(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

const brand = {
  github: {
    color: '#15131F',
    svg: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3"/></svg>'
  },
  linkedin: {
    color: '#0A66C2',
    svg: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>'
  },
  discord: {
    color: '#5865F2',
    svg: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.89 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-1.99a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 0 0-.04.11c.36.69.77 1.35 1.22 1.98a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z"/></svg>'
  },
  email: {
    color: '#15131F',
    svg: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'
  },
  website: {
    color: '#15131F',
    svg: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
  },
  x: {
    color: '#000000',
    svg: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1.2h3.7l-8 9.2 9.4 12.4h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9zm-1.3 19.4h2L6.5 3.2H4.3l13.3 17.4z"/></svg>'
  },
  youtube: {
    color: '#CC0000',
    svg: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>'
  },
  mastodon: {
    color: '#563ACC',
    svg: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.3 7.9c0-5.2-3.4-6.7-3.4-6.7C18.2.4 15.3.1 12.2 0h-.1C9.1.1 6.2.4 4.5 1.2c0 0-3.4 1.5-3.4 6.7 0 1.2 0 2.6.1 4.1.1 5 1 10 5.6 11.2 2.1.6 4 .7 5.4.6 2.7-.2 4.2-1 4.2-1l-.1-1.9s-1.9.6-4.1.5c-2.1-.1-4.4-.2-4.7-2.9v-.8s2.1.5 4.7.6c1.6.1 3.1-.1 4.6-.3 2.9-.3 5.4-2.1 5.7-3.7.5-2.5.5-6.1.5-6.1zm-3.8 6.4h-2.4V8.4c0-1.2-.5-1.9-1.6-1.9-1.1 0-1.7.8-1.7 2.2v3.3h-2.4V8.8c0-1.5-.6-2.2-1.7-2.2-1 0-1.6.6-1.6 1.9v5.8H5.8v-6c0-1.2.3-2.2.9-2.9.7-.7 1.5-1.1 2.6-1.1 1.2 0 2.1.5 2.7 1.4l.6 1 .6-1c.6-.9 1.5-1.4 2.7-1.4 1 0 1.9.4 2.6 1.1.6.7.9 1.7.9 2.9v6z"/></svg>'
  },
  instagram: {
    color: '#C13584',
    svg: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>'
  },
  twitch: {
    color: '#9146FF',
    svg: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.6 11.6h-1.7V6.4h1.7v5.2zm4.6 0h-1.7V6.4h1.7v5.2zM6 0 1.7 4.3v15.4h5.2V24l4.3-4.3h3.4L22.3 12V0H6zm14.6 11.1-3.4 3.4h-3.5l-3 3v-3H6.9V1.7h13.7v9.4z"/></svg>'
  }
};

export function social(type) {
  return Object.hasOwn(brand, type) ? brand[type] : brand.website;
}

export const socialTypes = Object.keys(brand);

// Reconnaît le service d'un lien (github.com → github…) pour lui donner son icône.
const brandHosts = {
  github: /(^|\.)github\.com$/,
  linkedin: /(^|\.)linkedin\.com$/,
  discord: /(^|\.)discord\.(gg|com)$/,
  x: /(^|\.)(x|twitter)\.com$/,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/,
  instagram: /(^|\.)instagram\.com$/,
  twitch: /(^|\.)twitch\.tv$/
};

export function brandOf(url) {
  let host = '';
  try {
    host = new URL(text(url)).hostname.toLowerCase();
  } catch {
    return '';
  }
  return Object.keys(brandHosts).find((type) => brandHosts[type].test(host)) || '';
}

const icons = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  braces:
    '<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  terminal: '<path d="M4 17l6-5-6-5"/><path d="M12 19h8"/>',
  code: '<path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/>',
  server:
    '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z"/>',
  gamepad: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01"/>'
};

export function icon(name, size = 24) {
  const body = Object.hasOwn(icons, name) ? icons[name] : icons.code;
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export const iconNames = Object.keys(icons);
