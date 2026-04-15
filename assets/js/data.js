/**
 * DGH App — Couche données v2.0.0
 * SEUL fichier qui touche localStorage
 * RGPD : aucune donnée envoyée vers l'extérieur
 *
 * v2.0.0 — Sprint 4 :
 *   - Suppression d'une année complète
 *   - HP (heures-poste) + HSA distincts dans la répartition
 *   - Saisie matricielle des structures (grille rapide par niveau)
 *   - Module Groupes & activités
 *   - Disciplines MEN pré-chargées
 */

const DGHData = (() => {

  const KEY     = 'dgh-app-data';
  const VERSION = '2.0.0';

  const NIVEAUX = ['6e', '5e', '4e', '3e', 'UPE2A'];

  // Disciplines MEN standard — BO spécial n°11 du 26 novembre 2015
  const DISCIPLINES_MEN = [
    { nom: 'Français',                couleur: '#3b82f6' },
    { nom: 'Mathématiques',           couleur: '#22c55e' },
    { nom: 'Histoire-Géographie',     couleur: '#f59e0b' },
    { nom: 'LV1',                     couleur: '#8b5cf6' },
    { nom: 'LV2',                     couleur: '#a78bfa' },
    { nom: 'SVT',                     couleur: '#10b981' },
    { nom: 'Physique-Chimie',         couleur: '#06b6d4' },
    { nom: 'Technologie',             couleur: '#64748b' },
    { nom: 'Sciences et Technologie', couleur: '#0ea5e9' },
    { nom: 'Arts plastiques',         couleur: '#ec4899' },
    { nom: 'Éducation musicale',      couleur: '#f43f5e' },
    { nom: 'EPS',                     couleur: '#ef4444' },
    { nom: 'EMC',                     couleur: '#6366f1' },
    { nom: 'AP',                      couleur: '#14b8a6' },
    { nom: 'Documentation',           couleur: '#78716c' },
    { nom: 'Latin',                   couleur: '#d97706' },
    { nom: 'Grec',                    couleur: '#b45309' },
  ];

  const TYPES_GROUPE = [
    { value: 'option-langue',  label: 'Option de langue (LV2, LV3, Latin, Grec…)' },
    { value: 'groupe-besoin',  label: 'Groupe de besoin / dédoublement' },
    { value: 'activite',       label: 'Activité (Chorale, UNSS, Atelier…)' },
    { value: 'labo',           label: 'Heure de laboratoire / travaux pratiques' },
    { value: 'ap',             label: 'Accompagnement personnalisé (AP)' },
    { value: 'autre',          label: 'Autre' },
  ];

  function _schema() {
    return {
      _meta: { version: VERSION, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      etablissement: { nom: '', uai: '', academie: '', commune: '' },
      annees: { '2025-2026': _annee('2025-2026') },
      anneeActive: '2025-2026'
    };
  }

  function _annee(annee) {
    return {
      annee,
      createdAt: new Date().toISOString(),
      dotation: { enveloppe: 0, commentaire: '' },
      structures: [],
      grilles: {},
      disciplines: [],
      repartition: [],
      groupes: [],
      enseignants: [],
      simulation: { active: false, nom: '', dotation: null, repartition: [], enseignants: [] },
      alertes: []
    };
  }

  let _data = null;

  function init() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { _data = JSON.parse(raw); _migrate(); }
      catch(e) { _data = _schema(); save(); }
    } else {
      _data = _schema(); save();
    }
  }

  function _migrate() {
    if (!_data._meta) _data._meta = {};
    if (_data.annees) {
      Object.values(_data.annees).forEach(ann => {
        if (!Array.isArray(ann.structures)) ann.structures = [];
        ann.structures.forEach(div => {
          if (!Array.isArray(div.options))      div.options    = [];
          if (div.dispositif === undefined)     div.dispositif = null;
          if (typeof div.effectif !== 'number') div.effectif   = 0;
        });
        if (!Array.isArray(ann.disciplines)) ann.disciplines = [];
        if (!Array.isArray(ann.repartition)) ann.repartition = [];
        ann.repartition.forEach(r => {
          if (r.commentaire === undefined) r.commentaire = '';
          // Migration HP/HSA : ancien heuresAllouees → hPoste
          if (r.hPoste === undefined) { r.hPoste = r.heuresAllouees || 0; delete r.heuresAllouees; }
          if (r.hsa    === undefined) r.hsa = 0;
        });
        if (!Array.isArray(ann.groupes)) ann.groupes = [];
        ann.groupes.forEach(g => {
          if (!g.type)                 g.type         = 'autre';
          if (!g.disciplineId)         g.disciplineId = null;
          if (!Array.isArray(g.niveaux)) g.niveaux    = [];
          if (typeof g.heures   !== 'number') g.heures   = 0;
          if (typeof g.effectif !== 'number') g.effectif = 0;
          if (!g.commentaire) g.commentaire = '';
        });
      });
    }
    _data._meta.version = VERSION;
  }

  // ── GETTERS ──────────────────────────────────────────────────────
  function get()               { return _data; }
  function getEtab()           { return _data.etablissement; }
  function getAnneeActive()    { return _data.anneeActive; }
  function getAnnees()         { return Object.keys(_data.annees).sort().reverse(); }
  function getNiveaux()        { return NIVEAUX; }
  function getTypeGroupes()    { return TYPES_GROUPE; }
  function getDisciplinesMEN() { return DISCIPLINES_MEN.slice(); }

  function getAnnee(a) {
    const key = a || _data.anneeActive;
    if (!_data.annees[key]) _data.annees[key] = _annee(key);
    return _data.annees[key];
  }

  function getStructures(annee) { return (getAnnee(annee).structures || []).slice().sort(_sortDiv); }
  function getDivision(id, annee) { return (getAnnee(annee).structures || []).find(d => d.id === id) || null; }

  function _sortDiv(a, b) {
    const O = { '6e':0,'5e':1,'4e':2,'3e':3,'SEGPA':4,'ULIS':5,'UPE2A':6 };
    const na = O[a.niveau] ?? 99, nb = O[b.niveau] ?? 99;
    if (na !== nb) return na - nb;
    return (a.nom||'').localeCompare(b.nom||'','fr');
  }

  function getDisciplines(annee) {
    return (getAnnee(annee).disciplines || []).slice().sort((a,b) => (a.nom||'').localeCompare(b.nom||'','fr'));
  }
  function getDiscipline(id, annee) { return (getAnnee(annee).disciplines||[]).find(d=>d.id===id)||null; }

  function getRepartition(annee) {
    const ann = getAnnee(annee);
    return (ann.repartition||[]).map(r => {
      const disc = (ann.disciplines||[]).find(d=>d.id===r.disciplineId)||{};
      const hPoste = r.hPoste||0, hsa = r.hsa||0;
      return { disciplineId: r.disciplineId, nom: disc.nom||'—', couleur: disc.couleur||'#6b6860',
               hPoste, hsa, total: Math.round((hPoste+hsa)*2)/2, commentaire: r.commentaire||'' };
    });
  }

  function getGroupes(annee) {
    return (getAnnee(annee).groupes||[]).slice().sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr'));
  }
  function getGroupe(id, annee) { return (getAnnee(annee).groupes||[]).find(g=>g.id===id)||null; }

  // ── SETTERS ──────────────────────────────────────────────────────
  function setEtab(fields) { Object.assign(_data.etablissement, fields); save(); }

  function setAnneeActive(a) {
    if (!_data.annees[a]) _data.annees[a] = _annee(a);
    _data.anneeActive = a; save();
  }

  function setDotation(enveloppe, commentaire) {
    const ann = getAnnee();
    ann.dotation.enveloppe   = parseFloat(enveloppe)||0;
    ann.dotation.commentaire = commentaire||'';
    save();
  }

  // ── CRUD STRUCTURES ──────────────────────────────────────────────
  function addDivision(fields) {
    const ann = getAnnee();
    const div = { id: genId('div'), niveau: fields.niveau||'6e', nom: (fields.nom||'').trim(),
                  effectif: parseInt(fields.effectif,10)||0,
                  options: Array.isArray(fields.options)?fields.options.slice():[],
                  dispositif: fields.dispositif||null };
    ann.structures.push(div); save(); return div;
  }

  function updateDivision(id, fields) {
    const ann = getAnnee(); const idx = ann.structures.findIndex(d=>d.id===id);
    if (idx===-1) return false; const div = ann.structures[idx];
    if (fields.niveau!==undefined)     div.niveau     = fields.niveau;
    if (fields.nom!==undefined)        div.nom        = (fields.nom||'').trim();
    if (fields.effectif!==undefined)   div.effectif   = parseInt(fields.effectif,10)||0;
    if (fields.options!==undefined)    div.options    = Array.isArray(fields.options)?fields.options.slice():[];
    if (fields.dispositif!==undefined) div.dispositif = fields.dispositif||null;
    save(); return true;
  }

  function deleteDivision(id) {
    const ann = getAnnee(); const before = ann.structures.length;
    ann.structures = ann.structures.filter(d=>d.id!==id);
    if (ann.structures.length<before){save();return true;} return false;
  }

  /**
   * Saisie matricielle — génère les divisions à partir d'une grille par niveau.
   * @param {Array<{niveau,nbDivisions,effectifMoyen}>} matrice
   * @param {boolean} remplacer — si true, supprime et recrée
   */
  function appliquerMatrice(matrice, remplacer) {
    matrice.forEach(ligne => {
      if (!ligne.niveau || !(ligne.nbDivisions > 0)) return;
      const ann = getAnnee();
      if (remplacer) ann.structures = ann.structures.filter(d => d.niveau !== ligne.niveau);
      const existantes = ann.structures.filter(d => d.niveau === ligne.niveau).sort(_sortDiv);
      const aCreer     = Math.max(0, ligne.nbDivisions - existantes.length);
      const effectif   = parseInt(ligne.effectifMoyen, 10) || 0;
      if (!remplacer && effectif > 0) existantes.forEach(d => { d.effectif = effectif; });
      let dernierNom = existantes.length > 0 ? existantes[existantes.length-1].nom : null;
      for (let i = 0; i < aCreer; i++) {
        const nom = dernierNom ? _nextDivName(dernierNom) : ligne.niveau + 'A';
        addDivision({ niveau: ligne.niveau, nom, effectif, options: [], dispositif: null });
        dernierNom = nom;
      }
    });
    save();
  }

  // ── CRUD DISCIPLINES ─────────────────────────────────────────────
  function addDiscipline(fields) {
    const ann = getAnnee();
    const disc = { id: genId('disc'), nom: (fields.nom||'').trim(), couleur: fields.couleur||'#6b6860' };
    ann.disciplines.push(disc);
    ann.repartition.push({ disciplineId: disc.id, hPoste: 0, hsa: 0, commentaire: '' });
    save(); return disc;
  }

  function updateDiscipline(id, fields) {
    const ann = getAnnee(); const idx = ann.disciplines.findIndex(d=>d.id===id);
    if (idx===-1) return false; const disc = ann.disciplines[idx];
    if (fields.nom!==undefined)     disc.nom     = (fields.nom||'').trim();
    if (fields.couleur!==undefined) disc.couleur = fields.couleur;
    save(); return true;
  }

  function deleteDiscipline(id) {
    const ann = getAnnee(); const before = ann.disciplines.length;
    ann.disciplines = ann.disciplines.filter(d=>d.id!==id);
    ann.repartition = ann.repartition.filter(r=>r.disciplineId!==id);
    if (ann.disciplines.length<before){save();return true;} return false;
  }

  function initDisciplinesMEN() {
    const ann = getAnnee();
    const existants = new Set(ann.disciplines.map(d=>d.nom));
    let nb = 0;
    DISCIPLINES_MEN.forEach(d => { if (!existants.has(d.nom)) { addDiscipline(d); nb++; } });
    return nb;
  }

  function setRepartition(disciplineId, fields) {
    const ann = getAnnee();
    let ligne = ann.repartition.find(r=>r.disciplineId===disciplineId);
    if (!ligne) { ligne={disciplineId,hPoste:0,hsa:0,commentaire:''}; ann.repartition.push(ligne); }
    if (fields.hPoste!==undefined)      ligne.hPoste      = parseFloat(fields.hPoste)||0;
    if (fields.hsa!==undefined)         ligne.hsa         = parseFloat(fields.hsa)||0;
    if (fields.commentaire!==undefined) ligne.commentaire = fields.commentaire||'';
    save(); return true;
  }

  // ── CRUD GROUPES ─────────────────────────────────────────────────
  function addGroupe(fields) {
    const ann = getAnnee();
    const g = { id: genId('grp'), nom: (fields.nom||'').trim(), type: fields.type||'autre',
                disciplineId: fields.disciplineId||null,
                niveaux: Array.isArray(fields.niveaux)?fields.niveaux.slice():[],
                heures: parseFloat(fields.heures)||0, effectif: parseInt(fields.effectif,10)||0,
                commentaire: fields.commentaire||'' };
    ann.groupes.push(g); save(); return g;
  }

  function updateGroupe(id, fields) {
    const ann = getAnnee(); const idx = ann.groupes.findIndex(g=>g.id===id);
    if (idx===-1) return false; const g = ann.groupes[idx];
    if (fields.nom!==undefined)          g.nom          = (fields.nom||'').trim();
    if (fields.type!==undefined)         g.type         = fields.type;
    if (fields.disciplineId!==undefined) g.disciplineId = fields.disciplineId||null;
    if (fields.niveaux!==undefined)      g.niveaux      = Array.isArray(fields.niveaux)?fields.niveaux.slice():[];
    if (fields.heures!==undefined)       g.heures       = parseFloat(fields.heures)||0;
    if (fields.effectif!==undefined)     g.effectif     = parseInt(fields.effectif,10)||0;
    if (fields.commentaire!==undefined)  g.commentaire  = fields.commentaire||'';
    save(); return true;
  }

  function deleteGroupe(id) {
    const ann = getAnnee(); const before = ann.groupes.length;
    ann.groupes = ann.groupes.filter(g=>g.id!==id);
    if (ann.groupes.length<before){save();return true;} return false;
  }

  // ── ANNÉES ───────────────────────────────────────────────────────
  function resetAnnee(annee) {
    const key = annee||_data.anneeActive;
    _data.annees[key] = _annee(key); save();
  }

  function deleteAnnee(annee) {
    if (Object.keys(_data.annees).length <= 1)
      return { ok:false, message:'Impossible de supprimer la seule année existante.' };
    if (annee === _data.anneeActive)
      return { ok:false, message:'Basculez d\'abord vers une autre année avant de supprimer celle-ci.' };
    delete _data.annees[annee]; save(); return { ok:true };
  }

  // ── DUPLICATION ──────────────────────────────────────────────────
  function duplicateDivisions(id, count) {
    const source = getDivision(id); if (!source||count<1) return [];
    const created=[]; let cur=source.nom;
    for(let i=0;i<count;i++){const n=_nextDivName(cur);created.push(addDivision({niveau:source.niveau,nom:n,effectif:source.effectif,options:source.options.slice(),dispositif:source.dispositif}));cur=n;}
    return created;
  }

  function _nextDivName(nom) {
    if (!nom) return nom;
    const nm=nom.match(/^(.*?)(\d+)$/); if(nm){const n=parseInt(nm[2],10)+1;const p=nm[2].length>1?String(n).padStart(nm[2].length,'0'):String(n);return nm[1]+p;}
    const lm=nom.match(/^(.*?)([A-Z]+)$/); if(lm) return lm[1]+_nextLetters(lm[2]);
    const ll=nom.match(/^(.*?)([a-z]+)$/); if(ll) return ll[1]+_nextLetters(ll[2].toUpperCase()).toLowerCase();
    return nom+'2';
  }

  function _nextLetters(s) {
    const c=s.split(''); let i=c.length-1;
    while(i>=0){const code=c[i].charCodeAt(0);if(code<90){c[i]=String.fromCharCode(code+1);return c.join('');}c[i]='A';i--;}
    return 'A'+c.join('');
  }

  // ── SAVE / EXPORT / IMPORT ────────────────────────────────────────
  function save() {
    if (!_data) return;
    _data._meta.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(_data)); }
    catch(e) { document.dispatchEvent(new CustomEvent('dgh:storage-error',{detail:e})); }
  }

  function exportJSON() {
    const blob=new Blob([JSON.stringify(_data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    const date=new Date().toISOString().split('T')[0];
    const nom=(_data.etablissement.nom||'dgh').replace(/\s+/g,'_').toLowerCase();
    a.href=url; a.download=nom+'_'+_data.anneeActive+'_'+date+'.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url); return a.download;
  }

  function importJSON(file) {
    return new Promise((resolve,reject)=>{
      if(!file||file.type!=='application/json') return reject(new Error('Fichier JSON requis (.json)'));
      const r=new FileReader();
      r.onload=e=>{try{const d=JSON.parse(e.target.result);
        if(!d.annees||!d.etablissement) throw new Error('Format invalide');
        localStorage.setItem(KEY+'-backup',JSON.stringify(_data));
        _data=d; _migrate(); save();
        resolve({etablissement:_data.etablissement.nom||'?',annees:Object.keys(_data.annees)});
      }catch(err){reject(err);}};
      r.onerror=()=>reject(new Error('Erreur de lecture')); r.readAsText(file);
    });
  }

  function genId(prefix){return(prefix||'id')+'_'+Date.now()+'_'+Math.random().toString(36).substr(2,6);}

  function isEmpty() {
    const ann=getAnnee();
    return !_data.etablissement.nom && ann.dotation.enveloppe===0 && ann.enseignants.length===0 && ann.structures.length===0;
  }

  return {
    init, get, getEtab, getAnnee, getAnnees, getAnneeActive, getNiveaux,
    getTypeGroupes, getDisciplinesMEN,
    getStructures, getDivision,
    getDisciplines, getDiscipline, getRepartition,
    getGroupes, getGroupe,
    setEtab, setAnneeActive, setDotation,
    addDivision, updateDivision, deleteDivision, duplicateDivisions, appliquerMatrice,
    addDiscipline, updateDiscipline, deleteDiscipline, setRepartition, initDisciplinesMEN,
    addGroupe, updateGroupe, deleteGroupe,
    resetAnnee, deleteAnnee,
    save, exportJSON, importJSON, genId, isEmpty
  };

})();
