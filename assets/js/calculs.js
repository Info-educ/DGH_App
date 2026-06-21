/**
 * DGH App — Moteur de calcul v4.9.5
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
    pstg:           { label: 'PSTG (prof. stagiaire)', ors: 18 },
    fstg:           { label: 'FSTG (fonct. stagiaire)', ors: 18 },
    documentaliste: { label: 'Prof. documentaliste', ors: 0  },
    cpe:            { label: 'CPE',                  ors: 0  },
    psy_en:         { label: 'Psy-EN',               ors: 0  },
    contractuel:    { label: 'Contractuel',          ors: 0  }  // ORS = quotité contractuelle → saisir orsManuel
  };

  /**
   * Grilles réglementaires — arrêté du 19 mai 2015 modifié (v. en vigueur 2025-2026).
   * Total = 26h obligatoires par division (25h en 6e depuis l'arrêté du
   * 4 avril 2025 : l'heure de soutien/approfondissement obligatoire est
   * remplacée par des heures de soutien facultatives, hors grille).
   * AP/EPI = modalités prises DANS ces heures,
   * donc absentes du besoin (la discipline AP reste disponible pour la ventilation).
   * HG-EMC = ligne réglementaire unique (3h / 3h / 3h / 3,5h dont 0,5h EMC) :
   * répartie ici HG + EMC 0,5h pour la ventilation des services et Pronote.
   * 6e : sciences globalisées SVT + Physique-Chimie 3h (techno supprimée en 6e
   * depuis la rentrée 2023) — réparti 1,5 + 1,5 par défaut, modifiable (overrides).
   */
  const GRILLES_MEN = {
    '6e': { 'Français':4.5,'Mathématiques':4.5,'Histoire-Géographie':2.5,'EMC':0.5,'LV1':4,'SVT':1.5,'Physique-Chimie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':4 },
    '5e': { 'Français':4.5,'Mathématiques':3.5,'Histoire-Géographie':2.5,'EMC':0.5,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3 },
    '4e': { 'Français':4.5,'Mathématiques':3.5,'Histoire-Géographie':2.5,'EMC':0.5,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3 },
    '3e': { 'Français':4,'Mathématiques':3.5,'Histoire-Géographie':3,'EMC':0.5,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3 }
  };

  const H_THEORIQUES_NIV = {};
  Object.entries(GRILLES_MEN).forEach(([niv, g]) => {
    H_THEORIQUES_NIV[niv] = Object.values(g).reduce((s,h)=>s+h, 0);
  });

  function getORS(grade, orsManuel) {
    if (orsManuel !== null && orsManuel !== undefined && !isNaN(orsManuel)) return parseFloat(orsManuel);
    return (ORS[grade] && ORS[grade].ors) || 0;
  }

  /**
   * Plafond HP d'un enseignant : seuil au-delà duquel les heures basculent en HSA.
   *
   *  - Titulaire / TZR / certifié / agrégé / PLP / EPS : plafond = ORS (grade ou orsManuel).
   *  - BMP : plafond = volume du bloc (champ ens.volumeBMP), à défaut orsManuel, à défaut ORS du grade.
   *  - Contractuel / sans ORS : plafond = orsManuel s'il est saisi, sinon 0 (pas de bascule auto).
   *
   * @returns {{ plafond:number, source:'bmp'|'ors-manuel'|'ors-grade'|'aucun' }}
   */
  function plafondHP(ens) {
    const statut = ens.statut || 'titulaire';
    if (statut === 'bmp') {
      const vol = parseFloat(ens.volumeBMP);
      if (!isNaN(vol) && vol > 0) return { plafond: vol, source: 'bmp' };
    }
    const manuel = ens.orsManuel;
    if (manuel !== null && manuel !== undefined && manuel !== '' && !isNaN(manuel)) {
      return { plafond: parseFloat(manuel), source: 'ors-manuel' };
    }
    const grade = getORS(ens.grade, null);
    if (grade > 0) return { plafond: grade, source: 'ors-grade' };
    return { plafond: 0, source: 'aucun' };
  }

  function calcHeuresEnseignant(ens) {
    // Phase 1 : heures est un Number direct
    // Compatibilité descendante : si services[] existe encore, somme des heures
    if (Array.isArray(ens.services)) {
      return ens.services.reduce((s,srv) => s + (parseFloat(srv.heures)||0), 0);
    }
    return parseFloat(ens.heures) || 0;
  }

  function detailEnseignant(ens) {
    const heuresFait = Math.round(calcHeuresEnseignant(ens) * 2) / 2;
    const statut     = ens.statut || 'titulaire';
    // ORS : toujours calculé si orsManuel renseigné, sinon selon grade pour les titulaires/TZR/BMP
    // Pour contractuel : ORS = 0 sauf si orsManuel saisi (volume contractuel)
    const ors = getORS(ens.grade, ens.orsManuel);
    if (ors === 0) {
      // Pas d'ORS de référence (contractuel sans orsManuel, documentaliste…)
      return { ors: 0, heuresFait, ecart: 0, hsa: 0, sousService: 0,
               statut: statut, affichageEcart: 'sans-ors' };
    }
    const ecart = Math.round((heuresFait - ors) * 2) / 2;
    return { ors, heuresFait, ecart,
             hsa: Math.max(0, ecart), sousService: Math.max(0, -ecart),
             statut: ecart > 0 ? 'hsa' : ecart < 0 ? 'sous-service' : 'equilibre',
             affichageEcart: 'normal' };
  }

  /**
   * Résumé global du tableau des enseignants.
   * Fonction pure — zéro DOM, zéro localStorage.
   * @param {Array} enseignants
   * @returns {{ nbEnseignants, totalHeures, nbSousService, nbHSA, nbEquilibre }}
   */
  function bilanEnseignants(enseignants) {
    if (!Array.isArray(enseignants) || enseignants.length === 0)
      return { nbEnseignants:0, totalHeures:0, nbSousService:0, nbHSA:0, nbEquilibre:0 };
    let totalHeures=0, nbSousService=0, nbHSA=0, nbEquilibre=0;
    enseignants.forEach(ens => {
      const d = detailEnseignant(ens);
      totalHeures += d.heuresFait;
      // BMP et TZR ne sont pas comptés dans sous-service/HSA (écart non significatif)
      if (d.affichageEcart !== 'normal') { nbEquilibre++; return; }
      if (d.statut==='sous-service') nbSousService++;
      else if (d.statut==='hsa')     nbHSA++;
      else                           nbEquilibre++;
    });
    return {
      nbEnseignants: enseignants.length,
      totalHeures:   Math.round(totalHeures*2)/2,
      nbSousService, nbHSA, nbEquilibre
    };
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
    // HP/HSA consommées par l'ÉQUIPE (apport réel plafonné par ORS / volume BMP).
    // C'est la source de vérité pour la remontée TRM.
    const eq = bilanEquipe(anneeData.enseignants || [], heuresPedaComp);
    const equipeHP  = eq.totalHP;
    const equipeHSA = eq.totalHSA;
    const equipeTotal  = Math.round((equipeHP + equipeHSA) * 2) / 2;
    const soldeEquipe  = Math.round((enveloppe - equipeTotal) * 2) / 2;
    const pctEquipe    = enveloppe > 0 ? Math.round((equipeTotal / enveloppe) * 100) : 0;
    return { enveloppe, hPosteEnv, hsaEnv, totalHP, totalHSA, totalAlloue, solde,
             pctConsomme, nbDisciplines:(anneeData.disciplines||[]).length, depassement:solde<0,
             totalHPDisc: Math.round(totalHPDisc*2)/2,
             totalHSADisc: Math.round(totalHSADisc*2)/2,
             totalHPHPC: Math.round(totalHPHPC*2)/2,
             totalHSAHPC: Math.round(totalHSAHPC*2)/2,
             // — Source ÉQUIPE (apport réel, plafonné) —
             equipeHP, equipeHSA, equipeTotal, soldeEquipe, pctEquipe,
             depassementEquipe: soldeEquipe < 0, nbEns: eq.nbEns };
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
    // Allouées = disciplines (HP+HSA) + HPC — même périmètre que bilanDotation
    const hpcs        = anneeData.heuresPedaComp || [];
    const allouees    = repartition.reduce((s,r) => s+(r.hPoste||0)+(r.hsa||0), 0)
                      + hpcs.reduce((s,h) => s+(h.heures||0), 0);

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
      if (d.sousService > 2) alertes.push({type:'sous-service', severite:'warning', message:nom+' : sous-service de '+d.sousService+'h', ref:ens.id});
      if (d.sousService > 0 && d.sousService <= 2) alertes.push({type:'sous-service', severite:'info', message:nom+' : léger sous-service ('+d.sousService+'h)', ref:ens.id});
      if (d.hsa > 3)         alertes.push({type:'hsa', severite:'warning', message:nom+' : '+d.hsa+'h HSA (> 3h)', ref:ens.id});
    });
    if (enveloppe > 0 && (enveloppe - allouees) > 10)
      alertes.push({type:'heures-libres', severite:'info', message:Math.round((enveloppe-allouees)*2)/2+'h non affectées.', ref:'dotation'});
    return alertes;
  }

  /**
   * Regroupe les enseignants par discipline en utilisant ens.disciplines[].
   * Un meme enseignant peut apparaitre dans plusieurs disciplines.
   * Pour chaque discipline : liste des enseignants + heures dans cette discipline + heures totales etablissement + dotation.
   */
  function bilanParDiscipline(enseignants, repartition, disciplines) {
    // Index dotation par nom de discipline
    const dotMap = {};
    (disciplines || []).forEach(d => {
      const rep = (repartition || []).find(r => r.disciplineId === d.id);
      dotMap[d.nom] = rep ? Math.round(((rep.hPoste||0) + (rep.hsa||0)) * 2) / 2 : 0;
    });

    // Regrouper : { discNom -> [{ ens, heuresDisc }] }
    const groupes = {};
    (enseignants || []).forEach(ens => {
      const discs = Array.isArray(ens.disciplines) && ens.disciplines.length > 0
        ? ens.disciplines
        : (ens.disciplinePrincipale ? [{ discNom: ens.disciplinePrincipale, heures: ens.heures||0 }] : []);
      if (discs.length === 0) {
        if (!groupes['']) groupes[''] = [];
        groupes[''].push({ ens, heuresDisc: ens.heures || 0 });
      } else {
        discs.forEach(da => {
          const k = (da.discNom || '').trim();
          if (!groupes[k]) groupes[k] = [];
          groupes[k].push({ ens, heuresDisc: parseFloat(da.heures) || 0 });
        });
      }
    });

    const result = [];
    const vus = new Set();

    // D'abord les disciplines presentes dans la dotation (dans l'ordre)
    (disciplines || []).forEach(d => {
      const membres = groupes[d.nom] || [];
      const hDisc  = Math.round(membres.reduce((s,m) => s + m.heuresDisc, 0) * 2) / 2;
      const hServ  = Math.round(membres.reduce((s,m) => s + (m.ens.heures||0), 0) * 2) / 2;
      const hDot   = dotMap[d.nom] || 0;
      result.push({
        disc: d.nom, couleur: d.couleur || '#6b6860',
        membres,
        heuresDisc: hDisc,
        heuresService: hServ,
        heuresDotation: hDot,
        ecart: Math.round((hDisc - hDot) * 2) / 2,
        dansDotation: true
      });
      vus.add(d.nom);
    });

    // Puis disciplines hors dotation
    Object.entries(groupes).forEach(([discNom, membres]) => {
      if (vus.has(discNom)) return;
      const hDisc = Math.round(membres.reduce((s,m) => s + m.heuresDisc, 0) * 2) / 2;
      const hServ = Math.round(membres.reduce((s,m) => s + (m.ens.heures||0), 0) * 2) / 2;
      const label = discNom || '— Sans discipline —';
      result.push({
        disc: label, couleur: '#94a3b8',
        membres,
        heuresDisc: hDisc,
        heuresService: hServ,
        heuresDotation: 0,
        ecart: hDisc,
        dansDotation: false
      });
    });

    return result;
  }

  /**
   * Calcule le service complet d'un enseignant en agrégeant toutes les sources.
   * Source HP : disciplines (saisies manuellement) + HPC typées 'hp'
   * Source HSA : HPC typées 'hsa' (extensible Sprint 7 : dédoublements, ventilation)
   *
   * L'ORS ne porte que sur les HP — les HSA sont du travail supplémentaire, normal.
   * detailHSA = liste de toutes les sources HSA (pour tooltip au survol).
   *
   * @param {Object} ens   EnseignantObject
   * @param {Array}  hpcs  DGHData.getHeuresPedaComp()
   * @returns {{ hpDisc, hpHPC, hpTotal, hsaTotal, totalGeneral,
   *             detailHSA, ecartORS, ors, statutORS }}
   */
  function serviceTotalEnseignant(ens, hpcs) {
    // 1. Heures issues des disciplines (apport "structurel" dans l'établissement)
    const hDisc = Math.round(
      (Array.isArray(ens.disciplines) ? ens.disciplines : [])
        .reduce((s, d) => s + (parseFloat(d.heures) || 0), 0) * 2
    ) / 2;

    // 2. Heures HPC affectées. On distingue :
    //    - HPC marquées 'hsa' → TOUJOURS HSA (forçage explicite, ne compte pas dans l'apport-poste)
    //    - HPC marquées 'hp'  → entrent dans l'apport comptabilisable HP/HSA comme les disciplines
    let hHPCposte = 0, hsaForce = 0;
    const detailHSAforce = []; // HPC explicitement HSA
    const detailHPCHp    = []; // HPC entrant dans l'apport-poste
    (hpcs || []).forEach(hpc => {
      const aff = (Array.isArray(hpc.enseignants) ? hpc.enseignants : [])
                    .find(a => a.ensId === ens.id);
      if (!aff) return;
      const h = parseFloat(aff.heures) || 0;
      if (h <= 0) return;
      if ((hpc.typeHeure || 'hp') === 'hsa') {
        hsaForce += h;
        detailHSAforce.push({ source: 'HPC', nom: hpc.nom, heures: h });
      } else {
        hHPCposte += h;
        detailHPCHp.push({ source: 'HPC', nom: hpc.nom, heures: h });
      }
    });
    hHPCposte = Math.round(hHPCposte * 2) / 2;
    hsaForce  = Math.round(hsaForce  * 2) / 2;

    // 3. Apport-poste total = disciplines + HPC-HP. C'est ce volume qui est plafonné par l'ORS.
    const apportPoste = Math.round((hDisc + hHPCposte) * 2) / 2;

    // 4. Plafond HP (ORS grade, ORS manuel motivé, ou volume BMP)
    const cap   = plafondHP(ens);
    const seuil = cap.plafond;
    const sansSeuil = seuil === 0; // contractuel sans volume → tout reste HP, pas de bascule

    // 5. Bascule automatique : HP jusqu'au seuil, le dépassement → HSA
    let hpTotal, hsaAuto;
    if (sansSeuil) {
      hpTotal = apportPoste;
      hsaAuto = 0;
    } else {
      hpTotal = Math.min(apportPoste, seuil);
      hsaAuto = Math.max(0, Math.round((apportPoste - seuil) * 2) / 2);
    }
    hpTotal = Math.round(hpTotal * 2) / 2;

    // HSA totale = dépassement d'apport (auto) + HPC forcées en HSA
    const hsaTotal = Math.round((hsaAuto + hsaForce) * 2) / 2;

    // detailHSA = sources HSA pour tooltip (dépassement + HPC forcées)
    const detailHSA = [];
    if (hsaAuto > 0) detailHSA.push({ source: 'Dépassement ORS', nom: 'Apport > ' + seuil + 'h', heures: hsaAuto });
    detailHSAforce.forEach(d => detailHSA.push(d));

    // Ventilation HP : part disciplines / part HPC (pour affichages détaillés).
    // On impute d'abord les disciplines, puis les HPC-HP, dans la limite du seuil HP.
    const hpDisc = sansSeuil ? hDisc : Math.min(hDisc, seuil);
    const hpHPC  = Math.round((hpTotal - hpDisc) * 2) / 2;

    const totalGeneral = Math.round((hpTotal + hsaTotal) * 2) / 2;

    // Écart ORS (informatif) : apport-poste vs seuil
    const ecartORS = sansSeuil ? null : Math.round((apportPoste - seuil) * 2) / 2;
    const statutORS = sansSeuil ? 'sans-ors'
      : ecartORS > 0  ? 'hsa'
      : ecartORS < 0  ? 'sous-service'
      : 'equilibre';

    return {
      hpDisc, hpHPC, hpTotal,
      hsaAuto, hsaForce, hsaTotal,
      apportPoste, totalGeneral,
      detailHSA,    // sources HSA pour tooltip
      detailHPCHp,  // sources HPC-HP pour tooltip
      ors: seuil, plafondSource: cap.source,
      ecartORS, statutORS
    };
  }


/**
 * Calcule le coût total d'un scénario appliqué sur les données réelles.
 * Fonction pure — zéro DOM, zéro localStorage.
 *
 * @param {Object} anneeData     - DGHData.getAnnee()
 * @param {Array}  modificateurs - ScenarioObject.modificateurs
 */
function bilanScenario(anneeData, modificateurs) {
  const bilanBase  = bilanDotation(anneeData);
  const disciplines = anneeData.disciplines || [];

  // ── Ventilation HP/HSA par consommation d'enveloppe (Sprint 21) ──────────
  // Principe (janvier, raisonnement en MASSE) : on remplit d'abord l'enveloppe
  // HP encore disponible, puis tout déborde en HSA. L'ordre de consommation
  // suit l'ordre de SAISIE des modalités (option retenue avec la direction).
  //
  // Une modalité peut être « à cheval » : s'il reste 2h d'HP dispo et qu'on
  // pose 5h, on obtient 2h HP + 3h HSA.
  //
  // Forçage : si mod.forcage === 'hp' ou 'hsa', le choix de la direction prime
  // et la modalité ne suit pas la bascule auto. (Compat : l'ancien mod.typeHeure
  // est traité comme un forçage — voir migration data.js.)
  //
  // HP déjà engagé hors scénario = bilanBase.totalHP. Ce qui reste d'enveloppe
  // HP à distribuer aux modalités :
  let hpDispo = Math.round((bilanBase.hPosteEnv - bilanBase.totalHP) * 2) / 2;
  if (hpDispo < 0) hpDispo = 0; // enveloppe HP déjà dépassée → tout en HSA

  let coutHP = 0, coutHSA = 0;
  const detailParMod  = [];
  const deltaParDisc  = {}; // { disciplineId: deltaHP+HSA } (pour le récap discipline)

  // Répartit `delta` heures entre HP (dans la limite de hpDispo) et HSA,
  // selon le forçage éventuel. Met à jour hpDispo. Renvoie {hp, hsa}.
  function _ventiler(delta, forcage) {
    let hp = 0, hsa = 0;
    if (forcage === 'hp') {
      hp = delta;                       // choix direction : tout HP
      hpDispo = Math.round((hpDispo - delta) * 2) / 2; // peut passer négatif : assumé
    } else if (forcage === 'hsa') {
      hsa = delta;                      // choix direction : tout HSA, n'entame pas l'enveloppe HP
    } else {
      // Auto : HP tant qu'il reste de l'enveloppe, débordement en HSA.
      hp  = Math.max(0, Math.min(delta, hpDispo));
      hsa = Math.round((delta - hp) * 2) / 2;
      hpDispo = Math.round((hpDispo - hp) * 2) / 2;
    }
    return { hp: Math.round(hp * 2) / 2, hsa: Math.round(hsa * 2) / 2 };
  }

  (modificateurs || []).forEach(mod => {
    const forcage = mod.forcage || null; // 'hp' | 'hsa' | null(auto)

    // ── Modalités pédagogiques (dédoublement, co-ens, GER, GBI, autre) ──────
    const MODS_PEDAGOGIQUES = ['dedoublement','co-enseignement','groupe-effectif-reduit','groupes-besoins','autre'];
    if (MODS_PEDAGOGIQUES.includes(mod.type)) {
      const nbClasses = (mod.classeIds || []).length;
      let delta;
      if (mod.type === 'groupes-besoins') {
        const nbGroupes = Math.max(1, Math.ceil(nbClasses / 2));
        delta = Math.round((mod.heuresParGroupe || 0) * nbGroupes * 2) / 2;
      } else {
        delta = Math.round((mod.heuresParGroupe || 0) * nbClasses * 2) / 2;
      }

      const v = _ventiler(delta, forcage);
      coutHP += v.hp; coutHSA += v.hsa;
      if (mod.disciplineId) deltaParDisc[mod.disciplineId] = (deltaParDisc[mod.disciplineId] || 0) + delta;

      // Libellé lisible : montre la ventilation et si elle est forcée ou auto.
      let lib = (mod.titre || mod.type) + ' → ';
      if (v.hp > 0 && v.hsa > 0)      lib += '+' + v.hp + 'h HP + ' + v.hsa + 'h HSA';
      else if (v.hp > 0)              lib += '+' + v.hp + 'h HP';
      else                           lib += '+' + v.hsa + 'h HSA';
      if (forcage) lib += ' (forcé ' + forcage.toUpperCase() + ')';
      else if (v.hp > 0 && v.hsa > 0) lib += ' (enveloppe HP épuisée)';

      detailParMod.push({ mod, coutHP: v.hp, coutHSA: v.hsa,
        forcage, ventilAuto: !forcage, libelle: lib });
    }
    else if (mod.type === 'projet') {
      // Projet : HP et HSA saisis explicitement par l'utilisateur → considérés
      // comme un choix ferme, on n'applique pas la bascule auto, mais on
      // décrémente l'enveloppe HP disponible du HP consommé.
      const dHP  = parseFloat(mod.heuresHP)  || 0;
      const dHSA = parseFloat(mod.heuresHSA) || 0;
      coutHP  += dHP;
      coutHSA += dHSA;
      hpDispo  = Math.round((hpDispo - dHP) * 2) / 2;
      detailParMod.push({
        mod, coutHP: dHP, coutHSA: dHSA, forcage: 'projet', ventilAuto: false,
        libelle: (mod.nom || 'Projet')
          + (dHP  > 0 ? ' +' + dHP  + 'h HP'  : '')
          + (dHSA > 0 ? ' +' + dHSA + 'h HSA' : '')
      });
    }
  });

  coutHP  = Math.round(coutHP  * 2) / 2;
  coutHSA = Math.round(coutHSA * 2) / 2;
  const coutTotal   = Math.round((coutHP + coutHSA) * 2) / 2;
  const soldeSimule = Math.round((bilanBase.solde - coutTotal) * 2) / 2;

  const detailParDisc = disciplines.map(disc => {
    const rep      = (anneeData.repartition || []).find(r => r.disciplineId === disc.id) || {};
    const coutBase = Math.round(((rep.hPoste || 0) + (rep.hsa || 0)) * 2) / 2;
    const delta    = deltaParDisc[disc.id] || 0;
    return {
      disciplineId: disc.id,
      nom:          disc.nom,
      couleur:      disc.couleur || '#6b6860',
      coutBase,
      delta,
      coutScen: Math.round((coutBase + delta) * 2) / 2
    };
  }).filter(d => d.coutBase > 0 || d.delta !== 0);

  return {
    coutHP, coutHSA, coutTotal,
    soldeBase:   bilanBase.solde,
    soldeSimule,
    enveloppe:   bilanBase.enveloppe,
    depassement: soldeSimule < 0,
    detailParDisc,
    detailParMod
  };
}

/**
 * Compare plusieurs scénarios entre eux.
 * Retourne le tableau trié par solde simulé décroissant (meilleur en premier).
 */
function comparerScenarios(anneeData, scenarios) {
  return (scenarios || [])
    .map(scen => ({
      scenario: scen,
      bilan:    bilanScenario(anneeData, scen.modificateurs)
    }))
    .sort((a, b) => b.bilan.soldeSimule - a.bilan.soldeSimule);
}

/**
 * Comparatif des disciplines entre deux jeux de données annuels.
 * anneeN et anneeN1 sont des objets { disciplines[], repartition[], heuresPedaComp[] }
 * (données vivantes ou snapshot).
 * Retourne un tableau trié alphabétiquement.
 */
function comparatifDisciplines(anneeN, anneeN1) {
  function hParDisc(annee) {
    const map = {};
    (annee.disciplines || []).forEach(d => { map[d.id] = { id: d.id, nom: d.nom, hp: 0, hsa: 0 }; });
    (annee.repartition || []).forEach(r => {
      if (map[r.disciplineId]) {
        map[r.disciplineId].hp  += r.hPoste || 0;
        map[r.disciplineId].hsa += r.hsa    || 0;
      }
    });
    return map;
  }

  const mapN  = hParDisc(anneeN  || {});
  const mapN1 = hParDisc(anneeN1 || {});
  const allIds = new Set([...Object.keys(mapN), ...Object.keys(mapN1)]);
  const rows = [];

  allIds.forEach(id => {
    const n  = mapN[id];
    const n1 = mapN1[id];
    const hpN    = n  ? Math.round((n.hp )  *2)/2 : null;
    const hsaN   = n  ? Math.round((n.hsa)  *2)/2 : null;
    const totalN  = n  ? Math.round((hpN  + hsaN ) *2)/2 : null;
    const hpN1   = n1 ? Math.round((n1.hp) *2)/2 : null;
    const hsaN1  = n1 ? Math.round((n1.hsa)*2)/2 : null;
    const totalN1 = n1 ? Math.round((hpN1 + hsaN1)*2)/2 : null;
    const delta  = (totalN !== null && totalN1 !== null) ? Math.round((totalN - totalN1)*2)/2 : null;
    const pct    = (delta !== null && totalN1 > 0) ? Math.round((delta / totalN1) * 100) : null;
    const statut = !n1 ? 'nouveau' : !n ? 'supprime' : 'stable';
    const nom    = (n ? n.nom : n1 ? n1.nom : '') || '';
    rows.push({ id, nom, hpN, hsaN, totalN, hpN1, hsaN1, totalN1, delta, pct, statut });
  });

  return rows.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/**
 * Données pour la Synthèse CA.
 */
function syntheseCA(anneeData, etab) {
  const bilan  = bilanDotation(anneeData);
  const stru   = resumeStructures(anneeData.structures || []);
  const discs  = (anneeData.disciplines || []).map(d => {
    const rep  = (anneeData.repartition || []).find(r => r.disciplineId === d.id);
    const hp   = rep ? Math.round((rep.hPoste || 0) * 2) / 2 : 0;
    const hsa  = rep ? Math.round((rep.hsa    || 0) * 2) / 2 : 0;
    return { id: d.id, nom: d.nom, couleur: d.couleur || '#94a3b8', hp, hsa, total: Math.round((hp + hsa) * 2) / 2 };
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const hpcs = (anneeData.heuresPedaComp || []).map(h => ({
    nom: h.nom, heures: h.heures || 0, typeHeure: h.typeHeure || 'hp'
  }));
  const missions   = anneeData.missions || [];
  const totalPacte = missions.filter(m => m.type === 'pacte').reduce((s, m) => s + (m.heures || 0), 0);
  const totalImp   = missions.filter(m => m.type === 'imp')  .reduce((s, m) => s + (m.heures || 0), 0);
  return { etab, annee: anneeData._annee || '', bilan, stru, discs, hpcs, totalPacte, totalImp };
}

/**
 * Données pour le Dialogue de gestion.
 */
function dialogueGestion(anneeData, etab) {
  const bilan = bilanDotation(anneeData);
  const stru  = resumeStructures(anneeData.structures || []);
  const hParEleve = stru.effectifTotal > 0
    ? Math.round((bilan.totalAlloue / stru.effectifTotal) * 100) / 100 : null;
  const tauxHSA = bilan.totalAlloue > 0
    ? Math.round((bilan.totalHSA / bilan.totalAlloue) * 1000) / 10 : 0;
  const niveaux = Object.keys(H_THEORIQUES_NIV);
  const ecartsMEN = niveaux.map(niv => {
    const divs = (anneeData.structures || []).filter(d => d.niveau === niv);
    const nbDiv = divs.length;
    const eff   = divs.reduce((s, d) => s + (d.effectif || 0), 0);
    const hMEN  = H_THEORIQUES_NIV[niv] || 0;
    const hMENTotal = Math.round(hMEN * nbDiv * 2) / 2;
    const totalDiv = (anneeData.structures || []).length;
    const hDotees = totalDiv === 0 ? 0 : Object.entries(GRILLES_MEN[niv] || {}).reduce((s, [discNom]) => {
      const disc = (anneeData.disciplines || []).find(d => d.nom === discNom);
      if (!disc) return s;
      const rep = (anneeData.repartition || []).find(r => r.disciplineId === disc.id);
      if (!rep) return s;
      return s + Math.round(((rep.hPoste || 0) + (rep.hsa || 0)) * (nbDiv / totalDiv) * 2) / 2;
    }, 0);
    const delta = nbDiv > 0 ? Math.round((hDotees - hMENTotal) * 2) / 2 : null;
    return { niv, nbDiv, eff, hMEN, hMENTotal, hDotees: Math.round(hDotees * 2) / 2, delta };
  }).filter(e => e.nbDiv > 0);
  const enseignants = anneeData.enseignants || [];
  const statutsMap = {};
  enseignants.forEach(e => { const s = e.grade || 'Inconnu'; statutsMap[s] = (statutsMap[s] || 0) + 1; });
  const statuts = Object.entries(statutsMap).map(([grade, nb]) => ({ grade, nb })).sort((a, b) => b.nb - a.nb);
  return { etab, annee: anneeData._annee || '', bilan, stru, hParEleve, tauxHSA, ecartsMEN, statuts, nbEns: enseignants.length };
}

/**
 * Récapitulatif de service par enseignant.
 */
function recapServices(anneeData, etab) {
  const hpcs     = anneeData.heuresPedaComp || [];
  const missions = anneeData.missions || [];
  const rows = (anneeData.enseignants || []).map(ens => {
    const svc  = serviceTotalEnseignant(ens, hpcs);
    const mEns = missions.filter(m => m.enseignantId === ens.id);
    const totalPacte = mEns.filter(m => m.type === 'pacte').reduce((s, m) => s + (m.heures || 0), 0);
    const totalImp   = mEns.filter(m => m.type === 'imp')  .reduce((s, m) => s + (m.heures || 0), 0);
    return {
      id: ens.id, nom: ens.nom || '', prenom: ens.prenom || '',
      grade: ens.grade || '', disciplinePrincipale: ens.disciplinePrincipale || '',
      hpDisc: svc.hpDisc, hpHPC: svc.hpHPC, hpTotal: svc.hpTotal,
      hsaTotal: svc.hsaTotal, totalGeneral: svc.totalGeneral,
      ors: svc.ors, ecartORS: svc.ecartORS, statutORS: svc.statutORS,
      totalPacte, totalImp,
      totalAvecMissions: Math.round((svc.totalGeneral + totalPacte + totalImp) * 2) / 2
    };
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const bilan = bilanDotation(anneeData);
  return { etab, annee: anneeData._annee || '', rows, bilan, nbEns: rows.length };
}

/**
 * ══════════════════════════════════════════════════════════════════
 * RÉPARTITION DE SERVICE (v4.2) — fonctions pures
 * ══════════════════════════════════════════════════════════════════
 */

/** Heures réglementaires MEN pour un (niveau, discipline). 0 si hors grille. */
function heuresGrille(niveau, discNom) {
  return (GRILLES_MEN[niveau] && GRILLES_MEN[niveau][discNom]) || 0;
}

/** true si au moins une affectation existe (toute l'année). */
function affectationsExistent(anneeData) {
  return Array.isArray(anneeData.affectations) && anneeData.affectations.length > 0;
}

/**
 * Liste des ensId qui enseignent une discipline donnée dans un ensemble de classes.
 * Sert au pilotage : un dédoublement de Maths sur 6eA retombe sur le(s) prof(s)
 * de Maths affecté(s) à 6eA. Si classeIds vide → tous les profs de la discipline.
 * @returns {string[]} ensIds (sans doublon)
 */
function profsDeClasseDiscipline(anneeData, disciplineId, classeIds) {
  const affs = anneeData.affectations || [];
  const setCl = Array.isArray(classeIds) && classeIds.length > 0 ? new Set(classeIds) : null;
  const out = new Set();
  affs.forEach(a => {
    if (disciplineId && a.disciplineId !== disciplineId) return;
    if (setCl && !setCl.has(a.divisionId)) return;
    if (a.ensId) out.add(a.ensId);
  });
  return Array.from(out);
}

/**
 * Construit les données de la grille récap classe × discipline.
 * @returns {{ divisions, disciplines, cells }}
 *   cells[divisionId][disciplineId] = [{ ensId, nom, heures }]
 */
function grilleRepartition(anneeData) {
  const divisions   = (anneeData.structures   || []);
  const disciplines = (anneeData.disciplines  || []);
  const enseignants = (anneeData.enseignants  || []);
  const ensById = {};
  enseignants.forEach(e => { ensById[e.id] = e; });
  const cells = {};
  (anneeData.affectations || []).forEach(a => {
    if (!cells[a.divisionId]) cells[a.divisionId] = {};
    if (!cells[a.divisionId][a.disciplineId]) cells[a.divisionId][a.disciplineId] = [];
    const ens = ensById[a.ensId];
    cells[a.divisionId][a.disciplineId].push({
      affId: a.id,
      ensId: a.ensId,
      nom:   ens ? ((ens.nom || '') + (ens.prenom ? ' ' + ens.prenom.charAt(0) + '.' : '')).trim() : '?',
      heures: a.heures || 0
    });
  });
  return { divisions, disciplines, cells };
}

/**
 * Contrôles de cohérence de la répartition de service.
 * @returns {Array<{severite, message, ref}>}
 */
function controlesRepartition(anneeData) {
  const out = [];
  const divisions   = (anneeData.structures  || []);
  const disciplines = (anneeData.disciplines || []);
  const affs        = (anneeData.affectations|| []);
  if (affs.length === 0) return out;
  const discById = {};
  disciplines.forEach(d => { discById[d.id] = d; });

  // Couverture par (division, discipline obligatoire de la grille) :
  // une discipline est "attendue" sur un niveau si la grille MEN lui donne des heures.
  divisions.forEach(div => {
    const grille = GRILLES_MEN[div.niveau] || {};
    disciplines.forEach(disc => {
      const hMEN = grille[disc.nom] || 0;
      if (hMEN <= 0) return; // discipline non attendue à ce niveau
      const cell = affs.filter(a => a.divisionId === div.id && a.disciplineId === disc.id);
      const somme = Math.round(cell.reduce((s,a)=>s+(a.heures||0),0)*2)/2;
      if (cell.length === 0) {
        out.push({ severite:'warning', ref:div.id,
          message: div.nom + ' — ' + disc.nom + ' : aucun enseignant affecté (' + hMEN + 'h attendues).' });
      } else if (Math.abs(somme - hMEN) >= 0.5) {
        out.push({ severite:'info', ref:div.id,
          message: div.nom + ' — ' + disc.nom + ' : ' + somme + 'h affectées pour ' + hMEN + 'h grille (écart ' + (somme>hMEN?'+':'') + Math.round((somme-hMEN)*2)/2 + 'h).' });
      }
    });
    if (!div.ppEnsId) {
      out.push({ severite:'info', ref:div.id, message: div.nom + ' : aucun professeur principal désigné.' });
    }
  });
  return out;
}

/**
 * ══════════════════════════════════════════════════════════════════
 * PRÉPARATION EDT (v4.8.0) — fonctions pures
 * ══════════════════════════════════════════════════════════════════
 */

const JOURS_LABEL = { lun:'Lundi', mar:'Mardi', mer:'Mercredi', jeu:'Jeudi', ven:'Vendredi' };

/**
 * true si deux fréquences de slot/barrette entrent en conflit horaire.
 * hebdo entre en conflit avec tout. semaine-A ne conflicte qu'avec hebdo et semaine-A.
 */
function _frequencesConflit(f1, f2) {
  f1 = f1 || 'hebdo'; f2 = f2 || 'hebdo';
  if (f1 === 'hebdo' || f2 === 'hebdo') return true;
  return f1 === f2;
}

/**
 * Détecte les conflits de préparation EDT : enseignants en double barrette,
 * salles spécialisées saturées, indisponibilités dures sans aucun créneau libre.
 * @returns {Array<{severite, categorie, message, ref}>}
 */
function controlesEDT(anneeData, etab, indisponibilitesResolues) {
  const out = [];
  const contraintesEDT = anneeData.contraintesEDT || {};
  const barrettes      = contraintesEDT.barrettes || [];
  const indispos        = Array.isArray(indisponibilitesResolues)
    ? indisponibilitesResolues
    : (contraintesEDT.indisponibilites || []);
  const enseignants     = anneeData.enseignants || [];
  const salles          = (etab && etab.salles) || [];

  // 1. Enseignant présent dans 2+ slots de barrettes à fréquence compatible
  const occupations = []; // { ensId, barretteNom, slotIdx, frequence }
  barrettes.forEach(b => {
    (b.slots || []).forEach((s, idx) => {
      (s.ensIds || []).forEach(ensId => {
        occupations.push({ ensId, barretteNom: b.nom || 'Barrette', slotIdx: idx, frequence: s.frequence || 'hebdo' });
      });
    });
  });
  const parEns = {};
  occupations.forEach(o => { (parEns[o.ensId] = parEns[o.ensId] || []).push(o); });
  Object.entries(parEns).forEach(([ensId, occs]) => {
    if (occs.length < 2) return;
    const ens  = enseignants.find(e => e.id === ensId);
    const nom  = ens ? ((ens.prenom||'')+' '+ens.nom).trim() : '?';
    for (let i = 0; i < occs.length; i++) {
      for (let j = i+1; j < occs.length; j++) {
        if (_frequencesConflit(occs[i].frequence, occs[j].frequence)) {
          out.push({
            severite: 'error', categorie: 'barrette',
            message: nom + ' apparaît simultanément dans « ' + occs[i].barretteNom + ' » et « ' + occs[j].barretteNom + ' » (conflit possible).',
            ref: ensId
          });
        }
      }
    }
  });

  // 2. Salles spécialisées saturées : plus de cours hebdo que d'exemplaires disponibles
  //    Comparaison par discipline associée à la barrette ↔ type de salle.
  const TYPE_PAR_DISC = { 'SVT':'svt', 'Physique-Chimie':'physique', 'Éducation musicale':'musique', 'Arts plastiques':'arts', 'Technologie':'techno', 'EPS':'gym' };
  const disciplines = anneeData.disciplines || [];
  if (salles.length > 0) {
    const compteParType = {};
    barrettes.forEach(b => {
      const discNoms = (b.disciplineIds||[]).map(did => (disciplines.find(d=>d.id===did)||{}).nom).filter(Boolean);
      discNoms.forEach(nom => {
        const type = TYPE_PAR_DISC[nom];
        if (!type) return;
        // Compter le nombre de slots simultanés sur cette barrette pour cette discipline (cours en parallèle = besoin simultané)
        const nbSlotsSimultanes = (b.slots || []).length || 1;
        compteParType[type] = Math.max(compteParType[type] || 0, nbSlotsSimultanes);
      });
    });
    Object.entries(compteParType).forEach(([type, nbBesoin]) => {
      const sallesType = salles.filter(s => s.type === type);
      const nbDispo = sallesType.reduce((s, sl) => s + (sl.nb || 1), 0);
      if (sallesType.length > 0 && nbBesoin > nbDispo) {
        const typeLabel = (TYPES_SALLE_LABELS[type] || type);
        out.push({
          severite: 'warning', categorie: 'salle',
          message: typeLabel + ' : ' + nbBesoin + ' cours simultanés prévus pour ' + nbDispo + ' salle(s) disponible(s).',
          ref: type
        });
      }
    });
  }

  // 3. Indisponibilité dure couvrant tous les jours ouvrés (saisie probablement erronée)
  const joursOuvres = (anneeData.organisationSemaine && Array.isArray(anneeData.organisationSemaine.joursOuvres) && anneeData.organisationSemaine.joursOuvres.length)
    ? anneeData.organisationSemaine.joursOuvres
    : ['lun', 'mar', 'mer', 'jeu', 'ven'];
  const parEnsIndispo = {};
  indispos.filter(i => i.type === 'dure').forEach(i => { (parEnsIndispo[i.ensId] = parEnsIndispo[i.ensId] || []).push(i); });
  Object.entries(parEnsIndispo).forEach(([ensId, list]) => {
    const joursCouverts = new Set(list.map(i => i.jour));
    const toutCouvert = joursOuvres.every(j => joursCouverts.has(j));
    if (toutCouvert && joursOuvres.length > 0) {
      const ens = enseignants.find(e => e.id === ensId);
      const nom = ens ? ((ens.prenom||'')+' '+ens.nom).trim() : '?';
      out.push({ severite:'warning', categorie:'indisponibilite', message: nom + ' : marqué indisponible sur tous les jours ouvrés — vérifier la saisie.', ref: ensId });
    }
  });

  return out;
}

const TYPES_SALLE_LABELS = {
  svt: 'Labo SVT', physique: 'Labo Physique-Chimie', musique: 'Salle Musique',
  arts: 'Salle Arts plastiques', techno: 'Salle Technologie', gym: 'Gymnase / EPS', autre: 'Autre salle'
};

/**
 * Calcule, pour chaque créneau candidat, le nombre d'enseignants réellement
 * disponibles (hors indisponibilités dures et contraintes libres qui les concernent),
 * avec pénalité partielle pour les vœux souples. Sert à recommander le meilleur
 * créneau pour l'heure bleue (réunions).
 *
 * Limite assumée : ne connaît pas les cours déjà posés dans Index Éducation —
 * uniquement les contraintes saisies dans l'application.
 *
 * @param {Array} enseignants
 * @param {Array} indisponibilites  contraintesEDT.indisponibilites
 * @param {Array} contraintesLibres contraintesEDT.contraintesLibres
 * @param {Array} creneaux  [{ jour, debut, fin }]  créneaux candidats définis par l'utilisateur
 * @returns {Array<{ jour, debut, fin, nbTotal, nbDisponibles, indisponiblesDurs:[{ensId,nom,motif}], voeuxSouples:[{ensId,nom,motif}], score, recommandation }>}
 */
function creneauBleuOptimal(enseignants, indisponibilites, contraintesLibres, creneaux) {
  if (!Array.isArray(creneaux) || creneaux.length === 0) return [];
  const ens = Array.isArray(enseignants) ? enseignants : [];
  const indispos = Array.isArray(indisponibilites)  ? indisponibilites  : [];
  const libres    = Array.isArray(contraintesLibres) ? contraintesLibres : [];

  function _chevauche(jour, debut, fin, iJour, iDebut, iFin, iPlage) {
    if (iJour !== jour) return false;
    if (iPlage === 'journee') return true;
    if (iPlage === 'matin')  return debut < '13:00';
    if (iPlage === 'aprem')  return fin   >= '13:00';
    if (iPlage === 'creneau') return iDebut && iFin && debut < iFin && fin > iDebut;
    return false;
  }

  const resultats = creneaux.map(c => {
    const indisponiblesDurs = [];
    const voeuxSouples = [];
    ens.forEach(e => {
      const nom = ((e.prenom||'')+' '+e.nom).trim();
      const indEns = indispos.filter(i => i.ensId === e.id && _chevauche(c.jour, c.debut, c.fin, i.jour, i.heureDebut, i.heureFin, i.plage));
      const dur    = indEns.find(i => i.type === 'dure');
      const souple = indEns.find(i => i.type === 'souple');
      if (dur)    { indisponiblesDurs.push({ ensId: e.id, nom, motif: dur.motif || '' }); return; }
      // Contrainte libre qui implique l'enseignant (ex : accompagnement conservatoire)
      const libreConcerne = libres.find(cl =>
        (cl.ensIds||[]).includes(e.id) && cl.jour === c.jour &&
        cl.heureDebut && cl.heureFin && c.debut < cl.heureFin && c.fin > cl.heureDebut
      );
      if (libreConcerne) { indisponiblesDurs.push({ ensId: e.id, nom, motif: libreConcerne.titre || 'Contrainte libre' }); return; }
      if (souple) voeuxSouples.push({ ensId: e.id, nom, motif: souple.motif || '' });
    });
    const nbTotal       = ens.length;
    const nbIndispo      = indisponiblesDurs.length;
    const nbDisponibles  = nbTotal - nbIndispo;
    const score = nbTotal - nbIndispo - (voeuxSouples.length * 0.5);
    return {
      jour: c.jour, debut: c.debut, fin: c.fin,
      jourLabel: JOURS_LABEL[c.jour] || c.jour,
      nbTotal, nbDisponibles,
      indisponiblesDurs, voeuxSouples,
      score: Math.round(score * 10) / 10
    };
  });

  resultats.sort((a, b) => b.score - a.score);
  resultats.forEach((r, i) => {
    r.recommandation = i === 0 ? 'optimal' : (r.score >= resultats[0].score * 0.75 ? 'correct' : 'deconseille');
  });
  return resultats;
}

  /**
   * Bilan HP/HSA de l'équipe — agrège l'apport réel de chaque enseignant.
   * C'est la vue "remontée TRM" : HP consommées par l'équipe, HSA générées,
   * répartition par statut. Fonction pure.
   *
   * @param {Array} enseignants
   * @param {Array} hpcs  DGHData.getHeuresPedaComp()
   * @returns {{ nbEns, totalHP, totalHSA, totalGeneral, parStatut, rows }}
   */
  function bilanEquipe(enseignants, hpcs) {
    const list = Array.isArray(enseignants) ? enseignants : [];
    let totalHP = 0, totalHSA = 0, totalGeneral = 0;
    const parStatut = {};
    const rows = list.map(ens => {
      const sv = serviceTotalEnseignant(ens, hpcs || []);
      totalHP      += sv.hpTotal;
      totalHSA     += sv.hsaTotal;
      totalGeneral += sv.totalGeneral;
      const st = ens.statut || 'titulaire';
      if (!parStatut[st]) parStatut[st] = { statut: st, nb: 0, hp: 0, hsa: 0 };
      parStatut[st].nb++;
      parStatut[st].hp  += sv.hpTotal;
      parStatut[st].hsa += sv.hsaTotal;
      return {
        id: ens.id, nom: ens.nom || '', prenom: ens.prenom || '',
        grade: ens.grade || '', statut: st,
        disciplinePrincipale: ens.disciplinePrincipale || '',
        ors: sv.ors, plafondSource: sv.plafondSource,
        apportPoste: sv.apportPoste,
        hpTotal: sv.hpTotal, hsaAuto: sv.hsaAuto, hsaForce: sv.hsaForce,
        hsaTotal: sv.hsaTotal, totalGeneral: sv.totalGeneral,
        ecartORS: sv.ecartORS, statutORS: sv.statutORS,
        detailHSA: sv.detailHSA, motifORS: ens.motifORS || ''
      };
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    Object.values(parStatut).forEach(s => {
      s.hp = Math.round(s.hp * 2) / 2; s.hsa = Math.round(s.hsa * 2) / 2;
    });
    return {
      nbEns: list.length,
      totalHP:      Math.round(totalHP * 2) / 2,
      totalHSA:     Math.round(totalHSA * 2) / 2,
      totalGeneral: Math.round(totalGeneral * 2) / 2,
      parStatut: Object.values(parStatut),
      rows
    };
  }

  /**
   * Besoins vs apports par discipline — base de l'onglet "Besoins & apports".
   * Besoin = répartition par discipline × divisions (besoinTheorique de
   * besoinsParDiscipline), + delta du scénario actif si fourni.
   * Apport = HP des enseignants de la discipline (plafonné), HSA à part.
   */
  function bilanBesoinsApports(anneeData, scenModificateurs) {
    const structures  = anneeData.structures  || [];
    const disciplines = anneeData.disciplines || [];
    const repartition = anneeData.repartition || [];
    const grilles     = anneeData.grilles     || {};
    const enseignants = anneeData.enseignants || [];
    const hpcs        = anneeData.heuresPedaComp || [];

    const besoins = besoinsParDiscipline(structures, disciplines, repartition, grilles);
    const besoinByDisc = {};
    besoins.forEach(b => { besoinByDisc[b.nom] = b.besoinTheorique; });

    // Delta scénario par disciplineId → nom
    const deltaByDisc = {};
    if (Array.isArray(scenModificateurs)) {
      const nomById = {}; disciplines.forEach(d => { nomById[d.id] = d.nom; });
      scenModificateurs.forEach(mod => {
        if (!mod.disciplineId) return;
        const nom = nomById[mod.disciplineId]; if (!nom) return;
        const nbClasses = (mod.classeIds || []).length;
        let delta = 0;
        if (mod.type === 'groupes-besoins') {
          delta = (mod.heuresParGroupe || 0) * Math.max(1, Math.ceil(nbClasses / 2));
        } else if (['dedoublement','co-enseignement','groupe-effectif-reduit','autre'].includes(mod.type)) {
          delta = (mod.heuresParGroupe || 0) * nbClasses;
        }
        deltaByDisc[nom] = (deltaByDisc[nom] || 0) + delta;
      });
    }

    // Apport HP/HSA par discipline depuis les enseignants
    const apportByDisc = {};
    enseignants.forEach(ens => {
      const sv = serviceTotalEnseignant(ens, hpcs);
      const discs = Array.isArray(ens.disciplines) ? ens.disciplines : [];
      const totApport = sv.apportPoste > 0 ? sv.apportPoste : 1;
      discs.forEach(d => {
        const nom = d.discNom; if (!nom) return;
        const part = (parseFloat(d.heures) || 0) / totApport;
        const hpD  = Math.round(sv.hpTotal  * part * 2) / 2;
        const hsaD = Math.round(sv.hsaTotal * part * 2) / 2;
        if (!apportByDisc[nom]) apportByDisc[nom] = { hp: 0, hsa: 0, profs: [] };
        apportByDisc[nom].hp  += hpD;
        apportByDisc[nom].hsa += hsaD;
        apportByDisc[nom].profs.push({
          id: ens.id, nom: ens.nom || '', prenom: ens.prenom || '',
          statut: ens.statut || 'titulaire',
          heures: parseFloat(d.heures) || 0, hp: hpD, hsa: hsaD
        });
      });
    });

    let totBesoin = 0, totApportHP = 0, totApportHSA = 0;
    const rows = disciplines.map(disc => {
      const besoinBase = besoinByDisc[disc.nom] || 0;
      const delta      = deltaByDisc[disc.nom] || 0;
      const besoin     = Math.round((besoinBase + delta) * 2) / 2;
      const ap         = apportByDisc[disc.nom] || { hp: 0, hsa: 0, profs: [] };
      const apHP       = Math.round(ap.hp  * 2) / 2;
      const apHSA      = Math.round(ap.hsa * 2) / 2;
      const ecart      = Math.round((besoin - apHP) * 2) / 2;
      totBesoin    += besoin;
      totApportHP  += apHP;
      totApportHSA += apHSA;
      return {
        disciplineId: disc.id, nom: disc.nom, couleur: disc.couleur,
        besoin, besoinBase, deltaScen: Math.round(delta * 2) / 2,
        apportHP: apHP, apportHSA: apHSA, ecart,
        profs: ap.profs.sort((a, b) => (a.nom||'').localeCompare(b.nom||'', 'fr'))
      };
    });

    return {
      rows,
      totBesoin:    Math.round(totBesoin * 2) / 2,
      totApportHP:  Math.round(totApportHP * 2) / 2,
      totApportHSA: Math.round(totApportHSA * 2) / 2,
      totEcart:     Math.round((totBesoin - totApportHP) * 2) / 2,
      scenActif:    Array.isArray(scenModificateurs) && scenModificateurs.length > 0
    };
  }

  return {
    GRILLES_MEN,
    getORS, plafondHP, calcHeuresEnseignant, detailEnseignant, bilanEnseignants, bilanParDiscipline,
    resumeStructures, bilanDotation, besoinsParDiscipline,
    suggererRepartition, bilanHPC, genererAlertes, serviceTotalEnseignant, bilanEquipe,
    bilanBesoinsApports,
    bilanScenario, comparerScenarios, comparatifDisciplines,
    syntheseCA, dialogueGestion, recapServices,
    heuresGrille, affectationsExistent, profsDeClasseDiscipline,
    grilleRepartition, controlesRepartition,
    controlesEDT, creneauBleuOptimal
  };

})();
