/**
 * DGH App — Moteur de calcul v1.0
 * Fonctions pures : zéro DOM, zéro localStorage
 */

const Calculs = (() => {

  // ── ORS — Décret n°50-581 du 25 mai 1950 et suivants ────────────
  const ORS = {
    certifie:       { label: 'Certifié',               ors: 18 },
    agrege:         { label: 'Agrégé',                 ors: 15 },
    plp:            { label: 'PLP',                    ors: 17 },
    eps:            { label: 'Prof. EPS',              ors: 20 },
    documentaliste: { label: 'Prof. documentaliste',   ors: 0, note: '36h présence' },
    cpe:            { label: 'CPE',                    ors: 0, note: '35h hebdo' },
    psy_en:         { label: 'Psy-EN',                 ors: 0, note: '35h hebdo' },
    contractuel:    { label: 'Contractuel',            ors: 18 }
  };

  // ── GRILLES MEN — BO spécial n°11 du 26 novembre 2015 ───────────
  const GRILLES_MEN = {
    '6e': { 'Français': 4.5, 'Mathématiques': 4.5, 'Histoire-Géographie': 3, 'LV1': 4, 'SVT': 1.5, 'Sciences et Technologie': 1.5, 'Arts plastiques': 1, 'Éducation musicale': 1, 'EPS': 3, 'EMC': 0.5, 'AP': 3 },
    '5e': { 'Français': 4.5, 'Mathématiques': 3.5, 'Histoire-Géographie': 3, 'LV1': 3, 'LV2': 2.5, 'SVT': 1.5, 'Physique-Chimie': 1.5, 'Technologie': 1.5, 'Arts plastiques': 1, 'Éducation musicale': 1, 'EPS': 3, 'EMC': 0.5, 'AP': 2 },
    '4e': { 'Français': 4.5, 'Mathématiques': 3.5, 'Histoire-Géographie': 3, 'LV1': 3, 'LV2': 2.5, 'SVT': 1.5, 'Physique-Chimie': 1.5, 'Technologie': 1.5, 'Arts plastiques': 1, 'Éducation musicale': 1, 'EPS': 3, 'EMC': 0.5, 'AP': 2 },
    '3e': { 'Français': 4, 'Mathématiques': 4, 'Histoire-Géographie': 3.5, 'LV1': 3, 'LV2': 2.5, 'SVT': 1.5, 'Physique-Chimie': 1.5, 'Technologie': 1.5, 'Arts plastiques': 1, 'Éducation musicale': 1, 'EPS': 3, 'EMC': 0.5, 'AP': 2 }
  };

  // ── FONCTIONS ────────────────────────────────────────────────────
  function getORS(grade, orsManuel) {
    if (orsManuel !== null && orsManuel !== undefined && !isNaN(orsManuel)) return parseFloat(orsManuel);
    return (ORS[grade] && ORS[grade].ors) || 0;
  }

  function calcHeuresEnseignant(ens) {
    return (ens.services || []).reduce((s, srv) => s + (parseFloat(srv.heures) || 0), 0);
  }

  function detailEnseignant(ens) {
    const ors         = getORS(ens.grade, ens.orsManuel);
    const heuresFait  = calcHeuresEnseignant(ens);
    const ecart       = heuresFait - ors;
    return {
      ors, heuresFait, ecart,
      hsa:        Math.max(0,  ecart),
      sousService:Math.max(0, -ecart),
      statut:     ecart > 0 ? 'hsa' : ecart < 0 ? 'sous-service' : 'equilibre'
    };
  }

  function bilanDGH(anneeData) {
    const enveloppe      = anneeData.dotation?.enveloppe || 0;
    const repartition    = anneeData.repartition || [];
    const enseignants    = anneeData.enseignants || [];
    const heuresAllouees = repartition.reduce((s, r) => s + (r.heuresAllouees || 0), 0);
    const solde          = enveloppe - heuresAllouees;
    const pctConsomme    = enveloppe > 0 ? Math.round((heuresAllouees / enveloppe) * 100) : 0;
    let totalHSA = 0, nbTZR = 0;
    enseignants.forEach(ens => {
      totalHSA += detailEnseignant(ens).hsa;
      if (ens.statut === 'tzr' || ens.statut === 'complement') nbTZR++;
    });
    return { enveloppe, heuresAllouees, solde, pctConsomme, totalHSA: Math.round(totalHSA * 2) / 2, nbEnseignants: enseignants.length, nbTZR };
  }

  function genererAlertes(anneeData) {
    const alertes     = [];
    const enveloppe   = anneeData.dotation?.enveloppe || 0;
    const repartition = anneeData.repartition || [];
    const enseignants = anneeData.enseignants || [];
    const allouees    = repartition.reduce((s, r) => s + (r.heuresAllouees || 0), 0);

    if (enveloppe === 0) {
      alertes.push({ type: 'dotation', severite: 'info', message: 'L\'enveloppe DGH n\'a pas encore été saisie.', ref: 'dotation' });
    }
    if (enveloppe > 0 && allouees > enveloppe) {
      alertes.push({ type: 'depassement', severite: 'error', message: 'Dépassement de l\'enveloppe : ' + (allouees - enveloppe) + 'h au-dessus de la dotation.', ref: 'dotation' });
    }
    enseignants.forEach(ens => {
      const d = detailEnseignant(ens);
      const nom = ((ens.prenom || '') + ' ' + ens.nom).trim();
      if (d.sousService > 0) alertes.push({ type: 'sous-service', severite: 'warning', message: nom + ' : sous-service de ' + d.sousService + 'h (fait ' + d.heuresFait + 'h / ORS ' + d.ors + 'h)', ref: ens.id });
      if (d.hsa > 3) alertes.push({ type: 'hsa', severite: 'warning', message: nom + ' : ' + d.hsa + 'h HSA (attention > 3h)', ref: ens.id });
    });
    if (enveloppe > 0 && (enveloppe - allouees) > 10) {
      alertes.push({ type: 'heures-libres', severite: 'info', message: (enveloppe - allouees) + 'h de la DGH ne sont pas encore affectées.', ref: 'dotation' });
    }
    return alertes;
  }

  return { ORS, GRILLES_MEN, getORS, calcHeuresEnseignant, detailEnseignant, bilanDGH, genererAlertes };

})();
