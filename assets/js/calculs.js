/**
 * DGH App — Moteur de calcul v1.2.0
 * Fonctions pures : zéro DOM, zéro localStorage
 *
 * v1.1.0 — Sprint 2 : resumeStructures()
 * v1.2.0 — Sprint 3 : bilanDotation(), besoinsParDiscipline()
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

  // ── FONCTIONS ENSEIGNANTS ────────────────────────────────────────
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
      hsa:         Math.max(0,  ecart),
      sousService: Math.max(0, -ecart),
      statut:      ecart > 0 ? 'hsa' : ecart < 0 ? 'sous-service' : 'equilibre'
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

  // ── RÉSUMÉ STRUCTURES — Sprint 2 ────────────────────────────────
  /**
   * Calcule le bilan des structures de classes.
   * Fonction pure : ne touche ni le DOM ni les données.
   *
   * @param {Array} structures — tableau de divisions issu de DGHData.getStructures()
   * @returns {{
   *   nbDivisions: number,
   *   effectifTotal: number,
   *   parNiveau: Array<{ niveau, nbDivisions, effectif, dispositifs }>,
   *   niveauxPresents: string[]
   * }}
   */
  function resumeStructures(structures) {
    if (!Array.isArray(structures) || structures.length === 0) {
      return { nbDivisions: 0, effectifTotal: 0, parNiveau: [], niveauxPresents: [] };
    }

    // Regroupement par niveau
    const map = {};
    structures.forEach(div => {
      if (!map[div.niveau]) map[div.niveau] = { niveau: div.niveau, nbDivisions: 0, effectif: 0, dispositifs: [] };
      map[div.niveau].nbDivisions++;
      map[div.niveau].effectif += div.effectif || 0;
      if (div.dispositif && !map[div.niveau].dispositifs.includes(div.dispositif)) {
        map[div.niveau].dispositifs.push(div.dispositif);
      }
    });

    // Ordre canonique des niveaux
    const ORDER = { '6e':0,'5e':1,'4e':2,'3e':3,'SEGPA':4,'ULIS':5,'UPE2A':6 };
    const parNiveau = Object.values(map).sort((a,b) => (ORDER[a.niveau]??99) - (ORDER[b.niveau]??99));

    return {
      nbDivisions:    structures.length,
      effectifTotal:  structures.reduce((s, d) => s + (d.effectif || 0), 0),
      parNiveau,
      niveauxPresents: parNiveau.map(n => n.niveau)
    };
  }

  // ── BILAN DOTATION — Sprint 3 ────────────────────────────────────
  /**
   * Calcule le bilan global de la dotation de l'année.
   * Utilisé par le module Dotation DGH et le Dashboard.
   *
   * @param {object} anneeData
   * @returns {{
   *   enveloppe: number,
   *   totalAlloue: number,
   *   solde: number,
   *   pctConsomme: number,
   *   nbDisciplines: number,
   *   depassement: boolean
   * }}
   */
  function bilanDotation(anneeData) {
    const enveloppe     = anneeData.dotation?.enveloppe || 0;
    const repartition   = anneeData.repartition || [];
    const totalAlloue   = Math.round(repartition.reduce((s, r) => s + (r.heuresAllouees || 0), 0) * 2) / 2;
    const solde         = Math.round((enveloppe - totalAlloue) * 2) / 2;
    const pctConsomme   = enveloppe > 0 ? Math.round((totalAlloue / enveloppe) * 100) : 0;
    return {
      enveloppe,
      totalAlloue,
      solde,
      pctConsomme,
      nbDisciplines: (anneeData.disciplines || []).length,
      depassement:   solde < 0
    };
  }

  /**
   * Calcule les besoins théoriques par discipline à partir des structures et des grilles MEN.
   * Rapproche le besoin théorique des heures allouées.
   *
   * Règle : pour chaque division d'un niveau donné et pour chaque discipline
   *         présente dans la grille MEN, on cumule les heures hebdomadaires × 36 semaines.
   * Note : on ne multiplie PAS par 36 (la DGH est en heures annuelles globales,
   *        mais l'usage courant en collège est en heures hebdo × nombre de divisions).
   *        Le calcul produit des "heures-division" directement comparables aux allouées.
   *
   * @param {Array} structures   — divisions (depuis DGHData.getStructures())
   * @param {Array} disciplines  — disciplines (depuis DGHData.getDisciplines())
   * @param {Array} repartition  — répartition actuelle (depuis DGHData.getRepartition())
   * @returns {Array<{
   *   disciplineId, nom, couleur,
   *   besoinTheorique: number,   // heures / semaine × nb divisions concernées
   *   heuresAllouees: number,
   *   ecart: number,             // alloue - theorique (positif = excédent)
   *   commentaire: string
   * }>}
   */
  function besoinsParDiscipline(structures, disciplines, repartition) {
    if (!Array.isArray(disciplines) || disciplines.length === 0) return [];

    // Calcul besoins théoriques MEN par nom de discipline
    const besoinsMap = {}; // nom discipline → heures/sem cumulées
    (structures || []).forEach(div => {
      const grille = GRILLES_MEN[div.niveau];
      if (!grille) return;
      Object.entries(grille).forEach(([nomDisc, h]) => {
        besoinsMap[nomDisc] = (besoinsMap[nomDisc] || 0) + h;
      });
    });

    return disciplines.map(disc => {
      const rep        = repartition.find(r => r.disciplineId === disc.id) || {};
      const theorique  = Math.round((besoinsMap[disc.nom] || 0) * 2) / 2;
      const alloue     = rep.heuresAllouees || 0;
      return {
        disciplineId:    disc.id,
        nom:             disc.nom,
        couleur:         disc.couleur,
        besoinTheorique: theorique,
        heuresAllouees:  alloue,
        ecart:           Math.round((alloue - theorique) * 2) / 2,
        commentaire:     rep.commentaire || ''
      };
    });
  }

  // ── ALERTES ──────────────────────────────────────────────────────
  function genererAlertes(anneeData) {
    const alertes     = [];
    const enveloppe   = anneeData.dotation?.enveloppe || 0;
    const repartition = anneeData.repartition || [];
    const enseignants = anneeData.enseignants || [];
    const structures  = anneeData.structures  || [];
    const allouees    = repartition.reduce((s, r) => s + (r.heuresAllouees || 0), 0);

    if (enveloppe === 0) {
      alertes.push({ type: 'dotation', severite: 'info', message: 'L\'enveloppe DGH n\'a pas encore été saisie.', ref: 'dotation' });
    }
    if (structures.length === 0) {
      alertes.push({ type: 'structures', severite: 'info', message: 'Aucune division saisie. Complétez les structures de classes.', ref: 'structures' });
    }
    if (enveloppe > 0 && allouees > enveloppe) {
      alertes.push({ type: 'depassement', severite: 'error', message: 'Dépassement de l\'enveloppe : ' + (allouees - enveloppe) + 'h au-dessus de la dotation.', ref: 'dotation' });
    }
    enseignants.forEach(ens => {
      const d   = detailEnseignant(ens);
      const nom = ((ens.prenom || '') + ' ' + ens.nom).trim();
      if (d.sousService > 0) alertes.push({ type: 'sous-service', severite: 'warning', message: nom + ' : sous-service de ' + d.sousService + 'h (fait ' + d.heuresFait + 'h / ORS ' + d.ors + 'h)', ref: ens.id });
      if (d.hsa > 3)         alertes.push({ type: 'hsa',          severite: 'warning', message: nom + ' : ' + d.hsa + 'h HSA (attention > 3h)', ref: ens.id });
    });
    if (enveloppe > 0 && (enveloppe - allouees) > 10) {
      alertes.push({ type: 'heures-libres', severite: 'info', message: (enveloppe - allouees) + 'h de la DGH ne sont pas encore affectées.', ref: 'dotation' });
    }
    return alertes;
  }

  return { ORS, GRILLES_MEN, getORS, calcHeuresEnseignant, detailEnseignant, bilanDGH, resumeStructures, bilanDotation, besoinsParDiscipline, genererAlertes };

})();
