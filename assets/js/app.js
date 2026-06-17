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
    enseignants: 'Équipe pédagogique',
    repartition: 'Répartition de service',
    scenarios:   'Scénarios',
    pilotage:    'Scénarios',
    edt:         'Contraintes EDT',
    alertes:     'Alertes',
    historique:  'Historique',
    missions:    'PACTE / IMP',
    instances:   'Préparer les instances'
  };

  // ── INIT ─────────────────────────────────────────────────────────
  function init() {
    _applyTheme(localStorage.getItem('dgh-theme') || 'light');
    DGHData.init();
    _bindEvents();
    DGHEnseignants.bindDropZone();
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
  function navigate(viewId, tab) {
    if (!VIEWS[viewId]) return;
    // scenarios est un alias de pilotage (même view HTML)
    const realViewId = viewId === 'scenarios' ? 'pilotage' : viewId;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));
    const viewEl = document.getElementById('view-' + realViewId);
    // Nav : activer l'item exact (avec data-tab si fourni)
    let navEl;
    if (tab) {
      navEl = document.querySelector(`.nav-item[data-view="${viewId}"][data-tab="${tab}"]`);
    }
    if (!navEl) navEl = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    if (viewEl) viewEl.classList.add('active');
    if (navEl)  navEl.classList.add('active');
    const bc = document.getElementById('breadcrumb');
    if (bc) bc.textContent = VIEWS[viewId];
    if (window.innerWidth <= 768) document.getElementById('sidebar')?.classList.remove('open');
    if (realViewId === 'dashboard')  DGHDashboard.renderDashboard();
    if (realViewId === 'alertes')    DGHEtab.renderAlertes();
    if (realViewId === 'dotation')   DGHDotation.renderDotation();
    if (realViewId === 'hpc')        DGHHPC.renderHPC();
    if (realViewId === 'enseignants') DGHEnseignants.renderEnseignants();
    if (realViewId === 'repartition') DGHRepartition.renderRepartition();
    if (realViewId === 'pilotage')    DGHPilotage.renderPilotage();
    if (realViewId === 'edt')         DGHEdt.renderEdt();
    if (realViewId === 'structures')  { DGHStructures.renderStructures(); DGHStructures.renderGroupes(); }
    if (realViewId === 'historique')  DGHHistorique.render();
    if (realViewId === 'missions')    DGHMissions.renderMissions();
    if (viewId === 'instances')       DGHInstances.renderInstances(tab || null);
    // Barre supérieure : rafraîchie sur chaque vue → solde simulé visible partout
    DGHDashboard.renderTopbar();
  }

  // ── EXPORT CSV (Excel FR : séparateur ; · BOM UTF-8 · décimales ,) ──
  function downloadCSV(filename, rows) {
    const cell = v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return String(v).replace('.', ',');
      const s = String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv  = '\ufeff' + rows.map(r => r.map(cell).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      confirmDeleteAnnee: DGHEtab.closeConfirmDeleteAnnee,
      modalEns:           DGHEnseignants.closeModalEns,
      modalCSV:           DGHEnseignants.closeModalCSV,
      confirmEns:         DGHEnseignants.closeConfirmEns,
      confirmEnsAll:      DGHEnseignants.closeConfirmAll,
      modalSelEns:        DGHEnseignants.closeModalSelEns,
      modalMission:       DGHMissions.closeModal,
      confirmMission:     DGHMissions.closeConfirmMission
    };
    if (M[id]) M[id]();
  }

  // ── DÉLÉGATION GLOBALE CLICK ──────────────────────────────────────
  function _onGlobalClick(e) {
    const navItem = e.target.closest('.nav-item[data-view]');
    if (navItem) { navigate(navItem.dataset.view, navItem.dataset.tab || null); return; }
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
      if (action==='edit-ens')        { DGHEnseignants.openModalEns(id);                                                           return; }
      if (action==='delete-ens')      { DGHEnseignants.confirmDeleteEns(id);                                                       return; }
      if (action==='add-ens-disc')    { DGHEnseignants.openModalEnsDisc(actionBtn.dataset.disc);                                   return; }
      if (action==='retirer-ens-disc'){ DGHEnseignants.retirerEnsDisc(id, actionBtn.dataset.disc);                                 return; }
      if (action==='toggle-disc')      { DGHEnseignants.toggleDiscBloc(actionBtn.dataset.disc);                                    return; }
      if (action==='toggle-all-disc')  { DGHEnseignants.toggleAllDiscs(actionBtn.dataset.open==='1');                              return; }
      if (action==='affecter-ens-hpc') { DGHEnseignants.openModalAffecterHPC(actionBtn.dataset.hpcId);                            return; }
      if (action==='retirer-ens-hpc')  { DGHEnseignants.retirerEnsHPC(actionBtn.dataset.hpcId, actionBtn.dataset.ensIdx);           return; }
      if (action==='sel-ens-hpc-direct'){ DGHEnseignants.affecterEnsHPCDirect(actionBtn.dataset.ensId||id);                        return; }
      if (action==='toggle-hpc-cat')    { DGHEnseignants.toggleHPCCat(actionBtn.dataset.cat);                                     return; }
      if (action==='toggle-all-hpc')    { DGHEnseignants.toggleAllHPC(actionBtn.dataset.open==='1');                              return; }
      if (action === 'pil-tab')            { DGHPilotage.switchTab(actionBtn.dataset.tab);           return; }
      if (action === 'edit-scenario')     { DGHPilotage.toggleEditScenario(actionBtn.dataset.id);                                return; }
      if (action === 'delete-mod')        { DGHPilotage.deleteModificateur(actionBtn.dataset.scenId, actionBtn.dataset.modId); return; }
      if (action === 'duplicate-scenario'){ DGHPilotage.dupliquerScenario(actionBtn.dataset.id);                       return; }
      if (action === 'delete-scenario')   { DGHPilotage.confirmDeleteScenario(actionBtn.dataset.id);                   return; }
      if (action === 'set-actif-scenario'){ DGHPilotage.setActif(actionBtn.dataset.id);                                return; }
      if (action === 'save-mc')           { DGHPilotage.saveMultiClasse(actionBtn.dataset.scenId);                     return; }
      if (action === 'mc-sel-niv')        { DGHPilotage.mcSelectNiveau(actionBtn);                                     return; }
      // ── Groupes (Structures) ──
      if (action === 'struct-edit-groupe')   { DGHStructures.editGroupe(id);                        return; }
      if (action === 'struct-save-groupe')   { DGHStructures.saveGroupe(id);                        return; }
      if (action === 'struct-cancel-groupe') { DGHStructures.cancelGroupe();                         return; }
      if (action === 'struct-delete-groupe') { DGHStructures.deleteGroupe(id);                      return; }
      // ── EDT ──
      if (action === 'edt-tab')                  { DGHEdt.switchTab(actionBtn.dataset.tab);         return; }
      if (action === 'edt-import-ded')           { DGHEdt.importerDedoublementBarrette(actionBtn.dataset.scenId, actionBtn.dataset.modId); return; }
      if (action === 'edt-edit-barrette')         { DGHEdt.editBarrette(id);                        return; }
      if (action === 'edt-save-barrette')         { DGHEdt.saveBarrette(id);                        return; }
      if (action === 'edt-cancel-barrette')       { DGHEdt.cancelBarrette();                         return; }
      if (action === 'edt-delete-barrette')       { DGHEdt.deleteBarrette(id);                      return; }
      if (action === 'edt-barr-add-slot')         { DGHEdt.barrAddSlot();                            return; }
      if (action === 'edt-barr-remove-slot')      { DGHEdt.barrRemoveSlot(actionBtn.dataset.slotIdx); return; }
      if (action === 'edt-barr-slot-type-change') { DGHEdt.barrSlotTypeChange();                    return; }
      if (action === 'edt-edit-cointerv')         { DGHEdt.editCoInterv(id);                        return; }
      if (action === 'edt-save-cointerv')         { DGHEdt.saveCoInterv(id);                        return; }
      if (action === 'edt-cancel-cointerv')       { DGHEdt.cancelCoInterv();                         return; }
      if (action === 'edt-delete-cointerv')       { DGHEdt.deleteCoInterv(id);                      return; }
      if (action === 'edt-edit-indispo')          { DGHEdt.editIndispo(id);                         return; }
      if (action === 'edt-save-indispo')          { DGHEdt.saveIndispo(id);                         return; }
      if (action === 'edt-cancel-indispo')        { DGHEdt.cancelIndispo();                          return; }
      if (action === 'edt-delete-indispo')        { DGHEdt.deleteIndispo(id);                       return; }
      if (action === 'edt-edit-clibre')           { DGHEdt.editClibre(id);                          return; }
      if (action === 'edt-save-clibre')           { DGHEdt.saveClibre(id);                          return; }
      if (action === 'edt-cancel-clibre')         { DGHEdt.cancelClibre();                           return; }
      if (action === 'edt-delete-clibre')         { DGHEdt.deleteClibre(id);                        return; }
      // ── Instances ──
      if (action === 'inst-tab')        { DGHInstances.switchTab(actionBtn.dataset.tab); return; }
      if (action === 'inst-projeter')   { DGHInstances.toggleProjection();               return; }
      if (action === 'inst-imprimer')   { DGHInstances.imprimer();                        return; }
      if (action === 'inst-export-csv') { DGHInstances.exporterCSV();                     return; }
      if (action === 'dot-export-csv')  { DGHDotation.exporterCSV();                      return; }
      if (action === 'inst-sort-serv')  { DGHInstances.sortServices(actionBtn.dataset.col); return; }
      // ── Historique ──
      if (action === 'hist-select-gauche')    { DGHHistorique.selectGauche(actionBtn.value || actionBtn.dataset.annee); return; }
      if (action === 'hist-select-droite')    { DGHHistorique.selectDroite(actionBtn.value || actionBtn.dataset.annee); return; }
      if (action === 'hist-figer')            { DGHHistorique.demanderFiger(actionBtn.dataset.annee);            return; }
      if (action === 'hist-del-snapshot')     { DGHHistorique.demanderSupprimerSnapshot(actionBtn.dataset.annee); return; }
      if (action === 'hist-confirm-ok')       { DGHHistorique.confirmerAction();                                   return; }
      if (action === 'hist-confirm-cancel')   { DGHHistorique.annulerConfirm();                                    return; }
      if (action === 'hist-sort')             { DGHHistorique.sortBy(actionBtn.dataset.col);                       return; }
      // ── Missions ──
      if (action === 'edit-mission')          { DGHMissions.openModal(id);                      return; }
      if (action === 'delete-mission')        { DGHMissions.confirmDelete(id);                  return; }
      if (action === 'missions-filtre')       { DGHMissions.filtrer(actionBtn.dataset.filtre);   return; }
      // ── Répartition de service ──
      if (action === 'rep-mode')              { DGHRepartition.setMode(actionBtn.dataset.mode);  return; }
      if (action === 'rep-del-aff')           { DGHRepartition.deleteAff(actionBtn.dataset.id);  return; }
      // ── Salles & Heure bleue (modale établissement, v4.8.0) ──
      if (action === 'salle-add')             { DGHEdt.startAddSalleEdt();                          return; }
      if (action === 'salle-edit')            { DGHEdt.editSalleEdt(id);                            return; }
      if (action === 'salle-save')            { DGHEdt.saveSalleEdt(id);                            return; }
      if (action === 'salle-cancel')          { DGHEdt.cancelSalleEdt();                            return; }
      if (action === 'salle-delete')          { DGHEdt.deleteSalleEdt(id);                          return; }
      if (action === 'hb-add-creneau')        { DGHEdt.hbAddCreneau();                              return; }
      if (action === 'hb-remove-creneau')     { DGHEdt.hbRemoveCreneau(actionBtn.dataset.idx);      return; }
      if (action === 'hb-calculer')           { DGHEdt.hbCalculer();                                return; }
      if (action === 'edt-etab-jour-toggle')  { DGHEdt.etabJourToggle(actionBtn.value, actionBtn.checked); return; }
      if (action === 'edt-etab-mercredi-toggle') { DGHEdt.etabMercrediToggle(actionBtn.checked);    return; }
      if (action === 'edt-etab-horaire')      { DGHEdt.etabHoraireChange(actionBtn.dataset.field, actionBtn.value); return; }
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
    if (e.target.closest('#btnAddScenario'))    { DGHPilotage.startNewScenario();    return; }
    if (e.target.closest('#btnDesactiverScen')) { DGHPilotage.desactiverScenario();  return; }
    if (e.target.closest('#btnAddGroupe'))      { DGHStructures.startAddGroupe();    return; }
    if (e.target.closest('#btnAddBarrette'))    { DGHEdt.startAddBarrette();         return; }
    if (e.target.closest('#btnAddSalleEdt'))    { DGHEdt.startAddSalleEdt();         return; }
    if (e.target.closest('#btnAddCoInterv'))    { DGHEdt.startAddCoInterv();         return; }
    if (e.target.closest('#btnAddIndispo'))     { DGHEdt.startAddIndispo();          return; }
    if (e.target.closest('#btnAddClibre'))      { DGHEdt.startAddClibre();           return; }
    if (e.target.closest('#btnPrintEdt'))       { DGHEdt.printSynthese();            return; }
    if (e.target.closest('#btnAddMission'))     { DGHMissions.openModal(null);         return; }
    if (e.target.closest('#btnAddDiv'))       { DGHStructures.openModalDiv(null);    return; }
    if (e.target.closest('#btnMatrice'))      { DGHStructures.openModalMatrice();     return; }
    if (e.target.closest('#btnAddDisc'))      { DGHDotation.openModalDisc(null);      return; }
    if (e.target.closest('#btnInitDisc'))     { DGHEtab.initDisciplinesMEN();         return; }
    if (e.target.closest('#btnSuggerer'))     { DGHDotation.suggererHP();             return; }
    if (e.target.closest('#btnToggleAllGC'))  { DGHDotation.toggleAllGC();            return; }
    if (e.target.closest('#btnGCSelectAll'))  { DGHDotation.gcSelectAllClasses();     return; }
    if (e.target.closest('#btnAddHPC'))       { DGHHPC.openModalHPC(null);            return; }
    if (e.target.closest('#btnHPCSelectAll')) { DGHHPC.hpcSelectAllClasses();             return; }
    if (e.target.closest('#btnAddEns'))       { DGHEnseignants.openModalEns(null);        return; }
    if (e.target.closest('#btnViderEns'))     { DGHEnseignants.confirmDeleteAll();        return; }
    if (e.target.closest('#btnVueListe'))     { DGHEnseignants.setVueListe();             return; }
    if (e.target.closest('#btnVueDisc'))      { DGHEnseignants.setVueDisc();              return; }
    if (e.target.closest('#btnVueHPC'))       { DGHEnseignants.setVueHPC();               return; }
    if (e.target.closest('#btnImportCSV'))    { DGHEnseignants.openModalCSV();            return; }
    if (e.target.closest('#btnCSVConfirm'))   { DGHEnseignants.confirmImportCSV();        return; }
    if (e.target.closest('#btnEtab'))         { DGHEtab.openModal();                      return; }

    // Fermeture modales par clic overlay
    const overlays = ['modalEtab','modalDiv','modalDisc','modalGC','modalHPC','modalMatrice','confirmDiv','confirmDisc','confirmGC','confirmHPC','confirmReset','confirmDeleteAnnee','modalEns','modalCSV','confirmEns','confirmEnsAll','modalSelEns','modalMission','confirmMission'];
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
    if (e.target.closest('#confirmDeleteAnneeOk'))      { DGHEtab.execDeleteAnnee();             return; }

    if (e.target.closest('#modalEnsClose'))    { DGHEnseignants.closeModalEns();     return; }
    if (e.target.closest('#modalEnsCancel'))   { DGHEnseignants.closeModalEns();     return; }
    if (e.target.closest('#modalEnsSave'))     { DGHEnseignants.saveModalEns();      return; }

    if (e.target.closest('#modalCSVClose'))    { DGHEnseignants.closeModalCSV();     return; }
    if (e.target.closest('#modalCSVCancel'))   { DGHEnseignants.closeModalCSV();     return; }

    if (e.target.closest('#modalSelEnsClose'))    { DGHEnseignants.closeModalSelEns();    return; }
    if (e.target.closest('#modalSelEnsCancel'))   { DGHEnseignants.closeModalSelEns();    return; }
    if (e.target.closest('#btnSelEnsConfirm'))    { DGHEnseignants.confirmerSelEns();     return; }

    if (e.target.closest('#confirmEnsAllCancel'))  { DGHEnseignants.closeConfirmAll(); return; }
    if (e.target.closest('#confirmEnsAllAnnuler')) { DGHEnseignants.closeConfirmAll(); return; }
    if (e.target.closest('#confirmEnsAllOk'))      { DGHEnseignants.execDeleteAll();   return; }

    if (e.target.closest('#confirmEnsCancel')) { DGHEnseignants.closeConfirmEns();   return; }
    if (e.target.closest('#confirmEnsAnnuler')){ DGHEnseignants.closeConfirmEns();   return; }
    if (e.target.closest('#confirmEnsOk'))     { DGHEnseignants.execDeleteEns();     return; }

    if (e.target.closest('#modalMissionClose'))   { DGHMissions.closeModal();               return; }
    if (e.target.closest('#modalMissionCancel'))  { DGHMissions.closeModal();               return; }
    if (e.target.closest('#modalMissionSave'))    { DGHMissions.saveMission();              return; }
    if (e.target.closest('#confirmMissionCancel')){ DGHMissions.closeConfirmMission();      return; }
    if (e.target.closest('#confirmMissionAnnuler')){ DGHMissions.closeConfirmMission();     return; }
    if (e.target.closest('#confirmMissionOk'))    { DGHMissions.execDeleteMission();        return; }

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
    if (e.target.id==='inputHBActif')                     { DGHEdt.hbToggleActif(e.target.checked);    return; }
    if (e.target.classList.contains('classe-check'))      { DGHDotation.updateGCEffectif();           return; }
    if (e.target.classList.contains('hpc-classe-check'))  { DGHHPC.updateHPCEffectif();               return; }
    if (e.target.id==='inputEnsGrade'||e.target.id==='inputEnsOrsManuel'||e.target.id==='inputEnsHeures') { DGHEnseignants.updateOrsPreview(); return; }
    if (e.target.id==='csvFileInput') { DGHEnseignants.handleCSVFile(e.target.files[0]); return; }
    // Edition inline tableau enseignants (selects -> change immediat)
    if (e.target.classList.contains('ens-inline-select')) { DGHEnseignants.handleInlineEdit(e.target); return; }
    if (e.target.classList.contains('ens-inline-num'))    { DGHEnseignants.handleInlineEdit(e.target); return; }
    // H.discipline dans vue par discipline (field heures-disc)
    if (e.target.classList.contains('ens-inline-hdisc'))  { DGHEnseignants.handleInlineEdit(e.target); return; }
    if (e.target.classList.contains('impact-aff-check')) { const d=e.target.dataset; DGHPilotage.saveAffectation(d.ensId,d.modId,d.scenId,'affecte',e.target.checked); return; }
    if (e.target.classList.contains('impact-th-radio'))  { const d=e.target.dataset; DGHPilotage.saveAffectation(d.ensId,d.modId,d.scenId,'typeHeure',e.target.value); return; }
    if (e.target.id === 'recapScenSelect')                { DGHPilotage.setRecapScen(e.target.value);  return; }
    if (e.target.id === 'impactScenSelect')               { DGHPilotage.setImpactScen(e.target.value); return; }
    if (e.target.id === 'edtBarretteDiscs')               { DGHEdt.onBarrDiscChange(); return; }
    if (e.target.dataset.action === 'edt-indispo-plage-change') { DGHEdt.onIndispoPlageChange(); return; }
    if (e.target.id === 'inputMissionHeures')              { DGHMissions.updateHHebdo(); return; }
    if (e.target.id === 'inputMissionEns')                 { DGHMissions.updateEnsInfo(); return; }
    if (e.target.classList.contains('hist-year-sel')) {
      const action = e.target.dataset.action;
      if (action === 'hist-select-gauche') { DGHHistorique.selectGauche(e.target.value); return; }
      if (action === 'hist-select-droite') { DGHHistorique.selectDroite(e.target.value); return; }
    }
    // ── Répartition de service ──
    {
      const ra = e.target.dataset.action;
      if (ra === 'rep-sel-disc')         { DGHRepartition.selectDiscipline(e.target); return; }
      if (ra === 'rep-sel-ens')          { DGHRepartition.selectEnseignant(e.target); return; }
      if (ra === 'rep-add')              { DGHRepartition.addFromSelect(e.target);    return; }
      if (ra === 'rep-add-disc-ens')     { DGHRepartition.addDiscToEns(e.target);     return; }
      if (ra === 'rep-toggle-ens-classe'){ DGHRepartition.toggleEnsClasse(e.target);  return; }
      if (ra === 'rep-aff-h')            { DGHRepartition.setHeures(e.target);        return; }
      if (ra === 'rep-set-pp')           { DGHRepartition.setPP(e.target);            return; }
    }
  }

  // ── DÉLÉGATION GLOBALE DBLCLICK ───────────────────────────────────
  function _onGlobalDblClick(e) {
    if (e.target.classList.contains('grille-input')) { DGHDotation.handleGrilleReset(e.target); }
  }

  // ── DÉLÉGATION GLOBALE BLUR (capture) ────────────────────────────
  function _onGlobalBlur(e) {
    if (e.target.id==='inputEnvHP'||e.target.id==='inputEnvHSA') DGHDotation.saveEnveloppe();
    // Edition inline texte enseignants (blur = sauvegarde)
    if (e.target.classList.contains('ens-inline-input')) { DGHEnseignants.handleInlineEdit(e.target); return; }
    if (e.target.classList.contains('scen-nom-input'))  { DGHPilotage.saveNom(e.target); return; }
    // ── Grille de saisie des modalités ──
    if (e.target.classList.contains('grid-h'))    { DGHPilotage.gridCellH(e.target);    return; }
    if (e.target.classList.contains('grid-type')) { DGHPilotage.gridCellType(e.target); return; }
    if (e.target.classList.contains('grid-th'))   { DGHPilotage.gridCellTH(e.target);   return; }
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

    // ── LOGO ÉTABLISSEMENT ────────────────────────────────────────
    document.addEventListener('click', e => {
      if (e.target.id === 'btnLogoUpload') document.getElementById('fileLogoInput')?.click();
      if (e.target.id === 'btnLogoDelete') _deleteLogo();
    });
    document.getElementById('fileLogoInput')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 200 * 1024) { toast('Image trop lourde (max 200 Ko)', 'warning'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target.result;
        DGHData.setEtab({ logo: b64 });
        _updateLogoPreview(b64);
        toast('Logo enregistré', 'success');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    document.addEventListener('keydown', e => {
      if (e.key==='Escape') {
        ['modalEtab','modalDiv','modalDisc','modalGC','modalHPC','modalMatrice',
         'confirmDiv','confirmDisc','confirmGC','confirmHPC','confirmReset','confirmDeleteAnnee',
         'modalEns','modalCSV','confirmEns','confirmEnsAll','modalSelEns']
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

  function _updateLogoPreview(src) {
    const preview = document.getElementById('logoPreview');
    const previewWrap = document.getElementById('logoPreviewWrap');
    const emptyWrap   = document.getElementById('logoEmptyWrap');
    if (preview && src) { preview.src = src; }
    if (previewWrap) previewWrap.classList.toggle('is-hidden', !src);
    if (emptyWrap)   emptyWrap.classList.toggle('is-hidden', !!src);
  }

  function _deleteLogo() {
    DGHData.setEtab({ logo: null });
    _updateLogoPreview(null);
    toast('Logo supprimé', 'info');
  }

  return { init, navigate, toast, renderAll, renderYearSelect, downloadCSV };

})();

document.addEventListener('DOMContentLoaded', ()=>app.init());
