// Thème clair / sombre : le choix mémorisé, sinon celui du système.
// Chargé dans <head> (sans defer) pour que la page s'affiche directement dans le bon thème.
(function () {
  var root = document.documentElement;
  var media = matchMedia('(prefers-color-scheme: dark)');
  function stored() {
    try {
      return localStorage.getItem('theme');
    } catch (e) {
      return null;
    }
  }
  root.dataset.theme = stored() || (media.matches ? 'dark' : 'light');
  // Si aucun choix n'a été fait, on suit les changements du système.
  media.addEventListener('change', function (e) {
    if (!stored()) root.dataset.theme = e.matches ? 'dark' : 'light';
  });
})();
