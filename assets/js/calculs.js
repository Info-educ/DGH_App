/**
 * DGH App — Moteur de calcul v2.0.0
 * Fonctions pures : zéro DOM, zéro localStorage
 *
 * v1.1.0 — Sprint 2 : resumeStructures()
 * v1.2.0 — Sprint 3 : bilanDotation(), besoinsParDiscipline()
 * v2.0.0 — Sprint 4 : bilanDotation adapté HP+HSA, bilanGroupes()
 */

const Calculs = (() => {

  // ORS — Décret n°50-581 du 25 mai 1950 et suivants
  const ORS = {
    certifie:       { label: 'Certifié',             ors: 18 },
    agrege:         { label: 'Agrégé',               ors: 15 },
    plp:            { label: 'PLP',                  ors: 17 },
    eps:            { label: 'Prof. EPS',            ors: 20 },
    documentaliste: { label: 'Prof. documentaliste', ors: 0, note: '36h présence' },
    cpe:            { label: 'CPE',                  ors: 0, note: '35h hebdo' },
    psy_en:         { label: 'Psy-EN',               ors: 0, note: '35h hebdo' },
    contractuel:    { label: 'Contractuel',          ors: 18 }
  };

  // Grilles MEN — BO spécial n°11 du 26 novembre 2015
  const GRILLES_MEN = {
    '6e': { 'Français':4.5,'Mathématiques':4.5,'Histoire-Géographie':3,'LV1':4,'SVT':1.5,'Sciences et Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3,'EMC':0.5,'AP':3 },
    '5e': { 'Français':4.5,'Mathématiques':3.5,'Histoire-Géographie':3,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3,'EMC':0.5,'AP':2 },
    '4e': { 'Français':4.5,'Mathématiques':3.5,'Histoire-Géographie':3,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3,'EMC':0.5,'AP':2 },
    '3e': { 'Français':4,'Mathématiques':4,'Histoire-Géographie':3.5,'LV1':3,'LV2':2.5,'SVT':1.5,'Physique-Chimie':1.5,'Technologie':1.5,'Arts plastiques':1,'Éducation musicale':1,'EPS':3,'EMC':0.5,'AP':2 }
  };

  function getORS(grade, orsManuel) {
    if (orsManuel!==null && orsManuel!==undefined && !isNaN(orsManuel)) return parseFloat(orsManuel);
    return (ORS[grade]&&ORS[grade].ors)||0;
  }

  function calcHeuresEnseignant(ens) {
    return (ens.services||[]).reduce((s,srv)=>s+(parseFloat(srv.heures)||0),0);
  }

  function detailEnseignant(ens) {
    const ors=getORS(ens.grade,ens.orsManuel), heuresFait=calcHeuresEnseignant(ens), ecart=heuresFait-ors;
    return { ors, heuresFait, ecart, hsa:Math.max(0,ecart), sousService:Math.max(0,-ecart),
             statut:ecart>0?'hsa':ecart<0?'sous-service':'equilibre' };
  }

  function bilanDGH(anneeData) {
    const enveloppe=anneeData.dotation?.enveloppe||0;
    const repartition=anneeData.repartition||[];
    const enseignants=anneeData.enseignants||[];
    // Support HP+HSA (v2) et ancien format heuresAllouees (v1, migration)
    const heuresAllouees=repartition.reduce((s,r)=>s+(r.total!=null?r.total:(r.hPoste||0)+(r.hsa||0)+(r.heuresAllouees||0)),0);
    const solde=enveloppe-heuresAllouees;
    const pctConsomme=enveloppe>0?Math.round((heuresAllouees/enveloppe)*100):0;
    let totalHSA=0,nbTZR=0;
    enseignants.forEach(ens=>{totalHSA+=detailEnseignant(ens).hsa;if(ens.statut==='tzr'||ens.statut==='complement')nbTZR++;});
    return { enveloppe, heuresAllouees:Math.round(heuresAllouees*2)/2, solde:Math.round(solde*2)/2, pctConsomme, totalHSA:Math.round(totalHSA*2)/2, nbEnseignants:enseignants.length, nbTZR };
  }

  function resumeStructures(structures) {
    if (!Array.isArray(structures)||structures.length===0)
      return { nbDivisions:0, effectifTotal:0, parNiveau:[], niveauxPresents:[] };
    const map={};
    structures.forEach(div=>{
      if(!map[div.niveau]) map[div.niveau]={niveau:div.niveau,nbDivisions:0,effectif:0,dispositifs:[]};
      map[div.niveau].nbDivisions++;
      map[div.niveau].effectif+=div.effectif||0;
      if(div.dispositif&&!map[div.niveau].dispositifs.includes(div.dispositif)) map[div.niveau].dispositifs.push(div.dispositif);
    });
    const ORDER={'6e':0,'5e':1,'4e':2,'3e':3,'SEGPA':4,'ULIS':5,'UPE2A':6};
    const parNiveau=Object.values(map).sort((a,b)=>(ORDER[a.niveau]??99)-(ORDER[b.niveau]??99));
    return { nbDivisions:structures.length, effectifTotal:structures.reduce((s,d)=>s+(d.effectif||0),0), parNiveau, niveauxPresents:parNiveau.map(n=>n.niveau) };
  }

  /**
   * Bilan global de la dotation — v2 : distingue HP et HSA.
   */
  function bilanDotation(anneeData) {
    const enveloppe=anneeData.dotation?.enveloppe||0;
    const repartition=anneeData.repartition||[];
    let totalHP=0, totalHSA=0;
    repartition.forEach(r=>{
      totalHP  += r.hPoste||0;
      totalHSA += r.hsa||0;
    });
    totalHP  = Math.round(totalHP *2)/2;
    totalHSA = Math.round(totalHSA*2)/2;
    const totalAlloue = Math.round((totalHP+totalHSA)*2)/2;
    const solde       = Math.round((enveloppe-totalAlloue)*2)/2;
    const pctConsomme = enveloppe>0?Math.round((totalAlloue/enveloppe)*100):0;
    return { enveloppe, totalHP, totalHSA, totalAlloue, solde,
             pctConsomme, nbDisciplines:(anneeData.disciplines||[]).length, depassement:solde<0 };
  }

  /**
   * Besoins théoriques par discipline — v2 : retourne aussi hPoste/hsa.
   */
  function besoinsParDiscipline(structures, disciplines, repartition) {
    if (!Array.isArray(disciplines)||disciplines.length===0) return [];
    const besoinsMap={};
    (structures||[]).forEach(div=>{
      const grille=GRILLES_MEN[div.niveau]; if(!grille) return;
      Object.entries(grille).forEach(([nom,h])=>{ besoinsMap[nom]=(besoinsMap[nom]||0)+h; });
    });
    return disciplines.map(disc=>{
      const rep=repartition.find(r=>r.disciplineId===disc.id)||{};
      const theorique=Math.round((besoinsMap[disc.nom]||0)*2)/2;
      const hPoste=rep.hPoste||0, hsa=rep.hsa||0, total=Math.round((hPoste+hsa)*2)/2;
      return { disciplineId:disc.id, nom:disc.nom, couleur:disc.couleur,
               besoinTheorique:theorique, hPoste, hsa, total,
               ecart:Math.round((total-theorique)*2)/2, commentaire:rep.commentaire||'' };
    });
  }

  /**
   * Résumé des groupes & activités.
   * Retourne le total d'heures des groupes et le détail par type.
   */
  function bilanGroupes(groupes, disciplines) {
    if (!Array.isArray(groupes)||groupes.length===0)
      return { totalHeures:0, nbGroupes:0, parType:[], parDiscipline:[] };
    const discMap={};
    (disciplines||[]).forEach(d=>{discMap[d.id]=d;});
    const typeMap={}, discTotMap={};
    let total=0;
    groupes.forEach(g=>{
      total+=g.heures||0;
      typeMap[g.type]=(typeMap[g.type]||0)+(g.heures||0);
      if(g.disciplineId){discTotMap[g.disciplineId]=(discTotMap[g.disciplineId]||0)+(g.heures||0);}
    });
    const parType=Object.entries(typeMap).map(([type,h])=>({type,heures:Math.round(h*2)/2}));
    const parDiscipline=Object.entries(discTotMap).map(([id,h])=>({disciplineId:id,nom:(discMap[id]&&discMap[id].nom)||'—',heures:Math.round(h*2)/2}));
    return { totalHeures:Math.round(total*2)/2, nbGroupes:groupes.length, parType, parDiscipline };
  }

  function genererAlertes(anneeData) {
    const alertes=[];
    const enveloppe=anneeData.dotation?.enveloppe||0;
    const repartition=anneeData.repartition||[];
    const enseignants=anneeData.enseignants||[];
    const structures=anneeData.structures||[];
    const allouees=repartition.reduce((s,r)=>s+(r.hPoste||0)+(r.hsa||0)+(r.heuresAllouees||0),0);
    if(enveloppe===0) alertes.push({type:'dotation',severite:'info',message:'L\'enveloppe DGH n\'a pas encore été saisie.',ref:'dotation'});
    if(structures.length===0) alertes.push({type:'structures',severite:'info',message:'Aucune division saisie. Complétez les structures de classes.',ref:'structures'});
    if(enveloppe>0&&allouees>enveloppe) alertes.push({type:'depassement',severite:'error',message:'Dépassement de l\'enveloppe : '+(Math.round((allouees-enveloppe)*2)/2)+'h au-dessus de la dotation.',ref:'dotation'});
    enseignants.forEach(ens=>{
      const d=detailEnseignant(ens), nom=((ens.prenom||'')+' '+ens.nom).trim();
      if(d.sousService>0) alertes.push({type:'sous-service',severite:'warning',message:nom+' : sous-service de '+d.sousService+'h (fait '+d.heuresFait+'h / ORS '+d.ors+'h)',ref:ens.id});
      if(d.hsa>3)         alertes.push({type:'hsa',severite:'warning',message:nom+' : '+d.hsa+'h HSA (attention > 3h)',ref:ens.id});
    });
    if(enveloppe>0&&(enveloppe-allouees)>10) alertes.push({type:'heures-libres',severite:'info',message:Math.round((enveloppe-allouees)*2)/2+'h de la DGH ne sont pas encore affectées.',ref:'dotation'});
    return alertes;
  }

  return { ORS, GRILLES_MEN, getORS, calcHeuresEnseignant, detailEnseignant,
           bilanDGH, resumeStructures, bilanDotation, besoinsParDiscipline, bilanGroupes, genererAlertes };

})();
