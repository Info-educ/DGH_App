/**
 * DGH App — Contrôleur principal v2.3
 * Sprint 2 : module Structures de classes
 * Zéro onclick inline · Zéro localStorage direct · Un fichier = une responsabilité
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

    if (viewId === 'dashboard')   _renderDashboard();
    if (viewId === 'alertes')     _renderAlertes();
    if (viewId === 'structures')  _renderStructures();
  }

  // ── DASHBOARD ────────────────────────────────────────────────────
  function _renderDashboard() {
    try {
      const data    = DGHData.getAnnee();
      const bilan   = Calculs.bilanDGH(data);
      const alertes = Calculs.genererAlertes(data);
      const resume  = Calculs.resumeStructures(DGHData.getStructures());

      _set('dashYear',          DGHData.getAnneeActive().replace('-', '–'));
      _set('kpi-dghtotal',      bilan.enveloppe      ? bilan.enveloppe + ' h'       : '— h');
      _set('kpi-affectees',     bilan.heuresAllouees ? bilan.heuresAllouees + ' h'  : '— h');
      _set('kpi-affectees-pct', bilan.enveloppe      ? bilan.pctConsomme + ' %'     : '— %');
      _set('kpi-solde',         bilan.enveloppe      ? bilan.solde + ' h'           : '— h');
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
      if (lbl) lbl.textContent = bilan.enveloppe > 0 ? bilan.heuresAllouees + ' / ' + bilan.enveloppe + ' h' : '0 / 0 h';

      // Empty state / résumé disciplines
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

  // ── MODULE STRUCTURES ─────────────────────────────────────────────
  function _renderStructures() {
    try {
      const structures = DGHData.getStructures();
      const resume     = Calculs.resumeStructures(structures);

      // ── KPI structures
      _set('struct-kpi-divisions', resume.nbDivisions);
      _set('struct-kpi-effectif',  resume.effectifTotal);
      const niveauxEl = document.getElementById('struct-kpi-niveaux');
      if (niveauxEl) niveauxEl.textContent = resume.niveauxPresents.join(', ') || '—';

      // ── Tableau par niveau
      const byNiveauEl = document.getElementById('struct-by-niveau');
      if (byNiveauEl) {
        if (resume.parNiveau.length === 0) {
          byNiveauEl.innerHTML = '';
        } else {
          byNiveauEl.innerHTML = resume.parNiveau.map(n =>
            '<div class="niveau-row">'
            + '<span class="niveau-badge niveau-' + n.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + n.niveau + '</span>'
            + '<span class="niveau-count">' + n.nbDivisions + ' div.</span>'
            + '<span class="niveau-effectif">' + n.effectif + ' élèves</span>'
            + '</div>'
          ).join('');
        }
      }

      // ── Liste des divisions
      const listEl = document.getElementById('struct-list');
      if (!listEl) return;

      if (structures.length === 0) {
        listEl.innerHTML =
          '<div class="struct-empty">'
          + '<div class="struct-empty-icon">⊞</div>'
          + '<p>Aucune division saisie pour cette année.</p>'
          + '<p class="struct-empty-sub">Cliquez sur «&nbsp;Ajouter une division&nbsp;» pour commencer.</p>'
          + '</div>';
        return;
      }

      // Construire le tableau HTML — entête fixe + lignes
      let html = '<table class="struct-table">'
        + '<thead><tr>'
        + '<th>Division</th><th>Niveau</th><th>Effectif</th><th>Options / Dispositif</th><th class="col-actions">Actions</th>'
        + '</tr></thead><tbody>';

      structures.forEach(div => {
        const tags = [];
        if (div.options && div.options.length) div.options.forEach(o => tags.push('<span class="div-tag">' + _esc(o) + '</span>'));
        if (div.dispositif) tags.push('<span class="div-tag div-tag-disp">' + _esc(div.dispositif) + '</span>');

        html += '<tr>'
          + '<td><strong class="div-nom">' + _esc(div.nom || '—') + '</strong></td>'
          + '<td><span class="niveau-badge niveau-' + div.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + _esc(div.niveau) + '</span></td>'
          + '<td><span class="div-effectif">' + (div.effectif || 0) + '</span></td>'
          + '<td class="div-tags-cell">' + (tags.length ? tags.join('') : '<span class="no-tag">—</span>') + '</td>'
          + '<td class="col-actions">'
          + '<button class="btn-icon-sm" data-action="edit-div" data-id="' + div.id + '" title="Modifier">✎</button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-div" data-id="' + div.id + '" title="Supprimer">✕</button>'
          + '</td>'
          + '</tr>';
      });

      html += '</tbody></table>';
      listEl.innerHTML = html;

    } catch(e) {
      console.error('[DGH] Erreur renderStructures:', e);
    }
  }

  // ── MODAL DIVISION ────────────────────────────────────────────────
  /** Ouvre la modal en mode ajout ou modification */
  function _openModalDiv(id) {
    const modal  = document.getElementById('modalDiv');
    const title  = document.getElementById('modalDivTitle');
    const saveId = document.getElementById('modalDivId');
    if (!modal) return;

    // Peupler le select niveaux
    const sel = document.getElementById('inputDivNiveau');
    if (sel) {
      sel.innerHTML = DGHData.getNiveaux().map(n =>
        '<option value="' + n + '">' + n + '</option>'
      ).join('');
    }

    if (id) {
      // Mode édition
      const div = DGHData.getDivision(id);
      if (!div) return;
      if (title)  title.textContent   = 'Modifier la division';
      if (saveId) saveId.value        = id;
      if (sel)    sel.value           = div.niveau;
      _setVal('inputDivNom',      div.nom);
      _setVal('inputDivEffectif', div.effectif);
      _setVal('inputDivOptions',  (div.options || []).join(', '));
      _setVal('inputDivDispositif', div.dispositif || '');
    } else {
      // Mode ajout
      if (title)  title.textContent = 'Ajouter une division';
      if (saveId) saveId.value      = '';
      if (sel)    sel.value         = '6e';
      _setVal('inputDivNom',       '');
      _setVal('inputDivEffectif',  '');
      _setVal('inputDivOptions',   '');
      _setVal('inputDivDispositif','');
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
      niveau:     (document.getElementById('inputDivNiveau')    || {}).value || '6e',
      nom,
      effectif:   parseInt((document.getElementById('inputDivEffectif') || {}).value, 10) || 0,
      options:    ((document.getElementById('inputDivOptions')   || {}).value || '')
                    .split(',').map(s => s.trim()).filter(Boolean),
      dispositif: ((document.getElementById('inputDivDispositif')|| {}).value || '').trim() || null
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

  /** Confirmation et suppression d'une division */
  function _confirmDeleteDiv(id) {
    const div = DGHData.getDivision(id);
    if (!div) return;
    const confirmEl = document.getElementById('confirmDiv');
    const msgEl     = document.getElementById('confirmDivMsg');
    if (!confirmEl) return;
    if (msgEl) msgEl.textContent = 'Supprimer la division « ' + div.nom + ' » (niveau ' + div.niveau + ') ?';
    confirmEl.dataset.targetId   = id;
    confirmEl.classList.add('modal-open');
  }

  function _closeConfirmDiv() {
    const m = document.getElementById('confirmDiv');
    if (m) { m.classList.remove('modal-open'); m.dataset.targetId = ''; }
  }

  function _execDeleteDiv() {
    const id = (document.getElementById('confirmDiv') || {}).dataset?.targetId;
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
      zone.className = 'section-card';
      zone.innerHTML = '<div class="alertes-list">'
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
    const existing = Array.from(sel.options).map(o => o.value);
    DGHData.getAnnees().forEach(a => {
      if (!existing.includes(a)) {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a.replace('-', ' – ');
        sel.appendChild(opt);
      }
    });
    sel.value = DGHData.getAnneeActive();
  }

  // ── MODAL ÉTABLISSEMENT ──────────────────────────────────────────
  function _openModal() {
    try {
      const etab     = DGHData.getEtab()  || {};
      const annee    = DGHData.getAnnee() || {};
      const dotation = (annee.dotation)   || {};

      const nomEl      = document.getElementById('inputNomEtab');
      const uaiEl      = document.getElementById('inputUAI');
      const academieEl = document.getElementById('inputAcademie');
      const dghEl      = document.getElementById('inputDGH');
      const modalEl    = document.getElementById('modalEtab');

      if (!modalEl) { console.error('[DGH] #modalEtab introuvable'); return; }

      if (nomEl)      nomEl.value      = etab.nom      || '';
      if (uaiEl)      uaiEl.value      = etab.uai      || '';
      if (academieEl) academieEl.value = etab.academie || '';
      if (dghEl)      dghEl.value      = (dotation.enveloppe != null) ? dotation.enveloppe : '';

      modalEl.classList.add('modal-open');
      setTimeout(() => { if (nomEl) nomEl.focus(); }, 60);

    } catch(e) {
      console.error('[DGH] Erreur ouverture modal:', e);
      toast('Impossible d\'ouvrir les paramètres', 'error');
    }
  }

  function _closeModal() {
    const m = document.getElementById('modalEtab');
    if (m) m.classList.remove('modal-open');
  }

  function _saveModal() {
    try {
      DGHData.setEtab({
        nom:      (document.getElementById('inputNomEtab')  || {}).value?.trim() || '',
        uai:      (document.getElementById('inputUAI')      || {}).value?.trim() || '',
        academie: (document.getElementById('inputAcademie') || {}).value?.trim() || ''
      });
      DGHData.setDotation(parseFloat((document.getElementById('inputDGH') || {}).value) || 0);
      _closeModal();
      _renderAll();
      _renderDashboard();
      toast('Paramètres enregistrés', 'success');
    } catch(e) {
      console.error('[DGH] Erreur sauvegarde:', e);
      toast('Erreur lors de la sauvegarde', 'error');
    }
  }

  // ── EVENTS ───────────────────────────────────────────────────────
  function _bindEvents() {

    // Thème
    document.getElementById('themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      _applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    // Navigation sidebar
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.view));
    });

    // Délégation globale : data-navigate
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-navigate]');
      if (btn) navigate(btn.dataset.navigate);
    });

    // Délégation globale : actions structures (edit-div, delete-div)
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id     = btn.dataset.id;
      if (action === 'edit-div')   _openModalDiv(id);
      if (action === 'delete-div') _confirmDeleteDiv(id);
    });

    // Sidebar toggle desktop
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Menu mobile
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Fermer sidebar mobile au clic extérieur
    document.addEventListener('click', e => {
      if (window.innerWidth > 768) return;
      const sb = document.getElementById('sidebar');
      const mb = document.getElementById('mobileMenuBtn');
      if (sb && mb && !sb.contains(e.target) && !mb.contains(e.target)) {
        sb.classList.remove('open');
      }
    });

    // Changement d'année
    document.getElementById('yearSelect').addEventListener('change', e => {
      DGHData.setAnneeActive(e.target.value);
      _renderAll();
      _renderDashboard();
      toast('Année ' + e.target.value.replace('-', '–') + ' chargée', 'info');
    });

    // Bouton "Mon Collège ⚙"
    const btnEtab = document.getElementById('btnEtab');
    if (btnEtab) {
      btnEtab.addEventListener('click', function(e) {
        e.stopPropagation();
        _openModal();
      });
    }

    // Modal établissement
    const modalClose  = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalSave   = document.getElementById('modalSave');
    const modalEtab   = document.getElementById('modalEtab');
    if (modalClose)  modalClose.addEventListener('click', _closeModal);
    if (modalCancel) modalCancel.addEventListener('click', _closeModal);
    if (modalSave)   modalSave.addEventListener('click', _saveModal);
    if (modalEtab)   modalEtab.addEventListener('click', e => { if (e.target === e.currentTarget) _closeModal(); });

    // Bouton Ajouter une division
    const btnAddDiv = document.getElementById('btnAddDiv');
    if (btnAddDiv) btnAddDiv.addEventListener('click', () => _openModalDiv(null));

    // Modal division
    const modalDivClose  = document.getElementById('modalDivClose');
    const modalDivCancel = document.getElementById('modalDivCancel');
    const modalDivSave   = document.getElementById('modalDivSave');
    const modalDivEl     = document.getElementById('modalDiv');
    if (modalDivClose)  modalDivClose.addEventListener('click', _closeModalDiv);
    if (modalDivCancel) modalDivCancel.addEventListener('click', _closeModalDiv);
    if (modalDivSave)   modalDivSave.addEventListener('click', _saveModalDiv);
    if (modalDivEl)     modalDivEl.addEventListener('click', e => { if (e.target === e.currentTarget) _closeModalDiv(); });

    // Modal confirmation suppression
    const confirmCancel = document.getElementById('confirmDivCancel');
    const confirmAnnuler = document.getElementById('confirmDivAnnuler');
    const confirmOk     = document.getElementById('confirmDivOk');
    const confirmEl     = document.getElementById('confirmDiv');
    if (confirmCancel)  confirmCancel.addEventListener('click', _closeConfirmDiv);
    if (confirmAnnuler) confirmAnnuler.addEventListener('click', _closeConfirmDiv);
    if (confirmOk)      confirmOk.addEventListener('click', _execDeleteDiv);
    if (confirmEl)      confirmEl.addEventListener('click', e => { if (e.target === e.currentTarget) _closeConfirmDiv(); });

    // Touche Échap (toutes les modals)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const etabM   = document.getElementById('modalEtab');
        const divM    = document.getElementById('modalDiv');
        const confirmM= document.getElementById('confirmDiv');
        if (etabM    && etabM.classList.contains('modal-open'))    _closeModal();
        if (divM     && divM.classList.contains('modal-open'))     _closeModalDiv();
        if (confirmM && confirmM.classList.contains('modal-open')) _closeConfirmDiv();
      }
      // Ctrl+S / Cmd+S → export
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        try { toast('Exporté : ' + DGHData.exportJSON(), 'success'); }
        catch(err) { toast('Erreur export', 'error'); }
      }
    });

    // Export
    document.getElementById('btnExport').addEventListener('click', () => {
      try { toast('Exporté : ' + DGHData.exportJSON(), 'success'); }
      catch(e) { toast('Erreur export : ' + e.message, 'error'); }
    });

    // Import
    const fileImport = document.getElementById('fileImport');
    document.getElementById('btnImport').addEventListener('click',      () => fileImport.click());
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

    // Erreur storage
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
    el.innerHTML = '<span class="toast-icon">' + (ICONS[type] || 'ℹ') + '</span><span>' + msg + '</span>';
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

  /** Échappe le HTML pour éviter les injections dans innerHTML */
  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { init, navigate, toast };

})();

document.addEventListener('DOMContentLoaded', () => app.init());
