/**
 * DGH App — Moteur de calcul
 * ORS par corps/grade, HSA, bilan DGH, alertes
 * Aucune dépendance externe
 */

const Calculs = (() => {

  // ─────────────────────────────────────────────
  // ORS — Obligations Réglementaires de Service
  // Source : décret n°50-581 du 25 mai 1950 et suivants
  // ─────────────────────────────────────────────
  const ORS = {
    // PLC (Professeurs certifiés, AE, CPE, CO-PSY, PLP)
    'certifie':       { label: 'Certifié',              ors: 18, seuil_hsa: 1 },
    'agrege':         { label: 'Agrégé',                ors: 15, seuil_hsa: 1 },
    'plp':            { label: 'PLP',                   ors: 17, seuil_hsa: 1 },
    'eps':            { label: 'Prof. EPS',             ors: 20, seuil_hsa: 1 },
    'documentaliste': { label: 'Professeur documentaliste', ors: 0, note: 'Service = 36h hebdo (présence établissement)' },
    'cpe':            { label: 'CPE',                   ors: 0, note: 'Service hebdomadaire de référence = 35h' },
    'psy_en':         { label: 'Psy-EN',                ors: 0, note: 'Service hebdomadaire = 35h' },
    'aed':            { label: 'AED',                   ors: 0, note: 'Contrat horaire spécifique' },

    // Contractuels
    'contractuel':    { label: 'Contractuel',           ors: 18, seuil_hsa: 1 },

    // Réductions réglementaires (déduites de l'ORS)
    reductions: {
      'reduction_age_55':     { label: '≥ 55 ans (1re réd.)',   heures: 1 },
      'reduction_age_60':     { label: '≥ 60 ans (2e réd.)',    heures: 1 },
      'reduction_directeur':  { label: 'Dir. adjoint (réduc.)', heures: 0 }, // cas particuliers
      'bmp':                  { label: 'BMP (bloc de moyens)',   heures: 0 }  // à saisir manuellement
    }
  };

  /**
   * Retourne l'ORS net d'un enseignant
   * @param {string} grade   — clé ORS (ex: 'certifie')
   * @param {number} orsManuel — si renseigné, écrase le calcul auto
   * @param {string[]} reductions — tableau de clés de réduction
   * @returns {number} ORS en heures hebdomadaires
   */
  function getORS(grade, orsManuel = null, reductions = []) {
    if (orsManuel !== null && !isNaN(orsManuel)) return parseFloat(orsManuel);

    const ref = ORS[grade];
    if (!ref || ref.ors === 0) return 0;

    let ors = ref.ors;
    reductions.forEach(r => {
      if (ORS.reductions[r]) ors -= ORS.reductions[r].heures;
    });
    return Math.max(0, ors);
  }

  // ─────────────────────────────────────────────
  // GRILLES HORAIRES MEN — Collège
  // Source : BO spécial n°11 du 26 novembre 2015
  // Toutes les valeurs sont modifiables dans l'UI
  // ─────────────────────────────────────────────
  const GRILLES_MEN = {
    '6e': {
      'Français':              4.5,
      'Mathématiques':         4.5,
      'Histoire-Géographie':   3,
      'LV1':                   4,
      'Sciences de la Vie et de la Terre': 1.5,
      'Physique-Chimie':       0,
      'Sciences et Technologie': 1.5,
      'Arts plastiques':       1,
      'Éducation musicale':    1,
      'EPS':                   3,
      'EMC':                   0.5,
      'Accompagnement personnalisé': 3
    },
    '5e': {
      'Français':              4.5,
      'Mathématiques':         3.5,
      'Histoire-Géographie':   3,
      'LV1':                   3,
      'LV2':                   2.5,
      'Sciences de la Vie et de la Terre': 1.5,
      'Physique-Chimie':       1.5,
      'Technologie':           1.5,
      'Arts plastiques':       1,
      'Éducation musicale':    1,
      'EPS':                   3,
      'EMC':                   0.5,
      'Accompagnement personnalisé': 2
    },
    '4e': {
      'Français':              4.5,
      'Mathématiques':         3.5,
      'Histoire-Géographie':   3,
      'LV1':                   3,
      'LV2':                   2.5,
      'Sciences de la Vie et de la Terre': 1.5,
      'Physique-Chimie':       1.5,
      'Technologie':           1.5,
      'Arts plastiques':       1,
      'Éducation musicale':    1,
      'EPS':                   3,
      'EMC':                   0.5,
      'Accompagnement personnalisé': 2
    },
    '3e': {
      'Français':              4,
      'Mathématiques':         4,
      'Histoire-Géographie':   3.5,
      'LV1':                   3,
      'LV2':                   2.5,
      'Sciences de la Vie et de la Terre': 1.5,
      'Physique-Chimie':       1.5,
      'Technologie':           1.5,
      'Arts plastiques':       1,
      'Éducation musicale':    1,
      'EPS':                   3,
      'EMC':                   0.5,
      'Accompagnement personnalisé': 2
    }
  };

  // ─────────────────────────────────────────────
  // CALCUL DGH — Besoins par discipline
  // ─────────────────────────────────────────────

  /**
   * Calcule les heures nécessaires par discipline
   * à partir des structures de classes et des grilles horaires
   *
   * @param {Array}  structures — divisions de l'établissement
   * @param {Object} grilles    — grilles horaires effectives (MEN + ajustements)
   * @returns {Object} { discipline: heuresBesoin }
   */
  function calcBesoinsParDiscipline(structures, grilles) {
    const besoins = {};

    structures.forEach(div => {
      const niveau = div.niveau; // ex: '6e'
      const grille = grilles[niveau] || GRILLES_MEN[niveau] || {};

      Object.entries(grille).forEach(([discipline, hSemaine]) => {
        if (!besoins[discipline]) besoins[discipline] = 0;
        // Heures annuelles = h/semaine × 36 semaines
        besoins[discipline] += hSemaine * 36;
      });

      // Groupes (dédoublements, options) comptés séparément
      if (div.groupes && div.groupes.length) {
        div.groupes.forEach(g => {
          if (!besoins[g.discipline]) besoins[g.discipline] = 0;
          besoins[g.discipline] += (g.heures || 0) * 36;
        });
      }
    });

    return besoins;
  }

  /**
   * Bilan global de la DGH
   * @param {Object} anneeData — données de l'année active
   * @returns {Object} bilan complet
   */
  function bilanDGH(anneeData) {
    const enveloppe   = anneeData.dotation?.enveloppe || 0;
    const repartition = anneeData.repartition || [];
    const enseignants = anneeData.enseignants || [];

    // Total heures allouées aux disciplines
    const heuresAllouees = repartition.reduce((sum, r) => sum + (r.heuresAllouees || 0), 0);
    const solde          = enveloppe - heuresAllouees;
    const pctConsomme    = enveloppe > 0 ? Math.round((heuresAllouees / enveloppe) * 100) : 0;

    // Calcul HSA totales
    let totalHSA = 0;
    let nbTZR    = 0;

    enseignants.forEach(ens => {
      const ors        = getORS(ens.grade, ens.orsManuel, ens.reductions || []);
      const heuresFait = calcHeuresEnseignant(ens);
      const hsa        = Math.max(0, heuresFait - ors);
      totalHSA += hsa;
      if (ens.statut === 'tzr' || ens.statut === 'complement') nbTZR++;
    });

    return {
      enveloppe,
      heuresAllouees,
      solde,
      pctConsomme,
      totalHSA:   Math.round(totalHSA * 2) / 2, // arrondi au 0.5
      nbEnseignants: enseignants.length,
      nbTZR
    };
  }

  /**
   * Calcule le volume horaire total affecté à un enseignant
   * @param {Object} enseignant
   * @returns {number} heures hebdomadaires
   */
  function calcHeuresEnseignant(enseignant) {
    const services = enseignant.services || [];
    return services.reduce((sum, s) => sum + (parseFloat(s.heures) || 0), 0);
  }

  /**
   * Détail complet du service d'un enseignant
   */
  function detailEnseignant(enseignant) {
    const ors        = getORS(enseignant.grade, enseignant.orsManuel, enseignant.reductions || []);
    const heuresFait = calcHeuresEnseignant(enseignant);
    const ecart      = heuresFait - ors;
    const hsa        = Math.max(0, ecart);
    const sousService = Math.max(0, -ecart);

    // Pacte
    const nbBriquesPacte = (enseignant.pacte || []).length;

    // IMP
    const totalIMP = (enseignant.imp || []).reduce((s, i) => s + (parseFloat(i.montant) || 0), 0);

    return {
      ors,
      heuresFait,
      ecart,
      hsa,
      sousService,
      nbBriquesPacte,
      totalIMP,
      statut: ecart > 0 ? 'hsa' : ecart < 0 ? 'sous-service' : 'equilibre'
    };
  }

  // ─────────────────────────────────────────────
  // ALERTES
  // ─────────────────────────────────────────────

  /**
   * Génère la liste des alertes à partir des données de l'année
   * @param {Object} anneeData
   * @returns {Array} alertes [{ type, severite, message, ref }]
   */
  function genererAlertes(anneeData) {
    const alertes    = [];
    const enseignants = anneeData.enseignants || [];
    const repartition = anneeData.repartition || [];
    const enveloppe   = anneeData.dotation?.enveloppe || 0;

    // 1. Enveloppe DGH non saisie
    if (enveloppe === 0) {
      alertes.push({
        type: 'dotation',
        severite: 'info',
        message: 'L\'enveloppe DGH n\'a pas encore été saisie.',
        ref: 'dotation'
      });
    }

    // 2. Dépassement d'enveloppe
    const heuresAllouees = repartition.reduce((s, r) => s + (r.heuresAllouees || 0), 0);
    if (enveloppe > 0 && heuresAllouees > enveloppe) {
      alertes.push({
        type: 'depassement',
        severite: 'error',
        message: `Dépassement de l'enveloppe : ${heuresAllouees - enveloppe}h au-dessus de la dotation.`,
        ref: 'dotation'
      });
    }

    // 3. Services individuels
    enseignants.forEach(ens => {
      const detail = detailEnseignant(ens);
      const nom    = `${ens.prenom || ''} ${ens.nom}`.trim();

      if (detail.sousService > 0) {
        alertes.push({
          type: 'sous-service',
          severite: 'warning',
          message: `${nom} : sous-service de ${detail.sousService}h (${detail.heuresFait}h / ORS ${detail.ors}h)`,
          ref: ens.id
        });
      }

      if (detail.hsa > 3) {
        alertes.push({
          type: 'hsa-eleve',
          severite: 'warning',
          message: `${nom} : ${detail.hsa}h d'HSA (seuil d'attention > 3h)`,
          ref: ens.id
        });
      }
    });

    // 4. Heures non affectées
    if (enveloppe > 0) {
      const solde = enveloppe - heuresAllouees;
      if (solde > 10) {
        alertes.push({
          type: 'heures-libres',
          severite: 'info',
          message: `${solde}h de la DGH ne sont pas encore affectées.`,
          ref: 'dotation'
        });
      }
    }

    return alertes;
  }

  // ─────────────────────────────────────────────
  // API publique
  // ─────────────────────────────────────────────
  return {
    ORS,
    GRILLES_MEN,
    getORS,
    calcBesoinsParDiscipline,
    bilanDGH,
    calcHeuresEnseignant,
    detailEnseignant,
    genererAlertes
  };

})();
