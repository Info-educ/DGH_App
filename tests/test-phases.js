/**
 * test-phases.js — Vérifie Calculs.phaseStatuts (avancement par phase)
 * -------------------------------------------------------------
 * Fonction pure : on lui passe des « années » fabriquées et on contrôle
 * l'état déduit pour chaque phase, selon les règles validées avec le PERDIR :
 *
 *   Phase 1 (Construire) : afaire si rien ; termine si structures + enveloppe
 *                          DGH + ≥1 enseignant ; encours sinon.
 *   Phase 2 (Présenter)  : afaire si phase 1 pas commencée ; termine si l'année
 *                          est figée (snapshot) ; encours sinon.
 *   Phase 3 (Répartir)   : afaire si aucune affectation ; termine si tous les
 *                          enseignants ont ≥1 affectation ; encours sinon.
 *   Phase 4 (EDT)        : afaire si aucune contrainte ; termine si barrettes
 *                          ET indisponibilités ; encours sinon.
 *
 * Usage : node tests/test-phases.js     (zéro dépendance externe)
 * -------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const Calculs = eval(fs.readFileSync(path.join(ROOT, 'assets/js/calculs.js'), 'utf8') + '\nCalculs;');

let pass = 0, fail = 0;
function check(label, fn) {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); pass++; }
  catch (e) { console.log(`  \x1b[31m✗ ${label}\x1b[0m\n      ${e.message}`); fail++; }
}

// Fabriques minimales
const env  = { hPosteEnveloppe: 600, hsaEnveloppe: 40 };
const struct1 = [{ id: 'd1' }];
const ens2 = [{ id: 'e1' }, { id: 'e2' }];

console.log('\nAvancement par phase — Calculs.phaseStatuts\n');

// ── Phase 1 ──
check('Année vide → phase 1 « à faire »', () => {
  assert.strictEqual(Calculs.phaseStatuts({})[1], 'afaire');
});
check('Structures seules → phase 1 « en cours »', () => {
  assert.strictEqual(Calculs.phaseStatuts({ structures: struct1 })[1], 'encours');
});
check('Structures + enveloppe + enseignants → phase 1 « terminé »', () => {
  const st = Calculs.phaseStatuts({ structures: struct1, dotation: env, enseignants: ens2 });
  assert.strictEqual(st[1], 'termine');
});

// ── Phase 2 ──
check('Phase 1 pas commencée → phase 2 « à faire »', () => {
  assert.strictEqual(Calculs.phaseStatuts({})[2], 'afaire');
});
check('Phase 1 commencée, pas de snapshot → phase 2 « en cours »', () => {
  assert.strictEqual(Calculs.phaseStatuts({ structures: struct1 })[2], 'encours');
});
check('Année figée (snapshot) → phase 2 « terminé »', () => {
  const st = Calculs.phaseStatuts({ structures: struct1, snapshot: { figeLe: 'x' } });
  assert.strictEqual(st[2], 'termine');
});

// ── Phase 3 ──
check('Aucune affectation → phase 3 « à faire »', () => {
  assert.strictEqual(Calculs.phaseStatuts({ enseignants: ens2 })[3], 'afaire');
});
check('Affectation partielle → phase 3 « en cours »', () => {
  const st = Calculs.phaseStatuts({ enseignants: ens2, affectations: [{ ensId: 'e1' }] });
  assert.strictEqual(st[3], 'encours');
});
check('Tous les enseignants affectés → phase 3 « terminé »', () => {
  const st = Calculs.phaseStatuts({ enseignants: ens2, affectations: [{ ensId: 'e1' }, { ensId: 'e2' }] });
  assert.strictEqual(st[3], 'termine');
});

// ── Phase 4 ──
check('Aucune contrainte EDT → phase 4 « à faire »', () => {
  assert.strictEqual(Calculs.phaseStatuts({})[4], 'afaire');
});
check('Barrettes seules → phase 4 « en cours »', () => {
  const st = Calculs.phaseStatuts({ contraintesEDT: { barrettes: [{ id: 'b1' }] } });
  assert.strictEqual(st[4], 'encours');
});
check('Barrettes + indisponibilités → phase 4 « terminé »', () => {
  const st = Calculs.phaseStatuts({ contraintesEDT: { barrettes: [{ id: 'b1' }], indisponibilites: [{ id: 'i1' }] } });
  assert.strictEqual(st[4], 'termine');
});

console.log('\n' + '─'.repeat(52));
if (fail === 0) { console.log(`\x1b[32m✓ TOUS LES TESTS DE PHASES PASSENT\x1b[0m  (${pass} cas)`); process.exit(0); }
else { console.log(`\x1b[31m✗ ${fail} CAS EN ÉCHEC\x1b[0m — ${pass} OK`); process.exit(1); }
