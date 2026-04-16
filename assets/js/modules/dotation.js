/**
 * DGH App — Module Dotation DGH
 * Tableau disciplines, groupes de cours, enveloppe HP/HSA.
 *
 * CORRECTION FRAGILITÉ : les addEventListener sur éléments dynamiques
 * (.dot-input-h, .grille-input, .btn-toggle-gc, inputs enveloppe) sont
 * désormais gérés par délégation sur document (via app.js _onGlobalDelegation),
 * plus aucun rebind à chaque rendu.
 */

const DGHDotation = (() => {

  // ── RENDU PRINCIPAL ───────────────────────────────────────────────
  function renderDotation() {
    try {
      const anneeData   = DGHData.getAnnee();
      const bilan       = Calculs.bilanDotation(anneeData);
      const disciplines = DGHData.getDisciplines();
      const repartition = DGHData.getRepartition();
      const structures  = DGHData.getStructures();
      const grilles     = DGHData.getGrilles();
      const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, repartition, grilles);

      // Enveloppe inline — ne pas écraser si l'input est actif
      const inpHP  = document.getElementById('inputEnvHP');
      const inpHSA = document.getElementById('inputEnvHSA');
      if (inpHP  && document.activeElement !== inpHP)  inpHP.value  = bilan.hPosteEnv  || '';
      if (inpHSA && document.activeElement !== inpHSA) inpHSA.value = bilan.hsaEnv     || '';
      _set('dot-env-total', bilan.enveloppe > 0 ? bilan.enveloppe + ' h' : '— h');

      // KPI bar
      _set('dot-kpi-hposte', bilan.totalHP  || 0);
      _set('dot-kpi-hsa',    bilan.totalHSA || 0);
      _set('dot-kpi-nb',     bilan.nbDisciplines);
      const soldeEl  = document.getElementById('dot-kpi-solde');
      const soldeLbl = document.getElementById('dot-kpi-solde-label');
      if (soldeEl) {
        soldeEl.textContent = bilan.enveloppe > 0 ? bilan.solde : '—';
        soldeEl.className   = bilan.depassement ? 'struct-kpi-val dot-solde-neg' : 'struct-kpi-val dot-solde-pos';
      }
      if (soldeLbl) soldeLbl.textContent = bilan.depassement ? 'h dépassement' : 'h solde';

      // Barre duale
      const pctHP  = bilan.enveloppe > 0 ? Math.min(100, Math.round((bilan.totalHP  / bilan.enveloppe)*100)) : 0;
      const pctHSA = bilan.enveloppe > 0 ? Math.min(100-pctHP, Math.round((bilan.totalHSA / bilan.enveloppe)*100)) : 0;
      const barHP  = document.getElementById('dot-bar-hp');
      const barHSA = document.getElementById('dot-bar-hsa');
      if (barHP)  barHP.style.width = pctHP + '%';
      if (barHSA) { barHSA.style.width = pctHSA + '%'; barHSA.style.marginLeft = pctHP + '%'; }
      _set('dot-progress-label', bilan.enveloppe > 0 ? bilan.totalAlloue+' / '+bilan.enveloppe+' h' : '0 / 0 h');
      _set('dot-leg-hp',  bilan.totalHP  + ' h');
      _set('dot-leg-hsa', bilan.totalHSA + ' h');

      // Tableau disciplines
      const listEl = document.getElementById('dot-list'); if (!listEl) return;
      if (disciplines.length === 0) {
        listEl.innerHTML = '<div class="struct-empty"><div class="struct-empty-icon">◎</div>'
          + '<p>Aucune discipline saisie.</p>'
          + '<p class="struct-empty-sub">Cliquez sur \u00ab\u00a0\u2605 Disciplines MEN\u00a0\u00bb pour initialiser les 17 disciplines standard en un clic.</p></div>';
        return;
      }
      const besoinsMap  = {}; besoins.forEach(b => { besoinsMap[b.disciplineId] = b; });
      const niveauxCols = ['6e','5e','4e','3e'].filter(niv => structures.some(s => s.niveau === niv));
      const nbDivParNiv = {};
      structures.forEach(s => { nbDivParNiv[s.niveau] = (nbDivParNiv[s.niveau]||0) + 1; });
      const nbCols = 2 + niveauxCols.length + 6;

      let colsHead = niveauxCols.map(niv =>
        '<th class="col-num col-grille" title="' + niv + ' \u2014 h/div/semaine MEN (modifiable)">' + niv + '</th>'
      ).join('');

      let html = '<table class="dot-table dot-table-grille"><thead><tr>'
        + '<th></th><th>Discipline</th>'
        + colsHead
        + '<th class="col-num">Besoin r\u00e9el</th>'
        + '<th class="col-num dot-col-hp">H-Poste</th>'
        + '<th class="col-num dot-col-hsa">HSA</th>'
        + '<th class="col-num">Total</th>'
        + '<th class="col-num">\u00c9cart</th>'
        + '<th class="col-bar">Part</th>'
        + '<th class="col-actions">Actions</th>'
        + '</tr></thead><tbody>';

      disciplines.forEach(disc => {
        const b      = besoinsMap[disc.id] || { besoinTheorique:0, besoinMEN:0, hPoste:0, hsa:0, total:0, ecart:0, groupesCours:[], heuresGroupes:0, hasGroupes:false, grilleLignes:{} };
        const pctBar = bilan.enveloppe > 0 ? Math.min(100, Math.round((b.total / bilan.enveloppe)*100)) : 0;
        const ecartCls = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
        const nbGC   = (b.groupesCours||[]).length;

        let colsCells = niveauxCols.map(niv => {
          const gl  = b.grilleLignes && b.grilleLignes[niv] ? b.grilleLignes[niv] : { men: null, valeur: '', modifie: false };
          const placeholder = (gl.men !== null && gl.men !== undefined) ? gl.men : '';
          const val = (gl.valeur !== null && gl.valeur !== undefined && gl.valeur !== '') ? gl.valeur : '';
          const cls = gl.modifie ? ' grille-input-modifie' : '';
          const nb  = nbDivParNiv[niv] || 0;
          const hTot = val !== '' ? Math.round(parseFloat(val)*nb*2)/2 : (placeholder !== '' ? Math.round(parseFloat(placeholder)*nb*2)/2 : null);
          const tip = 'MEN\u00a0: ' + (placeholder||'\u2014') + '\u00a0h \u00d7 ' + nb + ' div = ' + (hTot !== null ? hTot + '\u00a0h' : '\u2014');
          return '<td class="col-num col-grille">'
            + '<input type="number" class="grille-input' + cls
            + '" data-disc-nom="' + _esc(disc.nom)
            + '" data-niveau="' + niv
            + '" data-men="' + placeholder
            + '" value="' + val
            + '" placeholder="' + placeholder
            + '" min="0" step="0.5" title="' + tip + '" />'
            + (hTot !== null ? '<span class="grille-col-total">' + hTot + 'h</span>' : '')
            + '</td>';
        }).join('');

        html += '<tr class="dot-disc-row">'
          + '<td class="col-toggle">'
          + '<button class="btn-toggle-gc" data-disc-id="' + disc.id + '" title="Groupes de cours">\u25b6</button>'
          + '</td>'
          + '<td><span class="disc-color-dot" style="background:' + _esc(disc.couleur) + '"></span><strong class="div-nom">' + _esc(disc.nom) + '</strong>'
          + (nbGC > 0 ? '<span class="gc-count-badge">' + nbGC + ' groupe' + (nbGC>1?'s':'') + '</span>' : '') + '</td>'
          + colsCells
          + '<td class="col-num dot-theorique">' + (b.hasGroupes
            ? (b.heuresGroupesReel||b.heuresGroupes) + ' h <span class="dot-besoin-gc-tag" title="' + (b.groupesCours||[]).map(gc=>(gc.nom||'?')+'\u00a0: '+(gc.heures||0)+'h\u00d7'+(gc.classesIds&&gc.classesIds.length>0?gc.classesIds.length:1)).join(' | ') + '">GC</span>'
            + (b.besoinMEN > 0 ? '<br><small class="dot-besoin-men-hint">MEN\u00a0: ' + b.besoinMEN + ' h</small>' : '')
            : (b.besoinTheorique > 0 ? b.besoinTheorique + ' h' : '<span class="no-tag">\u2014</span>')) + '</td>'
          + '<td class="col-num"><input type="number" class="dot-input-h dot-input-hp" data-disc-id="' + disc.id + '" data-field="hPoste" value="' + b.hPoste + '" min="0" step="0.5" /></td>'
          + '<td class="col-num"><input type="number" class="dot-input-h dot-input-hsa" data-disc-id="' + disc.id + '" data-field="hsa" value="' + b.hsa + '" min="0" step="0.5" /></td>'
          + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + b.total + ' h</strong></td>'
          + '<td class="col-num dot-ecart-cell">' + _renderEcartCell(b, disc.id, ecartCls) + '</td>'
          + '<td class="col-bar"><div class="dot-bar-track"><div class="dot-bar-fill" style="width:' + pctBar + '%;background:' + _esc(disc.couleur) + '"></div></div><span class="dot-bar-pct">' + pctBar + '%</span></td>'
          + '<td class="col-actions">'
          + '<button class="btn-icon-sm btn-add-gc" data-action="add-gc" data-disc-id="' + disc.id + '" title="Ajouter un groupe de cours">+</button>'
          + '<button class="btn-icon-sm" data-action="edit-disc" data-id="' + disc.id + '" title="Modifier">\u270e</button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-disc" data-id="' + disc.id + '" title="Supprimer">\u2715</button>'
          + '</td></tr>';

        // Sous-lignes groupes de cours
        html += '<tr class="gc-subrows-row" id="gc-sub-' + disc.id + '" style="display:none"><td colspan="' + nbCols + '"><div class="gc-subrows">';
        if (b.groupesCours.length === 0) {
          html += '<div class="gc-empty">Aucun groupe de cours \u2014 cliquez sur + pour en ajouter (ex. LV2 Espagnol, LV2 Allemand\u2026)</div>';
        } else {
          b.groupesCours.forEach(gc => {
            const classesLabel = gc.classesNoms && gc.classesNoms.length > 0 ? gc.classesNoms.join(', ') : '\u2014';
            html += '<div class="gc-subrow">'
              + '<span class="gc-arrow">\u2514</span>'
              + '<span class="gc-nom"><strong>' + _esc(gc.nom||'\u2014') + '</strong></span>'
              + '<span class="gc-classes">' + _esc(classesLabel) + '</span>'
              + '<span class="gc-effectif">' + (gc.effectif||0) + ' \u00e9l\u00e8ves</span>'
              + '<span class="gc-heures" style="font-family:\'JetBrains Mono\',monospace;font-weight:700">' + (gc.heures||0) + ' h/sem</span>'
              + '<span class="gc-actions">'
              + '<button class="btn-icon-sm" data-action="edit-gc" data-disc-id="' + disc.id + '" data-gc-id="' + gc.id + '" title="Modifier">\u270e</button>'
              + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-gc" data-disc-id="' + disc.id + '" data-gc-id="' + gc.id + '" title="Supprimer">\u2715</button>'
              + '</span></div>';
          });
          if (b.heuresGroupes > 0) {
            html += '<div class="gc-total-row"><span>Total groupes de cours\u00a0:</span><strong style="font-family:\'JetBrains Mono\',monospace">' + (b.heuresGroupesReel||b.heuresGroupes) + ' h/sem</strong></div>';
          }
        }
        html += '</div></td></tr>';
      });

      // tfoot
      let tfootHtml = '<tfoot class="dot-tfoot"><tr class="dot-total-row"><td></td><td><strong>Total</strong></td>';
      niveauxCols.forEach(niv => {
        const nb = nbDivParNiv[niv] || 0;
        let hParDivTotal = 0;
        besoins.forEach(b => {
          const gl = b.grilleLignes && b.grilleLignes[niv];
          const hParDiv = (gl && gl.valeur !== null && gl.valeur !== undefined && gl.valeur !== '')
            ? parseFloat(gl.valeur)
            : (gl && gl.men !== null && gl.men !== undefined ? parseFloat(gl.men) : 0);
          hParDivTotal += hParDiv || 0;
        });
        const hParDivTotalR = Math.round(hParDivTotal * 2) / 2;
        const hTotalNiv    = Math.round(hParDivTotal * nb * 2) / 2;
        tfootHtml += '<td class="col-num col-grille">'
          + '<div class="grille-tfoot-cell">'
          + '<strong style="font-family:\'JetBrains Mono\',monospace">' + hParDivTotalR + '\u00a0h</strong>'
          + '<span class="grille-col-total">' + hTotalNiv + 'h \u00d7' + nb + '</span>'
          + '</div>'
          + '</td>';
      });
      const tfBesoin = Math.round(besoins.reduce((s,b) => s + (b.besoinTheorique||0), 0) * 2) / 2;
      tfootHtml += '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + tfBesoin + ' h</strong></td>';
      const tfHP  = Math.round(besoins.reduce((s,b) => s + (b.hPoste||0), 0) * 2) / 2;
      tfootHtml += '<td class="col-num dot-col-hp"><strong style="font-family:\'JetBrains Mono\',monospace">' + tfHP + ' h</strong></td>';
      const tfHSA = Math.round(besoins.reduce((s,b) => s + (b.hsa||0), 0) * 2) / 2;
      tfootHtml += '<td class="col-num dot-col-hsa"><strong style="font-family:\'JetBrains Mono\',monospace">' + tfHSA + ' h</strong></td>';
      const tfAll = Math.round((tfHP + tfHSA) * 2) / 2;
      tfootHtml += '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace;color:var(--c-accent)">' + tfAll + ' h</strong></td>';
      const tfEcart = Math.round((tfAll - tfBesoin) * 2) / 2;
      const tfEcCls = tfEcart > 0 ? 'dot-ecart-over' : tfEcart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
      tfootHtml += '<td class="col-num"><span class="dot-ecart ' + tfEcCls + '"><strong>' + (tfEcart >= 0 ? '+' : '') + tfEcart + ' h</strong></span></td>';
      tfootHtml += '<td class="col-bar"></td><td class="col-actions"></td></tr></tfoot>';
      listEl.innerHTML = html + '</tbody>' + tfootHtml + '</table>';

      // Total bar
      const totalBar = document.getElementById('dotTotalBar');
      if (totalBar && disciplines.length > 0) {
        totalBar.classList.remove('is-hidden');
        const totHP  = besoins.reduce((s,b) => s + (b.hPoste||0), 0);
        const totHSA = besoins.reduce((s,b) => s + (b.hsa||0), 0);
        _set('dot-total-hp-val',  Math.round(totHP*2)/2  + ' h');
        _set('dot-total-hsa-val', Math.round(totHSA*2)/2 + ' h');
        _set('dot-total-sum-val', Math.round((totHP+totHSA)*2)/2 + ' h');
      } else if (totalBar) { totalBar.classList.add('is-hidden'); }

    } catch(err) { console.error('[DGH] renderDotation:', err); }
  }

  // ── CELLULE ÉCART ─────────────────────────────────────────────────
  function _renderEcartCell(b, discId, ecartCls) {
    if (!b || b.besoinTheorique <= 0) return '<span class="dot-ecart dot-ecart-ok">\u2014</span>';
    const ecart = b.ecart;
    const sign  = ecart >= 0 ? '+' : '';
    if (ecart === 0) return '<span class="dot-ecart dot-ecart-ok">+0 h</span>';
    const tipText = 'Cliquer : HP \u2192 ' + b.besoinTheorique + '\u00a0h · HSA \u2192 0\u00a0h (\u00e9cart = 0)';
    return '<button class="dot-ecart ' + ecartCls + ' dot-ecart-btn"'
      + ' data-action="ecart-zero"'
      + ' data-disc-id="' + _esc(discId) + '"'
      + ' data-besoin="' + b.besoinTheorique + '"'
      + ' title="' + _esc(tipText) + '">'
      + sign + ecart + '\u00a0h \u2731'
      + '</button>';
  }

  // ── SAVE ENVELOPPE (délégué via document change) ──────────────────
  function saveEnveloppe() {
    const hp  = parseFloat(document.getElementById('inputEnvHP')?.value)  || 0;
    const hsa = parseFloat(document.getElementById('inputEnvHSA')?.value) || 0;
    DGHData.setDotation(hp, hsa);
    _set('dot-env-total', (hp+hsa) > 0 ? (hp+hsa)+' h' : '— h');
    renderDotation(); DGHDashboard.renderDashboard();
  }

  // ── TOGGLE GC (délégué) ───────────────────────────────────────────
  function handleToggleGC(discId) {
    const subRow = document.getElementById('gc-sub-' + discId); if (!subRow) return;
    const btn    = document.querySelector('[data-disc-id="' + discId + '"].btn-toggle-gc');
    const open   = subRow.style.display !== 'none';
    subRow.style.display = open ? 'none' : '';
    if (btn) btn.textContent = open ? '\u25b6' : '\u25bc';
  }

  // ── DÉPLIER TOUS LES GROUPES ──────────────────────────────────────
  function toggleAllGC() {
    const btn = document.getElementById('btnToggleAllGC'); if (!btn) return;
    const allSubRows = document.querySelectorAll('[id^="gc-sub-"]');
    if (allSubRows.length === 0) return;
    const allOpen   = Array.from(allSubRows).every(r => r.style.display !== 'none');
    const shouldOpen = !allOpen;
    allSubRows.forEach(r => { r.style.display = shouldOpen ? '' : 'none'; });
    document.querySelectorAll('.btn-toggle-gc').forEach(b => { b.textContent = shouldOpen ? '\u25bc' : '\u25b6'; });
    btn.textContent = shouldOpen ? '\u22df Tout replier' : '\u22de Tout déplier';
  }

  // ── HANDLE INPUT HP/HSA (délégué) ────────────────────────────────
  function handleDotInput(target) {
    const id    = target.dataset.discId;
    const field = target.dataset.field;
    const val   = parseFloat(target.value) || 0;
    if (id && field) { DGHData.setRepartition(id, { [field]: val }); renderDotation(); DGHDashboard.renderDashboard(); }
  }

  // ── HANDLE GRILLE INPUT (délégué) ────────────────────────────────
  function handleGrilleInput(target) {
    const discNom = target.dataset.discNom;
    const niv     = target.dataset.niveau;
    const men     = parseFloat(target.dataset.men);
    const val     = target.value !== '' ? parseFloat(target.value) : null;
    if (val === null || val === men) DGHData.setGrille(discNom, niv, null);
    else DGHData.setGrille(discNom, niv, val);
    renderDotation(); DGHDashboard.renderDashboard();
  }

  function handleGrilleReset(target) {
    DGHData.setGrille(target.dataset.discNom, target.dataset.niveau, null);
    renderDotation(); DGHDashboard.renderDashboard();
  }

  // ── MODAL DISCIPLINE ──────────────────────────────────────────────
  function openModalDisc(id) {
    const modal = document.getElementById('modalDisc'); if (!modal) return;
    if (id) {
      const disc = DGHData.getDiscipline(id); if (!disc) return;
      _set('modalDiscTitle','Modifier la discipline'); _setVal('modalDiscId',id);
      _setVal('inputDiscNom',disc.nom); _setVal('inputDiscCouleur',disc.couleur||'#2d6a4f');
      _updateColorHint(disc.couleur||'#2d6a4f');
    } else {
      _set('modalDiscTitle','Ajouter une discipline'); _setVal('modalDiscId','');
      _setVal('inputDiscNom',''); _setVal('inputDiscCouleur','#2d6a4f'); _updateColorHint('#2d6a4f');
    }
    modal.classList.add('modal-open');
    setTimeout(()=>document.getElementById('inputDiscNom')?.focus(),60);
  }

  function updateColorHint(v) {
    const h=document.getElementById('colorHint'); if(h) h.textContent=v;
  }

  function _updateColorHint(v) { updateColorHint(v); }

  function closeModalDisc() {
    const m=document.getElementById('modalDisc'); if(m) m.classList.remove('modal-open');
  }

  function saveModalDisc() {
    const id  = document.getElementById('modalDiscId')?.value||'';
    const nom = (document.getElementById('inputDiscNom')?.value||'').trim();
    if (!nom) { app.toast('Le nom est requis','warning'); return; }
    const couleur = document.getElementById('inputDiscCouleur')?.value||'#2d6a4f';
    if (id) { DGHData.updateDiscipline(id,{nom,couleur}); app.toast('Discipline mise à jour','success'); }
    else    { DGHData.addDiscipline({nom,couleur}); app.toast('Discipline \u00ab\u00a0'+nom+'\u00a0\u00bb ajoutée','success'); }
    closeModalDisc(); renderDotation(); DGHDashboard.renderDashboard();
  }

  function confirmDeleteDisc(id) {
    const disc=DGHData.getDiscipline(id); if(!disc) return;
    const m=document.getElementById('confirmDisc'); if(!m) return;
    _set('confirmDiscMsg','Supprimer \u00ab\u00a0'+disc.nom+'\u00a0\u00bb ?');
    m.dataset.targetId=id; m.classList.add('modal-open');
  }

  function closeConfirmDisc() {
    const m=document.getElementById('confirmDisc'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';}
  }

  function execDeleteDisc() {
    const id=document.getElementById('confirmDisc')?.dataset?.targetId; if(!id) return;
    DGHData.deleteDiscipline(id); closeConfirmDisc(); renderDotation(); DGHDashboard.renderDashboard();
    app.toast('Discipline supprimée','info');
  }

  // ── SUGGESTION HP ─────────────────────────────────────────────────
  function suggererHP() {
    const ann = DGHData.getAnnee();
    if ((ann.dotation.hPosteEnveloppe||0) === 0) { app.toast('Saisissez d\'abord l\'enveloppe H-Poste','warning'); return; }
    if ((ann.structures||[]).length === 0) { app.toast('Saisissez d\'abord les structures de classes','warning'); return; }
    const suggestions = Calculs.suggererRepartition(ann);
    if (suggestions.length === 0) { app.toast('Impossible de calculer des suggestions','warning'); return; }
    suggestions.forEach(s => { DGHData.setRepartition(s.disciplineId, { hPoste: s.suggested }); });
    renderDotation(); DGHDashboard.renderDashboard();
    app.toast('Suggestion appliquée sur '+suggestions.length+' discipline(s) — ajustez selon votre TRM','success', 5000);
  }

  // ── ÉCART ZÉRO ────────────────────────────────────────────────────
  // Clic sur le bouton écart : HP = besoin théorique, HSA remises à 0
  function ecartZero(discId, besoin) {
    if (!discId || besoin <= 0) return;
    DGHData.setRepartition(discId, { hPoste: besoin, hsa: 0 });
    renderDotation(); DGHDashboard.renderDashboard();
    app.toast('HP \u2192 ' + besoin + '\u00a0h · HSA \u2192 0\u00a0h — écart = 0', 'success', 3000);
  }

  // ── MODAL GROUPE DE COURS ─────────────────────────────────────────
  function openModalGC(discId, gcId) {
    const modal = document.getElementById('modalGC'); if (!modal) return;
    _setVal('modalGCDiscId', discId);
    _setVal('modalGCId', gcId||'');

    const classesDiv  = document.getElementById('gcClassesCheck');
    const structures  = DGHData.getStructures();
    if (classesDiv) {
      if (structures.length === 0) {
        classesDiv.innerHTML = '<p class="form-hint">Aucune division saisie \u2014 <button class="btn-link" data-navigate="structures">ajoutez d\'abord vos classes</button></p>';
      } else {
        classesDiv.innerHTML = structures.map(div =>
          '<label class="niv-check-label">'
          + '<input type="checkbox" class="classe-check" value="' + div.id + '" />'
          + '<span>' + _esc(div.nom) + ' <small style="color:var(--c-text-dim)">(' + (div.effectif||0) + ')</small></span>'
          + '</label>'
        ).join('');
      }
    }

    const disc = DGHData.getDiscipline(discId);
    const hint = document.getElementById('inputGCHeuresHint');
    if (hint && disc) {
      const grille = Calculs.GRILLES_MEN;
      const hParNiv = Object.entries(grille)
        .filter(([,g]) => g[disc.nom])
        .map(([niv,g]) => niv + ':' + g[disc.nom] + 'h')
        .join(', ');
      hint.textContent = hParNiv ? 'Grille MEN : ' + hParNiv : '';
    }

    if (gcId) {
      const gc = DGHData.getGroupeCours(discId, gcId); if (!gc) return;
      _set('modalGCTitle', 'Modifier le groupe de cours');
      _setVal('inputGCNom', gc.nom); _setVal('inputGCHeures', gc.heures); _setVal('inputGCComment', gc.commentaire||'');
      (gc.classesIds||[]).forEach(id => { const cb=classesDiv?.querySelector('[value="'+id+'"]'); if(cb) cb.checked=true; });
    } else {
      _set('modalGCTitle', 'Ajouter un groupe de cours pour ' + (disc ? disc.nom : ''));
      _setVal('inputGCNom',''); _setVal('inputGCHeures',''); _setVal('inputGCComment','');
    }

    updateGCEffectif();
    const btnGCAll = document.getElementById('btnGCSelectAll');
    if (btnGCAll) btnGCAll.textContent = 'Tout sélectionner';
    modal.classList.add('modal-open');
    setTimeout(()=>document.getElementById('inputGCNom')?.focus(),60);
  }

  function updateGCEffectif() {
    const checked = Array.from(document.querySelectorAll('#gcClassesCheck .classe-check:checked'));
    const total   = checked.reduce((s,cb) => { const div=DGHData.getDivision(cb.value); return s+(div?div.effectif||0:0); }, 0);
    const efDiv   = document.getElementById('gcEffectifAuto');
    if (efDiv) efDiv.textContent = checked.length > 0 ? 'Effectif calculé : ' + total + ' élèves (' + checked.length + ' classe(s))' : '';
  }

  function closeModalGC() {
    const m=document.getElementById('modalGC'); if(m) m.classList.remove('modal-open');
  }

  function saveModalGC() {
    const discId = document.getElementById('modalGCDiscId')?.value||''; if (!discId) return;
    const gcId   = document.getElementById('modalGCId')?.value||'';
    const nom    = (document.getElementById('inputGCNom')?.value||'').trim();
    if (!nom) { app.toast('Le nom du groupe est requis','warning'); return; }
    const classesIds = Array.from(document.querySelectorAll('#gcClassesCheck .classe-check:checked')).map(cb=>cb.value);
    const fields = { nom, classesIds, heures: parseFloat(document.getElementById('inputGCHeures')?.value)||0, commentaire: document.getElementById('inputGCComment')?.value||'' };
    if (gcId) { DGHData.updateGroupeCours(discId, gcId, fields); app.toast('Groupe mis à jour','success'); }
    else      { DGHData.addGroupeCours(discId, fields); app.toast('Groupe \u00ab\u00a0'+nom+'\u00a0\u00bb ajouté','success'); }
    closeModalGC(); renderDotation();
    // Rouvrir le panneau de la discipline
    const subRow = document.getElementById('gc-sub-'+discId);
    if (subRow) { subRow.style.display=''; const btn=document.querySelector('[data-disc-id="'+discId+'"].btn-toggle-gc'); if(btn) btn.textContent='\u25bc'; }
  }

  function gcSelectAllClasses() {
    const allChecked = Array.from(document.querySelectorAll('#gcClassesCheck .classe-check'));
    const anyUnchecked = allChecked.some(cb => !cb.checked);
    allChecked.forEach(cb => { cb.checked = anyUnchecked; });
    updateGCEffectif();
    const btn = document.getElementById('btnGCSelectAll');
    if (btn) btn.textContent = anyUnchecked ? 'Tout désélectionner' : 'Tout sélectionner';
  }

  function confirmDeleteGC(discId, gcId) {
    const gc = DGHData.getGroupeCours(discId, gcId); if (!gc) return;
    const m  = document.getElementById('confirmGC'); if (!m) return;
    _set('confirmGCMsg','Supprimer le groupe \u00ab\u00a0'+gc.nom+'\u00a0\u00bb ?');
    m.dataset.discId = discId; m.dataset.gcId = gcId; m.classList.add('modal-open');
  }

  function closeConfirmGC() {
    const m=document.getElementById('confirmGC'); if(m){m.classList.remove('modal-open');delete m.dataset.discId;delete m.dataset.gcId;}
  }

  function execDeleteGC() {
    const m=document.getElementById('confirmGC'); if(!m) return;
    DGHData.deleteGroupeCours(m.dataset.discId, m.dataset.gcId);
    closeConfirmGC(); renderDotation(); app.toast('Groupe supprimé','info');
  }

  // ── UTILITAIRES LOCAUX ────────────────────────────────────────────
  function _set(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
  function _setVal(id,val){const el=document.getElementById(id);if(el)el.value=val;}
  function _esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  return {
    renderDotation,
    saveEnveloppe, handleToggleGC, toggleAllGC, handleDotInput, handleGrilleInput, handleGrilleReset,
    openModalDisc, closeModalDisc, saveModalDisc, updateColorHint,
    confirmDeleteDisc, closeConfirmDisc, execDeleteDisc,
    suggererHP, ecartZero,
    openModalGC, closeModalGC, saveModalGC, updateGCEffectif, gcSelectAllClasses,
    confirmDeleteGC, closeConfirmGC, execDeleteGC
  };

})();
