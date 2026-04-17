/**
 * DGH App — Couche données v3.3.6
 * SEUL fichier qui touche localStorage
 *
 * v3.0.0 — Sprint 5 : enveloppe HP/HSA, groupesCours, heuresPedaComp, sélection classes
 * v3.1.0 — Sprint 5+ : typeHeure HP/HSA sur HPC, grilles horaires overrides
 * v3.2.0 — Sprint 6 : CRUD enseignants, migration services→heures, import CSV
 */

const DGHData = (() => {

  const KEY     = 'dgh-app-data';
  const VERSION = '3.3.2';
  const NIVEAUX = ['6e', '5e', '4e', '3e', 'SEGPA', 'ULIS', 'UPE2A'];

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

  const CATEGORIES_HPC = [
    { value: 'option',         label: 'Option (Latin, Grec, LV3…)' },
    { value: 'labo',           label: 'Labo / Travaux pratiques' },
    { value: 'dispositif',     label: 'Dispositif (Savoir nager, Devoirs faits…)' },
    { value: 'vie-classe',     label: 'Vie de classe / HVC' },
    { value: 'arts',           label: 'Arts & culture (Chorale, Orchestre, Théâtre…)' },
    { value: 'sport',          label: 'Sport / AS / UNSS' },
    { value: 'accompagnement', label: 'Accompagnement (AP dédoublé, Tutorat…)' },
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
      dotation: { hPosteEnveloppe: 0, hsaEnveloppe: 0, commentaire: '' },
      structures: [],
      grilles: {},
      disciplines: [],
      repartition: [],   // [{ disciplineId, hPoste, hsa, commentaire, groupesCours[] }]
      heuresPedaComp: [],
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
        if (!ann.dotation) ann.dotation = { hPosteEnveloppe: 0, hsaEnveloppe: 0, commentaire: '' };
        if (ann.dotation.enveloppe !== undefined) {
          if (ann.dotation.hPosteEnveloppe === undefined) ann.dotation.hPosteEnveloppe = ann.dotation.enveloppe || 0;
          if (ann.dotation.hsaEnveloppe    === undefined) ann.dotation.hsaEnveloppe    = 0;
          delete ann.dotation.enveloppe;
        }
        if (ann.dotation.hPosteEnveloppe === undefined) ann.dotation.hPosteEnveloppe = 0;
        if (ann.dotation.hsaEnveloppe    === undefined) ann.dotation.hsaEnveloppe    = 0;
        if (!Array.isArray(ann.disciplines)) ann.disciplines = [];
        if (!Array.isArray(ann.repartition)) ann.repartition = [];
        ann.repartition.forEach(r => {
          if (r.commentaire === undefined) r.commentaire = '';
          if (r.hPoste === undefined) { r.hPoste = r.heuresAllouees || 0; delete r.heuresAllouees; }
          if (r.hsa    === undefined) r.hsa = 0;
          if (!Array.isArray(r.groupesCours)) r.groupesCours = [];
          r.groupesCours.forEach(gc => {
            if (!Array.isArray(gc.classesIds)) gc.classesIds = [];
            if (typeof gc.heures !== 'number') gc.heures = 0;
            if (!gc.commentaire) gc.commentaire = '';
          });
        });
        if (!Array.isArray(ann.heuresPedaComp)) {
          const anciens = Array.isArray(ann.groupes) ? ann.groupes : [];
          ann.heuresPedaComp = anciens.map(g => ({
            id: g.id || genId('hpc'), nom: g.nom || '',
            categorie: _migType(g.type), disciplineId: g.disciplineId || null,
            classesIds: [], heures: g.heures || 0, effectif: g.effectif || 0, commentaire: g.commentaire || ''
          }));
          delete ann.groupes;
        }
        if (!ann.grilles || typeof ann.grilles !== 'object') ann.grilles = {};
        ann.heuresPedaComp.forEach(h => {
          if (!h.categorie) h.categorie = 'autre';
          if (!Array.isArray(h.classesIds)) h.classesIds = [];
          if (typeof h.heures   !== 'number') h.heures   = 0;
          if (typeof h.effectif !== 'number') h.effectif = 0;
          if (!h.commentaire) h.commentaire = '';
          if (!h.typeHeure) h.typeHeure = 'hp';
          // migration v3.3.3 : enseignantId → enseignants[] (multi-affectation)
          if (!Array.isArray(h.enseignants)) {
            if (h.enseignantId) {
              h.enseignants = [{ ensId: h.enseignantId, heures: h.heures || 0 }];
            } else {
              h.enseignants = [];
            }
            delete h.enseignantId;
          }
        });
        // — Migration v3.2 : enseignants
        if (!Array.isArray(ann.enseignants)) ann.enseignants = [];
        ann.enseignants.forEach(ens => {
          if (!ens.grade)                       ens.grade               = 'certifie';
          if (!ens.statut)                      ens.statut              = 'titulaire';
          // Migration : 'temps-partiel' est un statut valide (v3.3.2)
          const statutsValides = ['titulaire','bmp','tzr','contractuel','temps-partiel'];
          if (!statutsValides.includes(ens.statut)) ens.statut = 'titulaire';
          if (ens.disciplinePrincipale === undefined) ens.disciplinePrincipale = '';
          if (ens.heures === undefined) {
            // Compatibilité : ancienne structure services[]
            ens.heures = Array.isArray(ens.services)
              ? Math.round(ens.services.reduce((s,srv)=>s+(parseFloat(srv.heures)||0),0)*2)/2
              : 0;
          }
          if (Array.isArray(ens.services)) delete ens.services;
          if (ens.commentaire === undefined)    ens.commentaire         = '';
          if (ens.orsManuel   === undefined)    ens.orsManuel           = null;
          // Migration v3.3 : disciplines[] multi-matieres
          if (!Array.isArray(ens.disciplines)) {
            ens.disciplines = (ens.disciplinePrincipale && ens.heures > 0)
              ? [{ discNom: ens.disciplinePrincipale, heures: ens.heures }]
              : (ens.disciplinePrincipale ? [{ discNom: ens.disciplinePrincipale, heures: 0 }] : []);
          }
          // Synchroniser heures total = somme disciplines
          ens.heures = Math.round(ens.disciplines.reduce((s,d)=>s+(parseFloat(d.heures)||0),0)*2)/2;
          // disciplinePrincipale = premiere discipline (compat affichage)
          ens.disciplinePrincipale = ens.disciplines.length > 0 ? ens.disciplines[0].discNom : '';
        });
      });
    }
    _data._meta.version = VERSION;
    save();
  }

  function _migType(t) {
    return { 'option-langue':'option','groupe-besoin':'accompagnement','activite':'arts','labo':'labo','ap':'accompagnement' }[t] || 'autre';
  }

  // ── GETTERS ──────────────────────────────────────────────────────
  function get()               { return _data; }
  function getEtab()           { return _data.etablissement; }
  function getAnneeActive()    { return _data.anneeActive; }
  function getAnnees()         { return Object.keys(_data.annees).sort().reverse(); }
  function getNiveaux()        { return NIVEAUX; }
  function getCategoriesHPC()  { return CATEGORIES_HPC.slice(); }
  function getDisciplinesMEN() { return DISCIPLINES_MEN.slice(); }

  function getAnnee(a) {
    const key = a || _data.anneeActive;
    if (!_data.annees[key]) _data.annees[key] = _annee(key);
    return _data.annees[key];
  }

  function getStructures(annee)   { return (getAnnee(annee).structures || []).slice().sort(_sortDiv); }
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
      const disc   = (ann.disciplines||[]).find(d=>d.id===r.disciplineId)||{};
      const hPoste = r.hPoste||0, hsa = r.hsa||0;
      const gcs    = (r.groupesCours||[]).map(gc => _enrichGC(gc, ann));
      const heuresGroupes = Math.round(gcs.reduce((s,g)=>s+g.heures,0)*2)/2;
      return {
        disciplineId: r.disciplineId, nom: disc.nom||'—', couleur: disc.couleur||'#6b6860',
        hPoste, hsa, total: Math.round((hPoste+hsa)*2)/2,
        commentaire: r.commentaire||'', groupesCours: gcs, heuresGroupes
      };
    });
  }

  function _enrichGC(gc, ann) {
    const classes = (gc.classesIds||[]).map(id=>(ann.structures||[]).find(d=>d.id===id)).filter(Boolean);
    return {
      id: gc.id, nom: gc.nom||'', classesIds: gc.classesIds||[],
      classesNoms: classes.map(d=>d.nom),
      heures: gc.heures||0,
      effectif: classes.reduce((s,d)=>s+(d.effectif||0),0),
      commentaire: gc.commentaire||''
    };
  }

  function getGroupeCours(disciplineId, gcId, annee) {
    const ann  = getAnnee(annee);
    const rep  = (ann.repartition||[]).find(r=>r.disciplineId===disciplineId);
    if (!rep) return null;
    return (rep.groupesCours||[]).find(g=>g.id===gcId)||null;
  }

  function getHeuresPedaComp(annee) {
    return (getAnnee(annee).heuresPedaComp||[]).slice()
      .sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr'));
  }
  function getHPC(id, annee) { return (getAnnee(annee).heuresPedaComp||[]).find(h=>h.id===id)||null; }

  // ── SETTERS ──────────────────────────────────────────────────────
  function setEtab(fields) { Object.assign(_data.etablissement, fields); save(); }

  function setAnneeActive(a) {
    if (!_data.annees[a]) _data.annees[a] = _annee(a);
    _data.anneeActive = a; save();
  }

  function setDotation(hPosteEnveloppe, hsaEnveloppe, commentaire) {
    const ann = getAnnee();
    ann.dotation.hPosteEnveloppe = parseFloat(hPosteEnveloppe)||0;
    ann.dotation.hsaEnveloppe    = parseFloat(hsaEnveloppe)||0;
    if (commentaire !== undefined) ann.dotation.commentaire = commentaire||'';
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
    if (idx===-1) return false;
    const div = ann.structures[idx];
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
    ann.repartition.forEach(r => {
      (r.groupesCours||[]).forEach(gc => { gc.classesIds = (gc.classesIds||[]).filter(c=>c!==id); });
    });
    (ann.heuresPedaComp||[]).forEach(h => { h.classesIds = (h.classesIds||[]).filter(c=>c!==id); });
    if (ann.structures.length<before){save();return true;} return false;
  }

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
        addDivision({ niveau: ligne.niveau, nom, effectif });
        dernierNom = nom;
      }
    });
    save();
  }

  // ── CRUD DISCIPLINES ─────────────────────────────────────────────
  function addDiscipline(fields) {
    const ann  = getAnnee();
    const disc = { id: genId('disc'), nom: (fields.nom||'').trim(), couleur: fields.couleur||'#6b6860' };
    ann.disciplines.push(disc);
    ann.repartition.push({ disciplineId: disc.id, hPoste: 0, hsa: 0, commentaire: '', groupesCours: [] });
    save(); return disc;
  }

  function updateDiscipline(id, fields) {
    const ann = getAnnee(); const idx = ann.disciplines.findIndex(d=>d.id===id);
    if (idx===-1) return false;
    const disc = ann.disciplines[idx];
    if (fields.nom!==undefined)     disc.nom     = (fields.nom||'').trim();
    if (fields.couleur!==undefined) disc.couleur = fields.couleur;
    save(); return true;
  }

  function deleteDiscipline(id) {
    const ann = getAnnee(); const before = ann.disciplines.length;
    ann.disciplines = ann.disciplines.filter(d=>d.id!==id);
    ann.repartition = ann.repartition.filter(r=>r.disciplineId!==id);
    (ann.heuresPedaComp||[]).forEach(h => { if(h.disciplineId===id) h.disciplineId=null; });
    if (ann.disciplines.length<before){save();return true;} return false;
  }

  function initDisciplinesMEN() {
    const ann = getAnnee();
    const existants = new Set(ann.disciplines.map(d=>d.nom));
    let nb = 0;
    DISCIPLINES_MEN.forEach(d => { if (!existants.has(d.nom)) { addDiscipline(d); nb++; } });
    return nb;
  }

  // ── GRILLES HORAIRES (overrides utilisateur) ─────────────────────
  function getGrilles(annee) { return getAnnee(annee).grilles || {}; }

  function setGrille(discNom, niveau, heures) {
    const ann = getAnnee();
    if (!ann.grilles) ann.grilles = {};
    if (!ann.grilles[discNom]) ann.grilles[discNom] = {};
    if (heures === null || heures === undefined) {
      delete ann.grilles[discNom][niveau];
      if (Object.keys(ann.grilles[discNom]).length === 0) delete ann.grilles[discNom];
    } else {
      ann.grilles[discNom][niveau] = parseFloat(heures) || 0;
    }
    save();
  }

  function setRepartition(disciplineId, fields) {
    const ann = getAnnee();
    let ligne = ann.repartition.find(r=>r.disciplineId===disciplineId);
    if (!ligne) { ligne={disciplineId,hPoste:0,hsa:0,commentaire:'',groupesCours:[]}; ann.repartition.push(ligne); }
    if (!Array.isArray(ligne.groupesCours)) ligne.groupesCours = [];
    if (fields.hPoste!==undefined)      ligne.hPoste      = parseFloat(fields.hPoste)||0;
    if (fields.hsa!==undefined)         ligne.hsa         = parseFloat(fields.hsa)||0;
    if (fields.commentaire!==undefined) ligne.commentaire = fields.commentaire||'';
    save(); return true;
  }

  // ── CRUD GROUPES DE COURS ─────────────────────────────────────────
  function addGroupeCours(disciplineId, fields) {
    const ann  = getAnnee();
    let ligne  = ann.repartition.find(r=>r.disciplineId===disciplineId);
    if (!ligne) { ligne={disciplineId,hPoste:0,hsa:0,commentaire:'',groupesCours:[]}; ann.repartition.push(ligne); }
    if (!Array.isArray(ligne.groupesCours)) ligne.groupesCours = [];
    const gc = { id: genId('gc'), nom: (fields.nom||'').trim(),
                 classesIds: Array.isArray(fields.classesIds)?fields.classesIds.slice():[],
                 heures: parseFloat(fields.heures)||0, commentaire: fields.commentaire||'' };
    ligne.groupesCours.push(gc); save(); return gc;
  }

  function updateGroupeCours(disciplineId, gcId, fields) {
    const ann   = getAnnee();
    const ligne = ann.repartition.find(r=>r.disciplineId===disciplineId); if(!ligne) return false;
    const gc    = (ligne.groupesCours||[]).find(g=>g.id===gcId); if(!gc) return false;
    if (fields.nom!==undefined)         gc.nom         = (fields.nom||'').trim();
    if (fields.classesIds!==undefined)  gc.classesIds  = Array.isArray(fields.classesIds)?fields.classesIds.slice():[];
    if (fields.heures!==undefined)      gc.heures      = parseFloat(fields.heures)||0;
    if (fields.commentaire!==undefined) gc.commentaire = fields.commentaire||'';
    save(); return true;
  }

  function deleteGroupeCours(disciplineId, gcId) {
    const ann   = getAnnee();
    const ligne = ann.repartition.find(r=>r.disciplineId===disciplineId); if(!ligne) return false;
    const before = (ligne.groupesCours||[]).length;
    ligne.groupesCours = (ligne.groupesCours||[]).filter(g=>g.id!==gcId);
    if (ligne.groupesCours.length<before){save();return true;} return false;
  }

  // ── CRUD HEURES PÉDAGOGIQUES COMPLÉMENTAIRES ──────────────────────
  function addHPC(fields) {
    const ann = getAnnee();
    const h = { id: genId('hpc'), nom: (fields.nom||'').trim(), categorie: fields.categorie||'autre',
                disciplineId: fields.disciplineId||null,
                classesIds: Array.isArray(fields.classesIds)?fields.classesIds.slice():[],
                heures: parseFloat(fields.heures)||0, effectif: parseInt(fields.effectif,10)||0,
                typeHeure: fields.typeHeure||'hp',
                enseignants: Array.isArray(fields.enseignants) ? fields.enseignants.slice() : [],
                commentaire: fields.commentaire||'' };
    ann.heuresPedaComp.push(h); save(); return h;
  }

  function updateHPC(id, fields) {
    const ann = getAnnee(); const idx = ann.heuresPedaComp.findIndex(h=>h.id===id);
    if (idx===-1) return false;
    const h = ann.heuresPedaComp[idx];
    if (fields.nom!==undefined)          h.nom          = (fields.nom||'').trim();
    if (fields.categorie!==undefined)    h.categorie    = fields.categorie;
    if (fields.disciplineId!==undefined) h.disciplineId = fields.disciplineId||null;
    if (fields.classesIds!==undefined)   h.classesIds   = Array.isArray(fields.classesIds)?fields.classesIds.slice():[];
    if (fields.heures!==undefined)       h.heures       = parseFloat(fields.heures)||0;
    if (fields.effectif!==undefined)     h.effectif     = parseInt(fields.effectif,10)||0;
    if (fields.typeHeure!==undefined)     h.typeHeure    = fields.typeHeure||'hp';
    if (fields.enseignants!==undefined)   h.enseignants  = Array.isArray(fields.enseignants) ? fields.enseignants.slice() : [];
    if (fields.commentaire!==undefined)  h.commentaire  = fields.commentaire||'';
    save(); return true;
  }

  function deleteHPC(id) {
    const ann = getAnnee(); const before = ann.heuresPedaComp.length;
    ann.heuresPedaComp = ann.heuresPedaComp.filter(h=>h.id!==id);
    if (ann.heuresPedaComp.length<before){save();return true;} return false;
  }

  // ── CRUD ENSEIGNANTS ──────────────────────────────────────────────────
  /**
   * @returns {Array} enseignants triés nom / prénom
   */
  function getEnseignants(annee) {
    return (getAnnee(annee).enseignants || []).slice().sort((a,b)=>{
      const na=(a.nom||'').localeCompare(b.nom||'','fr');
      return na!==0 ? na : (a.prenom||'').localeCompare(b.prenom||'','fr');
    });
  }

  /** @returns {Object|null} */
  function getEnseignant(id, annee) {
    return (getAnnee(annee).enseignants||[]).find(e=>e.id===id)||null;
  }

  /**
   * @param {Object} fields - { nom, prenom, grade, statut, disciplinePrincipale, heures, orsManuel?, commentaire? }
   * @returns {Object} EnseignantObject créé
   */
  function addEnseignant(fields) {
    const ann = getAnnee();
    // disciplines[] : tableau des affectations par matiere
    const discs = Array.isArray(fields.disciplines) ? fields.disciplines.map(d => ({
      discNom: (d.discNom||'').trim(), heures: parseFloat(d.heures)||0
    })) : (fields.disciplinePrincipale
      ? [{ discNom: (fields.disciplinePrincipale||'').trim(), heures: parseFloat(fields.heures)||0 }]
      : []);
    const totalH = Math.round(discs.reduce((s,d)=>s+(d.heures||0),0)*2)/2;
    const ens = {
      id:                   genId('ens'),
      nom:                  (fields.nom||'').trim(),
      prenom:               (fields.prenom||'').trim(),
      grade:                fields.grade||'certifie',
      statut:               fields.statut||'titulaire',
      disciplines:          discs,
      disciplinePrincipale: discs.length > 0 ? discs[0].discNom : '',
      heures:               totalH,
      orsManuel:            (fields.orsManuel!==undefined&&fields.orsManuel!==''&&fields.orsManuel!==null)
                              ? parseFloat(fields.orsManuel) : null,
      commentaire:          fields.commentaire||''
    };
    ann.enseignants.push(ens); save(); return ens;
  }

  /**
   * @param {string} id
   * @param {Object} fields
   * @returns {boolean}
   */
  function updateEnseignant(id, fields) {
    const ann = getAnnee(); const idx = ann.enseignants.findIndex(e=>e.id===id);
    if (idx===-1) return false;
    const ens = ann.enseignants[idx];
    if (fields.nom!==undefined)       ens.nom       = (fields.nom||'').trim();
    if (fields.prenom!==undefined)    ens.prenom    = (fields.prenom||'').trim();
    if (fields.grade!==undefined)     ens.grade     = fields.grade||'certifie';
    if (fields.statut!==undefined)    ens.statut    = fields.statut||'titulaire';
    if (fields.commentaire!==undefined) ens.commentaire = fields.commentaire||'';
    if (fields.orsManuel!==undefined) ens.orsManuel = (fields.orsManuel!==''&&fields.orsManuel!==null)
                                                        ? parseFloat(fields.orsManuel) : null;
    // Mise a jour des disciplines par matiere
    if (Array.isArray(fields.disciplines)) {
      ens.disciplines = fields.disciplines.map(d => ({ discNom:(d.discNom||'').trim(), heures:parseFloat(d.heures)||0 }));
      ens.heures = Math.round(ens.disciplines.reduce((s,d)=>s+(d.heures||0),0)*2)/2;
      ens.disciplinePrincipale = ens.disciplines.length > 0 ? ens.disciplines[0].discNom : '';
    } else {
      // Compat : mise a jour d'un champ isole (inline edit heures ou disc principale)
      if (fields.disciplinePrincipale!==undefined) {
        if (!Array.isArray(ens.disciplines)) ens.disciplines = [];
        ens.disciplinePrincipale = (fields.disciplinePrincipale||'').trim();
        if (ens.disciplines.length > 0) ens.disciplines[0].discNom = ens.disciplinePrincipale;
        else if (ens.disciplinePrincipale) ens.disciplines = [{ discNom: ens.disciplinePrincipale, heures: ens.heures||0 }];
      }
      if (fields.heures!==undefined) {
        if (!Array.isArray(ens.disciplines)) ens.disciplines = [];
        ens.heures = parseFloat(fields.heures)||0;
        if (ens.disciplines.length === 1) ens.disciplines[0].heures = ens.heures;
      }
    }
    save(); return true;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function deleteEnseignant(id) {
    const ann = getAnnee(); const before = ann.enseignants.length;
    ann.enseignants = ann.enseignants.filter(e=>e.id!==id);
    if (ann.enseignants.length<before){save();return true;} return false;
  }

  /**
   * Vérifie si un enseignant existe déjà par nom+prénom (insensible casse).
   * @returns {Object|null} l'enseignant trouvé ou null
   */
  function deleteAllEnseignants() {
    const ann = getAnnee();
    const nb  = ann.enseignants.length;
    ann.enseignants = [];
    if (nb > 0) { save(); return nb; }
    return 0;
  }

  function findEnseignantByNomPrenom(nom, prenom, annee) {
    const n = (nom||'').trim().toLowerCase(), p = (prenom||'').trim().toLowerCase();
    return (getAnnee(annee).enseignants||[]).find(e=>
      (e.nom||'').toLowerCase()===n && (e.prenom||'').toLowerCase()===p
    ) || null;
  }

  // ── ANNÉES ───────────────────────────────────────────────────────
  function resetAnnee(annee) { const key=annee||_data.anneeActive; _data.annees[key]=_annee(key); save(); }

  function deleteAnnee(annee) {
    if (Object.keys(_data.annees).length<=1) return {ok:false,message:'Impossible de supprimer la seule année existante.'};
    if (annee===_data.anneeActive) return {ok:false,message:'Basculez d\'abord vers une autre année avant de supprimer celle-ci.'};
    delete _data.annees[annee]; save(); return {ok:true};
  }

  function duplicateDivisions(id, count) {
    const source=getDivision(id); if(!source||count<1) return [];
    const created=[]; let cur=source.nom;
    for(let i=0;i<count;i++){const n=_nextDivName(cur);created.push(addDivision({niveau:source.niveau,nom:n,effectif:source.effectif,options:source.options.slice(),dispositif:source.dispositif}));cur=n;}
    return created;
  }

  function _nextDivName(nom) {
    if(!nom) return nom;
    const nm=nom.match(/^(.*?)(\d+)$/); if(nm){const n=parseInt(nm[2],10)+1;const p=nm[2].length>1?String(n).padStart(nm[2].length,'0'):String(n);return nm[1]+p;}
    const lm=nom.match(/^(.*?)([A-Z]+)$/); if(lm) return lm[1]+_nextLetters(lm[2]);
    const ll=nom.match(/^(.*?)([a-z]+)$/); if(ll) return ll[1]+_nextLetters(ll[2].toUpperCase()).toLowerCase();
    return nom+'2';
  }
  function _nextLetters(s){const c=s.split('');let i=c.length-1;while(i>=0){const code=c[i].charCodeAt(0);if(code<90){c[i]=String.fromCharCode(code+1);return c.join('');}c[i]='A';i--;}return 'A'+c.join('');}

  function save() {
    if(!_data) return;
    _data._meta.updatedAt=new Date().toISOString();
    try{localStorage.setItem(KEY,JSON.stringify(_data));}
    catch(e){document.dispatchEvent(new CustomEvent('dgh:storage-error',{detail:e}));}
  }

  function exportJSON() {
    const blob=new Blob([JSON.stringify(_data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    const date=new Date().toISOString().split('T')[0];
    const nom=(_data.etablissement.nom||'dgh').replace(/\s+/g,'_').toLowerCase();
    a.href=url;a.download=nom+'_'+_data.anneeActive+'_'+date+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);return a.download;
  }

  function importJSON(file) {
    return new Promise((resolve,reject)=>{
      if(!file||file.type!=='application/json') return reject(new Error('Fichier JSON requis (.json)'));
      const r=new FileReader();
      r.onload=e=>{try{const d=JSON.parse(e.target.result);
        if(!d.annees||!d.etablissement) throw new Error('Format invalide');
        localStorage.setItem(KEY+'-backup',JSON.stringify(_data));
        _data=d;_migrate();save();
        resolve({etablissement:_data.etablissement.nom||'?',annees:Object.keys(_data.annees)});
      }catch(err){reject(err);}};
      r.onerror=()=>reject(new Error('Erreur de lecture'));r.readAsText(file);
    });
  }

  function genId(prefix){return(prefix||'id')+'_'+Date.now()+'_'+Math.random().toString(36).substr(2,6);}

  function isEmpty() {
    const ann=getAnnee();
    return !_data.etablissement.nom && ann.dotation.hPosteEnveloppe===0 && ann.structures.length===0;
  }

  return {
    init,get,getEtab,getAnnee,getAnnees,getAnneeActive,getNiveaux,
    getCategoriesHPC,getDisciplinesMEN,
    getStructures,getDivision,
    getDisciplines,getDiscipline,getRepartition,getGroupeCours,
    getHeuresPedaComp,getHPC,
    setEtab,setAnneeActive,setDotation,
    addDivision,updateDivision,deleteDivision,duplicateDivisions,appliquerMatrice,
    addDiscipline,updateDiscipline,deleteDiscipline,setRepartition,initDisciplinesMEN,
    getGrilles,setGrille,
    addGroupeCours,updateGroupeCours,deleteGroupeCours,
    addHPC,updateHPC,deleteHPC,
    getEnseignants,getEnseignant,addEnseignant,updateEnseignant,deleteEnseignant,deleteAllEnseignants,findEnseignantByNomPrenom,
    resetAnnee,deleteAnnee,
    save,exportJSON,importJSON,genId,isEmpty
  };
})();
