/**
 * DGH App — Aide contextuelle embarquée (DGHTutorial)
 * Module 100% autonome : zéro dépendance, zéro CDN, vanilla JS.
 *
 * RESPONSABILITÉ : accompagnement utilisateur uniquement.
 *   - écran de bienvenue (1er lancement)
 *   - pop-ups contextuelles par onglet (1re visite)
 *   - visite guidée pas à pas (spotlight)
 *   - aide situationnelle (erreur de sauvegarde)
 *   - bouton « ? » permanent + panneau de réglages d'aide
 *
 * STOCKAGE : une seule clé localStorage 'dgh-tutorial', UI uniquement.
 *   → ZÉRO donnée personnelle. Même statut que le thème (exception SKILL.md).
 *   Forme : { v, enabled, welcomeDone, tourDone, seen:{ viewId:true } }
 *
 * INTÉGRATION : tutorial.js attache UNE seule délégation de clic sur son
 *   propre arbre DOM (attribut data-help-action) — aucun onclick inline,
 *   aucune modification de app.js. La vue active est observée passivement
 *   (MutationObserver), la navigation réutilise app.navigate().
 */
const DGHTutorial = (() => {
  'use strict';

  const LSKEY        = 'dgh-tutorial';
  const CONTENT_VER  = 1; // incrémenter pour reproposer l'aide après refonte du contenu

  // ════════════════════════════════════════════════════════════════
  // CONTENU — déclaratif. Pour ajouter l'aide d'un futur onglet :
  // ajouter une entrée { quoi, pourquoi, neFaitPas, siBloque }. Rien d'autre.
  // Règle de rédaction : ton direct, non technique, phrases courtes, ≤ 5 lignes.
  // ════════════════════════════════════════════════════════════════
  const HELP = {
    dashboard: {
      titre: 'Tableau de bord',
      quoi: "Votre vue d'ensemble : dotation, solde, alertes. Tout se lit ici.",
      pourquoi: "Pour voir en un coup d'œil où vous en êtes avant le CA.",
      neFaitPas: "Rien ne se saisit ici : c'est un résumé des autres onglets.",
      siBloque: "Tout est vide ? Cliquez « Saisir les structures » pour démarrer."
    },
    structures: {
      titre: 'Structures',
      quoi: "Déclarez vos classes, par niveau (6e, 5e…). Le socle de l'outil.",
      pourquoi: "Sans classes, l'outil ne peut rien ventiler ni calculer.",
      neFaitPas: "Ne gère pas les emplois du temps : ça reste dans Index Éducation.",
      siBloque: "Commencez simple : un niveau, une classe. Vous compléterez après."
    },
    dotation: {
      titre: 'Dotation DGH',
      quoi: "Saisissez l'enveloppe notifiée par la DSDEN (HP et HSA).",
      pourquoi: "C'est le total que vous répartissez. Votre vrai point de départ.",
      neFaitPas: "Ne calcule pas vos droits théoriques : on part de votre notification.",
      siBloque: "Pas encore reçue ? Mettez une estimation, vous l'ajusterez plus tard."
    },
    hpc: {
      titre: 'Heures pédagogiques complémentaires',
      quoi: "Décrivez les heures hors cours standard : options, dédoublements, chorale…",
      pourquoi: "Elles consomment de la dotation : il faut les compter pour voir le solde.",
      neFaitPas: "Ne crée pas les cours : ça reste de la prévision d'heures.",
      siBloque: "Vous ajouterez ou modifierez à tout moment. Rien n'est définitif."
    },
    scenarios: {
      titre: 'Scénarios',
      quoi: "Testez des hypothèses (dédoublements, projets) sans toucher au réel.",
      pourquoi: "Pour comparer plusieurs répartitions avant de décider.",
      neFaitPas: "Ne modifie rien tant qu'un scénario n'est pas activé.",
      siBloque: "Créez un scénario, dépliez-le (▼), saisissez dans la grille. Supprimable."
    },
    historique: {
      titre: 'Historique',
      quoi: "Comparez l'année en cours avec l'année précédente (N / N-1).",
      pourquoi: "Pour justifier les évolutions en dialogue de gestion.",
      neFaitPas: "Ne change pas vos données : c'est de la lecture comparée.",
      siBloque: "Rien à comparer ? Il faut une année figée. Revenez-y plus tard."
    },
    alertes: {
      titre: 'Alertes',
      quoi: "La liste des incohérences détectées (dépassements, oublis…).",
      pourquoi: "Pour corriger avant de présenter au CA.",
      neFaitPas: "Ne corrige pas à votre place : elle pointe, vous décidez.",
      siBloque: "Aucune alerte ? Tout est cohérent, vous pouvez avancer."
    },
    instances: {
      titre: 'Préparer les instances',
      quoi: "Générez les documents prêts à imprimer : Synthèse CA, Dialogue, Services.",
      pourquoi: "Pour présenter des supports propres, sans refaire de mise en forme.",
      neFaitPas: "Ne transmet rien : vous imprimez ou projetez vous-même.",
      siBloque: "Document vide ? Vérifiez que dotation et structures sont saisies."
    },
    enseignants: {
      titre: 'Équipe pédagogique',
      quoi: "Listez vos enseignants, leur grade et leurs heures par discipline.",
      pourquoi: "Pour suivre les services et repérer sous-services et HSA.",
      neFaitPas: "Ne fait pas l'emploi du temps ni la paie.",
      siBloque: "Une cellule passe en « auto » ? Elle est pilotée par la Répartition."
    },
    repartition: {
      titre: 'Répartition de service',
      quoi: "Affectez chaque classe × discipline à un enseignant.",
      pourquoi: "Pour construire les services réels (souvent en mai-juin).",
      neFaitPas: "Étape facultative : les scénarios de février marchent sans elle.",
      siBloque: "Trop tôt dans l'année ? Passez : ce n'est jamais un prérequis."
    },
    missions: {
      titre: 'PACTE / IMP',
      quoi: "Recensez les missions hors enveloppe DGH (PACTE, IMP).",
      pourquoi: "Pour garder une vue complète du temps des enseignants.",
      neFaitPas: "Ne se déduit pas de la DGH : c'est une enveloppe à part.",
      siBloque: "Cliquez « Ajouter une mission » pour commencer. Rien d'obligatoire."
    },
    edt: {
      titre: 'Contraintes EDT',
      quoi: "Notez barrettes et co-interventions à transmettre pour l'emploi du temps.",
      pourquoi: "Pour préparer le travail dans Index Éducation.",
      neFaitPas: "Ne fabrique pas l'emploi du temps : c'est un mémo de contraintes.",
      siBloque: "Optionnel : remplissez seulement si vous en avez besoin."
    }
  };

  // Aide situationnelle (déclenchée par événement, pas par navigation)
  const SITU = {
    'storage-error': {
      titre: 'Sauvegarde impossible',
      quoi: "L'espace du navigateur est plein ou bloqué. Vos saisies récentes risquent de ne pas être conservées.",
      pourquoi: "Exporter votre fichier maintenant met vos données à l'abri, hors du navigateur.",
      neFaitPas: "Rien n'est encore perdu : la sauvegarde locale a juste échoué.",
      siBloque: "Cliquez « Exporter maintenant », puis fermez d'autres onglets ou videz un peu d'espace.",
      action: { label: 'Exporter maintenant', do: () => document.getElementById('btnExport')?.click() }
    }
  };

  // Visite guidée — cibles statiques (toujours présentes) → jamais de blocage.
  const TOUR = [
    { sel: '.logo-mark',                         titre: 'Bienvenue',              text: "Voici votre espace de pilotage de la DGH. Suivons le parcours en 7 étapes." },
    { sel: '.nav-item[data-view="structures"]',  titre: '1 · Structures',         text: "D'abord, déclarez vos classes. C'est le socle de tout le reste." },
    { sel: '.nav-item[data-view="dotation"]',    titre: '2 · Dotation DGH',       text: "Saisissez l'enveloppe d'heures notifiée par la DSDEN." },
    { sel: '.nav-item[data-view="hpc"]',         titre: '3 · Heures complément.', text: "Comptez options, dédoublements, chorale… Elles pèsent sur le solde." },
    { sel: '.nav-item[data-view="scenarios"]',   titre: '4 · Scénarios',          text: "Testez des hypothèses sans jamais toucher à vos données réelles." },
    { sel: '.nav-item[data-view="instances"]',   titre: '5 · Instances',          text: "Générez vos documents prêts à imprimer pour le CA." },
    { sel: '#btnExport',                         titre: '6 · Sauvegarder',        text: "Exportez régulièrement : ce fichier est votre seule vraie sauvegarde." },
    { sel: '.dgh-help-fab',                      titre: "7 · L'aide, à volonté",  text: "Ce bouton « ? » rouvre l'aide et la visite à tout moment." }
  ];

  // ════════════════════════════════════════════════════════════════
  // PRÉFÉRENCES (localStorage — UI uniquement, zéro donnée perso)
  // ════════════════════════════════════════════════════════════════
  function _defaults() { return { v: CONTENT_VER, enabled: true, welcomeDone: false, tourDone: false, seen: {} }; }

  function _load() {
    try {
      const raw = localStorage.getItem(LSKEY);
      if (!raw) return _defaults();
      const p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return _defaults();
      if (p.v !== CONTENT_VER) { const d = _defaults(); d.enabled = p.enabled !== false; return d; }
      return Object.assign(_defaults(), p);
    } catch (e) { return _defaults(); }
  }

  function _save() {
    try { localStorage.setItem(LSKEY, JSON.stringify(_prefs)); } catch (e) { /* aide non vitale : on ignore */ }
  }

  let _prefs = _defaults();

  // ════════════════════════════════════════════════════════════════
  // ÉTAT DOM
  // ════════════════════════════════════════════════════════════════
  let _root = null;       // conteneur racine de l'aide
  let _layer = null;      // overlay courant (pop-up / welcome / panel)
  let _tourIdx = -1;      // index étape visite (-1 = inactive)
  let _onTourReposition = null;

  function _isOpen() { return !!(_layer && _layer.firstChild); }
  function _tourActive() { return _tourIdx >= 0; }

  // ════════════════════════════════════════════════════════════════
  // CONSTRUCTION RACINE
  // ════════════════════════════════════════════════════════════════
  function _build() {
    _root = document.createElement('div');
    _root.id = 'dgh-help-root';
    _root.innerHTML =
      '<button class="dgh-help-fab" data-help-action="open-panel" aria-label="Aide" title="Aide">?</button>' +
      '<div class="dgh-help-layer" id="dgh-help-layer" aria-live="polite"></div>';
    document.body.appendChild(_root);
    _layer = _root.querySelector('#dgh-help-layer');

    // UNE seule délégation de clic, scoping data-help-action (pas data-action)
    _root.addEventListener('click', _onClick);
    document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (_tourActive()) _endTour(); else if (_isOpen()) _close(); });
  }

  function _onClick(e) {
    const el = e.target.closest('[data-help-action]');
    if (!el) return;
    const a = el.dataset.helpAction;
    switch (a) {
      case 'open-panel':  _togglePanel(); break;
      case 'close':       _close(); break;
      case 'compris':     _markSeen(el.dataset.view); _close(); break;
      case 'mute':        _prefs.enabled = false; _save(); _close(); break;
      case 'situ-action': { const k = el.dataset.situ; SITU[k] && SITU[k].action && SITU[k].action.do(); _close(); break; }
      case 'help-current': _close(); _showView(_currentView(), true); break;
      case 'tour':        _close(); startTour(); break;
      case 'welcome':     _close(); _showWelcome(true); break;
      case 'reset-seen':  _prefs.seen = {}; _save(); _flash(el, 'Aides réactivées'); break;
      case 'toggle-enabled': _prefs.enabled = !_prefs.enabled; _save(); _renderPanel(); break;
      case 'welcome-tour':  _prefs.welcomeDone = true; _save(); _close(); startTour(); break;
      case 'welcome-skip':  _prefs.welcomeDone = true; _save(); _close(); _showView(_currentView(), true); break;
      case 'tour-next':   _tourStep(_tourIdx + 1); break;
      case 'tour-prev':   _tourStep(_tourIdx - 1); break;
      case 'tour-end':    _endTour(); break;
    }
  }

  function _flash(btn, msg) {
    const old = btn.textContent; btn.textContent = msg;
    setTimeout(() => { btn.textContent = old; }, 1400);
  }

  // ════════════════════════════════════════════════════════════════
  // POP-UP CONTEXTUELLE
  // ════════════════════════════════════════════════════════════════
  function _popHTML(c, opts) {
    opts = opts || {};
    const view = opts.view || '';
    const danger = opts.danger ? ' dgh-help-pop--danger' : '';
    let foot;
    if (opts.situ) {
      const act = c.action ? '<button class="btn-primary dgh-help-btn" data-help-action="situ-action" data-situ="' + opts.situ + '">' + c.action.label + '</button>' : '';
      foot = '<button class="btn-secondary dgh-help-btn" data-help-action="close">Fermer</button>' + act;
    } else {
      foot = '<button class="dgh-help-mute" data-help-action="mute">Ne plus afficher les aides</button>' +
             '<button class="btn-primary dgh-help-btn" data-help-action="compris" data-view="' + view + '">Compris</button>';
    }
    return (
      '<div class="dgh-help-pop-overlay" data-help-overlay="' + (opts.situ ? 'noop' : 'close') + '">' +
        '<div class="dgh-help-pop' + danger + '" role="dialog" aria-modal="true" aria-label="' + c.titre + '">' +
          '<div class="dgh-help-pop-head"><span class="dgh-help-pop-title">' + c.titre + '</span>' +
            '<button class="dgh-help-x" data-help-action="close" aria-label="Fermer">×</button></div>' +
          '<div class="dgh-help-pop-body">' +
            '<p class="dgh-help-row"><span class="dgh-help-tag dgh-tag-do">À faire</span>'      + c.quoi      + '</p>' +
            '<p class="dgh-help-row"><span class="dgh-help-tag dgh-tag-why">Pourquoi</span>'    + c.pourquoi  + '</p>' +
            '<p class="dgh-help-row"><span class="dgh-help-tag dgh-tag-not">Pas pour</span>'    + c.neFaitPas + '</p>' +
            '<p class="dgh-help-row"><span class="dgh-help-tag dgh-tag-stuck">Si ça bloque</span>' + c.siBloque + '</p>' +
          '</div>' +
          '<div class="dgh-help-pop-foot">' + foot + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _render(html) {
    _layer.innerHTML = html;
    // clic sur le FOND de l'overlay (cible exacte) = fermer, sauf 'noop'
    const ov = _layer.querySelector('[data-help-overlay]');
    if (ov) ov.addEventListener('click', (e) => { if (e.target === ov && ov.dataset.helpOverlay !== 'noop') _close(); });
  }

  function _close() { _layer.innerHTML = ''; }

  function _markSeen(view) { if (!view) return; _prefs.seen[view] = true; _save(); }

  // ════════════════════════════════════════════════════════════════
  // BIENVENUE
  // ════════════════════════════════════════════════════════════════
  function _showWelcome() {
    _render(
      '<div class="dgh-help-welcome-overlay" data-help-overlay="noop">' +
        '<div class="dgh-help-welcome" role="dialog" aria-modal="true" aria-label="Bienvenue">' +
          '<div class="dgh-help-welcome-badge">DGH</div>' +
          '<h2 class="dgh-help-welcome-title">Bienvenue dans DGH App</h2>' +
          '<p class="dgh-help-welcome-lead">Cet outil vous aide à <strong>ventiler votre DGH</strong> : de l\'enveloppe notifiée par la DSDEN jusqu\'à la synthèse pour le CA.</p>' +
          '<ul class="dgh-help-welcome-points">' +
            '<li><span class="dgh-help-dot">●</span> Vos données restent <strong>sur cet appareil</strong>. Rien n\'est envoyé sur Internet (RGPD respecté).</li>' +
            '<li><span class="dgh-help-dot">●</span> <strong>Règle d\'or :</strong> exportez votre fichier régulièrement — c\'est votre seule sauvegarde.</li>' +
          '</ul>' +
          '<div class="dgh-help-welcome-actions">' +
            '<button class="btn-primary dgh-help-btn" data-help-action="welcome-tour">Visite guidée · 2 min</button>' +
            '<button class="btn-secondary dgh-help-btn" data-help-action="welcome-skip">Explorer seul</button>' +
          '</div>' +
          '<p class="dgh-help-welcome-foot">Vous pourrez relancer l\'aide à tout moment via le bouton <strong>?</strong> en bas à droite.</p>' +
        '</div>' +
      '</div>'
    );
  }

  // ════════════════════════════════════════════════════════════════
  // PANNEAU « ? » (réglages d'aide = paramètres)
  // ════════════════════════════════════════════════════════════════
  function _togglePanel() { if (_layer.querySelector('.dgh-help-panel')) { _close(); } else { _renderPanel(); } }

  function _renderPanel() {
    const on = _prefs.enabled;
    _render(
      '<div class="dgh-help-panel-overlay" data-help-overlay="close">' +
        '<div class="dgh-help-panel" role="dialog" aria-modal="true" aria-label="Aide">' +
          '<div class="dgh-help-pop-head"><span class="dgh-help-pop-title">Aide &amp; visite guidée</span>' +
            '<button class="dgh-help-x" data-help-action="close" aria-label="Fermer">×</button></div>' +
          '<div class="dgh-help-panel-body">' +
            '<button class="dgh-help-menu" data-help-action="help-current"><span>Aide de cette page</span><span class="dgh-help-menu-ic">›</span></button>' +
            '<button class="dgh-help-menu" data-help-action="tour"><span>Relancer la visite guidée</span><span class="dgh-help-menu-ic">›</span></button>' +
            '<button class="dgh-help-menu" data-help-action="welcome"><span>Revoir l\'écran de bienvenue</span><span class="dgh-help-menu-ic">›</span></button>' +
            '<button class="dgh-help-menu" data-help-action="reset-seen"><span>Réafficher toutes les aides</span><span class="dgh-help-menu-ic">↺</span></button>' +
            '<div class="dgh-help-toggle-row">' +
              '<span>Aides automatiques</span>' +
              '<button class="dgh-help-switch' + (on ? ' is-on' : '') + '" data-help-action="toggle-enabled" role="switch" aria-checked="' + on + '"><span class="dgh-help-knob"></span></button>' +
            '</div>' +
          '</div>' +
          '<p class="dgh-help-panel-foot">Vos préférences d\'aide restent sur cet appareil. Aucune donnée personnelle.</p>' +
        '</div>' +
      '</div>'
    );
  }

  // ════════════════════════════════════════════════════════════════
  // VISITE GUIDÉE (spotlight)
  // ════════════════════════════════════════════════════════════════
  function startTour() { _close(); _tourStep(0); }

  function _tourStep(i) {
    if (i < 0) i = 0;
    if (i >= TOUR.length) { _endTour(); return; }
    _tourIdx = i;
    const step = TOUR[i];
    const target = document.querySelector(step.sel);
    // cible absente → on saute l'étape (jamais de blocage)
    if (!target) { _tourStep(i + 1); return; }

    const last = (i === TOUR.length - 1);
    const r = target.getBoundingClientRect();
    _layer.innerHTML =
      '<div class="dgh-tour-dim"></div>' +
      '<div class="dgh-tour-spot"></div>' +
      '<div class="dgh-tour-card" role="dialog" aria-modal="true" aria-label="' + step.titre + '">' +
        '<div class="dgh-tour-step">Étape ' + (i + 1) + ' / ' + TOUR.length + '</div>' +
        '<div class="dgh-tour-title">' + step.titre + '</div>' +
        '<p class="dgh-tour-text">' + step.text + '</p>' +
        '<div class="dgh-tour-nav">' +
          '<button class="dgh-help-mute" data-help-action="tour-end">Passer</button>' +
          '<div class="dgh-tour-nav-r">' +
            (i > 0 ? '<button class="btn-secondary dgh-help-btn" data-help-action="tour-prev">Précédent</button>' : '') +
            '<button class="btn-primary dgh-help-btn" data-help-action="' + (last ? 'tour-end' : 'tour-next') + '">' + (last ? 'Terminer' : 'Suivant') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    _positionTour(target);

    if (!_onTourReposition) {
      _onTourReposition = () => { if (_tourActive()) { const t = document.querySelector(TOUR[_tourIdx].sel); if (t) _positionTour(t); } };
      window.addEventListener('resize', _onTourReposition);
      window.addEventListener('scroll', _onTourReposition, true);
    }
  }

  function _positionTour(target) {
    const spot = _layer.querySelector('.dgh-tour-spot');
    const card = _layer.querySelector('.dgh-tour-card');
    if (!spot || !card) return;
    const r = target.getBoundingClientRect();
    const pad = 6;
    spot.style.left   = (r.left - pad) + 'px';
    spot.style.top    = (r.top - pad) + 'px';
    spot.style.width  = (r.width + pad * 2) + 'px';
    spot.style.height = (r.height + pad * 2) + 'px';

    const cw = card.offsetWidth || 320, ch = card.offsetHeight || 160;
    const vw = window.innerWidth, vh = window.innerHeight, gap = 14;
    let left, top;
    if (r.right + gap + cw <= vw) { left = r.right + gap; top = r.top; }      // à droite
    else if (r.left - gap - cw >= 0) { left = r.left - gap - cw; top = r.top; } // à gauche
    else { left = Math.max(gap, (vw - cw) / 2); top = r.bottom + gap; }         // dessous
    left = Math.min(Math.max(gap, left), vw - cw - gap);
    top  = Math.min(Math.max(gap, top),  vh - ch - gap);
    card.style.left = left + 'px';
    card.style.top  = top + 'px';
  }

  function _endTour() {
    _tourIdx = -1;
    _prefs.tourDone = true; _save();
    if (_onTourReposition) {
      window.removeEventListener('resize', _onTourReposition);
      window.removeEventListener('scroll', _onTourReposition, true);
      _onTourReposition = null;
    }
    _close();
  }

  // ════════════════════════════════════════════════════════════════
  // DÉCLENCHEURS
  // ════════════════════════════════════════════════════════════════
  function _currentView() {
    const v = document.querySelector('.view.active');
    if (!v) return 'dashboard';
    let id = v.id.replace(/^view-/, '');
    if (id === 'pilotage') id = 'scenarios'; // alias
    return id;
  }

  // showView : affiche la pop-up d'un onglet. auto=true → respecte « vu » + activé.
  function _showView(view, auto) {
    if (!HELP[view]) return;
    if (auto) {
      if (!_prefs.enabled) return;
      if (_prefs.seen[view]) return;
      if (_isOpen() || _tourActive()) return;
      _markSeen(view); // 1re visite consommée
    }
    _render(_popHTML(HELP[view], { view: view }));
  }

  function _watchViews() {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.attributeName === 'class' && m.target.classList && m.target.classList.contains('active') && m.target.classList.contains('view')) {
          // léger délai : laisse app.js finir le rendu de la vue
          setTimeout(() => { if (!_isOpen() && !_tourActive() && _prefs.welcomeDone) _showView(_currentView(), true); }, 120);
          break;
        }
      }
    });
    document.querySelectorAll('.view').forEach(v => obs.observe(v, { attributes: true, attributeFilter: ['class'] }));
  }

  function _watchSituations() {
    // data.js émet déjà cet événement quand localStorage.setItem échoue.
    document.addEventListener('dgh:storage-error', () => {
      _close(); _tourIdx = -1;
      _render(_popHTML(SITU['storage-error'], { situ: 'storage-error', danger: true }));
    });
  }

  // ════════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════════
  function init() {
    _prefs = _load();
    _build();
    _watchViews();
    _watchSituations();
    // 1er lancement
    if (!_prefs.welcomeDone) {
      _showWelcome();
    } else if (_prefs.enabled) {
      // reprise : proposer l'aide de la vue active (manquée par l'observer au boot)
      setTimeout(() => { if (!_isOpen() && !_tourActive()) _showView(_currentView(), true); }, 200);
    }
  }

  // API publique
  return { init, startTour, showView: (v) => _showView(v, false), openPanel: _togglePanel };
})();

// app.js (chargé avant) a déjà enregistré son DOMContentLoaded → app.init()
// s'exécute en premier. Ici l'app est prête (données chargées, vue rendue).
document.addEventListener('DOMContentLoaded', () => DGHTutorial.init());
