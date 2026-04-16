/**
 * DGH App — Contrôleur principal v3.2.0
 * Noyau : init, navigation, délégation événements globaux, utilitaires.
 *
 * ARCHITECTURE :
 *   data.js      → couche données (seul fichier qui touche localStorage)
 *   calculs.js   → fonctions pures (zéro DOM, zéro localStorage)
 *   modules/dashboard.js  → DGHDashboard
 *   modules/structures.js → DGHStructures
 *   modules/dotation.js   → DGHDotation
 *   modules/hpc.js        → DGHHPC
 *   modules/etab.js       → DGHEtab
 *   app.js       → ce fichier (chargé en DERNIER)
 *
 * NOTE localStorage : le thème UI est une préférence interface, pas une donnée
 * métier. Il est géré ici directement — exception documentée au SKILL.md.
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
    renderAll();
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
    if (window.innerWidth <= 768) document.getElementById('sidebar')?.classList.remove('open');
    if (viewId === 'dashboard')  DGHDashboard.renderDashboard();
    if (viewId === 'alertes')    DGHEtab.renderAlertes();
    if (viewId === 'structures') DGHStructures.renderStructures();
    if (viewId === 'dotation')   DGHDotation.renderDotation();
    if (viewId === 'hpc')        DGHHPC.renderHPC();
  }

  // ── RENDU GLOBAL ─────────────────────────────────────────────────
  function renderAll() { DGHDashboard.updateBtnEtab(); renderYearSelect(); }

  function renderYearSelect() {
    const sel    = document.getElementById('yearSelect'); if (!sel) return;
    const active = DGHData.getAnneeActive();
    sel.innerHTML='';
    DGHData.getAnnees().forEach(a => {
      const opt=document.createElement('option'); opt.value=a;
      opt.textContent=a.replace('-',' – '); if(a===active) opt.selected=true;
      sel.appendChild(opt);
    });
  }

  // ── FERMETURE MODALE PAR ID ───────────────────────────────────────
  function _closeModalById(id) {
    const M = {
      modalEtab:          DGHEtab.closeModal,
      modalDiv:           DGHStructures.closeModalDiv,
      modalDisc:          DGHDotation.closeModalDisc,
      modalGC:            DGHDotation.closeModalGC,
      modalHPC:           DGHHPC.closeModalHPC,
      modalMatrice:       DGHStructures.closeModalMatrice,
      confirmDiv:         DGHStructures.closeConfirmDiv,
      confirmDisc:        DGHDotation.closeConfirmDisc,
      confirmGC:          DGHDotation.closeConfirmGC,
      confirmHPC:         DGHHPC.closeConfirmHPC,
      confirmReset:       DGHEtab.closeConfirmReset,
      confirmDeleteAnnee: DGHEtab.closeConfirmDeleteAnnee
    };
    if (M[id]) M[id]();
  }

  // ── DÉLÉGATION GLOBALE CLICK ──────────────────────────────────────
  function _onGlobalClick(e) {
    const navItem = e.target.closest('.nav-item[data-view]');
    if (navItem) { navigate(navItem.dataset.view); return; }
    const navBtn = e.target.closest('[data-navigate]');
    if (navBtn)  { navigate(navBtn.dataset.navigate); return; }

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const { action, id, discId, gcId } = actionBtn.dataset;
      if (action==='edit-div')        { DGHStructures.openModalDiv(id);                                                              return; }
      if (action==='delete-div')      { DGHStructures.confirmDeleteDiv(id);                                                         return; }
      if (action==='edit-disc')       { DGHDotation.openModalDisc(id);                                                              return; }
      if (action==='delete-disc')     { DGHDotation.confirmDeleteDisc(id);                                                          return; }
      if (action==='add-gc')          { DGHDotation.openModalGC(discId||actionBtn.dataset.discId, null);                            return; }
      if (action==='edit-gc')         { DGHDotation.openModalGC(discId||actionBtn.dataset.discId, gcId||actionBtn.dataset.gcId);    return; }
      if (action==='delete-gc')       { DGHDotation.confirmDeleteGC(discId||actionBtn.dataset.discId, gcId||actionBtn.dataset.gcId);return; }
      if (action==='edit-hpc')        { DGHHPC.openModalHPC(id);                                                                    return; }
      if (action==='delete-hpc')      { DGHHPC.confirmDeleteHPC(id);                                                                return; }
      if (action==='toggle-hpc-type') { DGHHPC.toggleHPCType(id);                                                                  return; }
      if (action==='ecart-zero')      { DGHDotation.ecartZero(actionBtn.dataset.discId, parseFloat(actionBtn.dataset.besoin)||0); return; }
    }

    // btn-toggle-gc (généré dynamiquement) — délégué ici
    const toggleGCBtn = e.target.closest('.btn-toggle-gc');
    if (toggleGCBtn && toggleGCBtn.dataset.discId) {
      DGHDotation.handleToggleGC(toggleGCBtn.dataset.discId); return;
    }

    // Supprimer une année (liste admin dans modal)
    const btnDeleteAnnee = e.target.closest('.btn-delete-annee');
    if (btnDeleteAnnee) { DGHEtab.openConfirmDeleteAnnee(btnDeleteAnnee.dataset.annee); return; }

    // Onglets internes modal établissement
    const modalTab = e.target.closest('.modal-tab');
    if (modalTab) { DGHEtab.switchModalTab(modalTab.dataset.tab); return; }

    // Boutons statiques
    if (e.target.closest('#btnAddDiv'))       { DGHStructures.openModalDiv(null);    return; }
    if (e.target.closest('#btnMatrice'))      { DGHStructures.openModalMatrice();     return; }
    if (e.target.closest('#btnAddDisc'))      { DGHDotation.openModalDisc(null);      return; }
    if (e.target.closest('#btnInitDisc'))     { DGHEtab.initDisciplinesMEN();         return; }
    if (e.target.closest('#btnSuggerer'))     { DGHDotation.suggererHP();             return; }
    if (e.target.closest('#btnToggleAllGC'))  { DGHDotation.toggleAllGC();            return; }
    if (e.target.closest('#btnGCSelectAll'))  { DGHDotation.gcSelectAllClasses();     return; }
    if (e.target.closest('#btnAddHPC'))       { DGHHPC.openModalHPC(null);            return; }
    if (e.target.closest('#btnHPCSelectAll')) { DGHHPC.hpcSelectAllClasses();         return; }
    if (e.target.closest('#btnEtab'))         { DGHEtab.openModal();                  return; }

    // Fermeture modales par clic overlay
    const overlays = ['modalEtab','modalDiv','modalDisc','modalGC','modalHPC','modalMatrice','confirmDiv','confirmDisc','confirmGC','confirmHPC','confirmReset','confirmDeleteAnnee'];
    for (const oid of overlays) {
      if (e.target === document.getElementById(oid)) { _closeModalById(oid); return; }
    }

    if (e.target.closest('#modalClose'))           { DGHEtab.closeModal();                    return; }
    if (e.target.closest('#modalCancel'))          { DGHEtab.closeModal();                    return; }
    if (e.target.closest('#modalSave'))            { DGHEtab.saveModal();                     return; }
    if (e.target.closest('#btnAddYear'))           { DGHEtab.addModalYear();                  return; }
    if (e.target.closest('#btnResetAnnee'))        { DGHEtab.openConfirmReset();              return; }

    if (e.target.closest('#modalDivClose'))        { DGHStructures.closeModalDiv();           return; }
    if (e.target.closest('#modalDivCancel'))       { DGHStructures.closeModalDiv();           return; }
    if (e.target.closest('#modalDivSave'))         { DGHStructures.saveModalDiv();            return; }

    if (e.target.closest('#modalMatriceClose'))    { DGHStructures.closeModalMatrice();       return; }
    if (e.target.closest('#modalMatriceCancel'))   { DGHStructures.closeModalMatrice();       return; }
    if (e.target.closest('#modalMatriceSave'))     { DGHStructures.saveModalMatrice();        return; }

    if (e.target.closest('#modalDiscClose'))       { DGHDotation.closeModalDisc();            return; }
    if (e.target.closest('#modalDiscCancel'))      { DGHDotation.closeModalDisc();            return; }
    if (e.target.closest('#modalDiscSave'))        { DGHDotation.saveModalDisc();             return; }

    if (e.target.closest('#modalGCClose'))         { DGHDotation.closeModalGC();              return; }
    if (e.target.closest('#modalGCCancel'))        { DGHDotation.closeModalGC();              return; }
    if (e.target.closest('#modalGCSave'))          { DGHDotation.saveModalGC();               return; }

    if (e.target.closest('#modalHPCClose'))        { DGHHPC.closeModalHPC();                  return; }
    if (e.target.closest('#modalHPCCancel'))       { DGHHPC.closeModalHPC();                  return; }
    if (e.target.closest('#modalHPCSave'))         { DGHHPC.saveModalHPC();                   return; }

    if (e.target.closest('#confirmDivCancel'))     { DGHStructures.closeConfirmDiv();         return; }
    if (e.target.closest('#confirmDivAnnuler'))    { DGHStructures.closeConfirmDiv();         return; }
    if (e.target.closest('#confirmDivOk'))         { DGHStructures.execDeleteDiv();           return; }

    if (e.target.closest('#confirmDiscCancel'))    { DGHDotation.closeConfirmDisc();          return; }
    if (e.target.closest('#confirmDiscAnnuler'))   { DGHDotation.closeConfirmDisc();          return; }
    if (e.target.closest('#confirmDiscOk'))        { DGHDotation.execDeleteDisc();            return; }

    if (e.target.closest('#confirmGCCancel'))      { DGHDotation.closeConfirmGC();            return; }
    if (e.target.closest('#confirmGCAnnuler'))     { DGHDotation.closeConfirmGC();            return; }
    if (e.target.closest('#confirmGCOk'))          { DGHDotation.execDeleteGC();              return; }

    if (e.target.closest('#confirmHPCCancel'))     { DGHHPC.closeConfirmHPC();                return; }
    if (e.target.closest('#confirmHPCAnnuler'))    { DGHHPC.closeConfirmHPC();                return; }
    if (e.target.closest('#confirmHPCOk'))         { DGHHPC.execDeleteHPC();                  return; }

    if (e.target.closest('#confirmResetCancel'))   { DGHEtab.closeConfirmReset();             return; }
    if (e.target.closest('#confirmResetAnnuler'))  { DGHEtab.closeConfirmReset();             return; }
    if (e.target.closest('#confirmResetOk'))       { DGHEtab.execResetAnnee();                return; }

    if (e.target.closest('#confirmDeleteAnneeCancel'))  { DGHEtab.closeConfirmDeleteAnnee();  return; }
    if (e.target.closest('#confirmDeleteAnneeAnnuler')) { DGHEtab.closeConfirmDeleteAnnee();  return; }
    if (e.target.closest('#confirmDeleteAnneeOk'))      { DGHEtab.execDeleteAnnee();           return; }

    // Sidebar mobile
    if (window.innerWidth <= 768) {
      const sb=document.getElementById('sidebar'), mb=document.getElementById('mobileMenuBtn');
      if (sb && mb && !sb.contains(e.target) && !mb.contains(e.target)) sb.classList.remove('open');
    }
  }

  // ── DÉLÉGATION GLOBALE CHANGE ─────────────────────────────────────
  function _onGlobalChange(e) {
    if (e.target.classList.contains('dot-input-h'))       { DGHDotation.handleDotInput(e.target);   return; }
    if (e.target.classList.contains('grille-input'))      { DGHDotation.handleGrilleInput(e.target); return; }
    if (e.target.id==='inputEnvHP'||e.target.id==='inputEnvHSA') { DGHDotation.saveEnveloppe();     return; }
    if (e.target.id==='modalYearSelect')                  { DGHEtab.onModalYearChange(e.target.value); return; }
    if (e.target.classList.contains('classe-check'))      { DGHDotation.updateGCEffectif();           return; }
    if (e.target.classList.contains('hpc-classe-check'))  { DGHHPC.updateHPCEffectif();               return; }
  }

  // ── DÉLÉGATION GLOBALE DBLCLICK ───────────────────────────────────
  function _onGlobalDblClick(e) {
    if (e.target.classList.contains('grille-input')) { DGHDotation.handleGrilleReset(e.target); }
  }

  // ── DÉLÉGATION GLOBALE BLUR (capture) ────────────────────────────
  function _onGlobalBlur(e) {
    if (e.target.id==='inputEnvHP'||e.target.id==='inputEnvHSA') DGHDotation.saveEnveloppe();
  }

  // ── EVENTS ───────────────────────────────────────────────────────
  function _bindEvents() {
    document.addEventListener('click',    _onGlobalClick);
    document.addEventListener('change',   _onGlobalChange);
    document.addEventListener('dblclick', _onGlobalDblClick);
    document.addEventListener('blur',     _onGlobalBlur, true);

    document.addEventListener('input', e => {
      if (e.target.id==='inputDivNom'||e.target.id==='inputDivDup') DGHStructures.updateDupPreview();
      if (e.target.id==='inputDiscCouleur') DGHDotation.updateColorHint(e.target.value);
      if (e.target.id==='inputDGH_HP'||e.target.id==='inputDGH_HSA') DGHEtab.updateModalDotTotal();
    });

    // Éléments garantis dans le DOM au chargement initial (SKILL.md §3)
    document.getElementById('themeToggle').addEventListener('click', () => {
      const cur=document.documentElement.getAttribute('data-theme')||'light';
      _applyTheme(cur==='dark'?'light':'dark');
    });
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
    document.getElementById('yearSelect').addEventListener('change', e => {
      DGHData.setAnneeActive(e.target.value); renderAll(); DGHDashboard.renderDashboard();
      const active=document.querySelector('.nav-item.active[data-view]');
      if (active) {
        if (active.dataset.view==='structures') DGHStructures.renderStructures();
        if (active.dataset.view==='dotation')   DGHDotation.renderDotation();
        if (active.dataset.view==='hpc')        DGHHPC.renderHPC();
      }
      toast('Année '+e.target.value.replace('-','–')+' chargée','info');
    });
    document.getElementById('btnExport').addEventListener('click', () => {
      try{toast('Exporté : '+DGHData.exportJSON(),'success');}catch(e){toast('Erreur export : '+e.message,'error');}
    });
    const fileImport=document.getElementById('fileImport');
    document.getElementById('btnImport').addEventListener('click', ()=>fileImport.click());
    document.getElementById('btnImportEmpty').addEventListener('click', ()=>fileImport.click());
    fileImport.addEventListener('change', async e => {
      const file=e.target.files[0]; if(!file) return;
      try {
        const r=await DGHData.importJSON(file);
        renderAll(); DGHDashboard.renderDashboard();
        toast('Importé — '+(r.etablissement||'?'),'success');
      } catch(err) { toast('Erreur : '+err.message,'error',5000); }
      fileImport.value='';
    });
    document.addEventListener('dgh:storage-error', ()=>toast('Erreur de sauvegarde locale','error',6000));

    document.addEventListener('keydown', e => {
      if (e.key==='Escape') {
        ['modalEtab','modalDiv','modalDisc','modalGC','modalHPC','modalMatrice',
         'confirmDiv','confirmDisc','confirmGC','confirmHPC','confirmReset','confirmDeleteAnnee']
          .forEach(id => { if(document.getElementById(id)?.classList.contains('modal-open')) _closeModalById(id); });
      }
    });
    document.addEventListener('keydown', e => {
      if (e.target.id==='inputNewYear'&&e.key==='Enter') { e.preventDefault(); DGHEtab.addModalYear(); }
    });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey||e.metaKey)&&e.key==='s') {
        e.preventDefault();
        try{toast('Exporté : '+DGHData.exportJSON(),'success');}catch(err){toast('Erreur export','error');}
      }
    });

    // ── TOOLTIPS FLOTTANTS ────────────────────────────────────────
    function _positionTip(tipEl, rect) {
      const GAP=10, M=12;
      const tw=tipEl.offsetWidth||220, th=tipEl.offsetHeight||160;
      const vw=window.innerWidth, vh=window.innerHeight;
      let left=rect.left+rect.width/2-tw/2;
      left=Math.max(M, Math.min(left, vw-tw-M));
      let top=rect.bottom+GAP;
      if (top+th+M>vh) top=rect.top-th-GAP;
      if (top<M) top=M;
      tipEl.style.left=left+'px'; tipEl.style.top=top+'px';
    }
    const kpiTip=document.getElementById('kpiFloatTip');
    if (kpiTip) {
      document.querySelectorAll('.kpi-tooltip-card').forEach(card => {
        const src=card.querySelector('.kpi-tooltip');
        card.addEventListener('mouseenter', () => {
          if (!src||!src.innerHTML) return;
          kpiTip.innerHTML=src.innerHTML; kpiTip.style.display='block';
          _positionTip(kpiTip, card.getBoundingClientRect());
        });
        card.addEventListener('mouseleave', () => { kpiTip.style.display='none'; });
        card.addEventListener('mousemove',  () => { if (kpiTip.style.display==='block') _positionTip(kpiTip, card.getBoundingClientRect()); });
      });
    }
    const discTip=document.getElementById('discFloatTip');
    if (discTip) {
      // Délégation robuste : mouseenter/mouseleave ne bubblent pas aux enfants
      // On écoute mouseover/mouseout mais on ne réagit que si le wrap change
      let _activeWrap = null;
      document.addEventListener('mouseover', e => {
        const wrap = e.target.closest('.disc-tip-wrap');
        if (wrap === _activeWrap) return; // déjà sur ce wrap, ne rien faire
        _activeWrap = wrap;
        if (!wrap) { discTip.style.display='none'; return; }
        const src = wrap.querySelector('.disc-tip');
        if (!src || !src.innerHTML) return;
        discTip.innerHTML = src.innerHTML;
        discTip.style.display = 'block';
        _positionTip(discTip, wrap.getBoundingClientRect());
      });
      document.addEventListener('mousemove', e => {
        if (_activeWrap && discTip.style.display==='block') {
          _positionTip(discTip, _activeWrap.getBoundingClientRect());
        }
      });
      document.addEventListener('mouseout', e => {
        if (!_activeWrap) return;
        const to = e.relatedTarget;
        if (!to || !_activeWrap.contains(to)) {
          _activeWrap = null;
          discTip.style.display = 'none';
        }
      });
    }
  }

  // ── TOAST ────────────────────────────────────────────────────────
  function toast(msg, type, duration) {
    type=type||'info'; duration=duration||3500;
    const ICONS={success:'✓',error:'✕',warning:'⚠',info:'ℹ'};
    const c=document.getElementById('toastContainer'); if(!c) return;
    const el=document.createElement('div'); el.className='toast '+type;
    el.innerHTML='<span class="toast-icon">'+(ICONS[type]||'ℹ')+'</span><span>'+msg+'</span>';
    c.appendChild(el);
    setTimeout(()=>{ el.style.cssText+='opacity:0;transform:translateX(10px);transition:.2s ease;'; setTimeout(()=>el.remove(),200); }, duration);
  }

  return { init, navigate, toast, renderAll, renderYearSelect };

})();

document.addEventListener('DOMContentLoaded', ()=>app.init());
