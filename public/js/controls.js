// Sélecteur FR / EN et bouton clair / sombre, communs à l'administration et à la connexion.
// Le thème est le même que celui du site public (clé « theme », posé tôt par theme.js).
import { currentLang, setLang, t, translatePage } from './i18n.js';

export function setupControls({ onLang } = {}) {
  const root = document.documentElement;
  const toggles = document.querySelectorAll('[data-theme-toggle]');

  const updateThemeButtons = () => {
    const label = t(root.dataset.theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre');
    for (const button of toggles) {
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  };

  for (const button of toggles) {
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch {
        /* le choix vaut pour cette visite */
      }
    });
  }
  new MutationObserver(updateThemeButtons).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  for (const button of document.querySelectorAll('[data-lang]')) {
    button.addEventListener('click', () => {
      if (button.dataset.lang === currentLang()) return;
      setLang(button.dataset.lang);
      translatePage();
      updateThemeButtons();
      onLang?.();
    });
  }

  translatePage();
  updateThemeButtons();
}
