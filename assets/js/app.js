/**
 * DGH App — Contrôleur principal v2.1
 * Zéro onclick inline · Zéro variable dupliquée · Zéro code zombie
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

    if (viewId === 'dashboard') _renderDashboard();
    if (viewId === 'alertes')   _renderAlertes();
  }

  // ── DASHBOARD ────────────────────────────────────────────────────
  function _renderDashboard() {
    const data    = DGHData.getAnnee();
    const bilan   = Calculs.bilanDGH(data);
    const alertes = Calculs.genererAlertes(data);

    _set('dashYear',        DGHData.getAnneeActive().replace('-', '–'));
    _set('kpi-dghtotal',    bilan.enveloppe     ? bilan.enveloppe + ' h'        : '— h');
    _set('kpi-affectees',   bilan.heuresAllouees ? bilan.heuresAllouees + ' h'  : '— h');
    _set('kpi-affectees-pct', bilan.enveloppe   ? bilan.pctConsomme + ' %'      : '— %');
    _set('kpi-solde',       bilan.enveloppe     ? bilan.solde + ' h'            : '— h');
    _set('kpi-alertes',     alertes.filter(a => a.severite !== 'info').length || '—');
    _set('kpi-enseignants', bilan.nbEnseignants || '—');
    _set('kpi-tzr',         'dont ' + bilan.nbTZR + ' TZR');
    _set('kpi-hsa',         bilan.totalHSA ? bilan.totalHSA + ' h' : '— h');

    // Badge alertes sidebar
    const nb = alertes.filter(a => a.severite === 'error' || a.severite === 'warning').length;
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

    // Empty state / résumé
    const isEmpty  = DGHData.isEmpty();
    const emptyEl  = document.getElementById('emptyState');
    const resumeEl = document.getElementById('disciplineResume');
    if (emptyEl)  emptyEl.style.display = isEmpty ? '' : 'none';
    if (resumeEl) resumeEl.style.display = isEmpty ? 'none' : '';

    // Nom établissement
    const etab = DGHData.getEtab();
    _set('btnEtab', etab.nom || 'Mon Collège ⚙');
  }

  // ── ALERTES ──────────────────────────────────────────────────────
  function _renderAlertes() {
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
  }

  // ── RENDU GLOBAL ─────────────────────────────────────────────────
  function _renderAll() {
    const etab = DGHData.getEtab();
    _set('btnEtab', etab.nom || 'Mon Collège ⚙');
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

  // ── MODAL ────────────────────────────────────────────────────────
  function _openModal() {
    const etab  = DGHData.getEtab();
    const annee = DGHData.getAnnee();
    document.getElementById('inputNomEtab').value = etab.nom       || '';
    document.getElementById('inputUAI').value      = etab.uai       || '';
    document.getElementById('inputAcademie').value = etab.academie  || '';
    document.getElementById('inputDGH').value      = annee.dotation.enveloppe || '';
    document.getElementById('modalEtab').classList.add('modal-open');
  }

  function _closeModal() {
    document.getElementById('modalEtab').classList.remove('modal-open');
  }

  function _saveModal() {
    DGHData.setEtab({
      nom:      document.getElementById('inputNomEtab').value.trim(),
      uai:      document.getElementById('inputUAI').value.trim(),
      academie: document.getElementById('inputAcademie').value.trim()
    });
    DGHData.setDotation(parseFloat(document.getElementById('inputDGH').value) || 0);
    _closeModal();
    _renderAll();
    _renderDashboard();
    toast('Paramètres enregistrés', 'success');
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

    // Boutons data-navigate (délégation globale)
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-navigate]');
      if (btn) navigate(btn.dataset.navigate);
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
      if (sb && !sb.contains(e.target) && !mb.contains(e.target)) {
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

    // Établissement
    document.getElementById('btnEtab').addEventListener('click', _openModal);

    // Modal
    document.getElementById('modalClose').addEventListener('click',  _closeModal);
    document.getElementById('modalCancel').addEventListener('click', _closeModal);
    document.getElementById('modalSave').addEventListener('click',   _saveModal);
    document.getElementById('modalEtab').addEventListener('click', e => {
      if (e.target === e.currentTarget) _closeModal();
    });

    // Export
    document.getElementById('btnExport').addEventListener('click', () => {
      toast('Exporté : ' + DGHData.exportJSON(), 'success');
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
        toast('Importé — ' + r.etablissement, 'success');
      } catch(err) {
        toast('Erreur : ' + err.message, 'error', 5000);
      }
      fileImport.value = '';
    });

    // Ctrl+S
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        toast('Exporté : ' + DGHData.exportJSON(), 'success');
      }
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
    el.innerHTML = '<span class="toast-icon">' + ICONS[type] + '</span><span>' + msg + '</span>';
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

  return { init, navigate, toast };

})();

document.addEventListener('DOMContentLoaded', () => app.init());
