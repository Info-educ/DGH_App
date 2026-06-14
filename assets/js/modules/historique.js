/**
 * DGH App — Module Historique v3.9.0
 * Comparatif pluriannuel N vs N-1 avec système de snapshots.
 *
 * Architecture :
 *  - IIFE, namespace DGHHistorique
 *  - Zéro addEventListener direct — toutes les actions via data-action dans _onGlobalClick (app.js)
 *  - Zéro localStorage direct
 *  - Fonctions pures de calcul déléguées à calculs.js (Calculs.comparatifDisciplines)
 */

const DGHHistorique = (() => {

  // ── État interne ──────────────────────────────────────────────────
  let _anneeGauche = null;   // référence (N-1 ou snapshot)
  let _anneeDroite = null;   // comparée (N courant)
  let _sortCol     = 'nom';  // colonne de tri actif
  let _sortDir     = 1;      // 1 = asc, -1 = desc
  let _confirmAction = null; // 'figer' | 'del-snapshot', anneeId en cours

  // ── Init ─────────────────────────────────────────────────────────
  function init() {}

  function render() {
    const annees = DGHData.getAnnees(); // triées décroissantes
    const active = DGHData.getAnneeActive();

    // Sélection initiale : droite = année active, gauche = précédente si dispo
    if (!_anneeDroite || !annees.includes(_anneeDroite)) _anneeDroite = active;
    if (!_anneeGauche || !annees.includes(_anneeGauche) || _anneeGauche === _anneeDroite) {
      const autres = annees.filter(a => a !== _anneeDroite);
      _anneeGauche = autres.length > 0 ? autres[0] : null;
    }

    const el = document.getElementById('view-historique');
    if (!el) return;
    el.innerHTML = _html(annees, active);
    _updateTableau();
  }

  // ── HTML principal ────────────────────────────────────────────────
  function _html(annees, active) {
    const opts = (selected, exclude) => annees
      .map(a => `<option value="${a}"${a === selected ? ' selected' : ''}>${a.replace('-', '\u2013')}${_hasSnapshot(a) ? ' \u2713' : ''}</option>`)
      .join('');

    const snapG = _anneeGauche ? DGHData.getSnapshot(_anneeGauche) : null;
    const snapGDate = snapG ? _fmtDate(snapG._figeLe) : null;

    return `
<div class="view-header">
  <h1 class="view-title">Historique</h1>
  <p class="view-subtitle">Comparatif pluriannuel de la DGH</p>
</div>

<div class="hist-selectors">
  <div class="hist-sel-block">
    <label class="hist-sel-label">Année de référence (N&#8209;1)</label>
    <select class="hist-year-sel" data-action="hist-select-gauche">
      <option value="">— aucune —</option>
      ${opts(_anneeGauche, _anneeDroite)}
    </select>
    ${_anneeGauche ? `
    <div class="hist-snap-bar">
      ${snapG
        ? `<span class="hist-snap-info">&#10003; Figé le ${snapGDate}</span>
           <button class="btn-link-danger" data-action="hist-del-snapshot" data-annee="${_anneeGauche}">Supprimer le snapshot</button>`
        : `<button class="btn-secondary btn-sm" data-action="hist-figer" data-annee="${_anneeGauche}">Figer l&apos;année ${_anneeGauche.replace('-','\u2013')}</button>
           <span class="hist-snap-hint">Données vivantes — non figées</span>`
      }
    </div>` : ''}
  </div>

  <div class="hist-vs-sep">vs</div>

  <div class="hist-sel-block">
    <label class="hist-sel-label">Année comparée (N)</label>
    <select class="hist-year-sel" data-action="hist-select-droite">
      ${opts(_anneeDroite, _anneeGauche)}
    </select>
  </div>
</div>

<div id="histKpis" class="hist-kpi-grid"></div>
<div id="histTableContainer" class="hist-table-wrap"></div>

<!-- Modale confirmation snapshot -->
<div class="modal-overlay${_confirmAction ? ' modal-open' : ''}" id="histConfirm">
  <div class="modal modal-sm">
    <div class="modal-header"><h2 id="histConfirmTitle">Confirmer</h2><button class="modal-close" data-action="hist-confirm-cancel">&#x2715;</button></div>
    <div class="modal-body"><p id="histConfirmMsg"></p></div>
    <div class="modal-footer">
      <button class="btn-secondary" data-action="hist-confirm-cancel">Annuler</button>
      <button class="btn-primary" id="histConfirmOk" data-action="hist-confirm-ok">Confirmer</button>
    </div>
  </div>
</div>`;
  }

  function _hasSnapshot(anneeId) {
    return !!DGHData.getSnapshot(anneeId);
  }

  // ── Données pour le comparatif ────────────────────────────────────
  function _getDataPour(anneeId, role) {
    if (!anneeId) return null;
    if (role === 'gauche') {
      // On préfère le snapshot s'il existe, sinon données vivantes
      const snap = DGHData.getSnapshot(anneeId);
      return snap || DGHData.getAnnee(anneeId);
    }
    return DGHData.getAnnee(anneeId);
  }

  // ── KPI delta ────────────────────────────────────────────────────
  function _updateTableau() {
    const dataN  = _getDataPour(_anneeDroite, 'droite');
    const dataN1 = _getDataPour(_anneeGauche, 'gauche');

    _renderKpis(dataN, dataN1);
    _renderTableau(dataN, dataN1);
  }

  function _renderKpis(dataN, dataN1) {
    const el = document.getElementById('histKpis');
    if (!el) return;

    const bilanN  = dataN  ? Calculs.bilanDotation(dataN)  : null;
    const bilanN1 = dataN1 ? Calculs.bilanDotation(dataN1) : null;
    const struN   = dataN  ? Calculs.resumeStructures(dataN.structures  || []) : null;
    const struN1  = dataN1 ? Calculs.resumeStructures(dataN1.structures || []) : null;

    const cards = [
      { label: 'Enveloppe DGH',     vN: bilanN?.enveloppe,    vN1: bilanN1?.enveloppe,    unite: 'h' },
      { label: 'H-Poste allouées',  vN: bilanN?.totalHP,      vN1: bilanN1?.totalHP,      unite: 'h' },
      { label: 'HSA allouées',      vN: bilanN?.totalHSA,     vN1: bilanN1?.totalHSA,     unite: 'h' },
      { label: 'Divisions',         vN: struN?.nbDivisions,   vN1: struN1?.nbDivisions,   unite: '' }
    ];

    const labelG = _anneeGauche ? _anneeGauche.replace('-', '\u2013') : 'N\u20111';
    const labelD = _anneeDroite ? _anneeDroite.replace('-', '\u2013') : 'N';

    el.innerHTML = cards.map(c => {
      const delta = (c.vN !== null && c.vN !== undefined && c.vN1 !== null && c.vN1 !== undefined)
        ? Math.round((c.vN - c.vN1) * 2) / 2 : null;
      const cls   = delta === null ? '' : delta > 0 ? 'hist-delta-pos' : delta < 0 ? 'hist-delta-neg' : 'hist-delta-zero';
      const arrow = delta === null ? '' : delta > 0 ? '\u25b2' : delta < 0 ? '\u25bc' : '=';
      const fmtV  = v => (v !== null && v !== undefined) ? (v + c.unite) : '\u2014';
      const fmtD  = d => d === null ? '' : (d > 0 ? '+' : '') + d + c.unite;
      return `
<div class="hist-kpi-card">
  <div class="hist-kpi-label">${c.label}</div>
  <div class="hist-kpi-values">
    <span class="hist-kpi-n1">${fmtV(c.vN1)}<small>${labelG}</small></span>
    <span class="hist-kpi-arrow">\u2192</span>
    <span class="hist-kpi-n">${fmtV(c.vN)}<small>${labelD}</small></span>
  </div>
  <div class="hist-kpi-delta ${cls}">${arrow} ${fmtD(delta)}</div>
</div>`;
    }).join('');
  }

  // ── Tableau disciplines ───────────────────────────────────────────
  function _renderTableau(dataN, dataN1) {
    const wrap = document.getElementById('histTableContainer');
    if (!wrap) return;

    if (!dataN && !dataN1) {
      wrap.innerHTML = '<p class="hist-empty">Sélectionnez deux années pour afficher le comparatif.</p>';
      return;
    }

    const rows = Calculs.comparatifDisciplines(dataN || {}, dataN1 || {});

    // Tri
    rows.sort((a, b) => {
      let va = a[_sortCol], vb = b[_sortCol];
      if (va === null) va = _sortDir === 1 ? Infinity : -Infinity;
      if (vb === null) vb = _sortDir === 1 ? Infinity : -Infinity;
      if (typeof va === 'string') return va.localeCompare(vb, 'fr') * _sortDir;
      return (va - vb) * _sortDir;
    });

    const labelG = _anneeGauche ? _anneeGauche.replace('-', '\u2013') : 'N\u20111';
    const labelD = _anneeDroite ? _anneeDroite.replace('-', '\u2013') : 'N';

    const thSort = (col, label) => {
      const active = _sortCol === col;
      const arrow  = active ? (_sortDir === 1 ? ' \u25b2' : ' \u25bc') : '';
      return `<th class="hist-th${active ? ' hist-th-active' : ''}" data-action="hist-sort" data-col="${col}">${label}${arrow}</th>`;
    };

    const fmtH = v => v !== null && v !== undefined ? `<span class="font-mono">${v}h</span>` : '<span class="hist-dash">\u2014</span>';
    const fmtDelta = (d, p) => {
      if (d === null) return '<span class="hist-dash">\u2014</span>';
      const cls  = d > 0 ? 'hist-delta-pos' : d < 0 ? 'hist-delta-neg' : 'hist-delta-zero';
      const sign = d > 0 ? '+' : '';
      const pStr = p !== null ? ` <small>(${d > 0 ? '+' : ''}${p}%)</small>` : '';
      return `<span class="font-mono ${cls}">${sign}${d}h${pStr}</span>`;
    };

    const tbody = rows.map(r => {
      const supprime = r.statut === 'supprime';
      const rowCls   = supprime ? ' class="hist-row-supprime"' : '';
      const badge    = r.statut === 'nouveau'  ? '<span class="badge-hist-new">NOUVEAU</span>'  :
                       r.statut === 'supprime' ? '<span class="badge-hist-del">SUPPRIM\u00c9</span>' : '';
      return `<tr${rowCls}>
  <td>${_esc(r.nom)} ${badge}</td>
  <td>${fmtH(r.hpN1)}</td><td>${fmtH(r.hsaN1)}</td><td>${fmtH(r.totalN1)}</td>
  <td>${fmtH(r.hpN)}</td><td>${fmtH(r.hsaN)}</td><td>${fmtH(r.totalN)}</td>
  <td>${fmtDelta(r.delta, r.pct)}</td>
</tr>`;
    }).join('');

    if (rows.length === 0) {
      wrap.innerHTML = '<p class="hist-empty">Aucune discipline dans les deux années sélectionnées.</p>';
      return;
    }

    wrap.innerHTML = `
<table class="hist-table">
  <thead>
    <tr>
      ${thSort('nom', 'Discipline')}
      <th colspan="3" class="hist-th-group">${labelG}</th>
      <th colspan="3" class="hist-th-group">${labelD}</th>
      ${thSort('delta', '\u0394 Total')}
    </tr>
    <tr class="hist-subhead">
      <th></th>
      <th>HP</th><th>HSA</th><th>Total</th>
      <th>HP</th><th>HSA</th><th>Total</th>
      <th></th>
    </tr>
  </thead>
  <tbody>${tbody}</tbody>
</table>`;
  }

  // ── Actions (appelées depuis app.js _onGlobalClick) ───────────────
  function selectGauche(anneeId) {
    if (anneeId === _anneeDroite) { app.toast('Sélectionnez une année différente de l\u2019année comparée.', 'warning'); return; }
    _anneeGauche = anneeId || null;
    render();
  }

  function selectDroite(anneeId) {
    if (anneeId === _anneeGauche) { app.toast('Sélectionnez une année différente de l\u2019année de référence.', 'warning'); return; }
    _anneeDroite = anneeId;
    render();
  }

  function demanderFiger(anneeId) {
    _confirmAction = { type: 'figer', anneeId };
    const overlay = document.getElementById('histConfirm');
    if (overlay) {
      overlay.classList.add('modal-open');
      const t = document.getElementById('histConfirmTitle');
      const m = document.getElementById('histConfirmMsg');
      if (t) t.textContent = 'Figer l\u2019année ' + anneeId.replace('-', '\u2013') + ' ?';
      if (m) m.textContent = 'Un snapshot de toutes les données de cette année sera créé. Vous pourrez le supprimer à tout moment.';
    }
  }

  function demanderSupprimerSnapshot(anneeId) {
    _confirmAction = { type: 'del-snapshot', anneeId };
    const overlay = document.getElementById('histConfirm');
    if (overlay) {
      overlay.classList.add('modal-open');
      const t = document.getElementById('histConfirmTitle');
      const m = document.getElementById('histConfirmMsg');
      if (t) t.textContent = 'Supprimer le snapshot ?';
      if (m) m.textContent = 'Le snapshot de l\u2019année ' + anneeId.replace('-', '\u2013') + ' sera définitivement supprimé.';
    }
  }

  function confirmerAction() {
    if (!_confirmAction) return;
    const { type, anneeId } = _confirmAction;
    _confirmAction = null;
    _fermerConfirm();
    if (type === 'figer') {
      DGHData.figerSnapshot(anneeId);
      app.toast('Snapshot figé pour ' + anneeId.replace('-', '\u2013') + '.', 'success');
    } else if (type === 'del-snapshot') {
      DGHData.supprimerSnapshot(anneeId);
      app.toast('Snapshot supprimé.', 'info');
    }
    render();
  }

  function annulerConfirm() {
    _confirmAction = null;
    _fermerConfirm();
  }

  function _fermerConfirm() {
    const overlay = document.getElementById('histConfirm');
    if (overlay) overlay.classList.remove('modal-open');
  }

  function sortBy(col) {
    if (_sortCol === col) {
      _sortDir = -_sortDir;
    } else {
      _sortCol = col;
      _sortDir = col === 'delta' ? -1 : 1; // delta : décroissant par défaut
    }
    const dataN  = _getDataPour(_anneeDroite, 'droite');
    const dataN1 = _getDataPour(_anneeGauche, 'gauche');
    _renderTableau(dataN, dataN1);
  }

  // ── Utilitaires ───────────────────────────────────────────────────
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
        + ' \u00e0 ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    } catch(e) { return iso; }
  }

  return { init, render, selectGauche, selectDroite, demanderFiger, demanderSupprimerSnapshot, confirmerAction, annulerConfirm, sortBy };

})();
