/**
 * DGH App — Module Structures
 * Rendu du tableau des divisions et modales associées.
 */

const DGHStructures = (() => {

  // ── RENDU PRINCIPAL ───────────────────────────────────────────────
  function renderStructures() {
    try {
      const structures = DGHData.getStructures();
      const resume     = Calculs.resumeStructures(structures);

      _set('struct-kpi-divisions', resume.nbDivisions);
      _set('struct-kpi-effectif',  resume.effectifTotal);
      const niveauxEl = document.getElementById('struct-kpi-niveaux');
      if (niveauxEl) niveauxEl.textContent = resume.niveauxPresents.join(', ') || '—';

      // Tableau récap par niveau
      const niveauCard = document.getElementById('structNiveauCard');
      const niveauBody = document.getElementById('structNiveauBody');
      const niveauFoot = document.getElementById('structNiveauFoot');
      if (niveauCard) niveauCard.classList.toggle('is-hidden', resume.parNiveau.length === 0);
      if (niveauBody) {
        niveauBody.innerHTML = resume.parNiveau.map(n =>
          '<tr>'
          + '<td><span class="niveau-badge niveau-' + n.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + n.niveau + '</span></td>'
          + '<td class="col-num">' + n.nbDivisions + '</td>'
          + '<td class="col-num">' + n.effectif + '</td>'
          + '<td class="col-num font-mono">' + (n.hTheoriqueDiv > 0 ? n.hTheoriqueDiv + ' h' : '—') + '</td>'
          + '<td class="col-num"><strong class="font-mono">' + (n.hTheoriqueTotal > 0 ? n.hTheoriqueTotal + ' h' : '—') + '</strong></td>'
          + '</tr>'
        ).join('');
      }
      if (niveauFoot && resume.parNiveau.length > 0) {
        niveauFoot.innerHTML = '<tr class="struct-total-row">'
          + '<td><strong>Total</strong></td>'
          + '<td class="col-num"><strong>' + resume.nbDivisions + '</strong></td>'
          + '<td class="col-num"><strong>' + resume.effectifTotal + '</strong></td>'
          + '<td class="col-num">—</td>'
          + '<td class="col-num"><strong class="font-mono" style="color:var(--c-accent)">' + resume.hTheoriqueTotal + ' h</strong></td>'
          + '</tr>';
      }

      // KPI niveaux résumé sidebar
      const byNiveauEl = document.getElementById('struct-by-niveau');
      if (byNiveauEl) {
        byNiveauEl.innerHTML = resume.parNiveau.map(n =>
          '<div class="niveau-row"><span class="niveau-badge niveau-' + n.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + n.niveau + '</span>'
          + '<span class="niveau-count">' + n.nbDivisions + ' div.</span>'
          + '<span class="niveau-effectif">' + n.effectif + ' élèves</span></div>'
        ).join('');
      }

      // Liste divisions
      const listEl = document.getElementById('struct-list'); if (!listEl) return;
      if (structures.length === 0) {
        listEl.innerHTML = '<div class="struct-empty"><div class="struct-empty-icon">⊞</div>'
          + '<p>Aucune division saisie.</p>'
          + '<p class="struct-empty-sub">Utilisez \u00ab\u00a0Saisie rapide\u00a0\u00bb pour créer toutes vos divisions en une fois.</p></div>';
        return;
      }

      // Map divisionId → noms des groupes/HPC associés
      const annData  = DGHData.getAnnee();
      const classeNomsMap = {};
      (annData.repartition||[]).forEach(r => {
        (r.groupesCours||[]).forEach(gc => {
          (gc.classesIds||[]).forEach(id => {
            if (!classeNomsMap[id]) classeNomsMap[id] = [];
            if (gc.nom) classeNomsMap[id].push(gc.nom);
          });
        });
      });
      (annData.heuresPedaComp||[]).forEach(h => {
        (h.classesIds||[]).forEach(id => {
          if (!classeNomsMap[id]) classeNomsMap[id] = [];
          if (h.nom) classeNomsMap[id].push(h.nom);
        });
      });

      let html = '<table class="struct-table"><thead><tr><th>Division</th><th>Niveau</th><th>Effectif</th><th>Dispositif / Groupes</th><th class="col-actions">Actions</th></tr></thead><tbody>';
      structures.forEach(div => {
        const tags = [];
        if (div.dispositif) tags.push('<span class="div-tag div-tag-disp">' + _esc(div.dispositif) + '</span>');
        (classeNomsMap[div.id]||[]).forEach(nom => {
          tags.push('<span class="div-tag div-tag-struct">' + _esc(nom) + '</span>');
        });
        const dispTag = tags.length > 0 ? tags.join(' ') : '<span class="no-tag">—</span>';
        html += '<tr>'
          + '<td><strong class="div-nom">' + _esc(div.nom||'—') + '</strong></td>'
          + '<td><span class="niveau-badge niveau-' + div.niveau.toLowerCase().replace(/[^a-z0-9]/g,'') + '">' + _esc(div.niveau) + '</span></td>'
          + '<td><span class="div-effectif">' + (div.effectif||0) + '</span></td>'
          + '<td>' + dispTag + '</td>'
          + '<td class="col-actions"><button class="btn-icon-sm" data-action="edit-div" data-id="' + div.id + '" title="Modifier">✎</button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-action="delete-div" data-id="' + div.id + '" title="Supprimer">✕</button></td></tr>';
      });
      listEl.innerHTML = html + '</tbody></table>';
    } catch(e) { console.error('[DGH] renderStructures:', e); }
  }

  // ── MODAL SAISIE MATRICIELLE ──────────────────────────────────────
  function openModalMatrice() {
    const modal = document.getElementById('modalMatrice'); if (!modal) return;
    const body  = document.getElementById('matriceBody');  if (!body)  return;
    const niveaux    = ['6e', '5e', '4e', '3e'];
    const structures = DGHData.getStructures();
    body.innerHTML = niveaux.map(niv => {
      const ex  = structures.filter(d => d.niveau === niv);
      const eff = ex.length > 0 ? Math.round(ex.reduce((s,d)=>s+(d.effectif||0),0)/ex.length) : '';
      return '<tr>'
        + '<td><span class="niveau-badge niveau-' + niv.toLowerCase() + '">' + niv + '</span></td>'
        + '<td><input type="number" class="matrice-input" data-niveau="' + niv + '" data-field="nb" value="' + ex.length + '" min="0" max="20" step="1" /></td>'
        + '<td><input type="number" class="matrice-input" data-niveau="' + niv + '" data-field="eff" value="' + eff + '" min="0" max="99" step="1" placeholder="28" /></td>'
        + '</tr>';
    }).join('');
    const cbRemp = document.getElementById('matriceRemplacer');
    if (cbRemp) cbRemp.checked = false;
    modal.classList.add('modal-open');
    modal.querySelector('.matrice-input')?.focus();
  }

  function closeModalMatrice() {
    const m = document.getElementById('modalMatrice'); if(m) m.classList.remove('modal-open');
  }

  function saveModalMatrice() {
    const niveaux = ['6e','5e','4e','3e'];
    const matrice = niveaux.map(niv => ({
      niveau: niv,
      nbDivisions:   parseInt(document.querySelector('[data-niveau="'+niv+'"][data-field="nb"]')?.value,10)||0,
      effectifMoyen: parseInt(document.querySelector('[data-niveau="'+niv+'"][data-field="eff"]')?.value,10)||0
    })).filter(l => l.nbDivisions > 0);
    if (matrice.length === 0) { app.toast('Indiquez au moins un niveau', 'warning'); return; }
    const remplacer = document.getElementById('matriceRemplacer')?.checked || false;
    DGHData.appliquerMatrice(matrice, remplacer);
    closeModalMatrice(); renderStructures(); DGHDashboard.renderDashboard();
    app.toast(matrice.reduce((s,l)=>s+l.nbDivisions,0) + ' division(s) générée(s)', 'success');
  }

  // ── MODAL DIVISION ────────────────────────────────────────────────
  function openModalDiv(id) {
    const modal = document.getElementById('modalDiv'); if (!modal) return;
    const dupGroup = document.getElementById('dupGroup');
    if (id) {
      const div = DGHData.getDivision(id); if (!div) return;
      _set('modalDivTitle','Modifier la division'); _setVal('modalDivId',id);
      _setVal('inputDivNiveau',div.niveau); _setVal('inputDivNom',div.nom);
      _setVal('inputDivEffectif',div.effectif); _setVal('inputDivDispositif',div.dispositif||'');
      if (dupGroup) dupGroup.classList.add('is-hidden');
    } else {
      _set('modalDivTitle','Ajouter une division'); _setVal('modalDivId','');
      _setVal('inputDivNiveau','6e'); _setVal('inputDivNom','');
      _setVal('inputDivEffectif',''); _setVal('inputDivDispositif',''); _setVal('inputDivDup','0');
      if (dupGroup) dupGroup.classList.remove('is-hidden');
    }
    modal.classList.add('modal-open');
    setTimeout(()=>document.getElementById('inputDivNom')?.focus(),60);
  }

  function closeModalDiv() {
    const m=document.getElementById('modalDiv'); if(m) m.classList.remove('modal-open');
    const p=document.getElementById('dupPreview'); if(p) p.innerHTML='';
  }

  function saveModalDiv() {
    const id  = document.getElementById('modalDivId')?.value||'';
    const nom = (document.getElementById('inputDivNom')?.value||'').trim();
    if (!nom) { app.toast('Le nom est requis','warning'); return; }
    const fields = {
      niveau:      document.getElementById('inputDivNiveau')?.value||'6e',
      nom,
      effectif:    parseInt(document.getElementById('inputDivEffectif')?.value,10)||0,
      options:     [],
      dispositif:  document.getElementById('inputDivDispositif')?.value||null
    };
    const dup = parseInt(document.getElementById('inputDivDup')?.value,10)||0;
    if (id) {
      DGHData.updateDivision(id, fields);
      app.toast('Division mise à jour','success');
    } else {
      const created = DGHData.addDivision(fields);
      if (dup > 0) {
        const c = DGHData.duplicateDivisions(created.id, dup);
        app.toast(nom + ' + ' + c.length + ' copie(s)','success');
      } else {
        app.toast('Division \u00ab\u00a0' + nom + '\u00a0\u00bb ajoutée','success');
      }
    }
    closeModalDiv(); renderStructures(); DGHDashboard.renderDashboard();
  }

  function confirmDeleteDiv(id) {
    const div = DGHData.getDivision(id); if (!div) return;
    const m   = document.getElementById('confirmDiv'); if (!m) return;
    _set('confirmDivMsg','Supprimer \u00ab\u00a0' + div.nom + '\u00a0\u00bb (niveau ' + div.niveau + ') ?');
    m.dataset.targetId = id; m.classList.add('modal-open');
  }

  function closeConfirmDiv() {
    const m=document.getElementById('confirmDiv'); if(m){m.classList.remove('modal-open');m.dataset.targetId='';}
  }

  function execDeleteDiv() {
    const id=document.getElementById('confirmDiv')?.dataset?.targetId; if(!id) return;
    DGHData.deleteDivision(id); closeConfirmDiv(); renderStructures(); DGHDashboard.renderDashboard();
    app.toast('Division supprimée','info');
  }

  // ── PREVIEW DUPLICATION ───────────────────────────────────────────
  function updateDupPreview() {
    const preview = document.getElementById('dupPreview'); if (!preview) return;
    const nom = (document.getElementById('inputDivNom')?.value||'').trim();
    const dup = parseInt(document.getElementById('inputDivDup')?.value,10)||0;
    if (!nom || dup <= 0) { preview.innerHTML=''; return; }
    const noms=[nom]; let cur=nom;
    for(let i=0;i<dup;i++){cur=_previewNextName(cur);noms.push(cur);}
    preview.innerHTML='<span class="dup-preview-label">Sera créé\u00a0:</span>'+noms.map(n=>'<span class="dup-preview-chip">'+_esc(n)+'</span>').join('');
  }

  function _previewNextName(nom){
    const nm=nom.match(/^(.*?)(\d+)$/);
    if(nm){const n=parseInt(nm[2],10)+1;return nm[1]+(nm[2].length>1?String(n).padStart(nm[2].length,'0'):String(n));}
    const lm=nom.match(/^(.*?)([A-Z]+)$/);if(lm)return lm[1]+_nextAlpha(lm[2]);
    const ll=nom.match(/^(.*?)([a-z]+)$/);if(ll)return ll[1]+_nextAlpha(ll[2].toUpperCase()).toLowerCase();
    return nom+'2';
  }
  function _nextAlpha(s){
    const c=s.split('');let i=c.length-1;
    while(i>=0){const code=c[i].charCodeAt(0);if(code<90){c[i]=String.fromCharCode(code+1);return c.join('');}c[i]='A';i--;}
    return 'A'+c.join('');
  }

  // ── UTILITAIRES LOCAUX ────────────────────────────────────────────
  function _set(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
  function _setVal(id,val){const el=document.getElementById(id);if(el)el.value=val;}
  function _esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  // ══════════════════════════════════════════════════════════════════
  // SECTION GROUPES (v3.8)
  // ══════════════════════════════════════════════════════════════════

  let _editGroupeId = null;

  /**
   * Rend la section groupes dans la vue Structures.
   * Appelé par renderStructures() et directement après chaque CRUD.
   */
  function renderGroupes() {
    const el = document.getElementById('structGroupesWrap');
    if (!el) return;
    const groupes     = DGHData.getGroupes();
    const structures  = DGHData.getStructures();
    const disciplines = DGHData.getDisciplines();

    const formHtml = _editGroupeId
      ? _htmlFormGroupe(structures, disciplines, groupes.find(g => g.id === _editGroupeId) || null)
      : '';

    let listHtml = '';
    if (groupes.length === 0 && !_editGroupeId) {
      listHtml = '<div class="struct-groupes-empty">'
        + '<p>Aucun groupe défini.</p>'
        + '<p class="struct-groupes-hint">Les groupes permettent de représenter des demi-classes (dédoublements) '
        + 'ou des groupes inter-classes (bilangue, groupes de besoins…). '
        + 'Ils sont utilisés dans les barrettes EDT et le Pilotage pédagogique.</p>'
        + '</div>';
    } else {
      // Séparer mono-classe et inter-classes
      const mono  = groupes.filter(g => (g.classeIds||[]).length <= 1);
      const inter = groupes.filter(g => (g.classeIds||[]).length  > 1);

      listHtml = '<div class="struct-groupes-list">';

      if (inter.length > 0) {
        listHtml += '<div class="struct-groupes-section-label">Groupes inter-classes / inter-niveaux</div>';
        listHtml += inter.map(g => _htmlGroupeCard(g, structures, disciplines)).join('');
      }
      if (mono.length > 0) {
        listHtml += '<div class="struct-groupes-section-label">Groupes mono-classe (dédoublements)</div>';
        // Regrouper par classe
        const parClasse = {};
        mono.forEach(g => {
          const cid = (g.classeIds||[])[0] || '__libre__';
          if (!parClasse[cid]) parClasse[cid] = [];
          parClasse[cid].push(g);
        });
        Object.keys(parClasse).forEach(cid => {
          const cls = structures.find(s => s.id === cid);
          listHtml += '<div class="struct-groupes-classe-bloc">';
          if (cls) listHtml += '<span class="struct-groupes-classe-label">' + _esc(cls.nom) + '</span>';
          listHtml += parClasse[cid].map(g => _htmlGroupeCard(g, structures, disciplines)).join('');
          listHtml += '</div>';
        });
      }
      listHtml += '</div>';
    }

    el.innerHTML = genBannerHtml + formHtml + listHtml;
  }

  function _htmlGroupeCard(g, structures, disciplines) {
    if (g.id === _editGroupeId) return '';
    const clsNoms  = (g.classeIds||[]).map(id => structures.find(s=>s.id===id)?.nom||'?').join(', ') || '—';
    const discNoms = (g.disciplineIds||[]).map(id => disciplines.find(d=>d.id===id)?.nom||'?').join(', ') || '—';
    const isInter  = (g.classeIds||[]).length > 1;
    return '<div class="struct-groupe-card' + (isInter ? ' struct-groupe-inter' : '') + '">'
      + '<div class="struct-groupe-header">'
        + '<span class="struct-groupe-nom">' + _esc(g.nom||'Groupe sans nom') + '</span>'
        + (g.effectif > 0 ? '<span class="struct-groupe-effectif">' + g.effectif + ' élèves</span>' : '')
        + '<div class="struct-groupe-actions">'
          + '<button class="btn-icon" data-action="struct-edit-groupe" data-id="' + g.id + '" title="Modifier">✎</button>'
          + '<button class="btn-icon btn-icon-danger" data-action="struct-delete-groupe" data-id="' + g.id + '" title="Supprimer">✕</button>'
        + '</div>'
      + '</div>'
      + '<div class="struct-groupe-meta">'
        + '<span class="struct-groupe-meta-item"><span class="struct-groupe-meta-lbl">Classes</span> ' + _esc(clsNoms) + '</span>'
        + (discNoms !== '—' ? '<span class="struct-groupe-meta-item"><span class="struct-groupe-meta-lbl">Disciplines</span> ' + _esc(discNoms) + '</span>' : '')
        + (g.commentaire ? '<span class="struct-groupe-meta-item edt-barrette-comment">' + _esc(g.commentaire) + '</span>' : '')
      + '</div>'
    + '</div>';
  }

  function _htmlFormGroupe(structures, disciplines, editData) {
    const nom     = editData?.nom || '';
    const effectif = editData?.effectif ?? '';
    const comment = editData?.commentaire || '';
    const clsSel  = new Set(editData?.classeIds    || []);
    const discSel = new Set(editData?.disciplineIds || []);

    // Classes groupées par niveau
    const parNiv = {};
    structures.forEach(s => { if (!parNiv[s.niveau]) parNiv[s.niveau]=[]; parNiv[s.niveau].push(s); });
    const niveauxOrd = ['6e','5e','4e','3e','SEGPA','ULIS','UPE2A'];
    const clsHtml = niveauxOrd.filter(n => parNiv[n]?.length).map(niv =>
      '<div class="edt-form-niv"><span class="edt-form-niv-label">' + niv + '</span>'
        + parNiv[niv].map(s =>
            '<label class="mod-classe-label"><input type="checkbox" class="sg-classe-check" value="' + s.id + '"'
              + (clsSel.has(s.id)?' checked':'') + '> ' + _esc(s.nom) + '</label>'
          ).join('')
      + '</div>'
    ).join('') || '<span class="edt-empty-hint">Aucune division. Créez d\'abord vos classes.</span>';

    const discHtml = disciplines.length === 0
      ? '<span class="edt-empty-hint">Aucune discipline.</span>'
      : disciplines.map(d =>
          '<label class="mod-classe-label"><input type="checkbox" class="sg-disc-check" value="' + d.id + '"'
            + (discSel.has(d.id)?' checked':'') + '> ' + _esc(d.nom) + '</label>'
        ).join('');

    const saveAttr = editData ? ' data-id="' + editData.id + '"' : '';

    return '<div class="edt-form" id="structGroupeForm">'
      + '<div class="edt-form-title">' + (editData ? 'Modifier le groupe' : 'Nouveau groupe') + '</div>'
      + '<div class="edt-form-grid">'
        + '<div class="edt-form-col">'
          + '<div class="edt-form-field"><label>Nom du groupe <span class="edt-form-req">*</span></label>'
            + '<input type="text" id="sgNom" value="' + _esc(nom) + '" placeholder="Ex : Gp1 3eA, Bilangue 6e…" /></div>'
          + '<div class="edt-form-field"><label>Effectif</label>'
            + '<input type="number" id="sgEffectif" value="' + _esc(String(effectif)) + '" min="0" max="200" placeholder="Nb élèves" /></div>'
          + '<div class="edt-form-field"><label>Commentaire</label>'
            + '<input type="text" id="sgComment" value="' + _esc(comment) + '" placeholder="Précisions…" /></div>'
          + '<div class="edt-form-field"><label>Disciplines concernées</label>'
            + '<div class="edt-check-list">' + discHtml + '</div></div>'
        + '</div>'
        + '<div class="edt-form-col">'
          + '<div class="edt-form-field"><label>Classes concernées <span class="edt-form-req">*</span>'
            + ' <span class="edt-form-hint">(plusieurs = inter-classes)</span></label>'
            + '<div class="edt-check-list">' + clsHtml + '</div></div>'
        + '</div>'
      + '</div>'
      + '<div class="edt-form-actions">'
        + '<button class="btn-primary" data-action="struct-save-groupe"' + saveAttr + '>Enregistrer ✓</button>'
        + '<button class="btn-secondary" data-action="struct-cancel-groupe">Annuler</button>'
      + '</div>'
    + '</div>';
  }

  // ── Génération rapide Gp.1/Gp.2 pour toutes les classes ───────────
  function _htmlGenGroupesRapides(structures, groupes) {
    // Trouver quelles classes ont déjà des groupes Gp.1 / Gp.2
    const dejaGp = new Set();
    groupes.forEach(g => {
      if ((g.classeIds||[]).length === 1 && (g.nom||'').match(/Gp\.\s*[12]/i)) {
        dejaGp.add(g.classeIds[0]);
      }
    });
    const total       = structures.length;
    const manquantes  = structures.filter(s => !dejaGp.has(s.id));
    const deja        = structures.filter(s => dejaGp.has(s.id));

    const btnDisabled = manquantes.length === 0 ? ' disabled' : '';
    const btnLabel    = manquantes.length === 0
      ? '\u2714 Tous les groupes Gp.1/Gp.2 sont d\u00e9j\u00e0 cr\u00e9\u00e9s'
      : '\u26a1 G\u00e9n\u00e9rer Gp.1 / Gp.2 pour toutes les classes (' + manquantes.length + ' classe' + (manquantes.length > 1 ? 's' : '') + ')';

    const detail = deja.length > 0
      ? '<span class="sg-rapide-detail">D\u00e9j\u00e0 cr\u00e9\u00e9s\u00a0: ' + deja.map(s => _esc(s.nom)).join(', ') + '</span>'
      : '';

    return '<div class="sg-rapide-banner">'
      + '<div class="sg-rapide-left">'
        + '<span class="sg-rapide-icon">\u{1F4A1}</span>'
        + '<div class="sg-rapide-info">'
          + '<span class="sg-rapide-titre">G\u00e9n\u00e9ration rapide — demi-classes</span>'
          + '<span class="sg-rapide-hint">Cr\u00e9e Gp.1 et Gp.2 pour chaque division en un clic</span>'
          + detail
        + '</div>'
      + '</div>'
      + '<button class="btn-primary btn-sm sg-rapide-btn" data-action="sg-generer-groupes-rapides"' + btnDisabled + '>'
        + btnLabel
      + '</button>'
    + '</div>';
  }

  function genererGroupesRapides() {
    const structures  = DGHData.getStructures();
    const groupes     = DGHData.getGroupes();
    const dejaGp      = new Set();
    groupes.forEach(g => {
      if ((g.classeIds||[]).length === 1 && (g.nom||'').match(/Gp\.\s*[12]/i)) {
        dejaGp.add(g.classeIds[0]);
      }
    });
    const manquantes = structures.filter(s => !dejaGp.has(s.id));
    if (manquantes.length === 0) { app.toast('Tous les groupes Gp.1/Gp.2 existent d\u00e9j\u00e0.', 'info'); return; }

    let nb = 0;
    manquantes.forEach(s => {
      DGHData.addGroupe({ nom: s.nom + ' Gp.1', classeIds: [s.id], effectif: 0, disciplineIds: [] });
      DGHData.addGroupe({ nom: s.nom + ' Gp.2', classeIds: [s.id], effectif: 0, disciplineIds: [] });
      nb++;
    });
    renderGroupes();
    app.toast(nb * 2 + ' groupes cr\u00e9\u00e9s (Gp.1/Gp.2 pour ' + nb + ' classe' + (nb > 1 ? 's' : '') + ').', 'success');
  }

  function startAddGroupe()  { _editGroupeId = '__new__'; renderGroupes(); document.getElementById('sgNom')?.focus(); }
  function editGroupe(id)    { _editGroupeId = id;        renderGroupes(); document.getElementById('sgNom')?.focus(); }
  function cancelGroupe()    { _editGroupeId = null;      renderGroupes(); }

  function saveGroupe(id) {
    const nom      = document.getElementById('sgNom')?.value.trim() || '';
    const effectif = parseInt(document.getElementById('sgEffectif')?.value || '0', 10) || 0;
    const comment  = document.getElementById('sgComment')?.value.trim() || '';
    const classeIds    = Array.from(document.querySelectorAll('.sg-classe-check:checked')).map(c => c.value);
    const disciplineIds= Array.from(document.querySelectorAll('.sg-disc-check:checked')).map(c => c.value);
    if (!nom)                 { app.toast('Le nom du groupe est obligatoire.', 'warning'); return; }
    if (classeIds.length === 0){ app.toast('Sélectionnez au moins une classe.', 'warning'); return; }
    const fields = { nom, classeIds, effectif, disciplineIds, commentaire: comment };
    if (id && id !== '__new__') { DGHData.updateGroupe(id, fields); app.toast('Groupe mis à jour.', 'success'); }
    else                        { DGHData.addGroupe(fields);        app.toast('Groupe ajouté.', 'success'); }
    _editGroupeId = null;
    renderGroupes();
  }

  function deleteGroupe(id) {
    if (!confirm('Supprimer ce groupe ?')) return;
    DGHData.deleteGroupe(id);
    renderGroupes();
    app.toast('Groupe supprimé.', 'info');
  }

  return {
    renderStructures,
    openModalMatrice, closeModalMatrice, saveModalMatrice,
    openModalDiv, closeModalDiv, saveModalDiv,
    confirmDeleteDiv, closeConfirmDiv, execDeleteDiv,
    updateDupPreview,
    renderGroupes, startAddGroupe, editGroupe, cancelGroupe, saveGroupe, deleteGroupe,
    genererGroupesRapides
  };

})();
