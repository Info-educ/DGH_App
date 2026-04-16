# SKILL.md — Instructions de développement DGH App

> **À fournir à Claude au début de chaque session de développement.**  
> Ce fichier garantit la cohérence du code sur plusieurs années d'évolution du projet.  
> Mis à jour à chaque sprint. Version courante : **3.1.6**

---

## Contexte du projet

**DGH App** est une SPA (Single Page Application) de pilotage de la Dotation Globale Horaire pour collège.

- **Stack** : HTML5 + CSS3 + JS Vanilla — zéro framework, zéro build, zéro dépendance externe
- **Hébergement** : GitHub Pages ou fichier local (ouvrir `index.html` directement)
- **Données** : `localStorage` + export/import JSON local — **aucun serveur, 100% RGPD**
- **Utilisateurs** : équipe de direction (principal + principal adjoint)
- **Objectif de maintenabilité** : plusieurs années sans refactorisation majeure

---

## ⚠️ RÈGLES DE QUALITÉ — NON NÉGOCIABLES

### 1. Lire avant d'écrire
Avant toute modification, **lire le fichier entier** avec le `view` tool.  
Ne jamais modifier sur la base d'un contexte partiel ou supposé.

### 2. Zéro code zombie
Après chaque modification, vérifier qu'aucun résidu ne subsiste :
- Aucun `id` HTML référencé dans le JS mais absent du HTML
- Aucune variable déclarée deux fois dans le même scope
- Aucun bloc CSS en doublon
- Vérifier `node --check` sur les 3 fichiers JS après chaque changement

### 3. Zéro onclick inline — UNE SEULE délégation globale

**Règle permanente anti-boutons-muets :**
- **JAMAIS** de `addEventListener` direct sur un bouton dont le rendu est conditionnel ou tardif
- **TOUJOURS** passer par `_onGlobalClick` dans `app.js`
- `_bindEvents()` ne lie en direct **que** les éléments garantis dans le DOM au chargement

```js
// ✅ Correct — dans _onGlobalClick
if (e.target.closest('#btnAddDiv')) { _openModalDiv(null); return; }

// ❌ Interdit — dans _bindEvents ou ailleurs
document.getElementById('btnAddDiv').addEventListener('click', () => _openModalDiv(null));
```

Les boutons dans les tableaux générés dynamiquement utilisent `data-action` :
```html
<button data-action="edit-div" data-id="div_123">✎</button>
<button data-action="toggle-hpc-type" data-id="hpc_456">HP</button>
```

### 4. Un fichier = une responsabilité stricte

| Fichier | Responsabilité | Interdit |
|---------|---------------|---------|
| `data.js` | SEUL fichier qui touche `localStorage` | DOM, calculs métier |
| `calculs.js` | Fonctions pures uniquement | DOM, `localStorage`, `DGHData.save()` |
| `app.js` | Contrôleur UI | `localStorage` direct, calculs métier |
| `style.css` | SEUL endroit pour les styles | `<style>` injectés en JS |

### 5. Encodage — CRITIQUE
Les fichiers JS contiennent des caractères Unicode (accents, symboles).  
**Toujours manipuler en binaire** (`'rb'`/`'wb'`) en Python pour éviter les corruptions.  
Ne jamais utiliser les bytes literals Python pour du texte non-ASCII — passer par `.encode('utf-8')`.

```python
# ✅ Correct
with open('assets/js/app.js', 'rb') as f: content = f.read()
new = "mon texte avec accents".encode('utf-8')
content = content.replace(old, new)

# ❌ Risqué
content = open('assets/js/app.js', encoding='utf-8').read()
# Les replace() peuvent échouer silencieusement sur des chaînes multi-octets
```

### 6. HTML tableau — ordre des balises
Dans un `<table>`, l'ordre est obligatoire : `<thead>` → `<tbody>` → `<tfoot>`.  
Construire le HTML ainsi : `html_tbody + '</tbody>' + tfoot + '</table>'`  
**Jamais** : `html + tfoot + '</tbody></table>'` (invalide — tfoot dans tbody).

### 7. Tooltips et z-index — architecture fixe
Les tooltips sont des `<div>` en `position: fixed; z-index: 99999` dans le `<body>`.  
Ils sont gérés par JS (mouseenter/mouseleave) pour échapper aux stacking contexts.  
**Ne jamais** utiliser `position: absolute` pour un tooltip dans un conteneur avec `overflow: hidden` ou `transform`.

IDs réservés : `#kpiFloatTip` (KPI dashboard), `#discFloatTip` (disciplines dashboard).

### 8. Vérifications avant livraison
```bash
node --check assets/js/app.js
node --check assets/js/data.js
node --check assets/js/calculs.js
grep -n "onclick" index.html          # doit retourner vide
grep -n "localStorage" assets/js/app.js | grep -v "dgh-theme"  # doit retourner vide
grep -n "localStorage" assets/js/calculs.js  # doit retourner vide
```

---

## Architecture des fichiers

```
index.html              → SPA — toutes les vues dans des <section class="view">
assets/css/style.css    → Design system (variables CSS light/dark + tous les composants)
assets/js/data.js       → Couche données (localStorage, schéma, migrations, CRUD)
assets/js/calculs.js    → Moteur de calcul pur (ORS, DGH, besoins MEN, suggestions)
assets/js/app.js        → Contrôleur UI (navigation, rendu vues, délégation événements)
data/exemple.json       → Données fictives anonymisées (schéma v3.1)
SKILL.md                → Ce fichier
CHANGELOG.md            → Historique des versions
README.md               → Documentation utilisateur
```

---

## Modèle de données — Schéma v3.1

```js
// Racine
{
  _meta: { version: '3.1.0', createdAt, updatedAt },
  etablissement: { nom, uai, academie, commune },
  annees: { '2025-2026': AnneeObject },
  anneeActive: '2025-2026'
}

// AnneeObject
{
  annee: '2025-2026',
  dotation: {
    hPosteEnveloppe: Number,  // HP reçues de la DSDEN
    hsaEnveloppe:    Number,  // HSA autorisées
    commentaire:     String
  },
  structures:     [DivisionObject],
  disciplines:    [DisciplineObject],
  repartition:    [RepartitionObject],
  heuresPedaComp: [HPCObject],
  grilles:        Object,   // overrides grille MEN : { [discNom]: { '6e': h, '5e': h, ... } }
  enseignants:    [],       // Sprint 6
  alertes:        []
}

// DivisionObject
{ id, niveau: '6e'|'5e'|'4e'|'3e'|'SEGPA'|'ULIS'|'UPE2A', nom, effectif, dispositif }

// DisciplineObject
{ id, nom, couleur }

// RepartitionObject
{
  disciplineId, hPoste, hsa, commentaire,
  groupesCours: [GroupeCoursObject]
}

// GroupeCoursObject
{
  id, nom,
  classesIds: [divisionId],   // sélection par classes (pas par niveau)
  heures,                     // heures prof / semaine
  commentaire
  // effectif calculé dynamiquement = somme effectifs des classes sélectionnées
  // besoin réel = heures × nb_classes (pas nb_élèves)
}

// HPCObject — Heures Pédagogiques Complémentaires
{
  id, nom,
  categorie: 'option'|'labo'|'dispositif'|'vie-classe'|'arts'|'sport'|'accompagnement'|'autre',
  disciplineId,               // null si hors discipline
  classesIds: [divisionId],
  typeHeure: 'hp'|'hsa',      // v3.1 — HP par défaut
  heures, effectif, commentaire
}

// grilles (overrides utilisateur)
// { 'Français': { '6e': 4, '5e': 4.5 }, 'LV2': { '6e': 0 } }
// Si une clé est absente, on utilise GRILLES_MEN de calculs.js
```

### Règle de migration
Toute modification du schéma implique :
1. Ajouter le champ dans `_annee()` dans `data.js`
2. Ajouter la migration dans `_migrate()` avec vérification `=== undefined`
3. Incrémenter `VERSION` dans `data.js`
4. Mettre à jour `data/exemple.json`

---

## Concepts métier — À connaître absolument

### HP vs HSA — distinction fondamentale
- **H-Poste** : constituent les postes d'enseignants. Décidées par la DSDEN.
- **HSA** : heures supplémentaires payées. Budget CA. Ne constituent pas de postes.
- Les HPC ont aussi un type HP/HSA (champ `typeHeure`), pris en compte dans `bilanDotation`.

### Besoin réel — logique de priorité
1. Si la discipline a des **groupes de cours** → besoin = `sum(gc.heures × gc.classesIds.length)`
2. Sinon → besoin = `sum sur niveaux de (grille[discNom][niv] × nbDivisions[niv])`
3. La grille utilisée est `annee.grilles[discNom][niv]` si défini, sinon `GRILLES_MEN[niv][discNom]`

### Groupes de cours — coût DGH réel
Un groupe coûte **heures × nb_classes** (pas nb_élèves).  
Ex : LV2 Espagnol 2,5h × 16 classes = 40h prof · LV2 Allemand 2,5h × 3 classes = 7,5h prof.  
Une classe peut être dans plusieurs groupes simultanément (5eC → Espagnol ET Allemand).  
L'impact exact par créneau sera géré en Sprint 7 (module Pilotage pédagogique).

### TRM (Tableau de Répartition des Moyens)
Document DSDEN. **Sprint 6** : import TRM → pré-remplissage HP/HSA dans Dotation.

---

## Design System

### Variables CSS (ne jamais hardcoder de couleurs)
```css
--c-bg, --c-surface, --c-surface2, --c-surface3
--c-border, --c-border2
--c-text, --c-text-muted, --c-text-dim
--c-accent, --c-accent-hover, --c-accent-light   /* vert sauge — HP */
--c-green, --c-green-bg
--c-amber, --c-amber-bg
--c-red, --c-red-bg
--c-blue, --c-blue-bg
--c-indigo, --c-indigo-bg                        /* HSA */
--c-sb-bg, --c-sb-text, --c-sb-muted, --c-sb-border, --c-sb-hover, --c-sb-active, --c-sb-active-t
```

### Typographie
- **UI** : `font-family: 'Outfit', sans-serif`
- **Données chiffrées** : `font-family: 'JetBrains Mono', monospace`
- Polices via `@import` dans `style.css` uniquement

### Composants réutilisables clés
```
.kpi-card[data-color="blue|green|amber|red|indigo|teal"]
  → pas de overflow:hidden (tooltips flottants)
  → kpi-card:hover a z-index:100 pour passer au-dessus des éléments suivants
.kpi-tooltip-card  → source de données pour #kpiFloatTip (JS géré)
.disc-tip-wrap     → source de données pour #discFloatTip (JS géré)
.section-card      → overflow:visible (jamais hidden — couperait les tableaux)
  → les tableaux enfants ont leur propre overflow clip via #dot-list, #struct-list, #hpc-list
.dot-table.dot-table-grille  → tableau dotation avec colonnes niveaux dynamiques
.col-grille        → colonne niveau dans dot-table (input + total en dessous)
.grille-input      → input h/div MEN éditable (amber si modifié)
.grille-input-modifie → override utilisateur signalé visuellement
.grille-col-total  → sous-total en petit sous l'input (h × nb_div)
.dot-tfoot .dot-total-row  → ligne totaux en bas du tableau dotation
.hpc-type-toggle   → badge HP/HSA cliquable dans tableau HPC
.div-tag-struct    → badge bleu dans colonne dispositif Structures (noms groupes/HPC)
#kpiFloatTip       → tooltip KPI fixe (z-index:99999, géré par JS)
#discFloatTip      → tooltip disciplines dashboard fixe (z-index:99999, géré par JS)
app.toast(msg, 'success|error|info|warning', duration?)
```

---

## Moteur de calcul — API publique de calculs.js

```js
// Constantes
Calculs.ORS          // { certifie: { label, ors }, ... }
Calculs.GRILLES_MEN  // { '6e': { 'Français': 4.5, ... }, ... }
Calculs.H_THEORIQUES_NIV  // { '6e': 26, '5e': 26, '4e': 26, '3e': 26.5 }

// Calculs principaux
Calculs.bilanDotation(anneeData)
  // Intègre HP/HSA des disciplines ET des HPC (typeHeure)
  → { enveloppe, hPosteEnv, hsaEnv, totalHP, totalHSA, totalAlloue, solde,
      pctConsomme, nbDisciplines, depassement,
      totalHPDisc, totalHSADisc, totalHPHPC, totalHSAHPC }

Calculs.resumeStructures(structures)
  → { nbDivisions, effectifTotal, parNiveau[...], niveauxPresents, hTheoriqueTotal }

Calculs.besoinsParDiscipline(structures, disciplines, repartition, grilles)
  // grilles = annee.grilles (overrides utilisateur)
  → [{ disciplineId, nom, couleur,
       besoinTheorique,    // = heuresGroupesReel si GC, sinon besoin MEN avec overrides
       besoinMEN,          // besoin MEN pur (sans overrides ni groupes)
       hPoste, hsa, total,
       heuresGroupes,      // somme brute des heures des GC
       heuresGroupesReel,  // somme (heures × nb_classes) des GC
       hasGroupes,         // boolean
       ecart,              // total - besoinTheorique
       commentaire, groupesCours,
       grilleLignes        // { '6e': { men, valeur, modifie }, ... }
     }]

Calculs.suggererRepartition(anneeData)
  → [{ disciplineId, nom, suggested }]

Calculs.bilanHPC(heuresPedaComp, disciplines)
  → { totalHeures, nbHeures, parCategorie, parDiscipline }

Calculs.genererAlertes(anneeData)
  → [{ type, severite: 'error'|'warning'|'info', message, ref }]
```

---

## API publique de data.js

```js
DGHData.init()
DGHData.get() / getEtab() / getAnneeActive() / getAnnees() / getAnnee(annee?)
DGHData.getNiveaux() / getCategoriesHPC() / getDisciplinesMEN()

// Structures
DGHData.getStructures(annee?) / getDivision(id, annee?)
DGHData.addDivision(fields) / updateDivision(id, fields) / deleteDivision(id)
DGHData.duplicateDivisions(id, count) / appliquerMatrice(matrice, remplacer)

// Disciplines & répartition
DGHData.getDisciplines(annee?) / getDiscipline(id, annee?)
DGHData.getRepartition(annee?)
DGHData.addDiscipline(fields) / updateDiscipline(id, fields) / deleteDiscipline(id)
DGHData.setRepartition(disciplineId, fields)  // { hPoste?, hsa?, commentaire? }
DGHData.initDisciplinesMEN()  → nb ajoutées

// Groupes de cours
DGHData.getGroupeCours(disciplineId, gcId, annee?)
DGHData.addGroupeCours(disciplineId, fields) / updateGroupeCours(...) / deleteGroupeCours(...)

// HPC
DGHData.getHeuresPedaComp(annee?) / getHPC(id, annee?)
DGHData.addHPC(fields) / updateHPC(id, fields) / deleteHPC(id)

// Grilles horaires (overrides MEN par discipline/niveau)
DGHData.getGrilles(annee?)  → { [discNom]: { '6e': h, ... } }
DGHData.setGrille(discNom, niveau, heures)
  // heures=null → supprime l'override (retour MEN)
  // Double-clic sur input → setGrille(discNom, niv, null)

// Setters globaux
DGHData.setEtab(fields) / setAnneeActive(annee) / setDotation(hp, hsa, commentaire?)
DGHData.resetAnnee(annee?) / deleteAnnee(annee) → { ok, message? }

// Persistance
DGHData.save() / exportJSON() → filename / importJSON(file) → Promise
DGHData.genId(prefix) / isEmpty()
```

---

## Ajouter un nouveau module (checklist)

1. **`data.js`** : ajouter champ dans `_annee()` + migration dans `_migrate()` + incrémenter `VERSION`
2. **`index.html`** : `<section class="view" id="view-monmodule">` + nav item dans sidebar
3. **`app.js`** :
   - Entrée dans `VIEWS`
   - `if (viewId === 'monmodule') _renderMonmodule()` dans `navigate()`
   - Fonction `_renderMonmodule()` dans la section appropriée
   - Tous les boutons dans `_onGlobalClick` (jamais de listener direct)
4. **`style.css`** : uniquement via variables CSS existantes
5. **`calculs.js`** : fonctions pures nécessaires
6. Mettre à jour `SKILL.md`, `README.md`, `CHANGELOG.md`

---

## Pièges connus — à éviter absolument

### Pièges d'encodage
- Manipuler `app.js` en Python : toujours en mode binaire `rb`/`wb`
- Les strings de remplacement contenant des accents → `.encode('utf-8')`
- Utiliser un fichier script externe (`/tmp/patch.py`) plutôt que le heredoc inline

### Pièges HTML tableau
- `<tfoot>` doit être **après** `</tbody>` : `html + '</tbody>' + tfoot + '</table>'`
- Le `colspan` des sous-lignes doit correspondre au nombre réel de colonnes (variable `nbCols`)

### Pièges CSS stacking context
- `transform` sur `:hover` crée un stacking context → les tooltips absolute en sont prisonniers
- `overflow: hidden` sur un conteneur coupe les enfants absolute/fixed
- Solution : tooltips `position: fixed` dans le `<body>`, gérés par JS

### Pièges listeners dynamiques
- Les `addEventListener` dans `_renderDotation` (inputs HP/HSA, grille) sont ajoutés à chaque rendu
- Utiliser le flag `inp._bound` pour éviter les doublons sur les inputs qui persistent entre renders

---

## Prochains sprints — Conception validée

### Sprint 6 — Enseignants & TRM
- Fiche enseignant : nom, prénom, grade (→ ORS auto), matière, statut
- Services affectés : disciplines/groupes avec heures → total vs ORS
- Import TRM DSDEN (CSV/texte tabulé) → pré-remplissage HP/HSA
- Flux guidé : Structures → TRM → Dotation → HPC → Enseignants

### Sprint 7 — Pilotage pédagogique
- Dédoublements : une classe → deux groupes simultanés sur un créneau
- Co-enseignement
- Simulation : "si je supprime ce dédoublement → économie de Xh"
- Impact DGH par créneau (complétera le modèle groupes de cours actuel)

### Sprint 8 — Synthèses & exports
- Document PDF imprimable pour CA (via `window.print()` + CSS @media print)
- Tableaux HTML copiables pour Excel / Word

### Sprint 9 — Historique pluriannuel
- Comparaison DGH N vs N-1
- Graphiques SVG inline (sans bibliothèque)

---

## RGPD — Rappels permanents

- ❌ Jamais d'appel API externe avec données nominatives
- ❌ Jamais de `console.log` avec noms/données personnelles
- ✅ Données : `localStorage` + JSON local uniquement
- ✅ `.gitignore` exclut `data/` sauf `data/exemple.json`

---

## Checklist avant chaque livraison

- [ ] Fichiers lus en entier avant modification (`view` tool)
- [ ] `node --check` sur les 3 fichiers JS → aucune erreur
- [ ] `grep -n "onclick" index.html` → vide
- [ ] `grep -n "localStorage" assets/js/app.js` → seulement `dgh-theme`
- [ ] `grep -n "localStorage" assets/js/calculs.js` → vide
- [ ] Aucun `id` JS sans équivalent HTML
- [ ] Aucune couleur hardcodée dans le CSS
- [ ] Aucun style injecté en JS
- [ ] `data/exemple.json` mis à jour si schéma modifié
- [ ] `CHANGELOG.md` mis à jour
- [ ] `VERSION` dans `data.js` incrémentée si schéma modifié
- [ ] Aucune donnée réelle committée

---

*Ce fichier fait partie intégrante du projet DGH App.*  
*Le mettre à jour à chaque évolution structurelle ou décision de conception.*  
*Version : 3.1.6 — Dernière mise à jour : Sprint 5 (UX complète)*
