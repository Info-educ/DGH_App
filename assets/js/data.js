/**
 * DGH App — Couche données v4.18.0
 * SEUL fichier qui touche localStorage
 *
 * v3.0.0 — Sprint 5 : enveloppe HP/HSA, groupesCours, heuresPedaComp, sélection classes
 * v3.1.0 — Sprint 5+ : typeHeure HP/HSA sur HPC, grilles horaires overrides
 * v3.2.0 — Sprint 6 : CRUD enseignants, migration services→heures, import CSV
 * v4.2.0 — Sprint 12 : affectations[] (répartition de service), ppEnsId sur divisions,
 *                      recalcul auto des heures de service depuis les affectations
 * v4.8.0 — Sprint 14 : Préparation EDT — salles[] + heuresBleues sur établissement,
 *                      indisponibilites[] + contraintesLibres[] sur contraintesEDT,
 *                      frequence (hebdo/semaine-A/semaine-B) sur chaque slot de barrette
 * v4.9.6 — Sprint 19 : volumeBMP + motifORS sur enseignant (bascule auto HP→HSA :
 *                      HP jusqu'au seuil ORS/volume BMP, dépassement en HSA)
 */

const DGHData = (() => {

  const KEY     = 'dgh-app-data';
  const VERSION = '4.18.0';
  const NIVEAUX = ['6e', '5e', '4e', '3e', 'SEGPA', 'ULIS', 'UPE2A'];

  // Matching souple discipline (identique à repartition.js et enseignants.js)
  function _normDisc(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function _discMatch(a, b) {
    const na = _normDisc(a); const nb = _normDisc(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  const TYPES_SALLE = [
    { value: 'svt',       label: 'Labo SVT' },
    { value: 'physique',  label: 'Labo Physique-Chimie' },
    { value: 'musique',   label: 'Salle Musique' },
    { value: 'arts',      label: 'Salle Arts plastiques' },
    { value: 'techno',    label: 'Salle Technologie' },
    { value: 'gym',       label: 'Gymnase / EPS' },
    { value: 'autre',     label: 'Autre salle spécialisée' }
  ];

  const JOURS_SEMAINE = [
    { value: 'lun', label: 'Lundi' },
    { value: 'mar', label: 'Mardi' },
    { value: 'mer', label: 'Mercredi' },
    { value: 'jeu', label: 'Jeudi' },
    { value: 'ven', label: 'Vendredi' }
  ];

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
      etablissement: {
        nom: '', uai: '', academie: '', commune: '', typeEtab: 'college',
        enveloppePacte: 0, enveloppeImp: 0, logo: null,
        salles: [],
        heuresBleues: { actif: false, creneaux: [], commentaire: '' },
        organisationSemaine: {
          joursOuvres: ['lun','mar','mer','jeu','ven'],
          mercrediMatin: true,
          horaires: { debutMatin: '08:00', finMatin: '12:00', debutAprem: '13:00', finAprem: '17:00' }
        }
      },
      annees: { '2025-2026': _annee('2025-2026') },
      anneeActive: '2025-2026'
    };
  }

  function _contraintesVides() {
    return { barrettes: [], coInterventions: [], indisponibilites: [], contraintesLibres: [],
             grillesIndispo: {}, grilleHeureBleue: {} };
  }

  function _annee(annee) {
    return {
      annee,
      createdAt: new Date().toISOString(),
      dotation: { hPosteEnveloppe: 0, hsaEnveloppe: 0, commentaire: '' },
      structures: [],
      groupes: [],          // Sprint 11 — référentiel groupes (mono/inter-classes)
      grilles: {},
      disciplines: [],
      repartition: [],
      affectations: [],     // Sprint 12 — répartition de service (classe × discipline → enseignant)
      heuresPedaComp: [],
      enseignants: [],
      scenarios: [],
      contraintesEDT: _contraintesVides(),
      missions: [],
      hsaAbsorbees: {},     // Sprint 19.1 — { [disciplineId]: { total, profs:{ [ensId]: h } } }
      snapshot: null,
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

  // ── MIGRATIONS PAR VERSION ────────────────────────────────────────
  // Chaque sous-fonction couvre un périmètre précis ; _migrate() les orchestre.

  // v3.0–3.3 : structures, dotation, repartition, HPC, enseignants (données de base)
  function _migrateV30Annees(ann) {
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
      // v3.3.3 : enseignantId → enseignants[] (multi-affectation)
      if (!Array.isArray(h.enseignants)) {
        h.enseignants = h.enseignantId ? [{ ensId: h.enseignantId, heures: h.heures || 0 }] : [];
        delete h.enseignantId;
      }
    });
    // v3.2 : enseignants
    if (!Array.isArray(ann.enseignants)) ann.enseignants = [];
    ann.enseignants.forEach(ens => {
      if (!ens.grade)  ens.grade  = 'certifie';
      if (!ens.statut) ens.statut = 'titulaire';
      const statutsValides = ['titulaire','bmp','tzr','contractuel','temps-partiel'];
      if (!statutsValides.includes(ens.statut)) ens.statut = 'titulaire';
      if (ens.disciplinePrincipale === undefined) ens.disciplinePrincipale = '';
      if (ens.motifORS  === undefined) ens.motifORS  = '';
      if (ens.volumeBMP === undefined) ens.volumeBMP = null;
      if (ens.heures === undefined) {
        ens.heures = Array.isArray(ens.services)
          ? Math.round(ens.services.reduce((s,srv)=>s+(parseFloat(srv.heures)||0),0)*2)/2
          : 0;
      }
      if (Array.isArray(ens.services)) delete ens.services;
      if (ens.commentaire === undefined) ens.commentaire = '';
      if (ens.orsManuel   === undefined) ens.orsManuel   = null;
      // v3.3 : disciplines[] multi-matières
      if (!Array.isArray(ens.disciplines)) {
        ens.disciplines = (ens.disciplinePrincipale && ens.heures > 0)
          ? [{ discNom: ens.disciplinePrincipale, heures: ens.heures }]
          : (ens.disciplinePrincipale ? [{ discNom: ens.disciplinePrincipale, heures: 0 }] : []);
      }
      ens.heures = Math.round(ens.disciplines.reduce((s,d)=>s+(parseFloat(d.heures)||0),0)*2)/2;
      ens.disciplinePrincipale = ens.disciplines.length > 0 ? ens.disciplines[0].discNom : '';
    });
  }

  // v3.4 : typeEtab + enveloppePacte/Imp (v3.9) + logo (v4.0) sur établissement
  function _migrateV34Etab() {
    if (!_data.etablissement.typeEtab)                   _data.etablissement.typeEtab         = 'college';
    if (_data.etablissement.enveloppePacte === undefined) _data.etablissement.enveloppePacte  = 0;
    if (_data.etablissement.enveloppeImp   === undefined) _data.etablissement.enveloppeImp    = 0;
    if (_data.etablissement.logo           === undefined) _data.etablissement.logo            = null;
  }

  // v3.5 : scenarios[] par année (remplace ann.simulation)
  function _migrateV35Scenarios(ann) {
    if (!Array.isArray(ann.scenarios)) { ann.scenarios = []; delete ann.simulation; }
  }

  // v4.10 / Sprint 21 : modificateur.typeHeure → modificateur.forcage
  function _migrateV410Forcage(ann) {
    (ann.scenarios || []).forEach(scen => {
      (scen.modificateurs || []).forEach(mod => {
        if (mod.forcage === undefined && mod.typeHeure !== undefined && mod.type !== 'projet') {
          mod.forcage = (mod.typeHeure === 'hp') ? 'hp' : 'hsa';
        }
        // typeHeure conservé pour compat lecture ; forcage fait foi.
      });
    });
  }

  // v3.6 : contraintesEDT (barrettes + coInterventions)
  // v3.7 : barrette.slots[] remplace classeIds[]/ensIds[]
  function _migrateV36EDT(ann) {
    if (!ann.contraintesEDT || typeof ann.contraintesEDT !== 'object') ann.contraintesEDT = _contraintesVides();
    if (!Array.isArray(ann.contraintesEDT.barrettes))       ann.contraintesEDT.barrettes       = [];
    if (!Array.isArray(ann.contraintesEDT.coInterventions)) ann.contraintesEDT.coInterventions = [];
    // v3.7 : slots[]
    ann.contraintesEDT.barrettes = ann.contraintesEDT.barrettes.map(b => {
      if (Array.isArray(b.slots)) return b;
      const slots = (b.classeIds || []).map(cid => ({ type: 'classe', ref: cid, nomLibre: '', ensIds: [] }));
      if (slots.length > 0 && Array.isArray(b.ensIds) && b.ensIds.length > 0) slots[0].ensIds = b.ensIds.slice();
      return { id: b.id, nom: b.nom || '', disciplineIds: b.disciplineIds || [], commentaire: b.commentaire || '', slots };
    });
  }

  // v3.8 : groupes[] référentiel Structures
  // v3.9 : missions[], snapshot, hsaAbsorbees
  function _migrateV38Groupes(ann) {
    if (!Array.isArray(ann.groupes))  ann.groupes  = [];
    if (!Array.isArray(ann.missions)) ann.missions  = [];
    if (ann.snapshot     === undefined)             ann.snapshot      = null;
    if (ann.hsaAbsorbees === undefined || ann.hsaAbsorbees === null) ann.hsaAbsorbees = {};
  }

  // v4.2 : affectations[] répartition de service + ppEnsId sur divisions
  function _migrateV42Affectations(ann) {
    if (!Array.isArray(ann.affectations)) ann.affectations = [];
    (ann.structures || []).forEach(div => {
      if (div.ppEnsId === undefined) div.ppEnsId = null;
    });
    const divIds  = new Set((ann.structures  || []).map(d => d.id));
    const discIds = new Set((ann.disciplines || []).map(d => d.id));
    const ensIds  = new Set((ann.enseignants || []).map(e => e.id));
    ann.affectations = ann.affectations.filter(a =>
      divIds.has(a.divisionId) && discIds.has(a.disciplineId) && ensIds.has(a.ensId)
    );
    (ann.structures || []).forEach(div => {
      if (div.ppEnsId && !ensIds.has(div.ppEnsId)) div.ppEnsId = null;
    });
  }

  // v4.8.0 : salles[], heuresBleues, organisationSemaine, grilleHeureBleue sur établissement
  function _migrateV48Etab() {
    if (!Array.isArray(_data.etablissement.salles)) _data.etablissement.salles = [];
    if (!_data.etablissement.heuresBleues || typeof _data.etablissement.heuresBleues !== 'object') {
      _data.etablissement.heuresBleues = { actif: false, creneaux: [], commentaire: '' };
    }
    if (!Array.isArray(_data.etablissement.heuresBleues.creneaux)) _data.etablissement.heuresBleues.creneaux = [];
    if (typeof _data.etablissement.heuresBleues.actif !== 'boolean') _data.etablissement.heuresBleues.actif = false;
    if (_data.etablissement.heuresBleues.commentaire === undefined)  _data.etablissement.heuresBleues.commentaire = '';
    if (!_data.etablissement.grilleHeureBleue || typeof _data.etablissement.grilleHeureBleue !== 'object') {
      _data.etablissement.grilleHeureBleue = { creneaux: {} };
    }
    if (!_data.etablissement.organisationSemaine || typeof _data.etablissement.organisationSemaine !== 'object') {
      _data.etablissement.organisationSemaine = {
        joursOuvres: ['lun','mar','mer','jeu','ven'],
        mercrediMatin: true,
        horaires: { debutMatin: '08:00', finMatin: '12:00', debutAprem: '13:00', finAprem: '17:00' }
      };
    }
    const os = _data.etablissement.organisationSemaine;
    if (!Array.isArray(os.joursOuvres))  os.joursOuvres   = ['lun','mar','mer','jeu','ven'];
    if (os.mercrediMatin === undefined)  os.mercrediMatin  = true;
    if (!os.horaires || typeof os.horaires !== 'object') {
      os.horaires = { debutMatin:'08:00', finMatin:'12:00', debutAprem:'13:00', finAprem:'17:00' };
    }
    if (!os.horaires.debutMatin)  os.horaires.debutMatin  = '08:00';
    if (!os.horaires.finMatin)    os.horaires.finMatin    = '12:00';
    if (!os.horaires.debutAprem)  os.horaires.debutAprem  = '13:00';
    if (!os.horaires.finAprem)    os.horaires.finAprem    = '17:00';
  }

  // v4.8.0–4.9.4 : indisponibilites[], contraintesLibres[], grilles, frequence, discId par slot
  function _migrateV48EDT(ann) {
    if (!ann.contraintesEDT || typeof ann.contraintesEDT !== 'object') ann.contraintesEDT = _contraintesVides();
    if (!Array.isArray(ann.contraintesEDT.indisponibilites))   ann.contraintesEDT.indisponibilites   = [];
    if (!Array.isArray(ann.contraintesEDT.contraintesLibres))  ann.contraintesEDT.contraintesLibres  = [];
    if (!ann.contraintesEDT.grillesIndispo   || typeof ann.contraintesEDT.grillesIndispo   !== 'object') ann.contraintesEDT.grillesIndispo   = {};
    if (!ann.contraintesEDT.grilleHeureBleue || typeof ann.contraintesEDT.grilleHeureBleue !== 'object') ann.contraintesEDT.grilleHeureBleue = {};
    ann.contraintesEDT.indisponibilites.forEach(ind => {
      if (!ind.type)  ind.type  = 'dure';
      if (!ind.plage) ind.plage = 'journee';
      if (ind.heureDebut === undefined) ind.heureDebut = '';
      if (ind.heureFin   === undefined) ind.heureFin   = '';
      if (!ind.motif) ind.motif = '';
    });
    ann.contraintesEDT.contraintesLibres.forEach(cl => {
      if (!Array.isArray(cl.ensIds))    cl.ensIds    = [];
      if (!Array.isArray(cl.classeIds)) cl.classeIds = [];
      if (!cl.scope)       cl.scope       = 'classe';
      if (!cl.commentaire) cl.commentaire = '';
    });
    // v4.9.4 : frequence + discId par slot de barrette
    (ann.contraintesEDT.barrettes || []).forEach(b => {
      (b.slots || []).forEach(s => {
        if (!s.frequence)          s.frequence = 'hebdo';
        if (s.discId === undefined) s.discId   = (b.disciplineIds && b.disciplineIds[0]) ? b.disciplineIds[0] : null;
      });
    });
  }

  // ── ORCHESTRATEUR ─────────────────────────────────────────────────
  // v4.17 : nettoie les doublons LV dans les fiches enseignants
  // Ex. BEDOU avait { discNom:'Anglais', heures:18 } + { discNom:'LV1', heures:18 }
  // → on garde uniquement l'entrée "Anglais" et on y reporte les heures de "LV1"
  function _migrateDiscDoublons(ann) {
    (ann.enseignants||[]).forEach(ens => {
      if (!Array.isArray(ens.disciplines) || ens.disciplines.length < 2) return;
      const dedup = [];
      ens.disciplines.forEach(d => {
        const existing = dedup.find(x => _discMatch(x.discNom, d.discNom));
        if (existing) {
          // Garder le nom le plus "propre" (langue > LV1/LV2 générique)
          // Prendre les heures max des deux
          existing.heures = Math.max(existing.heures || 0, d.heures || 0);
        } else {
          dedup.push({ ...d });
        }
      });
      ens.disciplines = dedup;
      if (dedup.length > 0) ens.disciplinePrincipale = dedup[0].discNom;
    });
  }

  function _migrate() {
    if (!_data._meta) _data._meta = {};
    if (_data.annees) {
      Object.values(_data.annees).forEach(ann => {
        _migrateV30Annees(ann);
        _migrateV35Scenarios(ann);
        _migrateV410Forcage(ann);
        _migrateV36EDT(ann);
        _migrateV38Groupes(ann);
        _migrateV42Affectations(ann);
        _migrateV48EDT(ann);
        _migrateDiscDoublons(ann);
      });
    }
    _migrateV34Etab();
    _migrateV48Etab();
    _data._meta.version = VERSION;
    _recomputeHeuresFromAffectations();
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
  function getTypesSalle()     { return TYPES_SALLE.slice(); }
  function getJoursSemaine()   { return JOURS_SEMAINE.slice(); }

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

  // ── CRUD SALLES SPÉCIALISÉES (v4.8.0) ─────────────────────────────
  function getSalles() {
    if (!Array.isArray(_data.etablissement.salles)) _data.etablissement.salles = [];
    return _data.etablissement.salles.slice();
  }

  function getSalle(id) {
    return getSalles().find(s => s.id === id) || null;
  }

  function addSalle(fields) {
    if (!Array.isArray(_data.etablissement.salles)) _data.etablissement.salles = [];
    const s = {
      id:        genId('salle'),
      nom:       (fields.nom || '').trim(),
      type:      fields.type || 'autre',
      capacite:  parseInt(fields.capacite, 10) || 0,
      nb:        Math.max(1, parseInt(fields.nb, 10) || 1)
    };
    _data.etablissement.salles.push(s);
    save();
    return s;
  }

  function updateSalle(id, fields) {
    const idx = (_data.etablissement.salles || []).findIndex(s => s.id === id);
    if (idx === -1) return false;
    const s = _data.etablissement.salles[idx];
    if (fields.nom      !== undefined) s.nom      = (fields.nom || '').trim();
    if (fields.type     !== undefined) s.type     = fields.type || 'autre';
    if (fields.capacite !== undefined) s.capacite = parseInt(fields.capacite, 10) || 0;
    if (fields.nb       !== undefined) s.nb       = Math.max(1, parseInt(fields.nb, 10) || 1);
    save();
    return true;
  }

  function deleteSalle(id) {
    const before = (_data.etablissement.salles || []).length;
    _data.etablissement.salles = (_data.etablissement.salles || []).filter(s => s.id !== id);
    if (_data.etablissement.salles.length < before) { save(); return true; }
    return false;
  }

  // ── HEURES BLEUES (v4.8.0) ────────────────────────────────────────
  function getHeuresBleues() {
    if (!_data.etablissement.heuresBleues || typeof _data.etablissement.heuresBleues !== 'object') {
      _data.etablissement.heuresBleues = { actif: false, creneaux: [], commentaire: '' };
    }
    return _data.etablissement.heuresBleues;
  }

  function setHeuresBleues(fields) {
    const hb = getHeuresBleues();
    if (fields.actif       !== undefined) hb.actif       = !!fields.actif;
    if (fields.creneaux    !== undefined) hb.creneaux    = Array.isArray(fields.creneaux) ? fields.creneaux.slice() : [];
    if (fields.commentaire !== undefined) hb.commentaire = fields.commentaire || '';
    save();
    return true;
  }

  function getOrganisationSemaine() {
    return _data.etablissement.organisationSemaine;
  }

  function setOrganisationSemaine(fields) {
    const os = getOrganisationSemaine();
    if (Array.isArray(fields.joursOuvres))         os.joursOuvres   = fields.joursOuvres.slice();
    if (fields.mercrediMatin !== undefined)         os.mercrediMatin = !!fields.mercrediMatin;
    if (fields.horaires && typeof fields.horaires === 'object') {
      const h = os.horaires;
      if (fields.horaires.debutMatin)  h.debutMatin  = fields.horaires.debutMatin;
      if (fields.horaires.finMatin)    h.finMatin     = fields.horaires.finMatin;
      if (fields.horaires.debutAprem)  h.debutAprem  = fields.horaires.debutAprem;
      if (fields.horaires.finAprem)    h.finAprem     = fields.horaires.finAprem;
    }
    save();
    return true;
  }

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
                  dispositif: fields.dispositif||null,
                  ppEnsId: fields.ppEnsId || null };
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
    if (fields.ppEnsId!==undefined)    div.ppEnsId    = fields.ppEnsId || null;
    save(); return true;
  }

  function deleteDivision(id) {
    const ann = getAnnee(); const before = ann.structures.length;
    ann.structures = ann.structures.filter(d=>d.id!==id);
    ann.repartition.forEach(r => {
      (r.groupesCours||[]).forEach(gc => { gc.classesIds = (gc.classesIds||[]).filter(c=>c!==id); });
    });
    (ann.heuresPedaComp||[]).forEach(h => { h.classesIds = (h.classesIds||[]).filter(c=>c!==id); });
    ann.affectations = (ann.affectations||[]).filter(a => a.divisionId !== id);
    if (ann.contraintesEDT) {
      (ann.contraintesEDT.contraintesLibres||[]).forEach(cl => { cl.classeIds = (cl.classeIds||[]).filter(c=>c!==id); });
      (ann.contraintesEDT.coInterventions||[]).forEach(ci => { ci.classeIds = (ci.classeIds||[]).filter(c=>c!==id); });
      // Slots de barrette pointant directement sur la division supprimée
      (ann.contraintesEDT.barrettes||[]).forEach(b => {
        b.slots = (b.slots||[]).filter(s => !(s.type === 'classe' && s.ref === id));
      });
    }
    // Groupes EDT : retirer la classe ; supprimer les groupes devenus vides + leurs slots
    if (Array.isArray(ann.groupes)) {
      const groupesVides = [];
      ann.groupes.forEach(g => { g.classeIds = (g.classeIds||[]).filter(c => c !== id); });
      ann.groupes = ann.groupes.filter(g => {
        if ((g.classeIds||[]).length === 0) { groupesVides.push(g.id); return false; }
        return true;
      });
      if (groupesVides.length && ann.contraintesEDT) {
        const vides = new Set(groupesVides);
        (ann.contraintesEDT.barrettes||[]).forEach(b => {
          b.slots = (b.slots||[]).filter(s => !(s.type === 'groupe' && vides.has(s.ref)));
        });
      }
    }
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
    ann.affectations = (ann.affectations||[]).filter(a => a.disciplineId !== id);
    if (ann.contraintesEDT) {
      (ann.contraintesEDT.barrettes||[]).forEach(b => {
        b.disciplineIds = (b.disciplineIds||[]).filter(did => did !== id);
        (b.slots||[]).forEach(s => { if (s.discId === id) s.discId = null; });
      });
    }
    if (Array.isArray(ann.groupes)) {
      ann.groupes.forEach(g => { g.disciplineIds = (g.disciplineIds||[]).filter(did => did !== id); });
    }
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
      motifORS:             (fields.motifORS||'').trim(),
      volumeBMP:            (fields.volumeBMP!==undefined&&fields.volumeBMP!==''&&fields.volumeBMP!==null)
                              ? parseFloat(fields.volumeBMP) : null,
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
    if (fields.motifORS!==undefined)  ens.motifORS  = (fields.motifORS||'').trim();
    if (fields.volumeBMP!==undefined) ens.volumeBMP = (fields.volumeBMP!==''&&fields.volumeBMP!==null)
                                                        ? parseFloat(fields.volumeBMP) : null;
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
    // Nettoyer affectations + PP + affectations d'impact dans les scénarios
    ann.affectations = (ann.affectations||[]).filter(a => a.ensId !== id);
    (ann.structures||[]).forEach(div => { if (div.ppEnsId === id) div.ppEnsId = null; });
    (ann.heuresPedaComp||[]).forEach(h => { h.enseignants = (h.enseignants||[]).filter(a => a.ensId !== id); });
    (ann.scenarios||[]).forEach(s => (s.modificateurs||[]).forEach(m => {
      if (Array.isArray(m.affectations)) m.affectations = m.affectations.filter(a => a.ensId !== id);
    }));
    // Nettoyer indisponibilités, contraintes libres et slots de barrettes (v4.8.0)
    if (ann.contraintesEDT) {
      ann.contraintesEDT.indisponibilites = (ann.contraintesEDT.indisponibilites||[]).filter(i => i.ensId !== id);
      if (ann.contraintesEDT.grillesIndispo) delete ann.contraintesEDT.grillesIndispo[id];
      (ann.contraintesEDT.contraintesLibres||[]).forEach(cl => { cl.ensIds = (cl.ensIds||[]).filter(eid => eid !== id); });
      (ann.contraintesEDT.barrettes||[]).forEach(b => (b.slots||[]).forEach(s => { s.ensIds = (s.ensIds||[]).filter(eid => eid !== id); }));
      (ann.contraintesEDT.coInterventions||[]).forEach(ci => { ci.ensIds = (ci.ensIds||[]).filter(eid => eid !== id); });
    }
    _recomputeHeuresFromAffectations();
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

  // ── CRUD SCÉNARIOS ────────────────────────────────────────────────────
  /**
   * ScenarioObject :
   * { id, nom, description, createdAt, updatedAt, actif,
   *   modificateurs: [ModificateurObject] }
   *
   * ModificateurObject — 3 types :
   *   { id, type:'dedoublement', disciplineId, classeIds[], heuresParGroupe, commentaire }
   *   { id, type:'co-enseignement', disciplineId, classeIds[], heuresParGroupe, commentaire }
   *   { id, type:'projet', nom, heuresHP, heuresHSA, commentaire }
   */

  function getScenarios(annee) {
    return (getAnnee(annee).scenarios || []).slice()
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  function getScenario(id, annee) {
    return (getAnnee(annee).scenarios || []).find(s => s.id === id) || null;
  }

  function getScenarioActif(annee) {
    return (getAnnee(annee).scenarios || []).find(s => s.actif) || null;
  }

  function addScenario(fields) {
    const ann = getAnnee();
    const scen = {
      id:           genId('scen'),
      nom:          (fields.nom || 'Nouveau scénario').trim(),
      description:  fields.description || '',
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
      actif:        false,
      modificateurs: []
    };
    ann.scenarios.push(scen);
    save();
    return scen;
  }

  function updateScenario(id, fields) {
    const ann = getAnnee();
    const idx = ann.scenarios.findIndex(s => s.id === id);
    if (idx === -1) return false;
    const scen = ann.scenarios[idx];
    if (fields.nom         !== undefined) scen.nom         = (fields.nom || '').trim();
    if (fields.description !== undefined) scen.description = fields.description || '';
    if (fields.actif       !== undefined) scen.actif       = !!fields.actif;
    scen.updatedAt = new Date().toISOString();
    save();
    return true;
  }

  function deleteScenario(id) {
    const ann    = getAnnee();
    const before = ann.scenarios.length;
    ann.scenarios = ann.scenarios.filter(s => s.id !== id);
    if (ann.scenarios.length < before) { save(); return true; }
    return false;
  }

  function dupliquerScenario(id) {
    const source = getScenario(id);
    if (!source) return null;
    const ann  = getAnnee();
    const copy = {
      id:           genId('scen'),
      nom:          source.nom + ' (copie)',
      description:  source.description || '',
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
      actif:        false,
      modificateurs: JSON.parse(JSON.stringify(source.modificateurs || []))
    };
    // Régénérer les ids des modificateurs pour éviter les doublons
    copy.modificateurs.forEach(m => { m.id = genId('mod'); });
    ann.scenarios.push(copy);
    save();
    return copy;
  }

  /**
   * Marque un scénario comme actif et désactive tous les autres.
   * Si id est null, désactive tous.
   */
  function setScenarioActif(id) {
    const ann = getAnnee();
    (ann.scenarios || []).forEach(s => { s.actif = (s.id === id); });
    save();
  }

  // ── CRUD MODIFICATEURS ────────────────────────────────────────────────

  function addModificateur(scenarioId, fields) {
    const ann  = getAnnee();
    const scen = ann.scenarios.find(s => s.id === scenarioId);
    if (!scen) return null;
    if (!Array.isArray(scen.modificateurs)) scen.modificateurs = [];
    const mod = { id: genId('mod'), ...fields };
    scen.modificateurs.push(mod);
    scen.updatedAt = new Date().toISOString();
    save();
    return mod;
  }

  function updateModificateur(scenarioId, modId, fields) {
    const ann  = getAnnee();
    const scen = ann.scenarios.find(s => s.id === scenarioId);
    if (!scen) return false;
    const idx = (scen.modificateurs || []).findIndex(m => m.id === modId);
    if (idx === -1) return false;
    Object.assign(scen.modificateurs[idx], fields);
    scen.updatedAt = new Date().toISOString();
    save();
    return true;
  }

  function deleteModificateur(scenarioId, modId) {
    const ann  = getAnnee();
    const scen = ann.scenarios.find(s => s.id === scenarioId);
    if (!scen) return false;
    const before = (scen.modificateurs || []).length;
    scen.modificateurs = (scen.modificateurs || []).filter(m => m.id !== modId);
    if (scen.modificateurs.length < before) {
      scen.updatedAt = new Date().toISOString();
      save();
      return true;
    }
    return false;
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

  // ══════════════════════════════════════════════════════════════════
  // GROUPES — référentiel Structures (v3.8)
  // ══════════════════════════════════════════════════════════════════
  /**
   * GroupeObject :
   * { id, nom, classeIds[], effectif, disciplineIds[], commentaire }
   * type est calculé : 'mono' si 1 classe, 'inter' si plusieurs
   */
  function getGroupes(annee) {
    const ann = getAnnee(annee);
    if (!Array.isArray(ann.groupes)) ann.groupes = [];
    return ann.groupes.slice().sort((a, b) => (a.nom||'').localeCompare(b.nom||'','fr'));
  }

  function getGroupe(id, annee) {
    return (getAnnee(annee).groupes || []).find(g => g.id === id) || null;
  }

  function addGroupe(fields) {
    const ann  = getAnnee();
    if (!Array.isArray(ann.groupes)) ann.groupes = [];
    const g = {
      id:           genId('grp'),
      nom:          (fields.nom || '').trim(),
      classeIds:    Array.isArray(fields.classeIds)    ? fields.classeIds.slice()    : [],
      effectif:     typeof fields.effectif === 'number' ? fields.effectif            : 0,
      disciplineIds:Array.isArray(fields.disciplineIds) ? fields.disciplineIds.slice(): [],
      commentaire:  fields.commentaire || ''
    };
    ann.groupes.push(g);
    save();
    return g;
  }

  function updateGroupe(id, fields) {
    const ann = getAnnee();
    const idx = (ann.groupes || []).findIndex(g => g.id === id);
    if (idx === -1) return false;
    const g = ann.groupes[idx];
    if (fields.nom           !== undefined) g.nom           = (fields.nom || '').trim();
    if (fields.classeIds     !== undefined) g.classeIds     = Array.isArray(fields.classeIds)     ? fields.classeIds.slice()     : [];
    if (fields.effectif      !== undefined) g.effectif      = typeof fields.effectif === 'number'  ? fields.effectif              : 0;
    if (fields.disciplineIds !== undefined) g.disciplineIds = Array.isArray(fields.disciplineIds)  ? fields.disciplineIds.slice() : [];
    if (fields.commentaire   !== undefined) g.commentaire   = fields.commentaire || '';
    save();
    return true;
  }

  function deleteGroupe(id) {
    const ann    = getAnnee();
    const before = (ann.groupes || []).length;
    ann.groupes  = (ann.groupes || []).filter(g => g.id !== id);
    if (ann.groupes.length < before) { save(); return true; }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════
  // CONTRAINTES EDT (v3.6+)
  // ══════════════════════════════════════════════════════════════════
  function getContraintesEDT(annee) {
    const ann = getAnnee(annee);
    if (!ann.contraintesEDT || typeof ann.contraintesEDT !== 'object') ann.contraintesEDT = _contraintesVides();
    return ann.contraintesEDT;
  }

  // ── Barrettes (v3.7 — schéma slots[] ; v4.8.0 — frequence par slot) ──
  function getBarrettes(annee)  { return getContraintesEDT(annee).barrettes.slice(); }

  function _normaliserSlots(slots) {
    return Array.isArray(slots) ? slots.map(s => ({
      type:      s.type || 'classe',
      ref:       s.ref || '',
      nomLibre:  s.nomLibre || '',
      ensIds:    Array.isArray(s.ensIds) ? s.ensIds.slice() : [],
      frequence: s.frequence || 'hebdo',   // 'hebdo' | 'semaine-A' | 'semaine-B'
      discId:    s.discId || null           // discipline propre au slot (v4.9.4)
    })) : [];
  }

  function addBarrette(fields) {
    const ann  = getAnnee();
    const barr = {
      id:            genId('barr'),
      nom:           (fields.nom || '').trim(),
      disciplineIds: Array.isArray(fields.disciplineIds) ? fields.disciplineIds.slice() : [],
      slots:         _normaliserSlots(fields.slots),
      commentaire:   fields.commentaire || ''
    };
    ann.contraintesEDT.barrettes.push(barr);
    save();
    return barr;
  }

  function updateBarrette(id, fields) {
    const c   = getContraintesEDT();
    const idx = c.barrettes.findIndex(b => b.id === id);
    if (idx === -1) return false;
    const b = c.barrettes[idx];
    if (fields.nom           !== undefined) b.nom           = (fields.nom || '').trim();
    if (fields.disciplineIds !== undefined) b.disciplineIds = Array.isArray(fields.disciplineIds) ? fields.disciplineIds.slice() : [];
    if (fields.slots         !== undefined) b.slots         = _normaliserSlots(fields.slots);
    if (fields.commentaire   !== undefined) b.commentaire   = fields.commentaire || '';
    save();
    return true;
  }

  function deleteBarrette(id) {
    const c = getContraintesEDT();
    const before = c.barrettes.length;
    c.barrettes  = c.barrettes.filter(b => b.id !== id);
    if (c.barrettes.length < before) { save(); return true; }
    return false;
  }

  // ── Co-interventions ──────────────────────────────────────────────
  function getCoInterventions(annee) { return getContraintesEDT(annee).coInterventions.slice(); }

  function addCoIntervention(fields) {
    const ann   = getAnnee();
    const coint = {
      id:          genId('coint'),
      nom:         (fields.nom || '').trim(),
      ensIds:      Array.isArray(fields.ensIds)    ? fields.ensIds.slice()    : [],
      classeIds:   Array.isArray(fields.classeIds) ? fields.classeIds.slice() : [],
      commentaire: fields.commentaire || ''
    };
    ann.contraintesEDT.coInterventions.push(coint);
    save();
    return coint;
  }

  function updateCoIntervention(id, fields) {
    const c   = getContraintesEDT();
    const idx = c.coInterventions.findIndex(ci => ci.id === id);
    if (idx === -1) return false;
    const ci = c.coInterventions[idx];
    if (fields.nom         !== undefined) ci.nom         = (fields.nom || '').trim();
    if (fields.ensIds      !== undefined) ci.ensIds      = Array.isArray(fields.ensIds)    ? fields.ensIds.slice()    : [];
    if (fields.classeIds   !== undefined) ci.classeIds   = Array.isArray(fields.classeIds) ? fields.classeIds.slice() : [];
    if (fields.commentaire !== undefined) ci.commentaire = fields.commentaire || '';
    save();
    return true;
  }

  function deleteCoIntervention(id) {
    const c      = getContraintesEDT();
    const before = c.coInterventions.length;
    c.coInterventions = c.coInterventions.filter(ci => ci.id !== id);
    if (c.coInterventions.length < before) { save(); return true; }
    return false;
  }

  // ── Indisponibilités enseignants (v4.8.0) ─────────────────────────
  /**
   * IndisponibiliteObject :
   * { id, ensId, type:'dure'|'souple', jour, plage:'matin'|'aprem'|'journee'|'creneau',
   *   heureDebut, heureFin, motif }
   * type='dure'   → indisponibilité réelle (BMP autre établissement, temps partiel non travaillé…)
   * type='souple' → vœu à éviter si possible, non bloquant
   */
  function getIndisponibilites(annee)        { return getContraintesEDT(annee).indisponibilites.slice(); }
  function getIndisponibilitesEnseignant(ensId, annee) {
    return getIndisponibilites(annee).filter(i => i.ensId === ensId);
  }

  /**
   * Source de vérité unique pour les calculs (heure bleue, contrôles EDT).
   * Fusionne :
   *   - les indisponibilités saisies via l'ancien formulaire texte (indisponibilites[]),
   *   - les indisponibilités saisies via la grille visuelle (grillesIndispo[ensId]).
   * Chaque cellule 'jour-HH' de la grille devient un créneau d'une heure
   * { ensId, jour, heureDebut:'HH:00', heureFin:'HH+1:00', plage:'creneau', type:'dure'|'souple' }.
   * 'dure' = indisponibilité réelle (bloquante) ; 'voeu' = vœu souple (à éviter).
   */
  function getIndisponibilitesPourCalcul(annee) {
    const c = getContraintesEDT(annee);
    const out = (c.indisponibilites || []).map(i => ({ ...i }));
    const grilles = c.grillesIndispo || {};
    Object.keys(grilles).forEach(ensId => {
      const creneaux = (grilles[ensId] && grilles[ensId].creneaux) || {};
      Object.keys(creneaux).forEach(key => {
        const etat = creneaux[key];
        if (etat !== 'dure' && etat !== 'voeu') return;
        const sep = key.lastIndexOf('-');
        if (sep < 0) return;
        const jour = key.slice(0, sep);
        const h    = parseInt(key.slice(sep + 1), 10);
        if (isNaN(h)) return;
        out.push({
          ensId, jour, plage: 'creneau',
          heureDebut: String(h).padStart(2, '0') + ':00',
          heureFin:   String(h + 1).padStart(2, '0') + ':00',
          type: etat === 'dure' ? 'dure' : 'souple',
          motif: ''
        });
      });
    });
    return out;
  }

  function addIndisponibilite(fields) {
    const ann = getAnnee();
    const ind = {
      id:         genId('indispo'),
      ensId:      fields.ensId || null,
      type:       fields.type  === 'souple' ? 'souple' : 'dure',
      jour:       fields.jour  || 'lun',
      plage:      fields.plage || 'journee',
      heureDebut: fields.plage === 'creneau' ? (fields.heureDebut || '') : '',
      heureFin:   fields.plage === 'creneau' ? (fields.heureFin   || '') : '',
      motif:      (fields.motif || '').trim()
    };
    ann.contraintesEDT.indisponibilites.push(ind);
    save();
    return ind;
  }

  function updateIndisponibilite(id, fields) {
    const c   = getContraintesEDT();
    const idx = c.indisponibilites.findIndex(i => i.id === id);
    if (idx === -1) return false;
    const ind = c.indisponibilites[idx];
    if (fields.ensId      !== undefined) ind.ensId      = fields.ensId || null;
    if (fields.type       !== undefined) ind.type       = fields.type === 'souple' ? 'souple' : 'dure';
    if (fields.jour       !== undefined) ind.jour       = fields.jour || 'lun';
    if (fields.plage      !== undefined) ind.plage      = fields.plage || 'journee';
    if (fields.heureDebut !== undefined) ind.heureDebut = fields.heureDebut || '';
    if (fields.heureFin   !== undefined) ind.heureFin   = fields.heureFin   || '';
    if (fields.motif      !== undefined) ind.motif      = (fields.motif || '').trim();
    if (ind.plage !== 'creneau') { ind.heureDebut = ''; ind.heureFin = ''; }
    save();
    return true;
  }

  function deleteIndisponibilite(id) {
    const c      = getContraintesEDT();
    const before = c.indisponibilites.length;
    c.indisponibilites = c.indisponibilites.filter(i => i.id !== id);
    if (c.indisponibilites.length < before) { save(); return true; }
    return false;
  }

  /**
   * Grille hebdomadaire d'indisponibilité d'un enseignant.
   * Stockée sous contraintesEDT.grillesIndispo[ensId] = { creneaux: { 'lun-08': 'dure'|'voeu'|null, ... } }
   */
  function getGrilleIndispo(ensId) {
    const c = getContraintesEDT();
    if (!c.grillesIndispo) c.grillesIndispo = {};
    return c.grillesIndispo[ensId] || { creneaux: {} };
  }

  function setGrilleIndispo(ensId, creneaux) {
    const ann = getAnnee();
    if (!ann.contraintesEDT.grillesIndispo) ann.contraintesEDT.grillesIndispo = {};
    ann.contraintesEDT.grillesIndispo[ensId] = { creneaux };
    save();
  }

  /**
   * Grille heure bleue établissement.
   * Stockée sous etablissement.grilleHeureBleue = { creneaux: { 'lun-08': 'candidat'|null, ... } }
   */
  function getGrilleHeureBleue() {
    return _data.etablissement.grilleHeureBleue || { creneaux: {} };
  }

  function setGrilleHeureBleue(creneaux) {
    if (!_data.etablissement.grilleHeureBleue) _data.etablissement.grilleHeureBleue = {};
    _data.etablissement.grilleHeureBleue.creneaux = creneaux;
    save();
  }

  // ── Contraintes libres (v4.8.0) ───────────────────────────────────
  /**
   * ContrainteLibreObject :
   * { id, titre, jour, heureDebut, heureFin, scope:'etablissement'|'classe'|'groupe',
   *   classeIds[], ensIds[], commentaire }
   * Ex : "Orchestre — Conservatoire", jeudi 8h-11h, classeIds=[6eA], ensIds=[prof musique]
   */
  function getContraintesLibres(annee) { return getContraintesEDT(annee).contraintesLibres.slice(); }

  function addContrainteLibre(fields) {
    const ann = getAnnee();
    const cl = {
      id:          genId('clibre'),
      titre:       (fields.titre || '').trim(),
      jour:        fields.jour || 'lun',
      heureDebut:  fields.heureDebut || '',
      heureFin:    fields.heureFin   || '',
      scope:       fields.scope || 'classe',
      classeIds:   Array.isArray(fields.classeIds) ? fields.classeIds.slice() : [],
      ensIds:      Array.isArray(fields.ensIds)    ? fields.ensIds.slice()    : [],
      commentaire: fields.commentaire || ''
    };
    ann.contraintesEDT.contraintesLibres.push(cl);
    save();
    return cl;
  }

  function updateContrainteLibre(id, fields) {
    const c   = getContraintesEDT();
    const idx = c.contraintesLibres.findIndex(cl => cl.id === id);
    if (idx === -1) return false;
    const cl = c.contraintesLibres[idx];
    if (fields.titre       !== undefined) cl.titre       = (fields.titre || '').trim();
    if (fields.jour        !== undefined) cl.jour        = fields.jour || 'lun';
    if (fields.heureDebut  !== undefined) cl.heureDebut  = fields.heureDebut || '';
    if (fields.heureFin    !== undefined) cl.heureFin    = fields.heureFin   || '';
    if (fields.scope       !== undefined) cl.scope       = fields.scope || 'classe';
    if (fields.classeIds   !== undefined) cl.classeIds   = Array.isArray(fields.classeIds) ? fields.classeIds.slice() : [];
    if (fields.ensIds      !== undefined) cl.ensIds      = Array.isArray(fields.ensIds)    ? fields.ensIds.slice()    : [];
    if (fields.commentaire !== undefined) cl.commentaire = fields.commentaire || '';
    save();
    return true;
  }

  function deleteContrainteLibre(id) {
    const c      = getContraintesEDT();
    const before = c.contraintesLibres.length;
    c.contraintesLibres = c.contraintesLibres.filter(cl => cl.id !== id);
    if (c.contraintesLibres.length < before) { save(); return true; }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════
  // AFFECTATIONS — Répartition de service (v4.2)
  // ══════════════════════════════════════════════════════════════════
  /**
   * AffectationObject :
   * { id, divisionId, disciplineId, ensId, heures }
   * Plusieurs affectations sur un même couple (division, discipline) =
   * classe partagée / co-titularité (ex : 4A Français = Mme Briant + Mme Forgeais).
   * Les heures de service par discipline (ens.disciplines[].heures) sont
   * RECALCULÉES automatiquement à partir de ces affectations dès qu'il en existe
   * au moins une pour le couple (enseignant, discipline). Sinon la saisie manuelle
   * (vue « Par discipline ») reste maîtresse. Zéro double saisie.
   */
  function getAffectations(annee) {
    const ann = getAnnee(annee);
    if (!Array.isArray(ann.affectations)) ann.affectations = [];
    return ann.affectations.slice();
  }

  function getAffectationsCell(divisionId, disciplineId, annee) {
    return getAffectations(annee).filter(a => a.divisionId === divisionId && a.disciplineId === disciplineId);
  }

  function getAffectationsEnseignant(ensId, annee) {
    return getAffectations(annee).filter(a => a.ensId === ensId);
  }

  function addAffectation(fields) {
    const ann = getAnnee();
    if (!Array.isArray(ann.affectations)) ann.affectations = [];
    const aff = {
      id:           genId('aff'),
      divisionId:   fields.divisionId   || null,
      disciplineId: fields.disciplineId || null,
      ensId:        fields.ensId        || null,
      heures:       parseFloat(fields.heures) || 0
    };
    if (!aff.divisionId || !aff.disciplineId || !aff.ensId) return null;
    ann.affectations.push(aff);
    _recomputeHeuresFromAffectations(aff.ensId);
    save();
    return aff;
  }

  function updateAffectation(id, fields) {
    const ann = getAnnee();
    const aff = (ann.affectations||[]).find(a => a.id === id);
    if (!aff) return false;
    const ancienEns = aff.ensId;
    if (fields.divisionId   !== undefined) aff.divisionId   = fields.divisionId   || null;
    if (fields.disciplineId !== undefined) aff.disciplineId = fields.disciplineId || null;
    if (fields.ensId        !== undefined) aff.ensId        = fields.ensId        || null;
    if (fields.heures       !== undefined) aff.heures       = parseFloat(fields.heures) || 0;
    _recomputeHeuresFromAffectations(ancienEns);
    if (aff.ensId !== ancienEns) _recomputeHeuresFromAffectations(aff.ensId);
    save();
    return true;
  }

  function deleteAffectation(id) {
    const ann = getAnnee();
    const aff = (ann.affectations||[]).find(a => a.id === id);
    if (!aff) return false;
    const ensId = aff.ensId;
    ann.affectations = ann.affectations.filter(a => a.id !== id);
    _recomputeHeuresFromAffectations(ensId);
    save();
    return true;
  }

  /**
   * Désigne (ou retire si ensId falsy) le professeur principal d'une division.
   */
  function setProfesseurPrincipal(divisionId, ensId) {
    const div = getDivision(divisionId);
    if (!div) return false;
    div.ppEnsId = ensId || null;
    save();
    return true;
  }

  /**
   * Recalcule ens.disciplines[].heures à partir des affectations.
   * Pour chaque enseignant : toute discipline ayant >= 1 affectation pour lui
   * voit ses heures écrasées par la somme de ces affectations. Les disciplines
   * SANS affectation conservent leur saisie manuelle (non destructif).
   * @param {string} [ensId] limite le recalcul à un enseignant (sinon : tous)
   */
  function _recomputeHeuresFromAffectations(ensId) {
    const ann = getAnnee();
    const discNomById = {};
    (ann.disciplines||[]).forEach(d => { discNomById[d.id] = d.nom; });
    // Sommes par (ensId → discNom → heures)
    const sommes = {};
    (ann.affectations||[]).forEach(a => {
      const nom = discNomById[a.disciplineId];
      if (!nom) return;
      if (!sommes[a.ensId]) sommes[a.ensId] = {};
      sommes[a.ensId][nom] = Math.round(((sommes[a.ensId][nom]||0) + (parseFloat(a.heures)||0)) * 2) / 2;
    });
    (ann.enseignants||[]).forEach(ens => {
      if (ensId && ens.id !== ensId) return;
      const parDisc = sommes[ens.id] || {};
      if (!Array.isArray(ens.disciplines)) ens.disciplines = [];
      // Écraser les disciplines pilotées par des affectations
      // Si "LV1" matche "Anglais" dans la fiche → on met à jour "Anglais" (pas "LV1")
      Object.keys(parDisc).forEach(nom => {
        const d = ens.disciplines.find(x => _discMatch(x.discNom, nom));
        if (d) {
          // Mettre à jour sous le nom déjà dans la fiche (ex. "Anglais", pas "LV1")
          d.heures = parDisc[nom];
        } else {
          // Pas de correspondance dans la fiche : ajouter sous le nom de la discipline
          ens.disciplines.push({ discNom: nom, heures: parDisc[nom] });
        }
      });
      ens.heures = Math.round(ens.disciplines.reduce((s,d)=>s+(parseFloat(d.heures)||0),0)*2)/2;
      ens.disciplinePrincipale = ens.disciplines.length > 0 ? ens.disciplines[0].discNom : '';
    });
  }

  /** Indique si une discipline d'un enseignant est pilotée par des affectations. */
  function disciplinePiloteeParAffectation(ensId, discNom, annee) {
    const ann = getAnnee(annee);
    const disc = (ann.disciplines||[]).find(d => _discMatch(d.nom, discNom));
    if (!disc) return false;
    return (ann.affectations||[]).some(a => a.ensId === ensId && a.disciplineId === disc.id);
  }

  // ── HSA ABSORBÉES (Sprint 19.1) ──────────────────────────────────
  // Structure : ann.hsaAbsorbees[disciplineId] = { total:Number, profs:{ [ensId]:Number } }
  function getHsaAbsorbees(annee) {
    const ann = getAnnee(annee);
    if (!ann.hsaAbsorbees) ann.hsaAbsorbees = {};
    return ann.hsaAbsorbees;
  }
  function setHsaAbsorbeeDiscipline(disciplineId, total, annee) {
    const ann = getAnnee(annee);
    if (!ann.hsaAbsorbees) ann.hsaAbsorbees = {};
    if (!ann.hsaAbsorbees[disciplineId]) ann.hsaAbsorbees[disciplineId] = { total: 0, profs: {} };
    ann.hsaAbsorbees[disciplineId].total = Math.round((parseFloat(total)||0) * 2) / 2;
    save(); return true;
  }
  function setHsaAbsorbeeEnseignant(disciplineId, ensId, heures, annee) {
    const ann = getAnnee(annee);
    if (!ann.hsaAbsorbees) ann.hsaAbsorbees = {};
    if (!ann.hsaAbsorbees[disciplineId]) ann.hsaAbsorbees[disciplineId] = { total: 0, profs: {} };
    const h = Math.round((parseFloat(heures)||0) * 2) / 2;
    if (h > 0) ann.hsaAbsorbees[disciplineId].profs[ensId] = h;
    else       delete ann.hsaAbsorbees[disciplineId].profs[ensId];
    save(); return true;
  }

  // ── SAUVEGARDE ───────────────────────────────────────────────────
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
      const isJson = file && (/\.json$/i.test(file.name||'') || file.type === 'application/json');
      if(!isJson) return reject(new Error('Fichier JSON requis (.json)'));
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

  // Restaure la sauvegarde de secours créée avant le dernier import.
  // Échange (swap) : l'état courant devient la nouvelle sauvegarde, de sorte
  // que la restauration est elle-même réversible (un second appel revient en arrière).
  function restoreBackup() {
    const raw = localStorage.getItem(KEY + '-backup');
    if (!raw) return { ok: false, message: 'Aucune sauvegarde disponible (aucun import effectué depuis l\'ouverture).' };
    let backup;
    try { backup = JSON.parse(raw); } catch (e) { return { ok: false, message: 'Sauvegarde illisible.' }; }
    if (!backup.annees || !backup.etablissement) return { ok: false, message: 'Sauvegarde invalide.' };
    localStorage.setItem(KEY + '-backup', JSON.stringify(_data)); // swap : l'état courant devient récupérable
    _data = backup; _migrate(); // _migrate() réestampille et sauvegarde
    return { ok: true, etablissement: _data.etablissement.nom || '?', annees: Object.keys(_data.annees) };
  }

  function genId(prefix){return(prefix||'id')+'_'+Date.now()+'_'+Math.random().toString(36).substring(2,8);}

  // ══════════════════════════════════════════════════════════════════
  // MISSIONS — PACTE & IMP (v3.9)
  // ══════════════════════════════════════════════════════════════════
  /**
   * MissionObject :
   * { id, type:'pacte'|'imp', intitule, enseignantId, heures, disciplineId, commentaire }
   */
  function getMissions(annee) {
    const ann = getAnnee(annee);
    return (ann.missions || []).slice();
  }

  function getMission(id, annee) {
    return getMissions(annee).find(m => m.id === id) || null;
  }

  function getMissionsEnseignant(ensId, annee) {
    return getMissions(annee).filter(m => m.enseignantId === ensId);
  }

  function addMission(fields, annee) {
    const ann = getAnnee(annee);
    if (!Array.isArray(ann.missions)) ann.missions = [];
    const m = {
      id:            genId('mission'),
      type:          fields.type          || 'pacte',
      intitule:      (fields.intitule     || '').trim(),
      enseignantId:  fields.enseignantId  || null,
      heures:        parseFloat(fields.heures) || 0,
      disciplineId:  fields.disciplineId  || null,
      commentaire:   (fields.commentaire  || '').trim()
    };
    ann.missions.push(m);
    save();
    return m;
  }

  function updateMission(id, fields, annee) {
    const ann = getAnnee(annee);
    const m   = (ann.missions || []).find(x => x.id === id);
    if (!m) return false;
    if (fields.type         !== undefined) m.type         = fields.type;
    if (fields.intitule     !== undefined) m.intitule     = (fields.intitule || '').trim();
    if (fields.enseignantId !== undefined) m.enseignantId = fields.enseignantId;
    if (fields.heures       !== undefined) m.heures       = parseFloat(fields.heures) || 0;
    if (fields.disciplineId !== undefined) m.disciplineId = fields.disciplineId;
    if (fields.commentaire  !== undefined) m.commentaire  = (fields.commentaire || '').trim();
    save();
    return true;
  }

  function deleteMission(id, annee) {
    const ann    = getAnnee(annee);
    const before = (ann.missions || []).length;
    ann.missions = (ann.missions || []).filter(m => m.id !== id);
    if (ann.missions.length < before) { save(); return true; }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════
  // SNAPSHOT — Figer une année pour comparaison historique (v3.9)
  // ══════════════════════════════════════════════════════════════════
  function figerSnapshot(anneeId) {
    const key = anneeId || _data.anneeActive;
    if (!_data.annees[key]) return false;
    // Copie profonde de l'année, sans le snapshot lui-même pour éviter la récursion
    const copy = JSON.parse(JSON.stringify(_data.annees[key]));
    delete copy.snapshot;
    copy._figeLe = new Date().toISOString();
    _data.annees[key].snapshot = copy;
    save();
    return true;
  }

  function getSnapshot(anneeId) {
    const key = anneeId || _data.anneeActive;
    return (_data.annees[key] && _data.annees[key].snapshot) || null;
  }

  function supprimerSnapshot(anneeId) {
    const key = anneeId || _data.anneeActive;
    if (!_data.annees[key]) return false;
    _data.annees[key].snapshot = null;
    save();
    return true;
  }

  function isEmpty() {
    const ann=getAnnee();
    return !_data.etablissement.nom && ann.dotation.hPosteEnveloppe===0 && ann.structures.length===0;
  }

  return {
    init,get,getEtab,getAnnee,getAnnees,getAnneeActive,getNiveaux,
    getCategoriesHPC,getDisciplinesMEN,getTypesSalle,getJoursSemaine,
    getStructures,getDivision,
    getDisciplines,getDiscipline,getRepartition,getGroupeCours,
    getHsaAbsorbees,setHsaAbsorbeeDiscipline,setHsaAbsorbeeEnseignant,
    getHeuresPedaComp,getHPC,
    setEtab,setAnneeActive,setDotation,
    getSalles,getSalle,addSalle,updateSalle,deleteSalle,
    getHeuresBleues,setHeuresBleues,
    getOrganisationSemaine,setOrganisationSemaine,
    addDivision,updateDivision,deleteDivision,duplicateDivisions,appliquerMatrice,
    addDiscipline,updateDiscipline,deleteDiscipline,setRepartition,initDisciplinesMEN,
    getGrilles,setGrille,
    addGroupeCours,updateGroupeCours,deleteGroupeCours,
    addHPC,updateHPC,deleteHPC,
    getEnseignants,getEnseignant,addEnseignant,updateEnseignant,deleteEnseignant,deleteAllEnseignants,findEnseignantByNomPrenom,
    getScenarios,getScenario,getScenarioActif,
    addScenario,updateScenario,deleteScenario,dupliquerScenario,setScenarioActif,
    addModificateur,updateModificateur,deleteModificateur,
    getGroupes,getGroupe,addGroupe,updateGroupe,deleteGroupe,
    getAffectations,getAffectationsCell,getAffectationsEnseignant,
    addAffectation,updateAffectation,deleteAffectation,
    setProfesseurPrincipal,disciplinePiloteeParAffectation,
    getContraintesEDT,
    getGrilleIndispo,setGrilleIndispo,getGrilleHeureBleue,setGrilleHeureBleue,
    getBarrettes,addBarrette,updateBarrette,deleteBarrette,
    getCoInterventions,addCoIntervention,updateCoIntervention,deleteCoIntervention,
    getIndisponibilites,getIndisponibilitesEnseignant,getIndisponibilitesPourCalcul,
    addIndisponibilite,updateIndisponibilite,deleteIndisponibilite,
    getContraintesLibres,addContrainteLibre,updateContrainteLibre,deleteContrainteLibre,
    resetAnnee,deleteAnnee,
    figerSnapshot,getSnapshot,supprimerSnapshot,
    getMissions,getMission,getMissionsEnseignant,addMission,updateMission,deleteMission,
    save,exportJSON,importJSON,restoreBackup,genId,isEmpty
  };
})();
