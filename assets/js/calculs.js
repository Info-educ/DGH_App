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
    // 1. HP issues des disciplines (saisie manuelle dans vue "Par discipline")
    const hpDisc = Math.round(
      (Array.isArray(ens.disciplines) ? ens.disciplines : [])
        .reduce((s, d) => s + (parseFloat(d.heures) || 0), 0) * 2
    ) / 2;

    // 2. Heures HPC affectées → séparées HP / HSA
    let hpHPC = 0, hsaTotal = 0;
    const detailHSA   = []; // sources HSA (tooltip)
    const detailHPCHp = []; // sources HPC-HP (tooltip + déduction ORS)
    (hpcs || []).forEach(hpc => {
      const aff = (Array.isArray(hpc.enseignants) ? hpc.enseignants : [])
                    .find(a => a.ensId === ens.id);
      if (!aff) return;
      const h = parseFloat(aff.heures) || 0;
      if (h <= 0) return;
      if ((hpc.typeHeure || 'hp') === 'hsa') {
        hsaTotal += h;
        detailHSA.push({ source: 'HPC', nom: hpc.nom, heures: h });
      } else {
        hpHPC += h;
        detailHPCHp.push({ source: 'HPC', nom: hpc.nom, heures: h });
      }
    });

    hpHPC    = Math.round(hpHPC    * 2) / 2;
    hsaTotal = Math.round(hsaTotal * 2) / 2;
    const hpTotal      = Math.round((hpDisc + hpHPC) * 2) / 2;
    const totalGeneral = Math.round((hpTotal + hsaTotal) * 2) / 2;

    // 3. ORS sur HP — disponible pour TOUS les statuts si orsManuel renseigné ou grade avec ORS
    //    Contractuel sans orsManuel → ORS=0 → pas d'écart
    const ors      = getORS(ens.grade, ens.orsManuel);
    const sansORS  = ors === 0;
    const ecartORS = sansORS ? null : Math.round((hpTotal - ors) * 2) / 2;
    const statutORS = sansORS ? 'sans-ors'
      : ecartORS > 0  ? 'hsa'
      : ecartORS < 0  ? 'sous-service'
      : 'equilibre';

    return {
      hpDisc, hpHPC, hpTotal,
      hsaTotal, totalGeneral,
      detailHSA,    // sources HSA pour tooltip
      detailHPCHp,  // sources HPC-HP pour tooltip + déduction ORS vue discipline
      ors, ecartORS, statutORS
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

  let coutHP = 0, coutHSA = 0;
  const detailParMod  = [];
  const deltaParDisc  = {}; // { disciplineId: deltaHP }

  (modificateurs || []).forEach(mod => {
    // ── Modalités pédagogiques (dédoublement, co-ens, GER, GBI, autre) ──────
    // Par défaut HSA — sauf si l'utilisateur choisit HP via mod.typeHeure
    const MODS_PEDAGOGIQUES = ['dedoublement','co-enseignement','groupe-effectif-reduit','groupes-besoins','autre'];
    if (MODS_PEDAGOGIQUES.includes(mod.type)) {
      const isHP     = (mod.typeHeure === 'hp');
      const nbClasses = (mod.classeIds || []).length;

      // Calcul du delta selon le type
      let delta;
      if (mod.type === 'groupes-besoins') {
        // Groupes besoins : 1 groupe pour 2 classes
        const nbGroupes = Math.max(1, Math.ceil(nbClasses / 2));
        delta = Math.round((mod.heuresParGroupe || 0) * nbGroupes * 2) / 2;
      } else {
        // Tous les autres : H × nb classes
        delta = Math.round((mod.heuresParGroupe || 0) * nbClasses * 2) / 2;
      }

      if (isHP) {
        coutHP += delta;
        if (mod.disciplineId) deltaParDisc[mod.disciplineId] = (deltaParDisc[mod.disciplineId] || 0) + delta;
        detailParMod.push({ mod, coutHP: delta, coutHSA: 0,
          libelle: (mod.titre || mod.type) + ' → +' + delta + 'h HP' });
      } else {
        coutHSA += delta;
        // HSA : aussi comptabilisé par discipline pour l'affichage dans le récap
        if (mod.disciplineId) deltaParDisc[mod.disciplineId] = (deltaParDisc[mod.disciplineId] || 0) + delta;
        detailParMod.push({ mod, coutHP: 0, coutHSA: delta,
          libelle: (mod.titre || mod.type) + ' → +' + delta + 'h HSA' });
      }
    }
    else if (mod.type === 'projet') {
      const dHP  = parseFloat(mod.heuresHP)  || 0;
      const dHSA = parseFloat(mod.heuresHSA) || 0;
      coutHP  += dHP;
      coutHSA += dHSA;
      detailParMod.push({
        mod, coutHP: dHP, coutHSA: dHSA,
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

  return {
    ORS, GRILLES_MEN, H_THEORIQUES_NIV,
    getORS, calcHeuresEnseignant, detailEnseignant, bilanEnseignants, bilanParDiscipline,
    resumeStructures, bilanDotation, besoinsParDiscipline,
    suggererRepartition, bilanHPC, genererAlertes, serviceTotalEnseignant,
    bilanScenario, comparerScenarios
  };

})();
