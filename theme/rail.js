/* ═══════════════════════════════════════════════════════════════════════════
   La colonne de navigation — pages statiques
   ═══════════════════════════════════════════════════════════════════════════
   Les trois applications servies comme une page HTML unique (MC CCTP,
   myCatalogue, MC SONAR) n'ont pas de rendu serveur pour la dessiner. Elles la
   construisent donc ici, à partir de `api/apps` — une route de MÊME ORIGINE,
   servie par l'application elle-même sous son propre chemin. Aucun appel au
   portail, aucun CORS à ouvrir : c'est l'effet secondaire agréable de
   l'origine unique.

   L'échec est silencieux, et c'est voulu : une colonne de navigation absente
   n'empêche pas de travailler, alors qu'une erreur bloquante, si.

   Usage — une seule ligne dans la page, avant la fermeture du corps :
       <script src="rail.js" data-app="cctp"></script>
   Le script pose lui-même le `<nav class="rail">` en tête du corps et ajoute
   `has-rail` à l'élément qu'on lui désigne par `data-decaler` (`body` à défaut).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var script = document.currentScript;
  var moi = (script && script.dataset.app) || '';
  var cible = document.querySelector((script && script.dataset.decaler) || 'body');

  var MAISON =
    '<svg class="rail-icone" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M3 10.2 12 3l9 7.2M5.5 8.8V20h13V8.8" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /** « MC SONAR » → « SONAR », « myCatalogue » → « myCatalogue ». */
  function court(nom) {
    return String(nom || '').replace(/^MC\s+/i, '');
  }
  /** Les deux lettres de la pastille, quand l'application n'a pas d'icône. */
  function marque(nom) {
    var c = court(nom).replace(/[^A-Za-zÀ-ÿ]/g, '');
    return c.slice(0, 2).toUpperCase();
  }
  function echapper(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var nav = document.createElement('nav');
  nav.className = 'rail';
  nav.setAttribute('aria-label', 'Navigation de la plateforme');
  nav.innerHTML =
    '<a class="rail-btn rail-home" href="/portail" title="myATC — toutes vos applications">' +
    MAISON + '<span class="rail-label">myATC</span></a>';
  document.body.insertBefore(nav, document.body.firstChild);
  if (cible) cible.classList.add('has-rail');

  fetch('api/apps', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.apps || !d.apps.length) return;

      var sep = document.createElement('span');
      sep.className = 'rail-sep';
      sep.setAttribute('role', 'presentation');
      nav.appendChild(sep);

      d.apps.forEach(function (app) {
        var a = document.createElement('a');
        a.className = 'rail-btn' + (app.slug === moi ? ' is-current' : '');
        a.href = app.url;
        a.title = app.name;
        if (app.slug === moi) a.setAttribute('aria-current', 'page');
        a.innerHTML = '<span class="rail-mark">' + echapper(marque(app.name)) + '</span>' +
                      '<span class="rail-label">' + echapper(court(app.name)) + '</span>';
        nav.appendChild(a);
      });
    })
    .catch(function () { /* silence : on ne bloque pas l'outil pour une colonne */ });
})();
