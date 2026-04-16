/**
 * DGH App — Moteur de calcul v3.0.0
 * Fonctions pures : zéro DOM, zéro localStorage
 *
 * v3.0.0 — Sprint 5 :
 *   - bilanDotation : enveloppe HP+HSA séparée
 *   - besoinsParDiscipline : intègre heuresGroupes (coût groupes de cours)
 *   - suggererRepartition : suggestion auto HP depuis besoin théorique
 *   - bilanHPC : résumé Heures Pédagogiques Complémentaires
 *   - resumeStructures : h théoriques MEN par niveau
 */

const Calculs = (() => {

  const ORS = {
    certifie:       { label: 'Certifié',             ors: 18 },
    agrege:         { label: 'Agrégé',               ors: 15 },
    plp:            { label: 'PLP',                  ors: 17 },
    eps:            { label: 'Prof. EPS',            ors: 20 },
    documentaliste: { label: 'Prof. documentaliste', ors: 0  },
    cpe:            { label: 'CPE',                  ors: 0  },
    psy_en:         { label: 'Psy-EN',               ors: 0  },
    contractuel:    { label: 'Contractuel',          ors: 18 }
  };

  const GRILLES_MEN = {
    '6e': { 'Français':4.5,'Mathématiques':4.5,'Histoire-Géographie':3,'LV1':4,'SVT':1.5,'Sciences et Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3,'EMC':0.5,'AP':3 },
    '5e': { 'Français':4.5,'Mathématiques':3.5,'Histoire-Géographie':3,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3,'EMC':0.5,'AP':2 },
    '4e': { 'Français':4.5,'Mathématiques':3.5,'Histoire-Géographie':3,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3,'EMC':0.5,'AP':2 },
    '3e': { 'Français':4,'Mathématiques':4,'Histoire-Géographie':3.5,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3,'EMC':0.5,'AP':2 }
  };

  const H_THEORIQUES_NIV = {};
  Object.entries(GRILLES_MEN).forEach(([niv, g]) => {
    H_THEORIQUES_NIV[niv] = Object.values(g).reduce((s,h)=>s+h, 0);
  });

  function getORS(grade, orsManuel) {
    if (orsManuel !== null && orsManuel !== undefined && !isNaN(orsManuel)) return parseFloat(orsManuel);
    return (ORS[grade] && ORS[grade].ors) || 0;
  }

  function calcHeuresEnseignant(ens) {
    return (ens.services||[]).reduce((s,srv) => s + (parseFloat(srv.heures)||0), 0);
  }

  function detailEnseignant(ens) {
    const ors = getORS(ens.grade, ens.orsManuel);
    const heuresFait = calcHeuresEnseignant(ens);
    const ecart = heuresFait - ors;
    return { ors, heuresFait, ecart,
             hsa: Math.max(0, ecart), sousService: Math.max(0, -ecart),
             statut: ecart > 0 ? 'hsa' : ecart < 0 ? 'sous-service' : 'equilibre' };
  }

  function resumeStructures(structures) {
    if (!Array.isArray(structures) || structures.length === 0)
      return { nbDivisions:0, effectifTotal:0, parNiveau:[], niveauxPresents:[], hTheoriqueTotal:0 };
    const map = {};
    structures.forEach(div => {
      if (!map[div.niveau]) map[div.niveau] = { niveau:div.niveau, nbDivisions:0, effectif:0, hTheoriqueDiv: H_THEORIQUES_NIV[div.niveau]||0 };
      map[div.niveau].nbDivisions++;
      map[div.niveau].effectif += div.effectif || 0;
    });
    const ORDER = { '6e':0,'5e':1,'4e':2,'3e':3,'SEGPA':4,'ULIS':5,'UPE2A':6 };
    const parNiveau = Object.values(map).sort((a,b) => (ORDER[a.niveau]??99)-(ORDER[b.niveau]??99));
    parNiveau.forEach(n => { n.hTheoriqueTotal = Math.round(n.nbDivisions * n.hTheoriqueDiv * 2) / 2; });
    const hTheoriqueTotal = parNiveau.reduce((s,n) => s + n.hTheoriqueTotal, 0);
    return {
      nbDivisions: structures.length,
      effectifTotal: structures.reduce((s,d) => s + (d.effectif||0), 0),
      parNiveau, niveauxPresents: parNiveau.map(n => n.niveau),
      hTheoriqueTotal: Math.round(hTheoriqueTotal*2)/2
    };
  }

  function bilanDotation(anneeData) {
    const dot       = anneeData.dotation || {};
    const hPosteEnv = dot.hPosteEnveloppe || 0;
    const hsaEnv    = dot.hsaEnveloppe    || 0;
    const enveloppe = Math.round((hPosteEnv + hsaEnv) * 2) / 2;
    const repartition    = anneeData.repartition    || [];
    const heuresPedaComp = anneeData.heuresPedaComp || [];
    let totalHP = 0, totalHSA = 0;
    // HP/HSA des disciplines
    repartition.forEach(r => { totalHP += r.hPoste||0; totalHSA += r.hsa||0; });
    // HP/HSA des heures pédagogiques complémentaires
    heuresPedaComp.forEach(h => {
      if ((h.typeHeure||'hp') === 'hsa') totalHSA += h.heures||0;
      else                               totalHP  += h.heures||0;
    });
    totalHP  = Math.round(totalHP *2)/2;
    totalHSA = Math.round(totalHSA*2)/2;
    const totalAlloue = Math.round((totalHP+totalHSA)*2)/2;
    const solde       = Math.round((enveloppe-totalAlloue)*2)/2;
    const pctConsomme = enveloppe > 0 ? Math.round((totalAlloue/enveloppe)*100) : 0;
    // Détail HP/HSA : discipline seule vs HPC seule (utile pour le dashboard)
    let totalHPDisc = 0, totalHSADisc = 0, totalHPHPC = 0, totalHSAHPC = 0;
    repartition.forEach(r => { totalHPDisc += r.hPoste||0; totalHSADisc += r.hsa||0; });
    heuresPedaComp.forEach(h => {
      if ((h.typeHeure||'hp') === 'hsa') totalHSAHPC += h.heures||0;
      else                               totalHPHPC  += h.heures||0;
    });
    return { enveloppe, hPosteEnv, hsaEnv, totalHP, totalHSA, totalAlloue, solde,
             pctConsomme, nbDisciplines:(anneeData.disciplines||[]).length, depassement:solde<0,
             totalHPDisc: Math.round(totalHPDisc*2)/2,
             totalHSADisc: Math.round(totalHSADisc*2)/2,
             totalHPHPC: Math.round(totalHPHPC*2)/2,
             totalHSAHPC: Math.round(totalHSAHPC*2)/2 };
  }

  function besoinsParDiscipline(structures, disciplines, repartition, grilles) {
    if (!Array.isArray(disciplines) || disciplines.length === 0) return [];
    // grilles = overrides utilisateur { [discNom]: { '6e': h, '5e': h, ... } }
    const grillesOverride = grilles || {};
    // Compter les divisions par niveau (pour multiplier h/div par nb divisions)
    const nbDivParNiveau = {};
    (structures||[]).forEach(div => { nbDivParNiveau[div.niveau] = (nbDivParNiveau[div.niveau]||0) + 1; });
    const besoinsMap = {};
    // Pour chaque discipline, calculer le besoin en tenant compte des overrides
    disciplines.forEach(disc => {
      let total = 0;
      ['6e','5e','4e','3e'].forEach(niv => {
        if (!nbDivParNiveau[niv]) return; // niveau absent des structures
        const hMEN = (GRILLES_MEN[niv]||{})[disc.nom] || 0;
        const hOverride = grillesOverride[disc.nom] && grillesOverride[disc.nom][niv] !== undefined
          ? grillesOverride[disc.nom][niv]
          : hMEN;
        total += hOverride * nbDivParNiveau[niv];
      });
      besoinsMap[disc.nom] = Math.round(total * 2) / 2;
    });
    // Aussi calculer les grilles par niveau pour chaque discipline (pour affichage)
    const grillesParDisc = {};
    disciplines.forEach(disc => {
      grillesParDisc[disc.nom] = {};
      ['6e','5e','4e','3e'].forEach(niv => {
        const hMEN = (GRILLES_MEN[niv]||{})[disc.nom];
        const hOv  = grillesOverride[disc.nom] && grillesOverride[disc.nom][niv] !== undefined
          ? grillesOverride[disc.nom][niv] : null;
        grillesParDisc[disc.nom][niv] = { men: hMEN, valeur: hOv !== null ? hOv : hMEN, modifie: hOv !== null };
      });
    });
    return disciplines.map(disc => {
      const rep = repartition.find(r => r.disciplineId === disc.id) || {};
      const besoinMEN     = Math.round((besoinsMap[disc.nom]||0)*2)/2;
      const grilleLignes  = grillesParDisc[disc.nom] || {};
      const hPoste = rep.hPoste||0, hsa = rep.hsa||0;
      const total  = Math.round((hPoste+hsa)*2)/2;
      const gcs    = rep.groupesCours || [];
      // Besoin réel par groupe = heures × nb_classes_sélectionnées dans ce groupe
      // Ex : Espagnol 2.5h × 16 classes + Allemand 2.5h × 3 classes = 47.5h
      // (structures passé en paramètre pour compter les classes disponibles)
      const heuresGroupesBrut = gcs.reduce((s,g) => s + (g.heures||0), 0);
      const heuresGroupesReel = Math.round(
        gcs.reduce((s,g) => {
          const nbClasses = (g.classesIds||[]).length;
          // Si aucune classe sélectionnée, on prend 1 prof (coût minimal)
          return s + (g.heures||0) * (nbClasses > 0 ? nbClasses : 1);
        }, 0) * 2
      ) / 2;
      const hasGroupes = gcs.length > 0;
      // Besoin affiché : si groupes → coût réel (h × classes), sinon besoin MEN
      const besoinTheorique = hasGroupes ? heuresGroupesReel : besoinMEN;
      return {
        disciplineId: disc.id, nom: disc.nom, couleur: disc.couleur,
        besoinTheorique, besoinMEN, hPoste, hsa, total,
        heuresGroupes: Math.round(heuresGroupesBrut*2)/2,
        heuresGroupesReel,
        hasGroupes,
        ecart: Math.round((total - besoinTheorique)*2)/2,
        commentaire: rep.commentaire||'', groupesCours: gcs,
        grilleLignes  // { '6e': { men, valeur, modifie }, ... }
      };
    });
  }

  function suggererRepartition(anneeData) {
    const dot         = anneeData.dotation || {};
    const enveloppeHP = dot.hPosteEnveloppe || 0;
    const structures  = anneeData.structures  || [];
    const disciplines = anneeData.disciplines || [];
    if (enveloppeHP === 0 || disciplines.length === 0) return [];
    const besoinsMap = {};
    structures.forEach(div => {
      const grille = GRILLES_MEN[div.niveau]; if (!grille) return;
      Object.entries(grille).forEach(([nom,h]) => { besoinsMap[nom] = (besoinsMap[nom]||0) + h; });
    });
    const totalBesoin = Object.values(besoinsMap).reduce((s,h)=>s+h, 0);
    if (totalBesoin === 0) return [];
    return disciplines.map(disc => {
      const besoin    = besoinsMap[disc.nom] || 0;
      const suggested = totalBesoin > 0 ? Math.round((besoin / totalBesoin) * enveloppeHP * 2) / 2 : 0;
      return { disciplineId: disc.id, nom: disc.nom, suggested };
    });
  }

  function bilanHPC(heuresPedaComp, disciplines) {
    if (!Array.isArray(heuresPedaComp) || heuresPedaComp.length === 0)
      return { totalHeures:0, nbHeures:0, parCategorie:[], parDiscipline:[] };
    const discMap = {};
    (disciplines||[]).forEach(d => { discMap[d.id] = d; });
    const catMap = {}, discTotMap = {};
    let total = 0;
    heuresPedaComp.forEach(h => {
      total += h.heures||0;
      catMap[h.categorie] = (catMap[h.categorie]||0) + (h.heures||0);
      if (h.disciplineId) discTotMap[h.disciplineId] = (discTotMap[h.disciplineId]||0) + (h.heures||0);
    });
    return {
      totalHeures: Math.round(total*2)/2, nbHeures: heuresPedaComp.length,
      parCategorie:  Object.entries(catMap).map(([cat,h])=>({categorie:cat, heures:Math.round(h*2)/2})),
      parDiscipline: Object.entries(discTotMap).map(([id,h])=>({disciplineId:id, nom:(discMap[id]&&discMap[id].nom)||'—', heures:Math.round(h*2)/2}))
    };
  }

  function genererAlertes(anneeData) {
    const alertes     = [];
    const dot         = anneeData.dotation || {};
    const hPosteEnv   = dot.hPosteEnveloppe || 0;
    const hsaEnv      = dot.hsaEnveloppe    || 0;
    const enveloppe   = hPosteEnv + hsaEnv;
    const repartition = anneeData.repartition || [];
    const enseignants = anneeData.enseignants || [];
    const structures  = anneeData.structures  || [];
    const allouees    = repartition.reduce((s,r) => s+(r.hPoste||0)+(r.hsa||0), 0);

    if (enveloppe === 0)
      alertes.push({type:'dotation', severite:'info', message:'L\'enveloppe DGH (HP + HSA) n\'a pas encore été saisie.', ref:'dotation'});
    if (structures.length === 0)
      alertes.push({type:'structures', severite:'info', message:'Aucune division saisie.', ref:'structures'});
    if (enveloppe > 0 && allouees > enveloppe)
      alertes.push({type:'depassement', severite:'error', message:'Dépassement : '+(Math.round((allouees-enveloppe)*2)/2)+'h au-dessus de la dotation.', ref:'dotation'});
    if (hPosteEnv > 0 && hsaEnv === 0)
      alertes.push({type:'hsa', severite:'info', message:'Aucune HSA saisie — vérifiez avec votre DSDEN.', ref:'dotation'});
    enseignants.forEach(ens => {
      const d = detailEnseignant(ens), nom = ((ens.prenom||'')+' '+ens.nom).trim();
      if (d.sousService > 0) alertes.push({type:'sous-service', severite:'warning', message:nom+' : sous-service de '+d.sousService+'h', ref:ens.id});
      if (d.hsa > 3)         alertes.push({type:'hsa', severite:'warning', message:nom+' : '+d.hsa+'h HSA (> 3h)', ref:ens.id});
    });
    if (enveloppe > 0 && (enveloppe - allouees) > 10)
      alertes.push({type:'heures-libres', severite:'info', message:Math.round((enveloppe-allouees)*2)/2+'h non affectées.', ref:'dotation'});
    return alertes;
  }

  return {
    ORS, GRILLES_MEN, H_THEORIQUES_NIV,
    getORS, calcHeuresEnseignant, detailEnseignant,
    resumeStructures, bilanDotation, besoinsParDiscipline,
    suggererRepartition, bilanHPC, genererAlertes
  };

})();
