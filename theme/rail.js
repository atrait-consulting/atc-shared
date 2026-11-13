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
   `has-rail` à l'élément qu'on lui désigne par `data-decaler` (`body` à défaut),
   puis la version de l'outil en pied (`api/version`).
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
  /* ── Les icônes des applications ───────────────────────────────────────
     Un dessin par application, repris du portail (mc-hub, AppIcone) pour
     que les deux se ressemblent. Les deux lettres ne suffisaient pas :
     myCatalogue, myProjet et my.Admin donnaient toutes les trois « MY ».
     Une application absente de cette table retombe sur son monogramme,
     donc en ajouter une ne casse rien. */
  var ICONES = {
    'catalogue': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
    'cctp': '<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M14 3.5V8h4M9 12h6M9 15.5h6M9 19h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
    'crm': '<circle cx="9" cy="8.5" r="3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M15.5 6.2a3 3 0 0 1 0 4.6M17.2 14.2a5 5 0 0 1 3.3 4.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
    'noptik': '<rect x="3.5" y="4" width="7" height="6" rx="1.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <rect x="13.5" y="14" width="7" height="6" rx="1.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M10.5 7h3a2 2 0 0 1 2 2v3M13.5 17h-3a2 2 0 0 1-2-2v-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
    'outil-abbak': '<rect x="3.5" y="4.5" width="17" height="11" rx="1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M8 20h8M12 15.5V20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M8.5 10c1-1.6 2.2-2.4 3.5-2.4s2.5.8 3.5 2.4c-1 1.6-2.2 2.4-3.5 2.4S9.5 11.6 8.5 10z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <circle cx="12" cy="10" r=".9" fill="currentColor" />',
    'outil-abbak-cable': '<path d="M3.5 17c2.5 0 2.5-10 5-10s2.5 10 5 10 2.5-10 5-10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <circle cx="18.5" cy="17" r="3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M17.2 17h2.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
    'parapheur': '<path d="M9.5 10.5V7a2.5 2.5 0 0 1 5 0v3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M5 14.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V17H5v-2.5z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M7 20.5h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
    'projet': '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M8 12.5h8M8 15.5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
    'rh': '<path d="M4.5 7.5a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-12a1.5 1.5 0 0 1-1.5-1.5v-11z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M4.5 10.5h15M8.5 4.5v4M15.5 4.5v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M9 14.8l2.1 2.1 4-4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
    'sonar': '<path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /> <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.5a8 8 0 0 1 0 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />',
  };

  /** Les deux lettres de la pastille, quand l'application n'a pas d'icône. */
  function marque(nom) {
    var c = court(nom).replace(/[^A-Za-zÀ-ÿ]/g, '');
    return c.slice(0, 2).toUpperCase();
  }
  /** L'icône d'une application, ou son monogramme à défaut. */
  function pastille(app) {
    var d = ICONES[app.slug];
    return d
      ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' + d + '</svg>'
      : echapper(marque(app.name));
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
  /* Le pavé. Il n'apparaît que sur téléphone (rail.css) : fermée, la barre
     du bas n'y montre que la maison et l'application ouverte ; ouverte, elle
     montre toutes les applications avec leurs noms complets.

     Posé ICI, avant la liste, pour deux raisons. Il doit exister même si
     `api/apps` ne répond pas — un pavé qui n'ouvre rien vaut mieux qu'un
     bouton qui apparaît trois secondes après la page. Et `rail.css` le place
     par `margin-left: auto`, donc sa position ne dépend pas de son rang. */
  var pave = document.createElement('button');
  pave.type = 'button';
  pave.className = 'rail-pave';
  pave.setAttribute('aria-expanded', 'false');
  pave.setAttribute('aria-label', 'Toutes les applications');
  pave.innerHTML = '<span class="rail-pave-barres" aria-hidden="true"><i></i><i></i><i></i></span>';
  pave.addEventListener('click', function () {
    var ouvert = nav.classList.toggle('est-ouvert');
    pave.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    pave.setAttribute('aria-label', ouvert ? 'Fermer la liste des applications' : 'Toutes les applications');
  });
  nav.appendChild(pave);

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
        a.innerHTML = '<span class="rail-mark">' + pastille(app) + '</span>' +
                      '<span class="rail-label">' + echapper(court(app.name)) + '</span>';
        nav.appendChild(a);
      });
    })
    .catch(function () { /* silence : on ne bloque pas l'outil pour une colonne */ });

  /* La version déployée, en pied de colonne : le commit (`api/version`, même
     origine) et, devant, une pastille qui dit s'il est la dernière version de
     `main` sur GitHub (`/api/versions/github`, servie par le portail sur la
     même origine). Même règle de silence : sans réponse, rien ne s'affiche. */
  var ETATS = {
    a_jour:     ['est-a-jour', 'À jour : c\'est la dernière version de main sur GitHub'],
    en_retard:  ['est-en-retard', 'Pas la dernière version'],
    diverge:    ['est-en-retard', 'Pas la dernière version'],
    non_pousse: ['est-non-pousse', 'Déployé, pas encore poussé sur GitHub']
  };
  fetch('api/version', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (v) {
      if (!v || !v.version) return;
      var quand = v.construit ? new Date(v.construit) : null;
      var date = quand && !isNaN(quand);
      var jour = date ? quand.toLocaleDateString('fr-FR',
        { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' }) : '';
      var a = document.createElement('a');
      a.className = 'rail-version';
      a.href = '/versions';
      a.innerHTML = '<span class="rail-version-etat" aria-hidden="true"></span>' +
        echapper(v.commit || ('v' + v.version)) + (jour ? '<br>' + echapper(jour) : '');
      var titre = [
        'Déployé : ' + (v.commit || 'commit inconnu') + ' (version ' + v.version + ')',
        date ? 'Construit le ' + quand.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '',
        v.contenu || ''
      ];
      a.title = titre.concat('Toutes les versions : cliquer').filter(Boolean).join('\n');
      nav.appendChild(a);

      if (!v.commit || !moi) return;
      fetch('/api/versions/github?app=' + encodeURIComponent(moi) + '&commit=' + encodeURIComponent(v.commit),
            { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (g) {
          var e = g && ETATS[g.etat];
          if (!e) return;
          a.querySelector('.rail-version-etat').classList.add(e[0]);
          var detail = e[1];
          if (g.retard) detail += ' : ' + g.retard + ' commit' + (g.retard > 1 ? 's' : '') + ' sur main pas encore déployé' + (g.retard > 1 ? 's' : '');
          if (g.dernier) detail += '\nDernier sur main : ' + g.dernier.commit + ' · ' + g.dernier.message;
          a.title = titre.concat(detail, 'Toutes les versions : cliquer').filter(Boolean).join('\n');
        })
        .catch(function () { /* silence */ });
    })
    .catch(function () { /* silence */ });
})();
