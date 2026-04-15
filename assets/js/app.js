/**
 * DGH App — Contrôleur principal v2.7
 * Règle permanente : délégation globale unique _onGlobalClick pour tous les boutons.
 * Jamais de listener direct sur un bouton à rendu conditionnel ou tardif.
 *
 * v2.6 — Corrections audit (voir CHANGELOG)
 * v2.7 — Sprint 3 : module Dotation DGH, CRUD disciplines, répartition inline
 */

const app = (() => {

  const VIEWS = {
    dashboard:   'Tableau de bord',
    structures:  'Structures',
    dotation:    'Dotation DGH',
    enseignants: 'Enseignants',
    simulation:  'Simulation',
    alertes:     'Alertes',
    synthese:    'Synthèses',
    historique:  'Historique'
  };

  // ── INIT ─────────────────────────────────────────────────────────
  function init() {
    _applyTheme(localStorage.getItem('dgh-theme') || 'light');
    DGHData.init();
    _bindEvents();
    _renderAll();
    navigate('dashboard');
  }

  // ── THÈME ────────────────────────────────────────────────────────
  function _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dgh-theme', theme);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☽' : '☀︎';
  }

  // ── NAVIGATION ───────────────────────────────────────────────────
  function navigate(viewId) {
    if (!VIEWS[viewId]) return;

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));

    const viewEl = document.getElementById('view-' + viewId);
    const navEl  = document.querySelector('.nav-item[data-view="' + viewId + '"]');
    if (viewEl) viewEl.classList.add('active');
    if (navEl)  navEl.classList.add('active');

    const bc = document.getElementById('breadcrumb');
    if (bc) bc.textContent = VIEWS[viewId];

    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
    }

    if (viewId === 'dashboard')  _renderDashboard();
    if (viewId === 'alertes')    _renderAlertes();
    if (viewId === 'structures') _renderStructures();
    if (viewId === 'dotation')   _renderDotation();
  }

  // ── DASHBOARD ────────────────────────────────────────────────────
  function _renderDashboard() {
    try {
      const data    = DGHData.getAnnee();
      const bilan   = Calculs.bilanDGH(data);
      const alertes = Calculs.genererAlertes(data);
      const resume  = Calculs.resumeStructures(DGHData.getStructures());

      _set('dashYear',          DGHData.getAnneeActive().replace('-', '–'));
      _set('kpi-dghtotal',      bilan.enveloppe      ? bilan.enveloppe + ' h'      : '— h');
      _set('kpi-affectees',     bilan.heuresAllouees ? bilan.heuresAllouees + ' h' : '— h');
      _set('kpi-affectees-pct', bilan.enveloppe      ? bilan.pctConsomme + ' %'    : '— %');
      _set('kpi-solde',         bilan.enveloppe      ? bilan.solde + ' h'          : '— h');
      _set('kpi-alertes',       alertes.filter(a => a.severite !== 'info').length || '—');
      _set('kpi-enseignants',   bilan.nbEnseignants || '—');
      _set('kpi-tzr',           'dont ' + (bilan.nbTZR || 0) + ' TZR');
      _set('kpi-hsa',           bilan.totalHSA ? bilan.totalHSA + ' h' : '— h');
      _set('kpi-divisions',     resume.nbDivisions || '—');
      _set('kpi-effectif',      resume.effectifTotal ? resume.effectifTotal + ' élèves' : '— élèves');

      // Badge alertes sidebar
      const nb    = alertes.filter(a => a.severite === 'error' || a.severite === 'warning').length;
      const badge = document.getElementById('badge-alertes');
      if (badge) { badge.textContent = nb || ''; badge.style.display = nb ? '' : 'none'; }

      // Stats topbar
      const stats = document.getElementById('topbarStats');
      if (stats) {
        stats.innerHTML = bilan.enveloppe > 0
          ? '<div class="topbar-stat"><span>DGH</span><span class="topbar-stat-val">' + bilan.enveloppe + 'h</span></div>'
          + '<div class="topbar-stat"><span>Affecté</span><span class="topbar-stat-val">' + bilan.pctConsomme + '%</span></div>'
          + '<div class="topbar-stat"><span>Solde</span><span class="topbar-stat-val">' + bilan.solde + 'h</span></div>'
          : '';
      }

      // Barre progression
      const bar = document.getElementById('progressBar');
      const lbl = document.getElementById('progress-label');
      if (bar) {
        const pct = bilan.enveloppe > 0 ? Math.min(100, bilan.pctConsomme) : 0;
        bar.style.width      = pct + '%';
        bar.style.background = pct > 100 ? 'var(--c-red)' : pct > 90 ? 'var(--c-amber)' : 'var(--c-accent)';
      }
      if (lbl) lbl.textContent = bilan.enveloppe > 0
        ? bilan.heuresAllouees + ' / ' + bilan.enveloppe + ' h' : '0 / 0 h';

      // Empty state
      const isEmpty  = DGHData.isEmpty();
      const emptyEl  = document.getElementById('emptyState');
      const resumeEl = document.getElementById('disciplineResume');
      if (emptyEl)  emptyEl.style.display  = isEmpty ? '' : 'none';
      if (resumeEl) resumeEl.style.display = isEmpty ? 'none' : '';

    } catch(e) {
      console.error('[DGH] Erreur renderDashboard:', e);
    }

    _updateBtnEtab();
  }

  // ── BOUTON ÉTABLISSEMENT ─────────────────────────────────────────
  function _updateBtnEtab() {
    const btn = document.getElementById('btnEtab');
    if (!btn) return;
    try {
      const etab = DGHData.getEtab() || {};
      btn.textContent = (etab.nom && etab.nom.trim()) ? etab.nom.trim() + ' ⚙' : 'Mon Collège ⚙';
    } catch(e) {
      btn.textContent = 'Mon Collège ⚙';
    }
  }

  // ── MODULE STRUCTURES ────────────────────────────────────────────
  function _renderStructures() {
    try {
      const structures = DGHData.getStructures();
      const resume     = Calculs.resumeStructures(structures);

      _set('struct-kpi-divisions', resume.nbDivisions);
      _set('struct-kpi-effectif',  resume.effectifTotal);
      const niveauxEl = document.getElementById('struct-kpi-niveaux');
      if (niveauxEl) niveauxEl.textContent = resume.niveauxPresents.join(', ') || '—';

      const byNiveauEl = document.getElementById('struct-by-niveau');
      if (byNiveauEl) {
        byNiveauEl.innerHTML = resume.parNiveau.map(n =>
          '<div class="niveau-row">'
          + '<span class="niveau-badge niveau-' + n.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + n.niveau + '</span>'
          + '<span class="niveau-count">' + n.nbDivisions + ' div.</span>'
          + '<span class="niveau-effectif">' + n.effectif + ' élèves</span>'
          + '</div>'
        ).join('');
      }

      const listEl = document.getElementById('struct-list');
      if (!listEl) return;

      if (structures.length === 0) {
        listEl.innerHTML =
          '<div class="struct-empty">'
          + '<div class="struct-empty-icon">⊞</div>'
          + '<p>Aucune division saisie pour cette année.</p>'
          + '<p class="struct-empty-sub">Cliquez sur «\u00a0Ajouter une division\u00a0» pour commencer.</p>'
          + '</div>';
        return;
      }

      let html = '<table class="struct-table">'
        + '<thead><tr>'
        + '<th>Division</th><th>Niveau</th><th>Effectif</th>'
        + '<th>Options / Dispositif</th><th class="col-actions">Actions</th>'
        + '</tr></thead><tbody>';

      structures.forEach(div => {
        const tags = [];
        (div.options || []).forEach(o => tags.push('<span class="div-tag">' + _esc(o) + '</span>'));
        if (div.dispositif) tags.push('<span class="div-tag div-tag-disp">' + _esc(div.dispositif) + '</span>');

        html += '<tr>'
          + '<td><strong class="div-nom">' + _esc(div.nom || '—') + '</strong></td>'
          + '<td><span class="niveau-badge niveau-' + div.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + _esc(div.niveau) + '</span></td>'
          + '<td><span class="div-effectif">' + (div.effectif || 0) + '</span></td>'
          + '<td class="div-tags-cell">' + (tags.length ? tags.join('') : '<span class="no-tag">—</span>') + '</td>'
          + '<td class="col-actions">'
          + '<button class="btn-icon-sm" data-action="edit-div" data-id="' + div.id + '" title="Modifier">✎</button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-div" data-id="' + div.id + '" title="Supprimer">✕</button>'
          + '</td></tr>';
      });

      listEl.innerHTML = html + '</tbody></table>';

    } catch(e) {
      console.error('[DGH] Erreur renderStructures:', e);
    }
  }

  // ── MODAL DIVISION ────────────────────────────────────────────────
  function _openModalDiv(id) {
    const modal  = document.getElementById('modalDiv');
    const title  = document.getElementById('modalDivTitle');
    const saveId = document.getElementById('modalDivId');
    if (!modal) return;

    const sel = document.getElementById('inputDivNiveau');
    if (sel) {
      sel.innerHTML = DGHData.getNiveaux()
        .map(n => '<option value="' + n + '">' + n + '</option>').join('');
    }

    const dupGroup = document.getElementById('dupGroup');

    if (id) {
      const div = DGHData.getDivision(id);
      if (!div) return;
      if (title)  title.textContent = 'Modifier la division';
      if (saveId) saveId.value      = id;
      if (sel)    sel.value         = div.niveau;
      _setVal('inputDivNom',        div.nom);
      _setVal('inputDivEffectif',   div.effectif);
      _setVal('inputDivOptions',    (div.options || []).join(', '));
      _setVal('inputDivDispositif', div.dispositif || '');
      // En mode édition : masquer la duplication
      if (dupGroup) dupGroup.style.display = 'none';
    } else {
      if (title)  title.textContent = 'Ajouter une division';
      if (saveId) saveId.value      = '';
      if (sel)    sel.value         = '6e';
      _setVal('inputDivNom',        '');
      _setVal('inputDivEffectif',   '');
      _setVal('inputDivOptions',    '');
      _setVal('inputDivDispositif', '');
      _setVal('inputDivDup',        '0');
      // En mode ajout : afficher la duplication
      if (dupGroup) dupGroup.style.display = '';
    }

    modal.classList.add('modal-open');
    setTimeout(() => { const f = document.getElementById('inputDivNom'); if (f) f.focus(); }, 60);
  }

  /** Met à jour la preview de duplication en temps réel */
  function _updateDupPreview() {
    const preview = document.getElementById('dupPreview');
    if (!preview) return;
    const nomInput = document.getElementById('inputDivNom');
    const dupInput = document.getElementById('inputDivDup');
    if (!nomInput || !dupInput) return;

    const nom      = nomInput.value.trim();
    const dupCount = parseInt(dupInput.value, 10) || 0;

    if (!nom || dupCount <= 0) {
      preview.innerHTML = '';
      return;
    }

    // Calculer les noms qui seront créés (logique miroir de data.js)
    const noms = [nom];
    let cur = nom;
    for (let i = 0; i < dupCount; i++) {
      cur = _previewNextName(cur);
      noms.push(cur);
    }

    preview.innerHTML = '<span class="dup-preview-label">Sera créé\u00a0:</span>'
      + noms.map(n => '<span class="dup-preview-chip">' + _esc(n) + '</span>').join('');
  }

  /**
   * Miroir de DGHData._nextDivName — fonction pure côté UI pour la preview.
   * Doit rester synchronisée avec data.js.
   */
  function _previewNextName(nom) {
    if (!nom) return nom;
    // Suffixe numérique
    const numM = nom.match(/^(.*?)(\d+)$/);
    if (numM) {
      const n      = parseInt(numM[2], 10) + 1;
      const padded = numM[2].length > 1 ? String(n).padStart(numM[2].length, '0') : String(n);
      return numM[1] + padded;
    }
    // Suffixe lettres majuscules
    const majM = nom.match(/^(.*?)([A-Z]+)$/);
    if (majM) return majM[1] + _nextAlpha(majM[2]);
    // Suffixe lettres minuscules
    const minM = nom.match(/^(.*?)([a-z]+)$/);
    if (minM) return minM[1] + _nextAlpha(minM[2].toUpperCase()).toLowerCase();
    return nom + '2';
  }

  function _nextAlpha(s) {
    const chars = s.split('');
    let i = chars.length - 1;
    while (i >= 0) {
      const code = chars[i].charCodeAt(0);
      if (code < 90) { chars[i] = String.fromCharCode(code + 1); return chars.join(''); }
      chars[i] = 'A';
      i--;
    }
    return 'A' + chars.join('');
  }

  function _closeModalDiv() {
    const m = document.getElementById('modalDiv');
    if (m) m.classList.remove('modal-open');
    const preview = document.getElementById('dupPreview');
    if (preview) preview.innerHTML = '';
  }

  function _saveModalDiv() {
    const id  = (document.getElementById('modalDivId') || {}).value || '';
    const nom = ((document.getElementById('inputDivNom') || {}).value || '').trim();
    if (!nom) { toast('Le nom de la division est requis', 'warning'); return; }

    const fields = {
      niveau:     (document.getElementById('inputDivNiveau')     || {}).value || '6e',
      nom,
      effectif:   parseInt((document.getElementById('inputDivEffectif')  || {}).value, 10) || 0,
      options:    ((document.getElementById('inputDivOptions')    || {}).value || '')
                    .split(',').map(s => s.trim()).filter(Boolean),
      dispositif: ((document.getElementById('inputDivDispositif') || {}).value || '').trim() || null
    };

    const dupCount = parseInt((document.getElementById('inputDivDup') || {}).value, 10) || 0;

    if (id) {
      // Mode édition — pas de duplication
      DGHData.updateDivision(id, fields);
      toast('Division mise à jour', 'success');
    } else {
      // Mode ajout : créer la division principale
      const created = DGHData.addDivision(fields);
      // Puis les copies si demandées
      if (dupCount > 0) {
        const copies = DGHData.duplicateDivisions(created.id, dupCount);
        toast(nom + ' + ' + copies.length + ' copie(s) créée(s)', 'success');
      } else {
        toast('Division « ' + nom + ' » ajoutée', 'success');
      }
    }

    _closeModalDiv();
    _renderStructures();
    _renderDashboard();
  }

  function _confirmDeleteDiv(id) {
    const div = DGHData.getDivision(id);
    if (!div) return;
    const confirmEl = document.getElementById('confirmDiv');
    const msgEl     = document.getElementById('confirmDivMsg');
    if (!confirmEl) return;
    if (msgEl) msgEl.textContent = 'Supprimer «\u00a0' + div.nom + '\u00a0» (niveau ' + div.niveau + ') ?';
    confirmEl.dataset.targetId   = id;
    confirmEl.classList.add('modal-open');
  }

  function _closeConfirmDiv() {
    const m = document.getElementById('confirmDiv');
    if (m) { m.classList.remove('modal-open'); m.dataset.targetId = ''; }
  }

  function _execDeleteDiv() {
    const id = document.getElementById('confirmDiv')?.dataset?.targetId;
    if (!id) return;
    DGHData.deleteDivision(id);
    _closeConfirmDiv();
    _renderStructures();
    _renderDashboard();
    toast('Division supprimée', 'info');
  }

  // ── RÉINITIALISATION ANNÉE ────────────────────────────────────────
  function _openConfirmReset() {
    const annee     = DGHData.getAnneeActive();
    const confirmEl = document.getElementById('confirmReset');
    const msgEl     = document.getElementById('confirmResetMsg');
    if (!confirmEl) return;
    if (msgEl) msgEl.textContent = 'Réinitialiser toutes les données de l\'année ' + annee.replace('-', '–') + ' ?';
    confirmEl.classList.add('modal-open');
  }

  function _closeConfirmReset() {
    const m = document.getElementById('confirmReset');
    if (m) m.classList.remove('modal-open');
  }

  function _execResetAnnee() {
    const annee = DGHData.getAnneeActive();
    DGHData.resetAnnee();
    _closeConfirmReset();
    _closeModal();
    _renderAll();
    _renderDashboard();
    toast('Année ' + annee.replace('-', '–') + ' réinitialisée', 'info');
  }

  // ── MODULE DOTATION — Sprint 3 ────────────────────────────────────
  function _renderDotation() {
    try {
      const anneeData   = DGHData.getAnnee();
      const bilan       = Calculs.bilanDotation(anneeData);
      const disciplines = DGHData.getDisciplines();
      const repartition = DGHData.getRepartition();
      const structures  = DGHData.getStructures();
      const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, repartition);

      // ── KPI bar
      _set('dot-kpi-enveloppe', bilan.enveloppe || '—');
      _set('dot-kpi-alloue',    bilan.totalAlloue);
      _set('dot-kpi-nb',        bilan.nbDisciplines);
      _set('dot-kpi-pct',       bilan.enveloppe > 0 ? bilan.pctConsomme + ' %' : '—');

      const soldeEl    = document.getElementById('dot-kpi-solde');
      const soldeLbl   = document.getElementById('dot-kpi-solde-label');
      if (soldeEl) {
        soldeEl.textContent = bilan.enveloppe > 0 ? bilan.solde : '—';
        soldeEl.className   = bilan.depassement ? 'struct-kpi-val dot-solde-neg' : 'struct-kpi-val dot-solde-pos';
      }
      if (soldeLbl) soldeLbl.textContent = bilan.depassement ? 'h dépassement' : 'h solde';

      // ── Barre de progression
      const bar = document.getElementById('dot-progress-bar');
      const lbl = document.getElementById('dot-progress-label');
      if (bar) {
        const pct = bilan.enveloppe > 0 ? Math.min(110, bilan.pctConsomme) : 0;
        bar.style.width      = pct + '%';
        bar.style.background = bilan.depassement ? 'var(--c-red)' : pct > 90 ? 'var(--c-amber)' : 'var(--c-accent)';
      }
      if (lbl) lbl.textContent = bilan.enveloppe > 0
        ? bilan.totalAlloue + ' / ' + bilan.enveloppe + ' h' : '0 / 0 h';

      // ── Tableau disciplines
      const listEl = document.getElementById('dot-list');
      if (!listEl) return;

      if (disciplines.length === 0) {
        listEl.innerHTML =
          '<div class="struct-empty">'
          + '<div class="struct-empty-icon">◎</div>'
          + '<p>Aucune discipline saisie pour cette année.</p>'
          + '<p class="struct-empty-sub">Cliquez sur «\u00a0Ajouter une discipline\u00a0» pour commencer la répartition.</p>'
          + '</div>';
        return;
      }

      // Construire le tableau — on croise besoins (triés par discipline) avec données
      const besoinsMap = {};
      besoins.forEach(b => { besoinsMap[b.disciplineId] = b; });

      let html = '<table class="dot-table">'
        + '<thead><tr>'
        + '<th>Discipline</th>'
        + '<th class="col-num">Besoin théorique</th>'
        + '<th class="col-num">Heures allouées</th>'
        + '<th class="col-num">Écart</th>'
        + '<th class="col-bar">Répartition</th>'
        + '<th class="col-actions">Actions</th>'
        + '</tr></thead><tbody>';

      disciplines.forEach(disc => {
        const b       = besoinsMap[disc.id] || { besoinTheorique: 0, heuresAllouees: 0, ecart: 0, commentaire: '' };
        const pctBar  = bilan.enveloppe > 0 ? Math.min(100, Math.round((b.heuresAllouees / bilan.enveloppe) * 100)) : 0;
        const ecartCls = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
        const ecartSign = b.ecart > 0 ? '+' : '';

        html += '<tr>'
          + '<td><span class="disc-color-dot" style="background:' + _esc(disc.couleur) + '"></span>'
          + '<strong class="div-nom">' + _esc(disc.nom) + '</strong></td>'
          + '<td class="col-num dot-theorique">' + (b.besoinTheorique > 0 ? b.besoinTheorique + ' h' : '<span class="no-tag">—</span>') + '</td>'
          + '<td class="col-num">'
          + '  <input type="number" class="dot-input-h" data-disc-id="' + disc.id + '" value="' + b.heuresAllouees + '" min="0" step="0.5" aria-label="Heures allouées ' + _esc(disc.nom) + '" />'
          + '</td>'
          + '<td class="col-num"><span class="dot-ecart ' + ecartCls + '">' + (b.besoinTheorique > 0 ? ecartSign + b.ecart + ' h' : '—') + '</span></td>'
          + '<td class="col-bar"><div class="dot-bar-track"><div class="dot-bar-fill" style="width:' + pctBar + '%;background:' + _esc(disc.couleur) + '"></div></div><span class="dot-bar-pct">' + pctBar + '%</span></td>'
          + '<td class="col-actions">'
          + '<button class="btn-icon-sm" data-action="edit-disc" data-id="' + disc.id + '" title="Modifier">✎</button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-disc" data-id="' + disc.id + '" title="Supprimer">✕</button>'
          + '</td>'
          + '</tr>';
      });

      listEl.innerHTML = html + '</tbody></table>';

      // ── Écoute des inputs heures inline (délégation sur le tableau)
      listEl.querySelectorAll('.dot-input-h').forEach(inp => {
        inp.addEventListener('change', e => {
          const id = e.target.dataset.discId;
          const h  = parseFloat(e.target.value) || 0;
          if (id) {
            DGHData.setRepartition(id, { heuresAllouees: h });
            _renderDotation();
            _renderDashboard();
            toast('Heures mises à jour', 'success');
          }
        });
      });

    } catch(err) {
      console.error('[DGH] Erreur renderDotation:', err);
    }
  }

  // ── MODAL DISCIPLINE ──────────────────────────────────────────────
  function _openModalDisc(id) {
    const modal = document.getElementById('modalDisc');
    if (!modal) return;
    const title  = document.getElementById('modalDiscTitle');
    const saveId = document.getElementById('modalDiscId');

    if (id) {
      const disc = DGHData.getDiscipline(id);
      if (!disc) return;
      if (title)  title.textContent = 'Modifier la discipline';
      if (saveId) saveId.value      = id;
      _setVal('inputDiscNom',     disc.nom);
      _setVal('inputDiscCouleur', disc.couleur || '#2d6a4f');
      _updateColorHint(disc.couleur || '#2d6a4f');
    } else {
      if (title)  title.textContent = 'Ajouter une discipline';
      if (saveId) saveId.value      = '';
      _setVal('inputDiscNom',     '');
      _setVal('inputDiscCouleur', '#2d6a4f');
      _updateColorHint('#2d6a4f');
    }
    modal.classList.add('modal-open');
    setTimeout(() => { document.getElementById('inputDiscNom')?.focus(); }, 60);
  }

  function _updateColorHint(val) {
    const hint = document.getElementById('colorHint');
    if (hint) hint.textContent = val;
  }

  function _closeModalDisc() {
    const m = document.getElementById('modalDisc');
    if (m) m.classList.remove('modal-open');
  }

  function _saveModalDisc() {
    const id  = (document.getElementById('modalDiscId') || {}).value || '';
    const nom = ((document.getElementById('inputDiscNom') || {}).value || '').trim();
    if (!nom) { toast('Le nom de la discipline est requis', 'warning'); return; }
    const couleur = (document.getElementById('inputDiscCouleur') || {}).value || '#2d6a4f';

    if (id) {
      DGHData.updateDiscipline(id, { nom, couleur });
      toast('Discipline mise à jour', 'success');
    } else {
      DGHData.addDiscipline({ nom, couleur });
      toast('Discipline « ' + nom + ' » ajoutée', 'success');
    }
    _closeModalDisc();
    _renderDotation();
    _renderDashboard();
  }

  function _confirmDeleteDisc(id) {
    const disc     = DGHData.getDiscipline(id);
    if (!disc) return;
    const confirmEl = document.getElementById('confirmDisc');
    const msgEl     = document.getElementById('confirmDiscMsg');
    if (!confirmEl) return;
    if (msgEl) msgEl.textContent = 'Supprimer «\u00a0' + disc.nom + '\u00a0» ?';
    confirmEl.dataset.targetId   = id;
    confirmEl.classList.add('modal-open');
  }

  function _closeConfirmDisc() {
    const m = document.getElementById('confirmDisc');
    if (m) { m.classList.remove('modal-open'); m.dataset.targetId = ''; }
  }

  function _execDeleteDisc() {
    const id = document.getElementById('confirmDisc')?.dataset?.targetId;
    if (!id) return;
    DGHData.deleteDiscipline(id);
    _closeConfirmDisc();
    _renderDotation();
    _renderDashboard();
    toast('Discipline supprimée', 'info');
  }

  // ── ALERTES ──────────────────────────────────────────────────────
  function _renderAlertes() {
    try {
      const alertes = Calculs.genererAlertes(DGHData.getAnnee());
      const zone    = document.getElementById('alertes-zone');
      if (!zone) return;
      const ICONS = { error: '✕', warning: '⚠', info: 'ℹ' };
      zone.className  = 'section-card';
      zone.innerHTML  = '<div class="alertes-list">'
        + (alertes.length
          ? alertes.map(a =>
              '<div class="alerte-item sev-' + a.severite + '">'
              + '<span class="alerte-dot">' + (ICONS[a.severite] || '·') + '</span>'
              + '<span class="alerte-msg">' + a.message + '</span>'
              + '</div>').join('')
          : '<div class="alertes-empty">✓ Aucune alerte — tout est en ordre.</div>')
        + '</div>';
    } catch(e) {
      console.error('[DGH] Erreur renderAlertes:', e);
    }
  }

  // ── RENDU GLOBAL ─────────────────────────────────────────────────
  function _renderAll() {
    _updateBtnEtab();
    _renderYearSelect();
  }

  function _renderYearSelect() {
    const sel = document.getElementById('yearSelect');
    if (!sel) return;
    // Reconstruire entièrement pour rester synchrone avec DGHData
    const active = DGHData.getAnneeActive();
    sel.innerHTML = '';
    DGHData.getAnnees().forEach(a => {
      const opt = document.createElement('option');
      opt.value       = a;
      opt.textContent = a.replace('-', ' – ');
      if (a === active) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── MODAL ÉTABLISSEMENT (avec gestion années) ─────────────────────
  function _openModal() {
    try {
      const etab     = DGHData.getEtab()  || {};
      const annee    = DGHData.getAnnee() || {};
      const dotation = annee.dotation     || {};
      const modalEl  = document.getElementById('modalEtab');
      if (!modalEl) return;

      _setVal('inputNomEtab',  etab.nom      || '');
      _setVal('inputUAI',      etab.uai      || '');
      _setVal('inputAcademie', etab.academie || '');
      _setVal('inputDGH',      dotation.enveloppe != null ? dotation.enveloppe : '');

      // Peupler le select années dans la modal
      _renderModalYearSelect();

      modalEl.classList.add('modal-open');
      setTimeout(() => { document.getElementById('inputNomEtab')?.focus(); }, 60);
    } catch(e) {
      console.error('[DGH] Erreur ouverture modal:', e);
      toast('Impossible d\'ouvrir les paramètres', 'error');
    }
  }

  /** Reconstruit le select des années dans la modal établissement */
  function _renderModalYearSelect() {
    const sel = document.getElementById('modalYearSelect');
    if (!sel) return;
    const active = DGHData.getAnneeActive();
    sel.innerHTML = '';
    DGHData.getAnnees().forEach(a => {
      const opt = document.createElement('option');
      opt.value       = a;
      opt.textContent = a.replace('-', ' – ');
      if (a === active) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function _closeModal() {
    const m = document.getElementById('modalEtab');
    if (m) m.classList.remove('modal-open');
  }

  function _saveModal() {
    try {
      // Changer l'année active si modifiée dans la modal
      const modalSel = document.getElementById('modalYearSelect');
      if (modalSel && modalSel.value && modalSel.value !== DGHData.getAnneeActive()) {
        DGHData.setAnneeActive(modalSel.value);
      }

      DGHData.setEtab({
        nom:      document.getElementById('inputNomEtab')?.value?.trim()  || '',
        uai:      document.getElementById('inputUAI')?.value?.trim()      || '',
        academie: document.getElementById('inputAcademie')?.value?.trim() || ''
      });
      // L'enveloppe est rattachée à l'année active (potentiellement nouvelle)
      // Préserver le commentaire existant (pas de champ UI pour l'instant)
      const commentaireExistant = DGHData.getAnnee().dotation?.commentaire || '';
      DGHData.setDotation(parseFloat(document.getElementById('inputDGH')?.value) || 0, commentaireExistant);

      _closeModal();
      _renderAll();
      _renderDashboard();
      toast('Paramètres enregistrés', 'success');
    } catch(e) {
      console.error('[DGH] Erreur sauvegarde:', e);
      toast('Erreur lors de la sauvegarde', 'error');
    }
  }

  /** Ajoute une nouvelle année depuis la modal et sélectionne la saisie */
  function _addModalYear() {
    const input = document.getElementById('inputNewYear');
    if (!input) return;
    const val = input.value.trim();

    // Validation format AAAA-AAAA
    if (!/^\d{4}-\d{4}$/.test(val)) {
      toast('Format requis : 2026-2027', 'warning');
      input.focus();
      return;
    }
    const [debut, fin] = val.split('-').map(Number);
    if (fin !== debut + 1) {
      toast('Les deux années doivent se suivre (ex. 2026-2027)', 'warning');
      input.focus();
      return;
    }
    if (DGHData.getAnnees().includes(val)) {
      toast('Cette année existe déjà', 'info');
      // Sélectionner quand même dans le select
      const sel = document.getElementById('modalYearSelect');
      if (sel) sel.value = val;
      input.value = '';
      return;
    }

    // Créer l'année (setAnneeActive crée l'entrée si elle n'existe pas)
    DGHData.setAnneeActive(val);
    input.value = '';
    _renderModalYearSelect();
    _renderYearSelect();
    toast('Année ' + val.replace('-', '–') + ' créée et sélectionnée', 'success');
  }

  // ── DÉLÉGATION GLOBALE UNIQUE ─────────────────────────────────────
  // RÈGLE : tous les clics passent par ici. Aucun addEventListener direct
  // sur un bouton dont le rendu est conditionnel ou tardif.
  function _onGlobalClick(e) {

    // ── Navigation sidebar (data-view)
    const navItem = e.target.closest('.nav-item[data-view]');
    if (navItem) { navigate(navItem.dataset.view); return; }

    // ── Boutons avec data-navigate
    const navBtn = e.target.closest('[data-navigate]');
    if (navBtn) { navigate(navBtn.dataset.navigate); return; }

    // ── Actions structures (délégation sur tableau dynamique)
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const { action, id } = actionBtn.dataset;
      if (action === 'edit-div')    { _openModalDiv(id);      return; }
      if (action === 'delete-div')  { _confirmDeleteDiv(id);  return; }
      if (action === 'edit-disc')   { _openModalDisc(id);     return; }
      if (action === 'delete-disc') { _confirmDeleteDisc(id); return; }
    }

    // ── Bouton "Ajouter une division" (dans view-structures)
    if (e.target.closest('#btnAddDiv')) { _openModalDiv(null); return; }

    // ── Bouton "Ajouter une discipline" (dans view-dotation)
    if (e.target.closest('#btnAddDisc')) { _openModalDisc(null); return; }

    // ── Bouton "Mon Collège ⚙"
    if (e.target.closest('#btnEtab')) { _openModal(); return; }

    // ── Fermeture modals au clic sur l'overlay
    if (e.target === document.getElementById('modalEtab'))  { _closeModal();        return; }
    if (e.target === document.getElementById('modalDiv'))   { _closeModalDiv();     return; }
    if (e.target === document.getElementById('confirmDiv')) { _closeConfirmDiv();   return; }
    if (e.target === document.getElementById('modalDisc'))  { _closeModalDisc();   return; }
    if (e.target === document.getElementById('confirmDisc')){ _closeConfirmDisc(); return; }

    // ── Boutons modal établissement
    if (e.target.closest('#modalClose'))      { _closeModal();         return; }
    if (e.target.closest('#modalCancel'))     { _closeModal();         return; }
    if (e.target.closest('#modalSave'))       { _saveModal();          return; }
    if (e.target.closest('#btnAddYear'))      { _addModalYear();       return; }
    if (e.target.closest('#btnResetAnnee'))   { _openConfirmReset();   return; }

    // ── Boutons modal division
    if (e.target.closest('#modalDivClose'))  { _closeModalDiv();  return; }
    if (e.target.closest('#modalDivCancel')) { _closeModalDiv();  return; }
    if (e.target.closest('#modalDivSave'))   { _saveModalDiv();   return; }

    // ── Boutons modal confirmation suppression division
    if (e.target.closest('#confirmDivCancel'))  { _closeConfirmDiv(); return; }
    if (e.target.closest('#confirmDivAnnuler')) { _closeConfirmDiv(); return; }
    if (e.target.closest('#confirmDivOk'))      { _execDeleteDiv();   return; }

    // ── Boutons modal discipline
    if (e.target.closest('#modalDiscClose'))  { _closeModalDisc();  return; }
    if (e.target.closest('#modalDiscCancel')) { _closeModalDisc();  return; }
    if (e.target.closest('#modalDiscSave'))   { _saveModalDisc();   return; }

    // ── Boutons modal confirmation suppression discipline
    if (e.target.closest('#confirmDiscCancel'))  { _closeConfirmDisc(); return; }
    if (e.target.closest('#confirmDiscAnnuler')) { _closeConfirmDisc(); return; }
    if (e.target.closest('#confirmDiscOk'))      { _execDeleteDisc();   return; }

    // ── Boutons modal confirmation réinitialisation année
    if (e.target.closest('#confirmResetCancel'))  { _closeConfirmReset(); return; }
    if (e.target.closest('#confirmResetAnnuler')) { _closeConfirmReset(); return; }
    if (e.target.closest('#confirmResetOk'))      { _execResetAnnee();   return; }

    // ── Sidebar mobile : fermer au clic extérieur
    if (window.innerWidth <= 768) {
      const sb = document.getElementById('sidebar');
      const mb = document.getElementById('mobileMenuBtn');
      if (sb && mb && !sb.contains(e.target) && !mb.contains(e.target)) {
        sb.classList.remove('open');
      }
    }
  }

  // ── EVENTS ───────────────────────────────────────────────────────
  function _bindEvents() {

    // ── UNE SEULE délégation globale pour tous les clics
    document.addEventListener('click', _onGlobalClick);

    // ── Thème (toujours présent dans le DOM au chargement, OK en direct)
    document.getElementById('themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      _applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    // ── Navigation sidebar — via délégation uniquement (pas de listener direct)
    // Les nav-items sont dans le DOM au chargement MAIS le listener direct
    // doublonnait avec _onGlobalClick → navigate() appelé 2x. Supprimé.

    // ── Preview duplication (écoute sur nom + nombre de copies)
    document.addEventListener('input', e => {
      if (e.target.id === 'inputDivNom' || e.target.id === 'inputDivDup') {
        _updateDupPreview();
      }
    });

    // ── Entrée clavier dans le champ nouvelle année (modal)
    document.addEventListener('keydown', e => {
      if (e.target.id === 'inputNewYear' && e.key === 'Enter') {
        e.preventDefault();
        _addModalYear();
      }
    });
    // ── Sidebar toggle desktop
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // ── Menu mobile
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // ── Changement d'année via sidebar select
    document.getElementById('yearSelect').addEventListener('change', e => {
      DGHData.setAnneeActive(e.target.value);
      _renderAll();
      _renderDashboard();
      const active = document.querySelector('.nav-item.active[data-view]');
      if (active && active.dataset.view === 'structures') _renderStructures();
      toast('Année ' + e.target.value.replace('-', '–') + ' chargée', 'info');
    });

    // ── Changement d'année via select de la modal établissement
    document.addEventListener('change', e => {
      if (e.target.id === 'modalYearSelect') {
        DGHData.setAnneeActive(e.target.value);
        const dotation = DGHData.getAnnee().dotation || {};
        _setVal('inputDGH', dotation.enveloppe != null ? dotation.enveloppe : '');
        _renderYearSelect();
      }
    });

    // ── Échap : fermer la modal ouverte
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (document.getElementById('modalEtab')?.classList.contains('modal-open'))    _closeModal();
      if (document.getElementById('modalDiv')?.classList.contains('modal-open'))     _closeModalDiv();
      if (document.getElementById('confirmDiv')?.classList.contains('modal-open'))   _closeConfirmDiv();
      if (document.getElementById('confirmReset')?.classList.contains('modal-open')) _closeConfirmReset();
      if (document.getElementById('modalDisc')?.classList.contains('modal-open'))   _closeModalDisc();
      if (document.getElementById('confirmDisc')?.classList.contains('modal-open')) _closeConfirmDisc();
    });

    // ── Color picker — mise à jour du hint en temps réel
    document.addEventListener('input', e => {
      if (e.target.id === 'inputDiscCouleur') _updateColorHint(e.target.value);
    });

    // ── Ctrl+S / Cmd+S → export
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        try { toast('Exporté : ' + DGHData.exportJSON(), 'success'); }
        catch(err) { toast('Erreur export', 'error'); }
      }
    });

    // ── Export bouton sidebar
    document.getElementById('btnExport').addEventListener('click', () => {
      try { toast('Exporté : ' + DGHData.exportJSON(), 'success'); }
      catch(e) { toast('Erreur export : ' + e.message, 'error'); }
    });

    // ── Import
    const fileImport = document.getElementById('fileImport');
    document.getElementById('btnImport').addEventListener('click', () => fileImport.click());
    document.getElementById('btnImportEmpty').addEventListener('click', () => fileImport.click());
    fileImport.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const r = await DGHData.importJSON(file);
        _renderAll(); _renderDashboard();
        toast('Importé — ' + (r.etablissement || '?'), 'success');
      } catch(err) {
        toast('Erreur : ' + err.message, 'error', 5000);
      }
      fileImport.value = '';
    });

    // ── Erreur storage
    document.addEventListener('dgh:storage-error', () => {
      toast('Erreur de sauvegarde locale', 'error', 6000);
    });
  }

  // ── TOAST ────────────────────────────────────────────────────────
  function toast(msg, type, duration) {
    type = type || 'info'; duration = duration || 3500;
    const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<span class="toast-icon">' + (ICONS[type]||'ℹ') + '</span><span>' + msg + '</span>';
    c.appendChild(el);
    setTimeout(() => {
      el.style.cssText += 'opacity:0;transform:translateX(10px);transition:.2s ease;';
      setTimeout(() => el.remove(), 200);
    }, duration);
  }

  // ── UTIL ─────────────────────────────────────────────────────────
  function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { init, navigate, toast };

})();

document.addEventListener('DOMContentLoaded', () => app.init());
