/**
 * DGH App — Module Instances v4.0.0
 * Trois vues pour préparer les instances : Synthèse CA, Dialogue de gestion, Services enseignants.
 * Chacune dispose d'un mode projection (sidebar masquée, plein écran, imprimable).
 *
 * Architecture :
 *  - IIFE, namespace DGHInstances
 *  - Zéro addEventListener direct — toutes les actions via data-action dans app.js
 *  - Fonctions de calcul : Calculs.syntheseCA / dialogueGestion / recapServices
 *  - Mode projection : bascule CSS class 'mode-projection' sur body + rendu dédié
 */

const DGHInstances = (() => {

  // ── État ─────────────────────────────────────────────────────────
  let _activeTab     = 'synthese-ca'; // 'synthese-ca' | 'dialogue' | 'services'
  let _projMode      = false;
  let _sortServCol   = 'nom';
  let _sortServDir   = 1;

  // ── Init ─────────────────────────────────────────────────────────
  function init() {}

  // ── Render principal ──────────────────────────────────────────────
  function renderInstances(tab) {
    if (tab) _activeTab = tab;
    const el = document.getElementById('view-instances');
    if (!el) return;

    const anneeData = DGHData.getAnnee();
    const etab      = DGHData.getEtab();

    el.innerHTML = `
<div class="view-header inst-header">
  <div class="inst-header-left">
    <h1 class="view-title">Préparer les instances</h1>
    <p class="view-subtitle">${_esc(etab.nom || 'Établissement')} · ${DGHData.getAnneeActive().replace('-', '\u2013')}</p>
  </div>
  <div class="inst-header-actions">
    <button class="btn-secondary btn-sm" data-action="inst-export-csv" title="Exporter l'onglet actif en CSV (Excel)">
      ⬇ Exporter Excel
    </button>
    <button class="btn-secondary btn-sm inst-print-btn" data-action="inst-projeter" title="Vue projection / impression">
      ⎙ Projeter
    </button>
  </div>
</div>

<div class="inst-tabs">
  <button class="inst-tab${_activeTab === 'synthese-ca' ? ' active' : ''}" data-action="inst-tab" data-tab="synthese-ca">Synthèse CA</button>
  <button class="inst-tab${_activeTab === 'dialogue'    ? ' active' : ''}" data-action="inst-tab" data-tab="dialogue">Dialogue de gestion</button>
  <button class="inst-tab${_activeTab === 'services'    ? ' active' : ''}" data-action="inst-tab" data-tab="services">Services enseignants</button>
</div>

<div id="instContent" class="inst-content">
  ${_renderTab(_activeTab, anneeData, etab)}
</div>`;
  }

  // ── Dispatch onglets ──────────────────────────────────────────────
  function _renderTab(tab, anneeData, etab) {
    if (tab === 'synthese-ca') return _htmlSyntheseCA(Calculs.syntheseCA(anneeData, etab));
    if (tab === 'dialogue')    return _htmlDialogue(Calculs.dialogueGestion(anneeData, etab));
    if (tab === 'services')    return _htmlServices(Calculs.recapServices(anneeData, etab));
    return '';
  }

  function switchTab(tab) {
    _activeTab = tab;
    renderInstances();
  }

  // ══════════════════════════════════════════════════════════════════
  // SYNTHÈSE CA
  // ══════════════════════════════════════════════════════════════════
  function _htmlSyntheseCA(d) {
    const { bilan, stru, discs, hpcs, totalPacte, totalImp } = d;
    const statut = bilan.depassement
      ? '<span class="inst-badge inst-badge-danger">Dépassement</span>'
      : bilan.solde === 0
        ? '<span class="inst-badge inst-badge-warn">Solde nul</span>'
        : '<span class="inst-badge inst-badge-ok">Équilibre</span>';

    const discRows = discs.map(disc => `
<tr>
  <td><span class="disc-dot" style="background:${_esc(disc.couleur)}"></span>${_esc(disc.nom)}</td>
  <td class="font-mono ta-r">${disc.hp}h</td>
  <td class="font-mono ta-r">${disc.hsa > 0 ? disc.hsa + 'h' : '<span class="muted">\u2014</span>'}</td>
  <td class="font-mono ta-r fw-bold">${disc.total}h</td>
</tr>`).join('');

    const hpcRows = hpcs.length > 0 ? hpcs.map(h => `
<tr>
  <td><span class="disc-dot" style="background:#94a3b8"></span>${_esc(h.nom)}</td>
  <td class="font-mono ta-r">${h.typeHeure === 'hp' ? h.heures + 'h' : '<span class="muted">\u2014</span>'}</td>
  <td class="font-mono ta-r">${h.typeHeure === 'hsa' ? h.heures + 'h' : '<span class="muted">\u2014</span>'}</td>
  <td class="font-mono ta-r fw-bold">${h.heures}h</td>
</tr>`).join('') : '';

    return `
<div class="inst-section-grid">
  <!-- KPIs -->
  <div class="inst-kpi-row">
    <div class="inst-kpi"><div class="inst-kpi-label">Enveloppe DGH</div><div class="inst-kpi-val font-mono">${bilan.enveloppe}h</div><div class="inst-kpi-sub">${bilan.hPosteEnv}h HP · ${bilan.hsaEnv}h HSA</div></div>
    <div class="inst-kpi"><div class="inst-kpi-label">Total alloué</div><div class="inst-kpi-val font-mono">${bilan.totalAlloue}h</div><div class="inst-kpi-sub">${bilan.totalHP}h HP · ${bilan.totalHSA}h HSA</div></div>
    <div class="inst-kpi"><div class="inst-kpi-label">Solde</div><div class="inst-kpi-val font-mono ${bilan.depassement ? 'txt-danger' : 'txt-ok'}">${bilan.solde >= 0 ? '+' : ''}${bilan.solde}h</div><div class="inst-kpi-sub">${statut}</div></div>
    <div class="inst-kpi"><div class="inst-kpi-label">Structures</div><div class="inst-kpi-val font-mono">${stru.nbDivisions} div.</div><div class="inst-kpi-sub">${stru.effectifTotal} élèves</div></div>
  </div>

  <!-- Barre consommation -->
  <div class="inst-card">
    <div class="inst-card-title">Consommation DGH</div>
    <div class="progress-track inst-progress">
      <div class="progress-fill ${bilan.depassement ? 'progress-fill-danger' : ''}" style="width:${Math.min(100, bilan.pctConsomme)}%"></div>
    </div>
    <div class="inst-progress-legend"><span>${bilan.pctConsomme}% consommé</span><span>${bilan.totalAlloue}h / ${bilan.enveloppe}h</span></div>
  </div>

  <!-- Tableau disciplines -->
  <div class="inst-card inst-card-full">
    <div class="inst-card-title">Répartition par discipline</div>
    <table class="inst-table">
      <thead><tr><th>Discipline</th><th class="ta-r">HP</th><th class="ta-r">HSA</th><th class="ta-r">Total</th></tr></thead>
      <tbody>
        ${discRows}
        ${hpcRows}
        <tr class="inst-table-total">
          <td>Total</td>
          <td class="font-mono ta-r">${bilan.totalHP}h</td>
          <td class="font-mono ta-r">${bilan.totalHSA}h</td>
          <td class="font-mono ta-r">${bilan.totalAlloue}h</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${(totalPacte > 0 || totalImp > 0) ? `
  <div class="inst-card">
    <div class="inst-card-title">Missions hors DGH</div>
    <div class="inst-missions-row">
      <span><span class="badge-pacte">PACTE</span> <span class="font-mono">${totalPacte}h</span></span>
      <span><span class="badge-imp">IMP</span> <span class="font-mono">${totalImp}h</span></span>
    </div>
  </div>` : ''}
</div>`;
  }

  // ══════════════════════════════════════════════════════════════════
  // DIALOGUE DE GESTION
  // ══════════════════════════════════════════════════════════════════
  function _htmlDialogue(d) {
    const { bilan, stru, hParEleve, tauxHSA, ecartsMEN, statuts, nbEns } = d;

    const ecartRows = ecartsMEN.map(e => {
      const cls = e.delta === null ? '' : e.delta >= 0 ? 'txt-ok' : 'txt-danger';
      const sign = e.delta !== null && e.delta > 0 ? '+' : '';
      return `<tr>
  <td><strong>${_esc(e.niv)}</strong></td>
  <td class="font-mono ta-r">${e.nbDiv}</td>
  <td class="font-mono ta-r">${e.eff}</td>
  <td class="font-mono ta-r">${e.hMEN}h <small class="muted">×${e.nbDiv}</small></td>
  <td class="font-mono ta-r">${e.hMENTotal}h</td>
  <td class="font-mono ta-r">${e.hDotees}h</td>
  <td class="font-mono ta-r ${cls} fw-bold">${e.delta !== null ? sign + e.delta + 'h' : '\u2014'}</td>
</tr>`;
    }).join('');

    const statutRows = statuts.map(s =>
      `<tr><td>${_esc(s.grade)}</td><td class="font-mono ta-r">${s.nb}</td></tr>`
    ).join('');

    return `
<div class="inst-section-grid">
  <!-- Ratios clés -->
  <div class="inst-kpi-row">
    <div class="inst-kpi">
      <div class="inst-kpi-label">H / élève (moyen)</div>
      <div class="inst-kpi-val font-mono">${hParEleve !== null ? hParEleve + 'h' : '\u2014'}</div>
      <div class="inst-kpi-sub">${bilan.totalAlloue}h ÷ ${stru.effectifTotal} élèves</div>
    </div>
    <div class="inst-kpi">
      <div class="inst-kpi-label">Taux HSA</div>
      <div class="inst-kpi-val font-mono ${tauxHSA > 20 ? 'txt-danger' : ''}">${tauxHSA}%</div>
      <div class="inst-kpi-sub">${bilan.totalHSA}h HSA / ${bilan.totalAlloue}h total</div>
    </div>
    <div class="inst-kpi">
      <div class="inst-kpi-label">Équipe enseignante</div>
      <div class="inst-kpi-val font-mono">${nbEns}</div>
      <div class="inst-kpi-sub">enseignants</div>
    </div>
    <div class="inst-kpi">
      <div class="inst-kpi-label">Divisions</div>
      <div class="inst-kpi-val font-mono">${stru.nbDivisions}</div>
      <div class="inst-kpi-sub">${stru.effectifTotal} élèves</div>
    </div>
  </div>

  <!-- Écarts MEN -->
  <div class="inst-card inst-card-full">
    <div class="inst-card-title">Écarts aux heures plancher MEN <span class="inst-card-hint">(Grilles programme officielles)</span></div>
    <table class="inst-table">
      <thead><tr><th>Niveau</th><th class="ta-r">Div.</th><th class="ta-r">Élèves</th><th class="ta-r">H plancher MEN</th><th class="ta-r">Total plancher</th><th class="ta-r">H dotées</th><th class="ta-r">Écart</th></tr></thead>
      <tbody>${ecartRows}</tbody>
    </table>
    <p class="inst-note">⚠ L'écart est une approximation proratisée. Pour l'argumentaire précis, croiser avec la dotation par discipline.</p>
  </div>

  <!-- Répartition statutaire -->
  ${statuts.length > 0 ? `
  <div class="inst-card">
    <div class="inst-card-title">Répartition statutaire</div>
    <table class="inst-table">
      <thead><tr><th>Grade / Statut</th><th class="ta-r">Nb</th></tr></thead>
      <tbody>${statutRows}</tbody>
    </table>
  </div>` : ''}
</div>`;
  }

  // ══════════════════════════════════════════════════════════════════
  // SERVICES ENSEIGNANTS
  // ══════════════════════════════════════════════════════════════════
  function _htmlServices(d) {
    const { rows, bilan, nbEns } = d;

    if (nbEns === 0) return `<div class="placeholder-view"><div class="placeholder-icon">◉</div><p>Aucun enseignant saisi.</p></div>`;

    const thSort = (col, label) => {
      const active = _sortServCol === col;
      const arrow  = active ? (_sortServDir === 1 ? ' ▲' : ' ▼') : '';
      return `<th class="inst-th-sort${active ? ' active' : ''}" data-action="inst-sort-serv" data-col="${col}">${label}${arrow}</th>`;
    };

    // Tri
    const sorted = [...rows].sort((a, b) => {
      let va = a[_sortServCol], vb = b[_sortServCol];
      if (va === null || va === undefined) va = _sortServDir === 1 ? Infinity : -Infinity;
      if (vb === null || vb === undefined) vb = _sortServDir === 1 ? Infinity : -Infinity;
      if (typeof va === 'string') return va.localeCompare(vb, 'fr') * _sortServDir;
      return (va - vb) * _sortServDir;
    });

    const statutCls = s => s === 'hsa' ? 'txt-warn' : s === 'sous-service' ? 'txt-danger' : s === 'equilibre' ? 'txt-ok' : 'muted';
    const statutLbl = s => s === 'hsa' ? 'HSA' : s === 'sous-service' ? 'Sous-svc' : s === 'equilibre' ? 'OK' : '—';

    const bodyRows = sorted.map(r => `<tr>
  <td class="fw-600">${_esc(r.nom)} ${_esc(r.prenom)}</td>
  <td class="muted">${_esc(r.disciplinePrincipale)}</td>
  <td class="font-mono ta-r">${r.hpDisc}h</td>
  <td class="font-mono ta-r">${r.hpHPC > 0 ? r.hpHPC + 'h' : '<span class="muted">\u2014</span>'}</td>
  <td class="font-mono ta-r fw-bold">${r.hpTotal}h</td>
  <td class="font-mono ta-r">${r.hsaTotal > 0 ? r.hsaTotal + 'h' : '<span class="muted">\u2014</span>'}</td>
  <td class="font-mono ta-r fw-bold">${r.totalGeneral}h</td>
  <td class="font-mono ta-r muted">${r.ors > 0 ? r.ors + 'h' : '\u2014'}</td>
  <td class="font-mono ta-r ${statutCls(r.statutORS)}">${statutLbl(r.statutORS)}</td>
  ${(r.totalPacte > 0 || r.totalImp > 0) ? `<td class="font-mono ta-r">${r.totalAvecMissions}h <small class="muted">(+${r.totalPacte + r.totalImp}h missions)</small></td>` : '<td class="ta-r muted">\u2014</td>'}
</tr>`).join('');

    return `
<div class="inst-section-grid">
  <div class="inst-kpi-row">
    <div class="inst-kpi"><div class="inst-kpi-label">Enseignants</div><div class="inst-kpi-val font-mono">${nbEns}</div></div>
    <div class="inst-kpi"><div class="inst-kpi-label">Total HP alloué</div><div class="inst-kpi-val font-mono">${bilan.totalHP}h</div></div>
    <div class="inst-kpi"><div class="inst-kpi-label">Total HSA alloué</div><div class="inst-kpi-val font-mono">${bilan.totalHSA}h</div></div>
  </div>
  <div class="inst-card inst-card-full">
    <div class="inst-card-title">Services par enseignant</div>
    <div style="overflow-x:auto">
    <table class="inst-table inst-table-services">
      <thead><tr>
        ${thSort('nom','Enseignant')}
        <th>Discipline</th>
        ${thSort('hpDisc','HP disc.')}
        ${thSort('hpHPC','HP HPC')}
        ${thSort('hpTotal','HP total')}
        ${thSort('hsaTotal','HSA')}
        ${thSort('totalGeneral','Total')}
        <th class="ta-r">ORS</th>
        <th class="ta-r">Statut</th>
        <th class="ta-r">Avec missions</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    </div>
  </div>
</div>`;
  }

  // ══════════════════════════════════════════════════════════════════
  // MODE PROJECTION / IMPRESSION
  // ══════════════════════════════════════════════════════════════════
  function toggleProjection() {
    _projMode = !_projMode;
    if (_projMode) {
      document.body.classList.add('mode-projection');
      _renderProjection();
    } else {
      document.body.classList.remove('mode-projection');
      const proj = document.getElementById('projOverlay');
      if (proj) proj.remove();
    }
  }

  function _renderProjection() {
    let existing = document.getElementById('projOverlay');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'projOverlay';
      document.body.appendChild(existing);
    }

    const anneeData = DGHData.getAnnee();
    const etab      = DGHData.getEtab();
    const anneeStr  = DGHData.getAnneeActive().replace('-', '\u2013');
    const logo      = etab.logo || null;
    const nomEtab   = etab.nom || 'Établissement';

    const logoHtml = logo
      ? `<img src="${logo}" alt="Logo établissement" class="proj-logo" />`
      : `<div class="proj-logo-initiales">${_initiales(nomEtab)}</div>`;

    let contenu = '';
    if (_activeTab === 'synthese-ca') {
      contenu = _projSyntheseCA(Calculs.syntheseCA(anneeData, etab), anneeStr);
    } else if (_activeTab === 'dialogue') {
      contenu = _projDialogue(Calculs.dialogueGestion(anneeData, etab), anneeStr);
    } else {
      contenu = _projServices(Calculs.recapServices(anneeData, etab), anneeStr);
    }

    existing.innerHTML = `
<div class="proj-bar">
  <button class="proj-close-btn" data-action="inst-projeter">✕ Quitter la projection</button>
  <button class="proj-print-btn" data-action="inst-imprimer">⎙ Imprimer</button>
</div>
<div class="proj-page" id="projPage">
  <div class="proj-header">
    ${logoHtml}
    <div class="proj-header-text">
      <div class="proj-etab-nom">${_esc(nomEtab)}</div>
      ${etab.uai ? `<div class="proj-etab-uai">UAI ${_esc(etab.uai)}</div>` : ''}
      <div class="proj-annee">Année scolaire ${anneeStr}</div>
    </div>
  </div>
  <div class="proj-body">${contenu}</div>
  <div class="proj-footer">
    Document généré par DGH App · ${new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'})}
  </div>
</div>`;
  }

  function _projSyntheseCA(d, anneeStr) {
    const { bilan, stru, discs, hpcs, totalPacte, totalImp } = d;
    const discRows = [...discs, ...hpcs.map(h => ({
      nom: h.nom + ' (HPC)', couleur: '#94a3b8',
      hp: h.typeHeure === 'hp' ? h.heures : 0,
      hsa: h.typeHeure === 'hsa' ? h.heures : 0,
      total: h.heures
    }))].map(disc => `<tr>
  <td><span class="proj-dot" style="background:${_esc(disc.couleur)}"></span>${_esc(disc.nom)}</td>
  <td class="ta-r">${disc.hp > 0 ? disc.hp + 'h' : '\u2014'}</td>
  <td class="ta-r">${disc.hsa > 0 ? disc.hsa + 'h' : '\u2014'}</td>
  <td class="ta-r fw-bold">${disc.total}h</td>
</tr>`).join('');

    return `
<h2 class="proj-title">Synthèse DGH — Conseil d'Administration</h2>
<div class="proj-kpi-row">
  <div class="proj-kpi"><div class="proj-kpi-label">Enveloppe</div><div class="proj-kpi-val">${bilan.enveloppe}h</div></div>
  <div class="proj-kpi"><div class="proj-kpi-label">Alloué</div><div class="proj-kpi-val">${bilan.totalAlloue}h</div></div>
  <div class="proj-kpi ${bilan.depassement ? 'proj-kpi-danger' : 'proj-kpi-ok'}"><div class="proj-kpi-label">Solde</div><div class="proj-kpi-val">${bilan.solde >= 0 ? '+' : ''}${bilan.solde}h</div></div>
  <div class="proj-kpi"><div class="proj-kpi-label">Divisions</div><div class="proj-kpi-val">${stru.nbDivisions}</div></div>
  <div class="proj-kpi"><div class="proj-kpi-label">Élèves</div><div class="proj-kpi-val">${stru.effectifTotal}</div></div>
</div>
<div class="proj-bar-wrap">
  <div class="proj-bar-track"><div class="proj-bar-fill ${bilan.depassement ? 'proj-bar-danger' : ''}" style="width:${Math.min(100,bilan.pctConsomme)}%"></div></div>
  <span>${bilan.pctConsomme}% consommé · HP : ${bilan.totalHP}h · HSA : ${bilan.totalHSA}h</span>
</div>
<table class="proj-table">
  <thead><tr><th>Discipline</th><th class="ta-r">HP</th><th class="ta-r">HSA</th><th class="ta-r">Total</th></tr></thead>
  <tbody>
    ${discRows}
    <tr class="proj-total-row"><td>TOTAL</td><td class="ta-r">${bilan.totalHP}h</td><td class="ta-r">${bilan.totalHSA}h</td><td class="ta-r">${bilan.totalAlloue}h</td></tr>
  </tbody>
</table>
${(totalPacte > 0 || totalImp > 0) ? `<p class="proj-note">Missions hors DGH : PACTE ${totalPacte}h · IMP ${totalImp}h (non incluses dans les totaux ci-dessus)</p>` : ''}`;
  }

  function _projDialogue(d, anneeStr) {
    const { bilan, stru, hParEleve, tauxHSA, ecartsMEN, statuts, nbEns } = d;
    const ecartRows = ecartsMEN.map(e => {
      const cls  = e.delta === null ? '' : e.delta >= 0 ? 'proj-ok' : 'proj-danger';
      const sign = e.delta !== null && e.delta > 0 ? '+' : '';
      return `<tr>
  <td><strong>${_esc(e.niv)}</strong></td>
  <td class="ta-r">${e.nbDiv}</td><td class="ta-r">${e.eff}</td>
  <td class="ta-r">${e.hMEN}h</td><td class="ta-r">${e.hMENTotal}h</td>
  <td class="ta-r">${e.hDotees}h</td>
  <td class="ta-r fw-bold ${cls}">${e.delta !== null ? sign + e.delta + 'h' : '\u2014'}</td>
</tr>`;
    }).join('');

    return `
<h2 class="proj-title">Dialogue de gestion — Éléments d'argumentation</h2>
<div class="proj-kpi-row">
  <div class="proj-kpi"><div class="proj-kpi-label">H / élève</div><div class="proj-kpi-val">${hParEleve !== null ? hParEleve + 'h' : '\u2014'}</div></div>
  <div class="proj-kpi ${tauxHSA > 20 ? 'proj-kpi-danger' : ''}"><div class="proj-kpi-label">Taux HSA</div><div class="proj-kpi-val">${tauxHSA}%</div></div>
  <div class="proj-kpi"><div class="proj-kpi-label">Enseignants</div><div class="proj-kpi-val">${nbEns}</div></div>
  <div class="proj-kpi"><div class="proj-kpi-label">Divisions</div><div class="proj-kpi-val">${stru.nbDivisions}</div></div>
</div>
<table class="proj-table">
  <thead><tr><th>Niveau</th><th class="ta-r">Div.</th><th class="ta-r">Élèves</th><th class="ta-r">Plancher MEN</th><th class="ta-r">Total plancher</th><th class="ta-r">H dotées</th><th class="ta-r">Écart</th></tr></thead>
  <tbody>${ecartRows}</tbody>
</table>
${statuts.length > 0 ? `
<h3 class="proj-subtitle">Répartition statutaire</h3>
<table class="proj-table proj-table-sm">
  <thead><tr><th>Grade</th><th class="ta-r">Effectif</th></tr></thead>
  <tbody>${statuts.map(s => `<tr><td>${_esc(s.grade)}</td><td class="ta-r">${s.nb}</td></tr>`).join('')}</tbody>
</table>` : ''}`;
  }

  function _projServices(d, anneeStr) {
    const { rows, bilan, nbEns } = d;
    const statutLbl = s => s === 'hsa' ? 'HSA' : s === 'sous-service' ? 'SS' : s === 'equilibre' ? 'OK' : '—';
    const bodyRows = rows.map(r => `<tr>
  <td>${_esc(r.nom)} ${_esc(r.prenom)}</td>
  <td>${_esc(r.disciplinePrincipale)}</td>
  <td class="ta-r">${r.hpTotal}h</td>
  <td class="ta-r">${r.hsaTotal > 0 ? r.hsaTotal + 'h' : '\u2014'}</td>
  <td class="ta-r fw-bold">${r.totalGeneral}h</td>
  <td class="ta-r">${r.ors > 0 ? r.ors + 'h' : '\u2014'}</td>
  <td class="ta-r">${statutLbl(r.statutORS)}</td>
</tr>`).join('');

    return `
<h2 class="proj-title">Récapitulatif des services enseignants</h2>
<div class="proj-kpi-row">
  <div class="proj-kpi"><div class="proj-kpi-label">Enseignants</div><div class="proj-kpi-val">${nbEns}</div></div>
  <div class="proj-kpi"><div class="proj-kpi-label">Total HP</div><div class="proj-kpi-val">${bilan.totalHP}h</div></div>
  <div class="proj-kpi"><div class="proj-kpi-label">Total HSA</div><div class="proj-kpi-val">${bilan.totalHSA}h</div></div>
</div>
<table class="proj-table proj-table-services">
  <thead><tr><th>Enseignant</th><th>Discipline</th><th class="ta-r">HP</th><th class="ta-r">HSA</th><th class="ta-r">Total</th><th class="ta-r">ORS</th><th class="ta-r">Statut</th></tr></thead>
  <tbody>${bodyRows}</tbody>
</table>`;
  }

  // ── Actions ───────────────────────────────────────────────────────

  // ── EXPORT CSV (Excel) ────────────────────────────────────────────
  function exporterCSV() {
    const anneeData = DGHData.getAnnee();
    const etab      = DGHData.getEtab();
    const annee     = DGHData.getAnneeActive();
    const slug      = (etab.nom || 'dgh').replace(/\s+/g, '_').toLowerCase();
    const STATUTS_ORS = { hsa: 'HSA', 'sous-service': 'Sous-service', equilibre: 'Équilibre', 'sans-ors': '—' };

    if (_activeTab === 'services') {
      const d    = Calculs.recapServices(anneeData, etab);
      const rows = [
        ['Services enseignants — ' + (etab.nom || '') + ' — ' + annee],
        [],
        ['Nom', 'Prénom', 'Grade', 'Discipline principale', 'HP disciplines', 'HP HPC', 'HP total', 'HSA', 'Total service', 'ORS', 'Écart ORS', 'Statut', 'Pacte (h)', 'IMP (h)', 'Total avec missions']
      ];
      d.rows.forEach(r => rows.push([
        r.nom, r.prenom, r.grade, r.disciplinePrincipale,
        r.hpDisc, r.hpHPC, r.hpTotal, r.hsaTotal, r.totalGeneral,
        r.ors || '', r.ecartORS === null ? '' : r.ecartORS,
        STATUTS_ORS[r.statutORS] || '', r.totalPacte, r.totalImp, r.totalAvecMissions
      ]));
      app.downloadCSV(slug + '_services_' + annee + '.csv', rows);
      app.toast('Export CSV des services généré.');
      return;
    }

    if (_activeTab === 'synthese-ca') {
      const d    = Calculs.syntheseCA(anneeData, etab);
      const rows = [
        ['Synthèse DGH — ' + (etab.nom || '') + ' — ' + annee],
        [],
        ['Enveloppe HP', d.bilan.hPosteEnv], ['Enveloppe HSA', d.bilan.hsaEnv],
        ['Enveloppe totale', d.bilan.enveloppe], ['Total alloué', d.bilan.totalAlloue],
        ['Solde', d.bilan.solde],
        [],
        ['Discipline', 'HP', 'HSA', 'Total']
      ];
      d.discs.forEach(x => rows.push([x.nom, x.hp, x.hsa, x.total]));
      rows.push([]);
      rows.push(['Heure péda. complémentaire', 'Heures', 'Type']);
      d.hpcs.forEach(h => rows.push([h.nom, h.heures, h.typeHeure === 'hsa' ? 'HSA' : 'HP']));
      rows.push([]);
      rows.push(['Total Pacte (h)', d.totalPacte], ['Total IMP (h)', d.totalImp]);
      app.downloadCSV(slug + '_synthese_ca_' + annee + '.csv', rows);
      app.toast('Export CSV de la synthèse généré.');
      return;
    }

    // dialogue de gestion
    const d    = Calculs.dialogueGestion(anneeData, etab);
    const rows = [
      ['Dialogue de gestion — ' + (etab.nom || '') + ' — ' + annee],
      [],
      ['Divisions', d.stru.nbDivisions], ['Effectif total', d.stru.effectifTotal],
      ['Enveloppe totale', d.bilan.enveloppe], ['Total alloué', d.bilan.totalAlloue],
      ['Solde', d.bilan.solde],
      ['H / élève', d.hParEleve === null ? '' : d.hParEleve],
      ['Taux HSA (%)', d.tauxHSA],
      [],
      ['Niveau', 'Divisions', 'Effectif', 'H grille MEN/div', 'H MEN total']
    ];
    d.ecartsMEN.forEach(e => rows.push([e.niv, e.nbDiv, e.eff, e.hMEN, e.hMENTotal]));
    app.downloadCSV(slug + '_dialogue_gestion_' + annee + '.csv', rows);
    app.toast('Export CSV du dialogue de gestion généré.');
  }

  function imprimer() {
    window.print();
  }

  function sortServices(col) {
    if (_sortServCol === col) _sortServDir = -_sortServDir;
    else { _sortServCol = col; _sortServDir = 1; }
    const anneeData = DGHData.getAnnee();
    const etab      = DGHData.getEtab();
    const el = document.getElementById('instContent');
    if (el) el.innerHTML = _htmlServices(Calculs.recapServices(anneeData, etab));
  }

  // ── Utilitaires ───────────────────────────────────────────────────
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _initiales(nom) {
    return (nom || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  }

  return { init, renderInstances, switchTab, toggleProjection, imprimer, sortServices, exporterCSV };

})();
