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
      _setVal('inputEnvPacte', etab.enveloppePacte != null ? etab.enveloppePacte : '');
      _setVal('inputEnvImp',   etab.enveloppeImp   != null ? etab.enveloppeImp   : '');
      // Logo
      const preview    = document.getElementById('logoPreview');
      const prevWrap   = document.getElementById('logoPreviewWrap');
      const emptyWrap  = document.getElementById('logoEmptyWrap');
      if (preview && etab.logo)  { preview.src = etab.logo; }
      if (prevWrap)  prevWrap.classList.toggle('is-hidden',  !etab.logo);
      if (emptyWrap) emptyWrap.classList.toggle('is-hidden', !!etab.logo);
      updateModalDotTotal();
      renderModalYearSelect(); renderYearListAdmin();
      renderSalles(); renderHeuresBleues();
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
        nom:            document.getElementById('inputNomEtab')?.value?.trim()||'',
        uai:            document.getElementById('inputUAI')?.value?.trim()||'',
        academie:       document.getElementById('inputAcademie')?.value?.trim()||'',
        enveloppePacte: parseFloat(document.getElementById('inputEnvPacte')?.value)||0,
        enveloppeImp:   parseFloat(document.getElementById('inputEnvImp')?.value)||0
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

  // ── SALLES SPÉCIALISÉES (v4.8.0) ──────────────────────────────────
  let _editSalleId = null;

  function renderSalles() {
    const el = document.getElementById('salleListWrap');
    if (!el) return;
    const salles = DGHData.getSalles();
    const types  = DGHData.getTypesSalle();
    const typeLabel = t => (types.find(x => x.value === t) || {}).label || t;

    const formHtml = _editSalleId
      ? _htmlFormSalle(types, salles.find(s => s.id === _editSalleId) || null)
      : '';

    let listHtml = '';
    const visibles = salles.filter(s => s.id !== _editSalleId);
    if (visibles.length === 0 && !_editSalleId) {
      listHtml = '<p class="form-hint">Aucune salle spécialisée renseignée — labo SVT, Physique, Musique, Arts, Techno…</p>';
    } else if (visibles.length > 0) {
      listHtml = '<div class="salle-list">' + visibles.map(s =>
        '<div class="salle-row">'
          + '<span class="salle-row-nom">' + _esc(s.nom || typeLabel(s.type)) + '</span>'
          + '<span class="salle-row-type">' + _esc(typeLabel(s.type)) + '</span>'
          + '<span class="salle-row-nb">×' + (s.nb || 1) + '</span>'
          + '<div class="edt-card-actions">'
            + '<button class="btn-icon" data-action="salle-edit" data-id="' + s.id + '" title="Modifier">✎</button>'
            + '<button class="btn-icon btn-icon-danger" data-action="salle-delete" data-id="' + s.id + '" title="Supprimer">✕</button>'
          + '</div>'
        + '</div>'
      ).join('') + '</div>';
    }
    el.innerHTML = '<div class="salle-header-row"><span class="modal-section-title">Salles spécialisées</span>'
      + (_editSalleId ? '' : '<button class="btn-secondary btn-sm" data-action="salle-add">+ Ajouter</button>')
      + '</div>' + formHtml + listHtml;
  }

  function _htmlFormSalle(types, editData) {
    const nom = editData?.nom || '';
    const typ = editData?.type || 'svt';
    const nb  = editData?.nb != null ? editData.nb : 1;
    const opts = types.map(t => '<option value="' + t.value + '"' + (typ===t.value?' selected':'') + '>' + _esc(t.label) + '</option>').join('');
    const saveAttr = editData ? ' data-id="' + editData.id + '"' : '';
    return '<div class="edt-form salle-form">'
      + '<div class="form-row-3">'
        + '<div class="form-group"><label>Nom</label><input type="text" id="inputSalleNom" value="' + _esc(nom) + '" placeholder="Ex : Labo SVT 1" /></div>'
        + '<div class="form-group"><label>Type</label><select id="inputSalleType">' + opts + '</select></div>'
        + '<div class="form-group"><label>Exemplaires disponibles</label><input type="number" id="inputSalleNb" value="' + nb + '" min="1" step="1" /></div>'
      + '</div>'
      + '<div class="edt-form-actions">'
        + '<button class="btn-primary btn-sm" data-action="salle-save"' + saveAttr + '>Enregistrer ✓</button>'
        + '<button class="btn-secondary btn-sm" data-action="salle-cancel">Annuler</button>'
      + '</div>'
    + '</div>';
  }

  function startAddSalle()  { _editSalleId = '__new__'; renderSalles(); document.getElementById('inputSalleNom')?.focus(); }
  function editSalle(id)    { _editSalleId = id;        renderSalles(); document.getElementById('inputSalleNom')?.focus(); }
  function cancelSalle()    { _editSalleId = null;      renderSalles(); }

  function saveSalle(id) {
    const nom  = document.getElementById('inputSalleNom')?.value.trim() || '';
    const type = document.getElementById('inputSalleType')?.value || 'svt';
    const nb   = parseInt(document.getElementById('inputSalleNb')?.value, 10) || 1;
    const fields = { nom, type, nb };
    if (id && id !== '__new__') { DGHData.updateSalle(id, fields); app.toast('Salle mise à jour.', 'success'); }
    else                        { DGHData.addSalle(fields);        app.toast('Salle ajoutée.', 'success'); }
    _editSalleId = null;
    renderSalles();
  }

  function deleteSalle(id) {
    if (!confirm('Supprimer cette salle ?')) return;
    DGHData.deleteSalle(id);
    renderSalles();
    app.toast('Salle supprimée.', 'info');
  }

  // ── HEURE BLEUE — recommandation de créneau optimal (v4.8.0) ──────
  function renderHeuresBleues() {
    const el = document.getElementById('heureBleueWrap');
    if (!el) return;
    const hb   = DGHData.getHeuresBleues();
    const jours = DGHData.getJoursSemaine();
    const creneaux = hb.creneaux || [];

    const joursOpts = jours.map(j => '<option value="' + j.value + '">' + _esc(j.label) + '</option>').join('');
    const creneauxHtml = creneaux.map((c, i) =>
      '<div class="hb-creneau-row">'
        + '<span class="hb-creneau-label">' + _esc((jours.find(j=>j.value===c.jour)||{}).label || c.jour) + ' ' + _esc(c.debut) + '–' + _esc(c.fin) + '</span>'
        + '<button class="btn-icon btn-icon-danger" data-action="hb-remove-creneau" data-idx="' + i + '" title="Retirer">✕</button>'
      + '</div>'
    ).join('') || '<p class="form-hint">Ajoutez 1 à 4 créneaux candidats — l\'application recommandera le meilleur.</p>';

    el.innerHTML = '<div class="modal-section-title modal-section-sep">Heure bleue <span class="form-hint">— créneau de réunion commun</span></div>'
      + '<label class="hb-actif-label"><input type="checkbox" id="inputHBActif"' + (hb.actif ? ' checked' : '') + '> Activer la recherche de créneau bleu</label>'
      + '<div class="hb-creneaux-add">'
        + '<select id="inputHBJour">' + joursOpts + '</select>'
        + '<input type="time" id="inputHBDebut" value="12:00" />'
        + '<input type="time" id="inputHBFin" value="13:00" />'
        + '<button class="btn-secondary btn-sm" data-action="hb-add-creneau">+ Ajouter ce créneau</button>'
      + '</div>'
      + '<div class="hb-creneaux-list">' + creneauxHtml + '</div>'
      + '<button class="btn-primary btn-sm" data-action="hb-calculer" ' + (creneaux.length===0?'disabled':'') + '>Calculer le créneau optimal</button>'
      + '<div id="hbResultatWrap"></div>';
  }

  function hbAddCreneau() {
    const jour  = document.getElementById('inputHBJour')?.value || 'lun';
    const debut = document.getElementById('inputHBDebut')?.value || '';
    const fin   = document.getElementById('inputHBFin')?.value   || '';
    if (!debut || !fin || debut >= fin) { app.toast('Créneau invalide.', 'warning'); return; }
    const hb = DGHData.getHeuresBleues();
    const creneaux = (hb.creneaux || []).slice();
    if (creneaux.length >= 4) { app.toast('Maximum 4 créneaux candidats.', 'warning'); return; }
    creneaux.push({ jour, debut, fin });
    DGHData.setHeuresBleues({ creneaux });
    renderHeuresBleues();
  }

  function hbRemoveCreneau(idx) {
    const hb = DGHData.getHeuresBleues();
    const creneaux = (hb.creneaux || []).slice();
    creneaux.splice(parseInt(idx, 10), 1);
    DGHData.setHeuresBleues({ creneaux });
    renderHeuresBleues();
  }

  function hbToggleActif(checked) {
    DGHData.setHeuresBleues({ actif: !!checked });
  }

  function hbCalculer() {
    try {
      const hb = DGHData.getHeuresBleues();
      const ann = DGHData.getAnnee();
      const enseignants = DGHData.getEnseignants();
      const contraintesEDT = DGHData.getContraintesEDT();
      const resultats = Calculs.creneauBleuOptimal(
        enseignants, contraintesEDT.indisponibilites || [], contraintesEDT.contraintesLibres || [], hb.creneaux || []
      );
      const wrap = document.getElementById('hbResultatWrap');
      if (!wrap) return;
      if (resultats.length === 0) { wrap.innerHTML = '<p class="form-hint">Ajoutez au moins un créneau candidat.</p>'; return; }
      const ICONES = { optimal: '★ Optimal', correct: 'Correct', deconseille: 'Déconseillé' };
      wrap.innerHTML = '<table class="hb-result-table"><thead><tr>'
        + '<th>Créneau</th><th>Disponibles</th><th>Indispo. dures</th><th>Vœux à éviter</th><th>Recommandation</th>'
        + '</tr></thead><tbody>' + resultats.map(r =>
          '<tr class="hb-row-' + r.recommandation + '">'
            + '<td>' + _esc(r.jourLabel) + ' ' + _esc(r.debut) + '–' + _esc(r.fin) + '</td>'
            + '<td>' + r.nbDisponibles + '/' + r.nbTotal + '</td>'
            + '<td>' + r.indisponiblesDurs.length + (r.indisponiblesDurs.length ? ' <span class="hb-detail" title="' + _esc(r.indisponiblesDurs.map(x=>x.nom).join(', ')) + '">ⓘ</span>' : '') + '</td>'
            + '<td>' + r.voeuxSouples.length + '</td>'
            + '<td class="hb-reco-cell">' + ICONES[r.recommandation] + '</td>'
          + '</tr>'
        ).join('') + '</tbody></table>'
        + '<p class="form-hint hb-limite-hint">Recommandation basée uniquement sur les contraintes saisies dans l\'application — elle ne connaît pas les cours déjà posés dans Index Éducation.</p>';
    } catch(e) { console.error('[DGH] hbCalculer:', e); app.toast('Erreur lors du calcul.', 'error'); }
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
    renderAlertes, initDisciplinesMEN,
    renderSalles, startAddSalle, editSalle, cancelSalle, saveSalle, deleteSalle,
    renderHeuresBleues, hbAddCreneau, hbRemoveCreneau, hbToggleActif, hbCalculer
  };

})();
