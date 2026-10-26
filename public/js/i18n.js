// Langue de l'administration (français ou anglais). Le texte français sert de clé :
// t('Projets') renvoie « Projects » en anglais, et le texte tel quel en français.
// Les variables s'écrivent {nom} : t('Échec : {message}', { message }).

const EN = {
  // Barre du haut, menu, page de connexion
  'Folichon · administration': 'Folichon · admin',
  Connexion: 'Sign in',
  'Voir le site ↗': 'View site ↗',
  "Plus d'actions": 'More actions',
  'Exporter le contenu': 'Export content',
  'Importer un fichier…': 'Import a file…',
  'Se déconnecter': 'Sign out',
  Enregistrer: 'Save',
  'Enregistrer (Ctrl + S)': 'Save (Ctrl + S)',
  'Chargement…': 'Loading…',
  Langue: 'Language',
  'Passer en mode sombre': 'Switch to dark mode',
  'Passer en mode clair': 'Switch to light mode',
  Sections: 'Sections',
  Administration: 'Admin',
  'Entre ton mot de passe pour modifier le contenu de ta page.': 'Enter your password to edit your page.',
  'Mot de passe': 'Password',
  Continuer: 'Continue',
  'Première connexion : active la double authentification. Elle sera demandée à chaque connexion.':
    'First sign-in: turn on two-factor authentication. It will be asked at every sign-in.',
  "Ouvre ton application d'authentification (Google Authenticator, Aegis, 2FAS, Bitwarden…) et ajoute un compte.":
    'Open your authenticator app (Google Authenticator, Aegis, 2FAS, Bitwarden…) and add an account.',
  'Scanne ce QR code :': 'Scan this QR code:',
  'Impossible de scanner ? Saisis la clé à la main': 'Can’t scan it? Type the key instead',
  'Type : basé sur le temps · 6 chiffres · 30 secondes': 'Type: time-based · 6 digits · 30 seconds',
  "Entre le code à 6 chiffres affiché par l'application pour confirmer.":
    'Enter the 6-digit code shown by the app to confirm.',
  "Entre le code à 6 chiffres affiché par ton application d'authentification.":
    'Enter the 6-digit code shown by your authenticator app.',
  'Code à 6 chiffres': '6-digit code',
  'Activer et se connecter': 'Turn on and sign in',
  'Se connecter': 'Sign in',
  '← Recommencer': '← Start over',

  // Messages du serveur
  'Mot de passe incorrect.': 'Wrong password.',
  'Trop de tentatives. Réessaie dans 15 minutes.': 'Too many attempts. Try again in 15 minutes.',
  'Code incorrect ou expiré.': 'Wrong or expired code.',
  'Ce code vient déjà de servir : attends le suivant (30 secondes au plus).':
    'This code was just used: wait for the next one (30 seconds at most).',
  'Session expirée, reconnecte-toi.': 'Session expired, sign in again.',
  'Origine refusée.': 'Origin refused.',
  'Requête invalide.': 'Invalid request.',
  'Erreur interne du serveur.': 'Internal server error.',
  'Le contenu doit être un objet JSON.': 'The content must be a JSON object.',
  'Le contenu a été modifié ailleurs depuis le chargement de cette page.':
    'The content was changed elsewhere since this page was loaded.',
  'Fichier trop lourd (15 Mo max).': 'File too large (15 MB max).',
  'Formats acceptés : PNG, JPG, WebP, GIF, AVIF ou PDF.': 'Accepted formats: PNG, JPG, WebP, GIF, AVIF or PDF.',
  'Le contenu du fichier ne correspond pas à son type (fichier abîmé ou renommé ?).':
    'The file content does not match its type (damaged or renamed file?).',

  // État et actions de l'éditeur
  'Tout est enregistré': 'All changes saved',
  'Modifications non enregistrées': 'Unsaved changes',
  'Enregistrement…': 'Saving…',
  'Enregistré ✓ — la page publique est à jour': 'Saved ✓ — the public page is up to date',
  'Enregistré, mais tu as modifié entre-temps : enregistre encore': 'Saved, but you edited in the meantime: save again',
  'Une version plus récente existe (autre onglet ?) : exporte tes modifications si besoin, puis recharge la page.':
    'A newer version exists (another tab?): export your changes if needed, then reload the page.',
  'Échec : {message}': 'Failed: {message}',
  'Session expirée : recharge la page pour te reconnecter.': 'Session expired: reload the page to sign in again.',
  'Non connecté': 'Not signed in',
  'Erreur {status}': 'Error {status}',
  'Chargement impossible : {message}': 'Could not load: {message}',
  'Envoi du fichier…': 'Uploading…',
  'Fichier envoyé — pense à enregistrer': 'File uploaded — remember to save',
  'Fichier invalide': 'Invalid file',
  'Fichier importé — vérifie puis enregistre': 'File imported — check it, then save',
  'Import impossible : {message}': 'Import failed: {message}',
  Retirer: 'Remove',
  'Envoyer un fichier': 'Upload a file',
  'Envoyer une image': 'Upload an image',
  '/uploads/mon-cv.pdf ou https://…': '/uploads/my-cv.pdf or https://…',
  '/uploads/… ou https://…': '/uploads/… or https://…',
  '{label} (sélecteur)': '{label} (picker)',
  'Élément {n}': 'Item {n}',
  'Image {n}': 'Image {n}',
  Monter: 'Move up',
  Descendre: 'Move down',
  Supprimer: 'Delete',
  '« {name} » supprimé': '“{name}” deleted',
  Élément: 'Item',
  Annuler: 'Undo',
  '+ Ajouter {what}': '+ Add {what}',
  'un élément': 'an item',
  'Champ inconnu : {kind}': 'Unknown field: {kind}',
  'v{version} · à jour': 'v{version} · up to date',
  'v{version} · v{latest} disponible': 'v{version} · v{latest} available',
  'Voir les nouveautés de la version {latest}': 'See what’s new in version {latest}',

  // Sections et champs
  'Haut de page': 'Top of page',
  Projets: 'Projects',
  'Mini projets': 'Small projects',
  Parcours: 'Experience',
  Compétences: 'Skills',
  'Contact & pied de page': 'Contact & footer',
  'Couleurs du bloc': 'Block colours',
  Fond: 'Background',
  Titres: 'Headings',
  Texte: 'Text',
  Accroche: 'Tagline',
  'Accent (étiquette, bouton principal)': 'Accent (tag, main button)',
  'Texte sur l’accent': 'Text on accent',
  'Bouton secondaire / pastilles': 'Secondary button / chips',
  'Réglages du site': 'Site settings',
  'Titre de l’onglet': 'Browser tab title',
  'Description (moteurs de recherche, partages)': 'Description (search engines, sharing)',
  'Couleur d’accent principale': 'Main accent colour',
  'Thème de la page': 'Page theme',
  'Change la mise en page et le style de la page publique. Le mode clair / sombre et la couleur d’accent sont conservés.':
    'Changes the layout and style of the public page. Light / dark mode and the accent colour are kept.',
  'Le thème d’origine : blocs arrondis et colorés, titres expressifs.':
    'The original theme: rounded, colourful blocks and expressive headings.',
  'Mise en page de journal : grands titres à empattements, filets, pas de blocs.':
    'Newspaper layout: large serif headings, rules, no blocks.',
  'Fenêtres de console, police à chasse fixe, curseur qui clignote.':
    'Console windows, monospace type, blinking cursor.',
  Rétro: 'Retro',
  'Fenêtres années 90 : reliefs gris, barres de titre bleues, fond vert d’eau.':
    '90s windows: grey bevels, blue title bars, teal desktop.',
  Néon: 'Neon',
  'Halos de couleur en fond et cartes en verre dépoli.': 'Glowing colour halos behind frosted-glass cards.',
  'Néo-brutalisme : gros contours, ombres franches, autocollants penchés.':
    'Neo-brutalism: thick outlines, hard shadows, tilted stickers.',
  'CV sobre': 'Plain CV',
  'Une seule colonne, comme un CV imprimé ; les captures sont masquées.':
    'A single column, like a printed CV; screenshots are hidden.',
  Menu: 'Menu',
  'Accueil (menu latéral)': 'Home (side menu)',
  Contact: 'Contact',
  Présentation: 'Introduction',
  'Petite phrase au-dessus du nom': 'Short line above the name',
  'Prénom et nom': 'First and last name',
  'Entoure des mots d’astérisques pour les colorer : *apps Android*':
    'Wrap words in asterisks to colour them: *Android apps*',
  'Texte de présentation': 'Introduction text',
  Photo: 'Photo',
  'Bouton principal': 'Main button',
  'Texte du bouton CV': 'CV button text',
  'Fichier ou lien du CV (PDF)': 'CV file or link (PDF)',
  'Vide = bouton masqué': 'Empty = button hidden',
  'Titre des réseaux': 'Social links title',
  Réseaux: 'Social links',
  Service: 'Service',
  Libellé: 'Label',
  Lien: 'Link',
  'un réseau': 'a social link',
  Site: 'Website',
  'Chiffres clés': 'Key figures',
  Nombre: 'Number',
  'Vide = couleur d’accent': 'Empty = accent colour',
  'un chiffre': 'a figure',
  'Nouveau chiffre': 'New figure',
  'En-tête de la section': 'Section header',
  Surtitre: 'Overline',
  Titre: 'Title',
  'Texte du bouton': 'Button text',
  'Lien du bouton': 'Button link',
  'Grands projets (un par ligne)': 'Projects (one per row)',
  Nom: 'Name',
  Étiquette: 'Tag',
  Description: 'Description',
  'Points forts (un par ligne)': 'Highlights (one per line)',
  'Technologies en pastilles (une par ligne, optionnel)': 'Technologies as chips (one per line, optional)',
  'Lien « Voir le code »': '“View code” link',
  'Lien « Site du projet »': '“Project site” link',
  'Côté des images': 'Image side',
  'À droite': 'Right',
  'À gauche': 'Left',
  Visuels: 'Visuals',
  'Écrans de téléphone (1 ou 2)': 'Phone screens (1 or 2)',
  'Fenêtre de navigateur': 'Browser window',
  'Grande image fondue dans le fond': 'Large image blended into the background',
  'Cadre blanc incliné autour des écrans (si les captures n’ont pas déjà de cadre)':
    'Tilted white frame around the screens (if the screenshots have no frame yet)',
  'Adresse affichée dans la fenêtre': 'Address shown in the window',
  Images: 'Images',
  'une image': 'an image',
  'un projet': 'a project',
  'Nouveau projet': 'New project',
  'Mini blocs (sur une même ligne)': 'Small blocks (on one row)',
  Technologies: 'Technologies',
  Icône: 'Icon',
  'un mini projet': 'a small project',
  Nouveau: 'New',
  'En-tête': 'Header',
  'Étapes (de la plus récente à la plus ancienne)': 'Steps (most recent first)',
  Période: 'Period',
  'Poste ou diplôme': 'Job or degree',
  'Entreprise / école · ville': 'Company / school · city',
  'Couleur du point': 'Dot colour',
  'Tâches (une par ligne, affichées en liste à puces)': 'Tasks (one per line, shown as a bulleted list)',
  'une étape': 'a step',
  'Nouvelle étape': 'New step',
  'Groupes de compétences': 'Skill groups',
  'Nom du groupe': 'Group name',
  'Fond des pastilles': 'Chip background',
  'Texte des pastilles': 'Chip text',
  'Compétences (une par ligne)': 'Skills (one per line)',
  'un groupe': 'a group',
  'Nouveau groupe': 'New group',
  Langues: 'Languages',
  'Bloc contact': 'Contact block',
  'Adresse e-mail': 'E-mail address',
  'Jamais affichée sur la page : le bouton ouvre la messagerie. Vide = bouton masqué':
    'Never shown on the page: the button opens the mail app. Empty = button hidden',
  'Texte du bouton e-mail': 'E-mail button text',
  'Par défaut : E-mail ↗': 'Default: E-mail ↗',
  Liens: 'Links',
  'un lien': 'a link',
  'Lien ↗': 'Link ↗',
  'Pied de page': 'Footer',
  Gauche: 'Left',
  Droite: 'Right',
  'Afficher « Powered by Folichon »': 'Show “Powered by Folichon”'
};

const KEY = 'folichon-lang';

export function getLang() {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* stockage indisponible */
  }
  if (saved === 'fr' || saved === 'en') return saved;
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let lang = getLang();

export function setLang(value) {
  lang = value === 'en' ? 'en' : 'fr';
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* le choix vaut pour cette visite */
  }
  document.documentElement.lang = lang;
}

export function currentLang() {
  return lang;
}

export function t(text, vars = {}) {
  const template = (lang === 'en' && EN[text]) || text;
  return String(template).replace(/\{(\w+)\}/g, (all, name) => (name in vars ? vars[name] : all));
}

// Textes fixes du HTML : data-i18n (contenu), data-i18n-title, data-i18n-label (aria-label),
// data-i18n-placeholder. Le texte français d'origine est gardé pour pouvoir changer de langue.
export function translatePage(root = document) {
  document.documentElement.lang = lang;
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.dataset.i18n ||= node.textContent.trim();
    node.textContent = t(node.dataset.i18n);
  }
  for (const [attr, name] of [
    ['i18nTitle', 'title'],
    ['i18nLabel', 'aria-label'],
    ['i18nPlaceholder', 'placeholder']
  ]) {
    for (const node of root.querySelectorAll(`[data-${attr.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`)) {
      node.setAttribute(name, t(node.dataset[attr]));
    }
  }
  for (const button of root.querySelectorAll('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  }
}
