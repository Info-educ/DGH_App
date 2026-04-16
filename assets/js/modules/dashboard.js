/**
 * DGH App — Module Dashboard
 * Rendu du tableau de bord et du bouton établissement.
 */

const DGHDashboard = (() => {

  // ── RENDU PRINCIPAL ───────────────────────────────────────────────
  function renderDashboard() {
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

      // Solde — couleur via classes CSS
      const soldeEl  = document.getElementById('kpi-solde');
      const soldeSub = document.getElementById('kpi-solde-sub');
      if (soldeEl) {
        soldeEl.textContent = bilan.enveloppe ? bilan.solde + ' h' : '— h';
        soldeEl.classList.toggle('kpi-solde-danger', !!bilan.depassement);
      }
      if (soldeSub) soldeSub.textContent = bilan.depassement ? 'dépassement !' : 'heures restantes';

      // Badge alertes sidebar
      const nb    = alertes.filter(a => a.severite === 'error' || a.severite === 'warning').length;
      const badge = document.getElementById('badge-alertes');
      if (badge) {
        badge.textContent = nb || '';
        badge.classList.toggle('badge-hidden', !nb);
      }

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
          hpHsaGrid.classList.remove('is-hidden');
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
          // Couleur solde HP/HSA via classes CSS
          const freeHP  = document.getElementById('dash-hp-free');
          const freeHSA = document.getElementById('dash-hsa-free');
          if (freeHP) {
            freeHP.classList.toggle('solde-danger',   hpFree  < 0);
            freeHP.classList.toggle('solde-neutre',   hpFree  === 0);
            freeHP.classList.toggle('solde-positif',  hpFree  > 0);
          }
          if (freeHSA) {
            freeHSA.classList.toggle('solde-danger',  hsaFree < 0);
            freeHSA.classList.toggle('solde-neutre',  hsaFree === 0);
            freeHSA.classList.toggle('solde-hsa',     hsaFree > 0);
          }
        } else {
          hpHsaGrid.classList.add('is-hidden');
        }
      }

      // Tooltips KPI
      const tooltipDGH = document.getElementById('kpi-tooltip-dghtotal');
      if (tooltipDGH && bilan.enveloppe > 0) {
        tooltipDGH.innerHTML = '<strong>Enveloppe DSDEN</strong><br>HP\u00a0: ' + bilan.hPosteEnv + '\u00a0h<br>HSA\u00a0: ' + bilan.hsaEnv + '\u00a0h<br>Total\u00a0: ' + bilan.enveloppe + '\u00a0h';
      }
      const tooltipHP = document.getElementById('kpi-tooltip-hposte');
      if (tooltipHP && bilan.hPosteEnv > 0) {
        tooltipHP.innerHTML = '<strong>H-Poste</strong><br>Enveloppe\u00a0: ' + bilan.hPosteEnv + '\u00a0h<br>Allouées\u00a0: ' + bilan.totalHP + '\u00a0h<br>Dont Dotation\u00a0: ' + (bilan.totalHPDisc||0) + '\u00a0h<br>Dont HPC\u00a0: ' + (bilan.totalHPHPC||0) + '\u00a0h<br>Disponibles\u00a0: ' + Math.round((bilan.hPosteEnv - bilan.totalHP)*2)/2 + '\u00a0h';
      }
      const tooltipHSA = document.getElementById('kpi-tooltip-hsa');
      if (tooltipHSA && bilan.hsaEnv > 0) {
        tooltipHSA.innerHTML = '<strong>HSA</strong><br>Enveloppe\u00a0: ' + bilan.hsaEnv + '\u00a0h<br>Allouées\u00a0: ' + bilan.totalHSA + '\u00a0h<br>Dont Dotation\u00a0: ' + (bilan.totalHSADisc||0) + '\u00a0h<br>Dont HPC\u00a0: ' + (bilan.totalHSAHPC||0) + '\u00a0h<br>Disponibles\u00a0: ' + Math.round((bilan.hsaEnv - bilan.totalHSA)*2)/2 + '\u00a0h';
      }
      const tooltipSolde = document.getElementById('kpi-tooltip-solde');
      if (tooltipSolde && bilan.enveloppe > 0) {
        tooltipSolde.innerHTML = '<strong>Solde global</strong><br>Enveloppe\u00a0: ' + bilan.enveloppe + '\u00a0h<br>Consommées\u00a0: ' + bilan.totalAlloue + '\u00a0h<br>Solde\u00a0: ' + bilan.solde + '\u00a0h (' + bilan.pctConsomme + '% consommé)';
      }

      // Empty state
      const isEmpty  = DGHData.isEmpty();
      const emptyEl  = document.getElementById('emptyState');
      const resumeEl = document.getElementById('disciplineResume');
      if (emptyEl)  emptyEl.classList.toggle('is-hidden', !isEmpty);
      if (resumeEl) resumeEl.classList.toggle('is-hidden', isEmpty);

      // Résumé disciplines
      _renderDiscResume(bilan);

      // Résumé HPC
      _renderHPCResume();

    } catch(e) { console.error('[DGH] renderDashboard:', e); }
    updateBtnEtab();
  }

  function _renderDiscResume(bilan) {
    const discListEl = document.getElementById('disciplineList');
    if (!discListEl || DGHData.isEmpty()) return;
    const disciplines = DGHData.getDisciplines();
    const repartition = DGHData.getRepartition();
    const structures  = DGHData.getStructures();
    const grilles     = DGHData.getGrilles();
    const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, repartition, grilles);
    if (disciplines.length === 0) {
      discListEl.innerHTML = '<p style="color:var(--c-text-muted);font-size:.83rem;padding:.5rem 0">Aucune discipline \u2014 initialisez les <button class="btn-link" data-navigate="dotation">disciplines MEN dans Dotation</button>.</p>';
      return;
    }
    const nbDivParNiv = {};
    structures.forEach(s => { nbDivParNiv[s.niveau] = (nbDivParNiv[s.niveau]||0) + 1; });
    const niveauxDispo = ['6e','5e','4e','3e'].filter(niv => nbDivParNiv[niv]);
    let html = '<div class="disc-resume-grid">';
    besoins.forEach(b => {
      const pct      = bilan.enveloppe > 0 ? Math.min(100, Math.round((b.total / bilan.enveloppe) * 100)) : 0;
      const ecartCls = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
      let tipHtml = '<strong>' + _esc(b.nom) + '</strong>';
      niveauxDispo.forEach(niv => {
        const gl = b.grilleLignes && b.grilleLignes[niv];
        const hParDiv = gl ? gl.valeur : null;
        const nb = nbDivParNiv[niv] || 0;
        if (hParDiv !== null && hParDiv !== undefined && hParDiv !== '') {
          const hTot = Math.round(parseFloat(hParDiv) * nb * 2) / 2;
          const modifie = gl && gl.modifie ? ' \u270e' : '';
          tipHtml += '<div class="disc-tip-row"><span class="disc-tip-niv">' + niv + '</span><span class="disc-tip-val">' + hTot + '\u00a0h</span><small>(' + hParDiv + 'h \u00d7 ' + nb + ' div' + modifie + ')</small></div>';
        } else {
          tipHtml += '<div class="disc-tip-row disc-tip-absent"><span class="disc-tip-niv">' + niv + '</span><span>\u2014</span><small>non pr\u00e9vu</small></div>';
        }
      });
      tipHtml += '<hr class="disc-tip-sep">';
      tipHtml += '<div class="disc-tip-row"><span class="disc-tip-hp">HP</span><span>' + b.hPoste + '\u00a0h</span></div>';
      tipHtml += '<div class="disc-tip-row"><span class="disc-tip-hsa">HSA</span><span>' + b.hsa + '\u00a0h</span></div>';
      if (b.besoinTheorique > 0) {
        const ecartCss = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
        tipHtml += '<div class="disc-tip-row">Besoin<span>' + b.besoinTheorique + '\u00a0h</span></div>';
        tipHtml += '<div class="disc-tip-row"><span class="dot-ecart ' + ecartCss + '">' + (b.ecart >= 0 ? '+' : '') + b.ecart + '\u00a0h</span><small>\u00e9cart</small></div>';
      }
      html += '<div class="disc-resume-row disc-tip-wrap">'
        + '<span class="disc-color-dot" style="background:' + _esc(b.couleur) + '"></span>'
        + '<span class="disc-resume-nom">' + _esc(b.nom) + '</span>'
        + '<span class="disc-resume-h">' + b.total + ' h</span>'
        + (b.besoinTheorique > 0 ? '<span class="dot-ecart ' + ecartCls + '" style="font-size:.68rem">' + (b.ecart >= 0 ? '+' : '') + b.ecart + '</span>' : '<span></span>')
        + '<div class="dot-bar-track" style="flex:1;min-width:40px"><div class="dot-bar-fill" style="width:' + pct + '%;background:' + _esc(b.couleur) + '"></div></div>'
        + '<div class="disc-tip">' + tipHtml + '</div>'
        + '</div>';
    });
    html += '</div>';
    discListEl.innerHTML = html;
  }

  function _renderHPCResume() {
    const hpcListEl = document.getElementById('dashHPCList');
    if (!hpcListEl) return;
    const hpcs        = DGHData.getHeuresPedaComp();
    const disciplines = DGHData.getDisciplines();
    if (hpcs.length === 0) {
      hpcListEl.innerHTML = '<p class="dash-hpc-empty">Aucune heure complémentaire saisie.<br><button class="btn-link" data-navigate="hpc">Ajouter des heures complémentaires \u2192</button></p>';
      return;
    }
    const LABELS = {}; DGHData.getCategoriesHPC().forEach(c => { LABELS[c.value] = c.label; });
    const discMap = {}; disciplines.forEach(d => { discMap[d.id] = d; });
    let hpcHtml = '<div class="disc-resume-grid">';
    hpcs.forEach(h => {
      const isHSA    = (h.typeHeure||'hp') === 'hsa';
      const catLabel = (LABELS[h.categorie]||h.categorie||'autre').split('(')[0].trim();
      const discNom  = h.disciplineId && discMap[h.disciplineId] ? discMap[h.disciplineId].nom : null;
      hpcHtml += '<div class="disc-resume-row">'
        + '<span class="disc-color-dot" style="background:' + (isHSA ? 'var(--c-indigo)' : 'var(--c-accent)') + '"></span>'
        + '<span class="disc-resume-nom">' + _esc(h.nom||'—') + (discNom ? '<small style="color:var(--c-text-dim);margin-left:.3em">(' + _esc(discNom) + ')</small>' : '') + '</span>'
        + '<span class="disc-resume-h">' + (h.heures||0) + ' h</span>'
        + '<span class="grp-type-badge" style="font-size:.65rem;padding:1px 5px">' + _esc(catLabel) + '</span>'
        + '</div>';
    });
    const bilanHPC = Calculs.bilanHPC(hpcs, disciplines);
    hpcHtml += '<div class="disc-resume-row" style="border-top:1px solid var(--c-border);margin-top:.25rem;padding-top:.35rem">'
      + '<span></span>'
      + '<span class="disc-resume-nom" style="color:var(--c-text-muted);font-size:.78rem">Total (' + hpcs.length + ' entr\u00e9e' + (hpcs.length>1?'s':'') + ')</span>'
      + '<span class="disc-resume-h" style="font-weight:700">' + bilanHPC.totalHeures + ' h</span>'
      + '<span></span>'
      + '</div>';
    hpcHtml += '</div>';
    hpcListEl.innerHTML = hpcHtml;
  }

  // ── BOUTON ÉTABLISSEMENT ──────────────────────────────────────────
  function updateBtnEtab() {
    const btn = document.getElementById('btnEtab'); if (!btn) return;
    try {
      const etab = DGHData.getEtab()||{};
      btn.textContent = (etab.nom && etab.nom.trim()) ? etab.nom.trim() + ' \u2699' : 'Mon Coll\u00e8ge \u2699';
    } catch(e) { btn.textContent = 'Mon Coll\u00e8ge \u2699'; }
  }

  // ── UTILITAIRES LOCAUX (dépendances injectées par app.js) ─────────
  function _set(id, val)  { const el=document.getElementById(id); if(el) el.textContent=val; }
  function _esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return { renderDashboard, updateBtnEtab };

})();
