// Menu latéral : met en valeur la section visible pendant le défilement.
// Si deux sections se trouvent côte à côte, elles peuvent être actives ensemble.

const links = (selector) =>
  [...document.querySelectorAll(selector)]
    .map((a) => ({
      a,
      li: a.parentElement,
      top: document.querySelector(`.topnav a[href="${a.hash}"]`),
      section: document.getElementById(a.hash.slice(1))
    }))
    .filter((it) => it.section);

const items = links('.sidenav > ol > li > a[href^="#"]');
// Sous-menu : un lien par grand projet.
const subs = links('.sn-sub a[href^="#"]');

function updateSubs(line) {
  subs.forEach((it) => {
    const r = it.section.getBoundingClientRect();
    const on = r.top <= line && r.bottom > line;
    it.li.classList.toggle('is-active', on);
    it.li.classList.toggle('is-passed', r.top <= line);
    if (on) it.a.setAttribute('aria-current', 'true');
    else it.a.removeAttribute('aria-current');
  });
}

function update() {
  const line = innerHeight * 0.4;
  const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
  updateSubs(line);
  const active = [];
  if (atBottom) {
    active.push(items.length - 1);
  } else {
    items.forEach((it, i) => {
      const r = it.section.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) active.push(i);
    });
  }
  // Entre deux sections (marges), on garde l'état précédent.
  if (!active.length) return;
  const last = Math.max(...active);
  items.forEach((it, i) => {
    const on = active.includes(i);
    it.li.classList.toggle('is-active', on);
    it.li.classList.toggle('is-passed', i <= last);
    it.top?.classList.toggle('is-active', on);
    if (on) it.a.setAttribute('aria-current', 'true');
    else it.a.removeAttribute('aria-current');
  });
}

let ticking = false;
addEventListener(
  'scroll',
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      update();
    });
  },
  { passive: true }
);
addEventListener('resize', update);
update();

// Animation au clic : onde sur le point, puis la section « arrive » une fois le défilement fini.
function replay(el, cls, ms) {
  el.classList.remove(cls);
  void el.offsetWidth; // relance l'animation même si on reclique sur le même lien
  el.classList.add(cls);
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove(cls), ms);
}

// Défilement animé vers une section : départ doux, accélération, arrivée en douceur.
// Fait en JS pour être identique partout (le défilement « smooth » du navigateur
// est coupé quand le système demande de réduire les animations).
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
let scrollAnim = null;

function stopScroll() {
  if (!scrollAnim) return;
  cancelAnimationFrame(scrollAnim.frame);
  scrollAnim = null;
}

function scrollToSection(section, onDone) {
  stopScroll();
  const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  const from = scrollY;
  const to = Math.max(0, Math.min(max, section.getBoundingClientRect().top + scrollY - margin));
  const distance = to - from;
  if (Math.abs(distance) < 2) return onDone();
  // De 0,45 s pour un petit saut à 1,1 s pour toute la page.
  const duration = Math.min(1100, 450 + Math.abs(distance) * 0.12);
  const start = performance.now();
  const anim = { frame: 0 };
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    scrollTo({ top: from + distance * ease(t), behavior: 'instant' });
    if (t < 1) anim.frame = requestAnimationFrame(step);
    else {
      scrollAnim = null;
      onDone();
    }
  };
  scrollAnim = anim;
  anim.frame = requestAnimationFrame(step);
}

// Si on reprend la main (molette, doigt, clavier), l'animation s'arrête.
['wheel', 'touchstart', 'keydown'].forEach((type) => addEventListener(type, stopScroll, { passive: true }));

// Bouton clair / sombre (le thème de départ est posé par theme.js dans <head>).
const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
  const root = document.documentElement;
  const label = () => {
    // Libellés fournis par la page, dans la langue du site.
    const text = root.dataset.theme === 'dark' ? themeToggle.dataset.toLight : themeToggle.dataset.toDark;
    themeToggle.setAttribute('aria-label', text);
    themeToggle.title = text;
  };
  label();
  new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  themeToggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite */
    }
  });
}

// Bouton Partager : le menu du téléphone (toutes ses applis) quand le navigateur le propose,
// sinon le menu du site (WhatsApp, Telegram, SMS, e-mail, réseaux, copie du lien).
// Le menu du téléphone n'existe qu'en HTTPS.
const shareBtn = document.querySelector('.share-btn');
const sheet = document.querySelector('.share-sheet');
if (shareBtn && sheet) {
  // Même adresse que celle des liens du menu, calculée par le serveur.
  const url = document.querySelector('link[rel="canonical"]')?.href || location.origin + location.pathname;
  const title = document.title;
  const description = document.querySelector('meta[name="description"]')?.content || '';

  // Le presse-papiers moderne n'existe qu'en HTTPS : on garde l'ancienne méthode en secours.
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const field = Object.assign(document.createElement('textarea'), { value: text });
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;opacity:0';
      document.body.append(field);
      field.select();
      const ok = document.execCommand('copy');
      field.remove();
      return ok;
    }
  };
  const copyButton = sheet.querySelector('[data-share="copy"]');
  const copyLabel = copyButton.querySelector('.copy-label');
  const copyText = copyLabel.textContent;
  copyButton.addEventListener('click', async () => {
    if (!(await copy(url))) return prompt(copyButton.dataset.prompt, url);
    copyLabel.textContent = copyButton.dataset.copied;
    setTimeout(() => {
      sheet.close();
      copyLabel.textContent = copyText;
    }, 900);
  });
  sheet.querySelector('.share-close').addEventListener('click', () => sheet.close());
  // Un clic sur le fond assombri ferme le menu.
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });
  sheet.querySelectorAll('a[data-share]').forEach((a) => a.addEventListener('click', () => sheet.close()));

  shareBtn.hidden = false;
  shareBtn.addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // partage annulé par la personne
      }
    }
    sheet.showModal();
  });
}

// Bouton e-mail : l'adresse est stockée inversée et en base64 (voir hideEmail côté serveur).
document.querySelectorAll('[data-mail]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const bytes = Uint8Array.from(atob(btn.dataset.mail), (ch) => ch.charCodeAt(0));
    const address = [...new TextDecoder().decode(bytes)].reverse().join('');
    location.href = `mailto:${address}`;
  });
});

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  const section = a && a.hash.length > 1 && document.getElementById(a.hash.slice(1));
  if (!section || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  if (a.closest('.sidenav')) replay(a.parentElement, 'is-pinged', 700);
  history.pushState(null, '', a.hash);
  scrollToSection(section, () => replay(section, 'is-arrived', 1300));
});
