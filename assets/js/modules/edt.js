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
      const hasScen = !!DGHData.getScenarioActif();
      el.innerHTML = '<button class="btn-primary" id="btnAddBarrette">+ Nouvelle barrette</button>'
        + (hasScen ? '<button class="btn-secondary btn-scen-activer" id="btnGenBarrettes">⚡ Générer depuis scénario</button>' : '');
    } else if (_tab === 'cointerv') {
      el.innerHTML = '<button class="btn-primary" id="btnAddCoInterv">+ Nouvelle co-intervention</button>';
    } else if (_tab === 'indispos') {
      el.innerHTML = '<button class="btn-primary" id="btnAddIndispo">+ Indisponibilité</button>'
        + '<button class="btn-secondary" id="btnAddClibre">+ Contrainte libre</button>';
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
      listHtml = _htmlListeBarrettesKanban(barrettes, structures, groupes, enseignants, disciplines);
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
        + '<span class="edt-scen-ded-hint">' + mods.length + ' dédoublement' + (mods.length > 1 ? 's' : '') + ' détectés — une barrette n\'est pas obligatoire pour chaque dédoublement</span>'
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
    const typeVal  = slot.type  || 'classe';
    const refVal   = slot.ref   || '';
    const discIdSl = slot.discId || (discIds[0] || '');

    // Calculer les classes liées à la discipline du slot
    const classesLiees = new Set();
    const discIdForFilter = discIdSl || (discIds[0] || null);
    if (discIdForFilter) {
      repartition.forEach(r => {
        if (r.disciplineId === discIdForFilter) {
          (r.groupesCours || []).forEach(gc => (gc.classesIds || []).forEach(cid => classesLiees.add(cid)));
        }
      });
    }

    // Select discipline par slot
    const discSlotOpts = '<option value="">— Toutes disciplines —</option>'
      + disciplines.map(d => '<option value="' + d.id + '"' + (discIdSl === d.id ? ' selected' : '') + '>' + _esc(d.nom) + '</option>').join('');
    const discSlotHtml = '<div class="edt-form-field edt-slot-disc-field">'
      + '<label>Discipline <span class="edt-form-hint">(optionnel si commune)</span></label>'
      + '<select class="edt-slot-disc-sel" data-slot-idx="' + idx + '">' + discSlotOpts + '</select>'
    + '</div>';

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
          + '<select class="edt-slot-type-sel" data-slot-idx="' + idx + '">'
            + '<option value="classe"' + (typeVal==='classe'?' selected':'') + '>Classe entière</option>'
            + '<option value="groupe"' + (typeVal==='groupe'?' selected':'') + '>Groupe (référentiel)</option>'
            + '<option value="libre"'  + (typeVal==='libre' ?' selected':'') + '>Groupe libre</option>'
          + '</select>'
        + '</div>'
        + discSlotHtml
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
      const discId    = card.querySelector('.edt-slot-disc-sel')?.value || null;
      return { type, ref: type !== 'libre' ? ref : null, nomLibre: type === 'libre' ? nomLibre : '', ensIds, frequence, discId: discId || null };
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
        const cls  = slots.map(s => {
          const dNom = s.discId ? (disciplines.find(d=>d.id===s.discId)?.nom||'') : '';
          return '<td class="edt-slot-cell-classe">' + _esc(_slotLabel(s, structures, groupes)) + (dNom ? '<br><span class="edt-slot-disc-chip">' + _esc(dNom) + '</span>' : '') + '</td>';
        }).join('');
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
  // ONGLET 3 — INDISPONIBILITÉS (grille visuelle) & CONTRAINTES LIBRES
  // v4.9.3 Sprint 16bis — planning hebdomadaire par enseignant
  // ══════════════════════════════════════════════════════════════════

  // Enseignant sélectionné dans la grille indispos
  let _grilleEnsId = null;

  function _renderIndispos() {
    const el = document.getElementById('edtIndisposWrap');
    if (!el) return;
    const enseignants = DGHData.getEnseignants();
    const clibres     = DGHData.getContraintesLibres();
    const structures  = DGHData.getStructures();
    const os          = DGHData.getOrganisationSemaine();
    const jours       = os.joursOuvres || ['lun','mar','mer','jeu','ven'];
    const creneaux    = _buildCreneaux(os);

    // Sélecteur d'enseignant
    if (!_grilleEnsId && enseignants.length > 0) _grilleEnsId = enseignants[0].id;
    const ensOpts = enseignants.map(e =>
      '<option value="' + e.id + '"' + (_grilleEnsId === e.id ? ' selected' : '') + '>' + _esc(_ensNomCourt(e)) + '</option>'
    ).join('');

    const grilleData = _grilleEnsId ? DGHData.getGrilleIndispo(_grilleEnsId) : { creneaux: {} };
    const cells      = grilleData.creneaux || {};

    // Légende + sélecteur
    let html = '<div class="grid-ens-header">'
      + '<div class="grid-ens-selector">'
        + '<label class="grid-ens-label">Enseignant</label>'
        + '<select id="grilleEnsSelect" data-action="grille-ens-change">' + ensOpts + '</select>'
      + '</div>'
      + '<div class="grid-legende">'
        + '<span class="grid-leg-item"><span class="grid-cell-sample etat-dure"></span> Indisponible</span>'
        + '<span class="grid-leg-item"><span class="grid-cell-sample etat-voeu"></span> Vœu à éviter</span>'
        + '<span class="grid-leg-item"><span class="grid-cell-sample etat-libre"></span> Libre</span>'
        + '<span class="grid-leg-hint">Clic pour basculer</span>'
      + '</div>'
      + '<button class="btn-secondary btn-sm" data-action="grille-ens-reset" data-ens-id="' + (_grilleEnsId||'') + '">Réinitialiser</button>'
    + '</div>';

    // Grille
    html += _htmlGrilleIndispo(jours, creneaux, cells, _grilleEnsId);

    // Compteur récapitulatif
    const nbDure  = Object.values(cells).filter(v => v === 'dure').length;
    const nbVoeu  = Object.values(cells).filter(v => v === 'voeu').length;
    if (nbDure + nbVoeu > 0) {
      html += '<p class="grid-recap">'
        + (nbDure > 0 ? '<span class="grid-recap-dure">' + nbDure + ' créneau' + (nbDure>1?'x':'') + ' indisponible' + (nbDure>1?'s':'') + '</span>' : '')
        + (nbDure > 0 && nbVoeu > 0 ? ' · ' : '')
        + (nbVoeu > 0 ? '<span class="grid-recap-voeu">' + nbVoeu + ' vœu' + (nbVoeu>1?'x':'') + '</span>' : '')
      + '</p>';
    }

    // Contraintes libres
    html += '<div class="grid-section-sep"><h3 class="edt-synth-h3">Contraintes libres (' + clibres.length + ')</h3>'
      + (_editClibreId ? '' : '<button class="btn-secondary btn-sm" id="btnAddClibre">+ Contrainte libre</button>') + '</div>';
    if (_editClibreId) html += _htmlFormClibre(enseignants, structures, DGHData.getJoursSemaine(), clibres.find(c => c.id === _editClibreId) || null);
    const visiblesCl = clibres.filter(c => c.id !== _editClibreId);
    if (visiblesCl.length === 0 && !_editClibreId) {
      html += '<div class="edt-empty"><p>Aucune contrainte libre.</p>'
        + '<p class="edt-empty-hint">Ex : Orchestre — Conservatoire, jeudi 8h–11h.</p></div>';
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
          + '<span class="edt-clibre-meta">' + _esc((JOUR_LABEL[c.jour]||c.jour) + ' ' + c.heureDebut + '–' + c.heureFin)
            + (clsNoms ? ' · ' + _esc(clsNoms) : '') + (ensNoms ? ' · ' + _esc(ensNoms) : '') + '</span>'
          + (c.commentaire ? '<span class="edt-clibre-meta">' + _esc(c.commentaire) + '</span>' : '')
        + '</div>';
      }).join('');
    }

    el.innerHTML = html;
  }

  /** Construit la liste des créneaux 1h depuis l'organisation de la semaine */
  function _buildCreneaux(os) {
    const h = os.horaires || { debutMatin:'08:00', finMatin:'12:00', debutAprem:'13:00', finAprem:'17:00' };
    const slots = [];
    const pushSlots = (debutStr, finStr) => {
      let h = parseInt(debutStr.split(':')[0], 10);
      const hfin = parseInt(finStr.split(':')[0], 10);
      while (h < hfin) { slots.push(String(h).padStart(2,'0')); h++; }
    };
    pushSlots(h.debutMatin, h.finMatin);
    pushSlots(h.debutAprem, h.finAprem);
    return slots; // ex: ['08','09','10','11','13','14','15','16']
  }

  /** Génère la grille HTML pour les indispos */
  function _htmlGrilleIndispo(jours, creneaux, cells, ensId) {
    if (!ensId) return '<div class="edt-empty"><p>Aucun enseignant — ajoutez-en dans l\'onglet Équipe pédagogique.</p></div>';

    const JOUR_COURT = { lun:'Lun', mar:'Mar', mer:'Mer', jeu:'Jeu', ven:'Ven' };
    let html = '<div class="grille-hebdo" id="grilleIndispoWrap">';

    // En-tête : colonne heure + une colonne par jour
    html += '<div class="grille-header">';
    html += '<div class="grille-heure-col"></div>';
    jours.forEach(j => { html += '<div class="grille-jour-col">' + (JOUR_COURT[j]||j) + '</div>'; });
    html += '</div>';

    // Lignes de créneaux
    creneaux.forEach(h => {
      html += '<div class="grille-row">';
      html += '<div class="grille-heure-label">' + h + 'h</div>';
      jours.forEach(j => {
        const key  = j + '-' + h;
        const etat = cells[key] || 'libre';
        html += '<div class="grille-cell etat-' + etat + '" data-action="grille-cell-toggle" data-ens-id="' + ensId + '" data-key="' + key + '" title="' + JOUR_LABEL[j] + ' ' + h + 'h"></div>';
      });
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  /** Bascule l'état d'une cellule de la grille indispo */
  function grilleToggleCell(ensId, key) {
    const grille = DGHData.getGrilleIndispo(ensId);
    const cells  = Object.assign({}, grille.creneaux || {});
    const etat   = cells[key] || 'libre';
    const next   = etat === 'libre' ? 'dure' : etat === 'dure' ? 'voeu' : 'libre';
    if (next === 'libre') delete cells[key]; else cells[key] = next;
    DGHData.setGrilleIndispo(ensId, cells);

    // Mise à jour ciblée de la cellule (sans re-render complet)
    const cell = document.querySelector('[data-key="' + key + '"]');
    if (cell) {
      cell.className = 'grille-cell etat-' + next;
      cell.dataset.action = 'grille-cell-toggle';
      cell.dataset.ensId  = ensId;
      cell.dataset.key    = key;
    }
    // Mettre à jour le récap
    _updateGrilleRecap(ensId);
  }

  function _updateGrilleRecap(ensId) {
    const cells  = DGHData.getGrilleIndispo(ensId).creneaux || {};
    const nbDure = Object.values(cells).filter(v => v === 'dure').length;
    const nbVoeu = Object.values(cells).filter(v => v === 'voeu').length;
    const el = document.querySelector('.grid-recap');
    if (!el) return;
    if (nbDure + nbVoeu === 0) { el.textContent = ''; return; }
    el.innerHTML =
      (nbDure > 0 ? '<span class="grid-recap-dure">' + nbDure + ' créneau' + (nbDure>1?'x':'') + ' indisponible' + (nbDure>1?'s':'') + '</span>' : '')
      + (nbDure > 0 && nbVoeu > 0 ? ' · ' : '')
      + (nbVoeu > 0 ? '<span class="grid-recap-voeu">' + nbVoeu + ' vœu' + (nbVoeu>1?'x':'') + '</span>' : '');
  }

  function grilleEnsChange(ensId) { _grilleEnsId = ensId; _renderIndispos(); }
  function grilleEnsReset(ensId)  { DGHData.setGrilleIndispo(ensId, {}); _renderIndispos(); app.toast('Grille réinitialisée.', 'info'); }

  // Garder les fonctions d'édition des contraintes libres (inchangées)
  // Les fonctions startAddIndispo / editIndispo / saveIndispo / deleteIndispo
  // sont conservées pour compatibilité mais le formulaire texte est retiré
  function startAddIndispo()  { /* remplacé par grille */ }
  function editIndispo(id)    { /* remplacé par grille */ }
  function cancelIndispo()    { _renderIndispos(); }

  function onIndispoPlageChange() {
    const plage = document.getElementById('inputIndispoPlage')?.value;
    const wrap  = document.getElementById('indispoCreneauWrap');
    if (wrap) wrap.classList.toggle('is-hidden', plage !== 'creneau');
  }

  function saveIndispo(id)   { /* remplacé par grille */ }
  function deleteIndispo(id) { DGHData.deleteIndisponibilite(id); _renderIndispos(); }

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
      + '<div class="edt-etab-section-header">'
        + '<h3 class="edt-synth-h3">Salles spécialisées</h3>'
        + (_editSalleId ? '' : '<button class="btn-primary btn-sm" data-action="salle-add">+ Ajouter une salle</button>')
      + '</div>'
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
  function grilleHbToggle(key) {
    const grille = DGHData.getGrilleHeureBleue();
    const cells  = Object.assign({}, grille.creneaux || {});
    const etat   = cells[key] || 'libre';
    const next   = etat === 'libre' ? 'candidat' : 'libre';
    if (next === 'libre') delete cells[key]; else cells[key] = next;
    DGHData.setGrilleHeureBleue(cells);
    // Mise à jour ciblée de la cellule
    const cell = document.querySelector('[data-action="grille-hb-toggle"][data-key="' + key + '"]');
    if (cell) cell.className = 'grille-cell grille-hb-cell etat-hb-' + next;
    // Récap
    const nb = Object.values(cells).filter(v => v === 'candidat').length;
    const recap = document.querySelector('.grid-recap-hb');
    if (recap) recap.textContent = nb + ' créneau' + (nb>1?'x':'') + ' candidat' + (nb>1?'s':'');
    // Activer/désactiver le bouton calculer
    const btnCalc = document.querySelector('[data-action="hb-calculer"]');
    if (btnCalc) btnCalc.disabled = nb === 0;
  }

  function hbResetGrille() {
    DGHData.setGrilleHeureBleue({});
    _renderContraintesEtab();
    app.toast('Grille heure bleue réinitialisée.', 'info');
  }

  // Garder pour compatibilité (le formulaire texte HB est retiré)
  function hbAddCreneau()      { /* remplacé par grille */ }
  function hbRemoveCreneau()   { /* remplacé par grille */ }
  function hbToggleActif(checked) { DGHData.setHeuresBleues({ actif: !!checked }); }

  function hbCalculer() {
    try {
      // Lire les créneaux candidats depuis la grille visuelle
      const grilleHB   = DGHData.getGrilleHeureBleue();
      const cellsHB    = grilleHB.creneaux || {};
      // Convertir la grille en format { jour, debut, fin }
      const creneauxCandidats = Object.entries(cellsHB)
        .filter(([,v]) => v === 'candidat')
        .map(([k]) => {
          const [jour, heure] = k.split('-');
          const h = parseInt(heure, 10);
          return { jour, debut: String(h).padStart(2,'0') + ':00', fin: String(h+1).padStart(2,'0') + ':00' };
        });
      const enseignants    = DGHData.getEnseignants();
      const contraintesEDT = DGHData.getContraintesEDT();
      const resultats = Calculs.creneauBleuOptimal(
        enseignants, contraintesEDT.indisponibilites || [], contraintesEDT.contraintesLibres || [], creneauxCandidats
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

  // ══════════════════════════════════════════════════════════════════
  // GÉNÉRATION GROUPÉE DE BARRETTES depuis scénario actif (Sprint 18)
  // ══════════════════════════════════════════════════════════════════

  function ouvrirModalGenBarrettes() {
    const scen = DGHData.getScenarioActif();
    const modal = document.getElementById('modalGenBarrettes');
    const body  = document.getElementById('modalGenBarrettesBody');
    if (!modal || !body) return;

    if (!scen) {
      body.innerHTML = '<div class="edt-empty"><p>Aucun scénario actif — activez un scénario dans le module Pilotage.</p></div>';
      modal.classList.add('modal-open');
      return;
    }

    const mods        = (scen.modificateurs || []).filter(m => m.type === 'dedoublement' && m.disciplineId && (m.classeIds||[]).length > 0);
    const disciplines  = DGHData.getDisciplines();
    const structures   = DGHData.getStructures();
    const enseignants  = DGHData.getEnseignants();
    const anneeData    = DGHData.getAnnee();
    const groupes      = DGHData.getGroupes();

    if (mods.length === 0) {
      body.innerHTML = '<div class="edt-empty"><p>Le scénario « ' + _esc(scen.nom) + ' » ne contient aucun dédoublement.</p></div>';
      modal.classList.add('modal-open');
      return;
    }

    // Vérifier si les groupes Gp.1/Gp.2 existent
    const classesSansGroupes = structures.filter(s => {
      const hasGp = groupes.some(g => (g.classeIds||[]).length===1 && g.classeIds[0]===s.id && /Gp\.?\s*[12]/i.test(g.nom));
      return !hasGp;
    });
    const warnGp = classesSansGroupes.length > 0
      ? '<div class="gen-warn">⚠ ' + classesSansGroupes.length + ' classe(s) sans groupes Gp.1/Gp.2 — les slots utiliseront des classes entières. <button class="btn-link" data-navigate="structures">Créer les groupes →</button></div>'
      : '';

    const rows = mods.map((m, i) => {
      const disc     = disciplines.find(d => d.id === m.disciplineId);
      const discNom  = disc ? disc.nom : '?';
      const clsNoms  = (m.classeIds||[]).map(id => structures.find(s=>s.id===id)?.nom||'?').join(', ');
      const ensIds   = Calculs.profsDeClasseDiscipline(anneeData, m.disciplineId, m.classeIds);
      const ensNoms  = ensIds.map(id => { const e=enseignants.find(en=>en.id===id); return e?_ensNomCourt(e):'?'; }).join(', ');
      const warnEns  = ensIds.length < 2 ? '<span class="gen-warn-inline" title="Moins de 2 enseignants — vérifiez la répartition">⚠</span>' : '';

      // Niveaux distincts
      const niveaux = [...new Set((m.classeIds||[]).map(id => structures.find(s=>s.id===id)?.niveau).filter(Boolean))];

      return '<div class="gen-row" data-mod-id="' + m.id + '">'
        + '<label class="gen-check-label">'
          + '<input type="checkbox" class="gen-mod-check" value="' + m.id + '" checked> '
          + '<strong>' + _esc(discNom) + '</strong> ' + warnEns
          + ' <span class="gen-cls">' + _esc(clsNoms) + '</span>'
          + (ensNoms ? ' <span class="gen-ens">— ' + _esc(ensNoms) + '</span>' : '')
          + ' <span class="gen-h font-mono">' + (m.heuresParGroupe||0) + 'h/gr</span>'
        + '</label>'
        + '<div class="gen-granularite">'
          + '<label><input type="radio" name="granularite-' + i + '" value="niveau" checked> Par niveau</label>'
          + (niveaux.length <= 1 ? '' : '') // par niveau toujours disponible
          + '<label><input type="radio" name="granularite-' + i + '" value="classe"> Par classe</label>'
        + '</div>'
      + '</div>';
    }).join('');

    body.innerHTML = warnGp
      + '<p class="gen-intro">Sélectionnez les dédoublements à convertir en barrettes. Les slots seront pré-remplis avec les groupes Gp.1/Gp.2 si disponibles.</p>'
      + '<div class="gen-rows">' + rows + '</div>';

    modal.classList.add('modal-open');
  }

  function fermerModalGenBarrettes() {
    document.getElementById('modalGenBarrettes')?.classList.remove('modal-open');
  }

  function genererBarrettesGroupees() {
    const scen = DGHData.getScenarioActif();
    if (!scen) { fermerModalGenBarrettes(); return; }

    const mods       = (scen.modificateurs || []).filter(m => m.type === 'dedoublement');
    const disciplines = DGHData.getDisciplines();
    const structures  = DGHData.getStructures();
    const enseignants = DGHData.getEnseignants();
    const groupes     = DGHData.getGroupes();
    const anneeData   = DGHData.getAnnee();
    const repartition = DGHData.getRepartition();

    const rows = document.querySelectorAll('.gen-row');
    let nbCrees = 0;

    rows.forEach(row => {
      const check = row.querySelector('.gen-mod-check');
      if (!check || !check.checked) return;
      const modId = row.dataset.modId;
      const mod   = mods.find(m => m.id === modId);
      if (!mod) return;

      const radio = row.querySelector('input[type="radio"]:checked');
      const granularite = radio ? radio.value : 'niveau';

      const disc    = disciplines.find(d => d.id === mod.disciplineId);
      const discNom = disc ? disc.nom : '';
      const classeIds = mod.classeIds || [];

      // Grouper selon granularité
      let groupes_barrettes = [];
      if (granularite === 'niveau') {
        const parNiv = {};
        classeIds.forEach(cid => {
          const s = structures.find(st => st.id === cid);
          const niv = s ? s.niveau : '__';
          if (!parNiv[niv]) parNiv[niv] = [];
          parNiv[niv].push(cid);
        });
        groupes_barrettes = Object.entries(parNiv).map(([niv, ids]) => ({ label: niv, classeIds: ids }));
      } else {
        groupes_barrettes = classeIds.map(cid => {
          const s = structures.find(st => st.id === cid);
          return { label: s?.nom || cid, classeIds: [cid] };
        });
      }

      groupes_barrettes.forEach(grp => {
        const nomBarr = discNom + (grp.label ? ' — ' + grp.label : '') + ' (dédoublement)';

        // Construire slots : chercher groupes Gp.1/Gp.2 par classe
        const slots = [];
        grp.classeIds.forEach(cid => {
          const gpClasse = groupes.filter(g =>
            (g.classeIds||[]).length === 1 && g.classeIds[0] === cid && /Gp\.?\s*[12]/i.test(g.nom)
          ).sort((a,b) => a.nom.localeCompare(b.nom));

          const ensIdsClasse = Calculs.profsDeClasseDiscipline(anneeData, mod.disciplineId, [cid]);

          if (gpClasse.length >= 2) {
            // Slots groupes Gp.1 et Gp.2
            gpClasse.slice(0, 2).forEach((gp, gi) => {
              slots.push({
                type: 'groupe', ref: gp.id, nomLibre: '',
                ensIds: ensIdsClasse[gi] ? [ensIdsClasse[gi]] : [],
                frequence: 'hebdo', discId: mod.disciplineId
              });
            });
          } else {
            // Slot classe entière (pas de groupes définis)
            slots.push({
              type: 'classe', ref: cid, nomLibre: '',
              ensIds: ensIdsClasse.slice(0, 1),
              frequence: 'hebdo', discId: mod.disciplineId
            });
          }
        });

        DGHData.addBarrette({
          nom: nomBarr,
          disciplineIds: [mod.disciplineId],
          slots,
          commentaire: 'Généré depuis scénario « ' + scen.nom + ' »'
        });
        nbCrees++;
      });
    });

    fermerModalGenBarrettes();
    _prefillData = null;
    _editBarretteId = null;
    _renderBarrettes();
    app.toast(nbCrees + ' barrette' + (nbCrees>1?'s':'') + ' créée' + (nbCrees>1?'s':'') + '.', 'success');
  }

  // ══════════════════════════════════════════════════════════════════
  // VUE KANBAN + DRAG & DROP des slots entre barrettes (Sprint 18)
  // ══════════════════════════════════════════════════════════════════

  let _dragSlot = null; // { barretteId, slotIdx }

  function _htmlListeBarrettesKanban(barrettes, structures, groupes, enseignants, disciplines) {
    if (barrettes.length === 0) return '';
    const visible = barrettes.filter(b => b.id !== _editBarretteId);
    if (visible.length === 0) return '';

    const cards = visible.map(b => {
      const slots = b.slots || [];
      const discNoms = (b.disciplineIds||[]).map(did => disciplines.find(d=>d.id===did)?.nom||'?').join(' / ') || '—';

      const slotsHtml = slots.length === 0
        ? '<div class="kanban-empty-slot">Aucun cours</div>'
        : slots.map((s, si) => {
            const clsLabel  = _slotLabel(s, structures, groupes);
            const discLabel = s.discId ? (disciplines.find(d=>d.id===s.discId)?.nom||'') : '';
            const ensLabel  = (s.ensIds||[]).map(eid => {
              const e = enseignants.find(en=>en.id===eid);
              return e ? (e.prenom?e.prenom[0]+'. ':'')+e.nom : '?';
            }).join(', ');
            return '<div class="kanban-slot" draggable="true"'
              + ' data-action="kanban-drag-start" data-barrette-id="' + b.id + '" data-slot-idx="' + si + '">'
              + '<div class="kanban-slot-cls">' + _esc(clsLabel) + '</div>'
              + (discLabel ? '<div class="kanban-slot-disc">' + _esc(discLabel) + '</div>' : '')
              + (ensLabel  ? '<div class="kanban-slot-ens">' + _esc(ensLabel) + '</div>' : '')
              + '<span class="kanban-drag-handle">⠿</span>'
            + '</div>';
          }).join('')
        + '<div class="kanban-drop-zone" data-action="kanban-drop" data-barrette-id="' + b.id + '" data-slot-idx="' + slots.length + '">+ Déposer ici</div>';

      return '<div class="kanban-card" data-barrette-id="' + b.id + '">'
        + '<div class="kanban-card-header">'
          + '<span class="kanban-card-nom">' + _esc(b.nom||discNoms) + '</span>'
          + '<div class="edt-card-actions">'
            + '<button class="btn-icon" data-action="edt-edit-barrette" data-id="' + b.id + '" title="Modifier">✎</button>'
            + '<button class="btn-icon btn-icon-danger" data-action="edt-delete-barrette" data-id="' + b.id + '" title="Supprimer">✕</button>'
          + '</div>'
        + '</div>'
        + '<div class="kanban-slots" data-barrette-id="' + b.id + '">' + slotsHtml + '</div>'
        + (b.commentaire ? '<div class="kanban-comment">' + _esc(b.commentaire) + '</div>' : '')
      + '</div>';
    }).join('');

    return '<div class="kanban-board">' + cards + '</div>';
  }

  // Drag & drop handlers (appelés depuis app.js via event delegation sur mousedown/dragstart)
  function kanbanDragStart(barretteId, slotIdx) {
    _dragSlot = { barretteId, slotIdx: parseInt(slotIdx, 10) };
    document.querySelectorAll('.kanban-drop-zone').forEach(z => z.classList.add('drop-active'));
  }

  function kanbanDragEnd() {
    _dragSlot = null;
    document.querySelectorAll('.kanban-drop-zone').forEach(z => z.classList.remove('drop-active', 'drop-over'));
  }

  function kanbanDragOver(e, targetBarretteId, targetSlotIdx) {
    if (!_dragSlot) return;
    e.preventDefault();
    document.querySelectorAll('.kanban-drop-zone').forEach(z => z.classList.remove('drop-over'));
    const zone = document.querySelector('.kanban-drop-zone[data-barrette-id="' + targetBarretteId + '"][data-slot-idx="' + targetSlotIdx + '"]');
    if (zone) zone.classList.add('drop-over');
  }

  function kanbanDrop(targetBarretteId, targetSlotIdx) {
    if (!_dragSlot) return;
    const { barretteId: srcBarrId, slotIdx: srcIdx } = _dragSlot;
    const tgtIdx = parseInt(targetSlotIdx, 10);

    // Ne rien faire si même position
    if (srcBarrId === targetBarretteId && srcIdx === tgtIdx) { kanbanDragEnd(); return; }

    const barrettes   = DGHData.getBarrettes();
    const srcBarr     = barrettes.find(b => b.id === srcBarrId);
    const tgtBarr     = barrettes.find(b => b.id === targetBarretteId);
    if (!srcBarr || !tgtBarr) { kanbanDragEnd(); return; }

    const srcSlots = srcBarr.slots.slice();
    const tgtSlots = srcBarrId === targetBarretteId ? srcSlots : tgtBarr.slots.slice();

    const [movedSlot] = srcSlots.splice(srcIdx, 1);

    // Ajuster l'index cible si même barrette et index décalé
    let adjustedIdx = tgtIdx;
    if (srcBarrId === targetBarretteId && srcIdx < tgtIdx) adjustedIdx = Math.max(0, tgtIdx - 1);
    tgtSlots.splice(adjustedIdx, 0, movedSlot);

    if (srcBarrId === targetBarretteId) {
      DGHData.updateBarrette(srcBarrId, { slots: tgtSlots });
    } else {
      DGHData.updateBarrette(srcBarrId, { slots: srcSlots });
      DGHData.updateBarrette(targetBarretteId, { slots: tgtSlots });
    }

    kanbanDragEnd();
    _renderBarrettes();
    app.toast('Slot déplacé.', 'success');
  }

  // ── API PUBLIQUE ───────────────────────────────────────────────────
  return {
    renderEdt, switchTab,
    startAddBarrette, editBarrette, cancelBarrette, saveBarrette, deleteBarrette,
    importerDedoublementBarrette,
    ouvrirModalGenBarrettes, fermerModalGenBarrettes, genererBarrettesGroupees,
    kanbanDragStart, kanbanDragEnd, kanbanDragOver, kanbanDrop,
    onBarrDiscChange, barrAddSlot, barrRemoveSlot, barrSlotTypeChange,
    startAddCoInterv, editCoInterv, cancelCoInterv, saveCoInterv, deleteCoInterv,
    startAddIndispo, editIndispo, cancelIndispo, saveIndispo, deleteIndispo, onIndispoPlageChange,
    startAddClibre, editClibre, cancelClibre, saveClibre, deleteClibre,
    // Onglet Indispos — grille (Sprint 16bis)
    grilleToggleCell, grilleEnsChange, grilleEnsReset, grilleHbToggle, hbResetGrille,
    // Onglet Contraintes établissement (Sprint 15)
    startAddSalleEdt, editSalleEdt, cancelSalleEdt, saveSalleEdt, deleteSalleEdt,
    etabJourToggle, etabMercrediToggle, etabHoraireChange,
    hbAddCreneau, hbRemoveCreneau, hbToggleActif, hbCalculer,
    printSynthese
  };

})();
