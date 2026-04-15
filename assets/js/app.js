/**
 * DGH App — Contrôleur principal v2.4
 * Corrections v2.4 :
 *   - Bug boutons : UNE SEULE délégation globale, aucun listener direct sur boutons de contenu
 *   - Gestion années : ajout/suppression depuis la modal établissement
 * Règle permanente : JAMAIS de listener direct (.addEventListener) sur un bouton
 * dont le rendu peut être tardif ou conditionnel → toujours délégation sur document.
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
    } else {
      if (title)  title.textContent = 'Ajouter une division';
      if (saveId) saveId.value      = '';
      if (sel)    sel.value         = '6e';
      _setVal('inputDivNom',        '');
      _setVal('inputDivEffectif',   '');
      _setVal('inputDivOptions',    '');
      _setVal('inputDivDispositif', '');
    }

    modal.classList.add('modal-open');
    setTimeout(() => { const f = document.getElementById('inputDivNom'); if (f) f.focus(); }, 60);
  }

  function _closeModalDiv() {
    const m = document.getElementById('modalDiv');
    if (m) m.classList.remove('modal-open');
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

    if (id) {
      DGHData.updateDivision(id, fields);
      toast('Division mise à jour', 'success');
    } else {
      DGHData.addDivision(fields);
      toast('Division ajoutée', 'success');
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
      DGHData.setDotation(parseFloat(document.getElementById('inputDGH')?.value) || 0);

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

    // ── Boutons avec data-navigate
    const navBtn = e.target.closest('[data-navigate]');
    if (navBtn) { navigate(navBtn.dataset.navigate); return; }

    // ── Actions structures (délégation sur tableau dynamique)
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const { action, id } = actionBtn.dataset;
      if (action === 'edit-div')   { _openModalDiv(id);      return; }
      if (action === 'delete-div') { _confirmDeleteDiv(id);  return; }
    }

    // ── Bouton "Ajouter une division" (dans view-structures)
    if (e.target.closest('#btnAddDiv')) { _openModalDiv(null); return; }

    // ── Bouton "Mon Collège ⚙"
    if (e.target.closest('#btnEtab')) { e.stopPropagation(); _openModal(); return; }

    // ── Fermeture modals au clic sur l'overlay
    if (e.target === document.getElementById('modalEtab'))  { _closeModal();       return; }
    if (e.target === document.getElementById('modalDiv'))   { _closeModalDiv();    return; }
    if (e.target === document.getElementById('confirmDiv')) { _closeConfirmDiv();  return; }

    // ── Boutons modal établissement
    if (e.target.closest('#modalClose'))  { _closeModal();   return; }
    if (e.target.closest('#modalCancel')) { _closeModal();   return; }
    if (e.target.closest('#modalSave'))   { _saveModal();    return; }
    if (e.target.closest('#btnAddYear'))  { _addModalYear(); return; }

    // ── Boutons modal division
    if (e.target.closest('#modalDivClose'))  { _closeModalDiv();  return; }
    if (e.target.closest('#modalDivCancel')) { _closeModalDiv();  return; }
    if (e.target.closest('#modalDivSave'))   { _saveModalDiv();   return; }

    // ── Boutons modal confirmation
    if (e.target.closest('#confirmDivCancel'))  { _closeConfirmDiv(); return; }
    if (e.target.closest('#confirmDivAnnuler')) { _closeConfirmDiv(); return; }
    if (e.target.closest('#confirmDivOk'))      { _execDeleteDiv();   return; }

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

    // ── Navigation sidebar (items toujours dans le DOM au chargement)
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.view));
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
      // Si on est sur la vue structures, la rafraîchir aussi
      const active = document.querySelector('.nav-item.active[data-view]');
      if (active && active.dataset.view === 'structures') _renderStructures();
      toast('Année ' + e.target.value.replace('-', '–') + ' chargée', 'info');
    });

    // ── Changement d'année via select de la modal établissement
    document.addEventListener('change', e => {
      if (e.target.id === 'modalYearSelect') {
        DGHData.setAnneeActive(e.target.value);
        // Mettre à jour l'enveloppe affichée pour cette nouvelle année
        const dotation = DGHData.getAnnee().dotation || {};
        _setVal('inputDGH', dotation.enveloppe != null ? dotation.enveloppe : '');
        _renderYearSelect();
      }
    });

    // ── Entrée clavier dans le champ nouvelle année (modal)
    document.addEventListener('keydown', e => {
      if (e.target.id === 'inputNewYear' && e.key === 'Enter') {
        e.preventDefault();
        _addModalYear();
      }
    });

    // ── Échap : fermer la modal ouverte
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (document.getElementById('modalEtab')?.classList.contains('modal-open'))  _closeModal();
      if (document.getElementById('modalDiv')?.classList.contains('modal-open'))   _closeModalDiv();
      if (document.getElementById('confirmDiv')?.classList.contains('modal-open')) _closeConfirmDiv();
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
