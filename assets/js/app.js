/**
 * DGH App — Contrôleur principal v4.0
 * Sprint 5 :
 *   - Enveloppe HP/HSA séparée (saisie inline + modal établissement)
 *   - Structures : tableau récap par niveau avec h théoriques, dispositif masqué
 *   - Dotation : groupes de cours dépliables par discipline, sélection par classes
 *   - Suggestion auto HP depuis besoin théorique
 *   - Onglet HPC (Heures Pédagogiques Complémentaires) avec sélection classes
 */

const app = (() => {

  const VIEWS = {
    dashboard:   'Tableau de bord',
    structures:  'Structures',
    dotation:    'Dotation DGH',
    hpc:         'H. péda. complémentaires',
    enseignants: 'Enseignants',
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
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    if (viewId === 'dashboard')  _renderDashboard();
    if (viewId === 'alertes')    _renderAlertes();
    if (viewId === 'structures') _renderStructures();
    if (viewId === 'dotation')   _renderDotation();
    if (viewId === 'hpc')        _renderHPC();
  }

  // ── DASHBOARD ────────────────────────────────────────────────────
  function _renderDashboard() {
    try {
      const data    = DGHData.getAnnee();
      const bilan   = Calculs.bilanDotation(data);
      const alertes = Calculs.genererAlertes(data);
      const resume  = Calculs.resumeStructures(DGHData.getStructures());

      _set('dashYear', DGHData.getAnneeActive().replace('-', '–'));
      _set('kpi-dghtotal',  bilan.enveloppe  ? bilan.enveloppe + ' h'   : '— h');
      _set('kpi-hposte',    bilan.hPosteEnv  ? bilan.hPosteEnv + ' h'   : '— h');
      _set('kpi-hsa-total', bilan.hsaEnv     ? bilan.hsaEnv + ' h'      : '— h');
      _set('kpi-hposte-sub', bilan.hPosteEnv ? 'enveloppe HP'           : 'dotation structurelle');
      _set('kpi-hsa-sub',   bilan.hsaEnv     ? 'enveloppe HSA'          : 'heures sup payées');
      _set('kpi-alertes',   alertes.filter(a => a.severite !== 'info').length || '—');
      _set('kpi-divisions', resume.nbDivisions || '—');
      _set('kpi-effectif',  resume.effectifTotal ? resume.effectifTotal + ' élèves' : '— élèves');

      const soldeEl  = document.getElementById('kpi-solde');
      const soldeSub = document.getElementById('kpi-solde-sub');
      if (soldeEl) { soldeEl.textContent = bilan.enveloppe ? bilan.solde + ' h' : '— h'; soldeEl.style.color = bilan.depassement ? 'var(--c-red)' : ''; }
      if (soldeSub) soldeSub.textContent = bilan.depassement ? 'dépassement !' : 'heures restantes';

      // Badge alertes
      const nb    = alertes.filter(a => a.severite === 'error' || a.severite === 'warning').length;
      const badge = document.getElementById('badge-alertes');
      if (badge) { badge.textContent = nb || ''; badge.style.display = nb ? '' : 'none'; }

      // Stats topbar
      const stats = document.getElementById('topbarStats');
      if (stats) {
        stats.innerHTML = bilan.enveloppe > 0
          ? '<div class="topbar-stat"><span>HP</span><span class="topbar-stat-val">' + bilan.hPosteEnv + 'h</span></div>'
          + '<div class="topbar-stat"><span>HSA</span><span class="topbar-stat-val">' + bilan.hsaEnv + 'h</span></div>'
          + '<div class="topbar-stat"><span>Solde</span><span class="topbar-stat-val">' + bilan.solde + 'h</span></div>'
          : '';
      }

      // Barre progression duale
      const barHP  = document.getElementById('progressBarHP');
      const barHSA = document.getElementById('progressBarHSA');
      const lbl    = document.getElementById('progress-label');
      if (bilan.enveloppe > 0) {
        const pctHP  = Math.min(100, Math.round((bilan.totalHP  / bilan.enveloppe) * 100));
        const pctHSA = Math.min(100 - pctHP, Math.round((bilan.totalHSA / bilan.enveloppe) * 100));
        if (barHP)  barHP.style.width = pctHP + '%';
        if (barHSA) { barHSA.style.width = pctHSA + '%'; barHSA.style.marginLeft = pctHP + '%'; }
      }
      if (lbl) lbl.textContent = bilan.enveloppe > 0 ? bilan.totalAlloue + ' / ' + bilan.enveloppe + ' h' : '0 / 0 h';
      _set('prog-leg-hp',  bilan.totalHP  + ' h');
      _set('prog-leg-hsa', bilan.totalHSA + ' h');

      // Encart HP/HSA consommé/disponible
      const hpHsaGrid = document.getElementById('dashHpHsaGrid');
      if (hpHsaGrid) {
        if (bilan.enveloppe > 0) {
          hpHsaGrid.style.display = '';
          const hpFree  = Math.round((bilan.hPosteEnv - bilan.totalHP) * 2) / 2;
          const hsaFree = Math.round((bilan.hsaEnv    - bilan.totalHSA) * 2) / 2;
          const pctHP   = bilan.hPosteEnv > 0 ? Math.min(100, Math.round((bilan.totalHP  / bilan.hPosteEnv)  * 100)) : 0;
          const pctHSA  = bilan.hsaEnv    > 0 ? Math.min(100, Math.round((bilan.totalHSA / bilan.hsaEnv)    * 100)) : 0;
          _set('dash-hp-env',   bilan.hPosteEnv + ' h');
          _set('dash-hp-used',  bilan.totalHP   + ' h');
          _set('dash-hp-free',  hpFree + ' h');
          _set('dash-hsa-env',  bilan.hsaEnv    + ' h');
          _set('dash-hsa-used', bilan.totalHSA  + ' h');
          _set('dash-hsa-free', hsaFree + ' h');
          const barDHP  = document.getElementById('dash-bar-hp');
          const barDHSA = document.getElementById('dash-bar-hsa');
          if (barDHP)  barDHP.style.width  = pctHP  + '%';
          if (barDHSA) barDHSA.style.width = pctHSA + '%';
          // Couleur solde HP/HSA
          const freeHP  = document.getElementById('dash-hp-free');
          const freeHSA = document.getElementById('dash-hsa-free');
          if (freeHP)  freeHP.style.color  = hpFree  < 0 ? 'var(--c-red)' : hpFree  === 0 ? 'var(--c-text-muted)' : 'var(--c-accent)';
          if (freeHSA) freeHSA.style.color = hsaFree < 0 ? 'var(--c-red)' : hsaFree === 0 ? 'var(--c-text-muted)' : 'var(--c-indigo)';
        } else {
          hpHsaGrid.style.display = 'none';
        }
      }

      // Tooltips KPI au survol
      const tooltipDGH = document.getElementById('kpi-tooltip-dghtotal');
      if (tooltipDGH && bilan.enveloppe > 0) {
        tooltipDGH.innerHTML = '<strong>Enveloppe DSDEN</strong><br>HP : ' + bilan.hPosteEnv + ' h<br>HSA : ' + bilan.hsaEnv + ' h<br>Total : ' + bilan.enveloppe + ' h';
      }
      const tooltipHP = document.getElementById('kpi-tooltip-hposte');
      if (tooltipHP && bilan.hPosteEnv > 0) {
        tooltipHP.innerHTML = '<strong>H-Poste</strong><br>Enveloppe : ' + bilan.hPosteEnv + ' h<br>Allouées : ' + bilan.totalHP + ' h<br>Dont Dotation : ' + (bilan.totalHPDisc||0) + ' h<br>Dont HPC : ' + (bilan.totalHPHPC||0) + ' h<br>Disponibles : ' + Math.round((bilan.hPosteEnv - bilan.totalHP)*2)/2 + ' h';
      }
      const tooltipHSA = document.getElementById('kpi-tooltip-hsa');
      if (tooltipHSA && bilan.hsaEnv > 0) {
        tooltipHSA.innerHTML = '<strong>HSA</strong><br>Enveloppe : ' + bilan.hsaEnv + ' h<br>Allouées : ' + bilan.totalHSA + ' h<br>Dont Dotation : ' + (bilan.totalHSADisc||0) + ' h<br>Dont HPC : ' + (bilan.totalHSAHPC||0) + ' h<br>Disponibles : ' + Math.round((bilan.hsaEnv - bilan.totalHSA)*2)/2 + ' h';
      }
      const tooltipSolde = document.getElementById('kpi-tooltip-solde');
      if (tooltipSolde && bilan.enveloppe > 0) {
        tooltipSolde.innerHTML = '<strong>Solde global</strong><br>Enveloppe : ' + bilan.enveloppe + ' h<br>Consommées : ' + bilan.totalAlloue + ' h<br>Solde : ' + bilan.solde + ' h (' + bilan.pctConsomme + '% consommé)';
      }

      // Empty state
      const isEmpty  = DGHData.isEmpty();
      const emptyEl  = document.getElementById('emptyState');
      const resumeEl = document.getElementById('disciplineResume');
      if (emptyEl)  emptyEl.style.display  = isEmpty ? '' : 'none';
      if (resumeEl) resumeEl.style.display = isEmpty ? 'none' : '';

      // Résumé disciplines
      const discListEl = document.getElementById('disciplineList');
      if (discListEl && !isEmpty) {
        const disciplines = DGHData.getDisciplines();
        const repartition = DGHData.getRepartition();
        const structures  = DGHData.getStructures();
        const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, repartition);
        if (disciplines.length === 0) {
          discListEl.innerHTML = '<p style="color:var(--c-text-muted);font-size:.83rem;padding:.5rem 0">Aucune discipline — initialisez les <button class="btn-link" data-navigate="dotation">disciplines MEN dans Dotation</button>.</p>';
        } else {
          let html = '<div class="disc-resume-grid">';
          besoins.forEach(b => {
            const pct = bilan.enveloppe > 0 ? Math.min(100, Math.round((b.total / bilan.enveloppe) * 100)) : 0;
            const ecartCls = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
            html += '<div class="disc-resume-row">'
              + '<span class="disc-color-dot" style="background:' + _esc(b.couleur) + '"></span>'
              + '<span class="disc-resume-nom">' + _esc(b.nom) + '</span>'
              + '<span class="disc-resume-h">' + b.total + ' h</span>'
              + (b.besoinTheorique > 0 ? '<span class="dot-ecart ' + ecartCls + '" style="font-size:.68rem">' + (b.ecart >= 0 ? '+' : '') + b.ecart + '</span>' : '<span></span>')
              + '<div class="dot-bar-track" style="flex:1;min-width:40px"><div class="dot-bar-fill" style="width:' + pct + '%;background:' + _esc(b.couleur) + '"></div></div>'
              + '</div>';
          });
          html += '</div>';
          discListEl.innerHTML = html;
        }
      }
    } catch(e) { console.error('[DGH] renderDashboard:', e); }
    _updateBtnEtab();
  }

  function _updateBtnEtab() {
    const btn = document.getElementById('btnEtab'); if (!btn) return;
    try { const etab = DGHData.getEtab()||{}; btn.textContent = (etab.nom&&etab.nom.trim()) ? etab.nom.trim()+' ⚙' : 'Mon Collège ⚙'; }
    catch(e) { btn.textContent = 'Mon Collège ⚙'; }
  }

  // ── STRUCTURES ───────────────────────────────────────────────────
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
          '<div class="niveau-row"><span class="niveau-badge niveau-' + n.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + n.niveau + '</span>'
          + '<span class="niveau-count">' + n.nbDivisions + ' div.</span>'
          + '<span class="niveau-effectif">' + n.effectif + ' élèves</span></div>'
        ).join('');
      }

      // Tableau récap par niveau
      const niveauCard = document.getElementById('structNiveauCard');
      const niveauBody = document.getElementById('structNiveauBody');
      const niveauFoot = document.getElementById('structNiveauFoot');
      if (niveauCard) niveauCard.style.display = resume.parNiveau.length > 0 ? '' : 'none';
      if (niveauBody) {
        niveauBody.innerHTML = resume.parNiveau.map(n =>
          '<tr>'
          + '<td><span class="niveau-badge niveau-' + n.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + n.niveau + '</span></td>'
          + '<td class="col-num">' + n.nbDivisions + '</td>'
          + '<td class="col-num">' + n.effectif + '</td>'
          + '<td class="col-num" style="font-family:\'JetBrains Mono\',monospace">' + (n.hTheoriqueDiv > 0 ? n.hTheoriqueDiv + ' h' : '—') + '</td>'
          + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + (n.hTheoriqueTotal > 0 ? n.hTheoriqueTotal + ' h' : '—') + '</strong></td>'
          + '</tr>'
        ).join('');
      }
      if (niveauFoot && resume.parNiveau.length > 0) {
        niveauFoot.innerHTML = '<tr class="struct-total-row">'
          + '<td><strong>Total</strong></td>'
          + '<td class="col-num"><strong>' + resume.nbDivisions + '</strong></td>'
          + '<td class="col-num"><strong>' + resume.effectifTotal + '</strong></td>'
          + '<td class="col-num">—</td>'
          + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace;color:var(--c-accent)">' + resume.hTheoriqueTotal + ' h</strong></td>'
          + '</tr>';
      }

      // Liste divisions
      const listEl = document.getElementById('struct-list'); if (!listEl) return;
      if (structures.length === 0) {
        listEl.innerHTML = '<div class="struct-empty"><div class="struct-empty-icon">⊞</div>'
          + '<p>Aucune division saisie.</p>'
          + '<p class="struct-empty-sub">Utilisez «\u00a0Saisie rapide\u00a0» pour créer toutes vos divisions en une fois.</p></div>';
        return;
      }
      // Calculer quelles classes ont des groupes de cours ou HPC
      const annData   = DGHData.getAnnee();
      const repartit  = annData.repartition || [];
      const hpcList   = annData.heuresPedaComp || [];
      const classesAvecStructure = new Set();
      repartit.forEach(r => { (r.groupesCours||[]).forEach(gc => { (gc.classesIds||[]).forEach(id => classesAvecStructure.add(id)); }); });
      hpcList.forEach(h => { (h.classesIds||[]).forEach(id => classesAvecStructure.add(id)); });

      let html = '<table class="struct-table"><thead><tr><th>Division</th><th>Niveau</th><th>Effectif</th><th>Dispositif / Structure</th><th class="col-actions">Actions</th></tr></thead><tbody>';
      structures.forEach(div => {
        const tags = [];
        if (div.dispositif) tags.push('<span class="div-tag div-tag-disp">' + _esc(div.dispositif) + '</span>');
        if (classesAvecStructure.has(div.id)) tags.push('<span class="div-tag div-tag-struct" title="Groupes de cours ou HPC liés à cette classe">Structure</span>');
        const dispTag = tags.length > 0 ? tags.join(' ') : '<span class="no-tag">—</span>';
        html += '<tr>'
          + '<td><strong class="div-nom">' + _esc(div.nom||'—') + '</strong></td>'
          + '<td><span class="niveau-badge niveau-' + div.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + _esc(div.niveau) + '</span></td>'
          + '<td><span class="div-effectif">' + (div.effectif||0) + '</span></td>'
          + '<td>' + dispTag + '</td>'
          + '<td class="col-actions"><button class="btn-icon-sm" data-action="edit-div" data-id="' + div.id + '" title="Modifier">✎</button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-div" data-id="' + div.id + '" title="Supprimer">✕</button></td></tr>';
      });
      listEl.innerHTML = html + '</tbody></table>';
    } catch(e) { console.error('[DGH] renderStructures:', e); }
  }

  // ── MODAL SAISIE MATRICIELLE ──────────────────────────────────────
  function _openModalMatrice() {
    const modal = document.getElementById('modalMatrice'); if (!modal) return;
    const body  = document.getElementById('matriceBody');  if (!body)  return;
    const niveaux    = ['6e', '5e', '4e', '3e'];
    const structures = DGHData.getStructures();
    body.innerHTML = niveaux.map(niv => {
      const ex  = structures.filter(d => d.niveau === niv);
      const eff = ex.length > 0 ? Math.round(ex.reduce((s,d)=>s+(d.effectif||0),0)/ex.length) : '';
      return '<tr>'
        + '<td><span class="niveau-badge niveau-' + niv.toLowerCase() + '">' + niv + '</span></td>'
        + '<td><input type="number" class="matrice-input" data-niveau="' + niv + '" data-field="nb" value="' + ex.length + '" min="0" max="20" step="1" /></td>'
        + '<td><input type="number" class="matrice-input" data-niveau="' + niv + '" data-field="eff" value="' + eff + '" min="0" max="99" step="1" placeholder="28" /></td>'
        + '</tr>';
    }).join('');
    document.getElementById('matriceRemplacer').checked = false;
    modal.classList.add('modal-open');
    modal.querySelector('.matrice-input').focus();
  }
  function _closeModalMatrice() { const m=document.getElementById('modalMatrice'); if(m) m.classList.remove('modal-open'); }
  function _saveModalMatrice() {
    const niveaux = ['6e','5e','4e','3e'];
    const matrice = niveaux.map(niv => ({
      niveau: niv,
      nbDivisions: parseInt(document.querySelector('[data-niveau="'+niv+'"][data-field="nb"]')?.value,10)||0,
      effectifMoyen: parseInt(document.querySelector('[data-niveau="'+niv+'"][data-field="eff"]')?.value,10)||0
    })).filter(l => l.nbDivisions > 0);
    if (matrice.length === 0) { toast('Indiquez au moins un niveau', 'warning'); return; }
    const remplacer = document.getElementById('matriceRemplacer')?.checked || false;
    DGHData.appliquerMatrice(matrice, remplacer);
    _closeModalMatrice(); _renderStructures(); _renderDashboard();
    toast(matrice.reduce((s,l)=>s+l.nbDivisions,0) + ' division(s) générée(s)', 'success');
  }

  // ── MODAL DIVISION ────────────────────────────────────────────────
  function _openModalDiv(id) {
    const modal = document.getElementById('modalDiv'); if (!modal) return;
    const dupGroup = document.getElementById('dupGroup');
    if (id) {
      const div = DGHData.getDivision(id); if (!div) return;
      _set('modalDivTitle','Modifier la division'); _setVal('modalDivId',id);
      _setVal('inputDivNiveau',div.niveau); _setVal('inputDivNom',div.nom);
      _setVal('inputDivEffectif',div.effectif); _setVal('inputDivDispositif',div.dispositif||'');
      if (dupGroup) dupGroup.style.display='none';
    } else {
      _set('modalDivTitle','Ajouter une division'); _setVal('modalDivId','');
      _setVal('inputDivNiveau','6e'); _setVal('inputDivNom','');
      _setVal('inputDivEffectif',''); _setVal('inputDivDispositif',''); _setVal('inputDivDup','0');
      if (dupGroup) dupGroup.style.display='';
    }
    modal.classList.add('modal-open');
    setTimeout(()=>document.getElementById('inputDivNom')?.focus(),60);
  }
  function _closeModalDiv() { const m=document.getElementById('modalDiv'); if(m) m.classList.remove('modal-open'); const p=document.getElementById('dupPreview'); if(p) p.innerHTML=''; }
  function _saveModalDiv() {
    const id  = document.getElementById('modalDivId')?.value||'';
    const nom = (document.getElementById('inputDivNom')?.value||'').trim();
    if (!nom) { toast('Le nom est requis','warning'); return; }
    const fields = { niveau:document.getElementById('inputDivNiveau')?.value||'6e', nom, effectif:parseInt(document.getElementById('inputDivEffectif')?.value,10)||0, options:[], dispositif:document.getElementById('inputDivDispositif')?.value||null };
    const dup = parseInt(document.getElementById('inputDivDup')?.value,10)||0;
    if (id) { DGHData.updateDivision(id,fields); toast('Division mise à jour','success'); }
    else { const created=DGHData.addDivision(fields); if(dup>0){const c=DGHData.duplicateDivisions(created.id,dup);toast(nom+' + '+c.length+' copie(s)','success');}else toast('Division «\u00a0'+nom+'\u00a0» ajoutée','success'); }
    _closeModalDiv(); _renderStructures(); _renderDashboard();
  }
  function _confirmDeleteDiv(id) { const div=DGHData.getDivision(id); if(!div) return; const m=document.getElementById('confirmDiv'); if(!m) return; _set('confirmDivMsg','Supprimer «\u00a0'+div.nom+'\u00a0» (niveau '+div.niveau+') ?'); m.dataset.targetId=id; m.classList.add('modal-open'); }
  function _closeConfirmDiv() { const m=document.getElementById('confirmDiv'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';} }
  function _execDeleteDiv() { const id=document.getElementById('confirmDiv')?.dataset?.targetId; if(!id) return; DGHData.deleteDivision(id); _closeConfirmDiv(); _renderStructures(); _renderDashboard(); toast('Division supprimée','info'); }

  // ── DOTATION ─────────────────────────────────────────────────────
  function _renderDotation() {
    try {
      const anneeData   = DGHData.getAnnee();
      const bilan       = Calculs.bilanDotation(anneeData);
      const disciplines = DGHData.getDisciplines();
      const repartition = DGHData.getRepartition();
      const structures  = DGHData.getStructures();
      const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, repartition);

      // Enveloppe inline
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
      if (soldeEl) { soldeEl.textContent = bilan.enveloppe > 0 ? bilan.solde : '—'; soldeEl.className = bilan.depassement ? 'struct-kpi-val dot-solde-neg' : 'struct-kpi-val dot-solde-pos'; }
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

      // Tableau disciplines avec groupes de cours dépliables
      const listEl = document.getElementById('dot-list'); if (!listEl) return;
      if (disciplines.length === 0) {
        listEl.innerHTML = '<div class="struct-empty"><div class="struct-empty-icon">◎</div>'
          + '<p>Aucune discipline saisie.</p>'
          + '<p class="struct-empty-sub">Cliquez sur «\u00a0★ Disciplines MEN\u00a0» pour initialiser les 17 disciplines standard en un clic.</p></div>';
        return;
      }
      const besoinsMap = {}; besoins.forEach(b => { besoinsMap[b.disciplineId] = b; });
      let html = '<table class="dot-table"><thead><tr>'
        + '<th></th><th>Discipline</th><th class="col-num">Besoin MEN</th>'
        + '<th class="col-num dot-col-hp">H-Poste</th>'
        + '<th class="col-num dot-col-hsa">HSA</th>'
        + '<th class="col-num">Total</th>'
        + '<th class="col-num">Écart</th>'
        + '<th class="col-bar">Part</th>'
        + '<th class="col-actions">Actions</th>'
        + '</tr></thead><tbody>';

      disciplines.forEach(disc => {
        const b       = besoinsMap[disc.id] || { besoinTheorique:0, hPoste:0, hsa:0, total:0, ecart:0, groupesCours:[], heuresGroupes:0 };
        const pctBar  = bilan.enveloppe > 0 ? Math.min(100, Math.round((b.total / bilan.enveloppe)*100)) : 0;
        const ecartCls = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
        const nbGC    = (b.groupesCours||[]).length;

        html += '<tr class="dot-disc-row">'
          + '<td class="col-toggle">'
          + (nbGC > 0 || true ? '<button class="btn-toggle-gc" data-disc-id="' + disc.id + '" title="Groupes de cours">▶</button>' : '')
          + '</td>'
          + '<td><span class="disc-color-dot" style="background:' + _esc(disc.couleur) + '"></span><strong class="div-nom">' + _esc(disc.nom) + '</strong>'
          + (nbGC > 0 ? '<span class="gc-count-badge">' + nbGC + ' groupe' + (nbGC>1?'s':'') + '</span>' : '') + '</td>'
          + '<td class="col-num dot-theorique">' + (b.besoinTheorique > 0 ? b.besoinTheorique + ' h' : '<span class="no-tag">—</span>') + '</td>'
          + '<td class="col-num"><input type="number" class="dot-input-h dot-input-hp" data-disc-id="' + disc.id + '" data-field="hPoste" value="' + b.hPoste + '" min="0" step="0.5" /></td>'
          + '<td class="col-num"><input type="number" class="dot-input-h dot-input-hsa" data-disc-id="' + disc.id + '" data-field="hsa" value="' + b.hsa + '" min="0" step="0.5" /></td>'
          + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + b.total + ' h</strong></td>'
          + '<td class="col-num"><span class="dot-ecart ' + ecartCls + '">' + (b.besoinTheorique > 0 ? (b.ecart >= 0 ? '+' : '') + b.ecart + ' h' : '—') + '</span></td>'
          + '<td class="col-bar"><div class="dot-bar-track"><div class="dot-bar-fill" style="width:' + pctBar + '%;background:' + _esc(disc.couleur) + '"></div></div><span class="dot-bar-pct">' + pctBar + '%</span></td>'
          + '<td class="col-actions">'
          + '<button class="btn-icon-sm btn-add-gc" data-action="add-gc" data-disc-id="' + disc.id + '" title="Ajouter un groupe de cours">+</button>'
          + '<button class="btn-icon-sm" data-action="edit-disc" data-id="' + disc.id + '" title="Modifier">✎</button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-disc" data-id="' + disc.id + '" title="Supprimer">✕</button>'
          + '</td></tr>';

        // Sous-lignes groupes de cours (masquées par défaut)
        html += '<tr class="gc-subrows-row" id="gc-sub-' + disc.id + '" style="display:none"><td colspan="9"><div class="gc-subrows">';
        if (b.groupesCours.length === 0) {
          html += '<div class="gc-empty">Aucun groupe de cours — cliquez sur + pour en ajouter (ex. LV2 Espagnol, LV2 Allemand…)</div>';
        } else {
          b.groupesCours.forEach(gc => {
            const classesLabel = gc.classesNoms && gc.classesNoms.length > 0 ? gc.classesNoms.join(', ') : '—';
            html += '<div class="gc-subrow">'
              + '<span class="gc-arrow">└</span>'
              + '<span class="gc-nom"><strong>' + _esc(gc.nom||'—') + '</strong></span>'
              + '<span class="gc-classes">' + _esc(classesLabel) + '</span>'
              + '<span class="gc-effectif">' + (gc.effectif||0) + ' élèves</span>'
              + '<span class="gc-heures" style="font-family:\'JetBrains Mono\',monospace;font-weight:700">' + (gc.heures||0) + ' h/sem</span>'
              + '<span class="gc-actions">'
              + '<button class="btn-icon-sm" data-action="edit-gc" data-disc-id="' + disc.id + '" data-gc-id="' + gc.id + '" title="Modifier">✎</button>'
              + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-gc" data-disc-id="' + disc.id + '" data-gc-id="' + gc.id + '" title="Supprimer">✕</button>'
              + '</span></div>';
          });
          if (b.heuresGroupes > 0) {
            html += '<div class="gc-total-row"><span>Total groupes de cours :</span><strong style="font-family:\'JetBrains Mono\',monospace">' + b.heuresGroupes + ' h/sem</strong></div>';
          }
        }
        html += '</div></td></tr>';
      });

      listEl.innerHTML = html + '</tbody></table>';

      // Total général en bas du tableau
      const totalBar = document.getElementById('dotTotalBar');
      if (totalBar && disciplines.length > 0) {
        totalBar.style.display = '';
        const totHP  = besoins.reduce((s,b) => s + (b.hPoste||0), 0);
        const totHSA = besoins.reduce((s,b) => s + (b.hsa||0), 0);
        _set('dot-total-hp-val',  Math.round(totHP*2)/2  + ' h');
        _set('dot-total-hsa-val', Math.round(totHSA*2)/2 + ' h');
        _set('dot-total-sum-val', Math.round((totHP+totHSA)*2)/2 + ' h');
      } else if (totalBar) { totalBar.style.display = 'none'; }

      // Tableau Besoins MEN par niveau
      const resume = Calculs.resumeStructures(structures);
      const niveauRecap = document.getElementById('dotNiveauRecap');
      const niveauBody  = document.getElementById('dotNiveauBody');
      const niveauFoot  = document.getElementById('dotNiveauFoot');
      if (niveauRecap) niveauRecap.style.display = resume.parNiveau.length > 0 ? '' : 'none';
      if (niveauBody && resume.parNiveau.length > 0) {
        // Pour chaque niveau, sommer HP et HSA des disciplines présentes dans la grille MEN
        const GRILLES = Calculs.GRILLES_MEN;
        niveauBody.innerHTML = resume.parNiveau.map(n => {
          const discsDuNiveau = Object.keys(GRILLES[n.niveau] || {});
          const hpNiv  = besoins.filter(b => discsDuNiveau.includes(b.nom)).reduce((s,b) => s + (b.hPoste||0), 0);
          const hsaNiv = besoins.filter(b => discsDuNiveau.includes(b.nom)).reduce((s,b) => s + (b.hsa||0), 0);
          const totalNiv = Math.round((hpNiv + hsaNiv)*2)/2;
          const ecartNiv = Math.round((totalNiv - n.hTheoriqueTotal)*2)/2;
          const ecCls   = ecartNiv > 0 ? 'dot-ecart-over' : ecartNiv < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
          return '<tr>'
            + '<td><span class="niveau-badge niveau-' + n.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + n.niveau + '</span></td>'
            + '<td class="col-num">' + n.nbDivisions + '</td>'
            + '<td class="col-num">' + (n.hTheoriqueDiv > 0 ? n.hTheoriqueDiv + ' h' : '—') + '</td>'
            + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + (n.hTheoriqueTotal > 0 ? n.hTheoriqueTotal + ' h' : '—') + '</strong></td>'
            + '<td class="col-num dot-col-hp">' + Math.round(hpNiv*2)/2  + ' h</td>'
            + '<td class="col-num dot-col-hsa">' + Math.round(hsaNiv*2)/2 + ' h</td>'
            + '<td class="col-num"><span class="dot-ecart ' + ecCls + '">' + (n.hTheoriqueTotal > 0 ? (ecartNiv >= 0 ? '+' : '') + ecartNiv + ' h' : '—') + '</span></td>'
            + '</tr>';
        }).join('');
        if (niveauFoot) {
          const totalMEN = resume.hTheoriqueTotal;
          const totHP2   = besoins.reduce((s,b) => s + (b.hPoste||0), 0);
          const totHSA2  = besoins.reduce((s,b) => s + (b.hsa||0), 0);
          const totAll2  = Math.round((totHP2+totHSA2)*2)/2;
          const ecTot    = Math.round((totAll2 - totalMEN)*2)/2;
          const ecCls2   = ecTot > 0 ? 'dot-ecart-over' : ecTot < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
          niveauFoot.innerHTML = '<tr class="struct-total-row">'
            + '<td><strong>Total</strong></td>'
            + '<td class="col-num"><strong>' + resume.nbDivisions + '</strong></td>'
            + '<td class="col-num">—</td>'
            + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace;color:var(--c-accent)">' + totalMEN + ' h</strong></td>'
            + '<td class="col-num dot-col-hp"><strong>' + Math.round(totHP2*2)/2  + ' h</strong></td>'
            + '<td class="col-num dot-col-hsa"><strong>' + Math.round(totHSA2*2)/2 + ' h</strong></td>'
            + '<td class="col-num"><span class="dot-ecart ' + ecCls2 + '"><strong>' + (ecTot >= 0 ? '+' : '') + ecTot + ' h</strong></span></td>'
            + '</tr>';
        }
      }

      // Inputs HP+HSA inline
      listEl.querySelectorAll('.dot-input-h').forEach(inp => {
        inp.addEventListener('change', e => {
          const id    = e.target.dataset.discId;
          const field = e.target.dataset.field;
          const val   = parseFloat(e.target.value) || 0;
          if (id && field) { DGHData.setRepartition(id, { [field]: val }); _renderDotation(); _renderDashboard(); }
        });
      });

      // Toggle groupes de cours
      listEl.querySelectorAll('.btn-toggle-gc').forEach(btn => {
        btn.addEventListener('click', e => {
          const discId = e.currentTarget.dataset.discId;
          const subRow = document.getElementById('gc-sub-' + discId);
          if (!subRow) return;
          const open = subRow.style.display !== 'none';
          subRow.style.display = open ? 'none' : '';
          e.currentTarget.textContent = open ? '▶' : '▼';
        });
      });

      // Enveloppe inline — save on blur/change
      [document.getElementById('inputEnvHP'), document.getElementById('inputEnvHSA')].forEach(inp => {
        if (inp && !inp._bound) {
          inp._bound = true;
          inp.addEventListener('change', _saveEnveloppe);
          inp.addEventListener('blur',   _saveEnveloppe);
        }
      });

    } catch(err) { console.error('[DGH] renderDotation:', err); }
  }

  // ── DÉPLIER TOUS LES GROUPES ──────────────────────────────────────
  function _toggleAllGC() {
    const btn = document.getElementById('btnToggleAllGC'); if (!btn) return;
    const allSubRows = document.querySelectorAll('[id^="gc-sub-"]');
    const anyHidden  = Array.from(allSubRows).some(r => r.style.display === 'none' || r.style.display === '');
    // Si au moins un est fermé → tout ouvrir ; sinon → tout fermer
    const open = anyHidden;
    allSubRows.forEach(r => { r.style.display = open ? '' : 'none'; });
    document.querySelectorAll('.btn-toggle-gc').forEach(b => { b.textContent = open ? '▼' : '▶'; });
    btn.textContent = open ? '⊟ Tout replier' : '⊞ Tout déplier';
  }

  function _saveEnveloppe() {
    const hp  = parseFloat(document.getElementById('inputEnvHP')?.value)  || 0;
    const hsa = parseFloat(document.getElementById('inputEnvHSA')?.value) || 0;
    DGHData.setDotation(hp, hsa);
    _set('dot-env-total', (hp+hsa) > 0 ? (hp+hsa)+' h' : '— h');
    _renderDotation(); _renderDashboard();
  }

  // ── MODAL DISCIPLINE ──────────────────────────────────────────────
  function _openModalDisc(id) {
    const modal = document.getElementById('modalDisc'); if (!modal) return;
    if (id) {
      const disc = DGHData.getDiscipline(id); if (!disc) return;
      _set('modalDiscTitle','Modifier la discipline'); _setVal('modalDiscId',id);
      _setVal('inputDiscNom',disc.nom); _setVal('inputDiscCouleur',disc.couleur||'#2d6a4f'); _updateColorHint(disc.couleur||'#2d6a4f');
    } else {
      _set('modalDiscTitle','Ajouter une discipline'); _setVal('modalDiscId','');
      _setVal('inputDiscNom',''); _setVal('inputDiscCouleur','#2d6a4f'); _updateColorHint('#2d6a4f');
    }
    modal.classList.add('modal-open');
    setTimeout(()=>document.getElementById('inputDiscNom')?.focus(),60);
  }
  function _updateColorHint(v) { const h=document.getElementById('colorHint'); if(h) h.textContent=v; }
  function _closeModalDisc() { const m=document.getElementById('modalDisc'); if(m) m.classList.remove('modal-open'); }
  function _saveModalDisc() {
    const id  = document.getElementById('modalDiscId')?.value||'';
    const nom = (document.getElementById('inputDiscNom')?.value||'').trim();
    if (!nom) { toast('Le nom est requis','warning'); return; }
    const couleur = document.getElementById('inputDiscCouleur')?.value||'#2d6a4f';
    if (id) { DGHData.updateDiscipline(id,{nom,couleur}); toast('Discipline mise à jour','success'); }
    else    { DGHData.addDiscipline({nom,couleur}); toast('Discipline «\u00a0'+nom+'\u00a0» ajoutée','success'); }
    _closeModalDisc(); _renderDotation(); _renderDashboard();
  }
  function _confirmDeleteDisc(id) { const disc=DGHData.getDiscipline(id); if(!disc) return; const m=document.getElementById('confirmDisc'); if(!m) return; _set('confirmDiscMsg','Supprimer «\u00a0'+disc.nom+'\u00a0» ?'); m.dataset.targetId=id; m.classList.add('modal-open'); }
  function _closeConfirmDisc() { const m=document.getElementById('confirmDisc'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';} }
  function _execDeleteDisc() { const id=document.getElementById('confirmDisc')?.dataset?.targetId; if(!id) return; DGHData.deleteDiscipline(id); _closeConfirmDisc(); _renderDotation(); _renderDashboard(); toast('Discipline supprimée','info'); }

  // ── SUGGESTION HP ─────────────────────────────────────────────────
  function _suggererHP() {
    const ann = DGHData.getAnnee();
    if ((ann.dotation.hPosteEnveloppe||0) === 0) { toast('Saisissez d\'abord l\'enveloppe H-Poste','warning'); return; }
    if ((ann.structures||[]).length === 0) { toast('Saisissez d\'abord les structures de classes','warning'); return; }
    const suggestions = Calculs.suggererRepartition(ann);
    if (suggestions.length === 0) { toast('Impossible de calculer des suggestions','warning'); return; }
    suggestions.forEach(s => { DGHData.setRepartition(s.disciplineId, { hPoste: s.suggested }); });
    _renderDotation(); _renderDashboard();
    toast('Suggestion appliquée sur '+suggestions.length+' discipline(s) — ajustez selon votre TRM','success', 5000);
  }

  // ── MODAL GROUPE DE COURS ─────────────────────────────────────────
  function _openModalGC(discId, gcId) {
    const modal = document.getElementById('modalGC'); if (!modal) return;
    _setVal('modalGCDiscId', discId);
    _setVal('modalGCId', gcId||'');

    // Remplir checkboxes classes
    const classesDiv = document.getElementById('gcClassesCheck');
    const structures = DGHData.getStructures();
    if (classesDiv) {
      if (structures.length === 0) {
        classesDiv.innerHTML = '<p class="form-hint">Aucune division saisie — <button class="btn-link" data-navigate="structures">ajoutez d\'abord vos classes</button></p>';
      } else {
        classesDiv.innerHTML = structures.map(div =>
          '<label class="niv-check-label">'
          + '<input type="checkbox" class="classe-check" value="' + div.id + '" />'
          + '<span>' + _esc(div.nom) + ' <small style="color:var(--c-text-dim)">(' + (div.effectif||0) + ')</small></span>'
          + '</label>'
        ).join('');
      }
    }

    // Hint heures depuis grille si discipline connue
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

    _updateGCEffectif();
    classesDiv?.querySelectorAll('.classe-check').forEach(cb => cb.addEventListener('change', _updateGCEffectif));
    modal.classList.add('modal-open');
    setTimeout(()=>document.getElementById('inputGCNom')?.focus(),60);
  }

  function _updateGCEffectif() {
    const checked  = Array.from(document.querySelectorAll('#gcClassesCheck .classe-check:checked'));
    const total    = checked.reduce((s,cb) => { const div=DGHData.getDivision(cb.value); return s+(div?div.effectif||0:0); }, 0);
    const efDiv    = document.getElementById('gcEffectifAuto');
    if (efDiv) efDiv.textContent = checked.length > 0 ? 'Effectif calculé : ' + total + ' élèves (' + checked.length + ' classe(s))' : '';
  }

  function _closeModalGC() { const m=document.getElementById('modalGC'); if(m) m.classList.remove('modal-open'); }
  function _saveModalGC() {
    const discId = document.getElementById('modalGCDiscId')?.value||''; if (!discId) return;
    const gcId   = document.getElementById('modalGCId')?.value||'';
    const nom    = (document.getElementById('inputGCNom')?.value||'').trim();
    if (!nom) { toast('Le nom du groupe est requis','warning'); return; }
    const classesIds = Array.from(document.querySelectorAll('#gcClassesCheck .classe-check:checked')).map(cb=>cb.value);
    const fields = { nom, classesIds, heures: parseFloat(document.getElementById('inputGCHeures')?.value)||0, commentaire: document.getElementById('inputGCComment')?.value||'' };
    if (gcId) { DGHData.updateGroupeCours(discId, gcId, fields); toast('Groupe mis à jour','success'); }
    else      { DGHData.addGroupeCours(discId, fields); toast('Groupe «\u00a0'+nom+'\u00a0» ajouté','success'); }
    _closeModalGC(); _renderDotation();
    // Rouvrir le panneau de la discipline
    const subRow = document.getElementById('gc-sub-'+discId);
    if (subRow) { subRow.style.display=''; const btn=document.querySelector('[data-disc-id="'+discId+'"].btn-toggle-gc'); if(btn) btn.textContent='▼'; }
  }

  function _confirmDeleteGC(discId, gcId) {
    const gc = DGHData.getGroupeCours(discId, gcId); if (!gc) return;
    const m  = document.getElementById('confirmGC'); if (!m) return;
    _set('confirmGCMsg','Supprimer le groupe «\u00a0'+gc.nom+'\u00a0» ?');
    m.dataset.discId = discId; m.dataset.gcId = gcId; m.classList.add('modal-open');
  }
  function _closeConfirmGC() { const m=document.getElementById('confirmGC'); if(m){m.classList.remove('modal-open');delete m.dataset.discId;delete m.dataset.gcId;} }
  function _execDeleteGC() {
    const m=document.getElementById('confirmGC'); if(!m) return;
    DGHData.deleteGroupeCours(m.dataset.discId, m.dataset.gcId);
    _closeConfirmGC(); _renderDotation(); toast('Groupe supprimé','info');
  }

  // ── HPC ───────────────────────────────────────────────────────────
  function _renderHPC() {
    try {
      const hpcs        = DGHData.getHeuresPedaComp();
      const disciplines = DGHData.getDisciplines();
      const structures  = DGHData.getStructures();
      const bilan       = Calculs.bilanHPC(hpcs, disciplines);
      const LABELS      = {}; DGHData.getCategoriesHPC().forEach(c => { LABELS[c.value]=c.label; });

      _set('hpc-kpi-nb',     bilan.nbHeures);
      _set('hpc-kpi-heures', bilan.totalHeures);

      const listEl = document.getElementById('hpc-list'); if (!listEl) return;
      if (hpcs.length === 0) {
        listEl.innerHTML = '<div class="struct-empty"><div class="struct-empty-icon">◈</div>'
          + '<p>Aucune heure complémentaire saisie.</p>'
          + '<p class="struct-empty-sub">Ajoutez ici vos options (Latin, Grec), heures de labo, chorale, orchestre, dispositifs…</p></div>';
        return;
      }
      const discMap = {}; disciplines.forEach(d => { discMap[d.id]=d; });
      const structMap = {}; structures.forEach(d => { structMap[d.id]=d; });

      let totalHPCHp = 0, totalHPCHsa = 0;
      let html = '<table class="dot-table"><thead><tr><th>Intitulé</th><th>Catégorie</th><th>Discipline</th><th>Classes</th><th class="col-num">H/sem</th><th class="col-num dot-col-hp">Type</th><th class="col-num">Effectif</th><th class="col-actions">Actions</th></tr></thead><tbody>';
      hpcs.forEach(h => {
        const catLabel  = (LABELS[h.categorie]||h.categorie).split('(')[0].trim();
        const discNom   = h.disciplineId && discMap[h.disciplineId] ? discMap[h.disciplineId].nom : '—';
        const classesIds = h.classesIds||[];
        const classesNoms = classesIds.map(id => structMap[id] ? structMap[id].nom : '?').join(', ') || '—';
        const effectifCalc = classesIds.reduce((s,id) => s+(structMap[id]?structMap[id].effectif||0:0), 0);
        const effectif = effectifCalc > 0 ? effectifCalc : (h.effectif||0);
        const isHSA = (h.typeHeure||'hp') === 'hsa';
        if (isHSA) totalHPCHsa += h.heures||0; else totalHPCHp += h.heures||0;
        const typeBadge = isHSA
          ? '<span class="dot-col-badge dot-col-hsa">HSA</span>'
          : '<span class="dot-col-badge dot-col-hp">HP</span>';
        html += '<tr>'
          + '<td><strong class="div-nom">' + _esc(h.nom||'—') + '</strong>' + (h.commentaire?'<br><span class="grp-comment">'+_esc(h.commentaire)+'</span>':'') + '</td>'
          + '<td><span class="grp-type-badge">' + _esc(catLabel) + '</span></td>'
          + '<td>' + _esc(discNom) + '</td>'
          + '<td><span class="grp-niveaux">' + _esc(classesNoms) + '</span></td>'
          + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + (h.heures||0) + ' h</strong></td>'
          + '<td class="col-num">' + typeBadge + '</td>'
          + '<td class="col-num">' + effectif + '</td>'
          + '<td class="col-actions"><button class="btn-icon-sm" data-action="edit-hpc" data-id="' + h.id + '" title="Modifier">✎</button><button class="btn-icon-sm btn-icon-danger" data-action="delete-hpc" data-id="' + h.id + '" title="Supprimer">✕</button></td>'
          + '</tr>';
      });
      // Ligne de total HPC
      if (hpcs.length > 0) {
        html += '<tr class="struct-total-row"><td colspan="4"><strong>Total H. péda. complémentaires</strong></td>'
          + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + Math.round((totalHPCHp+totalHPCHsa)*2)/2 + ' h</strong></td>'
          + '<td class="col-num"><span class="dot-col-badge dot-col-hp" title="HP">' + totalHPCHp + '</span> <span class="dot-col-badge dot-col-hsa" title="HSA">' + totalHPCHsa + '</span></td>'
          + '<td colspan="2"></td></tr>';
      }
      listEl.innerHTML = html + '</tbody></table>';
    } catch(e) { console.error('[DGH] renderHPC:', e); }
  }

  function _openModalHPC(id) {
    const modal = document.getElementById('modalHPC'); if (!modal) return;
    const selCat  = document.getElementById('inputHPCCategorie');
    const selDisc = document.getElementById('inputHPCDisc');
    const structures = DGHData.getStructures();

    if (selCat)  selCat.innerHTML  = DGHData.getCategoriesHPC().map(c => '<option value="'+c.value+'">'+c.label+'</option>').join('');
    if (selDisc) selDisc.innerHTML = '<option value="">— Aucune —</option>' + DGHData.getDisciplines().map(d => '<option value="'+d.id+'">'+_esc(d.nom)+'</option>').join('');

    const classesDiv = document.getElementById('hpcClassesCheck');
    if (classesDiv) {
      classesDiv.innerHTML = structures.length === 0
        ? '<p class="form-hint">Aucune division — ajoutez d\'abord vos classes dans Structures.</p>'
        : structures.map(div =>
            '<label class="niv-check-label"><input type="checkbox" class="hpc-classe-check" value="' + div.id + '" />'
            + '<span>' + _esc(div.nom) + ' <small style="color:var(--c-text-dim)">(' + (div.effectif||0) + ')</small></span></label>'
          ).join('');
      classesDiv.querySelectorAll('.hpc-classe-check').forEach(cb => cb.addEventListener('change', _updateHPCEffectif));
    }

    if (id) {
      const h = DGHData.getHPC(id); if (!h) return;
      _set('modalHPCTitle','Modifier');
      _setVal('modalHPCId',id); _setVal('inputHPCNom',h.nom);
      if (selCat)  selCat.value  = h.categorie;
      if (selDisc) selDisc.value = h.disciplineId||'';
      (h.classesIds||[]).forEach(cid => { const cb=classesDiv?.querySelector('[value="'+cid+'"]'); if(cb) cb.checked=true; });
      _setVal('inputHPCHeures',h.heures); _setVal('inputHPCEffectif',h.effectif); _setVal('inputHPCComment',h.commentaire||''); _setVal('inputHPCTypeHeure',h.typeHeure||'hp');
    } else {
      _set('modalHPCTitle','Ajouter des heures complémentaires');
      _setVal('modalHPCId',''); _setVal('inputHPCNom',''); _setVal('inputHPCHeures',''); _setVal('inputHPCEffectif',''); _setVal('inputHPCComment','');
    }

    _updateHPCEffectif();
    const btnAll = document.getElementById('btnHPCSelectAll');
    if (btnAll) btnAll.textContent = 'Tout sélectionner';
    modal.classList.add('modal-open');
    setTimeout(()=>document.getElementById('inputHPCNom')?.focus(),60);
  }

  function _updateHPCEffectif() {
    const checked = Array.from(document.querySelectorAll('#hpcClassesCheck .hpc-classe-check:checked'));
    const total   = checked.reduce((s,cb) => { const div=DGHData.getDivision(cb.value); return s+(div?div.effectif||0:0); }, 0);
    const efDiv   = document.getElementById('hpcEffectifAuto');
    if (efDiv) efDiv.textContent = checked.length > 0 ? 'Effectif calculé : '+total+' élèves ('+checked.length+' classe(s))' : '';
    if (checked.length > 0) _setVal('inputHPCEffectif', total);
  }

  function _hpcSelectAllClasses() {
    const allChecked = Array.from(document.querySelectorAll('#hpcClassesCheck .hpc-classe-check'));
    const anyUnchecked = allChecked.some(cb => !cb.checked);
    allChecked.forEach(cb => { cb.checked = anyUnchecked; });
    _updateHPCEffectif();
    const btn = document.getElementById('btnHPCSelectAll');
    if (btn) btn.textContent = anyUnchecked ? 'Tout désélectionner' : 'Tout sélectionner';
  }

  function _closeModalHPC() { const m=document.getElementById('modalHPC'); if(m) m.classList.remove('modal-open'); }
  function _saveModalHPC() {
    const id  = document.getElementById('modalHPCId')?.value||'';
    const nom = (document.getElementById('inputHPCNom')?.value||'').trim();
    if (!nom) { toast('L\'intitulé est requis','warning'); return; }
    const classesIds = Array.from(document.querySelectorAll('#hpcClassesCheck .hpc-classe-check:checked')).map(cb=>cb.value);
    const effectifCalc = classesIds.reduce((s,cid)=>{ const d=DGHData.getDivision(cid); return s+(d?d.effectif||0:0); }, 0);
    const fields = {
      nom, categorie: document.getElementById('inputHPCCategorie')?.value||'autre',
      disciplineId: document.getElementById('inputHPCDisc')?.value||null,
      classesIds,
      heures:   parseFloat(document.getElementById('inputHPCHeures')?.value)||0,
      effectif: effectifCalc > 0 ? effectifCalc : parseInt(document.getElementById('inputHPCEffectif')?.value,10)||0,
      typeHeure: document.getElementById('inputHPCTypeHeure')?.value||'hp',
      commentaire: document.getElementById('inputHPCComment')?.value||''
    };
    if (id) { DGHData.updateHPC(id,fields); toast('Entrée mise à jour','success'); }
    else    { DGHData.addHPC(fields); toast('«\u00a0'+nom+'\u00a0» ajouté','success'); }
    _closeModalHPC(); _renderHPC(); _renderDashboard();
  }

  function _confirmDeleteHPC(id) { const h=DGHData.getHPC(id); if(!h) return; const m=document.getElementById('confirmHPC'); if(!m) return; _set('confirmHPCMsg','Supprimer «\u00a0'+h.nom+'\u00a0» ?'); m.dataset.targetId=id; m.classList.add('modal-open'); }
  function _closeConfirmHPC() { const m=document.getElementById('confirmHPC'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';} }
  function _execDeleteHPC() { const id=document.getElementById('confirmHPC')?.dataset?.targetId; if(!id) return; DGHData.deleteHPC(id); _closeConfirmHPC(); _renderHPC(); _renderDashboard(); toast('Entrée supprimée','info'); }

  // ── ONGLETS MODAL ÉTABLISSEMENT ──────────────────────────────────
  function _switchModalTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.modal-tab-panel').forEach(p => p.style.display = p.id === 'tab-' + tab ? '' : 'none');
  }

  // ── MODAL ÉTABLISSEMENT ───────────────────────────────────────────
  function _openModal() {
    try {
      const etab = DGHData.getEtab()||{};
      const ann  = DGHData.getAnnee()||{};
      const dot  = ann.dotation||{};
      const m    = document.getElementById('modalEtab'); if (!m) return;
      _setVal('inputNomEtab',etab.nom||''); _setVal('inputUAI',etab.uai||''); _setVal('inputAcademie',etab.academie||'');
      _setVal('inputDGH_HP',  dot.hPosteEnveloppe != null ? dot.hPosteEnveloppe : '');
      _setVal('inputDGH_HSA', dot.hsaEnveloppe    != null ? dot.hsaEnveloppe    : '');
      _updateModalDotTotal();
      _renderModalYearSelect(); _renderYearListAdmin();
      _switchModalTab('etab');
      m.classList.add('modal-open');
      setTimeout(()=>document.getElementById('inputNomEtab')?.focus(),60);
    } catch(e) { console.error('[DGH] modal etab:', e); toast('Impossible d\'ouvrir les paramètres','error'); }
  }

  function _updateModalDotTotal() {
    const hp  = parseFloat(document.getElementById('inputDGH_HP')?.value)||0;
    const hsa = parseFloat(document.getElementById('inputDGH_HSA')?.value)||0;
    const el  = document.getElementById('modalDotTotal');
    if (el) el.textContent = (hp+hsa) > 0 ? 'Total : ' + (hp+hsa) + ' h (HP + HSA)' : '';
  }

  function _renderModalYearSelect() {
    const sel    = document.getElementById('modalYearSelect'); if (!sel) return;
    const active = DGHData.getAnneeActive();
    sel.innerHTML = '';
    DGHData.getAnnees().forEach(a => { const opt=document.createElement('option'); opt.value=a; opt.textContent=a.replace('-',' – '); if(a===active) opt.selected=true; sel.appendChild(opt); });
  }

  function _renderYearListAdmin() {
    const zone   = document.getElementById('yearListAdmin'); if (!zone) return;
    const active = DGHData.getAnneeActive();
    const annees = DGHData.getAnnees();
    if (annees.length <= 1) { zone.innerHTML=''; return; }
    zone.innerHTML = '<div class="year-list-admin-title">Supprimer une année</div>'
      + annees.map(a => '<div class="year-admin-row"><span class="year-admin-label'+(a===active?' year-admin-active':'')+'">'+a.replace('-',' – ')+(a===active?' ★ active':'')+'</span>'+(a===active?'':'<button class="btn-danger btn-sm btn-delete-annee" data-annee="'+a+'">Supprimer</button>')+'</div>').join('');
  }

  function _closeModal() { const m=document.getElementById('modalEtab'); if(m) m.classList.remove('modal-open'); }

  function _saveModal() {
    try {
      const ms = document.getElementById('modalYearSelect');
      if (ms && ms.value && ms.value !== DGHData.getAnneeActive()) DGHData.setAnneeActive(ms.value);
      DGHData.setEtab({ nom:document.getElementById('inputNomEtab')?.value?.trim()||'', uai:document.getElementById('inputUAI')?.value?.trim()||'', academie:document.getElementById('inputAcademie')?.value?.trim()||'' });
      DGHData.setDotation(parseFloat(document.getElementById('inputDGH_HP')?.value)||0, parseFloat(document.getElementById('inputDGH_HSA')?.value)||0);
      _closeModal(); _renderAll(); _renderDashboard();
      toast('Paramètres enregistrés','success');
    } catch(e) { console.error('[DGH] save modal:', e); toast('Erreur lors de la sauvegarde','error'); }
  }

  function _addModalYear() {
    const input = document.getElementById('inputNewYear'); if (!input) return;
    const val   = input.value.trim();
    if (!/^\d{4}-\d{4}$/.test(val)) { toast('Format requis : 2026-2027','warning'); input.focus(); return; }
    const [debut,fin] = val.split('-').map(Number);
    if (fin !== debut+1) { toast('Les deux années doivent se suivre','warning'); input.focus(); return; }
    if (DGHData.getAnnees().includes(val)) { toast('Cette année existe déjà','info'); const s=document.getElementById('modalYearSelect'); if(s)s.value=val; input.value=''; return; }
    DGHData.setAnneeActive(val); input.value=''; _renderModalYearSelect(); _renderYearSelect(); _renderYearListAdmin();
    toast('Année '+val.replace('-','–')+' créée','success');
  }

  function _openConfirmReset() { const m=document.getElementById('confirmReset'); if(!m) return; _set('confirmResetMsg','Réinitialiser toutes les données de l\'année '+DGHData.getAnneeActive().replace('-','–')+' ?'); m.classList.add('modal-open'); }
  function _closeConfirmReset() { const m=document.getElementById('confirmReset'); if(m) m.classList.remove('modal-open'); }
  function _execResetAnnee() { const a=DGHData.getAnneeActive(); DGHData.resetAnnee(); _closeConfirmReset(); _closeModal(); _renderAll(); _renderDashboard(); toast('Année '+a.replace('-','–')+' réinitialisée','info'); }

  function _openConfirmDeleteAnnee(annee) { const m=document.getElementById('confirmDeleteAnnee'); if(!m) return; _set('confirmDeleteAnneeMsg','Supprimer définitivement l\'année '+annee.replace('-','–')+' ?'); m.dataset.targetAnnee=annee; m.classList.add('modal-open'); }
  function _closeConfirmDeleteAnnee() { const m=document.getElementById('confirmDeleteAnnee'); if(m){m.classList.remove('modal-open');m.dataset.targetAnnee='';} }
  function _execDeleteAnnee() { const annee=document.getElementById('confirmDeleteAnnee')?.dataset?.targetAnnee; if(!annee) return; const res=DGHData.deleteAnnee(annee); if(!res.ok){toast(res.message,'warning');_closeConfirmDeleteAnnee();return;} _closeConfirmDeleteAnnee();_closeModal();_renderAll();_renderDashboard();toast('Année '+annee.replace('-','–')+' supprimée','info'); }

  // ── ALERTES ──────────────────────────────────────────────────────
  function _renderAlertes() {
    try {
      const alertes = Calculs.genererAlertes(DGHData.getAnnee());
      const zone    = document.getElementById('alertes-zone'); if (!zone) return;
      zone.className='section-card';
      zone.innerHTML='<div class="alertes-list">'
        +(alertes.length
          ? alertes.map(a=>'<div class="alerte-item sev-'+a.severite+'"><span class="alerte-dot">'+({error:'✕',warning:'⚠',info:'ℹ'}[a.severite]||'·')+'</span><span class="alerte-msg">'+a.message+'</span></div>').join('')
          : '<div class="alertes-empty">✓ Aucune alerte — tout est en ordre.</div>')
        +'</div>';
    } catch(e) { console.error('[DGH] renderAlertes:', e); }
  }

  // ── DISCIPLINES MEN ───────────────────────────────────────────────
  function _initDisciplinesMEN() {
    const nb = DGHData.initDisciplinesMEN();
    _renderDotation(); _renderDashboard();
    toast(nb > 0 ? nb+' disciplines MEN ajoutées' : 'Toutes les disciplines MEN sont déjà présentes', nb > 0 ? 'success' : 'info');
  }

  // ── RENDU GLOBAL ─────────────────────────────────────────────────
  function _renderAll() { _updateBtnEtab(); _renderYearSelect(); }

  function _renderYearSelect() {
    const sel    = document.getElementById('yearSelect'); if (!sel) return;
    const active = DGHData.getAnneeActive();
    sel.innerHTML='';
    DGHData.getAnnees().forEach(a => { const opt=document.createElement('option'); opt.value=a; opt.textContent=a.replace('-',' – '); if(a===active) opt.selected=true; sel.appendChild(opt); });
  }

  // ── DÉLÉGATION GLOBALE ────────────────────────────────────────────
  function _onGlobalClick(e) {
    const navItem = e.target.closest('.nav-item[data-view]');
    if (navItem) { navigate(navItem.dataset.view); return; }
    const navBtn = e.target.closest('[data-navigate]');
    if (navBtn)  { navigate(navBtn.dataset.navigate); return; }

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const { action, id, discId, gcId } = actionBtn.dataset;
      if (action==='edit-div')    { _openModalDiv(id);              return; }
      if (action==='delete-div')  { _confirmDeleteDiv(id);          return; }
      if (action==='edit-disc')   { _openModalDisc(id);             return; }
      if (action==='delete-disc') { _confirmDeleteDisc(id);         return; }
      if (action==='add-gc')      { _openModalGC(discId||actionBtn.dataset.discId, null); return; }
      if (action==='edit-gc')     { _openModalGC(discId||actionBtn.dataset.discId, gcId||actionBtn.dataset.gcId); return; }
      if (action==='delete-gc')   { _confirmDeleteGC(discId||actionBtn.dataset.discId, gcId||actionBtn.dataset.gcId); return; }
      if (action==='edit-hpc')    { _openModalHPC(id);              return; }
      if (action==='delete-hpc')  { _confirmDeleteHPC(id);          return; }
    }

    const btnDeleteAnnee = e.target.closest('.btn-delete-annee');
    if (btnDeleteAnnee) { _openConfirmDeleteAnnee(btnDeleteAnnee.dataset.annee); return; }

    // Onglets internes modal établissement
    const modalTab = e.target.closest('.modal-tab');
    if (modalTab) { _switchModalTab(modalTab.dataset.tab); return; }

    if (e.target.closest('#btnAddDiv'))    { _openModalDiv(null);     return; }
    if (e.target.closest('#btnMatrice'))   { _openModalMatrice();     return; }
    if (e.target.closest('#btnAddDisc'))   { _openModalDisc(null);    return; }
    if (e.target.closest('#btnInitDisc'))  { _initDisciplinesMEN();   return; }
    if (e.target.closest('#btnSuggerer'))  { _suggererHP();           return; }
    if (e.target.closest('#btnToggleAllGC')) { _toggleAllGC();          return; }
    if (e.target.closest('#btnAddHPC'))    { _openModalHPC(null);     return; }
    if (e.target.closest('#btnHPCSelectAll')) { _hpcSelectAllClasses();  return; }
    if (e.target.closest('#btnEtab'))      { _openModal();            return; }

    // Fermeture modals par overlay
    const overlays = ['modalEtab','modalDiv','modalDisc','modalGC','modalHPC','modalMatrice','confirmDiv','confirmDisc','confirmGC','confirmHPC','confirmReset','confirmDeleteAnnee'];
    for (const oid of overlays) {
      if (e.target === document.getElementById(oid)) { _closeModalById(oid); return; }
    }

    if (e.target.closest('#modalClose'))            { _closeModal();              return; }
    if (e.target.closest('#modalCancel'))           { _closeModal();              return; }
    if (e.target.closest('#modalSave'))             { _saveModal();               return; }
    if (e.target.closest('#btnAddYear'))            { _addModalYear();            return; }
    if (e.target.closest('#btnResetAnnee'))         { _openConfirmReset();        return; }

    if (e.target.closest('#modalDivClose'))         { _closeModalDiv();           return; }
    if (e.target.closest('#modalDivCancel'))        { _closeModalDiv();           return; }
    if (e.target.closest('#modalDivSave'))          { _saveModalDiv();            return; }

    if (e.target.closest('#modalDiscClose'))        { _closeModalDisc();          return; }
    if (e.target.closest('#modalDiscCancel'))       { _closeModalDisc();          return; }
    if (e.target.closest('#modalDiscSave'))         { _saveModalDisc();           return; }

    if (e.target.closest('#modalGCClose'))          { _closeModalGC();            return; }
    if (e.target.closest('#modalGCCancel'))         { _closeModalGC();            return; }
    if (e.target.closest('#modalGCSave'))           { _saveModalGC();             return; }

    if (e.target.closest('#modalHPCClose'))         { _closeModalHPC();           return; }
    if (e.target.closest('#modalHPCCancel'))        { _closeModalHPC();           return; }
    if (e.target.closest('#modalHPCSave'))          { _saveModalHPC();            return; }

    if (e.target.closest('#modalMatriceClose'))     { _closeModalMatrice();       return; }
    if (e.target.closest('#modalMatriceCancel'))    { _closeModalMatrice();       return; }
    if (e.target.closest('#modalMatriceSave'))      { _saveModalMatrice();        return; }

    if (e.target.closest('#confirmDivCancel'))      { _closeConfirmDiv();         return; }
    if (e.target.closest('#confirmDivAnnuler'))     { _closeConfirmDiv();         return; }
    if (e.target.closest('#confirmDivOk'))          { _execDeleteDiv();           return; }

    if (e.target.closest('#confirmDiscCancel'))     { _closeConfirmDisc();        return; }
    if (e.target.closest('#confirmDiscAnnuler'))    { _closeConfirmDisc();        return; }
    if (e.target.closest('#confirmDiscOk'))         { _execDeleteDisc();          return; }

    if (e.target.closest('#confirmGCCancel'))       { _closeConfirmGC();          return; }
    if (e.target.closest('#confirmGCAnnuler'))      { _closeConfirmGC();          return; }
    if (e.target.closest('#confirmGCOk'))           { _execDeleteGC();            return; }

    if (e.target.closest('#confirmHPCCancel'))      { _closeConfirmHPC();         return; }
    if (e.target.closest('#confirmHPCAnnuler'))     { _closeConfirmHPC();         return; }
    if (e.target.closest('#confirmHPCOk'))          { _execDeleteHPC();           return; }

    if (e.target.closest('#confirmResetCancel'))    { _closeConfirmReset();       return; }
    if (e.target.closest('#confirmResetAnnuler'))   { _closeConfirmReset();       return; }
    if (e.target.closest('#confirmResetOk'))        { _execResetAnnee();          return; }

    if (e.target.closest('#confirmDeleteAnneeCancel'))  { _closeConfirmDeleteAnnee(); return; }
    if (e.target.closest('#confirmDeleteAnneeAnnuler')) { _closeConfirmDeleteAnnee(); return; }
    if (e.target.closest('#confirmDeleteAnneeOk'))      { _execDeleteAnnee();         return; }

    if (window.innerWidth <= 768) {
      const sb=document.getElementById('sidebar'), mb=document.getElementById('mobileMenuBtn');
      if (sb && mb && !sb.contains(e.target) && !mb.contains(e.target)) sb.classList.remove('open');
    }
  }

  function _closeModalById(id) {
    const M = { modalEtab:_closeModal, modalDiv:_closeModalDiv, modalDisc:_closeModalDisc, modalGC:_closeModalGC, modalHPC:_closeModalHPC, modalMatrice:_closeModalMatrice, confirmDiv:_closeConfirmDiv, confirmDisc:_closeConfirmDisc, confirmGC:_closeConfirmGC, confirmHPC:_closeConfirmHPC, confirmReset:_closeConfirmReset, confirmDeleteAnnee:_closeConfirmDeleteAnnee };
    if (M[id]) M[id]();
  }

  // ── EVENTS ───────────────────────────────────────────────────────
  function _bindEvents() {
    document.addEventListener('click', _onGlobalClick);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme')||'light';
      _applyTheme(cur==='dark'?'light':'dark');
    });

    document.addEventListener('input', e => {
      if (e.target.id==='inputDivNom'||e.target.id==='inputDivDup') _updateDupPreview();
      if (e.target.id==='inputDiscCouleur') _updateColorHint(e.target.value);
      if (e.target.id==='inputDGH_HP'||e.target.id==='inputDGH_HSA') _updateModalDotTotal();
    });

    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    document.getElementById('yearSelect').addEventListener('change', e => {
      DGHData.setAnneeActive(e.target.value); _renderAll(); _renderDashboard();
      const active = document.querySelector('.nav-item.active[data-view]');
      if (active) {
        if (active.dataset.view==='structures') _renderStructures();
        if (active.dataset.view==='dotation')   _renderDotation();
        if (active.dataset.view==='hpc')        _renderHPC();
      }
      toast('Année '+e.target.value.replace('-','–')+' chargée','info');
    });

    document.addEventListener('change', e => {
      if (e.target.id==='modalYearSelect') {
        DGHData.setAnneeActive(e.target.value);
        const dot=DGHData.getAnnee().dotation||{};
        _setVal('inputDGH_HP',  dot.hPosteEnveloppe!=null?dot.hPosteEnveloppe:'');
        _setVal('inputDGH_HSA', dot.hsaEnveloppe!=null?dot.hsaEnveloppe:'');
        _updateModalDotTotal(); _renderYearSelect(); _renderYearListAdmin();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key!=='Escape') return;
      ['modalEtab','modalDiv','modalDisc','modalGC','modalHPC','modalMatrice','confirmDiv','confirmDisc','confirmGC','confirmHPC','confirmReset','confirmDeleteAnnee']
        .forEach(id => { if(document.getElementById(id)?.classList.contains('modal-open')) _closeModalById(id); });
    });

    document.addEventListener('keydown', e => {
      if (e.target.id==='inputNewYear'&&e.key==='Enter') { e.preventDefault(); _addModalYear(); }
    });

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey||e.metaKey)&&e.key==='s') { e.preventDefault(); try{toast('Exporté : '+DGHData.exportJSON(),'success');}catch(err){toast('Erreur export','error');} }
    });

    document.getElementById('btnExport').addEventListener('click', () => {
      try{toast('Exporté : '+DGHData.exportJSON(),'success');}catch(e){toast('Erreur export : '+e.message,'error');}
    });

    const fileImport = document.getElementById('fileImport');
    document.getElementById('btnImport').addEventListener('click',()=>fileImport.click());
    document.getElementById('btnImportEmpty').addEventListener('click',()=>fileImport.click());
    fileImport.addEventListener('change', async e => {
      const file=e.target.files[0]; if(!file) return;
      try{const r=await DGHData.importJSON(file);_renderAll();_renderDashboard();toast('Importé — '+(r.etablissement||'?'),'success');}
      catch(err){toast('Erreur : '+err.message,'error',5000);}
      fileImport.value='';
    });

    document.addEventListener('dgh:storage-error', ()=>toast('Erreur de sauvegarde locale','error',6000));
  }

  // ── PREVIEW DUP ───────────────────────────────────────────────────
  function _updateDupPreview() {
    const preview=document.getElementById('dupPreview'); if(!preview) return;
    const nom=( document.getElementById('inputDivNom')?.value||'').trim();
    const dup=parseInt(document.getElementById('inputDivDup')?.value,10)||0;
    if(!nom||dup<=0){preview.innerHTML='';return;}
    const noms=[nom];let cur=nom;
    for(let i=0;i<dup;i++){cur=_previewNextName(cur);noms.push(cur);}
    preview.innerHTML='<span class="dup-preview-label">Sera créé\u00a0:</span>'+noms.map(n=>'<span class="dup-preview-chip">'+_esc(n)+'</span>').join('');
  }
  function _previewNextName(nom){const nm=nom.match(/^(.*?)(\d+)$/);if(nm){const n=parseInt(nm[2],10)+1;return nm[1]+(nm[2].length>1?String(n).padStart(nm[2].length,'0'):String(n));}const lm=nom.match(/^(.*?)([A-Z]+)$/);if(lm)return lm[1]+_nextAlpha(lm[2]);const ll=nom.match(/^(.*?)([a-z]+)$/);if(ll)return ll[1]+_nextAlpha(ll[2].toUpperCase()).toLowerCase();return nom+'2';}
  function _nextAlpha(s){const c=s.split('');let i=c.length-1;while(i>=0){const code=c[i].charCodeAt(0);if(code<90){c[i]=String.fromCharCode(code+1);return c.join('');}c[i]='A';i--;}return 'A'+c.join('');}

  // ── TOAST ────────────────────────────────────────────────────────
  function toast(msg, type, duration) {
    type=type||'info'; duration=duration||3500;
    const ICONS={success:'✓',error:'✕',warning:'⚠',info:'ℹ'};
    const c=document.getElementById('toastContainer'); if(!c) return;
    const el=document.createElement('div'); el.className='toast '+type;
    el.innerHTML='<span class="toast-icon">'+(ICONS[type]||'ℹ')+'</span><span>'+msg+'</span>';
    c.appendChild(el);
    setTimeout(()=>{el.style.cssText+='opacity:0;transform:translateX(10px);transition:.2s ease;';setTimeout(()=>el.remove(),200);},duration);
  }

  function _set(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
  function _setVal(id,val){const el=document.getElementById(id);if(el)el.value=val;}
  function _esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  return { init, navigate, toast };
})();

document.addEventListener('DOMContentLoaded', ()=>app.init());
