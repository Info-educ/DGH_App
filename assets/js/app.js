/**
 * DGH App — Contrôleur principal v2
 * Navigation, rendu dashboard, events UI
 * Règle : zéro onclick inline, zéro variable dupliquée, zéro code zombie
 */

const app = (() => {

  // ── Registre des vues ────────────────────────────────────────────
  const VIEWS = {
    'dashboard':   'Tableau de bord',
    'structures':  'Structures',
    'dotation':    'Dotation DGH',
    'enseignants': 'Enseignants',
    'simulation':  'Simulation',
    'alertes':     'Alertes',
    'synthese':    'Synthèses',
    'historique':  'Historique'
  };

  // ── INITIALISATION ───────────────────────────────────────────────
  function init() {
    _applyTheme(localStorage.getItem('dgh-theme') || 'light');
    DGHData.init();
    _bindEvents();
    _renderAll();
    navigate('dashboard');
  }

  // ── THÈME dark / light ───────────────────────────────────────────
  function _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dgh-theme', theme);
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
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    }

    if (viewId === 'dashboard') _renderDashboard();
    if (viewId === 'alertes')   _renderAlertes();
  }

  // ── DASHBOARD ────────────────────────────────────────────────────
  function _renderDashboard() {
    const anneeData = DGHData.getAnnee();
    const bilan     = Calculs.bilanDGH(anneeData);
    const alertes   = Calculs.genererAlertes(anneeData);

    // Année
    _setText('dashYear', DGHData.getAnneeActive().replace('-', '–'));

    // KPIs
    _setText('kpi-dghtotal',     bilan.enveloppe       ? bilan.enveloppe + ' h'          : '— h');
    _setText('kpi-affectees',    bilan.heuresAllouees   ? bilan.heuresAllouees + ' h'     : '— h');
    _setText('kpi-affectees-pct',bilan.enveloppe        ? bilan.pctConsomme + ' %'        : '— %');
    _setText('kpi-solde',        bilan.enveloppe        ? bilan.solde + ' h'              : '— h');
    _setText('kpi-alertes',      alertes.filter(a => a.severite !== 'info').length || '—');
    _setText('kpi-enseignants',  bilan.nbEnseignants    || '—');
    _setText('kpi-tzr',          'dont ' + bilan.nbTZR + ' TZR / compl.');
    _setText('kpi-hsa',          bilan.totalHSA         ? bilan.totalHSA + ' h'          : '— h');

    // Badge alertes sidebar
    const nbAlertes = alertes.filter(a => a.severite === 'error' || a.severite === 'warning').length;
    const badge = document.getElementById('badge-alertes');
    if (badge) {
      badge.textContent   = nbAlertes || '';
      badge.style.display = nbAlertes ? '' : 'none';
    }

    // Topbar stats
    const stats = document.getElementById('topbarStats');
    if (stats) {
      stats.innerHTML = bilan.enveloppe > 0
        ? '<div class="topbar-stat"><span class="topbar-stat-label">DGH</span><span class="topbar-stat-val">' + bilan.enveloppe + 'h</span></div>'
        + '<div class="topbar-stat"><span class="topbar-stat-label">Affecté</span><span class="topbar-stat-val">' + bilan.pctConsomme + '%</span></div>'
        + '<div class="topbar-stat"><span class="topbar-stat-label">Solde</span><span class="topbar-stat-val">' + bilan.solde + 'h</span></div>'
        : '';
    }

    // Barre de progression
    const bar = document.getElementById('progressBar');
    const lbl = document.getElementById('progress-label');
    if (bar) {
      const pct = bilan.enveloppe > 0 ? Math.min(100, bilan.pctConsomme) : 0;
      bar.style.width      = pct + '%';
      bar.style.background = pct > 100 ? 'var(--c-red)'
        : pct > 90  ? 'linear-gradient(90deg, var(--c-amber), var(--c-red))'
        : 'var(--c-accent)';
    }
    if (lbl) {
      lbl.innerHTML = bilan.enveloppe > 0
        ? '<strong>' + bilan.heuresAllouees + ' / ' + bilan.enveloppe + ' h</strong>'
        : '0 / 0 h';
    }

    // Empty state
    const isEmpty  = DGHData.isEmpty();
    const emptyEl  = document.getElementById('emptyState');
    const resumeEl = document.getElementById('disciplineResume');
    if (emptyEl)  emptyEl.style.display = isEmpty ? '' : 'none';
    if (resumeEl) resumeEl.classList.toggle('hidden', isEmpty);

    // Nom établissement topbar
    const etab   = DGHData.getEtab();
    const etabEl = document.getElementById('etablissementName');
    if (etabEl) etabEl.textContent = etab.nom || 'Mon Collège ⚙';
  }

  // ── ALERTES ──────────────────────────────────────────────────────
  function _renderAlertes() {
    const alertes   = Calculs.genererAlertes(DGHData.getAnnee());
    const container = document.getElementById('view-alertes');
    if (!container) return;

    const ICONES = { error: '✕', warning: '⚠', info: 'ℹ' };

    const html = alertes.length
      ? alertes.map(a =>
          '<div class="alerte-item sev-' + a.severite + '">'
          + '<span class="alerte-icon">' + (ICONES[a.severite] || '·') + '</span>'
          + '<span class="alerte-msg">' + a.message + '</span>'
          + '</div>'
        ).join('')
      : '<div class="empty-alertes">✓ Aucune alerte — tout est en ordre.</div>';

    let zone = container.querySelector('.alertes-zone');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'alertes-zone section-card';
      container.appendChild(zone);
    }
    zone.innerHTML = '<div class="alertes-list">' + html + '</div>';
  }

  // ── RENDU GLOBAL (partagé) ───────────────────────────────────────
  function _renderAll() {
    const etab   = DGHData.getEtab();
    const etabEl = document.getElementById('etablissementName');
    if (etabEl) etabEl.textContent = etab.nom || 'Mon Collège ⚙';
    _renderYearSelect();
  }

  function _renderYearSelect() {
    const select = document.getElementById('yearSelect');
    if (!select) return;
    const annees   = DGHData.getAnnees();
    const active   = DGHData.getAnneeActive();
    const existing = Array.from(select.options).map(o => o.value);
    annees.forEach(a => {
      if (!existing.includes(a)) {
        const opt = document.createElement('option');
        opt.value       = a;
        opt.textContent = a.replace('-', ' – ');
        select.appendChild(opt);
      }
    });
    select.value = active;
  }

  // ── MODAL ÉTABLISSEMENT ──────────────────────────────────────────
  function _openModal() {
    const etab  = DGHData.getEtab();
    const annee = DGHData.getAnnee();
    document.getElementById('inputNomEtab').value = etab.nom      || '';
    document.getElementById('inputUAI').value      = etab.uai      || '';
    document.getElementById('inputAcademie').value = etab.academie || '';
    document.getElementById('inputDGH').value      = annee.dotation.enveloppe || '';
    document.getElementById('modalEtablissement').classList.remove('hidden');
  }

  function _closeModal() {
    document.getElementById('modalEtablissement').classList.add('hidden');
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

  // ── BINDING ÉVÉNEMENTS ───────────────────────────────────────────
  function _bindEvents() {

    // Thème dark/light
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      _applyTheme(current === 'dark' ? 'light' : 'dark');
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

    // Sidebar toggle (desktop)
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('collapsed');
    });

    // Menu mobile
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });

    // Fermer sidebar mobile au clic extérieur
    document.addEventListener('click', e => {
      if (window.innerWidth > 768) return;
      const sidebar   = document.getElementById('sidebar');
      const menuBtn   = document.getElementById('mobileMenuBtn');
      if (sidebar && !sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });

    // Changement d'année
    document.getElementById('yearSelect')?.addEventListener('change', e => {
      DGHData.setAnneeActive(e.target.value);
      _renderAll();
      _renderDashboard();
      toast('Année ' + e.target.value.replace('-', '–') + ' chargée', 'info');
    });

    // Établissement — ouvrir modal
    document.getElementById('etablissementName')?.addEventListener('click', _openModal);

    // Modal — fermer
    document.getElementById('modalClose')?.addEventListener('click',  _closeModal);
    document.getElementById('modalCancel')?.addEventListener('click', _closeModal);
    document.getElementById('modalEtablissement')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) _closeModal();
    });

    // Modal — enregistrer
    document.getElementById('modalSave')?.addEventListener('click', _saveModal);

    // Export JSON
    document.getElementById('btnExport')?.addEventListener('click', () => {
      const filename = DGHData.exportJSON();
      toast('Exporté : ' + filename, 'success');
    });

    // Import JSON — bouton sidebar
    const btnImport  = document.getElementById('btnImport');
    const fileImport = document.getElementById('fileImport');
    btnImport?.addEventListener('click', () => fileImport?.click());

    // Import JSON — bouton empty state
    document.getElementById('btnImportEmpty')?.addEventListener('click', () => {
      fileImport?.click();
    });

    // Import JSON — lecture du fichier
    fileImport?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const result = await DGHData.importJSON(file);
        _renderAll();
        _renderDashboard();
        toast('Données importées — ' + result.etablissement, 'success');
      } catch (err) {
        toast('Erreur d\'import : ' + err.message, 'error', 5000);
      }
      fileImport.value = '';
    });

    // Ctrl+S → export rapide
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        toast('Ctrl+S — Exporté : ' + DGHData.exportJSON(), 'success');
      }
    });

    // Erreur localStorage
    document.addEventListener('dgh:storage-error', () => {
      toast('Erreur de sauvegarde — vérifiez l\'espace disponible', 'error', 6000);
    });
  }

  // ── TOAST ────────────────────────────────────────────────────────
  function toast(message, type, duration) {
    type     = type     || 'info';
    duration = duration || 3500;
    const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML =
      '<span class="toast-icon">' + (ICONS[type] || 'ℹ') + '</span>'
      + '<span>' + message + '</span>';
    container.appendChild(el);

    setTimeout(() => {
      el.style.cssText += 'opacity:0;transform:translateX(12px);transition:0.25s ease;';
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  // ── UTILITAIRE ───────────────────────────────────────────────────
  function _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // ── API PUBLIQUE ─────────────────────────────────────────────────
  return { init, navigate, toast };

})();

// Démarrage après chargement du DOM
document.addEventListener('DOMContentLoaded', () => app.init());
