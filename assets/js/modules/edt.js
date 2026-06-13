/**
 * DGH App — Module Contraintes EDT v2.0.0 (Sprint 11 / v3.8)
 *
 * Onglets : Barrettes · Co-interventions · Fiche synthèse
 * Les indisponibilités ont été retirées (gérées directement dans Index Education).
 * Les barrettes utilisent le référentiel Groupes défini dans le module Structures.
 *
 * Règles SKILL.md :
 *   - Zéro addEventListener sur éléments dynamiques
 *   - Zéro localStorage → uniquement DGHData.*
 *   - Zéro inline style.color / font-family
 *   - API publique via return {}
 */

const DGHEdt = (() => {

  let _tab = 'barrettes';
  let _editBarretteId  = null;
  let _editCoIntervId  = null;

  // ── RENDU PRINCIPAL ────────────────────────────────────────────────
  function renderEdt() {
    try {
      _renderHeaderActions();
      if      (_tab === 'barrettes') _renderBarrettes();
      else if (_tab === 'cointerv')  _renderCoInterv();
      else if (_tab === 'synthese')  _renderSynthese();
    } catch(e) { console.error('[DGHEdt] renderEdt:', e); }
  }

  function switchTab(tab) {
    _tab = tab;
    document.querySelectorAll('#edtTabs .pil-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('#view-edt .pil-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'edt-panel-' + tab);
    });
    renderEdt();
  }

  function _renderHeaderActions() {
    const el = document.getElementById('edtHeaderActions');
    if (!el) return;
    if (_tab === 'barrettes') {
      el.innerHTML = '<button class="btn-primary" id="btnAddBarrette">+ Nouvelle barrette</button>';
    } else if (_tab === 'cointerv') {
      el.innerHTML = '<button class="btn-primary" id="btnAddCoInterv">+ Nouvelle co-intervention</button>';
    } else if (_tab === 'synthese') {
      el.innerHTML = '<button class="btn-secondary" id="btnPrintEdt">⎙ Imprimer</button>';
    } else {
      el.innerHTML = '';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 1 — BARRETTES (schéma slots[] + référentiel Groupes)
  // ══════════════════════════════════════════════════════════════════

  function _renderBarrettes() {
    const el = document.getElementById('edtBarrettesWrap');
    if (!el) return;
    const barrettes   = DGHData.getBarrettes();
    const structures  = DGHData.getStructures();
    const groupes     = DGHData.getGroupes();
    const enseignants = DGHData.getEnseignants();
    const disciplines = DGHData.getDisciplines();
    const repartition = DGHData.getRepartition();

    const formHtml = _editBarretteId
      ? _htmlFormBarrette(structures, groupes, enseignants, disciplines, repartition,
          barrettes.find(b => b.id === _editBarretteId) || null)
      : '';

    let listHtml = '';
    if (barrettes.length === 0 && !_editBarretteId) {
      listHtml = '<div class="edt-empty">'
        + '<p>Aucune barrette définie.</p>'
        + '<p class="edt-empty-hint">Une barrette regroupe des cours simultanés — classes entières ou groupes dédoublés.</p>'
        + '</div>';
    } else {
      listHtml = _htmlListeBarrettes(barrettes, structures, groupes, enseignants, disciplines);
    }
    el.innerHTML = formHtml + listHtml;
  }

  // ── Formulaire barrette ────────────────────────────────────────────
  function _htmlFormBarrette(structures, groupes, enseignants, disciplines, repartition, editData) {
    const nom     = editData?.nom          || '';
    const comment = editData?.commentaire  || '';
    const discIds = editData?.disciplineIds || [];
    const slots   = editData?.slots         || [];

    const discOptions = disciplines.map(d =>
      '<option value="' + d.id + '"' + (discIds.includes(d.id) ? ' selected' : '') + '>' + _esc(d.nom) + '</option>'
    ).join('');

    const slotsHtml = slots.length === 0
      ? '<p class="edt-barr-slots-empty">Aucun cours ajouté — cliquez sur <strong>+ Ajouter un cours</strong>.</p>'
      : slots.map((s, i) => _htmlSlot(s, i, structures, groupes, enseignants, disciplines, repartition, discIds)).join('');

    const saveAttr = editData ? ' data-id="' + editData.id + '"' : '';

    return '<div class="edt-form" id="edtBarretteForm">'
      + '<div class="edt-form-title">' + (editData ? 'Modifier la barrette' : 'Nouvelle barrette') + '</div>'
      + '<div class="edt-barr-row2">'
        + '<div class="edt-form-field"><label>Nom de la barrette</label>'
          + '<input type="text" id="edtBarretteNom" value="' + _esc(nom) + '" placeholder="Ex : SVT/PC — 4e" /></div>'
        + '<div class="edt-form-field"><label>Commentaire (optionnel)</label>'
          + '<input type="text" id="edtBarretteComment" value="' + _esc(comment) + '" placeholder="Précisions…" /></div>'
      + '</div>'
      + '<div class="edt-form-field edt-barr-disc-field">'
        + '<label>Disciplines concernées <span class="edt-form-hint">(Ctrl+clic pour plusieurs)</span></label>'
        + '<select multiple id="edtBarretteDiscs" class="edt-select-multi" size="4">' + discOptions + '</select>'
      + '</div>'
      + '<div class="edt-barr-slots-header">'
        + '<span class="edt-barr-slots-title">Cours en parallèle</span>'
        + '<button class="btn-secondary edt-barr-add-slot-btn" data-action="edt-barr-add-slot">+ Ajouter un cours</button>'
      + '</div>'
      + '<div class="edt-barr-slots-wrap" id="edtBarretteSlotsWrap">' + slotsHtml + '</div>'
      + '<div class="edt-form-actions">'
        + '<button class="btn-primary" data-action="edt-save-barrette"' + saveAttr + '>Enregistrer ✓</button>'
        + '<button class="btn-secondary" data-action="edt-cancel-barrette">Annuler</button>'
      + '</div>'
    + '</div>';
  }

  function _htmlSlot(slot, idx, structures, groupes, enseignants, disciplines, repartition, discIds) {
    const typeVal = slot.type || 'classe';
    const refVal  = slot.ref  || '';

    // Calculer les classes liées aux disciplines sélectionnées (pour "suggérées")
    const classesLiees = new Set();
    if (discIds.length > 0) {
      repartition.forEach(r => {
        if (discIds.includes(r.disciplineId)) {
          (r.groupesCours || []).forEach(gc => (gc.classesIds || []).forEach(cid => classesLiees.add(cid)));
        }
      });
    }

    // Options selon le type de slot
    let refHtml = '';
    if (typeVal === 'libre') {
      refHtml = '<div class="edt-form-field"><label>Nom du groupe</label>'
        + '<input type="text" class="edt-slot-nom-libre" data-slot-idx="' + idx + '" value="'
        + _esc(slot.nomLibre || '') + '" placeholder="Ex : Gr.1 3eA" /></div>';
    } else if (typeVal === 'groupe') {
      // Groupes du référentiel Structures, filtrés sur les disciplines si possible
      const gpLies   = discIds.length > 0 ? groupes.filter(g => g.disciplineIds?.some(d => discIds.includes(d))) : [];
      const gpAutres = groupes.filter(g => !gpLies.includes(g));
      let opts = '';
      if (gpLies.length)   opts += '<optgroup label="— Liés aux disciplines —">'   + gpLies.map(g   => '<option value="' + g.id + '"' + (refVal===g.id?' selected':'') + '>' + _esc(g.nom) + ' (' + _gpClasses(g,structures) + ')' + '</option>').join('') + '</optgroup>';
      if (gpAutres.length) opts += '<optgroup label="— Autres groupes —">'         + gpAutres.map(g => '<option value="' + g.id + '"' + (refVal===g.id?' selected':'') + '>' + _esc(g.nom) + ' (' + _gpClasses(g,structures) + ')' + '</option>').join('') + '</optgroup>';
      if (!opts) opts = '<option value="">— Aucun groupe défini dans Structures —</option>';
      refHtml = '<div class="edt-form-field"><label>Groupe (référentiel)</label>'
        + '<select class="edt-slot-ref-sel" data-slot-idx="' + idx + '">' + opts + '</select></div>';
    } else {
      // classe
      const suggOpts  = structures.filter(s => classesLiees.has(s.id)).map(s => '<option value="' + s.id + '"' + (refVal===s.id?' selected':'') + '>' + _esc(s.nom) + '</option>').join('');
      const autreOpts = structures.filter(s => !classesLiees.has(s.id)).map(s => '<option value="' + s.id + '"' + (refVal===s.id?' selected':'') + '>' + _esc(s.nom) + '</option>').join('');
      let opts = '';
      if (suggOpts)  opts += '<optgroup label="— Suggérées —">' + suggOpts + '</optgroup>';
      if (autreOpts) opts += '<optgroup label="— Autres classes —">' + autreOpts + '</optgroup>';
      if (!opts) opts = '<option value="">— Aucune classe —</option>';
      refHtml = '<div class="edt-form-field"><label>Classe</label>'
        + '<select class="edt-slot-ref-sel" data-slot-idx="' + idx + '">' + opts + '</select></div>';
    }

    // Enseignants — filtrés sur disciplines si possible
    const ensLies   = discIds.length > 0
      ? enseignants.filter(e => (e.disciplines||[]).some(d => { const dd = disciplines.find(ddd => ddd.nom===d.discNom); return dd && discIds.includes(dd.id); }))
      : [];
    const ensAutres = enseignants.filter(e => !ensLies.includes(e));
    let ensOpts = '';
    if (ensLies.length)   ensOpts += '<optgroup label="— Liés aux disciplines —">'  + ensLies.map(e   => '<option value="' + e.id + '"' + ((slot.ensIds||[]).includes(e.id)?' selected':'') + '>' + _esc(_ensNomCourt(e)) + '</option>').join('') + '</optgroup>';
    if (ensAutres.length) ensOpts += '<optgroup label="— Autres enseignants —">'    + ensAutres.map(e => '<option value="' + e.id + '"' + ((slot.ensIds||[]).includes(e.id)?' selected':'') + '>' + _esc(_ensNomCourt(e)) + '</option>').join('') + '</optgroup>';
    if (!ensOpts) ensOpts = '<option value="">— Aucun enseignant —</option>';

    return '<div class="edt-slot-card" data-slot-idx="' + idx + '">'
      + '<div class="edt-slot-card-header">'
        + '<span class="edt-slot-num">Cours ' + (idx+1) + '</span>'
        + '<button class="btn-icon btn-icon-danger" data-action="edt-barr-remove-slot" data-slot-idx="' + idx + '" title="Retirer">✕</button>'
      + '</div>'
      + '<div class="edt-slot-fields">'
        + '<div class="edt-form-field"><label>Type</label>'
          + '<select class="edt-slot-type-sel" data-action="edt-barr-slot-type-change" data-slot-idx="' + idx + '">'
            + '<option value="classe"' + (typeVal==='classe'?' selected':'') + '>Classe entière</option>'
            + '<option value="groupe"' + (typeVal==='groupe'?' selected':'') + '>Groupe (référentiel)</option>'
            + '<option value="libre"'  + (typeVal==='libre' ?' selected':'') + '>Groupe libre</option>'
          + '</select>'
        + '</div>'
        + refHtml
        + '<div class="edt-form-field"><label>Enseignant(s) <span class="edt-form-hint">(Ctrl+clic)</span></label>'
          + '<select multiple class="edt-slot-ens-sel edt-select-multi" data-slot-idx="' + idx + '" size="3">' + ensOpts + '</select>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  // ── Lecture du formulaire ──────────────────────────────────────────
  function _readFormBarrette() {
    const formEl = document.getElementById('edtBarretteForm');
    if (!formEl) return null;
    const nom     = document.getElementById('edtBarretteNom')?.value.trim()     || '';
    const comment = document.getElementById('edtBarretteComment')?.value.trim() || '';
    const discSel = document.getElementById('edtBarretteDiscs');
    const discIds = discSel ? Array.from(discSel.selectedOptions).map(o => o.value) : [];
    const slotCards = formEl.querySelectorAll('.edt-slot-card');
    const slots = Array.from(slotCards).map(card => {
      const type     = card.querySelector('.edt-slot-type-sel')?.value || 'classe';
      const ref      = card.querySelector('.edt-slot-ref-sel')?.value  || '';
      const nomLibre = card.querySelector('.edt-slot-nom-libre')?.value.trim() || '';
      const ensIds   = Array.from(card.querySelectorAll('.edt-slot-ens-sel option:checked')).map(o => o.value);
      return { type, ref: type !== 'libre' ? ref : null, nomLibre: type === 'libre' ? nomLibre : '', ensIds };
    });
    return { nom, disciplineIds: discIds, slots, commentaire: comment };
  }

  function _refreshSlotsOnly() {
    const wrap = document.getElementById('edtBarretteSlotsWrap');
    if (!wrap) return;
    const fs  = _readFormBarrette();
    if (!fs)  return;
    const structures  = DGHData.getStructures();
    const groupes     = DGHData.getGroupes();
    const enseignants = DGHData.getEnseignants();
    const disciplines = DGHData.getDisciplines();
    const repartition = DGHData.getRepartition();
    if (fs.slots.length === 0) {
      wrap.innerHTML = '<p class="edt-barr-slots-empty">Aucun cours ajouté — cliquez sur <strong>+ Ajouter un cours</strong>.</p>';
    } else {
      wrap.innerHTML = fs.slots.map((s,i) => _htmlSlot(s, i, structures, groupes, enseignants, disciplines, repartition, fs.disciplineIds)).join('');
    }
  }

  // ── Actions formulaire ─────────────────────────────────────────────
  function startAddBarrette()  { _editBarretteId = '__new__'; _renderBarrettes(); document.getElementById('edtBarretteNom')?.focus(); }
  function editBarrette(id)    { _editBarretteId = id;        _renderBarrettes(); document.getElementById('edtBarretteNom')?.focus(); }
  function cancelBarrette()    { _editBarretteId = null;      _renderBarrettes(); }
  function onBarrDiscChange()  { _refreshSlotsOnly(); }

  function barrAddSlot() {
    const fs = _readFormBarrette();
    if (!fs) return;
    fs.slots.push({ type: 'classe', ref: '', nomLibre: '', ensIds: [] });
    const wrap = document.getElementById('edtBarretteSlotsWrap');
    if (!wrap) return;
    const structures  = DGHData.getStructures();
    const groupes     = DGHData.getGroupes();
    const enseignants = DGHData.getEnseignants();
    const disciplines = DGHData.getDisciplines();
    const repartition = DGHData.getRepartition();
    wrap.innerHTML = fs.slots.map((s,i) => _htmlSlot(s,i,structures,groupes,enseignants,disciplines,repartition,fs.disciplineIds)).join('');
  }

  function barrRemoveSlot(idx) {
    const fs = _readFormBarrette();
    if (!fs) return;
    fs.slots.splice(parseInt(idx), 1);
    const wrap = document.getElementById('edtBarretteSlotsWrap');
    if (!wrap) return;
    const structures  = DGHData.getStructures();
    const groupes     = DGHData.getGroupes();
    const enseignants = DGHData.getEnseignants();
    const disciplines = DGHData.getDisciplines();
    const repartition = DGHData.getRepartition();
    wrap.innerHTML = fs.slots.length === 0
      ? '<p class="edt-barr-slots-empty">Aucun cours ajouté — cliquez sur <strong>+ Ajouter un cours</strong>.</p>'
      : fs.slots.map((s,i) => _htmlSlot(s,i,structures,groupes,enseignants,disciplines,repartition,fs.disciplineIds)).join('');
  }

  function barrSlotTypeChange() { _refreshSlotsOnly(); }

  function saveBarrette(id) {
    const fs = _readFormBarrette();
    if (!fs) return;
    if (fs.slots.length === 0) { app.toast('Ajoutez au moins un cours.', 'warning'); return; }
    for (let i = 0; i < fs.slots.length; i++) {
      const s = fs.slots[i];
      if (s.type !== 'libre' && !s.ref)      { app.toast('Sélectionnez une classe/groupe pour le cours ' + (i+1) + '.', 'warning'); return; }
      if (s.type === 'libre' && !s.nomLibre) { app.toast('Saisissez le nom du groupe libre pour le cours ' + (i+1) + '.', 'warning'); return; }
    }
    if (!fs.nom) {
      const disciplines = DGHData.getDisciplines();
      fs.nom = fs.disciplineIds.map(did => disciplines.find(d => d.id === did)?.nom || '?').join('/') || 'Barrette';
    }
    if (id && id !== '__new__') { DGHData.updateBarrette(id, fs); app.toast('Barrette mise à jour.', 'success'); }
    else                        { DGHData.addBarrette(fs);        app.toast('Barrette ajoutée.', 'success'); }
    _editBarretteId = null;
    _renderBarrettes();
  }

  function deleteBarrette(id) {
    if (!confirm('Supprimer cette barrette ?')) return;
    DGHData.deleteBarrette(id);
    _renderBarrettes();
    app.toast('Barrette supprimée.', 'info');
  }

  // ── Liste des barrettes ────────────────────────────────────────────
  function _htmlListeBarrettes(barrettes, structures, groupes, enseignants, disciplines) {
    const visible = barrettes.filter(b => b.id !== _editBarretteId);
    if (visible.length === 0) return '';
    return '<div class="edt-barrette-list">' + visible.map(b => {
      const discNoms = (b.disciplineIds||[]).map(did => disciplines.find(d=>d.id===did)?.nom||'?').join(' / ') || '—';
      const slots    = b.slots || [];
      let tableHtml  = '';
      if (slots.length > 0) {
        const ths = slots.map((_,i) => '<th>Cours ' + (i+1) + '</th>').join('');
        const cls = slots.map(s => '<td class="edt-slot-cell-classe">' + _esc(_slotLabel(s, structures, groupes)) + '</td>').join('');
        const ens = slots.map(s => '<td class="edt-slot-cell-ens">'
          + ((s.ensIds||[]).map(eid => { const e = enseignants.find(en=>en.id===eid); return e ? (e.prenom?e.prenom[0]+'. ':'')+e.nom : '?'; }).join(', ') || '—')
          + '</td>').join('');
        tableHtml = '<div class="edt-barr-slots-table-wrap"><table class="edt-barr-slots-table">'
          + '<thead><tr>' + ths + '</tr></thead>'
          + '<tbody><tr>' + cls + '</tr><tr>' + ens + '</tr></tbody>'
          + '</table></div>';
      } else {
        tableHtml = '<div class="edt-barrette-body"><span class="edt-synth-aucune">Aucun cours.</span></div>';
      }
      return '<div class="edt-barrette-card">'
        + '<div class="edt-barrette-header">'
          + '<span class="edt-barrette-nom">' + _esc(b.nom||discNoms) + '</span>'
          + '<span class="edt-barr-disc-tag">' + _esc(discNoms) + '</span>'
          + '<div class="edt-card-actions">'
            + '<button class="btn-icon" data-action="edt-edit-barrette" data-id="' + b.id + '" title="Modifier">✎</button>'
            + '<button class="btn-icon btn-icon-danger" data-action="edt-delete-barrette" data-id="' + b.id + '" title="Supprimer">✕</button>'
          + '</div>'
        + '</div>'
        + tableHtml
        + (b.commentaire ? '<div class="edt-barrette-body edt-barrette-comment">' + _esc(b.commentaire) + '</div>' : '')
      + '</div>';
    }).join('') + '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 2 — CO-INTERVENTIONS
  // ══════════════════════════════════════════════════════════════════
  function _renderCoInterv() {
    const el = document.getElementById('edtCoIntervWrap');
    if (!el) return;
    const coIntervs   = DGHData.getCoInterventions();
    const structures  = DGHData.getStructures();
    const enseignants = DGHData.getEnseignants();
    const formHtml = _editCoIntervId
      ? _htmlFormCoInterv(structures, enseignants, coIntervs.find(ci => ci.id === _editCoIntervId) || null)
      : '';
    let listHtml = '';
    if (coIntervs.length === 0 && !_editCoIntervId) {
      listHtml = '<div class="edt-empty"><p>Aucune co-intervention définie.</p>'
        + '<p class="edt-empty-hint">Renseignez les enseignants qui doivent être libérés simultanément — co-enseignement, inclusion, aide spécialisée…</p></div>';
    } else {
      listHtml = '<div class="edt-barrette-list">' + coIntervs.filter(ci => ci.id !== _editCoIntervId).map(ci => {
        const ensNoms = (ci.ensIds||[]).map(id => { const e=enseignants.find(en=>en.id===id); return e?_ensNomCourt(e):'?'; }).join(' + ') || '—';
        const clsNoms = (ci.classeIds||[]).map(id => structures.find(s=>s.id===id)?.nom||'?').join(', ') || '';
        return '<div class="edt-barrette-card">'
          + '<div class="edt-barrette-header">'
            + '<span class="edt-barrette-nom">' + _esc(ci.nom || ensNoms) + '</span>'
            + '<div class="edt-card-actions">'
              + '<button class="btn-icon" data-action="edt-edit-cointerv" data-id="' + ci.id + '" title="Modifier">✎</button>'
              + '<button class="btn-icon btn-icon-danger" data-action="edt-delete-cointerv" data-id="' + ci.id + '" title="Supprimer">✕</button>'
            + '</div>'
          + '</div>'
          + '<div class="edt-barrette-body">'
            + '<div class="edt-barrette-row"><span class="edt-barrette-lbl">Enseignants</span><span class="edt-barrette-val">' + _esc(ensNoms) + '</span></div>'
            + (clsNoms ? '<div class="edt-barrette-row"><span class="edt-barrette-lbl">Classes</span><span class="edt-barrette-val">' + _esc(clsNoms) + '</span></div>' : '')
            + (ci.commentaire ? '<div class="edt-barrette-row edt-barrette-comment">' + _esc(ci.commentaire) + '</div>' : '')
          + '</div>'
        + '</div>';
      }).join('') + '</div>';
    }
    el.innerHTML = formHtml + listHtml;
  }

  function _htmlFormCoInterv(structures, enseignants, editData) {
    const nom     = editData?.nom || '';
    const comment = editData?.commentaire || '';
    const ensSel  = new Set(editData?.ensIds    || []);
    const clsSel  = new Set(editData?.classeIds || []);
    const ensHtml = enseignants.length === 0
      ? '<span class="edt-empty-hint">Aucun enseignant.</span>'
      : enseignants.map(e => '<label class="mod-classe-label"><input type="checkbox" class="edt-coint-ens-check" value="' + e.id + '"' + (ensSel.has(e.id)?' checked':'') + '> '
          + _esc(_ensNomCourt(e)) + '<span class="edt-ens-disc-label"> ' + _esc(e.disciplinePrincipale||'') + '</span></label>').join('');
    const parNiv  = {};
    structures.forEach(s => { if (!parNiv[s.niveau]) parNiv[s.niveau]=[]; parNiv[s.niveau].push(s); });
    const niveauxOrd = ['6e','5e','4e','3e','SEGPA','ULIS','UPE2A'];
    const clsHtml = niveauxOrd.filter(n => parNiv[n]?.length).map(niv =>
      '<div class="edt-form-niv"><span class="edt-form-niv-label">' + niv + '</span>'
        + parNiv[niv].map(s => '<label class="mod-classe-label"><input type="checkbox" class="edt-coint-classe-check" value="' + s.id + '"' + (clsSel.has(s.id)?' checked':'') + '> ' + _esc(s.nom) + '</label>').join('')
      + '</div>').join('') || '<span class="edt-empty-hint">Aucune classe.</span>';
    const saveAttr = editData ? ' data-id="' + editData.id + '"' : '';
    return '<div class="edt-form" id="edtCoIntervForm">'
      + '<div class="edt-form-title">' + (editData ? 'Modifier la co-intervention' : 'Nouvelle co-intervention') + '</div>'
      + '<div class="edt-form-grid">'
        + '<div class="edt-form-col">'
          + '<div class="edt-form-field"><label>Intitulé (optionnel)</label><input type="text" id="edtCoIntervNom" value="' + _esc(nom) + '" placeholder="Ex : Co-ens. inclusion 5eA" /></div>'
          + '<div class="edt-form-field"><label>Enseignants à libérer ensemble <span class="edt-form-req">*</span></label><div class="edt-check-list">' + ensHtml + '</div></div>'
          + '<div class="edt-form-field"><label>Commentaire</label><input type="text" id="edtCoIntervComment" value="' + _esc(comment) + '" placeholder="Précisions" /></div>'
        + '</div>'
        + '<div class="edt-form-col">'
          + '<div class="edt-form-field"><label>Classes concernées (optionnel)</label><div class="edt-check-list">' + clsHtml + '</div></div>'
        + '</div>'
      + '</div>'
      + '<div class="edt-form-actions">'
        + '<button class="btn-primary" data-action="edt-save-cointerv"' + saveAttr + '>Enregistrer ✓</button>'
        + '<button class="btn-secondary" data-action="edt-cancel-cointerv">Annuler</button>'
      + '</div>'
    + '</div>';
  }

  function startAddCoInterv()  { _editCoIntervId = '__new__'; _renderCoInterv(); document.getElementById('edtCoIntervNom')?.focus(); }
  function editCoInterv(id)    { _editCoIntervId = id;        _renderCoInterv(); }
  function cancelCoInterv()    { _editCoIntervId = null;      _renderCoInterv(); }

  function saveCoInterv(id) {
    const nom     = document.getElementById('edtCoIntervNom')?.value.trim()     || '';
    const comment = document.getElementById('edtCoIntervComment')?.value.trim() || '';
    const ensIds    = Array.from(document.querySelectorAll('.edt-coint-ens-check:checked')).map(c => c.value);
    const classeIds = Array.from(document.querySelectorAll('.edt-coint-classe-check:checked')).map(c => c.value);
    if (ensIds.length < 2) { app.toast('Sélectionnez au moins 2 enseignants.', 'warning'); return; }
    const fields = { nom, ensIds, classeIds, commentaire: comment };
    if (id && id !== '__new__') { DGHData.updateCoIntervention(id, fields); app.toast('Co-intervention mise à jour.', 'success'); }
    else                        { DGHData.addCoIntervention(fields);        app.toast('Co-intervention ajoutée.', 'success'); }
    _editCoIntervId = null;
    _renderCoInterv();
  }

  function deleteCoInterv(id) {
    if (!confirm('Supprimer cette co-intervention ?')) return;
    DGHData.deleteCoIntervention(id);
    _renderCoInterv();
    app.toast('Co-intervention supprimée.', 'info');
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 3 — FICHE SYNTHÈSE
  // ══════════════════════════════════════════════════════════════════
  function _renderSynthese() {
    const el = document.getElementById('edtSyntheseWrap');
    if (!el) return;
    const barrettes   = DGHData.getBarrettes();
    const coIntervs   = DGHData.getCoInterventions();
    const enseignants = DGHData.getEnseignants();
    const structures  = DGHData.getStructures();
    const groupes     = DGHData.getGroupes();
    const disciplines = DGHData.getDisciplines();
    const etab        = DGHData.getEtab();
    const annee       = DGHData.getAnneeActive();
    if (enseignants.length === 0 && barrettes.length === 0) {
      el.innerHTML = '<div class="edt-empty"><p>Aucune donnée pour la synthèse.</p></div>'; return;
    }
    const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    let html = '<div class="edt-synthese" id="edtSyntheseContent">'
      + '<div class="edt-synthese-entete"><strong>' + _esc(etab.nom||'Établissement') + '</strong>'
        + ' — Contraintes EDT · ' + _esc(annee.replace('-','–')) + ' · ' + date + '</div>';

    // Section barrettes
    if (barrettes.length > 0) {
      html += '<h3 class="edt-synth-h3">Barrettes (' + barrettes.length + ')</h3>';
      barrettes.forEach(b => {
        const slots = b.slots || [];
        const ths = slots.map((_,i) => '<th>Cours '+(i+1)+'</th>').join('');
        const cls = slots.map(s => '<td class="edt-slot-cell-classe">' + _esc(_slotLabel(s,structures,groupes)) + '</td>').join('');
        const ens = slots.map(s => '<td class="edt-slot-cell-ens">'
          + ((s.ensIds||[]).map(eid=>{const e=enseignants.find(en=>en.id===eid);return e?_ensNomCourt(e):'?';}).join(', ')||'—')
          + '</td>').join('');
        html += '<div class="edt-synth-fiche">'
          + '<div class="edt-synth-fiche-header"><span class="edt-synth-nom">' + _esc(b.nom||'Barrette') + '</span>'
            + (b.disciplineIds?.length ? '<span class="edt-synth-meta">' + _esc(b.disciplineIds.map(did=>disciplines.find(d=>d.id===did)?.nom||'?').join(' / ')) + '</span>' : '')
          + '</div>'
          + '<div class="edt-barr-slots-table-wrap"><table class="edt-barr-slots-table"><thead><tr>' + ths + '</tr></thead>'
            + '<tbody><tr>' + cls + '</tr><tr>' + ens + '</tr></tbody></table></div>'
          + (b.commentaire ? '<div class="edt-barrette-body edt-barrette-comment">' + _esc(b.commentaire) + '</div>' : '')
        + '</div>';
      });
    }

    // Section co-interventions
    if (coIntervs.length > 0) {
      html += '<h3 class="edt-synth-h3">Co-interventions (' + coIntervs.length + ')</h3>';
      coIntervs.forEach(ci => {
        const ensNoms = (ci.ensIds||[]).map(id=>{const e=enseignants.find(en=>en.id===id);return e?_ensNomCourt(e):'?';}).join(' + ')||'—';
        const clsNoms = (ci.classeIds||[]).map(id=>structures.find(s=>s.id===id)?.nom||'?').join(', ')||'—';
        html += '<div class="edt-synth-fiche">'
          + '<div class="edt-synth-fiche-header"><span class="edt-synth-nom">' + _esc(ci.nom||ensNoms) + '</span></div>'
          + '<div class="edt-barrette-body">'
            + '<div class="edt-barrette-row"><span class="edt-barrette-lbl">Enseignants</span><span class="edt-barrette-val">' + _esc(ensNoms) + '</span></div>'
            + '<div class="edt-barrette-row"><span class="edt-barrette-lbl">Classes</span><span class="edt-barrette-val">' + _esc(clsNoms) + '</span></div>'
          + '</div>'
        + '</div>';
      });
    }

    html += '</div>';
    el.innerHTML = html;
  }

  function printSynthese() { window.print(); }

  // ── UTILITAIRES ────────────────────────────────────────────────────
  function _slotLabel(slot, structures, groupes) {
    if (slot.type === 'libre')  return slot.nomLibre || '?';
    if (slot.type === 'groupe') return groupes.find(g => g.id === slot.ref)?.nom || '?';
    return structures.find(s => s.id === slot.ref)?.nom || '?';
  }

  function _gpClasses(groupe, structures) {
    return (groupe.classeIds||[]).map(id => structures.find(s=>s.id===id)?.nom||'?').join('+') || '?';
  }

  function _ensNomCourt(e) {
    return (e.prenom ? e.prenom[0] + '. ' : '') + e.nom;
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── API PUBLIQUE ───────────────────────────────────────────────────
  return {
    renderEdt, switchTab,
    startAddBarrette, editBarrette, cancelBarrette, saveBarrette, deleteBarrette,
    onBarrDiscChange, barrAddSlot, barrRemoveSlot, barrSlotTypeChange,
    startAddCoInterv, editCoInterv, cancelCoInterv, saveCoInterv, deleteCoInterv,
    printSynthese
  };

})();
