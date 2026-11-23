// Éditeur de contenu : un formulaire généré à partir d'un schéma qui décrit
// chaque champ de content.json. Aucune dépendance.

import { t } from './i18n.js';
import { setupControls } from './controls.js';

const body = document.body;
const BASE = body.dataset.base;
const SOCIAL_TYPES = body.dataset.socialTypes.split(',');
const ICONS = body.dataset.iconNames.split(',');
const FONT_PRESETS = JSON.parse(body.dataset.fontPresets || '[]');
const PLATFORMS = JSON.parse(body.dataset.platforms || '[]');
const TECHS = JSON.parse(body.dataset.techs || '[]');
const TECH_INDEX = JSON.parse(body.dataset.techIndex || '{}');
const $status = document.getElementById('status');
const $save = document.getElementById('save');
const $editor = document.getElementById('editor');
const $sidenav = document.getElementById('sidenav');

// ---------- Schéma ----------
const text = (label, o = {}) => ({ kind: 'text', label, ...o });
const area = (label, o = {}) => ({ kind: 'area', label, ...o });
const color = (label, o = {}) => ({ kind: 'color', label, ...o });
const image = (label, o = {}) => ({ kind: 'image', label, ...o });
const select = (label, options, o = {}) => ({ kind: 'select', label, options, ...o });
const bool = (label, o = {}) => ({ kind: 'bool', label, ...o });
const lines = (label, o = {}) => ({ kind: 'lines', label, ...o });
const group = (label, fields, o = {}) => ({ kind: 'group', label, fields, ...o });
const list = (label, item, o = {}) => ({ kind: 'list', label, item, ...o });
const themes = (label, o = {}) => ({ kind: 'themes', label, ...o });
const font = (label, o = {}) => ({ kind: 'font', label, ...o });
const platforms = (label, o = {}) => ({ kind: 'platforms', label, ...o });
const repoImport = (label, o = {}) => ({ kind: 'repoImport', label, ...o });
const techList = (label, o = {}) => ({ kind: 'techs', label, ...o });
const repoImages = (label, o = {}) => ({ kind: 'repoImages', label, ...o });

// Thèmes de la page publique (même liste que siteThemes dans src/helpers.js).
// Les vignettes de l'admin sont dessinées en CSS (.tp-<id> dans admin.css).
const SITE_THEMES = [
  {
    id: 'folichon',
    name: 'Folichon',
    description: 'Le thème d’origine : blocs arrondis et colorés, titres expressifs.'
  },
  {
    id: 'magazine',
    name: 'Magazine',
    description: 'Mise en page de journal : grands titres à empattements, filets, pas de blocs.'
  },
  { id: 'terminal', name: 'Terminal', description: 'Fenêtres de console, police à chasse fixe, curseur qui clignote.' },
  {
    id: 'retro',
    name: 'Rétro',
    description: 'Fenêtres années 90 : reliefs gris, barres de titre bleues, fond vert d’eau.'
  },
  { id: 'neon', name: 'Néon', description: 'Halos de couleur en fond et cartes en verre dépoli.' },
  { id: 'pop', name: 'Pop', description: 'Néo-brutalisme : gros contours, ombres franches, autocollants penchés.' },
  { id: 'cv', name: 'CV sobre', description: 'Une seule colonne, comme un CV imprimé ; les captures sont masquées.' }
];

const theme = group(
  'Couleurs du bloc',
  [
    ['bg', color('Fond')],
    ['ink', color('Titres')],
    ['text', color('Texte')],
    ['slogan', color('Accroche')],
    ['accent', color('Accent (étiquette, bouton principal)')],
    ['onAccent', color('Texte sur l’accent')],
    ['surface', color('Bouton secondaire / pastilles')]
  ],
  { grid: true }
);

const SECTIONS = [
  {
    id: 'haut',
    title: 'Haut de page',
    fields: [
      [
        'site',
        group('Réglages du site', [
          ['title', text('Titre de l’onglet')],
          ['description', area('Description (moteurs de recherche, partages)')]
        ])
      ],
      [
        'nav',
        group(
          'Menu',
          [
            ['home', text('Accueil (menu latéral)')],
            ['projects', text('Projets')],
            ['timeline', text('Parcours')],
            ['skills', text('Compétences')],
            ['contact', text('Contact')]
          ],
          { grid: true }
        )
      ],
      [
        'profile',
        group('Présentation', [
          ['kicker', text('Petite phrase au-dessus du nom')],
          ['name', text('Prénom et nom')],
          ['headline', text('Accroche', { help: 'Entoure des mots d’astérisques pour les colorer : *apps Android*' })],
          ['intro', area('Texte de présentation')],
          ['photo', image('Photo', { accept: 'image/*' })],
          ['primaryButton', text('Bouton principal')],
          ['cvLabel', text('Texte du bouton CV')],
          [
            'cvUrl',
            image('Fichier ou lien du CV (PDF)', {
              accept: 'application/pdf',
              file: true,
              help: 'Vide = bouton masqué'
            })
          ],
          ['socialsLabel', text('Titre des réseaux')]
        ])
      ],
      [
        'socials',
        list(
          'Réseaux',
          group(
            '',
            [
              ['type', select('Service', SOCIAL_TYPES)],
              ['label', text('Libellé')],
              ['url', text('Lien', { help: 'Vide = bouton masqué' })]
            ],
            { grid: true }
          ),
          {
            title: (it) => it.label || it.type,
            addLabel: 'un réseau',
            add: () => ({ type: 'website', label: t('Site'), url: '' })
          }
        )
      ],
      [
        'stats',
        list(
          'Chiffres clés',
          group(
            '',
            [
              ['value', text('Nombre')],
              ['label', text('Libellé')],
              ['bg', color('Fond', { help: 'Vide = couleur d’accent' })],
              ['text', color('Texte')]
            ],
            { grid: true }
          ),
          {
            title: (it) => `${it.value} ${it.label}`,
            addLabel: 'un chiffre',
            add: () => ({ value: '0', label: t('Nouveau chiffre'), bg: '#FFFFFF', text: '#15131F' })
          }
        )
      ]
    ]
  },
  {
    id: 'projets',
    title: 'Projets',
    fields: [
      [
        'projectsSection',
        group(
          'En-tête de la section',
          [
            ['kicker', text('Surtitre')],
            ['title', text('Titre')],
            ['linkLabel', text('Texte du bouton')],
            ['linkUrl', text('Lien du bouton')]
          ],
          { grid: true }
        )
      ],
      [
        'projects',
        repoImport('Importer depuis un dépôt', {
          help: 'GitHub, GitLab, Codeberg, Gitea, Forgejo ou Bitbucket. Le nom, l’accroche, la description (début du README), les technologies, les plateformes et les liens sont remplis d’après le dépôt public, puis tu choisis les images. Rien n’est enregistré avant « Enregistrer ».'
        })
      ],
      [
        'projects',
        list(
          'Grands projets (un par ligne)',
          group('', [
            ['name', text('Nom')],
            ['platforms', platforms('Plateformes', { help: 'Affichées avec leur logo au-dessus du nom.' })],
            ['tagline', text('Accroche')],
            ['description', area('Description')],
            ['bullets', lines('Points forts (un par ligne)')],
            [
              'stack',
              techList('Technologies', {
                help: 'Entrée ou virgule pour ajouter. Les technologies connues ont leur logo ; les autres restent en pastille simple.'
              })
            ],
            ['codeUrl', text('Lien « Voir le code »')],
            ['siteUrl', text('Lien « Site du projet »')],
            [
              'imageSide',
              select('Côté des images', [
                ['right', 'À droite'],
                ['left', 'À gauche']
              ])
            ],
            [
              'media',
              group('Visuels', [
                [
                  'type',
                  select('Présentation', [
                    ['phones', 'Écrans de téléphone (1 ou 2)'],
                    ['browser', 'Fenêtre de navigateur'],
                    ['wide', 'Grande image fondue dans le fond']
                  ])
                ],
                ['framed', bool('Cadre blanc incliné autour des écrans (si les captures n’ont pas déjà de cadre)')],
                ['browserUrl', text('Adresse affichée dans la fenêtre')],
                [
                  'images',
                  list('Images', image(''), {
                    addLabel: 'une image',
                    add: () => '',
                    title: (it, i) => t('Image {n}', { n: i + 1 })
                  })
                ],
                ['images', repoImages('Images du dépôt')]
              ])
            ],
            ['theme', theme]
          ]),
          { title: (it) => it.name, addLabel: 'un projet', add: () => newProject() }
        )
      ]
    ]
  },
  {
    id: 'mini',
    title: 'Mini projets',
    fields: [
      [
        'miniProjects',
        list(
          'Mini blocs (sur une même ligne)',
          group(
            '',
            [
              ['name', text('Nom')],
              ['description', area('Description')],
              ['stack', text('Technologies')],
              ['url', text('Lien')],
              ['icon', select('Icône', ICONS)],
              ['bg', color('Fond')],
              ['ink', color('Titre')],
              ['text', color('Texte')],
              ['iconColor', color('Icône')]
            ],
            { grid: true }
          ),
          {
            title: (it) => it.name,
            addLabel: 'un mini projet',
            add: () => ({
              name: t('Nouveau'),
              description: '',
              stack: '',
              url: '',
              icon: 'code',
              bg: '#E8E6F0',
              ink: '#15131F',
              text: '#4A4659',
              iconColor: '#4F3BF5'
            })
          }
        )
      ]
    ]
  },
  {
    id: 'parcours',
    title: 'Parcours',
    fields: [
      [
        'timelineSection',
        group(
          'En-tête',
          [
            ['kicker', text('Surtitre')],
            ['title', text('Titre')]
          ],
          { grid: true }
        )
      ],
      [
        'timeline',
        list(
          'Étapes (de la plus récente à la plus ancienne)',
          group(
            '',
            [
              ['period', text('Période')],
              ['title', text('Poste ou diplôme')],
              ['org', text('Entreprise / école · ville')],
              ['dot', color('Couleur du point', { help: 'Vide = couleur d’accent' })],
              ['description', area('Tâches (une par ligne, affichées en liste à puces)')]
            ],
            { grid: true }
          ),
          {
            title: (it) => `${it.period} · ${it.title}`,
            addLabel: 'une étape',
            add: () => ({ period: '', title: t('Nouvelle étape'), org: '', description: '', dot: '' })
          }
        )
      ]
    ]
  },
  {
    id: 'competences',
    title: 'Compétences',
    fields: [
      [
        'skillsSection',
        group(
          'En-tête',
          [
            ['kicker', text('Surtitre')],
            ['title', text('Titre')]
          ],
          { grid: true }
        )
      ],
      [
        'skills',
        list(
          'Groupes de compétences',
          group(
            '',
            [
              ['group', text('Nom du groupe')],
              ['bg', color('Fond des pastilles')],
              ['text', color('Texte des pastilles')],
              ['items', lines('Compétences (une par ligne)')]
            ],
            { grid: true }
          ),
          {
            title: (it) => it.group,
            addLabel: 'un groupe',
            add: () => ({ group: t('Nouveau groupe'), bg: '#C9BCFF', text: '#1E0F5C', items: [] })
          }
        )
      ],
      [
        'languages',
        group(
          'Langues',
          [
            ['label', text('Titre')],
            ['value', text('Langues')]
          ],
          { grid: true }
        )
      ]
    ]
  },
  {
    id: 'contact',
    title: 'Contact & pied de page',
    fields: [
      [
        'contact',
        group('Bloc contact', [
          ['kicker', text('Surtitre')],
          ['title', text('Titre')],
          [
            'email',
            text('Adresse e-mail', {
              help: 'Jamais affichée sur la page : le bouton ouvre la messagerie. Vide = bouton masqué'
            })
          ],
          ['emailButton', text('Texte du bouton e-mail', { help: 'Par défaut : E-mail ↗' })],
          [
            'links',
            list(
              'Liens',
              group(
                '',
                [
                  ['label', text('Libellé')],
                  ['url', text('Lien')]
                ],
                { grid: true }
              ),
              { title: (it) => it.label, addLabel: 'un lien', add: () => ({ label: t('Lien ↗'), url: '' }) }
            )
          ]
        ])
      ],
      [
        'footer',
        group(
          'Pied de page',
          [
            ['left', text('Gauche')],
            ['right', text('Droite')],
            ['poweredBy', bool('Afficher « Powered by Folichon »', { default: true })]
          ],
          { grid: true }
        )
      ]
    ]
  },
  {
    id: 'apparence',
    title: 'Apparence',
    group: 'design',
    fields: [
      [
        'site',
        group(
          'Langue et couleur',
          [
            [
              'lang',
              select(
                'Langue de la page',
                [
                  ['fr', 'Français'],
                  ['en', 'English']
                ],
                { help: 'Langue des textes fixes de la page (boutons, menu de partage…) et des moteurs de recherche.' }
              )
            ],
            [
              'accent',
              // Les vignettes des thèmes prennent tout de suite la nouvelle couleur.
              color('Couleur d’accent principale', {
                onChange: (value) => {
                  for (const preview of document.querySelectorAll('.theme-preview')) {
                    preview.style.setProperty('--tp-accent', value);
                  }
                }
              })
            ]
          ],
          { grid: true }
        )
      ],
      [
        'site',
        group('', [
          [
            'theme',
            themes('Thème de la page', {
              help: 'Change la mise en page et le style de la page publique. Le mode clair / sombre et la couleur d’accent sont conservés.'
            })
          ]
        ])
      ],
      [
        'site',
        group(
          'Polices',
          [
            ['fontDisplay', font('Police des titres', { sample: 'Prénom Nom', weight: 800 })],
            [
              'fontBody',
              font('Police du texte', { sample: 'Portez ce vieux whisky au juge blond qui fume', weight: 400 })
            ]
          ],
          {
            help: 'Les polices « déjà installées » changent un peu d’un appareil à l’autre. Pour un rendu identique partout, envoie ta propre police.'
          }
        )
      ]
    ]
  }
];

function newProject() {
  return {
    name: t('Nouveau projet'),
    platforms: [],
    tagline: '',
    description: '',
    bullets: [],
    stack: [],
    codeUrl: '',
    siteUrl: '',
    imageSide: 'right',
    media: { type: 'phones', framed: true, browserUrl: '', images: [] },
    theme: {
      bg: '#FFFFFF',
      ink: '#15131F',
      text: '#4A4659',
      slogan: '#15131F',
      accent: '#4F3BF5',
      onAccent: '#FFFFFF',
      surface: '#F1F0F5'
    }
  };
}

// Liste comptée dans le menu, pour les sections qui en ont une.
const SECTION_COUNTS = { projets: 'projects', mini: 'miniProjects', parcours: 'timeline', competences: 'skills' };

// ---------- État ----------
let content = null;
let dirty = false;
let current = ''; // section affichée
const pageTitle = () => t('Folichon · administration');
let lastStatus = ['Chargement…', '', {}];
let edits = 0; // compteur de modifications, pour repérer celles faites pendant un enregistrement
let revision = ''; // empreinte du contenu chargé, renvoyée au serveur pour éviter d'écraser une version plus récente
const openItems = new Set();

function setStatus(msg, kind = '', vars = {}) {
  lastStatus = [msg, kind, vars];
  $status.textContent = t(msg, vars);
  $status.dataset.kind = kind;
}

function markDirty() {
  dirty = true;
  edits += 1;
  $save.disabled = false;
  document.title = `• ${pageTitle()}`;
  setStatus('Modifications non enregistrées', 'warn');
}

function markClean() {
  dirty = false;
  $save.disabled = true;
  document.title = pageTitle();
}

// Petit message en bas de l'écran, avec une action facultative (« Annuler »).
const $toast = document.getElementById('toast');
let toastTimer;
function toast(message, action) {
  clearTimeout(toastTimer);
  $toast.replaceChildren(el('span', {}, message));
  if (action) {
    const run = () => {
      action.run();
      $toast.hidden = true;
    };
    $toast.append(el('button', { type: 'button', onclick: run }, action.label));
  }
  $toast.hidden = false;
  toastTimer = setTimeout(() => {
    $toast.hidden = true;
  }, 6000);
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'X-Requested-With': 'folichon-admin', ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (res.headers.has('X-Content-Revision')) revision = res.headers.get('X-Content-Revision');
  if (res.status === 401) {
    setStatus('Session expirée : recharge la page pour te reconnecter.', 'error');
    throw new Error(data.error || t('Non connecté'));
  }
  if (!res.ok) throw new Error(data.error || t('Erreur {status}', { status: res.status }));
  return data;
}

// ---------- Rendu ----------
let uid = 0;
const id = () => `f${++uid}`;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

function field(label, input, help) {
  const fid = input.id || (input.id = id());
  return el(
    'div',
    { class: 'field' },
    label ? el('label', { for: fid }, t(label)) : null,
    input,
    help ? el('small', { class: 'help' }, t(help)) : null
  );
}

function sectionIdFromHash() {
  const id = location.hash.replace(/^#s-/, '');
  return SECTIONS.some((s) => s.id === id) ? id : '';
}

// Menu des sections, en deux groupes : le contenu de la page, puis sa mise en forme.
const NAV_GROUPS = { content: 'Contenu', design: 'Mise en forme' };

function renderNav() {
  const items = [];
  let group = null;
  for (const s of SECTIONS) {
    const sectionGroup = s.group || 'content';
    if (sectionGroup !== group) {
      if (group) items.push(el('span', { class: 'nav-sep', 'aria-hidden': 'true' }));
      items.push(el('span', { class: 'nav-group' }, t(NAV_GROUPS[sectionGroup])));
      group = sectionGroup;
    }
    const list = SECTION_COUNTS[s.id] && content ? content[SECTION_COUNTS[s.id]] : null;
    items.push(
      el(
        'a',
        {
          href: `#s-${s.id}`,
          'aria-current': s.id === current ? 'page' : null,
          onclick: (e) => {
            e.preventDefault();
            showSection(s.id);
          }
        },
        el('span', {}, t(s.title)),
        Array.isArray(list) ? el('span', { class: 'nav-count' }, String(list.length)) : null
      )
    );
  }
  $sidenav.replaceChildren(...items);
}

// Une seule section visible à la fois ; la dernière consultée est retenue.
function showSection(id) {
  current = id;
  try {
    localStorage.setItem('folichon-admin-section', id);
  } catch {
    /* stockage indisponible : on reste sur la section pendant cette visite */
  }
  history.replaceState(null, '', `#s-${id}`);
  for (const panel of $editor.children) panel.hidden = panel.dataset.section !== id;
  renderNav();
  window.scrollTo({ top: 0 });
}

function render() {
  uid = 0;
  const scroll = window.scrollY;
  $editor.replaceChildren(
    ...SECTIONS.map((s, i) => {
      const prev = SECTIONS[i - 1];
      const next = SECTIONS[i + 1];
      const step = (target, text) =>
        target
          ? el('button', { type: 'button', class: 'btn btn-quiet', onclick: () => showSection(target.id) }, text)
          : el('span');
      return el(
        'section',
        { class: 'panel', id: `s-${s.id}`, 'data-section': s.id, hidden: s.id !== current },
        el('div', { class: 'panel-head' }, el('h2', {}, t(s.title))),
        ...s.fields.map(([key, sch]) => renderNode(sch, content, key, key)),
        el('div', { class: 'panel-foot' }, step(prev, `← ${t(prev?.title)}`), step(next, `${t(next?.title)} →`))
      );
    })
  );
  renderNav();
  window.scrollTo(0, scroll);
}

function renderNode(sch, parent, key, path) {
  const value = parent[key];
  switch (sch.kind) {
    case 'group': {
      if (!value || typeof value !== 'object') parent[key] = {};
      const obj = parent[key];
      const inner = sch.fields.map(([k, s]) => renderNode(s, obj, k, `${path}.${k}`));
      const box = el('div', { class: sch.grid ? 'grid' : 'stack' }, inner);
      if (sch.help) box.prepend(el('small', { class: 'help' }, t(sch.help)));
      return sch.label ? el('fieldset', {}, el('legend', {}, t(sch.label)), box) : box;
    }
    case 'list':
      return renderList(sch, parent, key, path);
    case 'text': {
      const input = el('input', {
        type: 'text',
        value: value ?? '',
        oninput: (e) => {
          parent[key] = e.target.value;
          markDirty();
        }
      });
      return field(sch.label, input, sch.help);
    }
    case 'area': {
      const input = el('textarea', {
        rows: 3,
        oninput: (e) => {
          parent[key] = e.target.value;
          markDirty();
        }
      });
      input.value = value ?? '';
      return field(sch.label, input, sch.help);
    }
    case 'lines': {
      const input = el('textarea', {
        rows: 4,
        oninput: (e) => {
          parent[key] = e.target.value
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
          markDirty();
        }
      });
      input.value = Array.isArray(value) ? value.join('\n') : '';
      return field(sch.label, input, sch.help);
    }
    case 'bool': {
      const input = el('input', {
        type: 'checkbox',
        checked: Boolean(value ?? sch.default),
        onchange: (e) => {
          parent[key] = e.target.checked;
          markDirty();
        }
      });
      const fid = (input.id = id());
      return el('div', { class: 'field check' }, input, el('label', { for: fid }, t(sch.label)));
    }
    case 'select': {
      const opts = sch.options.map((o) => (Array.isArray(o) ? o : [o, o]));
      const input = el(
        'select',
        {
          onchange: (e) => {
            parent[key] = e.target.value;
            markDirty();
          }
        },
        opts.map(([v, l]) => el('option', { value: v, selected: v === value }, t(l)))
      );
      return field(sch.label, input, sch.help);
    }
    case 'color':
      return renderColor(sch, parent, key);
    case 'image':
      return renderImage(sch, parent, key);
    case 'themes':
      return renderThemes(sch, parent, key);
    case 'font':
      return renderFont(sch, parent, key);
    case 'platforms':
      return renderPlatforms(sch, parent, key);
    case 'repoImport':
      return renderRepoImport(sch, parent, key);
    case 'techs':
      return renderTechs(sch, parent, key);
    case 'repoImages':
      return renderRepoImages(sch, parent, key, path);
    default:
      return el('p', {}, t('Champ inconnu : {kind}', { kind: sch.kind }));
  }
}

function renderColor(sch, parent, key) {
  const value = parent[key] ?? '';
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  const picker = el('input', {
    type: 'color',
    value: valid ? value : '#ffffff',
    'aria-label': t('{label} (sélecteur)', { label: t(sch.label) })
  });
  const input = el('input', { type: 'text', value, placeholder: '#RRGGBB', class: 'color-text', spellcheck: 'false' });
  picker.addEventListener('input', () => {
    input.value = picker.value.toUpperCase();
    parent[key] = input.value;
    sch.onChange?.(input.value);
    markDirty();
  });
  input.addEventListener('input', () => {
    parent[key] = input.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(input.value.trim())) {
      picker.value = input.value.trim();
      sch.onChange?.(input.value.trim());
    }
    markDirty();
  });
  const fid = (input.id = id());
  return el(
    'div',
    { class: 'field' },
    el('label', { for: fid }, t(sch.label)),
    el('div', { class: 'color-row' }, picker, input),
    sch.help ? el('small', { class: 'help' }, t(sch.help)) : null
  );
}

// Choix du thème : une vignette par thème, sous forme de boutons radio.
function renderThemes(sch, parent, key) {
  const current = SITE_THEMES.some((th) => th.id === parent[key]) ? parent[key] : SITE_THEMES[0].id;
  const accent = /^#[0-9a-f]{6}$/i.test(parent.accent ?? '') ? parent.accent : '#4F3BF5';
  const name = id();
  const cards = SITE_THEMES.map((th) => {
    const input = el('input', {
      type: 'radio',
      name,
      value: th.id,
      checked: th.id === current,
      onchange: () => {
        parent[key] = th.id;
        markDirty();
      }
    });
    const preview = el(
      'span',
      { class: `theme-preview tp-${th.id}`, 'aria-hidden': 'true', style: `--tp-accent: ${accent}` },
      el(
        'span',
        { class: 'tp-card' },
        el('span', { class: 'tp-bar' }),
        el('span', { class: 'tp-title' }, 'Aa'),
        el('span', { class: 'tp-lines' }, el('span', {}), el('span', {})),
        el('span', { class: 'tp-btn' })
      ),
      el('span', { class: 'tp-row' }, el('span', {}), el('span', {}))
    );
    return el(
      'label',
      { class: 'theme-option' },
      input,
      preview,
      el('span', { class: 'theme-name' }, t(th.name)),
      el('small', { class: 'theme-desc' }, t(th.description))
    );
  });
  return el(
    'fieldset',
    { class: 'theme-field' },
    el('legend', {}, t(sch.label)),
    sch.help ? el('small', { class: 'help' }, t(sch.help)) : null,
    el('div', { class: 'theme-grid' }, cards)
  );
}

// Police : liste des polices proposées, aperçu, et envoi d'un fichier pour « Ma police ».
// La police envoyée est chargée dans la page de l'admin pour que l'aperçu soit exact.
const loadedFonts = new Map();
function previewFamily(url) {
  if (!/^\/uploads\/[A-Za-z0-9_-]+\.(woff2|woff|ttf|otf)$/.test(url)) return '';
  if (!loadedFonts.has(url)) {
    const family = `folichon-preview-${loadedFonts.size + 1}`;
    loadedFonts.set(url, family);
    const face = new FontFace(family, `url(${url})`);
    face.load().then(
      (f) => document.fonts.add(f),
      () => {}
    );
  }
  return `'${loadedFonts.get(url)}'`;
}

function renderFont(sch, parent, key) {
  const fileKey = `${key}File`;
  const value = parent[key] === 'custom' || FONT_PRESETS.some((f) => f.id === parent[key]) ? parent[key] : '';
  const bundled = FONT_PRESETS.slice(0, 3);
  const system = FONT_PRESETS.slice(3);
  const option = (v, label) => el('option', { value: v, selected: v === value }, t(label));
  const select = el(
    'select',
    {},
    option('', 'Celle du thème'),
    el(
      'optgroup',
      { label: t('Fournies avec Folichon') },
      bundled.map((f) => option(f.id, f.name))
    ),
    el(
      'optgroup',
      { label: t('Déjà installées sur l’appareil du visiteur') },
      system.map((f) => option(f.id, f.name))
    ),
    option('custom', 'Ma police (fichier envoyé)')
  );
  const sample = el('p', { class: 'font-sample', style: `font-weight: ${sch.weight}` }, t(sch.sample));
  const upload = renderImage(
    {
      kind: 'image',
      label: 'Fichier de la police',
      file: true,
      uploadKind: 'font',
      accept: '.woff2,.woff,.ttf,.otf',
      help: 'WOFF2 de préférence (le plus léger). Vérifie que la licence de la police autorise son usage sur un site.',
      onChange: () => update()
    },
    parent,
    fileKey
  );
  function update() {
    const choice = select.value;
    upload.hidden = choice !== 'custom';
    let family = 'inherit';
    if (choice === 'custom') family = previewFamily(parent[fileKey] || '') || 'inherit';
    else if (choice) family = FONT_PRESETS.find((f) => f.id === choice).stack;
    sample.style.fontFamily = family;
    sample.hidden = !choice || (choice === 'custom' && family === 'inherit');
  }
  // Une police envoyée puis abandonnée n'est plus référencée : le serveur pourra supprimer le
  // fichier. On le garde en mémoire le temps de la visite, au cas où l'on revient à « Ma police ».
  let setAside = '';
  select.addEventListener('change', () => {
    if (select.value === 'custom' && !parent[fileKey] && setAside) parent[fileKey] = setAside;
    if (select.value !== 'custom' && parent[fileKey]) {
      setAside = parent[fileKey];
      delete parent[fileKey];
    }
    if (select.value) parent[key] = select.value;
    else delete parent[key];
    update();
    markDirty();
  });
  update();
  const fid = (select.id = id());
  return el('div', { class: 'field font-field' }, el('label', { for: fid }, t(sch.label)), select, sample, upload);
}

// Plateformes d'un projet : une case à cocher par plateforme, avec son logo.
// L'ordre des cases cochées est celui de la liste ; les valeurs inconnues sont gardées.
function renderPlatforms(sch, parent, key) {
  if (!Array.isArray(parent[key])) parent[key] = [];
  const boxes = PLATFORMS.map((p) => {
    const input = el('input', {
      type: 'checkbox',
      value: p.id,
      checked: parent[key].includes(p.id),
      onchange: () => {
        const chosen = new Set(parent[key]);
        if (input.checked) chosen.add(p.id);
        else chosen.delete(p.id);
        const known = PLATFORMS.map((q) => q.id).filter((id) => chosen.has(id));
        parent[key] = [...known, ...[...chosen].filter((id) => !known.includes(id))];
        markDirty();
      }
    });
    return el(
      'label',
      { class: 'platform-option' },
      input,
      el('img', { src: `/assets/img/platforms/${p.id}.svg`, alt: '', width: 20, height: 20 }),
      el('span', {}, p.name)
    );
  });
  return el(
    'fieldset',
    { class: 'platform-field' },
    el('legend', {}, t(sch.label)),
    sch.help ? el('small', { class: 'help' }, t(sch.help)) : null,
    el('div', { class: 'platform-grid' }, boxes)
  );
}

// Projet pré-rempli d'après les informations publiques d'un dépôt.
function projectFromRepo(repo, link) {
  const project = newProject();
  const mobile = repo.platforms.some((p) => ['android', 'ios'].includes(p));
  let host = '';
  try {
    host = repo.homepage ? new URL(repo.homepage).host : '';
  } catch {
    /* adresse du site illisible */
  }
  const bullets = [];
  if (repo.stars > 0) {
    bullets.push(
      t(repo.stars === 1 ? '{n} étoile sur {site}' : '{n} étoiles sur {site}', {
        n: repo.stars.toLocaleString(),
        site: repo.provider
      })
    );
  }
  if (repo.license) bullets.push(t('Licence {license}', { license: repo.license }));
  return {
    ...project,
    name: repo.name || project.name,
    platforms: repo.platforms,
    tagline: repo.description,
    description: repo.readme || '',
    bullets,
    stack: repo.stack,
    codeUrl: repo.url || link,
    siteUrl: repo.homepage,
    media: {
      ...project.media,
      type: mobile ? 'phones' : host ? 'browser' : 'wide',
      framed: mobile,
      browserUrl: host
    }
  };
}

// Images trouvées dans chaque dépôt (lien du code → adresses), et celles déjà choisies
// (adresse d'origine → fichier /uploads), gardées pendant la visite.
const repoImageCache = new Map();
const pickedImages = new Map();

async function loadRepo(link) {
  const repo = await api('/repo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: link })
  });
  repoImageCache.set(link, repo.images || []);
  if (repo.url) repoImageCache.set(repo.url, repo.images || []);
  return repo;
}

// Champ « lien du dépôt » au-dessus de la liste des projets : ajoute un projet pré-rempli.
function renderRepoImport(sch, parent, key) {
  const input = el('input', {
    type: 'text',
    inputmode: 'url',
    placeholder: 'https://github.com/moi/mon-projet',
    spellcheck: 'false',
    autocomplete: 'off',
    'aria-label': t('Lien du dépôt')
  });
  const button = el('button', { type: 'submit', class: 'btn btn-primary' }, t('Importer'));
  const form = el(
    'form',
    {
      class: 'repo-import-row',
      onsubmit: async (e) => {
        e.preventDefault();
        const link = input.value.trim();
        if (!link) return input.focus();
        button.disabled = true;
        setStatus('Lecture du dépôt…');
        try {
          const repo = await loadRepo(link);
          if (!Array.isArray(parent[key])) parent[key] = [];
          parent[key].push(projectFromRepo(repo, link));
          const index = parent[key].length - 1;
          openItems.add(`${key}[${index}]`);
          markDirty();
          render();
          setStatus(
            repo.images?.length
              ? 'Projet « {name} » ajouté — choisis ses images dans « Visuels », puis enregistre'
              : 'Projet « {name} » ajouté d’après le dépôt — complète-le puis enregistre',
            'warn',
            { name: parent[key][index].name }
          );
          document.querySelectorAll('#s-projets > fieldset.list > details.list-item')[index]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        } catch (err) {
          button.disabled = false;
          setStatus('Import du dépôt impossible : {message}', 'error', { message: t(err.message) });
        }
      }
    },
    input,
    button
  );
  return el(
    'fieldset',
    { class: 'repo-import' },
    el('legend', {}, t(sch.label)),
    sch.help ? el('small', { class: 'help' }, t(sch.help)) : null,
    form
  );
}

// Même correspondance nom → logo que techFor() côté serveur (src/helpers.js).
const techKey = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]/g, '');
const techLogo = (name) => {
  const id = TECH_INDEX[techKey(name)];
  return id ? `/assets/img/tech/${id}.svg` : '';
};

// Technologies : pastilles (avec logo si connu), × pour retirer, ← → pour déplacer,
// et un champ avec suggestions pour en ajouter.
let techListId = 0;
function renderTechs(sch, parent, key) {
  if (!Array.isArray(parent[key])) {
    parent[key] = String(parent[key] ?? '')
      .split(/[,\n·]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  const arr = parent[key];
  const pills = el('div', { class: 'tech-pills' });
  const datalist = el(
    'datalist',
    { id: `techs-${++techListId}` },
    TECHS.map((tech) => el('option', { value: tech.name }))
  );
  const input = el('input', {
    type: 'text',
    list: datalist.id,
    placeholder: t('Ajouter une technologie…'),
    autocomplete: 'off'
  });
  const add = () => {
    const values = input.value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    input.value = '';
    let changed = false;
    for (const v of values) {
      if (arr.some((x) => techKey(x) === techKey(v))) continue;
      arr.push(v);
      changed = true;
    }
    if (changed) {
      markDirty();
      draw();
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !input.value && arr.length) {
      arr.pop();
      markDirty();
      draw();
    }
  });
  // Choix dans la liste de suggestions : ajouté tout de suite.
  input.addEventListener('input', (e) => {
    if (e.inputType === 'insertReplacementText') add();
  });
  input.addEventListener('blur', add);
  function draw() {
    pills.replaceChildren(
      ...arr.map((name, i) => {
        const logo = techLogo(name);
        const move = (d) => {
          const j = i + d;
          if (j < 0 || j >= arr.length) return;
          [arr[i], arr[j]] = [arr[j], arr[i]];
          markDirty();
          draw();
        };
        const btn = (label, text, onclick, disabled) =>
          el(
            'button',
            { type: 'button', class: 'tech-btn', title: t(label), 'aria-label': t(label), disabled, onclick },
            text
          );
        return el(
          'span',
          { class: 'tech-pill' },
          logo ? el('img', { src: logo, alt: '', width: 18, height: 18 }) : null,
          el('span', {}, name),
          btn('Vers la gauche', '‹', () => move(-1), i === 0),
          btn('Vers la droite', '›', () => move(1), i === arr.length - 1),
          btn(
            'Retirer',
            '×',
            () => {
              arr.splice(i, 1);
              markDirty();
              draw();
            },
            false
          )
        );
      })
    );
  }
  draw();
  const fid = (input.id = id());
  return el(
    'div',
    { class: 'field tech-field' },
    el('label', { for: fid }, t(sch.label)),
    pills,
    input,
    datalist,
    sch.help ? el('small', { class: 'help' }, t(sch.help)) : null
  );
}

// Images du dépôt du projet (README, aperçu GitHub, avatar) : un clic les télécharge sur
// le serveur et les ajoute aux images du projet ; un second clic les retire.
function renderRepoImages(sch, parent, key, path) {
  const index = Number(/^projects\[(\d+)\]/.exec(path)?.[1]);
  const project = content.projects?.[index];
  const link = String(project?.codeUrl || '').trim();
  const box = el('div', { class: 'repo-images' });
  const field = el(
    'div',
    { class: 'field' },
    el('span', { class: 'field-label' }, t(sch.label)),
    box,
    el(
      'small',
      { class: 'help' },
      t('Écrans de téléphone : 2 images au plus. Navigateur et grande image : la première seulement.')
    )
  );
  if (!link) {
    box.append(
      el('small', { class: 'help' }, t('Renseigne le lien « Voir le code » pour proposer les images du dépôt.'))
    );
    return field;
  }
  const load = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-small',
      onclick: async () => {
        const previous = lastStatus;
        load.disabled = true;
        setStatus('Lecture du dépôt…');
        try {
          await loadRepo(link);
          setStatus(...previous);
          draw();
        } catch (err) {
          load.disabled = false;
          setStatus('Import du dépôt impossible : {message}', 'error', { message: t(err.message) });
        }
      }
    },
    t('Charger les images du dépôt')
  );
  function draw() {
    const images = repoImageCache.get(link);
    if (!images) return box.replaceChildren(load);
    if (!images.length)
      return box.replaceChildren(el('small', { class: 'help' }, t('Aucune image trouvée dans ce dépôt.')));
    if (!Array.isArray(parent[key])) parent[key] = [];
    const list = parent[key];
    box.replaceChildren(
      el(
        'div',
        { class: 'repo-image-grid' },
        images.map((src) => {
          const uploaded = pickedImages.get(src);
          const chosen = Boolean(uploaded && list.includes(uploaded));
          const button = el(
            'button',
            {
              type: 'button',
              class: 'repo-image',
              'aria-pressed': String(chosen),
              title: src,
              onclick: async () => {
                if (chosen) {
                  list.splice(list.indexOf(uploaded), 1);
                  markDirty();
                  return render();
                }
                button.disabled = true;
                setStatus('Téléchargement de l’image…');
                try {
                  const { url } = await api('/repo-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: src })
                  });
                  pickedImages.set(src, url);
                  // Remplace une image vide laissée par « + Ajouter une image », sinon ajoute.
                  const empty = list.indexOf('');
                  if (empty >= 0) list[empty] = url;
                  else list.push(url);
                  markDirty();
                  render();
                  setStatus('Image ajoutée — pense à enregistrer', 'warn');
                } catch (err) {
                  button.disabled = false;
                  setStatus('Image impossible à ajouter : {message}', 'error', { message: t(err.message) });
                }
              }
            },
            el('img', {
              src,
              alt: '',
              loading: 'lazy',
              referrerpolicy: 'no-referrer',
              // Une adresse qui n'est pas une image (ou plus en ligne) disparaît de la grille.
              onerror: () => button.remove()
            }),
            chosen ? el('span', { class: 'repo-image-check', 'aria-hidden': 'true' }, '✓') : null
          );
          return button;
        })
      )
    );
  }
  draw();
  return field;
}

function renderImage(sch, parent, key) {
  const value = parent[key] ?? '';
  const isFile = sch.file;
  const preview = isFile ? null : el('img', { class: 'thumb', alt: '', src: value || null, hidden: !value });
  const input = el('input', {
    type: 'text',
    value,
    placeholder: t(isFile ? '/uploads/mon-cv.pdf ou https://…' : '/uploads/… ou https://…')
  });
  input.addEventListener('input', () => {
    parent[key] = input.value.trim();
    sch.onChange?.(parent[key]);
    if (preview) {
      preview.src = parent[key];
      preview.hidden = !parent[key];
    }
    markDirty();
  });
  const file = el('input', { type: 'file', accept: sch.accept || 'image/*', hidden: true });
  const fid = id();
  file.id = fid;
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    const fd = new FormData();
    fd.append('file', file.files[0]);
    setStatus('Envoi du fichier…');
    try {
      // Type attendu par ce champ : police, document (CV) ou image.
      const kind = sch.uploadKind || (sch.file ? 'document' : 'image');
      const { url } = await api(`/upload?kind=${kind}`, { method: 'POST', body: fd });
      parent[key] = url;
      input.value = url;
      sch.onChange?.(url);
      if (preview) {
        preview.src = url;
        preview.hidden = false;
      }
      markDirty();
      setStatus('Fichier envoyé — pense à enregistrer', 'warn');
    } catch (err) {
      setStatus(err.message, 'error');
    }
    file.value = '';
  });
  const clear = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-small btn-ghost',
      onclick: () => {
        parent[key] = '';
        input.value = '';
        sch.onChange?.('');
        if (preview) preview.hidden = true;
        markDirty();
      }
    },
    t('Retirer')
  );
  const tid = (input.id = id());
  return el(
    'div',
    { class: 'field image-field' },
    sch.label ? el('label', { for: tid }, t(sch.label)) : null,
    el(
      'div',
      { class: 'image-row' },
      preview,
      el(
        'div',
        { class: 'image-controls' },
        input,
        el(
          'div',
          { class: 'row' },
          el('label', { class: 'btn btn-small', for: fid }, t(isFile ? 'Envoyer un fichier' : 'Envoyer une image')),
          file,
          clear
        )
      )
    ),
    sch.help ? el('small', { class: 'help' }, t(sch.help)) : null
  );
}

function renderList(sch, parent, key, path) {
  if (!Array.isArray(parent[key])) parent[key] = [];
  const arr = parent[key];
  const isPrimitive = sch.item.kind !== 'group';

  const items = arr.map((item, i) => {
    const itemPath = `${path}[${i}]`;
    const itemTitle = () => sch.title?.(arr[i], i) || t('Élément {n}', { n: i + 1 });
    const move = (d) => {
      const j = i + d;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      swapOpen(`${path}[${i}]`, `${path}[${j}]`);
      markDirty();
      render();
    };
    const tools = el(
      'span',
      { class: 'item-tools' },
      el(
        'button',
        {
          type: 'button',
          class: 'icon-btn',
          title: t('Monter'),
          'aria-label': t('Monter'),
          disabled: i === 0,
          onclick: (e) => {
            e.preventDefault();
            move(-1);
          }
        },
        '↑'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'icon-btn',
          title: t('Descendre'),
          'aria-label': t('Descendre'),
          disabled: i === arr.length - 1,
          onclick: (e) => {
            e.preventDefault();
            move(1);
          }
        },
        '↓'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'icon-btn danger',
          title: t('Supprimer'),
          'aria-label': t('Supprimer'),
          onclick: (e) => {
            e.preventDefault();
            const [removed] = arr.splice(i, 1);
            openItems.clear();
            markDirty();
            render();
            toast(t('« {name} » supprimé', { name: sch.title?.(removed, i) || t('Élément') }), {
              label: t('Annuler'),
              run: () => {
                arr.splice(i, 0, removed);
                markDirty();
                render();
              }
            });
          }
        },
        '✕'
      )
    );

    if (isPrimitive) {
      const node = renderNode(sch.item, arr, i, itemPath);
      return el(
        'div',
        { class: 'list-item flat' },
        el(
          'div',
          { class: 'flat-head' },
          el('span', { class: 'item-title' }, sch.title ? sch.title(item, i) : `#${i + 1}`),
          tools
        ),
        node
      );
    }

    const details = el('details', { class: 'list-item', open: openItems.has(itemPath) });
    details.addEventListener('toggle', () => {
      if (details.open) openItems.add(itemPath);
      else openItems.delete(itemPath);
    });
    const title = el('span', { class: 'item-title' }, itemTitle());
    details.append(
      el('summary', {}, title, tools),
      el('div', { class: 'item-body' }, renderNode(sch.item, arr, i, itemPath))
    );
    details.addEventListener('input', () => {
      title.textContent = itemTitle();
    });
    return details;
  });

  const add = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-small btn-dashed',
      onclick: () => {
        arr.push(sch.add ? sch.add() : {});
        openItems.add(`${path}[${arr.length - 1}]`);
        markDirty();
        render();
      }
    },
    t('+ Ajouter {what}', { what: t(sch.addLabel || 'un élément') })
  );

  const count = arr.length ? el('span', { class: 'legend-count' }, String(arr.length)) : null;
  return el('fieldset', { class: 'list' }, el('legend', {}, t(sch.label), count), ...items, add);
}

function swapOpen(a, b) {
  const ha = openItems.has(a),
    hb = openItems.has(b);
  openItems.delete(a);
  openItems.delete(b);
  if (ha) openItems.add(b);
  if (hb) openItems.add(a);
}

// ---------- Actions ----------
async function save() {
  $save.disabled = true;
  setStatus('Enregistrement…');
  const sentEdits = edits;
  try {
    // On garde le même objet : les champs du formulaire y sont liés. Le remplacer par
    // la réponse du serveur ferait perdre en silence toutes les modifications suivantes.
    await api('/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Content-Revision': revision },
      body: JSON.stringify(content)
    });
    if (edits === sentEdits) {
      markClean();
      setStatus('Enregistré ✓ — la page publique est à jour', 'ok');
    } else {
      // Des champs ont changé pendant l'envoi : ils ne sont pas encore enregistrés.
      $save.disabled = false;
      setStatus('Enregistré, mais tu as modifié entre-temps : enregistre encore', 'warn');
    }
  } catch (err) {
    $save.disabled = false;
    const conflict = /modifié ailleurs/.test(err.message);
    setStatus(
      conflict
        ? 'Une version plus récente existe (autre onglet ?) : exporte tes modifications si besoin, puis recharge la page.'
        : 'Échec : {message}',
      'error',
      { message: t(err.message) }
    );
  }
}

$save.addEventListener('click', save);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (dirty) save();
  }
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Export : une archive ZIP avec le contenu affiché (modifications pas encore enregistrées
// comprises) et les images, PDF et polices qu'il utilise. Le serveur la prépare.
document.getElementById('export').addEventListener('click', async () => {
  const previous = lastStatus;
  setStatus('Préparation de l’archive…');
  try {
    const res = await fetch(`${BASE}/api/backup`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'folichon-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || t('Erreur {status}', { status: res.status }));
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'folichon.zip';
    const a = el('a', { href: URL.createObjectURL(await res.blob()), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus(...previous);
  } catch (err) {
    setStatus('Export impossible : {message}', 'error', { message: t(err.message) });
  }
});

// Import : une archive exportée (contenu + fichiers) ou un simple fichier JSON.
// Dans les deux cas, rien n'est enregistré avant « Enregistrer ».
document.getElementById('import').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    let data;
    let restored = -1;
    if (/\.zip$/i.test(f.name) || /zip/.test(f.type)) {
      setStatus('Import de l’archive…');
      ({ content: data, restored } = await api('/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: f
      }));
    } else {
      data = JSON.parse(await f.text());
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(t('Fichier invalide'));
    content = data;
    openItems.clear();
    render();
    markDirty();
    if (restored >= 0) {
      setStatus('Archive importée, {count} fichier(s) restauré(s) — vérifie puis enregistre', 'warn', {
        count: restored
      });
    } else setStatus('Fichier importé — vérifie puis enregistre', 'warn');
  } catch (err) {
    setStatus('Import impossible : {message}', 'error', { message: t(err.message) });
  }
  e.target.value = '';
});

// ---------- Démarrage ----------
let remembered = '';
try {
  remembered = localStorage.getItem('folichon-admin-section') || '';
} catch {
  /* stockage indisponible */
}
current = sectionIdFromHash() || (SECTIONS.some((s) => s.id === remembered) ? remembered : SECTIONS[0].id);
addEventListener('hashchange', () => {
  const id = sectionIdFromHash();
  if (id && id !== current) showSection(id);
});

// Menu « ⋯ » : se ferme après un choix ou un clic ailleurs.
const $menu = document.getElementById('menu');
$menu.addEventListener('click', (e) => {
  if (e.target.closest('.menu-list a, .menu-list button, .menu-list label')) $menu.open = false;
});
document.addEventListener('click', (e) => {
  if ($menu.open && !$menu.contains(e.target)) $menu.open = false;
});

// Version installée, et mise à jour disponible si GitHub en annonce une.
let versionInfo = null;
function renderVersion() {
  if (!versionInfo) return;
  const { version, latest, upToDate, url } = versionInfo;
  const [text, kind] =
    upToDate === true
      ? [t('v{version} · à jour', { version }), 'ok']
      : upToDate === false
        ? [t('v{version} · v{latest} disponible', { version, latest }), 'warn']
        : [`v${version}`, ''];
  for (const node of document.querySelectorAll('[data-version]')) {
    node.textContent = text;
    node.dataset.kind = kind;
    node.href = url;
    node.title = upToDate === false ? t('Voir les nouveautés de la version {latest}', { latest }) : '';
    node.hidden = false;
  }
}

setupControls({
  onLang: () => {
    render();
    setStatus(...lastStatus);
    document.title = dirty ? `• ${pageTitle()}` : pageTitle();
    renderVersion();
  }
});
document.title = pageTitle();

try {
  content = await api('/content');
  render();
  setStatus('Tout est enregistré', 'ok');
} catch (err) {
  setStatus('Chargement impossible : {message}', 'error', { message: t(err.message) });
}
api('/version')
  .then((info) => {
    versionInfo = info;
    renderVersion();
  })
  .catch(() => {
    /* version non affichée */
  });
