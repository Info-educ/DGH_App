/**
 * DGH App — Module HPC (Heures Pédagogiques Complémentaires)
 */

const DGHHPC = (() => {

  // ── RENDU PRINCIPAL ───────────────────────────────────────────────
  function renderHPC() {
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
      const discMap   = {}; disciplines.forEach(d => { discMap[d.id]=d; });
      const structMap = {}; structures.forEach(d => { structMap[d.id]=d; });

      let totalHPCHp = 0, totalHPCHsa = 0;
      let html = '<table class="dot-table"><thead><tr><th>Intitulé</th><th>Catégorie</th><th>Discipline</th><th>Classes</th><th class="col-num">H/sem</th><th class="col-num dot-col-hp">Type</th><th class="col-num">Effectif</th><th class="col-actions">Actions</th></tr></thead><tbody>';
      hpcs.forEach(h => {
        const catLabel   = (LABELS[h.categorie]||h.categorie).split('(')[0].trim();
        const discNom    = h.disciplineId && discMap[h.disciplineId] ? discMap[h.disciplineId].nom : '—';
        const classesIds = h.classesIds||[];
        const classesNoms  = classesIds.map(id => structMap[id] ? structMap[id].nom : '?').join(', ') || '—';
        const effectifCalc = classesIds.reduce((s,id) => s+(structMap[id]?structMap[id].effectif||0:0), 0);
        const effectif     = effectifCalc > 0 ? effectifCalc : (h.effectif||0);
        const isHSA = (h.typeHeure||'hp') === 'hsa';
        if (isHSA) totalHPCHsa += h.heures||0; else totalHPCHp += h.heures||0;
        const typeBadge = isHSA
          ? '<button class="dot-col-badge dot-col-hsa hpc-type-toggle" data-action="toggle-hpc-type" data-id="' + h.id + '" title="Cliquer pour passer en HP">\u21c4 HSA</button>'
          : '<button class="dot-col-badge dot-col-hp hpc-type-toggle" data-action="toggle-hpc-type" data-id="' + h.id + '" title="Cliquer pour passer en HSA">\u21c4 HP</button>';
        html += '<tr>'
          + '<td><strong class="div-nom">' + _esc(h.nom||'—') + '</strong>' + (h.commentaire?'<br><span class="grp-comment">'+_esc(h.commentaire)+'</span>':'') + '</td>'
          + '<td><span class="grp-type-badge">' + _esc(catLabel) + '</span></td>'
          + '<td>' + _esc(discNom) + '</td>'
          + '<td><span class="grp-niveaux">' + _esc(classesNoms) + '</span></td>'
          + '<td class="col-num"><strong class="font-mono">' + (h.heures||0) + ' h</strong></td>'
          + '<td class="col-num">' + typeBadge + '</td>'
          + '<td class="col-num">' + effectif + '</td>'
          + '<td class="col-actions"><button class="btn-icon-sm" data-action="edit-hpc" data-id="' + h.id + '" title="Modifier">✎</button><button class="btn-icon-sm btn-icon-danger" data-action="delete-hpc" data-id="' + h.id + '" title="Supprimer">✕</button></td>'
          + '</tr>';
      });
      if (hpcs.length > 0) {
        html += '<tr class="struct-total-row"><td colspan="4"><strong>Total H. péda. complémentaires</strong></td>'
          + '<td class="col-num"><strong class="font-mono">' + Math.round((totalHPCHp+totalHPCHsa)*2)/2 + ' h</strong></td>'
          + '<td class="col-num"><span class="dot-col-badge dot-col-hp" title="HP">' + totalHPCHp + '</span> <span class="dot-col-badge dot-col-hsa" title="HSA">' + totalHPCHsa + '</span></td>'
          + '<td colspan="2"></td></tr>';
      }
      listEl.innerHTML = html + '</tbody></table>';
    } catch(e) { console.error('[DGH] renderHPC:', e); }
  }

  // ── MODAL HPC ─────────────────────────────────────────────────────
  function openModalHPC(id) {
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
    }

    if (id) {
      const h = DGHData.getHPC(id); if (!h) return;
      _set('modalHPCTitle','Modifier');
      _setVal('modalHPCId',id); _setVal('inputHPCNom',h.nom);
      if (selCat)  selCat.value  = h.categorie;
      if (selDisc) selDisc.value = h.disciplineId||'';
      (h.classesIds||[]).forEach(cid => { const cb=classesDiv?.querySelector('[value="'+cid+'"]'); if(cb) cb.checked=true; });
      _setVal('inputHPCHeures',h.heures); _setVal('inputHPCEffectif',h.effectif);
      _setVal('inputHPCComment',h.commentaire||''); _setVal('inputHPCTypeHeure',h.typeHeure||'hp');
    } else {
      _set('modalHPCTitle','Ajouter des heures complémentaires');
      _setVal('modalHPCId',''); _setVal('inputHPCNom',''); _setVal('inputHPCHeures','');
      _setVal('inputHPCEffectif',''); _setVal('inputHPCComment','');
    }

    updateHPCEffectif();
    const btnAll = document.getElementById('btnHPCSelectAll');
    if (btnAll) btnAll.textContent = 'Tout sélectionner';
    modal.classList.add('modal-open');
    setTimeout(()=>document.getElementById('inputHPCNom')?.focus(),60);
  }

  function updateHPCEffectif() {
    const checked = Array.from(document.querySelectorAll('#hpcClassesCheck .hpc-classe-check:checked'));
    const total   = checked.reduce((s,cb) => { const div=DGHData.getDivision(cb.value); return s+(div?div.effectif||0:0); }, 0);
    const efDiv   = document.getElementById('hpcEffectifAuto');
    if (efDiv) efDiv.textContent = checked.length > 0 ? 'Effectif calculé : '+total+' élèves ('+checked.length+' classe(s))' : '';
    if (checked.length > 0) _setVal('inputHPCEffectif', total);
  }

  function hpcSelectAllClasses() {
    const allChecked = Array.from(document.querySelectorAll('#hpcClassesCheck .hpc-classe-check'));
    const anyUnchecked = allChecked.some(cb => !cb.checked);
    allChecked.forEach(cb => { cb.checked = anyUnchecked; });
    updateHPCEffectif();
    const btn = document.getElementById('btnHPCSelectAll');
    if (btn) btn.textContent = anyUnchecked ? 'Tout désélectionner' : 'Tout sélectionner';
  }

  function toggleHPCType(id) {
    const h = DGHData.getHPC(id); if (!h) return;
    const nouveau = (h.typeHeure||'hp') === 'hp' ? 'hsa' : 'hp';
    DGHData.updateHPC(id, { typeHeure: nouveau });
    renderHPC(); DGHDashboard.renderDashboard();
    app.toast(h.nom + ' passé en ' + nouveau.toUpperCase(), 'success', 2000);
  }

  function closeModalHPC() {
    const m=document.getElementById('modalHPC'); if(m) m.classList.remove('modal-open');
  }

  function saveModalHPC() {
    const id  = document.getElementById('modalHPCId')?.value||'';
    const nom = (document.getElementById('inputHPCNom')?.value||'').trim();
    if (!nom) { app.toast('L\'intitulé est requis','warning'); return; }
    const classesIds = Array.from(document.querySelectorAll('#hpcClassesCheck .hpc-classe-check:checked')).map(cb=>cb.value);
    const effectifCalc = classesIds.reduce((s,cid)=>{ const d=DGHData.getDivision(cid); return s+(d?d.effectif||0:0); }, 0);
    const fields = {
      nom,
      categorie:   document.getElementById('inputHPCCategorie')?.value||'autre',
      disciplineId:document.getElementById('inputHPCDisc')?.value||null,
      classesIds,
      heures:      parseFloat(document.getElementById('inputHPCHeures')?.value)||0,
      effectif:    effectifCalc > 0 ? effectifCalc : parseInt(document.getElementById('inputHPCEffectif')?.value,10)||0,
      typeHeure:   document.getElementById('inputHPCTypeHeure')?.value||'hp',
      commentaire: document.getElementById('inputHPCComment')?.value||''
    };
    if (id) { DGHData.updateHPC(id,fields); app.toast('Entrée mise à jour','success'); }
    else    { DGHData.addHPC(fields); app.toast('\u00ab\u00a0'+nom+'\u00a0\u00bb ajouté','success'); }
    closeModalHPC(); renderHPC(); DGHDashboard.renderDashboard();
  }

  function confirmDeleteHPC(id) {
    const h=DGHData.getHPC(id); if(!h) return;
    const m=document.getElementById('confirmHPC'); if(!m) return;
    _set('confirmHPCMsg','Supprimer \u00ab\u00a0'+h.nom+'\u00a0\u00bb ?');
    m.dataset.targetId=id; m.classList.add('modal-open');
  }

  function closeConfirmHPC() {
    const m=document.getElementById('confirmHPC'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';}
  }

  function execDeleteHPC() {
    const id=document.getElementById('confirmHPC')?.dataset?.targetId; if(!id) return;
    DGHData.deleteHPC(id); closeConfirmHPC(); renderHPC(); DGHDashboard.renderDashboard();
    app.toast('Entrée supprimée','info');
  }

  // ── UTILITAIRES LOCAUX ────────────────────────────────────────────
  function _set(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
  function _setVal(id,val){const el=document.getElementById(id);if(el)el.value=val;}
  function _esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  return {
    renderHPC,
    openModalHPC, closeModalHPC, saveModalHPC,
    updateHPCEffectif, hpcSelectAllClasses, toggleHPCType,
    confirmDeleteHPC, closeConfirmHPC, execDeleteHPC
  };

})();
