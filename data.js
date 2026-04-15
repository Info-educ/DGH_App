/**
 * DGH App — Couche de données
 * Gère : structure du JSON, localStorage, import/export fichier
 * RGPD : aucune donnée n'est envoyée vers un serveur externe
 */

const DGHData = (() => {

  const STORAGE_KEY = 'dgh-app-data';
  const VERSION     = '1.0.0';

  // ─────────────────────────────────────────────
  // SCHÉMA DE DONNÉES (structure JSON complète)
  // ─────────────────────────────────────────────
  const defaultSchema = () => ({
    _meta: {
      version:    VERSION,
      createdAt:  new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
      appName:    'DGH App'
    },

    // Paramètres de l'établissement
    etablissement: {
      nom:       '',
      uai:       '',
      academie:  '',
      commune:   ''
    },

    // Données par année scolaire — clé : "2025-2026"
    annees: {
      '2025-2026': defaultAnnee('2025-2026')
    },

    // Année active
    anneeActive: '2025-2026'
  });

  // Structure d'une année scolaire
  const defaultAnnee = (annee) => ({
    annee,
    createdAt: new Date().toISOString(),

    // Dotation
    dotation: {
      enveloppe:   0,      // Heures DGH totales reçues
      commentaire: ''
    },

    // Structures de classes [{ id, niveau, nom, effectif, options:[], dispositif:null }]
    structures: [],

    // Grilles horaires MEN par niveau (modifiables)
    // Format : { "6e": { "Français": 4.5, "Maths": 4.5, ... }, ... }
    grilles: {},

    // Disciplines [{ id, nom, couleur, groupes }]
    disciplines: [],

    // Répartition DGH par discipline [{ disciplineId, heuresAllouees, commentaire }]
    repartition: [],

    // Enseignants
    // [{ id, nom, prenom, corps, grade, ors, statut, complement, disciplines[], services[], pacte[], imp[] }]
    enseignants: [],

    // Simulation — snapshot de données alternatives
    simulation: {
      active:      false,
      nom:         '',
      createdAt:   null,
      dotation:    null,
      repartition: [],
      enseignants: []
    },

    // Alertes calculées (regénérées à la volée)
    alertes: []
  });

  // ─────────────────────────────────────────────
  // ÉTAT INTERNE
  // ─────────────────────────────────────────────
  let _data = null;

  // ─────────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────────
  function init() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        _data = JSON.parse(raw);
        _migrate(_data);
      } catch(e) {
        console.warn('[DGHData] Données corrompues, réinitialisation.', e);
        _data = defaultSchema();
        save();
      }
    } else {
      _data = defaultSchema();
      save();
    }
    console.info(`[DGHData] v${VERSION} initialisé — année : ${_data.anneeActive}`);
    return _data;
  }

  // ─────────────────────────────────────────────
  // MIGRATION (pour les futures versions)
  // ─────────────────────────────────────────────
  function _migrate(data) {
    // Ici on ajoutera les migrations entre versions
    // Ex : if (data._meta.version === '1.0.0') { ... upgrade to 1.1.0 ... }
    if (!data._meta) data._meta = {};
    data._meta.version = VERSION;
  }

  // ─────────────────────────────────────────────
  // ACCESSEURS PRINCIPAUX
  // ─────────────────────────────────────────────
  function get()          { return _data; }
  function getEtab()      { return _data.etablissement; }
  function getAnneeActive() { return _data.anneeActive; }

  function getAnnee(annee) {
    const a = annee || _data.anneeActive;
    if (!_data.annees[a]) {
      _data.annees[a] = defaultAnnee(a);
    }
    return _data.annees[a];
  }

  function getAnnees() {
    return Object.keys(_data.annees).sort().reverse();
  }

  // ─────────────────────────────────────────────
  // MUTATEURS
  // ─────────────────────────────────────────────
  function setEtab(fields) {
    Object.assign(_data.etablissement, fields);
    save();
  }

  function setAnneeActive(annee) {
    if (!_data.annees[annee]) {
      _data.annees[annee] = defaultAnnee(annee);
    }
    _data.anneeActive = annee;
    save();
  }

  function setDotation(enveloppe, commentaire = '') {
    const annee = getAnnee();
    annee.dotation.enveloppe   = parseFloat(enveloppe) || 0;
    annee.dotation.commentaire = commentaire;
    save();
  }

  function addAnnee(annee) {
    if (!_data.annees[annee]) {
      _data.annees[annee] = defaultAnnee(annee);
      save();
    }
  }

  // ─────────────────────────────────────────────
  // SAVE → localStorage
  // ─────────────────────────────────────────────
  function save() {
    if (!_data) return;
    _data._meta.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
    } catch(e) {
      console.error('[DGHData] Erreur de sauvegarde localStorage :', e);
      // Peut arriver si quota dépassé — signaler à l'UI
      document.dispatchEvent(new CustomEvent('dgh:storage-error', { detail: e }));
    }
  }

  // ─────────────────────────────────────────────
  // EXPORT → fichier JSON local
  // ─────────────────────────────────────────────
  function exportJSON() {
    const payload = JSON.stringify(_data, null, 2);
    const blob    = new Blob([payload], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');

    const date    = new Date().toISOString().split('T')[0];
    const nom     = _data.etablissement.nom
      ? _data.etablissement.nom.replace(/\s+/g, '_').toLowerCase()
      : 'dgh';

    a.href     = url;
    a.download = `${nom}_${_data.anneeActive}_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return a.download;
  }

  // ─────────────────────────────────────────────
  // IMPORT → depuis fichier JSON
  // ─────────────────────────────────────────────
  function importJSON(file) {
    return new Promise((resolve, reject) => {
      if (!file || file.type !== 'application/json') {
        reject(new Error('Le fichier doit être au format JSON (.json)'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);

          // Validation minimale
          if (!imported.annees || !imported.etablissement) {
            throw new Error('Format de fichier invalide — structure DGH App attendue');
          }

          // Sauvegarde préventive avant remplacement
          const backup = JSON.stringify(_data);
          localStorage.setItem(STORAGE_KEY + '-backup', backup);

          _data = imported;
          _migrate(_data);
          save();

          resolve({
            etablissement: _data.etablissement.nom || 'Inconnu',
            annees: Object.keys(_data.annees),
            anneeActive: _data.anneeActive
          });
        } catch(err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsText(file);
    });
  }

  // ─────────────────────────────────────────────
  // RESET (garde le backup dans localStorage)
  // ─────────────────────────────────────────────
  function reset() {
    const backup = JSON.stringify(_data);
    localStorage.setItem(STORAGE_KEY + '-backup', backup);
    _data = defaultSchema();
    save();
  }

  // ─────────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────────
  function genId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  function isEmpty() {
    const annee = getAnnee();
    return (
      !_data.etablissement.nom &&
      annee.dotation.enveloppe === 0 &&
      annee.enseignants.length === 0
    );
  }

  // ─────────────────────────────────────────────
  // API publique
  // ─────────────────────────────────────────────
  return {
    init,
    get,
    getEtab,
    getAnnee,
    getAnnees,
    getAnneeActive,
    setEtab,
    setAnneeActive,
    setDotation,
    addAnnee,
    save,
    exportJSON,
    importJSON,
    reset,
    genId,
    isEmpty,
    defaultAnnee   // exposé pour les tests
  };

})();
