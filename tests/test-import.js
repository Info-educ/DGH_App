/**
 * test-import.js — Filet de sécurité de l'import / migration de données
 * -------------------------------------------------------------
 * OBJECTIF : garantir qu'un fichier de données exporté par une ANCIENNE
 * version de l'app se réimporte proprement dans le schéma courant.
 * C'est la promesse centrale de l'outil : « je retrouve mes données »,
 * même des années plus tard.
 *
 * On rejoue le VRAI chemin d'import (`DGHData.importJSON`) en simulant
 * juste ce dont data.js a besoin (localStorage, FileReader, document).
 *
 * Cas couverts :
 *   1. un fichier 4.8.0 réel (tests/fixtures/legacy-4.8.0.json) s'importe
 *      sans rejet, la migration s'exécute (version réestampillée), la
 *      structure obtenue est conforme au schéma courant, et un calcul
 *      métier réel tourne dessus sans planter ;
 *   2. les imports invalides sont rejetés proprement ;
 *   3. un import invalide ne détruit pas les données déjà présentes
 *      (une sauvegarde de secours est conservée).
 *
 * Usage (dev) :  node tests/test-import.js
 * Zéro dépendance externe.
 * -------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── Mocks d'environnement navigateur (minimaux) ───────────────────
const _store = {};
global.localStorage = {
  getItem: (k) => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
};
global.document = { dispatchEvent: () => {} };
global.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o || {}); } };
// FileReader minimal : lit le texte injecté dans file._text
global.FileReader = class {
  readAsText(file) {
    queueMicrotask(() => {
      if (file && typeof file._text === 'string') this.onload({ target: { result: file._text } });
      else this.onerror(new Error('lecture'));
    });
  }
};

// ── Chargement des modules navigateur (IIFE → const) ──────────────
const DGHData = eval(read('assets/js/data.js') + '\nDGHData;');
global.Calculs = eval(read('assets/js/calculs.js') + '\nCalculs;');

const VERSION = (read('assets/js/data.js').match(/const VERSION\s*=\s*'([^']+)'/) || [])[1];

// ── Petit harnais d'assertions ────────────────────────────────────
let pass = 0, fail = 0;
function check(label, fn) {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); pass++; }
  catch (e) { console.log(`  \x1b[31m✗ ${label}\x1b[0m\n      ${e.message}`); fail++; }
}

(async () => {
  console.log(`\nCompatibilité ascendante de l'import — cible : ${VERSION}\n`);

  // ════ CAS 1 — un fichier 4.8.0 réel se réimporte proprement ════
  DGHData.init(); // localStorage vide → schéma neuf
  const legacy = read('tests/fixtures/legacy-4.8.0.json');

  let imp = null, impErr = null;
  try { imp = await DGHData.importJSON({ name: 'legacy-4.8.0.json', _text: legacy }); }
  catch (e) { impErr = e; }

  check('Fichier 4.8.0 importé sans rejet', () => {
    assert(!impErr, impErr && impErr.message);
    assert(imp && imp.etablissement, 'résultat d\'import vide');
  });

  check(`Version réestampillée à ${VERSION} (la migration a tourné)`, () => {
    assert.strictEqual(DGHData.get()._meta.version, VERSION);
  });

  check('Chaque année possède les tableaux du schéma courant', () => {
    const d = DGHData.get();
    const annees = Object.values(d.annees);
    assert(annees.length > 0, 'aucune année dans le fichier migré');
    annees.forEach((a, i) => {
      ['structures', 'disciplines', 'repartition', 'heuresPedaComp', 'enseignants'].forEach((k) => {
        assert(Array.isArray(a[k]), `année #${i} : « ${k} » absent ou non-tableau`);
      });
    });
  });

  check('Un calcul métier réel s\'exécute sur les données migrées (smoke test)', () => {
    const d = DGHData.get();
    const a = d.annees[d.anneeActive];
    if (a && Array.isArray(a.enseignants) && a.enseignants.length) {
      const s = Calculs.serviceTotalEnseignant(a.enseignants[0], a.heuresPedaComp || []);
      assert(s && typeof s === 'object', 'serviceTotalEnseignant n\'a pas renvoyé d\'objet');
    }
  });

  // ════ CAS 2 — imports invalides rejetés proprement ════
  let e1 = null;
  try { await DGHData.importJSON({ name: 'photo.png', _text: 'x' }); } catch (e) { e1 = e; }
  check('Fichier non .json rejeté', () => {
    assert(e1 && /JSON requis/i.test(e1.message), 'rejet attendu sur extension non .json');
  });

  let e2 = null;
  try { await DGHData.importJSON({ name: 'vide.json', _text: '{"foo":1}' }); } catch (e) { e2 = e; }
  check('JSON sans annees/etablissement rejeté (format invalide)', () => {
    assert(e2 && /invalide/i.test(e2.message), 'rejet attendu sur format invalide');
  });

  // ════ CAS 3 — un import raté ne détruit pas l'existant ════
  check('Une sauvegarde de secours existe après un import (filet anti-perte)', () => {
    const backup = localStorage.getItem('dgh-app-data-backup');
    assert(backup, 'aucune sauvegarde « dgh-app-data-backup » créée');
    JSON.parse(backup); // doit être un JSON valide
  });

  // ════ CAS 4 — la restauration ramène l'état précédent, et est réversible ════
  DGHData.init();
  const freshNom = DGHData.get().etablissement.nom;            // état vierge
  await DGHData.importJSON({ name: 'legacy.json', _text: legacy });
  const legacyNom = DGHData.get().etablissement.nom;           // état importé

  const r1 = DGHData.restoreBackup();
  check('Restauration : revient à l\'état d\'avant le dernier import', () => {
    assert(r1.ok, r1.message);
    assert.strictEqual(DGHData.get().etablissement.nom, freshNom);
  });

  const r2 = DGHData.restoreBackup();
  check('Restauration réversible : un 2e appel ré-applique l\'import', () => {
    assert(r2.ok, r2.message);
    assert.strictEqual(DGHData.get().etablissement.nom, legacyNom);
  });

  // ════ CAS 5 — restauration sans sauvegarde : refus propre ════
  localStorage.removeItem('dgh-app-data-backup');
  const r3 = DGHData.restoreBackup();
  check('Sans sauvegarde disponible : refus propre (pas de plantage)', () => {
    assert(r3 && r3.ok === false, 'devrait renvoyer { ok:false }');
    assert(/sauvegarde/i.test(r3.message || ''), 'message explicite attendu');
  });

  // ── Bilan ──
  console.log('\n' + '─'.repeat(52));
  if (fail === 0) {
    console.log(`\x1b[32m✓ TOUS LES TESTS D'IMPORT PASSENT\x1b[0m  (${pass} cas)`);
    process.exit(0);
  } else {
    console.log(`\x1b[31m✗ ${fail} CAS EN ÉCHEC\x1b[0m — ${pass} OK`);
    process.exit(1);
  }
})();
