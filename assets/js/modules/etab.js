/**
 * DGH App — Module Établissement & Administration
 * Modal établissement, gestion années, alertes, init disciplines MEN.
 */

const DGHEtab = (() => {

  // ── MODAL ÉTABLISSEMENT ───────────────────────────────────────────
  function openModal() {
    try {
      const etab = DGHData.getEtab()||{};
      const ann  = DGHData.getAnnee()||{};
      const dot  = ann.dotation||{};
      const m    = document.getElementById('modalEtab'); if (!m) return;
      _setVal('inputNomEtab',etab.nom||''); _setVal('inputUAI',etab.uai||''); _setVal('inputAcademie',etab.academie||'');
      _setVal('inputDGH_HP',  dot.hPosteEnveloppe != null ? dot.hPosteEnveloppe : '');
      _setVal('inputDGH_HSA', dot.hsaEnveloppe    != null ? dot.hsaEnveloppe    : '');
      updateModalDotTotal();
      renderModalYearSelect(); renderYearListAdmin();
      switchModalTab('etab');
      m.classList.add('modal-open');
      setTimeout(()=>document.getElementById('inputNomEtab')?.focus(),60);
    } catch(e) { console.error('[DGH] modal etab:', e); app.toast('Impossible d\'ouvrir les paramètres','error'); }
  }

  function closeModal() {
    const m=document.getElementById('modalEtab'); if(m) m.classList.remove('modal-open');
  }

  function saveModal() {
    try {
      const ms = document.getElementById('modalYearSelect');
      if (ms && ms.value && ms.value !== DGHData.getAnneeActive()) DGHData.setAnneeActive(ms.value);
      DGHData.setEtab({
        nom:      document.getElementById('inputNomEtab')?.value?.trim()||'',
        uai:      document.getElementById('inputUAI')?.value?.trim()||'',
        academie: document.getElementById('inputAcademie')?.value?.trim()||''
      });
      DGHData.setDotation(
        parseFloat(document.getElementById('inputDGH_HP')?.value)||0,
        parseFloat(document.getElementById('inputDGH_HSA')?.value)||0
      );
      closeModal(); app.renderAll(); DGHDashboard.renderDashboard();
      app.toast('Paramètres enregistrés','success');
    } catch(e) { console.error('[DGH] save modal:', e); app.toast('Erreur lors de la sauvegarde','error'); }
  }

  function updateModalDotTotal() {
    const hp  = parseFloat(document.getElementById('inputDGH_HP')?.value)||0;
    const hsa = parseFloat(document.getElementById('inputDGH_HSA')?.value)||0;
    const el  = document.getElementById('modalDotTotal');
    if (el) el.textContent = (hp+hsa) > 0 ? 'Total : ' + (hp+hsa) + ' h (HP + HSA)' : '';
  }

  // ── ONGLETS MODAL ─────────────────────────────────────────────────
  function switchModalTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.modal-tab-panel').forEach(p => {
      p.classList.toggle('is-hidden', p.id !== 'tab-' + tab);
    });
  }

  // ── GESTION ANNÉES ────────────────────────────────────────────────
  function renderModalYearSelect() {
    const sel    = document.getElementById('modalYearSelect'); if (!sel) return;
    const active = DGHData.getAnneeActive();
    sel.innerHTML = '';
    DGHData.getAnnees().forEach(a => {
      const opt=document.createElement('option'); opt.value=a;
      opt.textContent=a.replace('-',' – '); if(a===active) opt.selected=true;
      sel.appendChild(opt);
    });
  }

  function renderYearListAdmin() {
    const zone   = document.getElementById('yearListAdmin'); if (!zone) return;
    const active = DGHData.getAnneeActive();
    const annees = DGHData.getAnnees();
    if (annees.length <= 1) { zone.innerHTML=''; return; }
    zone.innerHTML = '<div class="year-list-admin-title">Supprimer une année</div>'
      + annees.map(a =>
          '<div class="year-admin-row">'
          + '<span class="year-admin-label'+(a===active?' year-admin-active':'')+'">'+a.replace('-',' – ')+(a===active?' ★ active':'')+'</span>'
          + (a===active?'':'<button class="btn-danger btn-sm btn-delete-annee" data-annee="'+a+'">Supprimer</button>')
          + '</div>'
        ).join('');
  }

  function addModalYear() {
    const input = document.getElementById('inputNewYear'); if (!input) return;
    const val   = input.value.trim();
    if (!/^\d{4}-\d{4}$/.test(val)) { app.toast('Format requis : 2026-2027','warning'); input.focus(); return; }
    const [debut,fin] = val.split('-').map(Number);
    if (fin !== debut+1) { app.toast('Les deux années doivent se suivre','warning'); input.focus(); return; }
    if (DGHData.getAnnees().includes(val)) {
      app.toast('Cette année existe déjà','info');
      const s=document.getElementById('modalYearSelect'); if(s) s.value=val;
      input.value=''; return;
    }
    DGHData.setAnneeActive(val); input.value='';
    renderModalYearSelect(); app.renderYearSelect(); renderYearListAdmin();
    app.toast('Année '+val.replace('-','–')+' créée','success');
  }

  function onModalYearChange(val) {
    DGHData.setAnneeActive(val);
    const dot=DGHData.getAnnee().dotation||{};
    const inpHP  = document.getElementById('inputDGH_HP');
    const inpHSA = document.getElementById('inputDGH_HSA');
    if (inpHP)  inpHP.value  = dot.hPosteEnveloppe!=null?dot.hPosteEnveloppe:'';
    if (inpHSA) inpHSA.value = dot.hsaEnveloppe!=null?dot.hsaEnveloppe:'';
    updateModalDotTotal(); app.renderYearSelect(); renderYearListAdmin();
  }

  // ── CONFIRMER RESET ANNÉE ─────────────────────────────────────────
  function openConfirmReset() {
    const m=document.getElementById('confirmReset'); if(!m) return;
    _set('confirmResetMsg','Réinitialiser toutes les données de l\'année '+DGHData.getAnneeActive().replace('-','–')+' ?');
    m.classList.add('modal-open');
  }

  function closeConfirmReset() {
    const m=document.getElementById('confirmReset'); if(m) m.classList.remove('modal-open');
  }

  function execResetAnnee() {
    const a=DGHData.getAnneeActive();
    DGHData.resetAnnee(); closeConfirmReset(); closeModal();
    app.renderAll(); DGHDashboard.renderDashboard();
    app.toast('Année '+a.replace('-','–')+' réinitialisée','info');
  }

  // ── CONFIRMER SUPPRESSION ANNÉE ───────────────────────────────────
  function openConfirmDeleteAnnee(annee) {
    const m=document.getElementById('confirmDeleteAnnee'); if(!m) return;
    _set('confirmDeleteAnneeMsg','Supprimer définitivement l\'année '+annee.replace('-','–')+' ?');
    m.dataset.targetAnnee=annee; m.classList.add('modal-open');
  }

  function closeConfirmDeleteAnnee() {
    const m=document.getElementById('confirmDeleteAnnee');
    if(m){m.classList.remove('modal-open');m.dataset.targetAnnee='';}
  }

  function execDeleteAnnee() {
    const annee=document.getElementById('confirmDeleteAnnee')?.dataset?.targetAnnee;
    if(!annee) return;
    const res=DGHData.deleteAnnee(annee);
    if(!res.ok){app.toast(res.message,'warning');closeConfirmDeleteAnnee();return;}
    closeConfirmDeleteAnnee(); closeModal();
    app.renderAll(); DGHDashboard.renderDashboard();
    app.toast('Année '+annee.replace('-','–')+' supprimée','info');
  }

  // ── ALERTES ──────────────────────────────────────────────────────
  function renderAlertes() {
    try {
      const alertes = Calculs.genererAlertes(DGHData.getAnnee());
      const zone    = document.getElementById('alertes-zone'); if (!zone) return;
      zone.className='section-card';
      zone.innerHTML='<div class="alertes-list">'
        +(alertes.length
          ? alertes.map(a=>'<div class="alerte-item sev-'+a.severite+'"><span class="alerte-dot">'+({error:'✕',warning:'⚠',info:'ℹ'}[a.severite]||'·')+'</span><span class="alerte-msg">'+_esc(a.message)+'</span></div>').join('')
          : '<div class="alertes-empty">✓ Aucune alerte — tout est en ordre.</div>')
        +'</div>';
    } catch(e) { console.error('[DGH] renderAlertes:', e); }
  }

  // ── INIT DISCIPLINES MEN ─────────────────────────────────────────
  function initDisciplinesMEN() {
    const nb = DGHData.initDisciplinesMEN();
    DGHDotation.renderDotation(); DGHDashboard.renderDashboard();
    app.toast(nb > 0 ? nb+' disciplines MEN ajoutées' : 'Toutes les disciplines MEN sont déjà présentes', nb > 0 ? 'success' : 'info');
  }

  // ── UTILITAIRES LOCAUX ────────────────────────────────────────────
  function _set(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
  function _setVal(id,val){const el=document.getElementById(id);if(el)el.value=val;}
  function _esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  return {
    openModal, closeModal, saveModal, updateModalDotTotal,
    switchModalTab,
    renderModalYearSelect, renderYearListAdmin, addModalYear, onModalYearChange,
    openConfirmReset, closeConfirmReset, execResetAnnee,
    openConfirmDeleteAnnee, closeConfirmDeleteAnnee, execDeleteAnnee,
    renderAlertes, initDisciplinesMEN
  };

})();
