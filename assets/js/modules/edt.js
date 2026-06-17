/**
 * DGH App — Module Contraintes EDT v4.9.0 (Sprint 15)
 *
 * Onglets :
 *   1. Barrettes (fréquence hebdo/A/B par cours)
 *   2. Co-interventions
 *   3. Indisponibilités & contraintes libres (enseignants)
 *   4. Contraintes établissement (organisation semaine, salles, heure bleue)
 *   5. Notice EDT (synthèse consolidée + alertes)
 *
 * Salles spécialisées et heure bleue déplacées depuis la modale Établissement
 * vers l'onglet "Contraintes établissement" (Sprint 15).
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
  let _editIndispoId   = null;
  let _editClibreId    = null;
  let _editSalleId     = null;   // géré dans cet onglet (déplacé depuis DGHEtab)
  let _prefillData     = null;   // données de pré-remplissage depuis un scénario (Sprint 17)

  const FREQ_LABEL  = { hebdo: 'Hebdo', 'semaine-A': 'Sem.\u00a0A', 'semaine-B': 'Sem.\u00a0B' };
  const JOUR_LABEL  = { lun:'Lundi', mar:'Mardi', mer:'Mercredi', jeu:'Jeudi', ven:'Vendredi' };
  const PLAGE_LABEL = { matin:'Matin', aprem:'Après-midi', journee:'Journée entière', creneau:'Créneau précis' };
  const JOURS_ALL   = ['lun','mar','mer','jeu','ven'];

  // ── RENDU PRINCIPAL ────────────────────────────────────────────────
  function renderEdt() {
    try {
      _renderHeaderActions();
      if      (_tab === 'barrettes') _renderBarrettes();
      else if (_tab === 'cointerv')  _renderCoInterv();
      else if (_tab === 'indispos')  _renderIndispos();
      else if (_tab === 'etab')      _renderContraintesEtab();
      else if (_tab === 'notice')    _renderSynthese();
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
    } else if (_tab === 'indispos') {
      el.innerHTML = '<button class="btn-primary" id="btnAddIndispo">+ Indisponibilité</button>'
        + '<button class="btn-secondary" id="btnAddClibre">+ Contrainte libre</button>';
    } else if (_tab === 'etab') {
      el.innerHTML = '<button class="btn-primary" id="btnAddSalleEdt">+ Ajouter une salle</button>';
    } else if (_tab === 'notice') {
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
    const anneeData   = DGHData.getAnnee();

    // Résoudre l'editData : soit une barrette existante, soit les données de pré-remplissage
    let editData = null;
    if (_editBarretteId && _editBarretteId !== '__new__') {
      editData = barrettes.find(b => b.id === _editBarretteId) || null;
    } else if (_editBarretteId === '__new__' && _prefillData) {
      editData = _prefillData;  // pré-remplissage depuis scénario — pas d'id → pas de data-id
    }

    const formHtml = _editBarretteId
      ? _htmlFormBarrette(structures, groupes, enseignants, disciplines, repartition, editData)
      : '';

    // Bandeau "Importer depuis le scénario actif" — visible uniquement si pas en mode édition
    const scenBandeauHtml = _editBarretteId ? '' : _htmlBandeauScenDed(structures, disciplines, enseignants, anneeData);

    let listHtml = '';
    if (barrettes.length === 0 && !_editBarretteId) {
      listHtml = '<div class="edt-empty">'
        + '<p>Aucune barrette définie.</p>'
        + '<p class="edt-empty-hint">Une barrette regroupe des cours simultanés — classes entières ou groupes dédoublés.</p>'
        + '</div>';
    } else {
      listHtml = _htmlListeBarrettes(barrettes, structures, groupes, enseignants, disciplines);
    }
    el.innerHTML = scenBandeauHtml + formHtml + listHtml;
  }

  // ── Bandeau scénario actif → dédoublements importables ────────────
  function _htmlBandeauScenDed(structures, disciplines, enseignants, anneeData) {
    const scen = DGHData.getScenarioActif();
    if (!scen) return '';

    const mods = (scen.modificateurs || []).filter(m => m.type === 'dedoublement' && m.disciplineId && (m.classeIds||[]).length > 0);
    if (mods.length === 0) return '';

    const rows = mods.map(m => {
      const disc     = disciplines.find(d => d.id === m.disciplineId);
      const discNom  = disc ? disc.nom : '?';
      const clsNoms  = (m.classeIds || []).map(id => structures.find(s => s.id === id)?.nom || '?').join(', ');
      const hGr      = m.heuresParGroupe || 0;
      // Enseignants depuis la répartition
      const ensIds   = Calculs.profsDeClasseDiscipline(anneeData, m.disciplineId, m.classeIds);
      const ensNoms  = ensIds.map(id => { const e = enseignants.find(en => en.id === id); return e ? _ensNomCourt(e) : '?'; }).join(', ');

      // Encoder l'id du modificateur pour le data-attribute
      return '<div class="edt-scen-ded-row">'
        + '<div class="edt-scen-ded-info">'
          + '<span class="edt-scen-ded-disc">' + _esc(discNom) + '</span>'
          + '<span class="edt-scen-ded-cls">' + _esc(clsNoms) + '</span>'
          + '<span class="edt-scen-ded-h font-mono">' + hGr + '\u00a0h/gr</span>'
          + (ensNoms ? '<span class="edt-scen-ded-ens">' + _esc(ensNoms) + '</span>' : '')
        + '</div>'
        + '<button class="btn-sm btn-scen-activer" data-action="edt-import-ded"'
          + ' data-mod-id="' + _esc(m.id) + '" data-scen-id="' + _esc(scen.id) + '">'
          + '\u2192 Pré-remplir barrette'
        + '</button>'
      + '</div>';
    }).join('');

    return '<div class="edt-scen-ded-banner">'
      + '<div class="edt-scen-ded-header">'
        + '<span class="edt-scen-ded-tag">\u2295 Scénario actif</span>'
        + '<strong class="edt-scen-ded-nom">' + _esc(scen.nom) + '</strong>'
        + '<span class="edt-scen-ded-hint">' + mods.length + ' dédoublement' + (mods.length > 1 ? 's' : '') + ' — cliquez pour pré-remplir le formulaire</span>'
      + '</div>'
      + '<div class="edt-scen-ded-list">' + rows + '</div>'
    + '</div>';
  }

  // ── Importer un dédoublement depuis le scénario actif ─────────────
  function importerDedoublementBarrette(scenId, modId) {
    const scen = DGHData.getScenario(scenId);
    if (!scen) return;
    const mod  = (scen.modificateurs || []).find(m => m.id === modId);
    if (!mod || mod.type !== 'dedoublement') return;

    const disc       = DGHData.getDisciplines().find(d => d.id === mod.disciplineId);
    const anneeData  = DGHData.getAnnee();
    const enseignants = DGHData.getEnseignants();

    // Construire les slots : un slot par classe, avec les enseignants de la répartition
    const classeIds = mod.classeIds || [];
    const slots = classeIds.map(cid => {
      // Enseignants affectés à cette classe+discipline spécifiquement
      const ensIds = Calculs.profsDeClasseDiscipline(anneeData, mod.disciplineId, [cid]);
      return {
        type:     'classe',
        ref:      cid,
        nomLibre: '',
        ensIds:   ensIds,
        frequence:'hebdo'
      };
    });

    // Nom suggéré
    const discNom  = disc ? disc.nom : '';
    const niveaux  = [...new Set((DGHData.getStructures().filter(s => classeIds.includes(s.id))).map(s => s.niveau))].join('/');
    const nomSugge = discNom + (niveaux ? ' — ' + niveaux : '') + ' (dédoublement)';

    // Mémoriser le pré-remplissage
    _prefillData = {
      nom:          nomSugge,
      disciplineIds: mod.disciplineId ? [mod.disciplineId] : [],
      slots,
      commentaire:  'Importé depuis scénario « ' + scen.nom + ' »'
    };
    _editBarretteId = '__new__';
    _renderBarrettes();

    // Scroll vers le formulaire + focus
    setTimeout(() => {
      const form = document.getElementById('edtBarretteForm');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('edtBarretteNom')?.focus();
    }, 50);
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

    const freqVal = slot.frequence || 'hebdo';

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
        + '<div class="edt-form-field"><label>Fréquence <span class="edt-form-hint">(semaine A/B si dédoublé)</span></label>'
          + '<select class="edt-slot-freq-sel" data-slot-idx="' + idx + '">'
            + '<option value="hebdo"'     + (freqVal==='hebdo'    ?' selected':'') + '>Toutes les semaines</option>'
            + '<option value="semaine-A"' + (freqVal==='semaine-A'?' selected':'') + '>Semaine A</option>'
            + '<option value="semaine-B"' + (freqVal==='semaine-B'?' selected':'') + '>Semaine B</option>'
          + '</select>'
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
      const frequence = card.querySelector('.edt-slot-freq-sel')?.value || 'hebdo';
      return { type, ref: type !== 'libre' ? ref : null, nomLibre: type === 'libre' ? nomLibre : '', ensIds, frequence };
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
  function startAddBarrette()  { _prefillData = null; _editBarretteId = '__new__'; _renderBarrettes(); setTimeout(() => document.getElementById('edtBarretteNom')?.focus(), 0); }
  function editBarrette(id)    { _prefillData = null; _editBarretteId = id;        _renderBarrettes(); setTimeout(() => document.getElementById('edtBarretteNom')?.focus(), 0); }
  function cancelBarrette()    { _prefillData = null; _editBarretteId = null;      _renderBarrettes(); }
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
    _prefillData = null;
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
        const freq = slots.map(s => '<td class="edt-slot-cell-ens"><span class="edt-freq-tag ' + (s.frequence||'hebdo') + '">' + _esc(FREQ_LABEL[s.frequence||'hebdo']) + '</span></td>').join('');
        tableHtml = '<div class="edt-barr-slots-table-wrap"><table class="edt-barr-slots-table">'
          + '<thead><tr>' + ths + '</tr></thead>'
          + '<tbody><tr>' + cls + '</tr><tr>' + ens + '</tr><tr>' + freq + '</tr></tbody>'
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
  // ONGLET 3 — INDISPONIBILITÉS & CONTRAINTES LIBRES (v4.8.0)
  // ══════════════════════════════════════════════════════════════════
  function _renderIndispos() {
    const el = document.getElementById('edtIndisposWrap');
    if (!el) return;
    const enseignants = DGHData.getEnseignants();
    const indispos     = DGHData.getIndisponibilites();
    const clibres       = DGHData.getContraintesLibres();
    const structures   = DGHData.getStructures();
    const jours         = DGHData.getJoursSemaine();

    let html = '';

    // — Formulaire indisponibilité —
    if (_editIndispoId) {
      html += _htmlFormIndispo(enseignants, jours, indispos.find(i => i.id === _editIndispoId) || null);
    }
    // — Formulaire contrainte libre —
    if (_editClibreId) {
      html += _htmlFormClibre(enseignants, structures, jours, clibres.find(c => c.id === _editClibreId) || null);
    }

    // — Liste indisponibilités groupées par enseignant —
    html += '<h3 class="edt-synth-h3">Indisponibilités enseignants (' + indispos.length + ')</h3>';
    const visiblesInd = indispos.filter(i => i.id !== _editIndispoId);
    if (visiblesInd.length === 0 && !_editIndispoId) {
      html += '<div class="edt-empty"><p>Aucune indisponibilité saisie.</p>'
        + '<p class="edt-empty-hint">Distinguez les indisponibilités dures (réelles, ex : BMP sur un autre établissement) des vœux souples (à éviter si possible).</p></div>';
    } else if (visiblesInd.length > 0) {
      html += '<div class="edt-indispo-list">' + visiblesInd.map(i => {
        const ens = enseignants.find(e => e.id === i.ensId);
        const nom = ens ? _ensNomCourt(ens) : '?';
        const creneauTxt = i.plage === 'creneau'
          ? (JOUR_LABEL[i.jour]||i.jour) + ' ' + _esc(i.heureDebut) + '–' + _esc(i.heureFin)
          : (JOUR_LABEL[i.jour]||i.jour) + ' — ' + PLAGE_LABEL[i.plage];
        return '<div class="edt-indispo-card edt-indispo-' + i.type + '">'
          + '<span class="edt-indispo-ens">' + _esc(nom) + '</span>'
          + '<span class="edt-indispo-badge ' + i.type + '">' + (i.type === 'dure' ? 'Dure' : 'Souple') + '</span>'
          + '<span class="edt-indispo-creneau">' + creneauTxt + '</span>'
          + '<div class="edt-card-actions">'
            + '<button class="btn-icon" data-action="edt-edit-indispo" data-id="' + i.id + '" title="Modifier">✎</button>'
            + '<button class="btn-icon btn-icon-danger" data-action="edt-delete-indispo" data-id="' + i.id + '" title="Supprimer">✕</button>'
          + '</div>'
          + (i.motif ? '<span class="edt-indispo-motif">' + _esc(i.motif) + '</span>' : '')
        + '</div>';
      }).join('') + '</div>';
    }

    // — Liste contraintes libres —
    html += '<h3 class="edt-synth-h3">Contraintes libres (' + clibres.length + ')</h3>';
    const visiblesCl = clibres.filter(c => c.id !== _editClibreId);
    if (visiblesCl.length === 0 && !_editClibreId) {
      html += '<div class="edt-empty"><p>Aucune contrainte libre saisie.</p>'
        + '<p class="edt-empty-hint">Ex : « Orchestre — Conservatoire », jeudi 8h–11h, classe et/ou enseignant concernés.</p></div>';
    } else if (visiblesCl.length > 0) {
      html += visiblesCl.map(c => {
        const ensNoms = (c.ensIds||[]).map(id => { const e = enseignants.find(en=>en.id===id); return e ? _ensNomCourt(e) : '?'; }).join(', ');
        const clsNoms = (c.classeIds||[]).map(id => structures.find(s=>s.id===id)?.nom||'?').join(', ');
        return '<div class="edt-clibre-card">'
          + '<div class="edt-clibre-header">'
            + '<span class="edt-clibre-titre">' + _esc(c.titre || 'Contrainte') + '</span>'
            + '<div class="edt-card-actions">'
              + '<button class="btn-icon" data-action="edt-edit-clibre" data-id="' + c.id + '" title="Modifier">✎</button>'
              + '<button class="btn-icon btn-icon-danger" data-action="edt-delete-clibre" data-id="' + c.id + '" title="Supprimer">✕</button>'
            + '</div>'
          + '</div>'
          + '<span class="edt-clibre-meta">' + (JOUR_LABEL[c.jour]||c.jour) + ' ' + _esc(c.heureDebut) + '–' + _esc(c.heureFin)
            + (clsNoms ? ' · Classes : ' + _esc(clsNoms) : '') + (ensNoms ? ' · Enseignants : ' + _esc(ensNoms) : '') + '</span>'
          + (c.commentaire ? '<span class="edt-clibre-meta">' + _esc(c.commentaire) + '</span>' : '')
        + '</div>';
      }).join('');
    }

    el.innerHTML = html;
  }

  function _htmlFormIndispo(enseignants, jours, editData) {
    const ensId = editData?.ensId || '';
    const type  = editData?.type  || 'dure';
    const jour  = editData?.jour  || 'lun';
    const plage = editData?.plage || 'journee';
    const hDeb  = editData?.heureDebut || '';
    const hFin  = editData?.heureFin   || '';
    const motif = editData?.motif || '';
    const ensOpts = enseignants.map(e => '<option value="' + e.id + '"' + (ensId===e.id?' selected':'') + '>' + _esc(_ensNomCourt(e)) + '</option>').join('');
    const jourOpts = jours.map(j => '<option value="' + j.value + '"' + (jour===j.value?' selected':'') + '>' + _esc(j.label) + '</option>').join('');
    const saveAttr = editData ? ' data-id="' + editData.id + '"' : '';
    return '<div class="edt-form" id="edtIndispoForm">'
      + '<div class="edt-form-title">' + (editData ? 'Modifier l\'indisponibilité' : 'Nouvelle indisponibilité') + '</div>'
      + '<div class="edt-form-grid">'
        + '<div class="edt-form-col">'
          + '<div class="edt-form-field"><label>Enseignant <span class="edt-form-req">*</span></label><select id="inputIndispoEns">' + ensOpts + '</select></div>'
          + '<div class="edt-form-field"><label>Type</label><select id="inputIndispoType">'
            + '<option value="dure"' + (type==='dure'?' selected':'') + '>Dure — impossible</option>'
            + '<option value="souple"' + (type==='souple'?' selected':'') + '>Souple — à éviter</option>'
          + '</select></div>'
          + '<div class="edt-form-field"><label>Motif (optionnel)</label><input type="text" id="inputIndispoMotif" value="' + _esc(motif) + '" placeholder="Ex : TZR — collège Victor Hugo" /></div>'
        + '</div>'
        + '<div class="edt-form-col">'
          + '<div class="edt-form-field"><label>Jour</label><select id="inputIndispoJour">' + jourOpts + '</select></div>'
          + '<div class="edt-form-field"><label>Plage</label><select id="inputIndispoPlage" data-action="edt-indispo-plage-change">'
            + '<option value="journee"' + (plage==='journee'?' selected':'') + '>Journée entière</option>'
            + '<option value="matin"'   + (plage==='matin'  ?' selected':'') + '>Matin</option>'
            + '<option value="aprem"'   + (plage==='aprem'  ?' selected':'') + '>Après-midi</option>'
            + '<option value="creneau"' + (plage==='creneau'?' selected':'') + '>Créneau précis</option>'
          + '</select></div>'
          + '<div class="edt-form-field' + (plage==='creneau'?'':' is-hidden') + '" id="indispoCreneauWrap">'
            + '<label>Heure début / fin</label>'
            + '<div class="form-row-2"><input type="time" id="inputIndispoDebut" value="' + _esc(hDeb) + '" /><input type="time" id="inputIndispoFin" value="' + _esc(hFin) + '" /></div>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '<div class="edt-form-actions">'
        + '<button class="btn-primary" data-action="edt-save-indispo"' + saveAttr + '>Enregistrer ✓</button>'
        + '<button class="btn-secondary" data-action="edt-cancel-indispo">Annuler</button>'
      + '</div>'
    + '</div>';
  }

  function startAddIndispo()  { _editIndispoId = '__new__'; _renderIndispos(); }
  function editIndispo(id)    { _editIndispoId = id;        _renderIndispos(); }
  function cancelIndispo()    { _editIndispoId = null;      _renderIndispos(); }

  function onIndispoPlageChange() {
    const plage = document.getElementById('inputIndispoPlage')?.value;
    const wrap  = document.getElementById('indispoCreneauWrap');
    if (wrap) wrap.classList.toggle('is-hidden', plage !== 'creneau');
  }

  function saveIndispo(id) {
    const ensId = document.getElementById('inputIndispoEns')?.value || '';
    if (!ensId) { app.toast('Sélectionnez un enseignant.', 'warning'); return; }
    const fields = {
      ensId,
      type:       document.getElementById('inputIndispoType')?.value  || 'dure',
      jour:       document.getElementById('inputIndispoJour')?.value  || 'lun',
      plage:      document.getElementById('inputIndispoPlage')?.value || 'journee',
      heureDebut: document.getElementById('inputIndispoDebut')?.value || '',
      heureFin:   document.getElementById('inputIndispoFin')?.value   || '',
      motif:      document.getElementById('inputIndispoMotif')?.value || ''
    };
    if (fields.plage === 'creneau' && (!fields.heureDebut || !fields.heureFin || fields.heureDebut >= fields.heureFin)) {
      app.toast('Créneau invalide.', 'warning'); return;
    }
    if (id && id !== '__new__') { DGHData.updateIndisponibilite(id, fields); app.toast('Indisponibilité mise à jour.', 'success'); }
    else                        { DGHData.addIndisponibilite(fields);        app.toast('Indisponibilité ajoutée.', 'success'); }
    _editIndispoId = null;
    _renderIndispos();
  }

  function deleteIndispo(id) {
    if (!confirm('Supprimer cette indisponibilité ?')) return;
    DGHData.deleteIndisponibilite(id);
    _renderIndispos();
    app.toast('Indisponibilité supprimée.', 'info');
  }

  function _htmlFormClibre(enseignants, structures, jours, editData) {
    const titre = editData?.titre || '';
    const jour  = editData?.jour  || 'lun';
    const hDeb  = editData?.heureDebut || '';
    const hFin  = editData?.heureFin   || '';
    const comment = editData?.commentaire || '';
    const ensSel = new Set(editData?.ensIds    || []);
    const clsSel = new Set(editData?.classeIds || []);
    const jourOpts = jours.map(j => '<option value="' + j.value + '"' + (jour===j.value?' selected':'') + '>' + _esc(j.label) + '</option>').join('');
    const ensHtml = enseignants.length === 0
      ? '<span class="edt-empty-hint">Aucun enseignant.</span>'
      : enseignants.map(e => '<label class="mod-classe-label"><input type="checkbox" class="edt-clibre-ens-check" value="' + e.id + '"' + (ensSel.has(e.id)?' checked':'') + '> ' + _esc(_ensNomCourt(e)) + '</label>').join('');
    const parNiv = {};
    structures.forEach(s => { if (!parNiv[s.niveau]) parNiv[s.niveau]=[]; parNiv[s.niveau].push(s); });
    const niveauxOrd = ['6e','5e','4e','3e','SEGPA','ULIS','UPE2A'];
    const clsHtml = niveauxOrd.filter(n => parNiv[n]?.length).map(niv =>
      '<div class="edt-form-niv"><span class="edt-form-niv-label">' + niv + '</span>'
        + parNiv[niv].map(s => '<label class="mod-classe-label"><input type="checkbox" class="edt-clibre-classe-check" value="' + s.id + '"' + (clsSel.has(s.id)?' checked':'') + '> ' + _esc(s.nom) + '</label>').join('')
      + '</div>').join('') || '<span class="edt-empty-hint">Aucune classe.</span>';
    const saveAttr = editData ? ' data-id="' + editData.id + '"' : '';
    return '<div class="edt-form" id="edtClibreForm">'
      + '<div class="edt-form-title">' + (editData ? 'Modifier la contrainte libre' : 'Nouvelle contrainte libre') + '</div>'
      + '<div class="edt-form-grid">'
        + '<div class="edt-form-col">'
          + '<div class="edt-form-field"><label>Titre <span class="edt-form-req">*</span></label><input type="text" id="inputClibreTitre" value="' + _esc(titre) + '" placeholder="Ex : Orchestre — Conservatoire" /></div>'
          + '<div class="edt-form-field"><label>Jour</label><select id="inputClibreJour">' + jourOpts + '</select></div>'
          + '<div class="edt-form-field"><label>Heure début / fin</label><div class="form-row-2"><input type="time" id="inputClibreDebut" value="' + _esc(hDeb) + '" /><input type="time" id="inputClibreFin" value="' + _esc(hFin) + '" /></div></div>'
          + '<div class="edt-form-field"><label>Commentaire</label><input type="text" id="inputClibreComment" value="' + _esc(comment) + '" placeholder="Précisions" /></div>'
        + '</div>'
        + '<div class="edt-form-col">'
          + '<div class="edt-form-field"><label>Classes concernées</label><div class="edt-check-list">' + clsHtml + '</div></div>'
          + '<div class="edt-form-field"><label>Enseignants concernés</label><div class="edt-check-list">' + ensHtml + '</div></div>'
        + '</div>'
      + '</div>'
      + '<div class="edt-form-actions">'
        + '<button class="btn-primary" data-action="edt-save-clibre"' + saveAttr + '>Enregistrer ✓</button>'
        + '<button class="btn-secondary" data-action="edt-cancel-clibre">Annuler</button>'
      + '</div>'
    + '</div>';
  }

  function startAddClibre()  { _editClibreId = '__new__'; _renderIndispos(); document.getElementById('inputClibreTitre')?.focus(); }
  function editClibre(id)    { _editClibreId = id;        _renderIndispos(); document.getElementById('inputClibreTitre')?.focus(); }
  function cancelClibre()    { _editClibreId = null;      _renderIndispos(); }

  function saveClibre(id) {
    const titre = document.getElementById('inputClibreTitre')?.value.trim() || '';
    if (!titre) { app.toast('Saisissez un titre.', 'warning'); return; }
    const hDeb = document.getElementById('inputClibreDebut')?.value || '';
    const hFin = document.getElementById('inputClibreFin')?.value   || '';
    if (hDeb && hFin && hDeb >= hFin) { app.toast('Créneau invalide.', 'warning'); return; }
    const ensIds    = Array.from(document.querySelectorAll('.edt-clibre-ens-check:checked')).map(c => c.value);
    const classeIds = Array.from(document.querySelectorAll('.edt-clibre-classe-check:checked')).map(c => c.value);
    const fields = {
      titre,
      jour:       document.getElementById('inputClibreJour')?.value || 'lun',
      heureDebut: hDeb, heureFin: hFin,
      scope:      classeIds.length > 0 ? 'classe' : 'etablissement',
      classeIds, ensIds,
      commentaire: document.getElementById('inputClibreComment')?.value.trim() || ''
    };
    if (id && id !== '__new__') { DGHData.updateContrainteLibre(id, fields); app.toast('Contrainte mise à jour.', 'success'); }
    else                        { DGHData.addContrainteLibre(fields);        app.toast('Contrainte ajoutée.', 'success'); }
    _editClibreId = null;
    _renderIndispos();
  }

  function deleteClibre(id) {
    if (!confirm('Supprimer cette contrainte libre ?')) return;
    DGHData.deleteContrainteLibre(id);
    _renderIndispos();
    app.toast('Contrainte supprimée.', 'info');
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 4 — CONTRAINTES ÉTABLISSEMENT (Sprint 15 / v4.9.0)
  //   • Organisation de la semaine scolaire
  //   • Salles spécialisées (déplacées depuis modale Établissement)
  //   • Heure bleue — recommandation créneau optimal (déplacée)
  // ══════════════════════════════════════════════════════════════════

  function _renderContraintesEtab() {
    const el = document.getElementById('edtEtabWrap');
    if (!el) return;

    const os    = DGHData.getOrganisationSemaine();
    const salles = DGHData.getSalles();
    const types  = DGHData.getTypesSalle();
    const hb     = DGHData.getHeuresBleues();
    const jours  = DGHData.getJoursSemaine();

    const typeLabel = t => (types.find(x => x.value === t) || {}).label || t;

    // ── Section 1 : Organisation de la semaine ──────────────────────
    const joursBtns = JOURS_ALL.map(j =>
      '<label class="edt-jour-toggle' + (os.joursOuvres.includes(j) ? ' active' : '') + '">'
      + '<input type="checkbox" class="edt-jour-check" data-action="edt-etab-jour-toggle" value="' + j + '"'
      + (os.joursOuvres.includes(j) ? ' checked' : '') + '> ' + JOUR_LABEL[j] + '</label>'
    ).join('');

    const org = '<div class="edt-etab-section">'
      + '<h3 class="edt-synth-h3">Organisation de la semaine</h3>'
      + '<div class="edt-etab-jours">' + joursBtns + '</div>'
      + '<div class="edt-etab-options">'
        + '<label class="mod-classe-label"><input type="checkbox" id="edtMercrediMatin"'
          + (os.mercrediMatin ? ' checked' : '')
          + ' data-action="edt-etab-mercredi-toggle"> Mercredi matin ouvert</label>'
      + '</div>'
      + '<div class="edt-etab-horaires">'
        + '<div class="edt-etab-horaire-group">'
          + '<span class="edt-etab-horaire-label">Matin</span>'
          + '<input type="time" id="edtDebutMatin" value="' + _esc(os.horaires.debutMatin) + '" data-action="edt-etab-horaire" data-field="debutMatin" />'
          + '<span class="edt-etab-horaire-sep">→</span>'
          + '<input type="time" id="edtFinMatin" value="' + _esc(os.horaires.finMatin) + '" data-action="edt-etab-horaire" data-field="finMatin" />'
        + '</div>'
        + '<div class="edt-etab-horaire-group">'
          + '<span class="edt-etab-horaire-label">Après-midi</span>'
          + '<input type="time" id="edtDebutAprem" value="' + _esc(os.horaires.debutAprem) + '" data-action="edt-etab-horaire" data-field="debutAprem" />'
          + '<span class="edt-etab-horaire-sep">→</span>'
          + '<input type="time" id="edtFinAprem" value="' + _esc(os.horaires.finAprem) + '" data-action="edt-etab-horaire" data-field="finAprem" />'
        + '</div>'
      + '</div>'
    + '</div>';

    // ── Section 2 : Salles spécialisées ────────────────────────────
    const formSalle = _editSalleId ? _htmlFormSalleEdt(types, salles.find(s => s.id === _editSalleId) || null) : '';
    const visiblesSalles = salles.filter(s => s.id !== _editSalleId);
    const listSalles = visiblesSalles.length === 0 && !_editSalleId
      ? '<p class="form-hint">Aucune salle spécialisée renseignée — labo SVT, Physique, Musique, Arts, Techno…</p>'
      : '<div class="salle-list">' + visiblesSalles.map(s =>
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

    const sallesSection = '<div class="edt-etab-section">'
      + '<h3 class="edt-synth-h3">Salles spécialisées</h3>'
      + formSalle + listSalles
    + '</div>';

    // ── Section 3 : Heure bleue ─────────────────────────────────────
    const creneaux     = hb.creneaux || [];
    const joursOpts    = jours.map(j => '<option value="' + j.value + '">' + _esc(j.label) + '</option>').join('');
    const creneauxHtml = creneaux.map((c, i) =>
      '<div class="hb-creneau-row">'
        + '<span class="hb-creneau-label">' + _esc((jours.find(j=>j.value===c.jour)||{}).label || c.jour) + ' ' + _esc(c.debut) + '–' + _esc(c.fin) + '</span>'
        + '<button class="btn-icon btn-icon-danger" data-action="hb-remove-creneau" data-idx="' + i + '" title="Retirer">✕</button>'
      + '</div>'
    ).join('') || '<p class="form-hint">Ajoutez 1 à 4 créneaux candidats — l\'application recommandera le meilleur.</p>';

    const hbSection = '<div class="edt-etab-section">'
      + '<h3 class="edt-synth-h3">Heure bleue <span class="edt-form-hint">— créneau de réunion commun</span></h3>'
      + '<label class="hb-actif-label"><input type="checkbox" id="inputHBActif"' + (hb.actif ? ' checked' : '') + '> Activer la recherche de créneau bleu</label>'
      + '<div class="hb-creneaux-add">'
        + '<select id="inputHBJour">' + joursOpts + '</select>'
        + '<input type="time" id="inputHBDebut" value="12:00" />'
        + '<input type="time" id="inputHBFin" value="13:00" />'
        + '<button class="btn-secondary btn-sm" data-action="hb-add-creneau">+ Ajouter ce créneau</button>'
      + '</div>'
      + '<div class="hb-creneaux-list">' + creneauxHtml + '</div>'
      + '<button class="btn-primary btn-sm" data-action="hb-calculer" ' + (creneaux.length === 0 ? 'disabled' : '') + '>Calculer le créneau optimal</button>'
      + '<div id="hbResultatWrap"></div>'
    + '</div>';

    el.innerHTML = org + sallesSection + hbSection;
  }

  // ── Formulaire salle (dans l'onglet EDT) ──────────────────────────
  function _htmlFormSalleEdt(types, editData) {
    const nom = editData?.nom  || '';
    const typ = editData?.type || 'svt';
    const nb  = editData?.nb != null ? editData.nb : 1;
    const opts = types.map(t => '<option value="' + t.value + '"' + (typ === t.value ? ' selected' : '') + '>' + _esc(t.label) + '</option>').join('');
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

  // ── Actions salles (déplacées depuis DGHEtab) ─────────────────────
  function startAddSalleEdt() { _editSalleId = '__new__'; _renderContraintesEtab(); setTimeout(() => document.getElementById('inputSalleNom')?.focus(), 0); }
  function editSalleEdt(id)   { _editSalleId = id;        _renderContraintesEtab(); setTimeout(() => document.getElementById('inputSalleNom')?.focus(), 0); }
  function cancelSalleEdt()   { _editSalleId = null;      _renderContraintesEtab(); }

  function saveSalleEdt(id) {
    const nom  = document.getElementById('inputSalleNom')?.value.trim() || '';
    const type = document.getElementById('inputSalleType')?.value || 'svt';
    const nb   = parseInt(document.getElementById('inputSalleNb')?.value, 10) || 1;
    const fields = { nom, type, nb };
    if (id && id !== '__new__') { DGHData.updateSalle(id, fields); app.toast('Salle mise à jour.', 'success'); }
    else                        { DGHData.addSalle(fields);        app.toast('Salle ajoutée.', 'success'); }
    _editSalleId = null;
    _renderContraintesEtab();
  }

  function deleteSalleEdt(id) {
    if (!confirm('Supprimer cette salle ?')) return;
    DGHData.deleteSalle(id);
    _renderContraintesEtab();
    app.toast('Salle supprimée.', 'info');
  }

  // ── Actions organisation semaine ───────────────────────────────────
  function etabJourToggle(jour, checked) {
    const os = DGHData.getOrganisationSemaine();
    let jours = os.joursOuvres.slice();
    if (checked) { if (!jours.includes(jour)) jours.push(jour); }
    else         { jours = jours.filter(j => j !== jour); }
    // Conserver l'ordre naturel
    const ordre = ['lun','mar','mer','jeu','ven'];
    jours = ordre.filter(j => jours.includes(j));
    DGHData.setOrganisationSemaine({ joursOuvres: jours });
  }

  function etabMercrediToggle(checked) {
    DGHData.setOrganisationSemaine({ mercrediMatin: !!checked });
  }

  function etabHoraireChange(field, value) {
    const os = DGHData.getOrganisationSemaine();
    const h = Object.assign({}, os.horaires);
    h[field] = value;
    DGHData.setOrganisationSemaine({ horaires: h });
  }

  // ── Actions heure bleue (déplacées depuis DGHEtab) ─────────────────
  function hbAddCreneau() {
    const jour  = document.getElementById('inputHBJour')?.value  || 'lun';
    const debut = document.getElementById('inputHBDebut')?.value || '';
    const fin   = document.getElementById('inputHBFin')?.value   || '';
    if (!debut || !fin || debut >= fin) { app.toast('Créneau invalide.', 'warning'); return; }
    const hb = DGHData.getHeuresBleues();
    const creneaux = (hb.creneaux || []).slice();
    if (creneaux.length >= 4) { app.toast('Maximum 4 créneaux candidats.', 'warning'); return; }
    creneaux.push({ jour, debut, fin });
    DGHData.setHeuresBleues({ creneaux });
    _renderContraintesEtab();
  }

  function hbRemoveCreneau(idx) {
    const hb = DGHData.getHeuresBleues();
    const creneaux = (hb.creneaux || []).slice();
    creneaux.splice(parseInt(idx, 10), 1);
    DGHData.setHeuresBleues({ creneaux });
    _renderContraintesEtab();
  }

  function hbToggleActif(checked) {
    DGHData.setHeuresBleues({ actif: !!checked });
  }

  function hbCalculer() {
    try {
      const hb = DGHData.getHeuresBleues();
      const enseignants    = DGHData.getEnseignants();
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
        + '<p class="form-hint hb-limite-hint">Recommandation basée uniquement sur les contraintes saisies — elle ne connaît pas les cours déjà posés dans Index Éducation.</p>';
    } catch(e) { console.error('[DGHEdt] hbCalculer:', e); app.toast('Erreur lors du calcul.', 'error'); }
  }

  // ══════════════════════════════════════════════════════════════════
  // ONGLET 5 — NOTICE EDT (synthèse consolidée + alertes, v4.8.0)
  // ══════════════════════════════════════════════════════════════════
  function _renderSynthese() {
    const el = document.getElementById('edtSyntheseWrap');
    if (!el) return;
    const barrettes      = DGHData.getBarrettes();
    const coIntervs       = DGHData.getCoInterventions();
    const indispos         = DGHData.getIndisponibilites();
    const clibres           = DGHData.getContraintesLibres();
    const enseignants      = DGHData.getEnseignants();
    const structures       = DGHData.getStructures();
    const groupes           = DGHData.getGroupes();
    const disciplines       = DGHData.getDisciplines();
    const etab              = DGHData.getEtab();
    const annee             = DGHData.getAnneeActive();
    const salles            = DGHData.getSalles();
    const heuresBleues      = DGHData.getHeuresBleues();
    const anneeData         = DGHData.getAnnee();

    if (enseignants.length === 0 && barrettes.length === 0) {
      el.innerHTML = '<div class="edt-empty"><p>Aucune donnée pour la notice EDT.</p>'
        + '<p class="edt-empty-hint">Renseignez au moins une barrette ou un enseignant pour générer la notice.</p></div>'; return;
    }
    const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    const alertes = Calculs.controlesEDT(anneeData, etab);

    let html = '<div class="edt-synthese" id="edtSyntheseContent">'
      + '<div class="edt-synthese-entete"><strong>' + _esc(etab.nom||'Établissement') + '</strong>'
        + ' — Notice de préparation EDT · ' + _esc(annee.replace('-','–')) + ' · ' + date + '</div>';

    // — Section 0 : Alertes détectées (en tête, si présentes) —
    if (alertes.length > 0) {
      html += '<div class="edt-notice-section"><h3 class="edt-synth-h3">⚠ Points de vigilance (' + alertes.length + ')</h3>'
        + '<div class="edt-notice-alerte-list">' + alertes.map(a =>
          '<div class="alerte-item sev-' + a.severite + '"><span class="alerte-dot">' + ({error:'✕',warning:'⚠',info:'ℹ'}[a.severite]||'·') + '</span><span class="alerte-msg">' + _esc(a.message) + '</span></div>'
        ).join('') + '</div></div>';
    }

    // — Section 1 : Cadre général —
    html += '<div class="edt-notice-section"><h3 class="edt-synth-h3">Cadre général</h3>'
      + '<table class="edt-notice-table"><tbody>'
      + '<tr><td>Établissement</td><td>' + _esc(etab.nom||'—') + '</td></tr>'
      + '<tr><td>Année scolaire</td><td>' + _esc(annee.replace('-','–')) + '</td></tr>'
      + '<tr><td>Heure bleue</td><td>' + (heuresBleues.actif && (heuresBleues.creneaux||[]).length
          ? _esc(heuresBleues.creneaux.map(c => (JOUR_LABEL[c.jour]||c.jour) + ' ' + c.debut + '–' + c.fin).join(', '))
          : 'Non définie') + '</td></tr>'
      + '</tbody></table></div>';

    // — Section 2 : Salles spécialisées —
    if (salles.length > 0) {
      html += '<div class="edt-notice-section"><h3 class="edt-synth-h3">Salles spécialisées (' + salles.length + ')</h3>'
        + '<table class="edt-notice-table"><thead><tr><th>Salle</th><th>Type</th><th>Exemplaires</th></tr></thead><tbody>'
        + salles.map(s => '<tr><td>' + _esc(s.nom||'—') + '</td><td>' + _esc((DGHData.getTypesSalle().find(t=>t.value===s.type)||{}).label||s.type) + '</td><td>' + (s.nb||1) + '</td></tr>').join('')
        + '</tbody></table></div>';
    }

    // — Section 3 : Contraintes enseignants (indisponibilités) —
    if (indispos.length > 0) {
      html += '<div class="edt-notice-section"><h3 class="edt-synth-h3">Contraintes enseignants (' + indispos.length + ')</h3>'
        + '<table class="edt-notice-table"><thead><tr><th>Enseignant</th><th>Type</th><th>Créneau</th><th>Motif</th></tr></thead><tbody>'
        + indispos.map(i => {
            const ens = enseignants.find(e => e.id === i.ensId);
            const creneauTxt = i.plage === 'creneau' ? (JOUR_LABEL[i.jour]||i.jour) + ' ' + i.heureDebut + '–' + i.heureFin : (JOUR_LABEL[i.jour]||i.jour) + ' — ' + PLAGE_LABEL[i.plage];
            return '<tr><td>' + _esc(ens?_ensNomCourt(ens):'?') + '</td><td>' + (i.type==='dure'?'Dure':'Souple') + '</td><td>' + creneauTxt + '</td><td>' + _esc(i.motif||'—') + '</td></tr>';
          }).join('')
        + '</tbody></table></div>';
    }

    // — Section 4 : Contraintes libres —
    if (clibres.length > 0) {
      html += '<div class="edt-notice-section"><h3 class="edt-synth-h3">Contraintes libres (' + clibres.length + ')</h3>'
        + '<table class="edt-notice-table"><thead><tr><th>Titre</th><th>Créneau</th><th>Classes</th><th>Enseignants</th></tr></thead><tbody>'
        + clibres.map(c => {
            const clsNoms = (c.classeIds||[]).map(id=>structures.find(s=>s.id===id)?.nom||'?').join(', ') || '—';
            const ensNoms = (c.ensIds||[]).map(id=>{const e=enseignants.find(en=>en.id===id);return e?_ensNomCourt(e):'?';}).join(', ') || '—';
            return '<tr><td>' + _esc(c.titre) + '</td><td>' + (JOUR_LABEL[c.jour]||c.jour) + ' ' + _esc(c.heureDebut) + '–' + _esc(c.heureFin) + '</td><td>' + _esc(clsNoms) + '</td><td>' + _esc(ensNoms) + '</td></tr>';
          }).join('')
        + '</tbody></table></div>';
    }

    // — Section 5 : Barrettes (hebdo d'abord, puis semaine A, puis semaine B) —
    if (barrettes.length > 0) {
      html += '<div class="edt-notice-section"><h3 class="edt-synth-h3">Barrettes (' + barrettes.length + ')</h3>';
      barrettes.forEach(b => {
        const slots = b.slots || [];
        const ths  = slots.map((_,i) => '<th>Cours '+(i+1)+'</th>').join('');
        const cls  = slots.map(s => '<td class="edt-slot-cell-classe">' + _esc(_slotLabel(s,structures,groupes)) + '</td>').join('');
        const ens  = slots.map(s => '<td class="edt-slot-cell-ens">'
          + ((s.ensIds||[]).map(eid=>{const e=enseignants.find(en=>en.id===eid);return e?_ensNomCourt(e):'?';}).join(', ')||'—')
          + '</td>').join('');
        const freq = slots.map(s => '<td class="edt-slot-cell-ens"><span class="edt-freq-tag ' + (s.frequence||'hebdo') + '">' + _esc(FREQ_LABEL[s.frequence||'hebdo']) + '</span></td>').join('');
        html += '<div class="edt-synth-fiche">'
          + '<div class="edt-synth-fiche-header"><span class="edt-synth-nom">' + _esc(b.nom||'Barrette') + '</span>'
            + (b.disciplineIds?.length ? '<span class="edt-synth-meta">' + _esc(b.disciplineIds.map(did=>disciplines.find(d=>d.id===did)?.nom||'?').join(' / ')) + '</span>' : '')
          + '</div>'
          + '<div class="edt-barr-slots-table-wrap"><table class="edt-barr-slots-table"><thead><tr>' + ths + '</tr></thead>'
            + '<tbody><tr>' + cls + '</tr><tr>' + ens + '</tr><tr>' + freq + '</tr></tbody></table></div>'
          + (b.commentaire ? '<div class="edt-barrette-body edt-barrette-comment">' + _esc(b.commentaire) + '</div>' : '')
        + '</div>';
      });
      html += '</div>';
    }

    // — Section 6 : Co-interventions —
    if (coIntervs.length > 0) {
      html += '<div class="edt-notice-section"><h3 class="edt-synth-h3">Co-interventions (' + coIntervs.length + ')</h3>';
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
      html += '</div>';
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
    importerDedoublementBarrette,
    onBarrDiscChange, barrAddSlot, barrRemoveSlot, barrSlotTypeChange,
    startAddCoInterv, editCoInterv, cancelCoInterv, saveCoInterv, deleteCoInterv,
    startAddIndispo, editIndispo, cancelIndispo, saveIndispo, deleteIndispo, onIndispoPlageChange,
    startAddClibre, editClibre, cancelClibre, saveClibre, deleteClibre,
    // Onglet Contraintes établissement (Sprint 15)
    startAddSalleEdt, editSalleEdt, cancelSalleEdt, saveSalleEdt, deleteSalleEdt,
    etabJourToggle, etabMercrediToggle, etabHoraireChange,
    hbAddCreneau, hbRemoveCreneau, hbToggleActif, hbCalculer,
    printSynthese
  };

})();
