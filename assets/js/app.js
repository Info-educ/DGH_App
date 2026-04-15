/**
 * DGH App — Contrôleur principal
 * Navigation, rendu du dashboard, gestion des events UI
 */

const app = (() => {

  // ─────────────────────────────────────────────
  // ÉTAT
  // ─────────────────────────────────────────────
  let _currentView = 'dashboard';

  const VIEWS = {
    'dashboard':   { label: 'Tableau de bord',  icon: '⬡' },
    'structures':  { label: 'Structures',        icon: '⊞' },
    'dotation':    { label: 'Dotation DGH',      icon: '◎' },
    'enseignants': { label: 'Enseignants',        icon: '◉' },
    'simulation':  { label: 'Simulation',        icon: '⟳' },
    'alertes':     { label: 'Alertes',           icon: '◬' },
    'synthese':    { label: 'Synthèses',         icon: '▤' },
    'historique':  { label: 'Historique',        icon: '◷' }
  };

  // ─────────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────────
  function init() {
    DGHData.init();
    _bindEvents();
    _renderAll();
    navigate('dashboard');
    console.info('[app] DGH App prête.');
  }

  // ─────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────
  function navigate(viewId) {
    if (!VIEWS[viewId]) return;

    // Désactiver vue courante
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Activer nouvelle vue
    const viewEl = document.getElementById(`view-${viewId}`);
    const navEl  = document.querySelector(`[data-view="${viewId}"]`);
    if (viewEl) viewEl.classList.add('active');
    if (navEl)  navEl.classList.add('active');

    _currentView = viewId;

    // Mettre à jour breadcrumb
    const bc = document.getElementById('breadcrumb');
    if (bc) bc.innerHTML = `<span>${VIEWS[viewId].label}</span>`;

    // Fermer sidebar mobile si ouverte
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
    }

    // Rendu spécifique à la vue
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'alertes')   renderAlertes();
  }

  // ─────────────────────────────────────────────
  // RENDU DASHBOARD
  // ─────────────────────────────────────────────
  function renderDashboard() {
    const anneeData = DGHData.getAnnee();
    const bilan     = Calculs.bilanDGH(anneeData);
    const alertes   = Calculs.genererAlertes(anneeData);

    // Année affichée
    const yearEl = document.getElementById('dashYear');
    if (yearEl) yearEl.textContent = DGHData.getAnneeActive().replace('-', '–');

    // KPIs
    _setText('kpi-dghtotal',  bilan.enveloppe ? `${bilan.enveloppe} h` : '— h');
    _setText('kpi-affectees', bilan.heuresAllouees ? `${bilan.heuresAllouees} h` : '— h');
    _setText('kpi-affectees-pct', bilan.enveloppe ? `${bilan.pctConsomme} %` : '— %');
    _setText('kpi-solde',     bilan.enveloppe ? `${bilan.solde} h` : '— h');
    _setText('kpi-alertes',   alertes.length ? alertes.filter(a => a.severite !== 'info').length : '—');
    _setText('kpi-enseignants', bilan.nbEnseignants || '—');
    _setText('kpi-tzr',       `dont ${bilan.nbTZR} TZR / compl.`);
    _setText('kpi-hsa',       bilan.totalHSA ? `${bilan.totalHSA} h` : '— h');

    // Badge alertes sidebar
    const erreurs = alertes.filter(a => a.severite === 'error' || a.severite === 'warning').length;
    const badgeAlertes = document.getElementById('badge-alertes');
    if (badgeAlertes) {
      badgeAlertes.textContent = erreurs || '';
      badgeAlertes.style.display = erreurs ? '' : 'none';
    }

    // Topbar stats
    const topbarStats = document.getElementById('topbarStats');
    if (topbarStats && bilan.enveloppe > 0) {
      topbarStats.innerHTML = `
        <div class="topbar-stat">
          DGH <span class="topbar-stat-val">${bilan.enveloppe}h</span>
        </div>
        <div class="topbar-stat">
          Affecté <span class="topbar-stat-val">${bilan.pctConsomme}%</span>
        </div>
        <div class="topbar-stat">
          Solde <span class="topbar-stat-val">${bilan.solde}h</span>
        </div>
      `;
    }

    // Progress bar
    const bar = document.getElementById('progressBar');
    const lbl = document.getElementById('progress-label');
    if (bar && bilan.enveloppe > 0) {
      const pct = Math.min(100, bilan.pctConsomme);
      bar.style.width = `${pct}%`;
      bar.style.background = pct > 100
        ? 'var(--c-red)'
        : pct > 90
          ? 'linear-gradient(90deg, var(--c-amber), var(--c-red))'
          : 'linear-gradient(90deg, var(--c-accent), var(--c-teal))';
    }
    if (lbl && bilan.enveloppe > 0) {
      lbl.textContent = `${bilan.heuresAllouees} / ${bilan.enveloppe} h`;
    }

    // Empty state
    const isEmpty   = DGHData.isEmpty();
    const emptyEl   = document.getElementById('emptyState');
    const resumeEl  = document.getElementById('disciplineResume');
    if (emptyEl)  emptyEl.style.display  = isEmpty ? '' : 'none';
    if (resumeEl) resumeEl.classList.toggle('hidden', isEmpty);

    // Nom établissement dans topbar
    const etab = DGHData.getEtab();
    const etabEl = document.getElementById('etablissementName');
    if (etabEl) etabEl.textContent = etab.nom || 'Mon Collège ⚙';
  }

  // ─────────────────────────────────────────────
  // RENDU ALERTES
  // ─────────────────────────────────────────────
  function renderAlertes() {
    const anneeData = DGHData.getAnnee();
    const alertes   = Calculs.genererAlertes(anneeData);
    const container = document.getElementById('view-alertes');
    if (!container) return;

    const icones = {
      error:   '✕',
      warning: '⚠',
      info:    'ℹ'
    };

    const listeHTML = alertes.length
      ? alertes.map(a => `
          <div class="alerte-item sev-${a.severite}">
            <span class="alerte-icon">${icones[a.severite] || '·'}</span>
            <span class="alerte-msg">${a.message}</span>
          </div>
        `).join('')
      : '<div class="empty-alertes">✓ Aucune alerte — tout est en ordre.</div>';

    // Injecter après le view-header
    let alertesZone = container.querySelector('.alertes-zone');
    if (!alertesZone) {
      alertesZone = document.createElement('div');
      alertesZone.className = 'alertes-zone section-card';
      container.appendChild(alertesZone);
    }
    alertesZone.innerHTML = `<div class="alertes-list">${listeHTML}</div>`;
  }

  // ─────────────────────────────────────────────
  // RENDU GLOBAL
  // ─────────────────────────────────────────────
  function _renderAll() {
    // Nom établissement
    const etab = DGHData.getEtab();
    const etabEl = document.getElementById('etablissementName');
    if (etabEl) etabEl.textContent = etab.nom || 'Mon Collège ⚙';

    // Sélecteur d'années
    _renderYearSelect();
  }

  function _renderYearSelect() {
    const select = document.getElementById('yearSelect');
    if (!select) return;
    const annees = DGHData.getAnnees();
    const active = DGHData.getAnneeActive();

    // Ajouter les années manquantes
    const existingVals = Array.from(select.options).map(o => o.value);
    annees.forEach(a => {
      if (!existingVals.includes(a)) {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a.replace('-', ' – ');
        select.appendChild(opt);
      }
    });
    select.value = active;
  }

  // ─────────────────────────────────────────────
  // MODAL ÉTABLISSEMENT
  // ─────────────────────────────────────────────
  function openModalEtab() {
    const etab = DGHData.getEtab();
    const annee = DGHData.getAnnee();

    document.getElementById('inputNomEtab').value  = etab.nom       || '';
    document.getElementById('inputUAI').value       = etab.uai       || '';
    document.getElementById('inputAcademie').value  = etab.academie  || '';
    document.getElementById('inputDGH').value       = annee.dotation.enveloppe || '';

    document.getElementById('modalEtablissement').classList.remove('hidden');
  }

  function closeModalEtab() {
    document.getElementById('modalEtablissement').classList.add('hidden');
  }

  function saveModalEtab() {
    const nom      = document.getElementById('inputNomEtab').value.trim();
    const uai      = document.getElementById('inputUAI').value.trim();
    const academie = document.getElementById('inputAcademie').value.trim();
    const enveloppe= parseFloat(document.getElementById('inputDGH').value) || 0;

    DGHData.setEtab({ nom, uai, academie });
    DGHData.setDotation(enveloppe);

    closeModalEtab();
    _renderAll();
    renderDashboard();
    toast('Paramètres enregistrés', 'success');
  }

  // ─────────────────────────────────────────────
  // TOAST NOTIFICATIONS
  // ─────────────────────────────────────────────
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const el    = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || '·'}</span> ${message}`;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity   = '0';
      el.style.transform = 'translateX(16px)';
      el.style.transition = '0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ─────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────
  function _bindEvents() {

    // Navigation sidebar
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.view));
    });

    // Boutons data-navigate (remplace tous les onclick inline)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-navigate]');
      if (btn) navigate(btn.dataset.navigate);
    });

    // Bouton "Importer" dans l'empty state
    document.getElementById('btnImportEmpty')?.addEventListener('click', () => {
      document.getElementById('fileImport')?.click();
    });

    // Toggle sidebar (desktop)
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar   = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    // Menu mobile
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Clic hors sidebar (mobile)
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && sidebar) {
        if (!sidebar.contains(e.target) && !mobileBtn?.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      }
    });

    // Changement d'année
    const yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
      yearSelect.addEventListener('change', () => {
        DGHData.setAnneeActive(yearSelect.value);
        _renderAll();
        renderDashboard();
        toast(`Année ${yearSelect.value.replace('-', '–')} chargée`, 'info');
      });
    }

    // Établissement (topbar — clic pour ouvrir modal)
    const etabEl = document.getElementById('etablissementName');
    if (etabEl) etabEl.addEventListener('click', openModalEtab);

    // Modal
    document.getElementById('modalClose')?.addEventListener('click',  closeModalEtab);
    document.getElementById('modalCancel')?.addEventListener('click', closeModalEtab);
    document.getElementById('modalSave')?.addEventListener('click',   saveModalEtab);
    document.getElementById('modalEtablissement')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModalEtab();
    });

    // Export JSON
    document.getElementById('btnExport')?.addEventListener('click', () => {
      const filename = DGHData.exportJSON();
      toast(`Exporté : ${filename}`, 'success');
    });

    // Import JSON
    const btnImport  = document.getElementById('btnImport');
    const fileImport = document.getElementById('fileImport');

    btnImport?.addEventListener('click', () => fileImport?.click());
    fileImport?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const result = await DGHData.importJSON(file);
        _renderAll();
        renderDashboard();
        toast(`Données importées — ${result.etablissement}`, 'success');
      } catch(err) {
        toast(`Erreur d'import : ${err.message}`, 'error', 5000);
      }
      fileImport.value = ''; // reset input
    });

    // Erreur storage
    document.addEventListener('dgh:storage-error', () => {
      toast('Erreur de sauvegarde locale — vérifiez l\'espace disponible', 'error', 6000);
    });

    // Keyboard shortcut : Ctrl+S → export
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const filename = DGHData.exportJSON();
        toast(`Ctrl+S — Exporté : ${filename}`, 'success');
      }
    });
  }

  // ─────────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────────
  function _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // ─────────────────────────────────────────────
  // API publique
  // ─────────────────────────────────────────────
  return {
    init,
    navigate,
    renderDashboard,
    toast,
    openModalEtab
  };

})();

// ─────────────────────────────────────────────
// CSS complémentaire — alertes (injecté dynamiquement)
// ─────────────────────────────────────────────
const _styleAlertes = document.createElement('style');
_styleAlertes.textContent = `
  .alertes-zone { margin-top: 0; }
  .alertes-list { padding: 0.5rem 0; }
  .alerte-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--c-border);
    font-size: 0.85rem;
    transition: background var(--t-fast);
  }
  .alerte-item:last-child { border-bottom: none; }
  .alerte-item:hover { background: var(--c-surface2); }
  .alerte-icon { font-size: 0.9rem; flex-shrink: 0; margin-top: 1px; }
  .sev-error   .alerte-icon { color: var(--c-red); }
  .sev-warning .alerte-icon { color: var(--c-amber); }
  .sev-info    .alerte-icon { color: var(--c-accent); }
  .alerte-msg  { color: var(--c-text); line-height: 1.5; }
  .empty-alertes {
    padding: 2rem;
    text-align: center;
    color: var(--c-green);
    font-family: 'Syne', sans-serif;
    font-weight: 600;
  }
  .discipline-list { padding: 0.5rem 0; }
`;
document.head.appendChild(_styleAlertes);

// ─────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => app.init());
