/**
 * DGH App — Contrôleur principal v3.0
 * Règle permanente : délégation globale unique _onGlobalClick.
 * Jamais de listener direct sur un bouton à rendu conditionnel ou tardif.
 *
 * v3.0 — Sprint 4 :
 *   - Bug fix : btnAddDisc fonctionnel (délégation corrigée)
 *   - Suppression d'année complète
 *   - Modal établissement responsive (yearListAdmin)
 *   - Saisie matricielle structures
 *   - Dotation HP + HSA distincts
 *   - Module Groupes & activités
 *   - Disciplines MEN pré-chargées (bouton init)
 */

const app = (() => {

  const VIEWS = {
    dashboard:   'Tableau de bord',
    structures:  'Structures',
    dotation:    'Dotation DGH',
    groupes:     'Groupes & activités',
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
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    if (viewId === 'dashboard')  _renderDashboard();
    if (viewId === 'alertes')    _renderAlertes();
    if (viewId === 'structures') _renderStructures();
    if (viewId === 'dotation')   _renderDotation();
    if (viewId === 'groupes')    _renderGroupes();
  }

  // ── DASHBOARD ────────────────────────────────────────────────────
  function _renderDashboard() {
    try {
      const data    = DGHData.getAnnee();
      const bilan   = Calculs.bilanDotation(data);
      const alertes = Calculs.genererAlertes(data);
      const resume  = Calculs.resumeStructures(DGHData.getStructures());

      _set('dashYear', DGHData.getAnneeActive().replace('-', '–'));
      _set('kpi-dghtotal',  bilan.enveloppe   ? bilan.enveloppe + ' h'   : '— h');
      _set('kpi-hposte',    bilan.totalHP      ? bilan.totalHP + ' h'    : '— h');
      _set('kpi-hsa-total', bilan.totalHSA     ? bilan.totalHSA + ' h'   : '— h');
      _set('kpi-alertes',   alertes.filter(a => a.severite !== 'info').length || '—');
      _set('kpi-divisions', resume.nbDivisions || '—');
      _set('kpi-effectif',  resume.effectifTotal ? resume.effectifTotal + ' élèves' : '— élèves');

      const soldeEl  = document.getElementById('kpi-solde');
      const soldeSub = document.getElementById('kpi-solde-sub');
      if (soldeEl) {
        soldeEl.textContent = bilan.enveloppe ? bilan.solde + ' h' : '— h';
        soldeEl.style.color = bilan.depassement ? 'var(--c-red)' : '';
      }
      if (soldeSub) soldeSub.textContent = bilan.depassement ? 'dépassement !' : 'heures restantes';

      // Enseignants (bilanDGH pour compatibilité)
      const bilanEnseig = Calculs.bilanDGH(data);
      _set('kpi-enseignants', bilanEnseig.nbEnseignants || '—');
      _set('kpi-tzr', 'dont ' + (bilanEnseig.nbTZR || 0) + ' TZR');

      // Badge alertes
      const nb    = alertes.filter(a => a.severite === 'error' || a.severite === 'warning').length;
      const badge = document.getElementById('badge-alertes');
      if (badge) { badge.textContent = nb || ''; badge.style.display = nb ? '' : 'none'; }

      // Stats topbar
      const stats = document.getElementById('topbarStats');
      if (stats) {
        stats.innerHTML = bilan.enveloppe > 0
          ? '<div class="topbar-stat"><span>DGH</span><span class="topbar-stat-val">' + bilan.enveloppe + 'h</span></div>'
          + '<div class="topbar-stat"><span>HP</span><span class="topbar-stat-val">' + bilan.totalHP + 'h</span></div>'
          + '<div class="topbar-stat"><span>HSA</span><span class="topbar-stat-val">' + bilan.totalHSA + 'h</span></div>'
          + '<div class="topbar-stat"><span>Solde</span><span class="topbar-stat-val">' + bilan.solde + 'h</span></div>'
          : '';
      }

      // Barre progression
      const bar = document.getElementById('progressBar');
      const lbl = document.getElementById('progress-label');
      if (bar) {
        const pct = bilan.enveloppe > 0 ? Math.min(100, bilan.pctConsomme) : 0;
        bar.style.width      = pct + '%';
        bar.style.background = bilan.depassement ? 'var(--c-red)' : pct > 90 ? 'var(--c-amber)' : 'var(--c-accent)';
      }
      if (lbl) lbl.textContent = bilan.enveloppe > 0 ? bilan.totalAlloue + ' / ' + bilan.enveloppe + ' h' : '0 / 0 h';
      _set('prog-leg-hp',  bilan.totalHP  + ' h');
      _set('prog-leg-hsa', bilan.totalHSA + ' h');

      // Empty state
      const isEmpty  = DGHData.isEmpty();
      const emptyEl  = document.getElementById('emptyState');
      const resumeEl = document.getElementById('disciplineResume');
      if (emptyEl)  emptyEl.style.display  = isEmpty ? '' : 'none';
      if (resumeEl) resumeEl.style.display = isEmpty ? 'none' : '';

      // Résumé disciplines dans le dashboard
      const discListEl = document.getElementById('disciplineList');
      if (discListEl && !isEmpty) {
        const disciplines = DGHData.getDisciplines();
        const repartition = DGHData.getRepartition();
        const structures  = DGHData.getStructures();
        const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, repartition);
        if (disciplines.length === 0) {
          discListEl.innerHTML = '<p style="color:var(--c-text-muted);font-size:.83rem;padding:.5rem 0">Aucune discipline — initialisez les <a href="#" data-navigate="dotation" style="color:var(--c-accent)">disciplines MEN</a> dans Dotation.</p>';
        } else {
          const enveloppe = bilan.enveloppe;
          let html = '<div class="disc-resume-grid">';
          besoins.forEach(b => {
            const pct = enveloppe > 0 ? Math.min(100, Math.round((b.total / enveloppe) * 100)) : 0;
            const ecartCls = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
            html += '<div class="disc-resume-row">'
              + '<span class="disc-color-dot" style="background:' + _esc(b.couleur) + '"></span>'
              + '<span class="disc-resume-nom">' + _esc(b.nom) + '</span>'
              + '<span class="disc-resume-h" style="font-family:\'JetBrains Mono\',monospace">' + b.total + ' h</span>'
              + (b.besoinTheorique > 0 ? '<span class="dot-ecart ' + ecartCls + '" style="font-size:.68rem">' + (b.ecart >= 0 ? '+' : '') + b.ecart + '</span>' : '<span></span>')
              + '<div class="dot-bar-track" style="flex:1;min-width:40px"><div class="dot-bar-fill" style="width:' + pct + '%;background:' + _esc(b.couleur) + '"></div></div>'
              + '</div>';
          });
          html += '</div>';
          discListEl.innerHTML = html;
        }
      }

    } catch(e) { console.error('[DGH] Erreur renderDashboard:', e); }
    _updateBtnEtab();
  }

  function _updateBtnEtab() {
    const btn = document.getElementById('btnEtab');
    if (!btn) return;
    try {
      const etab = DGHData.getEtab() || {};
      btn.textContent = (etab.nom && etab.nom.trim()) ? etab.nom.trim() + ' ⚙' : 'Mon Collège ⚙';
    } catch(e) { btn.textContent = 'Mon Collège ⚙'; }
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
      const listEl = document.getElementById('struct-list');
      if (!listEl) return;
      if (structures.length === 0) {
        listEl.innerHTML = '<div class="struct-empty"><div class="struct-empty-icon">⊞</div>'
          + '<p>Aucune division saisie.</p>'
          + '<p class="struct-empty-sub">Utilisez «\u00a0Saisie rapide\u00a0» pour créer toutes vos divisions en une fois.</p></div>';
        return;
      }
      let html = '<table class="struct-table"><thead><tr><th>Division</th><th>Niveau</th><th>Effectif</th><th>Dispositif</th><th class="col-actions">Actions</th></tr></thead><tbody>';
      structures.forEach(div => {
        const dispTag = div.dispositif ? '<span class="div-tag div-tag-disp">' + _esc(div.dispositif) + '</span>' : '<span class="no-tag">—</span>';
        html += '<tr>'
          + '<td><strong class="div-nom">' + _esc(div.nom || '—') + '</strong></td>'
          + '<td><span class="niveau-badge niveau-' + div.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + _esc(div.niveau) + '</span></td>'
          + '<td><span class="div-effectif">' + (div.effectif || 0) + '</span></td>'
          + '<td>' + dispTag + '</td>'
          + '<td class="col-actions"><button class="btn-icon-sm" data-action="edit-div" data-id="' + div.id + '" title="Modifier">✎</button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-div" data-id="' + div.id + '" title="Supprimer">✕</button></td></tr>';
      });
      listEl.innerHTML = html + '</tbody></table>';
    } catch(e) { console.error('[DGH] Erreur renderStructures:', e); }
  }

  // ── MODAL SAISIE MATRICIELLE ──────────────────────────────────────
  function _openModalMatrice() {
    const modal = document.getElementById('modalMatrice');
    if (!modal) return;
    const body = document.getElementById('matriceBody');
    if (!body) return;
    const niveaux = ['6e', '5e', '4e', '3e'];
    const structures = DGHData.getStructures();
    body.innerHTML = niveaux.map(niv => {
      const existantes = structures.filter(d => d.niveau === niv);
      const effectifMoyen = existantes.length > 0
        ? Math.round(existantes.reduce((s,d)=>s+(d.effectif||0),0) / existantes.length)
        : '';
      return '<tr>'
        + '<td><span class="niveau-badge niveau-' + niv.toLowerCase() + '">' + niv + '</span></td>'
        + '<td><input type="number" class="matrice-input" data-niveau="' + niv + '" data-field="nb" value="' + existantes.length + '" min="0" max="20" step="1" placeholder="0" /></td>'
        + '<td><input type="number" class="matrice-input" data-niveau="' + niv + '" data-field="eff" value="' + effectifMoyen + '" min="0" max="99" step="1" placeholder="28" /></td>'
        + '</tr>';
    }).join('');
    document.getElementById('matriceRemplacer').checked = false;
    modal.classList.add('modal-open');
    modal.querySelector('.matrice-input').focus();
  }

  function _closeModalMatrice() {
    const m = document.getElementById('modalMatrice');
    if (m) m.classList.remove('modal-open');
  }

  function _saveModalMatrice() {
    const niveaux = ['6e', '5e', '4e', '3e'];
    const matrice = niveaux.map(niv => {
      const nb  = parseInt(document.querySelector('[data-niveau="' + niv + '"][data-field="nb"]')?.value, 10) || 0;
      const eff = parseInt(document.querySelector('[data-niveau="' + niv + '"][data-field="eff"]')?.value, 10) || 0;
      return { niveau: niv, nbDivisions: nb, effectifMoyen: eff };
    }).filter(l => l.nbDivisions > 0);
    if (matrice.length === 0) { toast('Indiquez au moins un niveau avec des divisions', 'warning'); return; }
    const remplacer = document.getElementById('matriceRemplacer')?.checked || false;
    DGHData.appliquerMatrice(matrice, remplacer);
    _closeModalMatrice();
    _renderStructures();
    _renderDashboard();
    const total = matrice.reduce((s,l)=>s+l.nbDivisions,0);
    toast(total + ' division(s) générée(s)', 'success');
  }

  // ── MODAL DIVISION ────────────────────────────────────────────────
  function _openModalDiv(id) {
    const modal = document.getElementById('modalDiv');
    if (!modal) return;
    const dupGroup = document.getElementById('dupGroup');
    if (id) {
      const div = DGHData.getDivision(id); if (!div) return;
      _set('modalDivTitle', 'Modifier la division');
      _setVal('modalDivId', id);
      _setVal('inputDivNiveau', div.niveau);
      _setVal('inputDivNom', div.nom);
      _setVal('inputDivEffectif', div.effectif);
      _setVal('inputDivDispositif', div.dispositif || '');
      if (dupGroup) dupGroup.style.display = 'none';
    } else {
      _set('modalDivTitle', 'Ajouter une division');
      _setVal('modalDivId', '');
      _setVal('inputDivNiveau', '6e');
      _setVal('inputDivNom', '');
      _setVal('inputDivEffectif', '');
      _setVal('inputDivDispositif', '');
      _setVal('inputDivDup', '0');
      if (dupGroup) dupGroup.style.display = '';
    }
    modal.classList.add('modal-open');
    setTimeout(() => document.getElementById('inputDivNom')?.focus(), 60);
  }

  function _closeModalDiv() {
    const m = document.getElementById('modalDiv'); if (m) m.classList.remove('modal-open');
    const p = document.getElementById('dupPreview'); if (p) p.innerHTML = '';
  }

  function _saveModalDiv() {
    const id  = document.getElementById('modalDivId')?.value || '';
    const nom = (document.getElementById('inputDivNom')?.value || '').trim();
    if (!nom) { toast('Le nom est requis', 'warning'); return; }
    const fields = {
      niveau:     document.getElementById('inputDivNiveau')?.value || '6e',
      nom,
      effectif:   parseInt(document.getElementById('inputDivEffectif')?.value, 10) || 0,
      options:    [],
      dispositif: document.getElementById('inputDivDispositif')?.value || null
    };
    const dup = parseInt(document.getElementById('inputDivDup')?.value, 10) || 0;
    if (id) {
      DGHData.updateDivision(id, fields); toast('Division mise à jour', 'success');
    } else {
      const created = DGHData.addDivision(fields);
      if (dup > 0) { const copies = DGHData.duplicateDivisions(created.id, dup); toast(nom + ' + ' + copies.length + ' copie(s)', 'success'); }
      else toast('Division «\u00a0' + nom + '\u00a0» ajoutée', 'success');
    }
    _closeModalDiv(); _renderStructures(); _renderDashboard();
  }

  function _confirmDeleteDiv(id) {
    const div = DGHData.getDivision(id); if (!div) return;
    const m = document.getElementById('confirmDiv'); if (!m) return;
    _set('confirmDivMsg', 'Supprimer «\u00a0' + div.nom + '\u00a0» (niveau ' + div.niveau + ') ?');
    m.dataset.targetId = id; m.classList.add('modal-open');
  }
  function _closeConfirmDiv() { const m=document.getElementById('confirmDiv'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';} }
  function _execDeleteDiv() {
    const id=document.getElementById('confirmDiv')?.dataset?.targetId; if(!id) return;
    DGHData.deleteDivision(id); _closeConfirmDiv(); _renderStructures(); _renderDashboard(); toast('Division supprimée','info');
  }

  // ── DOTATION ─────────────────────────────────────────────────────
  function _renderDotation() {
    try {
      const anneeData   = DGHData.getAnnee();
      const bilan       = Calculs.bilanDotation(anneeData);
      const disciplines = DGHData.getDisciplines();
      const repartition = DGHData.getRepartition();
      const structures  = DGHData.getStructures();
      const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, repartition);

      // KPI
      _set('dot-kpi-enveloppe', bilan.enveloppe || '—');
      _set('dot-kpi-hposte',    bilan.totalHP   || 0);
      _set('dot-kpi-hsa',       bilan.totalHSA  || 0);
      _set('dot-kpi-nb',        bilan.nbDisciplines);
      const soldeEl  = document.getElementById('dot-kpi-solde');
      const soldeLbl = document.getElementById('dot-kpi-solde-label');
      if (soldeEl) { soldeEl.textContent = bilan.enveloppe > 0 ? bilan.solde : '—'; soldeEl.className = bilan.depassement ? 'struct-kpi-val dot-solde-neg' : 'struct-kpi-val dot-solde-pos'; }
      if (soldeLbl) soldeLbl.textContent = bilan.depassement ? 'h dépassement' : 'h solde';

      // Barre progression duale HP + HSA
      const pctHP  = bilan.enveloppe > 0 ? Math.min(100, Math.round((bilan.totalHP  / bilan.enveloppe) * 100)) : 0;
      const pctHSA = bilan.enveloppe > 0 ? Math.min(100 - pctHP, Math.round((bilan.totalHSA / bilan.enveloppe) * 100)) : 0;
      const barHP  = document.getElementById('dot-bar-hp');
      const barHSA = document.getElementById('dot-bar-hsa');
      if (barHP)  { barHP.style.width  = pctHP + '%'; }
      if (barHSA) { barHSA.style.width = pctHSA + '%'; barHSA.style.marginLeft = pctHP + '%'; }
      _set('dot-progress-label', bilan.enveloppe > 0 ? bilan.totalAlloue + ' / ' + bilan.enveloppe + ' h' : '0 / 0 h');
      _set('dot-leg-hp',  bilan.totalHP  + ' h');
      _set('dot-leg-hsa', bilan.totalHSA + ' h');

      // Tableau
      const listEl = document.getElementById('dot-list'); if (!listEl) return;
      if (disciplines.length === 0) {
        listEl.innerHTML = '<div class="struct-empty"><div class="struct-empty-icon">◎</div>'
          + '<p>Aucune discipline saisie.</p>'
          + '<p class="struct-empty-sub">Cliquez sur «\u00a0★ Disciplines MEN\u00a0» pour initialiser les 17 disciplines standard en un clic.</p></div>';
        return;
      }
      const besoinsMap = {}; besoins.forEach(b => { besoinsMap[b.disciplineId] = b; });
      let html = '<table class="dot-table"><thead><tr>'
        + '<th>Discipline</th><th class="col-num">Besoin MEN</th>'
        + '<th class="col-num dot-col-hp">H-Poste</th>'
        + '<th class="col-num dot-col-hsa">HSA</th>'
        + '<th class="col-num">Total</th>'
        + '<th class="col-num">Écart</th>'
        + '<th class="col-bar">Part</th>'
        + '<th class="col-actions">Actions</th>'
        + '</tr></thead><tbody>';
      disciplines.forEach(disc => {
        const b       = besoinsMap[disc.id] || { besoinTheorique:0, hPoste:0, hsa:0, total:0, ecart:0 };
        const pctBar  = bilan.enveloppe > 0 ? Math.min(100, Math.round((b.total / bilan.enveloppe) * 100)) : 0;
        const ecartCls = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
        html += '<tr>'
          + '<td><span class="disc-color-dot" style="background:' + _esc(disc.couleur) + '"></span><strong class="div-nom">' + _esc(disc.nom) + '</strong></td>'
          + '<td class="col-num dot-theorique">' + (b.besoinTheorique > 0 ? b.besoinTheorique + ' h' : '<span class="no-tag">—</span>') + '</td>'
          + '<td class="col-num"><input type="number" class="dot-input-h dot-input-hp" data-disc-id="' + disc.id + '" data-field="hPoste" value="' + b.hPoste + '" min="0" step="0.5" /></td>'
          + '<td class="col-num"><input type="number" class="dot-input-h dot-input-hsa" data-disc-id="' + disc.id + '" data-field="hsa" value="' + b.hsa + '" min="0" step="0.5" /></td>'
          + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + b.total + ' h</strong></td>'
          + '<td class="col-num"><span class="dot-ecart ' + ecartCls + '">' + (b.besoinTheorique > 0 ? (b.ecart >= 0 ? '+' : '') + b.ecart + ' h' : '—') + '</span></td>'
          + '<td class="col-bar"><div class="dot-bar-track"><div class="dot-bar-fill" style="width:' + pctBar + '%;background:' + _esc(disc.couleur) + '"></div></div><span class="dot-bar-pct">' + pctBar + '%</span></td>'
          + '<td class="col-actions"><button class="btn-icon-sm" data-action="edit-disc" data-id="' + disc.id + '" title="Modifier">✎</button><button class="btn-icon-sm btn-icon-danger" data-action="delete-disc" data-id="' + disc.id + '" title="Supprimer">✕</button></td>'
          + '</tr>';
      });
      listEl.innerHTML = html + '</tbody></table>';
      // Inputs HP + HSA inline
      listEl.querySelectorAll('.dot-input-h').forEach(inp => {
        inp.addEventListener('change', e => {
          const id    = e.target.dataset.discId;
          const field = e.target.dataset.field;
          const val   = parseFloat(e.target.value) || 0;
          if (id && field) { DGHData.setRepartition(id, { [field]: val }); _renderDotation(); _renderDashboard(); }
        });
      });
    } catch(err) { console.error('[DGH] Erreur renderDotation:', err); }
  }

  // ── MODAL DISCIPLINE ──────────────────────────────────────────────
  function _openModalDisc(id) {
    const modal = document.getElementById('modalDisc'); if (!modal) return;
    if (id) {
      const disc = DGHData.getDiscipline(id); if (!disc) return;
      _set('modalDiscTitle', 'Modifier la discipline');
      _setVal('modalDiscId', id); _setVal('inputDiscNom', disc.nom);
      _setVal('inputDiscCouleur', disc.couleur || '#2d6a4f'); _updateColorHint(disc.couleur || '#2d6a4f');
    } else {
      _set('modalDiscTitle', 'Ajouter une discipline');
      _setVal('modalDiscId', ''); _setVal('inputDiscNom', '');
      _setVal('inputDiscCouleur', '#2d6a4f'); _updateColorHint('#2d6a4f');
    }
    modal.classList.add('modal-open');
    setTimeout(() => document.getElementById('inputDiscNom')?.focus(), 60);
  }

  function _updateColorHint(v) { const h = document.getElementById('colorHint'); if (h) h.textContent = v; }
  function _closeModalDisc() { const m=document.getElementById('modalDisc'); if(m) m.classList.remove('modal-open'); }

  function _saveModalDisc() {
    const id  = document.getElementById('modalDiscId')?.value || '';
    const nom = (document.getElementById('inputDiscNom')?.value || '').trim();
    if (!nom) { toast('Le nom est requis', 'warning'); return; }
    const couleur = document.getElementById('inputDiscCouleur')?.value || '#2d6a4f';
    if (id) { DGHData.updateDiscipline(id, { nom, couleur }); toast('Discipline mise à jour', 'success'); }
    else    { DGHData.addDiscipline({ nom, couleur }); toast('Discipline «\u00a0' + nom + '\u00a0» ajoutée', 'success'); }
    _closeModalDisc(); _renderDotation(); _renderDashboard();
  }

  function _confirmDeleteDisc(id) {
    const disc = DGHData.getDiscipline(id); if (!disc) return;
    const m = document.getElementById('confirmDisc'); if (!m) return;
    _set('confirmDiscMsg', 'Supprimer «\u00a0' + disc.nom + '\u00a0» ?');
    m.dataset.targetId = id; m.classList.add('modal-open');
  }
  function _closeConfirmDisc() { const m=document.getElementById('confirmDisc'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';} }
  function _execDeleteDisc() {
    const id=document.getElementById('confirmDisc')?.dataset?.targetId; if(!id) return;
    DGHData.deleteDiscipline(id); _closeConfirmDisc(); _renderDotation(); _renderDashboard(); toast('Discipline supprimée','info');
  }

  // ── GROUPES & ACTIVITÉS ───────────────────────────────────────────
  function _renderGroupes() {
    try {
      const groupes     = DGHData.getGroupes();
      const disciplines = DGHData.getDisciplines();
      const bilan       = Calculs.bilanGroupes(groupes, disciplines);
      const LABELS_TYPE = {};
      DGHData.getTypeGroupes().forEach(t => { LABELS_TYPE[t.value] = t.label; });

      _set('grp-kpi-nb',     bilan.nbGroupes);
      _set('grp-kpi-heures', bilan.totalHeures);

      const listEl = document.getElementById('grp-list'); if (!listEl) return;
      if (groupes.length === 0) {
        listEl.innerHTML = '<div class="struct-empty"><div class="struct-empty-icon">◈</div>'
          + '<p>Aucun groupe ni activité saisie.</p>'
          + '<p class="struct-empty-sub">Ajoutez ici vos options de langue, groupes de besoin, labo, chorale, UNSS…</p></div>';
        return;
      }
      let html = '<table class="dot-table"><thead><tr><th>Groupe</th><th>Type</th><th>Discipline</th><th>Niveaux</th><th class="col-num">H/sem</th><th class="col-num">Effectif</th><th class="col-actions">Actions</th></tr></thead><tbody>';
      const discMap = {}; disciplines.forEach(d => { discMap[d.id] = d; });
      groupes.forEach(g => {
        const typeLabel = (LABELS_TYPE[g.type] || g.type).split('(')[0].trim();
        const discNom   = g.disciplineId && discMap[g.disciplineId] ? discMap[g.disciplineId].nom : '—';
        const niveaux   = (g.niveaux || []).join(', ') || '—';
        html += '<tr>'
          + '<td><strong class="div-nom">' + _esc(g.nom||'—') + '</strong>' + (g.commentaire ? '<br><span class="grp-comment">' + _esc(g.commentaire) + '</span>' : '') + '</td>'
          + '<td><span class="grp-type-badge">' + _esc(typeLabel) + '</span></td>'
          + '<td>' + _esc(discNom) + '</td>'
          + '<td><span class="grp-niveaux">' + _esc(niveaux) + '</span></td>'
          + '<td class="col-num"><strong style="font-family:\'JetBrains Mono\',monospace">' + (g.heures||0) + ' h</strong></td>'
          + '<td class="col-num">' + (g.effectif||0) + '</td>'
          + '<td class="col-actions"><button class="btn-icon-sm" data-action="edit-grp" data-id="' + g.id + '" title="Modifier">✎</button><button class="btn-icon-sm btn-icon-danger" data-action="delete-grp" data-id="' + g.id + '" title="Supprimer">✕</button></td>'
          + '</tr>';
      });
      listEl.innerHTML = html + '</tbody></table>';
    } catch(e) { console.error('[DGH] Erreur renderGroupes:', e); }
  }

  function _openModalGroupe(id) {
    const modal = document.getElementById('modalGroupe'); if (!modal) return;
    // Remplir select type
    const selType = document.getElementById('inputGrpType');
    if (selType) selType.innerHTML = DGHData.getTypeGroupes().map(t => '<option value="' + t.value + '">' + t.label + '</option>').join('');
    // Remplir select discipline
    const selDisc = document.getElementById('inputGrpDisc');
    if (selDisc) {
      const discs = DGHData.getDisciplines();
      selDisc.innerHTML = '<option value="">— Aucune —</option>' + discs.map(d => '<option value="' + d.id + '">' + _esc(d.nom) + '</option>').join('');
    }
    // Checkboxes niveaux
    const niveauxDiv = document.getElementById('niveauxCheck');
    if (niveauxDiv) niveauxDiv.innerHTML = DGHData.getNiveaux().map(n => '<label class="niv-check-label"><input type="checkbox" class="niv-check" value="' + n + '" /><span>' + n + '</span></label>').join('');

    if (id) {
      const g = DGHData.getGroupe(id); if (!g) return;
      _set('modalGroupeTitle', 'Modifier le groupe');
      _setVal('modalGroupeId', id); _setVal('inputGrpNom', g.nom);
      if (selType) selType.value = g.type;
      if (selDisc) selDisc.value = g.disciplineId || '';
      (g.niveaux || []).forEach(n => { const cb = niveauxDiv?.querySelector('[value="' + n + '"]'); if (cb) cb.checked = true; });
      _setVal('inputGrpHeures', g.heures); _setVal('inputGrpEffectif', g.effectif); _setVal('inputGrpComment', g.commentaire||'');
    } else {
      _set('modalGroupeTitle', 'Ajouter un groupe');
      _setVal('modalGroupeId', ''); _setVal('inputGrpNom', '');
      _setVal('inputGrpHeures', ''); _setVal('inputGrpEffectif', ''); _setVal('inputGrpComment', '');
    }
    modal.classList.add('modal-open');
    setTimeout(() => document.getElementById('inputGrpNom')?.focus(), 60);
  }

  function _closeModalGroupe() { const m=document.getElementById('modalGroupe'); if(m) m.classList.remove('modal-open'); }

  function _saveModalGroupe() {
    const id  = document.getElementById('modalGroupeId')?.value || '';
    const nom = (document.getElementById('inputGrpNom')?.value || '').trim();
    if (!nom) { toast('Le nom du groupe est requis', 'warning'); return; }
    const niveaux = Array.from(document.querySelectorAll('.niv-check:checked')).map(cb => cb.value);
    const fields  = {
      nom, type: document.getElementById('inputGrpType')?.value || 'autre',
      disciplineId: document.getElementById('inputGrpDisc')?.value || null,
      niveaux,
      heures:   parseFloat(document.getElementById('inputGrpHeures')?.value)  || 0,
      effectif: parseInt(document.getElementById('inputGrpEffectif')?.value, 10) || 0,
      commentaire: document.getElementById('inputGrpComment')?.value || ''
    };
    if (id) { DGHData.updateGroupe(id, fields); toast('Groupe mis à jour', 'success'); }
    else    { DGHData.addGroupe(fields);         toast('Groupe «\u00a0' + nom + '\u00a0» ajouté', 'success'); }
    _closeModalGroupe(); _renderGroupes();
  }

  function _confirmDeleteGroupe(id) {
    const g = DGHData.getGroupe(id); if (!g) return;
    const m = document.getElementById('confirmGroupe'); if (!m) return;
    _set('confirmGroupeMsg', 'Supprimer le groupe «\u00a0' + g.nom + '\u00a0» ?');
    m.dataset.targetId = id; m.classList.add('modal-open');
  }
  function _closeConfirmGroupe() { const m=document.getElementById('confirmGroupe'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';} }
  function _execDeleteGroupe() {
    const id=document.getElementById('confirmGroupe')?.dataset?.targetId; if(!id) return;
    DGHData.deleteGroupe(id); _closeConfirmGroupe(); _renderGroupes(); toast('Groupe supprimé','info');
  }

  // ── MODAL ÉTABLISSEMENT ───────────────────────────────────────────
  function _openModal() {
    try {
      const etab = DGHData.getEtab() || {};
      const ann  = DGHData.getAnnee() || {};
      const dot  = ann.dotation || {};
      const m    = document.getElementById('modalEtab'); if (!m) return;
      _setVal('inputNomEtab', etab.nom || ''); _setVal('inputUAI', etab.uai || '');
      _setVal('inputAcademie', etab.academie || '');
      _setVal('inputDGH', dot.enveloppe != null ? dot.enveloppe : '');
      _renderModalYearSelect(); _renderYearListAdmin();
      m.classList.add('modal-open');
      setTimeout(() => document.getElementById('inputNomEtab')?.focus(), 60);
    } catch(e) { console.error('[DGH] modal etab:', e); toast('Impossible d\'ouvrir les paramètres', 'error'); }
  }

  function _renderModalYearSelect() {
    const sel = document.getElementById('modalYearSelect'); if (!sel) return;
    const active = DGHData.getAnneeActive();
    sel.innerHTML = '';
    DGHData.getAnnees().forEach(a => {
      const opt = document.createElement('option');
      opt.value = a; opt.textContent = a.replace('-', ' – ');
      if (a === active) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  /** Liste des années avec bouton supprimer — dans la modal établissement */
  function _renderYearListAdmin() {
    const zone = document.getElementById('yearListAdmin'); if (!zone) return;
    const active = DGHData.getAnneeActive();
    const annees = DGHData.getAnnees();
    if (annees.length <= 1) { zone.innerHTML = ''; return; }
    zone.innerHTML = '<div class="year-list-admin-title">Supprimer une année</div>'
      + annees.map(a => {
          const isActive = a === active;
          return '<div class="year-admin-row">'
            + '<span class="year-admin-label' + (isActive ? ' year-admin-active' : '') + '">' + a.replace('-', ' – ') + (isActive ? ' ★ active' : '') + '</span>'
            + (isActive ? '' : '<button class="btn-danger btn-sm btn-delete-annee" data-annee="' + a + '">Supprimer</button>')
            + '</div>';
        }).join('');
  }

  function _closeModal() { const m=document.getElementById('modalEtab'); if(m) m.classList.remove('modal-open'); }

  function _saveModal() {
    try {
      const ms = document.getElementById('modalYearSelect');
      if (ms && ms.value && ms.value !== DGHData.getAnneeActive()) DGHData.setAnneeActive(ms.value);
      DGHData.setEtab({ nom: document.getElementById('inputNomEtab')?.value?.trim()||'', uai: document.getElementById('inputUAI')?.value?.trim()||'', academie: document.getElementById('inputAcademie')?.value?.trim()||'' });
      const commentaireExistant = DGHData.getAnnee().dotation?.commentaire || '';
      DGHData.setDotation(parseFloat(document.getElementById('inputDGH')?.value)||0, commentaireExistant);
      _closeModal(); _renderAll(); _renderDashboard();
      toast('Paramètres enregistrés', 'success');
    } catch(e) { console.error('[DGH] save modal:', e); toast('Erreur lors de la sauvegarde', 'error'); }
  }

  function _addModalYear() {
    const input = document.getElementById('inputNewYear'); if (!input) return;
    const val = input.value.trim();
    if (!/^\d{4}-\d{4}$/.test(val)) { toast('Format requis : 2026-2027', 'warning'); input.focus(); return; }
    const [debut, fin] = val.split('-').map(Number);
    if (fin !== debut + 1) { toast('Les deux années doivent se suivre', 'warning'); input.focus(); return; }
    if (DGHData.getAnnees().includes(val)) { toast('Cette année existe déjà', 'info'); const s=document.getElementById('modalYearSelect'); if(s)s.value=val; input.value=''; return; }
    DGHData.setAnneeActive(val); input.value=''; _renderModalYearSelect(); _renderYearSelect(); _renderYearListAdmin();
    toast('Année ' + val.replace('-', '–') + ' créée', 'success');
  }

  // ── RÉINITIALISATION ANNÉE ────────────────────────────────────────
  function _openConfirmReset() {
    const m = document.getElementById('confirmReset'); if (!m) return;
    _set('confirmResetMsg', 'Réinitialiser toutes les données de l\'année ' + DGHData.getAnneeActive().replace('-', '–') + ' ?');
    m.classList.add('modal-open');
  }
  function _closeConfirmReset() { const m=document.getElementById('confirmReset'); if(m) m.classList.remove('modal-open'); }
  function _execResetAnnee() {
    const a=DGHData.getAnneeActive(); DGHData.resetAnnee(); _closeConfirmReset(); _closeModal(); _renderAll(); _renderDashboard();
    toast('Année ' + a.replace('-', '–') + ' réinitialisée', 'info');
  }

  // ── SUPPRESSION ANNÉE ─────────────────────────────────────────────
  function _openConfirmDeleteAnnee(annee) {
    const m = document.getElementById('confirmDeleteAnnee'); if (!m) return;
    _set('confirmDeleteAnneeMsg', 'Supprimer définitivement l\'année ' + annee.replace('-', '–') + ' et toutes ses données ?');
    m.dataset.targetAnnee = annee; m.classList.add('modal-open');
  }
  function _closeConfirmDeleteAnnee() { const m=document.getElementById('confirmDeleteAnnee'); if(m){m.classList.remove('modal-open');m.dataset.targetAnnee='';} }
  function _execDeleteAnnee() {
    const annee=document.getElementById('confirmDeleteAnnee')?.dataset?.targetAnnee; if(!annee) return;
    const res=DGHData.deleteAnnee(annee);
    if (!res.ok) { toast(res.message, 'warning'); _closeConfirmDeleteAnnee(); return; }
    _closeConfirmDeleteAnnee(); _closeModal(); _renderAll(); _renderDashboard();
    toast('Année ' + annee.replace('-', '–') + ' supprimée', 'info');
  }

  // ── ALERTES ──────────────────────────────────────────────────────
  function _renderAlertes() {
    try {
      const alertes = Calculs.genererAlertes(DGHData.getAnnee());
      const zone    = document.getElementById('alertes-zone'); if (!zone) return;
      const ICONS   = { error:'✕', warning:'⚠', info:'ℹ' };
      zone.className = 'section-card';
      zone.innerHTML = '<div class="alertes-list">'
        + (alertes.length
          ? alertes.map(a => '<div class="alerte-item sev-' + a.severite + '"><span class="alerte-dot">' + (ICONS[a.severite]||'·') + '</span><span class="alerte-msg">' + a.message + '</span></div>').join('')
          : '<div class="alertes-empty">✓ Aucune alerte — tout est en ordre.</div>')
        + '</div>';
    } catch(e) { console.error('[DGH] renderAlertes:', e); }
  }

  // ── RENDU GLOBAL ─────────────────────────────────────────────────
  function _renderAll() { _updateBtnEtab(); _renderYearSelect(); }

  function _renderYearSelect() {
    const sel = document.getElementById('yearSelect'); if (!sel) return;
    const active = DGHData.getAnneeActive();
    sel.innerHTML = '';
    DGHData.getAnnees().forEach(a => {
      const opt = document.createElement('option');
      opt.value = a; opt.textContent = a.replace('-', ' – ');
      if (a === active) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── DÉLÉGATION GLOBALE ────────────────────────────────────────────
  function _onGlobalClick(e) {
    // Navigation
    const navItem = e.target.closest('.nav-item[data-view]');
    if (navItem) { navigate(navItem.dataset.view); return; }
    const navBtn = e.target.closest('[data-navigate]');
    if (navBtn)  { navigate(navBtn.dataset.navigate); return; }

    // Actions tableau (data-action)
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const { action, id } = actionBtn.dataset;
      if (action === 'edit-div')    { _openModalDiv(id);      return; }
      if (action === 'delete-div')  { _confirmDeleteDiv(id);  return; }
      if (action === 'edit-disc')   { _openModalDisc(id);     return; }
      if (action === 'delete-disc') { _confirmDeleteDisc(id); return; }
      if (action === 'edit-grp')    { _openModalGroupe(id);   return; }
      if (action === 'delete-grp')  { _confirmDeleteGroupe(id); return; }
    }

    // Bouton supprimer une année dans yearListAdmin
    const btnDeleteAnnee = e.target.closest('.btn-delete-annee');
    if (btnDeleteAnnee) { _openConfirmDeleteAnnee(btnDeleteAnnee.dataset.annee); return; }

    // Boutons de vue
    if (e.target.closest('#btnAddDiv'))    { _openModalDiv(null);     return; }
    if (e.target.closest('#btnMatrice'))   { _openModalMatrice();     return; }
    if (e.target.closest('#btnAddDisc'))   { _openModalDisc(null);    return; }
    if (e.target.closest('#btnInitDisc'))  { _initDisciplinesMEN();   return; }
    if (e.target.closest('#btnAddGroupe')) { _openModalGroupe(null);  return; }
    if (e.target.closest('#btnEtab'))      { _openModal();            return; }

    // Fermeture modals par overlay
    const overlays = ['modalEtab','modalDiv','modalDisc','modalGroupe','modalMatrice','confirmDiv','confirmDisc','confirmGroupe','confirmReset','confirmDeleteAnnee'];
    for (const oid of overlays) {
      if (e.target === document.getElementById(oid)) {
        _closeModalById(oid); return;
      }
    }

    // Boutons dans modals
    if (e.target.closest('#modalClose'))           { _closeModal();              return; }
    if (e.target.closest('#modalCancel'))          { _closeModal();              return; }
    if (e.target.closest('#modalSave'))            { _saveModal();               return; }
    if (e.target.closest('#btnAddYear'))           { _addModalYear();            return; }
    if (e.target.closest('#btnResetAnnee'))        { _openConfirmReset();        return; }

    if (e.target.closest('#modalDivClose'))        { _closeModalDiv();           return; }
    if (e.target.closest('#modalDivCancel'))       { _closeModalDiv();           return; }
    if (e.target.closest('#modalDivSave'))         { _saveModalDiv();            return; }

    if (e.target.closest('#modalDiscClose'))       { _closeModalDisc();          return; }
    if (e.target.closest('#modalDiscCancel'))      { _closeModalDisc();          return; }
    if (e.target.closest('#modalDiscSave'))        { _saveModalDisc();           return; }

    if (e.target.closest('#modalGroupeClose'))     { _closeModalGroupe();        return; }
    if (e.target.closest('#modalGroupeCancel'))    { _closeModalGroupe();        return; }
    if (e.target.closest('#modalGroupeSave'))      { _saveModalGroupe();         return; }

    if (e.target.closest('#modalMatriceClose'))    { _closeModalMatrice();       return; }
    if (e.target.closest('#modalMatriceCancel'))   { _closeModalMatrice();       return; }
    if (e.target.closest('#modalMatriceSave'))     { _saveModalMatrice();        return; }

    if (e.target.closest('#confirmDivCancel'))     { _closeConfirmDiv();         return; }
    if (e.target.closest('#confirmDivAnnuler'))    { _closeConfirmDiv();         return; }
    if (e.target.closest('#confirmDivOk'))         { _execDeleteDiv();           return; }

    if (e.target.closest('#confirmDiscCancel'))    { _closeConfirmDisc();        return; }
    if (e.target.closest('#confirmDiscAnnuler'))   { _closeConfirmDisc();        return; }
    if (e.target.closest('#confirmDiscOk'))        { _execDeleteDisc();          return; }

    if (e.target.closest('#confirmGroupeCancel'))  { _closeConfirmGroupe();      return; }
    if (e.target.closest('#confirmGroupeAnnuler')) { _closeConfirmGroupe();      return; }
    if (e.target.closest('#confirmGroupeOk'))      { _execDeleteGroupe();        return; }

    if (e.target.closest('#confirmResetCancel'))   { _closeConfirmReset();       return; }
    if (e.target.closest('#confirmResetAnnuler'))  { _closeConfirmReset();       return; }
    if (e.target.closest('#confirmResetOk'))       { _execResetAnnee();          return; }

    if (e.target.closest('#confirmDeleteAnneeCancel'))  { _closeConfirmDeleteAnnee(); return; }
    if (e.target.closest('#confirmDeleteAnneeAnnuler')) { _closeConfirmDeleteAnnee(); return; }
    if (e.target.closest('#confirmDeleteAnneeOk'))      { _execDeleteAnnee();         return; }

    // Sidebar mobile
    if (window.innerWidth <= 768) {
      const sb=document.getElementById('sidebar'), mb=document.getElementById('mobileMenuBtn');
      if (sb && mb && !sb.contains(e.target) && !mb.contains(e.target)) sb.classList.remove('open');
    }
  }

  function _closeModalById(id) {
    const CLOSE = {
      modalEtab:           _closeModal,
      modalDiv:            _closeModalDiv,
      modalDisc:           _closeModalDisc,
      modalGroupe:         _closeModalGroupe,
      modalMatrice:        _closeModalMatrice,
      confirmDiv:          _closeConfirmDiv,
      confirmDisc:         _closeConfirmDisc,
      confirmGroupe:       _closeConfirmGroupe,
      confirmReset:        _closeConfirmReset,
      confirmDeleteAnnee:  _closeConfirmDeleteAnnee,
    };
    if (CLOSE[id]) CLOSE[id]();
  }

  // ── DISCIPLINES MEN INIT ──────────────────────────────────────────
  function _initDisciplinesMEN() {
    const nb = DGHData.initDisciplinesMEN();
    _renderDotation(); _renderDashboard();
    toast(nb > 0 ? nb + ' disciplines MEN ajoutées' : 'Toutes les disciplines MEN sont déjà présentes', nb > 0 ? 'success' : 'info');
  }

  // ── EVENTS ───────────────────────────────────────────────────────
  function _bindEvents() {
    document.addEventListener('click', _onGlobalClick);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      _applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    // Preview duplication division
    document.addEventListener('input', e => {
      if (e.target.id === 'inputDivNom' || e.target.id === 'inputDivDup') _updateDupPreview();
      if (e.target.id === 'inputDiscCouleur') _updateColorHint(e.target.value);
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
        if (active.dataset.view === 'structures') _renderStructures();
        if (active.dataset.view === 'dotation')   _renderDotation();
        if (active.dataset.view === 'groupes')    _renderGroupes();
      }
      toast('Année ' + e.target.value.replace('-', '–') + ' chargée', 'info');
    });

    document.addEventListener('change', e => {
      if (e.target.id === 'modalYearSelect') {
        DGHData.setAnneeActive(e.target.value);
        const dot = DGHData.getAnnee().dotation || {};
        _setVal('inputDGH', dot.enveloppe != null ? dot.enveloppe : '');
        _renderYearSelect(); _renderYearListAdmin();
      }
    });

    // Échap ferme toute modal ouverte
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      ['modalEtab','modalDiv','modalDisc','modalGroupe','modalMatrice','confirmDiv','confirmDisc','confirmGroupe','confirmReset','confirmDeleteAnnee']
        .forEach(id => { if (document.getElementById(id)?.classList.contains('modal-open')) _closeModalById(id); });
    });

    // Entrée dans champ nouvelle année
    document.addEventListener('keydown', e => {
      if (e.target.id === 'inputNewYear' && e.key === 'Enter') { e.preventDefault(); _addModalYear(); }
    });

    // Ctrl+S → export
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        try { toast('Exporté : ' + DGHData.exportJSON(), 'success'); }
        catch(err) { toast('Erreur export', 'error'); }
      }
    });

    document.getElementById('btnExport').addEventListener('click', () => {
      try { toast('Exporté : ' + DGHData.exportJSON(), 'success'); }
      catch(e) { toast('Erreur export : ' + e.message, 'error'); }
    });

    const fileImport = document.getElementById('fileImport');
    document.getElementById('btnImport').addEventListener('click', () => fileImport.click());
    document.getElementById('btnImportEmpty').addEventListener('click', () => fileImport.click());
    fileImport.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try { const r = await DGHData.importJSON(file); _renderAll(); _renderDashboard(); toast('Importé — ' + (r.etablissement||'?'), 'success'); }
      catch(err) { toast('Erreur : ' + err.message, 'error', 5000); }
      fileImport.value = '';
    });

    document.addEventListener('dgh:storage-error', () => toast('Erreur de sauvegarde locale', 'error', 6000));
  }

  // ── PREVIEW DUP DIVISION ──────────────────────────────────────────
  function _updateDupPreview() {
    const preview = document.getElementById('dupPreview'); if (!preview) return;
    const nom = (document.getElementById('inputDivNom')?.value || '').trim();
    const dup = parseInt(document.getElementById('inputDivDup')?.value, 10) || 0;
    if (!nom || dup <= 0) { preview.innerHTML = ''; return; }
    const noms = [nom]; let cur = nom;
    for (let i = 0; i < dup; i++) { cur = _previewNextName(cur); noms.push(cur); }
    preview.innerHTML = '<span class="dup-preview-label">Sera créé\u00a0:</span>' + noms.map(n => '<span class="dup-preview-chip">' + _esc(n) + '</span>').join('');
  }

  function _previewNextName(nom) {
    const nm=nom.match(/^(.*?)(\d+)$/); if(nm){const n=parseInt(nm[2],10)+1;return nm[1]+(nm[2].length>1?String(n).padStart(nm[2].length,'0'):String(n));}
    const lm=nom.match(/^(.*?)([A-Z]+)$/); if(lm) return lm[1]+_nextAlpha(lm[2]);
    const ll=nom.match(/^(.*?)([a-z]+)$/); if(ll) return ll[1]+_nextAlpha(ll[2].toUpperCase()).toLowerCase();
    return nom+'2';
  }
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

  // ── UTIL ─────────────────────────────────────────────────────────
  function _set(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
  function _setVal(id, val) { const el=document.getElementById(id); if(el) el.value=val; }
  function _esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return { init, navigate, toast };

})();

document.addEventListener('DOMContentLoaded', () => app.init());
