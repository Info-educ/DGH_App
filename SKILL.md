# SKILL.md — Instructions de développement DGH App

> **À fournir à Claude au début de chaque session de développement.**  
> Ce fichier garantit la cohérence du code sur plusieurs années d'évolution du projet.  
> Mis à jour à chaque sprint. Version courante : **3.2.0**

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
- Aucun bloc CSS en doublon (une règle = un seul endroit dans `style.css`)
- Aucune fonction jamais appelée dans un module

### 3. Zéro onclick inline — UNE SEULE délégation globale

**Règle permanente anti-boutons-muets :**
- **JAMAIS** de `addEventListener` direct sur un élément dont le rendu est conditionnel ou tardif
- **TOUJOURS** passer par `_onGlobalClick` / `_onGlobalChange` / `_onGlobalDblClick` / `_onGlobalBlur` dans `app.js`
- `_bindEvents()` ne lie en direct **que** les éléments garantis dans le DOM au chargement initial :
  `themeToggle`, `sidebarToggle`, `mobileMenuBtn`, `yearSelect`, `btnExport`, `btnImport`, `btnImportEmpty`, `fileImport`

```js
// ✅ Correct — dans _onGlobalClick (app.js)
if (e.target.closest('#btnAddDiv')) { DGHStructures.openModalDiv(null); return; }

// ✅ Correct — dans _onGlobalChange (app.js)
if (e.target.classList.contains('dot-input-h')) { DGHDotation.handleDotInput(e.target); return; }

// ❌ Interdit — addEventListener dans un module sur élément conditionnel
listEl.querySelectorAll('.dot-input-h').forEach(inp => inp.addEventListener('change', ...));
// Raison : dot-input-h est régénéré à chaque rendu → accumulation de listeners
```

Les boutons dans les tableaux générés dynamiquement utilisent `data-action` :
```html
<button data-action="edit-div" data-id="div_123">✎</button>
<button data-action="toggle-hpc-type" data-id="hpc_456">HP</button>
```
Captés dans `_onGlobalClick` via `e.target.closest('[data-action]')`.

### 4. Un fichier = une responsabilité stricte

| Fichier | Responsabilité | Interdit |
|---------|---------------|---------|
| `data.js` | SEUL fichier qui touche `localStorage` | DOM, calculs métier |
| `calculs.js` | Fonctions pures uniquement | DOM, `localStorage`, `DGHData.save()` |
| `app.js` | Noyau : init, navigate, délégations globales, toast | `localStorage` (sauf thème UI — exception documentée) |
| `modules/*.js` | Rendu et logique d'une vue | `localStorage` direct, accès direct à l'état d'autres modules |
| `style.css` | SEUL endroit pour les styles | `<style>` injectés en JS |

**Exception localStorage documentée** : le thème UI (`dgh-theme`) est géré dans `app.js` directement. C'est une préférence interface, pas une donnée métier. Cette exception est la seule autorisée.

### 5. Pattern module IIFE — API publique via `return {}`

Chaque module expose uniquement ses fonctions publiques :

```js
const DGHDashboard = (() => {
  // Fonctions privées — préfixe _
  function _renderDiscResume(bilan) { ... }

  // Fonctions publiques — sans préfixe
  function renderDashboard() {
    _renderDiscResume(bilan); // appel interne OK
    DGHEtab.renderAlertes();  // ❌ INTERDIT — cross-module privé
  }

  return { renderDashboard, updateBtnEtab }; // seule API exposée
})();
```

Règle : **jamais** appeler une fonction `_privée` d'un module depuis un autre module. Tout passe par l'API publique `return {}`.

### 6. Styles — classes CSS plutôt que `.style.*`

Préférer les classes CSS aux injections `.style.*` en JS :

```js
// ✅ Correct — via classe CSS
el.classList.toggle('is-hidden', condition);
el.classList.toggle('solde-danger', bilan.depassement);

// ✅ Acceptable — valeurs calculées dynamiquement (pas de classe possible)
barHP.style.width = pctHP + '%';
barHSA.style.marginLeft = pctHP + '%';

// ❌ À éviter — couleurs sémantiques en JS
el.style.color = hpFree < 0 ? 'var(--c-red)' : 'var(--c-accent)';
// → utiliser plutôt .solde-danger / .solde-positif
```

Classes utilitaires disponibles : `.is-hidden`, `.badge-hidden`, `.solde-danger`, `.solde-neutre`, `.solde-positif`, `.solde-hsa`, `.kpi-solde-danger`, `.dot-solde-pos`, `.dot-solde-neg`

### 7. Encodage — CRITIQUE
Les fichiers JS contiennent des caractères Unicode.  
**Toujours manipuler en binaire** (`'rb'`/`'wb'`) en Python pour éviter les corruptions.

```python
# ✅ Correct
with open('assets/js/modules/dashboard.js', 'rb') as f: content = f.read()
new = "texte avec accents".encode('utf-8')
content = content.replace(old, new)
with open('assets/js/modules/dashboard.js', 'wb') as f: f.write(content)
```

### 8. HTML tableau — ordre des balises
Dans un `<table>` : `<thead>` → `<tbody>` → `<tfoot>`.  
Construire : `html_tbody + '</tbody>' + tfoot + '</table>'`  
**Jamais** : `html + tfoot + '</tbody></table>'`

### 9. Tooltips et z-index — architecture fixe
Les tooltips `#kpiFloatTip` et `#discFloatTip` sont en `position: fixed; z-index: 99999` dans le `<body>`.  
Gérés par JS (mouseenter/mouseleave) pour échapper aux stacking contexts.  
**Ne jamais** utiliser `position: absolute` pour un tooltip dans un conteneur avec `overflow: hidden`.

### 10. Vérifications avant livraison
```bash
node --check assets/js/app.js
node --check assets/js/data.js
node --check assets/js/calculs.js
node --check assets/js/modules/dashboard.js
node --check assets/js/modules/structures.js
node --check assets/js/modules/dotation.js
node --check assets/js/modules/hpc.js
node --check assets/js/modules/etab.js
grep -n "onclick" index.html                          # → vide
grep -rn "localStorage" assets/js/modules/            # → vide
grep -n "localStorage" assets/js/app.js | grep -v "dgh-theme"  # → vide
grep -n "localStorage" assets/js/calculs.js           # → vide
grep -rn "\.style\.color\|\.style\.display" assets/js/modules/ # → vide
```

---

## Architecture des fichiers

```
index.html                    → SPA — toutes les vues dans <section class="view">
assets/
  css/
    style.css                 → Design system complet (light/dark + tous les composants)
  js/
    data.js                   → Couche données (localStorage, schéma, migrations, CRUD)
    calculs.js                → Moteur de calcul pur (zéro DOM, zéro localStorage)
    modules/
      dashboard.js            → DGHDashboard : tableau de bord + résumés
      structures.js           → DGHStructures : divisions, modales div + matrice
      dotation.js             → DGHDotation : disciplines, groupes cours, enveloppe
      hpc.js                  → DGHHPC : heures pédagogiques complémentaires
      etab.js                 → DGHEtab : établissement, années, alertes, init MEN
    app.js                    → Noyau : init, navigate, délégations globales, toast
data/
  exemple.json                → Données fictives anonymisées (schéma v3.1)
SKILL.md                      → Ce fichier
CHANGELOG.md                  → Historique des versions
README.md                     → Documentation utilisateur
```

### Ordre de chargement dans index.html (obligatoire)
```html
<script src="assets/js/data.js"></script>
<script src="assets/js/calculs.js"></script>
<script src="assets/js/modules/dashboard.js"></script>
<script src="assets/js/modules/structures.js"></script>
<script src="assets/js/modules/dotation.js"></script>
<script src="assets/js/modules/hpc.js"></script>
<script src="assets/js/modules/etab.js"></script>
<script src="assets/js/app.js"></script>  <!-- TOUJOURS EN DERNIER -->
```

### Structure interne d'app.js (noyau)
```
// ── INIT
// ── NAVIGATION
// ── RENDU GLOBAL (_renderAll, _renderYearSelect)
// ── FERMETURE MODALE (_closeModalById)
// ── DÉLÉGATION GLOBALE CLICK (_onGlobalClick)
// ── DÉLÉGATION GLOBALE CHANGE (_onGlobalChange)
// ── DÉLÉGATION GLOBALE DBLCLICK (_onGlobalDblClick)
// ── DÉLÉGATION GLOBALE BLUR (_onGlobalBlur)
// ── EVENTS (_bindEvents)
// ── TOAST
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
  grilles:        Object,   // { [discNom]: { '6e': h, '5e': h, ... } }
  enseignants:    [],       // Sprint 6
  alertes:        []
}

// DivisionObject
{ id, niveau: '6e'|'5e'|'4e'|'3e'|'SEGPA'|'ULIS'|'UPE2A', nom, effectif, dispositif }

// DisciplineObject
{ id, nom, couleur }

// RepartitionObject
{ disciplineId, hPoste, hsa, commentaire, groupesCours: [GroupeCoursObject] }

// GroupeCoursObject
{
  id, nom,
  classesIds: [divisionId],   // sélection par classes (pas par niveau)
  heures,                     // heures prof / semaine
  commentaire
  // effectif calculé = somme effectifs des classes
  // coût DGH = heures × nb_classes (pas nb_élèves)
}

// HPCObject
{
  id, nom,
  categorie: 'option'|'labo'|'dispositif'|'vie-classe'|'arts'|'sport'|'accompagnement'|'autre',
  disciplineId,               // null si hors discipline
  classesIds: [divisionId],
  typeHeure: 'hp'|'hsa',
  heures, effectif, commentaire
}
```

### Règle de migration
Toute modification du schéma implique :
1. Ajouter le champ dans `_annee()` dans `data.js`
2. Ajouter la migration dans `_migrate()` avec vérification `=== undefined`
3. Incrémenter `VERSION` dans `data.js`
4. Mettre à jour `data/exemple.json`

---

## Concepts métier — À connaître absolument

### Référence réglementaire
Les volumes horaires sont fixés par l'**arrêté du 19 mai 2015 relatif à l'organisation des enseignements dans les classes de collège** (J.O. du 20 mai 2015, modifié).  
⚠️ Ne jamais citer « BO spécial n°11 du 26 novembre 2015 » pour les grilles horaires — ce numéro désigne les *programmes*, pas les volumes.

### HP vs HSA — distinction fondamentale
- **H-Poste** : constituent les postes d'enseignants. Décidées par la DSDEN.
- **HSA** : heures supplémentaires payées. Budget CA. Ne constituent pas de postes.
- Les HPC ont aussi un type HP/HSA (`typeHeure`), intégré dans `bilanDotation`.

### Besoin réel — logique de priorité
1. Si la discipline a des **groupes de cours** → besoin = `sum(gc.heures × gc.classesIds.length)`
2. Sinon → besoin = `sum sur niveaux de (grille[discNom][niv] × nbDivisions[niv])`
3. Grille utilisée : `annee.grilles[discNom][niv]` si override, sinon `GRILLES_MEN[niv][discNom]`

### Groupes de cours — coût DGH réel
Un groupe coûte **heures × nb_classes** (pas nb_élèves).  
Une classe peut être dans plusieurs groupes simultanément (5eC → Espagnol ET Allemand).  
L'impact par créneau sera géré en Sprint 7.

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

### Classes utilitaires CSS (v3.2)
```css
.is-hidden           /* display:none — remplace style.display='none' */
.badge-hidden        /* badge alertes masqué */
.solde-danger        /* color: var(--c-red) */
.solde-neutre        /* color: var(--c-text-muted) */
.solde-positif       /* color: var(--c-accent) */
.solde-hsa           /* color: var(--c-indigo) */
.kpi-solde-danger    /* KPI solde en dépassement */
.dot-solde-pos       /* solde positif dotation */
.dot-solde-neg       /* solde négatif dotation */
```

### Composants réutilisables clés
```
.kpi-card[data-color="blue|green|amber|red|indigo|teal"]
.kpi-tooltip-card      → source de données pour #kpiFloatTip (JS)
.disc-tip-wrap         → source de données pour #discFloatTip (JS)
.section-card          → overflow:visible (jamais hidden — couperait tableaux)
  → les tableaux enfants ont leur overflow clip via #dot-list, #struct-list, #hpc-list
.dot-table.dot-table-grille  → tableau dotation avec colonnes niveaux dynamiques
.col-grille            → colonne niveau (input + total sous l'input)
.grille-input          → input h/div MEN éditable (amber si override)
.grille-input-modifie  → override utilisateur signalé visuellement
.dot-ecart-btn         → écart cliquable (action ecart-zero)
.hpc-type-toggle       → badge HP/HSA cliquable (action toggle-hpc-type)
.div-tag-struct        → badge bleu (groupes/HPC associés à une classe)
#kpiFloatTip           → tooltip KPI fixe (z-index:99999)
#discFloatTip          → tooltip disciplines dashboard fixe (z-index:99999)
app.toast(msg, 'success|error|info|warning', duration?)
```

---

## Moteur de calcul — API publique de calculs.js

```js
// Constantes
Calculs.ORS               // { certifie: { label, ors }, ... }
Calculs.GRILLES_MEN       // { '6e': { 'Français': 4.5, ... }, ... }
Calculs.H_THEORIQUES_NIV  // { '6e': 26, '5e': 26, '4e': 26, '3e': 26.5 }

// Calculs principaux
Calculs.bilanDotation(anneeData)
  → { enveloppe, hPosteEnv, hsaEnv, totalHP, totalHSA, totalAlloue, solde,
      pctConsomme, nbDisciplines, depassement,
      totalHPDisc, totalHSADisc, totalHPHPC, totalHSAHPC }

Calculs.resumeStructures(structures)
  → { nbDivisions, effectifTotal, parNiveau[...], niveauxPresents, hTheoriqueTotal }

Calculs.besoinsParDiscipline(structures, disciplines, repartition, grilles)
  → [{ disciplineId, nom, couleur,
       besoinTheorique, besoinMEN, hPoste, hsa, total,
       heuresGroupes, heuresGroupesReel, hasGroupes,
       ecart, commentaire, groupesCours,
       grilleLignes  // { '6e': { men, valeur, modifie }, ... }
     }]

Calculs.suggererRepartition(anneeData)
  → [{ disciplineId, nom, suggested }]

Calculs.bilanHPC(heuresPedaComp, disciplines)
  → { totalHeures, nbHeures, parCategorie, parDiscipline }

Calculs.genererAlertes(anneeData)
  → [{ type, severite: 'error'|'warning'|'info', message, ref }]

// Enseignants (Sprint 6)
Calculs.detailEnseignant(ens)
  → { ors, heuresFait, ecart, hsa, sousService, statut }
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

// Grilles horaires (overrides MEN)
DGHData.getGrilles(annee?)  → { [discNom]: { '6e': h, ... } }
DGHData.setGrille(discNom, niveau, heures)
  // heures=null → supprime l'override (retour MEN)
  // Double-clic sur grille-input → setGrille(discNom, niv, null)

// Setters
DGHData.setEtab(fields) / setAnneeActive(annee) / setDotation(hp, hsa, commentaire?)
DGHData.resetAnnee(annee?) / deleteAnnee(annee) → { ok, message? }

// Persistance
DGHData.save() / exportJSON() → filename / importJSON(file) → Promise
DGHData.genId(prefix) / isEmpty()
```

---

## Namespaces des modules (v3.2)

| Namespace | Fichier | Fonctions publiques principales |
|-----------|---------|--------------------------------|
| `DGHDashboard` | `modules/dashboard.js` | `renderDashboard()`, `updateBtnEtab()` |
| `DGHStructures` | `modules/structures.js` | `renderStructures()`, `openModalDiv(id)`, `openModalMatrice()`, `confirmDeleteDiv(id)`, `updateDupPreview()` |
| `DGHDotation` | `modules/dotation.js` | `renderDotation()`, `saveEnveloppe()`, `handleToggleGC(discId)`, `handleDotInput(target)`, `handleGrilleInput(target)`, `handleGrilleReset(target)`, `openModalDisc(id)`, `openModalGC(discId, gcId)`, `suggererHP()`, `ecartZero(discId, besoin, hsa)`, `gcSelectAllClasses()`, `toggleAllGC()`, `updateColorHint(v)`, `updateGCEffectif()` |
| `DGHHPC` | `modules/hpc.js` | `renderHPC()`, `openModalHPC(id)`, `toggleHPCType(id)`, `hpcSelectAllClasses()`, `updateHPCEffectif()` |
| `DGHEtab` | `modules/etab.js` | `openModal()`, `saveModal()`, `switchModalTab(tab)`, `addModalYear()`, `onModalYearChange(val)`, `renderAlertes()`, `initDisciplinesMEN()`, `openConfirmReset()`, `openConfirmDeleteAnnee(annee)`, `updateModalDotTotal()` |
| `app` | `app.js` | `navigate(viewId)`, `toast(msg, type, duration?)`, `renderAll()`, `renderYearSelect()` |

---

## Ajouter un nouveau module (checklist)

1. **`data.js`** : champ dans `_annee()` + migration dans `_migrate()` + incrémenter `VERSION`
2. **`index.html`** : `<section class="view" id="view-monmodule">` + nav item sidebar
3. **Créer `assets/js/modules/monmodule.js`** avec pattern IIFE :
   ```js
   const DGHMonModule = (() => {
     function renderMonModule() { ... }
     return { renderMonModule };
   })();
   ```
4. **`index.html`** : ajouter `<script src="assets/js/modules/monmodule.js"></script>` avant `app.js`
5. **`app.js`** :
   - Entrée dans `VIEWS`
   - `if (viewId === 'monmodule') DGHMonModule.renderMonModule()` dans `navigate()`
   - Tous les clics dans `_onGlobalClick`, tous les inputs dans `_onGlobalChange`
6. **`style.css`** : uniquement via variables CSS existantes, jamais de couleur hardcodée
7. **`calculs.js`** : fonctions pures nécessaires
8. Mettre à jour `SKILL.md`, `README.md`, `CHANGELOG.md`

---

## Pièges connus — à éviter absolument

### Listeners dynamiques
- **Ne jamais** appeler `addEventListener` dans un module sur un élément régénéré à chaque rendu
- Tous les inputs/boutons dynamiques passent par `_onGlobalChange` ou `_onGlobalClick` dans `app.js`
- La garde `_bound` (anciennement sur les inputs enveloppe) est **supprimée** — elle masquait le problème

### HTML tableau
- `<tfoot>` doit être **après** `</tbody>` : `html + '</tbody>' + tfoot + '</table>'`
- Le `colspan` des sous-lignes doit correspondre au nombre réel de colonnes (variable `nbCols`)

### CSS stacking context
- `transform` sur `:hover` crée un stacking context → tooltips absolute prisonniers
- `overflow: hidden` sur un conteneur coupe les enfants absolute/fixed
- Solution : tooltips `position: fixed` dans le `<body>`, gérés par JS

### Encodage Python
- Toujours `rb`/`wb` pour les fichiers JS contenant des caractères Unicode
- Les `replace()` peuvent échouer silencieusement sur des chaînes multi-octets en mode texte

---

## Prochains sprints — Conception validée

### Sprint 6 — Enseignants & TRM
- Créer `assets/js/modules/enseignants.js` (namespace `DGHEnseignants`)
- Fiche enseignant : nom, prénom, grade (→ ORS auto), matière, statut
- Services affectés : disciplines/groupes avec heures → total vs ORS
- Import TRM DSDEN (CSV/texte tabulé) → pré-remplissage HP/HSA
- Flux guidé : Structures → TRM → Dotation → HPC → Enseignants

### Sprint 7 — Pilotage pédagogique
- Créer `assets/js/modules/pilotage.js` (namespace `DGHPilotage`)
- Dédoublements : une classe → deux groupes simultanés sur un créneau
- Co-enseignement
- Simulation : "si je supprime ce dédoublement → économie de Xh"

### Sprint 8 — Synthèses & exports
- Créer `assets/js/modules/syntheses.js` (namespace `DGHSyntheses`)
- Document PDF imprimable pour CA (via `window.print()` + CSS @media print)
- Tableaux HTML copiables pour Excel / Word

### Sprint 9 — Historique pluriannuel
- Créer `assets/js/modules/historique.js` (namespace `DGHHistorique`)
- Comparaison DGH N vs N-1, graphiques SVG inline (sans bibliothèque)

---

## RGPD — Rappels permanents

- ❌ Jamais d'appel API externe avec données nominatives
- ❌ Jamais de `console.log` avec noms/données personnelles en production
- ✅ Données : `localStorage` + JSON local uniquement
- ✅ `.gitignore` exclut `data/` sauf `data/exemple.json`
- ✅ Toute future fonctionnalité IA : anonymiser avant envoi API

---

## Checklist avant chaque livraison

- [ ] Tous les fichiers modifiés lus en entier avant modification (`view` tool)
- [ ] `node --check` sur **tous** les fichiers JS → aucune erreur
- [ ] `grep -n "onclick" index.html` → vide
- [ ] `grep -rn "localStorage" assets/js/modules/` → vide
- [ ] `grep -n "localStorage" assets/js/app.js` → seulement `dgh-theme`
- [ ] `grep -n "localStorage" assets/js/calculs.js` → vide
- [ ] `grep -rn "\.style\.color\|\.style\.display" assets/js/modules/` → vide
- [ ] Aucun `id` JS sans équivalent HTML
- [ ] Aucune couleur hardcodée dans le CSS
- [ ] Aucun style injecté en JS (sauf `width`, `marginLeft`, `left`, `top` calculés)
- [ ] `data/exemple.json` mis à jour si schéma modifié
- [ ] `CHANGELOG.md` mis à jour
- [ ] `VERSION` dans `data.js` incrémentée si schéma modifié
- [ ] Aucune donnée réelle committée
- [ ] Migrations testées (import d'un fichier v2 dans une app v3)

---

*Ce fichier fait partie intégrante du projet DGH App.*  
*Le mettre à jour à chaque évolution structurelle ou décision de conception.*  
*Version : 3.2.0 — Dernière mise à jour : refactorisation structurelle*
