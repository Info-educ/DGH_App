/**
 * DGH App — Couche données v1.2.0
 * SEUL fichier qui touche localStorage
 * RGPD : aucune donnée envoyée vers l'extérieur
 *
 * v1.2.0 — Corrections structures : CRUD structures de classes
 */

const DGHData = (() => {

  const KEY     = 'dgh-app-data';
  const VERSION = '1.2.0';

  // ── NIVEAUX VALIDES ───────────────────────────────────────────────
  const NIVEAUX = ['6e', '5e', '4e', '3e', 'SEGPA', 'ULIS', 'UPE2A'];

  // ── SCHÉMA ───────────────────────────────────────────────────────
  function _schema() {
    return {
      _meta: { version: VERSION, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      etablissement: { nom: '', uai: '', academie: '', commune: '' },
      annees: { '2025-2026': _annee('2025-2026') },
      anneeActive: '2025-2026'
    };
  }

  function _annee(annee) {
    return {
      annee,
      createdAt: new Date().toISOString(),
      dotation: { enveloppe: 0, commentaire: '' },
      structures: [],
      grilles: {},
      disciplines: [],
      repartition: [],
      enseignants: [],
      simulation: { active: false, nom: '', dotation: null, repartition: [], enseignants: [] },
      alertes: []
    };
  }

  // ── ÉTAT ─────────────────────────────────────────────────────────
  let _data = null;

  // ── INIT ─────────────────────────────────────────────────────────
  function init() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        _data = JSON.parse(raw);
        _migrate();
      } catch(e) {
        _data = _schema();
        save();
      }
    } else {
      _data = _schema();
      save();
    }
  }

  function _migrate() {
    // v1.0.0 → v1.1.0 : garantir la cohérence du tableau structures
    if (!_data._meta) _data._meta = {};
    if (_data.annees) {
      Object.values(_data.annees).forEach(ann => {
        if (!Array.isArray(ann.structures)) ann.structures = [];
        ann.structures.forEach(div => {
          if (!Array.isArray(div.options))      div.options    = [];
          if (div.dispositif === undefined)     div.dispositif = null;
          if (typeof div.effectif !== 'number') div.effectif   = 0;
        });
      });
    }
    _data._meta.version = VERSION;
  }

  // ── GETTERS GÉNÉRAUX ─────────────────────────────────────────────
  function get()             { return _data; }
  function getEtab()         { return _data.etablissement; }
  function getAnneeActive()  { return _data.anneeActive; }
  function getAnnees()       { return Object.keys(_data.annees).sort().reverse(); }
  function getNiveaux()      { return NIVEAUX; }

  function getAnnee(a) {
    const key = a || _data.anneeActive;
    if (!_data.annees[key]) _data.annees[key] = _annee(key);
    return _data.annees[key];
  }

  // ── GETTERS STRUCTURES ───────────────────────────────────────────
  /** Retourne toutes les divisions triées par niveau puis nom */
  function getStructures(annee) {
    return (getAnnee(annee).structures || []).slice().sort(_sortDiv);
  }

  /** Retourne une division par son id */
  function getDivision(id, annee) {
    return (getAnnee(annee).structures || []).find(d => d.id === id) || null;
  }

  function _sortDiv(a, b) {
    const ORDER = { '6e':0,'5e':1,'4e':2,'3e':3,'SEGPA':4,'ULIS':5,'UPE2A':6 };
    const na = ORDER[a.niveau] ?? 99;
    const nb = ORDER[b.niveau] ?? 99;
    if (na !== nb) return na - nb;
    return (a.nom || '').localeCompare(b.nom || '', 'fr');
  }

  // ── SETTERS GÉNÉRAUX ─────────────────────────────────────────────
  function setEtab(fields) { Object.assign(_data.etablissement, fields); save(); }

  function setAnneeActive(a) {
    if (!_data.annees[a]) _data.annees[a] = _annee(a);
    _data.anneeActive = a;
    save();
  }

  function setDotation(enveloppe, commentaire) {
    const ann = getAnnee();
    ann.dotation.enveloppe   = parseFloat(enveloppe) || 0;
    ann.dotation.commentaire = commentaire || '';
    save();
  }

  // ── CRUD STRUCTURES ──────────────────────────────────────────────
  /**
   * Ajoute une division.
   * @param {{ niveau, nom, effectif, options, dispositif }} fields
   * @returns {object} La division créée
   */
  function addDivision(fields) {
    const ann = getAnnee();
    const div = {
      id:         genId('div'),
      niveau:     fields.niveau      || '6e',
      nom:        (fields.nom        || '').trim(),
      effectif:   parseInt(fields.effectif, 10) || 0,
      options:    Array.isArray(fields.options) ? fields.options.slice() : [],
      dispositif: fields.dispositif  || null
    };
    ann.structures.push(div);
    save();
    return div;
  }

  /**
   * Met à jour une division existante.
   * @param {string} id
   * @param {object} fields
   * @returns {boolean}
   */
  function updateDivision(id, fields) {
    const ann = getAnnee();
    const idx = ann.structures.findIndex(d => d.id === id);
    if (idx === -1) return false;
    const div = ann.structures[idx];
    if (fields.niveau     !== undefined) div.niveau     = fields.niveau;
    if (fields.nom        !== undefined) div.nom        = (fields.nom || '').trim();
    if (fields.effectif   !== undefined) div.effectif   = parseInt(fields.effectif, 10) || 0;
    if (fields.options    !== undefined) div.options    = Array.isArray(fields.options) ? fields.options.slice() : [];
    if (fields.dispositif !== undefined) div.dispositif = fields.dispositif || null;
    save();
    return true;
  }

  /**
   * Supprime une division.
   * @param {string} id
   * @returns {boolean}
   */
  function deleteDivision(id) {
    const ann = getAnnee();
    const before = ann.structures.length;
    ann.structures = ann.structures.filter(d => d.id !== id);
    if (ann.structures.length < before) { save(); return true; }
    return false;
  }

  // ── RESET ANNÉE ──────────────────────────────────────────────────
  /**
   * Réinitialise toutes les données d'une année (structures, dotation,
   * enseignants, etc.) tout en conservant l'année dans la liste.
   * @param {string} [annee] — année cible, défaut = année active
   */
  function resetAnnee(annee) {
    const key = annee || _data.anneeActive;
    _data.annees[key] = _annee(key);
    save();
  }

  // ── DUPLICATION DE DIVISIONS ──────────────────────────────────────
  /**
   * Duplique une division existante N fois en incrémentant son suffixe.
   * Exemples : 6eA → 6eB, 6eC …  |  6e1 → 6e2, 6e3 …
   * Les copies héritent du même niveau, effectif et options.
   * @param {string} id    — id de la division source
   * @param {number} count — nombre de copies à créer
   * @returns {object[]}   — tableau des divisions créées
   */
  function duplicateDivisions(id, count) {
    const source = getDivision(id);
    if (!source || count < 1) return [];
    const created = [];
    let currentNom = source.nom;
    for (let i = 0; i < count; i++) {
      const nextNom = _nextDivName(currentNom);
      const div = addDivision({
        niveau:     source.niveau,
        nom:        nextNom,
        effectif:   source.effectif,
        options:    source.options.slice(),
        dispositif: source.dispositif
      });
      created.push(div);
      currentNom = nextNom;
    }
    return created;
  }

  /**
   * Calcule le prochain nom de division par incrément du suffixe.
   * Lettre finale : A→B, Z→AA. Chiffre final : 1→2, 9→10.
   * @param {string} nom
   * @returns {string}
   */
  function _nextDivName(nom) {
    if (!nom) return nom;
    // Suffixe chiffre(s)
    const numMatch = nom.match(/^(.*?)(\d+)$/);
    if (numMatch) {
      const prefix = numMatch[1];
      const n      = parseInt(numMatch[2], 10) + 1;
      // Conserver le padding éventuel (01→02)
      const padded = numMatch[2].length > 1 ? String(n).padStart(numMatch[2].length, '0') : String(n);
      return prefix + padded;
    }
    // Suffixe lettre(s) majuscule(s)
    const letMatch = nom.match(/^(.*?)([A-Z]+)$/);
    if (letMatch) {
      return letMatch[1] + _nextLetters(letMatch[2]);
    }
    // Suffixe lettre(s) minuscule(s)
    const letLow = nom.match(/^(.*?)([a-z]+)$/);
    if (letLow) {
      return letLow[1] + _nextLetters(letLow[2].toUpperCase()).toLowerCase();
    }
    // Pas de suffixe reconnu : ajouter "2"
    return nom + '2';
  }

  /** Incrémente une chaîne alphabétique : A→B, Z→AA, AZ→BA */
  function _nextLetters(s) {
    const chars = s.split('');
    let i = chars.length - 1;
    while (i >= 0) {
      const code = chars[i].charCodeAt(0);
      if (code < 90) { chars[i] = String.fromCharCode(code + 1); return chars.join(''); }
      chars[i] = 'A';
      i--;
    }
    return 'A' + chars.join('');
  }

  // ── SAVE ─────────────────────────────────────────────────────────
  function save() {
    if (!_data) return;
    _data._meta.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(_data));
    } catch(e) {
      document.dispatchEvent(new CustomEvent('dgh:storage-error', { detail: e }));
    }
  }

  // ── EXPORT ───────────────────────────────────────────────────────
  function exportJSON() {
    const blob = new Blob([JSON.stringify(_data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    const nom  = (_data.etablissement.nom || 'dgh').replace(/\s+/g, '_').toLowerCase();
    a.href     = url;
    a.download = nom + '_' + _data.anneeActive + '_' + date + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return a.download;
  }

  // ── IMPORT ───────────────────────────────────────────────────────
  function importJSON(file) {
    return new Promise((resolve, reject) => {
      if (!file || file.type !== 'application/json') {
        return reject(new Error('Fichier JSON requis (.json)'));
      }
      const r = new FileReader();
      r.onload = e => {
        try {
          const d = JSON.parse(e.target.result);
          if (!d.annees || !d.etablissement) throw new Error('Format invalide');
          localStorage.setItem(KEY + '-backup', JSON.stringify(_data));
          _data = d;
          _migrate();
          save();
          resolve({ etablissement: _data.etablissement.nom || '?', annees: Object.keys(_data.annees) });
        } catch(err) { reject(err); }
      };
      r.onerror = () => reject(new Error('Erreur de lecture'));
      r.readAsText(file);
    });
  }

  // ── UTIL ─────────────────────────────────────────────────────────
  function genId(prefix) { return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2,6); }

  function isEmpty() {
    const ann = getAnnee();
    return !_data.etablissement.nom && ann.dotation.enveloppe === 0 && ann.enseignants.length === 0;
  }

  return {
    init, get, getEtab, getAnnee, getAnnees, getAnneeActive, getNiveaux,
    getStructures, getDivision,
    setEtab, setAnneeActive, setDotation,
    addDivision, updateDivision, deleteDivision, resetAnnee, duplicateDivisions,
    save, exportJSON, importJSON, genId, isEmpty
  };

})();
