/**
 * DGH App — Garde-fou de synchronisation des versions
 * -------------------------------------------------------------
 * Vérifie que TOUS les marqueurs de version du dépôt valent la même
 * chose. La source de vérité est `const VERSION` dans assets/js/data.js.
 *
 * Marqueurs contrôlés (cf. checklist SKILL.md) :
 *   1. assets/js/data.js      → const VERSION          (source de vérité)
 *   2. index.html             → footer <span>vX.Y.Z</span>
 *   3. index.html             → chaque suffixe ?v=X.Y.Z (cache-bust global)
 *   4. data/exemple.json      → _meta.version
 *   5. README.md              → titre + badge
 *   6. CHANGELOG.md           → dernière entrée ## vX.Y.Z
 *   7. SKILL.md               → ligne « Version courante : **X.Y.Z** »
 *   8. SKILL.md               → ligne de pied de page « *Version : X.Y.Z …* »
 *
 * Usage :
 *   node tests/check-version.js
 * Sortie :
 *   exit 0 si tout concorde ; exit 1 (+ rapport) sinon.
 *
 * Zéro dépendance externe — uniquement `fs` et `path`.
 * -------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── 1. Source de vérité ────────────────────────────────────────────
const dataJs = read('assets/js/data.js');
const refMatch = dataJs.match(/const VERSION\s*=\s*'([0-9]+\.[0-9]+\.[0-9]+)'/);
if (!refMatch) {
  console.error('✗ Impossible de lire `const VERSION` dans assets/js/data.js — source de vérité introuvable.');
  process.exit(1);
}
const REF = refMatch[1];

// ── 2. Collecte des marqueurs ──────────────────────────────────────
// Chaque entrée : { nom, valeurs:[...] }. Une valeur peut être null (= absent).
const html = read('index.html');
const readme = read('README.md');
const changelog = read('CHANGELOG.md');
const skill = read('SKILL.md');
const exemple = read('data/exemple.json');

const first = (re, txt) => { const m = txt.match(re); return m ? m[1] : null; };
const all = (re, txt) => { const out = []; let m; while ((m = re.exec(txt)) !== null) out.push(m[1]); return out; };

const checks = [
  { nom: 'index.html — footer',        valeurs: [ first(/<span>v([0-9]+\.[0-9]+\.[0-9]+)<\/span>/, html) ] },
  { nom: 'index.html — suffixes ?v=',  valeurs: all(/\?v=([0-9]+\.[0-9]+\.[0-9]+)/g, html) },
  { nom: 'exemple.json — _meta',       valeurs: [ first(/"version":\s*"([0-9]+\.[0-9]+\.[0-9]+)"/, exemple) ] },
  { nom: 'README.md — titre',          valeurs: [ first(/^#\s.*DGH App\s+—\s+v([0-9]+\.[0-9]+\.[0-9]+)/m, readme) ] },
  { nom: 'README.md — badge',          valeurs: [ first(/badge\/version-([0-9]+\.[0-9]+\.[0-9]+)-/, readme) ] },
  { nom: 'CHANGELOG.md — dernière',    valeurs: [ first(/^##\s+v([0-9]+\.[0-9]+\.[0-9]+)/m, changelog) ] },
  { nom: 'SKILL.md — version courante',valeurs: [ first(/Version courante\s*:\s*\*\*([0-9]+\.[0-9]+\.[0-9]+)\*\*/, skill) ] },
  { nom: 'SKILL.md — pied de page',    valeurs: [ first(/\*Version\s*:\s*([0-9]+\.[0-9]+\.[0-9]+)\s/, skill) ] },
];

// ── 3. Comparaison ─────────────────────────────────────────────────
let echecs = 0;
const lignes = [];

for (const c of checks) {
  const uniques = [...new Set(c.valeurs)];
  const absent = c.valeurs.length === 0 || c.valeurs.some(v => v === null);
  const concorde = !absent && uniques.length === 1 && uniques[0] === REF;
  if (!concorde) echecs++;

  let detail;
  if (absent) detail = 'introuvable';
  else if (uniques.length > 1) detail = `valeurs multiples : ${uniques.join(', ')}`;
  else detail = uniques[0];

  lignes.push(`  ${concorde ? 'OK ' : '✗  '} ${c.nom.padEnd(34)} ${detail}`);
}

// ── 4. Rapport ─────────────────────────────────────────────────────
console.log(`\nSource de vérité (data.js) : ${REF}\n`);
console.log(lignes.join('\n'));

if (echecs === 0) {
  console.log(`\n✓ Les ${checks.length} groupes de marqueurs concordent sur ${REF}.\n`);
  process.exit(0);
} else {
  console.error(`\n✗ ${echecs} marqueur(s) désynchronisé(s) — attendu : ${REF}.`);
  console.error('  Corriger AVANT toute livraison (cf. checklist version dans SKILL.md).\n');
  process.exit(1);
}
