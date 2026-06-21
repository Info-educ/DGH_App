/**
 * test-service.js — Filet de sécurité du moteur de calcul (hors navigateur)
 * -------------------------------------------------------------
 * Rejoue EXACTEMENT les mêmes contrôles que l'encart « Vérification »
 * du tableau de bord — les cas sont définis une seule fois dans
 * assets/js/verifs.js, jamais dupliqués ici.
 *
 * Usage (pour le développement uniquement) :  node tests/test-service.js
 * Les utilisateurs n'en ont pas besoin : l'encart du tableau de bord
 * affiche les mêmes résultats directement dans l'application.
 * -------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');

// Charge calculs.js (définit `const Calculs = (()=>{...})()` sans l'exporter).
const calculsSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'calculs.js'), 'utf8');
const Calculs = eval(calculsSrc + '\nCalculs;');
global.Calculs = Calculs; // verifs.js référence Calculs globalement

// Charge verifs.js (exporte { Verifs } en CommonJS).
const { Verifs } = require(path.join(__dirname, '..', 'assets', 'js', 'verifs.js'));

const RED = '\x1b[31m', GREEN = '\x1b[32m', GRAY = '\x1b[90m', RESET = '\x1b[0m';
const r = Verifs.lancer();

r.groupes.forEach(g => {
  console.log('\n• ' + g.titre);
  g.lignes.forEach(l => {
    if (l.ok) console.log(`  ${GREEN}✓${RESET} ${l.label} ${GRAY}= ${l.obtenu}${RESET}`);
    else      console.log(`  ${RED}✗ ${l.label} : attendu ${l.attendu}, obtenu ${l.obtenu}${RESET}`);
  });
});

console.log('\n' + '─'.repeat(50));
if (r.ok) {
  console.log(`${GREEN}✓ TOUS LES TESTS PASSENT${RESET}  (${r.total} vérifications)`);
  process.exit(0);
} else {
  console.log(`${RED}✗ ${r.echoues} VÉRIFICATION(S) EN ÉCHEC${RESET} — ${r.reussis} OK`);
  process.exit(1);
}
