/**
 * DGH App — Vérifications du moteur de calcul
 * -------------------------------------------------------------
 * Fonctions PURES : zéro DOM, zéro localStorage.
 * Ce fichier ne fait que rejouer des cas métier précis sur calculs.js
 * et renvoyer la liste des résultats (OK / échec).
 *
 * Il est utilisé à DEUX endroits, avec exactement les mêmes cas :
 *   - dans le navigateur, par l'encart « Vérification » du tableau de bord ;
 *   - hors navigateur, par tests/test-service.js (filet de sécurité dev).
 *
 * RÈGLE : ne jamais dupliquer un cas. On l'écrit ici une seule fois.
 * -------------------------------------------------------------
 *
 * API publique :
 *   Verifs.lancer()  → {
 *     total, reussis, echoues,
 *     ok: Boolean,                       // true si tout passe
 *     groupes: [{ titre, lignes: [{ label, obtenu, attendu, ok }] }]
 *   }
 */
const Verifs = (() => {

  // Construit un enseignant + ses HPC, renvoie le service calculé.
  function _service({ grade = 'certifie', statut = 'titulaire', orsManuel = null,
                      volumeBMP = null, hCours = 0, hpc = null }) {
    const ens = {
      id: 'ens_test', grade, statut, orsManuel, volumeBMP,
      disciplines: hCours > 0 ? [{ discNom: 'Français', heures: hCours }] : []
    };
    const hpcs = [];
    if (hpc) {
      hpcs.push({
        id: 'hpc_chorale', nom: 'Chorale', typeHeure: hpc.type, heures: hpc.heures,
        enseignants: [{ ensId: 'ens_test', heures: hpc.heures }]
      });
    }
    return Calculs.serviceTotalEnseignant(ens, hpcs);
  }

  // Définition déclarative des cas. Chaque "ligne" est un contrôle élémentaire.
  // attendu = ce que TOI, chef d'établissement, as validé comme correct.
  function _definir() {
    return [
      {
        titre: 'Chorale typée HP — prof à 18h de cours (apport 20h)',
        calc: () => _service({ hCours: 18, hpc: { type: 'hp', heures: 2 } }),
        lignes: s => [
          ['Apport-poste',                  s.apportPoste, 20],
          ['HP total (plafonné à l’ORS)',   s.hpTotal,     18],
          ['HSA total',                     s.hsaTotal,    2],
          ['dont dépassement ORS',          s.hsaAuto,     2],
          ['Les cours restent 100% HP',     s.hpDisc,      18],
          ['La chorale est repoussée en HSA', s.hpHPC,     0]
        ]
      },
      {
        titre: 'Chorale typée HSA — prof à 18h de cours',
        calc: () => _service({ hCours: 18, hpc: { type: 'hsa', heures: 2 } }),
        lignes: s => [
          ['Apport-poste (chorale hors sac)', s.apportPoste, 18],
          ['HP total',                        s.hpTotal,     18],
          ['HSA total',                       s.hsaTotal,    2],
          ['HSA = la chorale assumée',        s.hsaForce,    2],
          ['Aucun dépassement d’ORS',         s.hsaAuto,     0],
          ['Service à l’équilibre',           s.statutORS,   'equilibre']
        ]
      },
      {
        titre: 'Chorale typée HP — prof à 16h de cours (absorbée dans l’ORS)',
        calc: () => _service({ hCours: 16, hpc: { type: 'hp', heures: 2 } }),
        lignes: s => [
          ['Apport-poste',          s.apportPoste, 18],
          ['HP total',              s.hpTotal,     18],
          ['Aucune HSA',            s.hsaTotal,    0],
          ['Service à l’équilibre', s.statutORS,   'equilibre']
        ]
      },
      {
        titre: 'Chorale typée HSA — prof à 16h de cours (→ sous-service)',
        calc: () => _service({ hCours: 16, hpc: { type: 'hsa', heures: 2 } }),
        lignes: s => [
          ['Apport-poste (16h de cours seuls)', s.apportPoste, 16],
          ['HP total',                          s.hpTotal,     16],
          ['HSA = la chorale',                  s.hsaTotal,    2],
          ['Écart ORS négatif',                 s.ecartORS,    -2],
          ['Alerte sous-service levée',         s.statutORS,   'sous-service']
        ]
      },
      {
        titre: 'BMP — volume du bloc 15h, apport 18h',
        calc: () => _service({ statut: 'bmp', volumeBMP: 15, hCours: 18 }),
        lignes: s => [
          ['Plafond = volume du BMP', s.ors,      15],
          ['HP total',                s.hpTotal,  15],
          ['HSA total',               s.hsaTotal, 3]
        ]
      },
      {
        titre: 'Temps partiel — certifié, ORS manuel 9h, 9h de cours',
        calc: () => _service({ orsManuel: 9, hCours: 9 }),
        lignes: s => [
          ['Plafond = ORS manuel', s.ors,       9],
          ['HP total',             s.hpTotal,   9],
          ['Aucune HSA',           s.hsaTotal,  0],
          ['Service à l’équilibre', s.statutORS, 'equilibre']
        ]
      },
      {
        titre: 'Contractuel sans ORS — pas de bascule, tout en HP',
        calc: () => _service({ grade: 'contractuel', statut: 'contractuel', hCours: 21 }),
        lignes: s => [
          ['HP total (aucun seuil)', s.hpTotal,  21],
          ['Aucune HSA',            s.hsaTotal, 0]
        ]
      }
    ];
  }

  function lancer() {
    const groupes = [];
    let total = 0, reussis = 0;

    _definir().forEach(def => {
      const lignes = [];
      let s;
      try {
        s = def.calc();
      } catch (e) {
        // Une erreur de calcul = échec dur, pas un plantage de la page.
        lignes.push({ label: 'Erreur de calcul : ' + (e && e.message || e),
                      obtenu: 'exception', attendu: '—', ok: false });
        total++;
        groupes.push({ titre: def.titre, lignes });
        return;
      }
      def.lignes(s).forEach(([label, obtenu, attendu]) => {
        const ok = obtenu === attendu;
        total++; if (ok) reussis++;
        lignes.push({ label, obtenu, attendu, ok });
      });
      groupes.push({ titre: def.titre, lignes });
    });

    return {
      total, reussis, echoues: total - reussis,
      ok: total - reussis === 0,
      groupes
    };
  }

  return { lancer };
})();

// Export Node (sans effet dans le navigateur).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Verifs };
}
