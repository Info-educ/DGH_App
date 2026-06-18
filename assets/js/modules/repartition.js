/**
 * DGH App — Module Répartition de service (v4.2 — Sprint 12)
 *
 * Affecte les enseignants aux classes par discipline (classe × discipline → enseignant),
 * désigne les professeurs principaux, et alimente automatiquement :
 *   - les heures de service par discipline (recalcul dans data.js)
 *   - l'onglet Impact du pilotage (distribution des modalités sur les profs concernés)
 *
 * Deux modes de saisie (bascule au choix) :
 *   - « Par discipline » : 1 discipline → toutes les classes → 1 (ou +) prof par classe
 *   - « Par enseignant » : 1 prof → ses classes cochées par discipline
 * + grille récap classe × discipline (lecture seule) avec colonne Professeur principal.
 *
 * Règles SKILL.md : zéro addEventListener dynamique (délégation app.js),
 * zéro localStorage (DGHData.*), zéro style inline pour la typo (.font-mono).
 */

const DGHRepartition = (() => {

  const NIVEAUX_ORD = ['6e','5e','4e','3e','SEGPA','ULIS','UPE2A'];

  // ── État ──────────────────────────────────────────────────────────
  let _mode      = 'discipline'; // 'discipline' | 'enseignant' | 'rapide'
  let _selDiscId = null;
  let _selEnsId  = null;

  // ── Utilitaires ───────────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _nomEns(ens) {
    if (!ens) return '?';
    return ((ens.nom || '') + (ens.prenom ? ' ' + ens.prenom : '')).trim() || '?';
  }
  function _nomCourt(ens) {
    if (!ens) return '?';
    return ((ens.nom || '') + (ens.prenom ? ' ' + ens.prenom.charAt(0) + '.' : '')).trim() || '?';
  }
  function _ensADiscipline(ens, discNom) {
    return Array.isArray(ens.disciplines) && ens.disciplines.some(d => d.discNom === discNom);
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ══════════════════════════════════════════════════════════════════
  function renderRepartition() {
    const el = document.getElementById('repartition-zone');
    if (!el) return;
    try {
      const data        = DGHData.getAnnee();
      const divisions   = DGHData.getStructures();
      const disciplines = DGHData.getDisciplines();
      const enseignants = DGHData.getEnseignants();

      // ── Garde-fous : prérequis ────────────────────────────────────
      if (divisions.length === 0 || disciplines.length === 0 || enseignants.length === 0) {
        el.innerHTML = _htmlPrerequis(divisions.length, disciplines.length, enseignants.length);
        return;
      }

      // Sélections par défaut
      if (!_selDiscId || !disciplines.find(d => d.id === _selDiscId)) _selDiscId = disciplines[0].id;
      if (!_selEnsId  || !enseignants.find(e => e.id === _selEnsId))   _selEnsId  = enseignants[0].id;

      const affs      = DGHData.getAffectations();
      const nbCouv    = new Set(affs.map(a => a.divisionId)).size;
      const nbPP      = divisions.filter(d => d.ppEnsId).length;

      let html = ''
        + '<div class="rep-intro">Étape de mai/juin : une fois la ventilation votée et vos postes connus, '
        + 'placez les enseignants sur les classes. Les heures de service et le pilotage se recalculent automatiquement. '
        + 'Cette étape est facultative — les scénarios fonctionnent sans elle.</div>'
        + '<div class="rep-kpis">'
          + _kpi(affs.length, 'affectations')
          + _kpi(nbCouv + ' / ' + divisions.length, 'classes avec au moins une affectation')
          + _kpi(nbPP + ' / ' + divisions.length, 'professeurs principaux désignés')
        + '</div>'
        + '<div class="rep-mode-toggle">'
          + '<button class="rep-mode-btn' + (_mode==='discipline'?' active':'') + '" data-action="rep-mode" data-mode="discipline">Par discipline</button>'
          + '<button class="rep-mode-btn' + (_mode==='enseignant'?' active':'') + '" data-action="rep-mode" data-mode="enseignant">Par enseignant</button>'
          + '<button class="rep-mode-btn rep-mode-btn-rapide' + (_mode==='rapide'?' active':'') + '" data-action="rep-mode" data-mode="rapide" title="Tableau enseignants × classes">&#9889; Saisie rapide</button>'
        + '</div>'
        + '<div class="rep-saisie">' + (_mode==='discipline'
            ? _htmlSaisieDiscipline(divisions, disciplines, enseignants)
            : _mode==='rapide'
              ? _htmlSaisieRapide(divisions, disciplines, enseignants)
              : _htmlSaisieEnseignant(divisions, disciplines, enseignants)) + '</div>'
        + _htmlGrille(data, divisions, disciplines, enseignants)
        + _htmlControles(data);

      el.innerHTML = html;
    } catch (e) {
      console.error('[DGHRepartition] renderRepartition:', e);
      el.innerHTML = '<div class="rep-error">Une erreur est survenue lors de l\'affichage de la répartition.</div>';
    }
  }

  function _kpi(val, lbl) {
    return '<div class="rep-kpi"><span class="rep-kpi-val font-mono">' + val + '</span>'
      + '<span class="rep-kpi-lbl">' + lbl + '</span></div>';
  }

  function _htmlPrerequis(nbDiv, nbDisc, nbEns) {
    const manque = [];
    if (nbDiv === 0)  manque.push('<li>vos <strong>divisions</strong> (module Structures)</li>');
    if (nbDisc === 0) manque.push('<li>vos <strong>disciplines</strong> (module Dotation DGH)</li>');
    if (nbEns === 0)  manque.push('<li>votre <strong>équipe enseignante</strong> (module Équipe pédagogique)</li>');
    return '<div class="rep-empty"><div class="rep-empty-icon">◉</div>'
      + '<p>Pour répartir les services, renseignez d\'abord :</p>'
      + '<ul class="rep-empty-list">' + manque.join('') + '</ul></div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // SAISIE — PAR DISCIPLINE
  // ══════════════════════════════════════════════════════════════════
  function _htmlSaisieDiscipline(divisions, disciplines, enseignants) {
    const disc = disciplines.find(d => d.id === _selDiscId) || disciplines[0];

    const discOpts = disciplines.map(d =>
      '<option value="' + d.id + '"' + (d.id === disc.id ? ' selected' : '') + '>' + _esc(d.nom) + '</option>'
    ).join('');

    // Classes groupées par niveau
    const parNiv = {};
    divisions.forEach(div => { (parNiv[div.niveau] = parNiv[div.niveau] || []).push(div); });

    const blocs = NIVEAUX_ORD.filter(n => parNiv[n] && parNiv[n].length).map(niv => {
      const rows = parNiv[niv].map(div => _htmlLigneClasseDisc(div, disc, enseignants)).join('');
      return '<div class="rep-niv-bloc"><div class="rep-niv-label"><span class="niveau-badge niveau-'
        + niv.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + niv + '</span></div>' + rows + '</div>';
    }).join('');

    return '<div class="rep-saisie-head">'
        + '<label class="rep-select-lbl">Discipline :</label>'
        + '<select class="rep-disc-select" id="repDiscSelect" data-action="rep-sel-disc">' + discOpts + '</select>'
        + '<span class="rep-saisie-hint">Choisissez l\'enseignant de chaque classe. Les heures se pré-remplissent depuis la grille MEN — ajustez si besoin.</span>'
      + '</div>'
      + '<div class="rep-classes-list">' + blocs + '</div>';
  }

  function _htmlLigneClasseDisc(div, disc, enseignants) {
    const cell  = DGHData.getAffectationsCell(div.id, disc.id);
    const hMEN  = Calculs.heuresGrille(div.niveau, disc.nom);
    const tags  = cell.map(a => _htmlAffTag(a, enseignants)).join('');
    const somme = Math.round(cell.reduce((s,a)=>s+(a.heures||0),0)*2)/2;
    const ecart = hMEN > 0 ? Math.round((somme - hMEN)*2)/2 : null;
    const ecartCls = ecart === null ? '' : ecart === 0 ? 'rep-ok' : ecart > 0 ? 'rep-sur' : 'rep-sous';
    const ecartTxt = hMEN > 0
      ? '<span class="rep-cell-grille font-mono ' + ecartCls + '">' + somme + ' / ' + hMEN + ' h</span>'
      : (somme > 0 ? '<span class="rep-cell-grille font-mono">' + somme + ' h</span>' : '');

    return '<div class="rep-classe-row">'
      + '<span class="rep-classe-nom">' + _esc(div.nom) + '</span>'
      + '<div class="rep-classe-affs">' + (tags || '<span class="rep-cell-vide">—</span>') + '</div>'
      + ecartTxt
      + '<select class="rep-add-select" data-action="rep-add" data-division-id="' + div.id + '" data-discipline-id="' + disc.id + '">'
        + _optsAjoutEns(enseignants, disc.nom)
      + '</select>'
    + '</div>';
  }

  function _htmlAffTag(a, enseignants) {
    const ens = enseignants.find(e => e.id === a.ensId);
    return '<span class="rep-aff-tag">'
      + '<span class="rep-aff-nom">' + _esc(_nomCourt(ens)) + '</span>'
      + '<input class="rep-aff-h font-mono" type="number" min="0" max="40" step="0.5" value="' + (a.heures||0) + '" '
        + 'data-action="rep-aff-h" data-id="' + a.id + '" title="Heures de cet enseignant sur cette classe" />'
      + '<span class="rep-aff-hsuffix">h</span>'
      + '<button class="rep-aff-x" data-action="rep-del-aff" data-id="' + a.id + '" title="Retirer">✕</button>'
    + '</span>';
  }

  function _optsAjoutEns(enseignants, discNom) {
    const dela = enseignants.filter(e => _ensADiscipline(e, discNom));
    const autres = enseignants.filter(e => !_ensADiscipline(e, discNom));
    let html = '<option value="">+ Ajouter…</option>';
    if (dela.length) {
      html += '<optgroup label="Enseignants de ' + _esc(discNom) + '">'
        + dela.map(e => '<option value="' + e.id + '">' + _esc(_nomEns(e)) + '</option>').join('')
        + '</optgroup>';
    }
    if (autres.length) {
      html += '<optgroup label="Autres enseignants">'
        + autres.map(e => '<option value="' + e.id + '">' + _esc(_nomEns(e)) + '</option>').join('')
        + '</optgroup>';
    }
    return html;
  }

  // ══════════════════════════════════════════════════════════════════
  // SAISIE — PAR ENSEIGNANT
  // ══════════════════════════════════════════════════════════════════
  function _htmlSaisieEnseignant(divisions, disciplines, enseignants) {
    const ens = enseignants.find(e => e.id === _selEnsId) || enseignants[0];

    const ensOpts = enseignants.map(e =>
      '<option value="' + e.id + '"' + (e.id === ens.id ? ' selected' : '') + '>' + _esc(_nomEns(e)) + '</option>'
    ).join('');

    // Disciplines déjà portées par l'enseignant
    const discsEns = (Array.isArray(ens.disciplines) ? ens.disciplines : [])
      .map(d => disciplines.find(x => x.nom === d.discNom)).filter(Boolean);

    // Disciplines qu'on peut ajouter à cet enseignant
    const ajoutables = disciplines.filter(d => !discsEns.find(x => x.id === d.id));
    const ajoutOpts = '<option value="">+ Ajouter une discipline à cet enseignant…</option>'
      + ajoutables.map(d => '<option value="' + d.id + '">' + _esc(d.nom) + '</option>').join('');

    let blocs;
    if (discsEns.length === 0) {
      blocs = '<p class="rep-saisie-hint">Cet enseignant n\'a aucune discipline. Ajoutez-en une ci-dessous pour lui affecter des classes.</p>';
    } else {
      blocs = discsEns.map(disc => _htmlBlocDiscEns(ens, disc, divisions)).join('');
    }

    return '<div class="rep-saisie-head">'
        + '<label class="rep-select-lbl">Enseignant :</label>'
        + '<select class="rep-ens-select" id="repEnsSelect" data-action="rep-sel-ens">' + ensOpts + '</select>'
        + (ajoutables.length
            ? '<select class="rep-addisc-select" data-action="rep-add-disc-ens" data-ens-id="' + ens.id + '">' + ajoutOpts + '</select>'
            : '')
      + '</div>'
      + '<div class="rep-ens-blocs">' + blocs + '</div>';
  }

  function _htmlBlocDiscEns(ens, disc, divisions) {
    const parNiv = {};
    divisions.forEach(div => { (parNiv[div.niveau] = parNiv[div.niveau] || []).push(div); });
    const lignes = NIVEAUX_ORD.filter(n => parNiv[n] && parNiv[n].length).map(niv => {
      const items = parNiv[niv].map(div => {
        const cell    = DGHData.getAffectationsCell(div.id, disc.id);
        const mienne  = cell.find(a => a.ensId === ens.id);
        const checked = !!mienne;
        const partage = cell.length > 0 && !checked;
        return '<label class="rep-ens-classe' + (checked?' checked':'') + (partage?' rep-ens-partage':'') + '">'
          + '<input type="checkbox" class="rep-ens-classe-chk" data-action="rep-toggle-ens-classe" '
            + 'data-ens-id="' + ens.id + '" data-division-id="' + div.id + '" data-discipline-id="' + disc.id + '"'
            + (checked?' checked':'') + '>'
          + '<span class="rep-ens-classe-nom">' + _esc(div.nom) + '</span>'
          + (checked
              ? '<input class="rep-aff-h font-mono" type="number" min="0" max="40" step="0.5" value="' + (mienne.heures||0) + '" '
                + 'data-action="rep-aff-h" data-id="' + mienne.id + '" /><span class="rep-aff-hsuffix">h</span>'
              : (partage ? '<span class="rep-ens-deja" title="Déjà affectée à un autre enseignant">partagée</span>' : ''))
        + '</label>';
      }).join('');
      return '<div class="rep-niv-bloc"><div class="rep-niv-label"><span class="niveau-badge niveau-'
        + niv.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + niv + '</span></div>'
        + '<div class="rep-ens-classes">' + items + '</div></div>';
    }).join('');

    return '<div class="rep-ens-disc-bloc">'
      + '<div class="rep-ens-disc-head"><span class="rep-ens-disc-color" style="background:' + (disc.couleur||'#6b6860') + '"></span>'
        + '<span class="rep-ens-disc-nom">' + _esc(disc.nom) + '</span></div>'
      + lignes
    + '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // SAISIE RAPIDE — matrice discipline × classe × enseignant
  // ══════════════════════════════════════════════════════════════════
  /**
   * Affiche un tableau croisé :
   *   lignes = enseignants de la discipline sélectionnée
   *   colonnes = toutes les divisions (groupées par niveau)
   *   cellule = checkbox cochée si l'enseignant est affecté à cette classe pour cette discipline
   * Permet de tout saisir en une seule vue sans navigation.
   */
  function _htmlSaisieRapide(divisions, disciplines, enseignants) {
    const disc = disciplines.find(d => d.id === _selDiscId) || disciplines[0];

    const discOpts = disciplines.map(d =>
      '<option value="' + d.id + '"' + (d.id === disc.id ? ' selected' : '') + '>' + _esc(d.nom) + '</option>'
    ).join('');

    // Enseignants ayant cette discipline (priorité) + les autres en fin
    const ensDisc   = enseignants.filter(e => _ensADiscipline(e, disc.nom));
    const ensAutres = enseignants.filter(e => !_ensADiscipline(e, disc.nom));
    const ensListe  = [...ensDisc, ...ensAutres];

    if (ensListe.length === 0) {
      return '<div class="rep-saisie-head">'
        + '<label class="rep-select-lbl">Discipline :</label>'
        + '<select class="rep-disc-select" id="repDiscSelectRapide" data-action="rep-sel-disc">' + discOpts + '</select>'
        + '</div>'
        + '<p class="rep-saisie-hint">Aucun enseignant trouvé. Ajoutez des enseignants dans le module Équipe pédagogique.</p>';
    }

    // Colonnes : divisions triées par niveau
    const parNiv = {};
    divisions.forEach(div => { (parNiv[div.niveau] = parNiv[div.niveau] || []).push(div); });
    const nivsOrd = NIVEAUX_ORD.filter(n => parNiv[n] && parNiv[n].length);
    const allDivs = nivsOrd.flatMap(n => parNiv[n]);

    // En-tête niveau (colspan par niveau)
    const thNivGroups = nivsOrd.map(n =>
      '<th colspan="' + parNiv[n].length + '" class="rep-rapid-th-niv">'
        + '<span class="niveau-badge niveau-' + n.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + n + '</span>'
      + '</th>'
    ).join('');

    // En-tête classe
    const thClasses = allDivs.map(div =>
      '<th class="rep-rapid-th-cls">' + _esc(div.nom) + '</th>'
    ).join('');

    // Compteur "cocher tout" par classe (en-tête)
    const thTout = allDivs.map(div =>
      '<th class="rep-rapid-th-tout">'
        + '<button class="rep-rapid-tout-btn" data-action="rep-rapid-tout-col"'
          + ' data-division-id="' + div.id + '" data-discipline-id="' + disc.id
          + '" title="Cocher/décocher tous les profs de cette discipline pour ' + _esc(div.nom) + '">⬜ tous</button>'
      + '</th>'
    ).join('');

    // Lignes enseignants
    const rows = ensListe.map(ens => {
      const isDisc = _ensADiscipline(ens, disc.nom);
      const cells = allDivs.map(div => {
        const cell    = DGHData.getAffectationsCell(div.id, disc.id);
        const mienne  = cell.find(a => a.ensId === ens.id);
        const checked = !!mienne;
        const partage = !checked && cell.length > 0;
        return '<td class="rep-rapid-cell' + (partage ? ' rep-rapid-partage' : '') + '">'
          + '<label class="rep-rapid-chk-lbl" title="' + _esc(div.nom) + (partage ? ' — partagée' : '') + '">'
            + '<input type="checkbox" class="rep-rapid-chk" data-action="rep-toggle-ens-classe"'
              + ' data-ens-id="' + ens.id + '"'
              + ' data-division-id="' + div.id + '"'
              + ' data-discipline-id="' + disc.id + '"'
              + (checked ? ' checked' : '') + '>'
            + (checked && mienne
                ? '<span class="rep-rapid-h font-mono">' + (mienne.heures||0) + 'h</span>'
                : '')
          + '</label>'
        + '</td>';
      }).join('');

      // Barre latérale : nb classes affectées
      const nbAff = allDivs.filter(div => DGHData.getAffectationsCell(div.id, disc.id).some(a => a.ensId === ens.id)).length;

      return '<tr class="rep-rapid-tr' + (!isDisc ? ' rep-rapid-tr-autre' : '') + '">'
        + '<td class="rep-rapid-td-ens">'
          + (isDisc
              ? '<span class="rep-rapid-dot" style="background:' + _esc(disc.couleur||'#6b6860') + '"></span>'
              : '<span class="rep-rapid-dot-autre" title="Discipline différente">?</span>')
          + '<span class="rep-rapid-ens-nom">' + _esc(_nomEns(ens)) + '</span>'
          + (nbAff > 0 ? '<span class="rep-rapid-nbcls font-mono">' + nbAff + ' cl.</span>' : '')
        + '</td>'
        + cells
      + '</tr>';
    }).join('');

    return '<div class="rep-saisie-head">'
        + '<label class="rep-select-lbl">Discipline :</label>'
        + '<select class="rep-disc-select" id="repDiscSelectRapide" data-action="rep-sel-disc">' + discOpts + '</select>'
        + '<span class="rep-saisie-hint rep-rapid-hint">Cochez les classes de chaque enseignant. '
          + 'Les heures se calculent automatiquement depuis la grille MEN — ajustez-les ensuite en mode « Par enseignant ».</span>'
      + '</div>'
      + '<div class="rep-rapid-wrap">'
        + '<table class="rep-rapid-table">'
          + '<thead>'
            + '<tr class="rep-rapid-tr-niv"><th class="rep-rapid-td-ens rep-rapid-th-corner">Enseignant</th>' + thNivGroups + '</tr>'
            + '<tr class="rep-rapid-tr-cls"><th class="rep-rapid-td-ens"></th>' + thClasses + '</tr>'
          + '</thead>'
          + '<tbody>' + rows + '</tbody>'
        + '</table>'
      + '</div>'
      + '<p class="rep-saisie-hint rep-rapid-legend">'
        + '<span class="rep-rapid-dot" style="background:#6b6860;display:inline-block;vertical-align:middle"></span> = enseigne cette discipline  &nbsp;|&nbsp;  '
        + '<span class="rep-rapid-dot-autre" style="display:inline-block;vertical-align:middle">?</span> = autre discipline (affectation possible mais inhabituelle)'
      + '</p>';
  }

  // ══════════════════════════════════════════════════════════════════
  // GRILLE RÉCAP classe × discipline (+ professeur principal)
  // ══════════════════════════════════════════════════════════════════
  function _htmlGrille(data, divisions, disciplines, enseignants) {
    const g = Calculs.grilleRepartition(data);
    // Disciplines affichées : celles ayant au moins une affectation
    const discActives = disciplines.filter(d =>
      divisions.some(div => g.cells[div.id] && g.cells[div.id][d.id] && g.cells[div.id][d.id].length)
    );

    if (discActives.length === 0) {
      return '<div class="rep-grille-wrap"><h2 class="rep-section-title">Grille récapitulative</h2>'
        + '<p class="rep-saisie-hint">La grille classe × discipline apparaîtra ici dès vos premières affectations.</p></div>';
    }

    const ensById = {}; enseignants.forEach(e => { ensById[e.id] = e; });

    let head = '<tr><th class="rep-grille-cls">Classe</th>'
      + discActives.map(d => '<th class="rep-grille-disc"><span class="rep-grille-disc-dot" style="background:'
          + (d.couleur||'#6b6860') + '"></span>' + _esc(d.nom) + '</th>').join('')
      + '<th class="rep-grille-pp">Prof. principal</th></tr>';

    let body = divisions.map(div => {
      // discipline(s) dont le PP est responsable dans cette classe
      const ppDiscIds = div.ppEnsId
        ? new Set((data.affectations||[]).filter(a => a.divisionId === div.id && a.ensId === div.ppEnsId).map(a => a.disciplineId))
        : new Set();

      const cells = discActives.map(d => {
        const list = (g.cells[div.id] && g.cells[div.id][d.id]) || [];
        if (list.length === 0) return '<td class="rep-grille-cell rep-grille-empty">·</td>';
        const resp = ppDiscIds.has(d.id);
        const inner = list.map(x =>
          '<span class="rep-grille-ens">' + _esc(x.nom) + '<span class="rep-grille-h font-mono">' + x.heures + 'h</span></span>'
        ).join('');
        return '<td class="rep-grille-cell' + (resp ? ' rep-grille-resp' : '') + '">'
          + (resp ? '<span class="rep-grille-star" title="Professeur principal — responsable sur sa discipline">★</span>' : '')
          + inner + '</td>';
      }).join('');

      // Sélecteur PP : enseignants affectés à cette classe
      const ensClasse = Array.from(new Set((data.affectations||[]).filter(a => a.divisionId === div.id).map(a => a.ensId)));
      const ppOpts = '<option value="">— Aucun —</option>'
        + ensClasse.map(eid => {
            const e = ensById[eid];
            return '<option value="' + eid + '"' + (div.ppEnsId === eid ? ' selected' : '') + '>' + _esc(_nomEns(e)) + '</option>';
          }).join('');

      return '<tr>'
        + '<td class="rep-grille-cls"><span class="niveau-badge niveau-' + div.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">'
          + _esc(div.niveau) + '</span> <strong>' + _esc(div.nom) + '</strong></td>'
        + cells
        + '<td class="rep-grille-pp"><select class="rep-pp-select" data-action="rep-set-pp" data-division-id="' + div.id + '"'
          + (ensClasse.length === 0 ? ' disabled title="Affectez d\'abord des enseignants à cette classe"' : '') + '>'
          + ppOpts + '</select></td>'
      + '</tr>';
    }).join('');

    return '<div class="rep-grille-wrap"><h2 class="rep-section-title">Grille récapitulative '
      + '<span class="rep-section-sub">classe × discipline · ★ = professeur principal responsable</span></h2>'
      + '<div class="rep-grille-scroll"><table class="rep-grille-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
    + '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // CONTRÔLES de cohérence
  // ══════════════════════════════════════════════════════════════════
  function _htmlControles(data) {
    const ctrl = Calculs.controlesRepartition(data);
    if (ctrl.length === 0) return '';
    const warns = ctrl.filter(c => c.severite === 'warning');
    const infos = ctrl.filter(c => c.severite !== 'warning');
    const item = c => '<li class="rep-ctrl-item rep-ctrl-' + c.severite + '">' + _esc(c.message) + '</li>';
    return '<div class="rep-controles"><h2 class="rep-section-title">Contrôles de cohérence '
      + '<span class="rep-section-sub">' + warns.length + ' alerte(s) · ' + infos.length + ' info(s)</span></h2>'
      + '<ul class="rep-ctrl-list">' + warns.map(item).join('') + infos.slice(0, 20).map(item).join('') + '</ul>'
      + (infos.length > 20 ? '<p class="rep-saisie-hint">… et ' + (infos.length - 20) + ' autre(s) information(s).</p>' : '')
    + '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTIONS (appelées via délégation app.js)
  // ══════════════════════════════════════════════════════════════════
  function setMode(mode)        { _mode = (mode === 'enseignant' ? 'enseignant' : mode === 'rapide' ? 'rapide' : 'discipline'); renderRepartition(); }
  function selectDiscipline(el) { _selDiscId = el.value; renderRepartition(); }
  function selectEnseignant(el) { _selEnsId  = el.value; renderRepartition(); }

  function addFromSelect(el) {
    const ensId = el.value;
    if (!ensId) return;
    const divisionId   = el.dataset.divisionId;
    const disciplineId = el.dataset.disciplineId;
    const div  = DGHData.getDivision(divisionId);
    const disc = DGHData.getDiscipline(disciplineId);
    if (!div || !disc) return;
    // Éviter le doublon strict (même prof déjà sur ce couple)
    const deja = DGHData.getAffectationsCell(divisionId, disciplineId).some(a => a.ensId === ensId);
    if (deja) { app.toast('Cet enseignant est déjà affecté à cette classe pour cette discipline.', 'warning'); return; }
    let h = Calculs.heuresGrille(div.niveau, disc.nom);
    if (h <= 0) h = 1;
    DGHData.addAffectation({ divisionId, disciplineId, ensId, heures: h });
    renderRepartition();
  }

  function toggleEnsClasse(el) {
    const ensId        = el.dataset.ensId;
    const divisionId   = el.dataset.divisionId;
    const disciplineId = el.dataset.disciplineId;
    const div  = DGHData.getDivision(divisionId);
    const disc = DGHData.getDiscipline(disciplineId);
    if (!div || !disc) return;
    if (el.checked) {
      let h = Calculs.heuresGrille(div.niveau, disc.nom);
      if (h <= 0) h = 1;
      DGHData.addAffectation({ divisionId, disciplineId, ensId, heures: h });
    } else {
      DGHData.getAffectationsCell(divisionId, disciplineId)
        .filter(a => a.ensId === ensId)
        .forEach(a => DGHData.deleteAffectation(a.id));
    }
    renderRepartition();
  }

  function setHeures(el) {
    const id = el.dataset.id;
    const h  = parseFloat(el.value);
    DGHData.updateAffectation(id, { heures: isNaN(h) ? 0 : h });
    renderRepartition();
  }

  function deleteAff(id) {
    DGHData.deleteAffectation(id);
    renderRepartition();
  }

  function addDiscToEns(el) {
    const discId = el.value;
    const ensId  = el.dataset.ensId;
    if (!discId || !ensId) return;
    const ens  = DGHData.getEnseignant(ensId);
    const disc = DGHData.getDiscipline(discId);
    if (!ens || !disc) return;
    const discs = (Array.isArray(ens.disciplines) ? ens.disciplines.slice() : []);
    if (!discs.find(d => d.discNom === disc.nom)) discs.push({ discNom: disc.nom, heures: 0 });
    DGHData.updateEnseignant(ensId, { disciplines: discs });
    renderRepartition();
  }

  /**
   * Bascule TOUS les enseignants de la discipline courante sur une classe donnée.
   * Si tous sont déjà cochés → décocher. Sinon → cocher ceux qui manquent.
   */
  function toutColonne(btn) {
    const divisionId   = btn.dataset.divisionId;
    const disciplineId = btn.dataset.disciplineId;
    const div  = DGHData.getDivision(divisionId);
    const disc = DGHData.getDiscipline(disciplineId);
    if (!div || !disc) return;

    const enseignants = DGHData.getEnseignants();
    const ensDisc = enseignants.filter(e => _ensADiscipline(e, disc.nom));
    if (ensDisc.length === 0) return;

    const cell = DGHData.getAffectationsCell(divisionId, disciplineId);
    const tousCoches = ensDisc.every(e => cell.some(a => a.ensId === e.id));

    if (tousCoches) {
      // Tout décocher
      cell.filter(a => ensDisc.some(e => e.id === a.ensId)).forEach(a => DGHData.deleteAffectation(a.id));
    } else {
      // Cocher ceux qui manquent
      ensDisc.forEach(ens => {
        if (!cell.some(a => a.ensId === ens.id)) {
          let h = Calculs.heuresGrille(div.niveau, disc.nom);
          if (h <= 0) h = 1;
          DGHData.addAffectation({ divisionId, disciplineId, ensId: ens.id, heures: h });
        }
      });
    }
    renderRepartition();
  }

  function setPP(el) {
    const divisionId = el.dataset.divisionId;
    DGHData.setProfesseurPrincipal(divisionId, el.value || null);
    renderRepartition();
  }

  return {
    renderRepartition,
    setMode, selectDiscipline, selectEnseignant,
    addFromSelect, toggleEnsClasse, setHeures, deleteAff, addDiscToEns, setPP, toutColonne
  };

})();
