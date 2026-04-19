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

  return {
    renderStructures,
    openModalMatrice, closeModalMatrice, saveModalMatrice,
    openModalDiv, closeModalDiv, saveModalDiv,
    confirmDeleteDiv, closeConfirmDiv, execDeleteDiv,
    updateDupPreview
  };

})();
