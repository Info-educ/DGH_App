/**
 * DGH App — Couche données v1.0
 * SEUL fichier qui touche localStorage
 * RGPD : aucune donnée envoyée vers l'extérieur
 */

const DGHData = (() => {

  const KEY     = 'dgh-app-data';
  const VERSION = '1.0.0';

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
    if (!_data._meta) _data._meta = {};
    _data._meta.version = VERSION;
  }

  // ── GETTERS ──────────────────────────────────────────────────────
  function get()             { return _data; }
  function getEtab()         { return _data.etablissement; }
  function getAnneeActive()  { return _data.anneeActive; }
  function getAnnees()       { return Object.keys(_data.annees).sort().reverse(); }

  function getAnnee(a) {
    const key = a || _data.anneeActive;
    if (!_data.annees[key]) _data.annees[key] = _annee(key);
    return _data.annees[key];
  }

  // ── SETTERS ──────────────────────────────────────────────────────
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

  return { init, get, getEtab, getAnnee, getAnnees, getAnneeActive, setEtab, setAnneeActive, setDotation, save, exportJSON, importJSON, genId, isEmpty };

})();
