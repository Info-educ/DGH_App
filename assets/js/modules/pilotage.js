/**
 * DGH App — Module Pilotage pédagogique v3.0.0
 *
 * 3 onglets :
 *   1. Scénarios  — tableau accordéon + modalités (dédoublement, co-ens, GER, GBI)
 *   2. Récap DGH  — tableau disciplines × niveaux (heures plancher + alloué + scénario actif)
 *   3. Synthèse   — KPIs visuels + disciplines + enseignants
 *
 * Règles SKILL.md :
 *   - Zéro addEventListener sur éléments dynamiques → délégation app.js
 *   - Zéro localStorage → DGHData.* uniquement
 *   - Zéro style inline → classes CSS
 *   - API publique via return {}
 */

const DGHPilotage = (() => {

  // ── ÉTAT ──────────────────────────────────────────────────────────
  let _tabActif    = 'scenarios'; // 'scenarios' | 'recap' | 'synthese'
  let _scenEditId  = null;        // scénario ouvert en accordéon
  let _scenRecapId = null;        // scénario affiché dans le récap (null = scénario actif)

  const TYPES_MOD = {
    'dedoublement':           { label: 'Dédoublement',                     css: 'mod-t-ded',   short: 'Déd.',    defH: 1   },
    'co-enseignement':        { label: 'Co-ens. / Co-intervention',        css: 'mod-t-coint', short: 'Co-ens.', defH: 2   },
    'groupe-effectif-reduit': { label: 'Groupe à effectif réduit',         css: 'mod-t-ger',   short: 'G.E.R.',  defH: 2   },
    'groupes-besoins':        { label: 'Groupes de besoins inter-classes', css: 'mod-t-gbi',   short: 'G.B.I.',  defH: 2   },
    'autre':                  { label: 'Autre',                            css: 'mod-t-autre', short: 'Autre',   defH: 1   },
  };

  const NIVEAUX_ORD = ['6e','5e','4e','3e','SEGPA','ULIS','UPE2A'];

  // ══════════════════════════════════════════════════════════════════
  // POINT D'ENTRÉE
  // ══════════════════════════════════════════════════════════════════
  function renderPilotage() {
    try {
      _renderHeaderActions();
      _renderBannerActif();
      if (_tabActif === 'scenarios') _renderOngletScenarios();
      if (_tabActif === 'recap')     _renderOngletRecap();
      if (_tabActif === 'impact')    _renderOngletImpact();
      if (_tabActif === 'synthese')  _renderOngletSynthese();
    } catch(e) {
      console.error('[DGHPilotage] renderPilotage:', e);
    }
  }

  // ── Bouton contextuel dans le header ──────────────────────────────
  function _renderHeaderActions() {
    const el = document.getElementById('pilotageHeaderActions');
    if (!el) return;
    if (_tabActif === 'scenarios') {
      el.innerHTML = '<button class="btn-primary" id="btnAddScenario">+ Nouveau scénario</button>';
    } else {
      el.innerHTML = '';
    }
  }

  // ── Onglets : activation ──────────────────────────────────────────
  function switchTab(tab) {
    _tabActif = tab;
    // classes CSS
    document.querySelectorAll('.pil-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.pil-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'pil-panel-' + tab);
    });
    renderPilotage();
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 1 — SCÉNARIOS
  // ══════════════════════════════════════════════════════════════════
  function _renderOngletScenarios() {
    const el = document.getElementById('scenTableauWrap');
    if (!el) return;
    const data      = DGHData.getAnnee();
    const scenarios = DGHData.getScenarios();
    const bilanRef  = Calculs.bilanDotation(data);

    // Barre de solde de référence
    const refCls  = bilanRef.depassement ? 'scen-solde-danger' : 'scen-solde-ok';
    const refSign = bilanRef.solde >= 0 ? '+' : '';
    let bandeauRef = '<div class="scen-ref-banner">'
      + '<span class="scen-ref-label">Référence actuelle</span>'
      + '<span class="scen-ref-kpi">DGH : <strong>' + bilanRef.enveloppe + ' h</strong></span>'
      + '<span class="scen-ref-kpi">Alloué : <strong>' + bilanRef.totalAlloue + ' h</strong></span>'
      + '<span class="scen-ref-kpi">Solde : <strong class="' + refCls + '">' + refSign + bilanRef.solde + ' h</strong></span>'
    + '</div>';

    if (scenarios.length === 0) {
      el.innerHTML = bandeauRef
        + '<div class="scen-empty"><p>Aucun scénario.</p>'
        + '<p class="scen-empty-hint">Cliquez sur <strong>+ Nouveau scénario</strong> pour simuler des modalités pédagogiques.</p></div>';
      return;
    }

    const thead = '<tr>'
      + '<th class="scen-th-nom">Scénario</th>'
      + '<th class="scen-th-mods">Modalités</th>'
      + '<th class="scen-th-r">Coût HP</th>'
      + '<th class="scen-th-r">Coût HSA</th>'
      + '<th class="scen-th-r">Solde simulé</th>'
      + '<th>Statut</th>'
      + '<th class="scen-th-r">Actions</th>'
      + '</tr>';

    const tbody = scenarios.map(scen => {
      const bilan    = Calculs.bilanScenario(data, scen.modificateurs);
      const scls     = bilan.depassement ? 'scen-solde-danger' : 'scen-solde-ok';
      const ssign    = bilan.soldeSimule >= 0 ? '+' : '';
      const editing  = _scenEditId === scen.id;
      const rowCls   = (editing ? ' scen-row-editing' : '') + (scen.actif ? ' scen-row-actif' : '');
      const types    = [...new Set((scen.modificateurs||[]).map(m => m.type))];
      const badges   = types.map(t => '<span class="mod-badge ' + (TYPES_MOD[t]?.css||'') + '">' + (TYPES_MOD[t]?.short||t) + '</span>').join('');

      const ligne = '<tr class="scen-row' + rowCls + '">'
        + '<td class="scen-td-nom">'          + '<input class="scen-nom-input" data-scen-id="' + scen.id + '" value="' + _esc(scen.nom) + '" placeholder="Nom du scénario" title="Cliquez pour renommer" />'        + '</td>'
        + '<td class="scen-td-mods-list">' + ((scen.modificateurs||[]).length === 0
            ? '<span class="scen-cout-zero">Aucune modalité</span>'
            : (scen.modificateurs||[]).map(m => {
                const structures2 = DGHData.getStructures();
                const disciplines2 = DGHData.getDisciplines();
                const t = TYPES_MOD[m.type] || { css: '', short: m.type };
                const tit = m.titre || _titreModificateur(m.type, m.disciplineId, m.classeIds, structures2, disciplines2);
                return '<span class="mod-ligne-titre"><span class="mod-badge ' + t.css + '">' + t.short + '</span> ' + _esc(tit.split(' · ').slice(1).join(' · ') || tit) + '</span>';
              }).join('')
          ) + '</td>'
        + '<td class="scen-th-r font-mono">' + (bilan.coutHP > 0 ? '<span class="scen-cout-val">+' + bilan.coutHP + ' h</span>' : '<span class="scen-cout-zero">—</span>') + '</td>'
        + '<td class="scen-th-r font-mono">' + (bilan.coutHSA > 0 ? '<span class="scen-cout-val">+' + bilan.coutHSA + ' h</span>' : '<span class="scen-cout-zero">—</span>') + '</td>'
        + '<td class="scen-th-r font-mono ' + scls + '">' + ssign + bilan.soldeSimule + ' h</td>'
        + '<td>' + (scen.actif
            ? '<span class="scen-badge-actif">● Actif</span>'
            : '<button class="btn-link" data-action="set-actif-scenario" data-id="' + scen.id + '">Activer</button>') + '</td>'
        + '<td class="scen-th-r">'
          + '<button class="btn-icon" data-action="edit-scenario" data-id="' + scen.id + '" title="' + (editing?'Fermer':'Éditer') + '">' + (editing?'▲':'▼') + '</button>'
          + '<button class="btn-icon" data-action="duplicate-scenario" data-id="' + scen.id + '" title="Dupliquer">⎘</button>'
          + '<button class="btn-icon btn-icon-danger" data-action="delete-scenario" data-id="' + scen.id + '" title="Supprimer">✕</button>'
        + '</td>'
      + '</tr>';

      const panel = editing
        ? '<tr class="scen-row-panel"><td colspan="7">' + _htmlPanneauModalites(scen, data) + '</td></tr>'
        : '';

      return ligne + panel;
    }).join('');

    el.innerHTML = bandeauRef
      + '<div class="scen-comp-wrap"><table class="scen-tableau">'
      + '<thead>' + thead + '</thead>'
      + '<tbody>' + tbody + '</tbody>'
      + '</table></div>';
  }

  // ── Panneau accordéon des modalités ───────────────────────────────
  function _htmlPanneauModalites(scen, data) {
    const mods        = scen.modificateurs || [];
    const disciplines = DGHData.getDisciplines();
    const structures  = DGHData.getStructures();
    const bilan       = Calculs.bilanScenario(data, mods);

    // Tableau des modalités existantes
    let modsHtml = mods.length === 0
      ? '<p class="scen-panel-empty">Aucune modalité — ajoutez-en ci-dessous.</p>'
      : '<div class="scen-panel-table-wrap"><table class="scen-mods-table">'
          + '<thead><tr><th>Titre</th><th>Type</th><th>Classes</th><th class="scen-th-r">H/gr</th><th>HP/HSA</th><th class="scen-th-r">Coût</th><th>Commentaire</th><th></th></tr></thead>'
          + '<tbody>'
          + mods.map(mod => {
              const tInfo  = TYPES_MOD[mod.type] || { label: mod.type, css: '' };
              const disc   = mod.disciplineId ? disciplines.find(d => d.id === mod.disciplineId) : null;
              const detail = bilan.detailParMod.find(d => d.mod.id === mod.id);
              const cout   = detail ? ('+' + (detail.coutHP + detail.coutHSA) + ' h') : '—';
              // Titre : stocké ou regénéré à la volée pour les anciens modificateurs
              const titreDisp = mod.titre || _titreModificateur(mod.type, mod.disciplineId, mod.classeIds, structures, disciplines);
              return '<tr>'
                + '<td class="mod-titre-cell"><strong>' + _esc(titreDisp) + '</strong></td>'
                + '<td><span class="mod-badge ' + tInfo.css + '">' + tInfo.short + '</span></td>'
                + '<td class="scen-td-cibles">' + _esc(_nomsCibles(mod, structures)) + '</td>'
                + '<td class="scen-th-r font-mono">' + (mod.heuresParGroupe||0) + ' h</td>'
                + '<td><span class="mod-th-badge mod-th-badge-' + (mod.typeHeure||'hsa') + '">' + ((mod.typeHeure||'hsa').toUpperCase()) + '</span></td>'
                + '<td class="scen-th-r font-mono scen-cout-val">' + cout + '</td>'
                + '<td>' + (mod.commentaire ? '<span class="mod-comment-cell">' + _esc(mod.commentaire) + '</span>' : '') + '</td>'
                + '<td><button class="btn-icon btn-icon-danger" data-action="delete-mod" data-scen-id="' + scen.id + '" data-mod-id="' + mod.id + '">✕</button></td>'
              + '</tr>';
            }).join('')
          + '</tbody></table></div>';

    return '<div class="scen-panel">'
      + '<div class="scen-panel-header"><span class="scen-panel-titre">Modalités — <strong>' + _esc(scen.nom) + '</strong></span></div>'
      + modsHtml
      + _htmlFormModalite(scen.id, disciplines, structures)
    + '</div>';
  }

  function _htmlFormModalite(scenId, disciplines, structures) {
    const typeOpts = Object.entries(TYPES_MOD).map(([k,v]) =>
      '<option value="' + k + '">' + v.label + '</option>'
    ).join('');
    const discOpts = disciplines.map(d =>
      '<option value="' + d.id + '">' + _esc(d.nom) + '</option>'
    ).join('');

    // Classes groupées par niveau
    const parNiv = {};
    structures.forEach(s => { if (!parNiv[s.niveau]) parNiv[s.niveau] = []; parNiv[s.niveau].push(s); });
    const classesHtml = NIVEAUX_ORD.filter(n => parNiv[n]?.length).map(niv => {
      const cases = parNiv[niv].map(s =>
        '<label class="mod-classe-label">'
          + '<input type="checkbox" class="mod-classe-check" value="' + s.id + '"> ' + _esc(s.nom)
        + '</label>'
      ).join('');
      return '<div class="mod-niv-groupe">'
        + '<span class="mod-niv-label">' + niv + '</span>'
        + '<div class="mod-niv-cases">' + cases + '</div>'
      + '</div>';
    }).join('') || '<span class="scen-cout-zero">Aucune division. Renseignez les structures d\'abord.</span>';

    const selRapide = NIVEAUX_ORD.filter(n => parNiv[n]?.length).map(n =>
      '<button type="button" class="btn-link mod-sel-niv" data-niveau="' + n + '">' + n + '</button>'
    ).join(' · ')
    + ' · <button type="button" class="btn-link mod-sel-niv" data-niveau="all">Tout</button>'
    + ' · <button type="button" class="btn-link mod-sel-niv" data-niveau="none">Aucun</button>';

    return '<div class="scen-form-add" data-scen-id="' + scenId + '">'
      + '<div class="scen-form-title">+ Ajouter une modalité</div>'
      + '<div class="scen-form-grid">'
        + '<div class="scen-form-col">'
          + '<div class="scen-form-field"><label>Type de modalité</label>'
            + '<select class="mod-type-select" id="modType_' + scenId + '" data-scen-id="' + scenId + '">' + typeOpts + '</select></div>'
          + '<div class="scen-form-field mod-nom-autre-wrap is-hidden" id="modNomAutreWrap_' + scenId + '"><label>Nom de la modalité</label>'
            + '<input type="text" class="mod-nom-autre" id="modNomAutre_' + scenId + '" placeholder="ex: Aide aux devoirs" /></div>'
          + '<div class="scen-form-field"><label>Discipline (optionnel)</label>'
            + '<select class="mod-disc-select" id="modDisc_' + scenId + '">'
              + '<option value="">— Toutes —</option>' + discOpts
            + '</select></div>'
          + '<div class="scen-form-field-row">'
            + '<div class="scen-form-field"><label>H/groupe/semaine</label>'
              + '<input type="number" class="mod-h-input" id="modH_' + scenId + '" min="0.5" max="20" step="0.5" value="1" /></div>'
            + '<div class="scen-form-field"><label>Type d\'heure</label>'
              + '<div class="mod-typeheure-toggle">'
                + '<label class="mod-th-label"><input type="radio" class="mod-th-radio" name="modTH_' + scenId + '" value="hsa" checked> HSA</label>'
                + '<label class="mod-th-label"><input type="radio" class="mod-th-radio" name="modTH_' + scenId + '" value="hp"> HP</label>'
              + '</div></div>'
          + '</div>'
          + '<div class="scen-form-field"><label>Commentaire</label>'
            + '<input type="text" class="mod-comment-input" id="modComment_' + scenId + '" placeholder="Précisions éventuelles" /></div>'
          + '<div class="mod-form-preview" id="modPreview_' + scenId + '">Sélectionnez des classes pour voir l\'impact</div>'
        + '</div>'
        + '<div class="scen-form-col">'
          + '<label class="scen-form-label-classes">Classes concernées <span class="mod-sel-rapide">' + selRapide + '</span></label>'
          + '<div class="mod-classes-grid-niv" id="modGrid_' + scenId + '">' + classesHtml + '</div>'
        + '</div>'
      + '</div>'
      + '<div class="scen-form-actions">'
        + '<button class="btn-primary" data-action="save-mod" data-scen-id="' + scenId + '">Ajouter ✓</button>'
      + '</div>'
    + '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 2 — RÉCAPITULATIF DGH
  // ══════════════════════════════════════════════════════════════════
  function _renderOngletRecap() {
    const el = document.getElementById('scenRecapWrap');
    if (!el) return;
    const data        = DGHData.getAnnee();
    const disciplines = DGHData.getDisciplines();
    const structures  = DGHData.getStructures();
    const bilanRef    = Calculs.bilanDotation(data);
    const scenarios   = DGHData.getScenarios();
    const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, data.repartition||[], data.grilles||{});
    const NIVEAUX_GR  = ['6e','5e','4e','3e'];

    if (disciplines.length === 0) {
      el.innerHTML = '<div class="scen-empty"><p>Saisissez vos disciplines et dotation pour afficher le récapitulatif.</p></div>';
      return;
    }

    // Scénario affiché dans la colonne
    if (_scenRecapId && !scenarios.find(sc => sc.id === _scenRecapId)) _scenRecapId = null;
    const scenChoisi = _scenRecapId
      ? scenarios.find(sc => sc.id === _scenRecapId)
      : DGHData.getScenarioActif();
    const bilanScen = scenChoisi ? Calculs.bilanScenario(data, scenChoisi.modificateurs) : null;

    // ── Sélecteur de scénario ─────────────────────────────────────
    const selectOpts = '<option value="">— Aucun scénario —</option>'
      + scenarios.map(sc =>
          '<option value="' + sc.id + '"' + (scenChoisi && sc.id === scenChoisi.id ? ' selected' : '') + '>'
          + _esc(sc.nom) + (sc.actif ? ' ●' : '') + '</option>'
        ).join('');
    const selectorHtml = '<div class="recap-scen-selector">'
      + '<label class="recap-scen-select-label">Scénario à afficher :</label>'
      + '<select class="recap-scen-select" id="recapScenSelect">' + selectOpts + '</select>'
    + '</div>';

    // ── Niveaux présents ──────────────────────────────────────────
    const nbParNiv = {};
    NIVEAUX_GR.forEach(n => { nbParNiv[n] = structures.filter(s => s.niveau === n).length; });
    const nivsPresents = NIVEAUX_GR.filter(n => nbParNiv[n] > 0);

    // ── En-tête colonne scénario ──────────────────────────────────
    let scenTh = '';
    if (scenChoisi) {
      const modsTags = (scenChoisi.modificateurs||[]).map(m => {
        const t   = TYPES_MOD[m.type] || { css: '', short: m.type };
        const tit = m.titre || _titreModificateur(m.type, m.disciplineId, m.classeIds, structures, disciplines, m.nomAutre);
        const thBadge = '<span class="recap-mod-th-badge">' + (m.typeHeure||'hsa').toUpperCase() + '</span>';
        return '<span class="recap-mod-tag mod-badge ' + t.css + '">' + _esc(tit) + ' ' + thBadge + '</span>';
      }).join('');
      scenTh = '<th class="recap-th-h recap-th-scen">'
        + '<div class="recap-scen-nom">' + _esc(scenChoisi.nom) + '</div>'
        + (modsTags ? '<div class="recap-scen-mods">' + modsTags + '</div>' : '<div class="recap-scen-mods scen-cout-zero">Aucune modalité</div>')
      + '</th>';
    }

    const thead = '<tr>'
      + '<th class="recap-th-disc">Discipline</th>'
      + nivsPresents.map(n => '<th class="recap-th-h" title="' + nbParNiv[n] + ' div.">' + n + '</th>').join('')
      + '<th class="recap-th-h recap-col-sep">Besoin MEN</th>'
      + '<th class="recap-th-h">Alloué HP</th>'
      + '<th class="recap-th-h">Alloué HSA</th>'
      + '<th class="recap-th-h recap-col-total">Total alloué</th>'
      + '<th class="recap-th-h recap-col-ecart">Écart</th>'
      + scenTh
    + '</tr>';

    // ── Lignes disciplines ────────────────────────────────────────
    const tbodyDisc = besoins.map(b => {
      const hp    = b.hPoste || 0;
      const hsa   = b.hsa   || 0;
      const tot   = b.total || 0;
      const ecart = b.ecart || 0;
      const ecartCls  = ecart > 0 ? 'recap-ecart-pos' : ecart < 0 ? 'recap-ecart-neg' : 'recap-ecart-zero';
      const ecartSign = ecart > 0 ? '+' : '';

      const cellesNiv = nivsPresents.map(n => {
        const gl  = (b.grilleLignes||{})[n];
        const val = gl ? gl.valeur : 0;
        const mod = gl ? gl.modifie : false;
        return '<td class="recap-td-h' + (mod ? ' recap-modifie' : '') + '" title="' + (mod ? 'Override' : 'Grille MEN') + '">'
          + (val > 0 ? val + ' h' : '<span class="scen-cout-zero">—</span>') + '</td>';
      }).join('');

      // Colonne scénario : UNIQUEMENT le delta (heures ajoutées par les modalités)
      let celleScen = '';
      if (bilanScen) {
        const ds    = bilanScen.detailParDisc.find(x => x.disciplineId === b.disciplineId);
        const delta = ds ? ds.delta : 0;
        if (delta !== 0) {
          const cls  = delta > 0 ? 'recap-ecart-pos' : 'scen-solde-danger';
          celleScen = '<td class="recap-td-h recap-col-scen font-mono ' + cls + '">'
            + '<strong>' + (delta > 0 ? '+' : '') + delta + ' h</strong></td>';
        } else {
          celleScen = '<td class="recap-td-h recap-col-scen scen-cout-zero">—</td>';
        }
      }

      const pct = bilanRef.enveloppe > 0 ? Math.min(100, Math.round((tot / bilanRef.enveloppe) * 100)) : 0;

      return '<tr class="recap-tr">'
        + '<td class="recap-td-disc">'
          + '<span class="scen-disc-dot" style="background:' + _esc(b.couleur||'#999') + '"></span>'
          + _esc(b.nom)
          + '<div class="recap-bar-wrap"><div class="recap-bar-fill" style="width:' + pct + '%;background:' + _esc(b.couleur||'#999') + '"></div></div>'
        + '</td>'
        + cellesNiv
        + '<td class="recap-td-h recap-col-sep font-mono">' + (b.besoinMEN > 0 ? b.besoinMEN + ' h' : '—') + '</td>'
        + '<td class="recap-td-h font-mono">' + (hp > 0 ? hp + ' h' : '—') + '</td>'
        + '<td class="recap-td-h font-mono">' + (hsa > 0 ? hsa + ' h' : '—') + '</td>'
        + '<td class="recap-td-h recap-col-total font-mono"><strong>' + (tot > 0 ? tot + ' h' : '—') + '</strong></td>'
        + '<td class="recap-td-h ' + ecartCls + ' font-mono">'
          + (ecart !== 0 ? ecartSign + ecart + ' h' : '<span class="recap-ecart-zero">=</span>') + '</td>'
        + celleScen
      + '</tr>';
    }).join('');

    // ── Ligne totaux ──────────────────────────────────────────────
    const scenTotCol = bilanScen
      ? '<td class="recap-td-h recap-col-scen recap-total">'
          + '<div class="font-mono ' + (bilanScen.coutTotal > 0 ? 'recap-ecart-pos' : '') + '">'
            + (bilanScen.coutHP  > 0 ? '<div>HP : <strong>+' + bilanScen.coutHP  + ' h</strong></div>' : '')
            + (bilanScen.coutHSA > 0 ? '<div>HSA : <strong>+' + bilanScen.coutHSA + ' h</strong></div>' : '')
            + (bilanScen.coutTotal === 0 ? '—' : '')
          + '</div>'
          + '<div class="font-mono ' + (bilanScen.depassement ? 'scen-solde-danger' : 'scen-solde-ok') + '">'
            + 'Solde : <strong>' + (bilanScen.soldeSimule >= 0 ? '+' : '') + bilanScen.soldeSimule + ' h</strong>'
          + '</div>'
        + '</td>'
      : '';

    const ecartTot  = Math.round((bilanRef.totalAlloue - besoins.reduce((s,b) => s + b.besoinMEN, 0)) * 2) / 2;
    const besoinTot = Math.round(besoins.reduce((s,b) => s + b.besoinMEN, 0) * 2) / 2;

    const tbodyTotaux = '<tr class="recap-row-total">'
      + '<td class="recap-td-disc"><strong>Total</strong></td>'
      + nivsPresents.map(() => '<td></td>').join('')
      + '<td class="recap-td-h recap-col-sep font-mono"><strong>' + besoinTot + ' h</strong></td>'
      + '<td class="recap-td-h font-mono"><strong>' + bilanRef.totalHPDisc + ' h</strong></td>'
      + '<td class="recap-td-h font-mono"><strong>' + bilanRef.totalHSADisc + ' h</strong></td>'
      + '<td class="recap-td-h recap-col-total font-mono"><strong>' + bilanRef.totalAlloue + ' h</strong></td>'
      + '<td class="recap-td-h font-mono ' + (ecartTot >= 0 ? 'recap-ecart-pos' : 'recap-ecart-neg') + '">'
        + '<strong>' + (ecartTot >= 0 ? '+' : '') + ecartTot + ' h</strong></td>'
      + scenTotCol
    + '</tr>';

    // ── Ligne enveloppe ───────────────────────────────────────────
    const tbodyEnv = '<tr class="recap-row-env">'
      + '<td class="recap-td-disc">Enveloppe DGH</td>'
      + nivsPresents.map(() => '<td></td>').join('')
      + '<td class="recap-col-sep"></td>'
      + '<td class="recap-td-h font-mono">' + bilanRef.hPosteEnv + ' h</td>'
      + '<td class="recap-td-h font-mono">' + bilanRef.hsaEnv + ' h</td>'
      + '<td class="recap-td-h recap-col-total font-mono">' + bilanRef.enveloppe + ' h</td>'
      + '<td class="recap-td-h font-mono ' + (bilanRef.depassement ? 'scen-solde-danger' : 'scen-solde-ok') + '">'
        + '<strong>' + (bilanRef.solde >= 0 ? '+' : '') + bilanRef.solde + ' h</strong></td>'
      + (bilanScen ? '<td class="recap-col-scen"></td>' : '')
    + '</tr>';

    el.innerHTML = selectorHtml
      + '<div class="scen-comp-wrap"><table class="recap-table">'
      + '<thead>' + thead + '</thead>'
      + '<tbody>' + tbodyDisc + tbodyTotaux + tbodyEnv + '</tbody>'
      + '</table></div>';
  }

  // ── Changer le scénario affiché dans le récap ─────────────────────
  function setRecapScen(id) {
    _scenRecapId = id || null;
    _renderOngletRecap();
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 3 — IMPACT ENSEIGNANTS
  // ══════════════════════════════════════════════════════════════════
  /**
   * Pour chaque enseignant, affiche :
   *   - les modalités du scénario actif qui le concernent (discipline/classes)
   *   - le choix HP ou HSA par modalité pour cet enseignant
   *   - le service simulé (ORS, écart)
   * Si aucun scénario actif → invitation à en activer un.
   * Filtrage automatique : seules les modalités dont la discipline
   * correspond à une discipline de l'enseignant sont proposées.
   */
  function _renderOngletImpact() {
    const el = document.getElementById('scenImpactWrap');
    if (!el) return;

    const data      = DGHData.getAnnee();
    const scenActif = DGHData.getScenarioActif();

    if (!scenActif) {
      el.innerHTML = '<div class="scen-empty">'
        + '<p>Aucun scénario actif.</p>'
        + '<p class="scen-empty-hint">Activez un scénario dans l\'onglet <strong>⊕ Scénarios</strong> pour visualiser son impact sur l\'équipe.</p>'
        + '</div>';
      return;
    }

    const mods        = scenActif.modificateurs || [];
    const enseignants = DGHData.getEnseignants();
    const hpcs        = DGHData.getHeuresPedaComp();
    const disciplines = DGHData.getDisciplines();
    const structures  = DGHData.getStructures();

    if (mods.length === 0) {
      el.innerHTML = '<div class="scen-empty"><p>Le scénario <strong>' + _esc(scenActif.nom) + '</strong> n\'a aucune modalité.</p></div>';
      return;
    }

    if (enseignants.length === 0) {
      el.innerHTML = '<div class="scen-empty"><p>Aucun enseignant renseigné. Ajoutez votre équipe dans le module Équipe pédagogique.</p></div>';
      return;
    }

    // Pour chaque enseignant, chercher les modalités qui le concernent
    // (discipline de la modalité ∈ disciplines de l'enseignant, ou modalité sans discipline)
    const lignesEns = enseignants.map(ens => {
      const discsEns = new Set(
        (Array.isArray(ens.disciplines) ? ens.disciplines : [])
          .map(d => d.discNom).filter(Boolean)
      );
      if (ens.disciplinePrincipale) discsEns.add(ens.disciplinePrincipale);

      // Modalités concernant cet enseignant
      const modsConcernes = mods.filter(mod => {
        if (!mod.disciplineId) return true; // sans discipline → concerne tout le monde
        const disc = disciplines.find(d => d.id === mod.disciplineId);
        return disc && discsEns.has(disc.nom);
      });

      if (modsConcernes.length === 0) return null; // cet enseignant n'est pas concerné

      // Service actuel (sans scénario)
      const svcBase = Calculs.serviceTotalEnseignant(ens, hpcs);

      // Calculer le service simulé selon les affectations choisies
      let deltaHP = 0, deltaHSA = 0;
      const affRows = modsConcernes.map(mod => {
        const tInfo = TYPES_MOD[mod.type] || { label: mod.type, css: '', short: mod.type };
        const aff   = (mod.affectations || []).find(a => a.ensId === ens.id);
        const th    = aff ? aff.typeHeure : 'hsa'; // défaut HSA
        const affecte = aff ? aff.affecte !== false : false; // pas affecté par défaut
        // Coût de cette modalité pour 1 enseignant = heuresParGroupe × nb groupes/classes (1 prof = 1 service)
        const hParSemaine = mod.heuresParGroupe || 0;
        const titre = mod.titre || _titreModificateur(mod.type, mod.disciplineId, mod.classeIds, structures, disciplines, mod.nomAutre);

        if (affecte) {
          if (th === 'hp') deltaHP  += hParSemaine;
          else             deltaHSA += hParSemaine;
        }

        return { mod, tInfo, th, affecte, hParSemaine, titre };
      });

      const hpSim  = Math.round((svcBase.hpTotal  + deltaHP)  * 2) / 2;
      const hsaSim = Math.round((svcBase.hsaTotal + deltaHSA) * 2) / 2;
      const ors    = svcBase.ors;
      const ecartSim = ors > 0 ? Math.round((hpSim - ors) * 2) / 2 : null;
      const statSim  = ecartSim === null ? 'sans-ors' : ecartSim > 0 ? 'hsa' : ecartSim < 0 ? 'sous-service' : 'equilibre';

      return { ens, svcBase, affRows, hpSim, hsaSim, ors, ecartSim, statSim };
    }).filter(Boolean);

    if (lignesEns.length === 0) {
      el.innerHTML = '<div class="scen-empty"><p>Aucun enseignant n\'est concerné par les disciplines de ce scénario.</p>'
        + '<p class="scen-empty-hint">Vérifiez que les modalités ont des disciplines correspondant aux matières de votre équipe.</p></div>';
      return;
    }

    // ── En-tête ──
    const html = '<div class="impact-header">'
      + '<h3 class="synth-section-title">Impact du scénario <span class="impact-scen-nom">' + _esc(scenActif.nom) + '</span> sur l\'équipe</h3>'
      + '<p class="impact-subtitle">Pour chaque enseignant concerné, cochez les modalités qui lui sont attribuées et choisissez HP ou HSA. Les services simulés se mettent à jour en temps réel.</p>'
    + '</div>'
    + lignesEns.map(row => _htmlImpactEnseignant(row, scenActif.id)).join('');

    el.innerHTML = html;
  }

  function _htmlImpactEnseignant(row, scenId) {
    const { ens, svcBase, affRows, hpSim, hsaSim, ors, ecartSim, statSim } = row;
    const nomEns   = _esc((ens.nom||'') + (ens.prenom ? ' ' + ens.prenom : ''));
    const statCls  = { 'hsa':'ens-stat-hsa','sous-service':'ens-stat-ss','equilibre':'ens-stat-eq','sans-ors':'ens-stat-na' }[statSim] || '';
    const statLbl  = { 'hsa':'En HSA','sous-service':'Sous-service','equilibre':'Équilibré','sans-ors':'Sans ORS' }[statSim] || '—';
    const ecartStr = ecartSim !== null ? (ecartSim >= 0 ? '+' : '') + ecartSim + ' h' : '—';

    // Tableau des modalités pour cet enseignant
    const modsRows = affRows.map(({ mod, tInfo, th, affecte, hParSemaine, titre }) => {
      const chkId  = 'aff_' + ens.id + '_' + mod.id;
      const hp_sel = th === 'hp'  ? ' checked' : '';
      const hsa_sel= th === 'hsa' ? ' checked' : '';
      return '<tr class="impact-mod-row' + (affecte ? ' impact-mod-actif' : '') + '" data-scen-id="' + scenId + '" data-mod-id="' + mod.id + '" data-ens-id="' + ens.id + '">'
        + '<td class="impact-td-check">'
          + '<label class="impact-check-label">'
            + '<input type="checkbox" class="impact-aff-check" data-scen-id="' + scenId + '" data-mod-id="' + mod.id + '" data-ens-id="' + ens.id + '"' + (affecte ? ' checked' : '') + '>'
          + '</label>'
        + '</td>'
        + '<td class="impact-td-titre"><span class="mod-badge ' + tInfo.css + '">' + tInfo.short + '</span> ' + _esc(titre) + '</td>'
        + '<td class="impact-td-h font-mono">' + hParSemaine + ' h/sem.</td>'
        + '<td class="impact-td-th">'
          + '<div class="mod-typeheure-toggle' + (affecte ? '' : ' impact-th-disabled') + '">'
            + '<label class="mod-th-label">'
              + '<input type="radio" class="impact-th-radio" name="impTH_' + ens.id + '_' + mod.id + '" value="hsa"' + hsa_sel + ' data-scen-id="' + scenId + '" data-mod-id="' + mod.id + '" data-ens-id="' + ens.id + '"> HSA'
            + '</label>'
            + '<label class="mod-th-label">'
              + '<input type="radio" class="impact-th-radio" name="impTH_' + ens.id + '_' + mod.id + '" value="hp"' + hp_sel + ' data-scen-id="' + scenId + '" data-mod-id="' + mod.id + '" data-ens-id="' + ens.id + '"> HP'
            + '</label>'
          + '</div>'
        + '</td>'
      + '</tr>';
    }).join('');

    // Service simulé
    const ecartCls = ecartSim === null ? '' : ecartSim > 0 ? 'recap-ecart-pos' : ecartSim < 0 ? 'recap-ecart-neg' : '';

    return '<div class="impact-ens-card" data-ens-id="' + ens.id + '">'
      + '<div class="impact-ens-header">'
        + '<div class="impact-ens-identite">'
          + '<span class="impact-ens-nom">' + nomEns + '</span>'
          + '<span class="impact-ens-grade">' + _esc(ens.grade||'') + '</span>'
          + '<span class="impact-ens-discs">'
            + (Array.isArray(ens.disciplines) ? ens.disciplines.map(d=>_esc(d.discNom)).join(', ') : _esc(ens.disciplinePrincipale||''))
          + '</span>'
        + '</div>'
        + '<div class="impact-ens-service">'
          + '<div class="impact-svc-bloc">'
            + '<span class="impact-svc-lbl">Service actuel</span>'
            + '<span class="impact-svc-val font-mono">' + svcBase.hpTotal + ' h HP'
              + (svcBase.hsaTotal > 0 ? ' + ' + svcBase.hsaTotal + ' h HSA' : '') + '</span>'
            + (ors > 0 ? '<span class="impact-svc-ors">ORS : ' + ors + ' h</span>' : '')
          + '</div>'
          + '<div class="impact-svc-arrow">→</div>'
          + '<div class="impact-svc-bloc impact-svc-sim">'
            + '<span class="impact-svc-lbl">Avec scénario</span>'
            + '<span class="impact-svc-val font-mono">' + hpSim + ' h HP'
              + (hsaSim > 0 ? ' + ' + hsaSim + ' h HSA' : '') + '</span>'
            + '<span class="impact-svc-ecart ' + ecartCls + '">'
              + (ors > 0 ? 'Écart ORS : ' + ecartStr : '—')
            + '</span>'
          + '</div>'
          + '<span class="synth-ens-stat ' + statCls + '">' + statLbl + '</span>'
        + '</div>'
      + '</div>'
      + '<table class="impact-mods-table">'
        + '<thead><tr>'
          + '<th class="impact-th-check" title="Attribuer à cet enseignant">Attribué</th>'
          + '<th>Modalité</th>'
          + '<th class="impact-td-h">Heures</th>'
          + '<th>Type d\'heure</th>'
        + '</tr></thead>'
        + '<tbody>' + modsRows + '</tbody>'
      + '</table>'
    + '</div>';
  }

  // ── Sauvegarder une affectation enseignant ↔ modificateur ─────────
  function saveAffectation(ensId, modId, scenId, field, value) {
    const scen = DGHData.getScenario(scenId);
    if (!scen) return;
    const mod = scen.modificateurs.find(m => m.id === modId);
    if (!mod) return;
    if (!Array.isArray(mod.affectations)) mod.affectations = [];
    let aff = mod.affectations.find(a => a.ensId === ensId);
    if (!aff) {
      aff = { ensId, affecte: false, typeHeure: 'hsa' };
      mod.affectations.push(aff);
    }
    aff[field] = value;
    DGHData.updateModificateur(scenId, modId, { affectations: mod.affectations });
    // Re-render partiel : uniquement la carte de cet enseignant
    _refreshImpactCard(ensId, scenId);
  }

  function _refreshImpactCard(ensId, scenId) {
    // Re-render complet de l\'onglet impact (simple et fiable)
    _renderOngletImpact();
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 4 — SYNTHÈSE
  // ══════════════════════════════════════════════════════════════════
  function _renderOngletSynthese() {
    const el = document.getElementById('scenSyntheseWrap');
    if (!el) return;
    const data        = DGHData.getAnnee();
    const disciplines = DGHData.getDisciplines();
    const enseignants = DGHData.getEnseignants();
    const hpcs        = DGHData.getHeuresPedaComp();
    const structures  = DGHData.getStructures();
    const bilanRef    = Calculs.bilanDotation(data);
    const bilanEns    = Calculs.bilanEnseignants(enseignants);
    const resume      = Calculs.resumeStructures(structures);
    const bilanDiscs  = Calculs.bilanParDiscipline(enseignants, data.repartition||[], disciplines);

    // ── KPIs ──────────────────────────────────────────────────────
    const soldeCls  = bilanRef.depassement ? 'scen-solde-danger' : 'scen-solde-ok';
    const soldeSign = bilanRef.solde >= 0 ? '+' : '';
    const pctCons   = bilanRef.enveloppe > 0 ? Math.round((bilanRef.totalAlloue / bilanRef.enveloppe) * 100) : 0;

    const kpis = [
      { label: 'Enveloppe DGH',    val: bilanRef.enveloppe  + ' h',            sub: bilanRef.hPosteEnv + ' HP + ' + bilanRef.hsaEnv + ' HSA', icon: '◎', cls: '' },
      { label: 'Heures allouées',  val: bilanRef.totalAlloue + ' h',            sub: pctCons + ' % consommé',                                  icon: '▦', cls: '' },
      { label: 'Solde',            val: soldeSign + bilanRef.solde + ' h',      sub: bilanRef.depassement ? 'dépassement !' : 'disponibles',   icon: '⊕', cls: soldeCls },
      { label: 'Enseignants',      val: bilanEns.nbEnseignants || '0',          sub: (bilanEns.nbHSA||0) + ' en HSA · ' + (bilanEns.nbSousService||0) + ' sous-service', icon: '◉', cls: '' },
      { label: 'Divisions',        val: resume.nbDivisions || '0',              sub: resume.effectifTotal ? resume.effectifTotal + ' élèves' : '—', icon: '⊞', cls: '' },
      { label: 'Disciplines',      val: disciplines.length || '0',              sub: bilanRef.nbDisciplines + ' dotées',                       icon: '◈', cls: '' },
    ];

    const kpiHtml = kpis.map(k => '<div class="synth-kpi">'
      + '<span class="synth-kpi-icon">' + k.icon + '</span>'
      + '<div class="synth-kpi-body">'
        + '<span class="synth-kpi-val ' + k.cls + '">' + k.val + '</span>'
        + '<span class="synth-kpi-label">' + k.label + '</span>'
        + '<span class="synth-kpi-sub">' + k.sub + '</span>'
      + '</div>'
    + '</div>').join('');

    // ── Barre de consommation DGH ──────────────────────────────────
    const pctHP  = bilanRef.enveloppe > 0 ? Math.min(100, Math.round(bilanRef.totalHP  / bilanRef.enveloppe * 100)) : 0;
    const pctHSA = bilanRef.enveloppe > 0 ? Math.min(100 - pctHP, Math.round(bilanRef.totalHSA / bilanRef.enveloppe * 100)) : 0;
    const barreHtml = '<div class="synth-bar-section">'
      + '<div class="synth-bar-labels">'
        + '<span>HP : ' + bilanRef.totalHP + ' h</span>'
        + '<span>HSA : ' + bilanRef.totalHSA + ' h</span>'
        + '<span>' + bilanRef.totalAlloue + ' / ' + bilanRef.enveloppe + ' h (' + pctCons + ' %)</span>'
      + '</div>'
      + '<div class="synth-bar-track">'
        + '<div class="synth-bar-hp" style="width:' + pctHP + '%"></div>'
        + '<div class="synth-bar-hsa" style="width:' + pctHSA + '%;margin-left:' + pctHP + '%"></div>'
      + '</div>'
      + '<div class="synth-bar-legend"><span class="synth-leg synth-leg-hp">HP</span><span class="synth-leg synth-leg-hsa">HSA</span><span class="synth-leg synth-leg-libre">Disponible</span></div>'
    + '</div>';

    // ── Tableau disciplines ────────────────────────────────────────
    const discLignes = bilanDiscs.map(bd => {
      const dotee = bd.heuresDotation > 0;
      const ecart = bd.ecart;
      const ecartCls = ecart > 0 ? 'recap-ecart-pos' : ecart < 0 ? 'recap-ecart-neg' : 'recap-ecart-zero';
      const pctBarre = bd.heuresDotation > 0 ? Math.min(100, Math.round(bd.heuresDisc / bd.heuresDotation * 100)) : 0;
      const barCol   = disciplines.find(d => d.nom === bd.disc)?.couleur || '#94a3b8';
      return '<tr>'
        + '<td class="synth-disc-td">'
          + '<span class="scen-disc-dot" style="background:' + _esc(barCol) + '"></span>'
          + _esc(bd.disc)
        + '</td>'
        + '<td class="synth-td-bar">'
          + '<div class="synth-disc-bar-wrap">'
            + '<div class="synth-disc-bar-fill" style="width:' + pctBarre + '%;background:' + _esc(barCol) + '"></div>'
          + '</div>'
        + '</td>'
        + '<td class="synth-td-num font-mono">' + (dotee ? bd.heuresDotation + ' h' : '<span class="scen-cout-zero">—</span>') + '</td>'
        + '<td class="synth-td-num font-mono">' + (bd.heuresDisc > 0 ? bd.heuresDisc + ' h' : '<span class="scen-cout-zero">—</span>') + '</td>'
        + '<td class="synth-td-num font-mono ' + ecartCls + '">'
          + (ecart !== 0 ? (ecart > 0 ? '+' : '') + ecart + ' h' : '<span class="recap-ecart-zero">=</span>')
        + '</td>'
        + '<td class="synth-td-nb"><span class="synth-nb-badge">' + bd.membres.length + '</span></td>'
      + '</tr>';
    }).join('');

    const discTableHtml = '<table class="synth-disc-table">'
      + '<thead><tr><th>Discipline</th><th>Répartition</th><th class="synth-td-num">Dotée</th><th class="synth-td-num">Affectée</th><th class="synth-td-num">Écart</th><th class="synth-td-num">Profs</th></tr></thead>'
      + '<tbody>' + (discLignes || '<tr><td colspan="6" class="scen-cout-zero">Aucune discipline renseignée.</td></tr>') + '</tbody>'
    + '</table>';

    // ── Tableau enseignants ────────────────────────────────────────
    const ensLignes = enseignants.map(ens => {
      const svc = Calculs.serviceTotalEnseignant(ens, hpcs);
      const statusCls = { 'hsa': 'ens-stat-hsa', 'sous-service': 'ens-stat-ss', 'equilibre': 'ens-stat-eq', 'sans-ors': 'ens-stat-na' }[svc.statutORS] || '';
      const statusLabel = { 'hsa': 'HSA', 'sous-service': 'Sous-svc', 'equilibre': 'Équil.', 'sans-ors': '—' }[svc.statutORS] || '—';
      const discs = Array.isArray(ens.disciplines) && ens.disciplines.length > 0
        ? ens.disciplines.map(d => _esc(d.discNom||'—')).join(', ')
        : _esc(ens.disciplinePrincipale || '—');
      return '<tr>'
        + '<td class="synth-ens-nom">' + _esc((ens.nom||'') + (ens.prenom ? ' ' + ens.prenom : '')) + '</td>'
        + '<td class="synth-td-grade">' + _esc(ens.grade||'—') + '</td>'
        + '<td class="synth-td-disc">' + discs + '</td>'
        + '<td class="synth-td-num font-mono">' + svc.hpTotal + ' h</td>'
        + '<td class="synth-td-num font-mono">' + (svc.hsaTotal > 0 ? '<span class="scen-cout-val">+' + svc.hsaTotal + ' h</span>' : '—') + '</td>'
        + '<td class="synth-td-num font-mono">' + (svc.ors > 0 ? svc.ors + ' h' : '—') + '</td>'
        + '<td><span class="synth-ens-stat ' + statusCls + '">' + statusLabel + '</span></td>'
      + '</tr>';
    }).join('');

    const ensTableHtml = '<table class="synth-ens-table">'
      + '<thead><tr><th>Enseignant</th><th>Grade</th><th>Discipline(s)</th><th class="synth-td-num">H total HP</th><th class="synth-td-num">HSA</th><th class="synth-td-num">ORS</th><th>Statut</th></tr></thead>'
      + '<tbody>' + (ensLignes || '<tr><td colspan="7" class="scen-cout-zero">Aucun enseignant renseigné.</td></tr>') + '</tbody>'
    + '</table>';

    el.innerHTML = '<div class="synth-layout">'
      // Ligne 1 : KPIs
      + '<section class="synth-section">'
        + '<h3 class="synth-section-title">Vue d\'ensemble</h3>'
        + '<div class="synth-kpi-grid">' + kpiHtml + '</div>'
        + barreHtml
      + '</section>'
      // Ligne 2 : disciplines
      + '<section class="synth-section">'
        + '<h3 class="synth-section-title">Heures par discipline — dotées vs affectées</h3>'
        + '<div class="scen-comp-wrap">' + discTableHtml + '</div>'
      + '</section>'
      // Ligne 3 : enseignants
      + '<section class="synth-section">'
        + '<h3 class="synth-section-title">Équipe pédagogique — services</h3>'
        + '<div class="scen-comp-wrap">' + ensTableHtml + '</div>'
      + '</section>'
    + '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // BANDEAU SCÉNARIO ACTIF
  // ══════════════════════════════════════════════════════════════════
  function _renderBannerActif() {
    const banner  = document.getElementById('scenActifBanner');
    const nomEl   = document.getElementById('scenActifNom');
    const soldeEl = document.getElementById('scenActifSolde');
    if (!banner) return;
    const actif = DGHData.getScenarioActif();
    if (!actif) { banner.classList.add('is-hidden'); return; }
    const bilan = Calculs.bilanScenario(DGHData.getAnnee(), actif.modificateurs);
    banner.classList.remove('is-hidden');
    if (nomEl) nomEl.textContent = actif.nom;
    if (soldeEl) {
      const sign = bilan.soldeSimule >= 0 ? '+' : '';
      soldeEl.textContent = '· Solde simulé : ' + sign + bilan.soldeSimule + ' h';
      soldeEl.className = 'scen-actif-solde font-mono ' + (bilan.depassement ? 'scen-solde-danger' : 'scen-solde-ok');
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PREVIEW IMPACT
  // ══════════════════════════════════════════════════════════════════
  function previewImpact(scenId) {
    const el = document.getElementById('modPreview_' + scenId);
    if (!el) return;
    const type    = document.getElementById('modType_'   + scenId)?.value || 'dedoublement';
    const discId  = document.getElementById('modDisc_'   + scenId)?.value || '';
    const h       = parseFloat(document.getElementById('modH_' + scenId)?.value) || 0;
    const ids     = Array.from(document.querySelectorAll('#modGrid_' + scenId + ' .mod-classe-check:checked')).map(c => c.value);
    if (!ids.length || h <= 0) { el.textContent = 'Sélectionnez des classes et des heures pour voir l\'impact'; return; }
    const typeHeure2 = document.querySelector('input[name="modTH_' + scenId + '"]:checked')?.value || 'hsa';
    const mod   = { type, disciplineId: discId||null, classeIds: ids, heuresParGroupe: h, typeHeure: typeHeure2 };
    const data  = DGHData.getAnnee();
    const bilan = Calculs.bilanScenario(data, [mod]);
    const ref   = Calculs.bilanDotation(data);
    const solde = Math.round((ref.solde - bilan.coutTotal) * 2) / 2;
    const cls   = solde < 0 ? 'scen-solde-danger' : 'scen-solde-ok';
    const sign  = solde >= 0 ? '+' : '';
    el.innerHTML = 'Impact : <strong class="font-mono">+' + bilan.coutHP + ' h HP'
      + (bilan.coutHSA > 0 ? ' / +' + bilan.coutHSA + ' h HSA' : '') + '</strong>'
      + ' → Solde simulé : <strong class="font-mono ' + cls + '">' + sign + solde + ' h</strong>';
  }

  // ══════════════════════════════════════════════════════════════════
  // SÉLECTION RAPIDE PAR NIVEAU
  // ══════════════════════════════════════════════════════════════════
  function selectionnerNiveau(btn) {
    const niv  = btn.dataset.niveau;
    const form = btn.closest('.scen-form-add');
    if (!form) return;
    const sid  = form.dataset.scenId;
    const grid = document.getElementById('modGrid_' + sid);
    if (!grid) return;
    grid.querySelectorAll('.mod-classe-check').forEach(cb => {
      if (niv === 'all')  { cb.checked = true;  return; }
      if (niv === 'none') { cb.checked = false; return; }
      const grp = cb.closest('.mod-niv-groupe');
      cb.checked = (grp?.querySelector('.mod-niv-label')?.textContent === niv);
    });
    previewImpact(sid);
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTIONS PUBLIQUES
  // ══════════════════════════════════════════════════════════════════

  function startNewScenario() {
    const scen = DGHData.addScenario({ nom: 'Nouveau scénario' });
    _scenEditId = scen.id;
    renderPilotage();
  }

  function toggleEditScenario(id) {
    _scenEditId = (_scenEditId === id) ? null : id;
    _renderOngletScenarios();
  }

  function saveModificateur(scenId) {
    const type      = document.getElementById('modType_'    + scenId)?.value || 'dedoublement';
    const discId    = document.getElementById('modDisc_'    + scenId)?.value || '';
    const h         = parseFloat(document.getElementById('modH_' + scenId)?.value) || 0;
    const comment   = document.getElementById('modComment_' + scenId)?.value.trim() || '';
    const nomAutre  = (type === 'autre') ? (document.getElementById('modNomAutre_' + scenId)?.value.trim() || 'Autre') : '';
    const typeHeure = document.querySelector('input[name="modTH_' + scenId + '"]:checked')?.value || 'hsa';
    const ids       = Array.from(document.querySelectorAll('#modGrid_' + scenId + ' .mod-classe-check:checked')).map(c => c.value);
    if (!ids.length || h <= 0) {
      if (typeof app !== 'undefined' && app.toast) app.toast('Sélectionnez au moins une classe et des heures > 0.', 'warning');
      return;
    }
    const structures  = DGHData.getStructures();
    const disciplines = DGHData.getDisciplines();
    const titre = _titreModificateur(type, discId||null, ids, structures, disciplines, nomAutre);
    DGHData.addModificateur(scenId, { type, disciplineId: discId||null, classeIds: ids, heuresParGroupe: h, typeHeure, commentaire: comment, nomAutre, titre });
    renderPilotage();
    if (typeof app !== 'undefined' && app.toast) app.toast('Modalité "' + titre + '" ajoutée.', 'success');
  }

  function deleteModificateur(scenId, modId) {
    DGHData.deleteModificateur(scenId, modId);
    renderPilotage();
  }

  function dupliquerScenario(id) {
    const copy = DGHData.dupliquerScenario(id);
    if (copy) { renderPilotage(); if (typeof app !== 'undefined' && app.toast) app.toast('Scénario dupliqué.', 'success'); }
  }

  function confirmDeleteScenario(id) {
    const scen = DGHData.getScenario(id);
    if (!scen || !confirm('Supprimer "' + scen.nom + '" ?')) return;
    if (_scenEditId === id) _scenEditId = null;
    DGHData.deleteScenario(id);
    renderPilotage();
    if (typeof app !== 'undefined' && app.toast) app.toast('Scénario supprimé.', 'info');
  }

  function setActif(id) {
    const scen = DGHData.getScenario(id);
    if (!scen) return;
    DGHData.setScenarioActif(id);
    renderPilotage();
    if (typeof app !== 'undefined' && app.toast) app.toast('Scénario "' + scen.nom + '" activé.', 'success');
  }

  function desactiverScenario() {
    DGHData.setScenarioActif(null);
    renderPilotage();
    if (typeof app !== 'undefined' && app.toast) app.toast('Scénario désactivé.', 'info');
  }

  /**
   * Appelé quand l'utilisateur change le type de modalité dans le formulaire.
   * - Affiche/masque le champ "Nom" pour le type 'autre'
   * - Met à jour la valeur H par défaut selon le type
   */
  function onTypeChange(select) {
    const form   = select.closest('.scen-form-add');
    if (!form) return;
    const sid    = form.dataset.scenId;
    const type   = select.value;
    const defH   = { 'dedoublement':1, 'co-enseignement':2, 'groupe-effectif-reduit':2, 'groupes-besoins':2, 'autre':1 }[type] || 1;

    // Valeur H par défaut
    const hInput = document.getElementById('modH_' + sid);
    if (hInput) hInput.value = defH;

    // Champ nom pour "autre"
    const wrap = document.getElementById('modNomAutreWrap_' + sid);
    if (wrap) wrap.classList.toggle('is-hidden', type !== 'autre');

    previewImpact(sid);
  }

  function saveNom(el) {
    const id  = el.dataset.scenId;
    const nom = el.value.trim();
    if (!id) return;
    if (!nom) { el.value = DGHData.getScenario(id)?.nom || ''; return; }
    DGHData.updateScenario(id, { nom });
    _renderBannerActif();
  }

  // ══════════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════════════════════════════════
  function _nomsCibles(mod, structures) {
    const ids = mod.classeIds || [];
    if (!ids.length) return '—';
    const parNiv = {};
    structures.forEach(s => { if (!parNiv[s.niveau]) parNiv[s.niveau] = []; parNiv[s.niveau].push(s.id); });
    const idsSet = new Set(ids);
    const noms = [];
    const traites = new Set();
    NIVEAUX_ORD.forEach(niv => {
      if (!parNiv[niv]) return;
      if (parNiv[niv].length > 1 && parNiv[niv].every(id => idsSet.has(id))) {
        noms.push('Tout ' + niv);
        parNiv[niv].forEach(id => traites.add(id));
      }
    });
    ids.forEach(id => { if (!traites.has(id)) { const s = structures.find(x => x.id === id); if (s) noms.push(s.nom); } });
    return noms.join(', ');
  }

  /**
   * Génère un titre lisible pour une modalité.
   * Ex : "Dédoublement 6e SVT", "Co-ens. Toutes 5e", "G.B.I. 4e-3e Mathématiques"
   */
  function _titreModificateur(type, disciplineId, classeIds, structures, disciplines, nomAutre) {
    const tInfo  = TYPES_MOD[type] || { label: type, short: type };
    const labelType = (type === 'autre' && nomAutre) ? nomAutre : tInfo.label;
    const disc   = disciplineId ? disciplines.find(d => d.id === disciplineId) : null;
    const discNom = disc ? disc.nom : '';

    // Résumer les niveaux concernés
    const parNiv = {};
    structures.forEach(s => { if (!parNiv[s.niveau]) parNiv[s.niveau] = []; parNiv[s.niveau].push(s.id); });
    const idsSet = new Set(classeIds || []);
    const nivsComplets = [];
    const nivsPartiel  = new Set();
    NIVEAUX_ORD.forEach(niv => {
      if (!parNiv[niv]) return;
      const tousNiv = parNiv[niv].every(id => idsSet.has(id));
      const certains = parNiv[niv].some(id => idsSet.has(id));
      if (tousNiv)   nivsComplets.push(niv);
      else if (certains) nivsPartiel.add(niv);
    });
    // Classes isolées (niveau non complet)
    const classesIsolees = (classeIds || []).filter(id => {
      const s = structures.find(x => x.id === id);
      return s && !nivsComplets.includes(s.niveau);
    }).map(id => structures.find(x => x.id === id)?.nom).filter(Boolean);

    const niveauStr = [
      ...nivsComplets,
      ...classesIsolees
    ].join(', ') || '—';

    const parts = [labelType, niveauStr];
    if (discNom) parts.push(discNom);
    return parts.join(' · ');
  }

  function _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── API PUBLIQUE ───────────────────────────────────────────────────
  return {
    renderPilotage,
    switchTab,
    startNewScenario,
    toggleEditScenario,
    saveModificateur,
    deleteModificateur,
    dupliquerScenario,
    confirmDeleteScenario,
    setActif,
    desactiverScenario,
    saveNom,
    previewImpact,
    selectionnerNiveau,
    onTypeChange,
    saveAffectation,
    setRecapScen
  };

})();
