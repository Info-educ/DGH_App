# SKILL.md — Instructions de développement DGH App

> **À fournir à Claude au début de chaque session de développement.**  
> Ce fichier garantit la cohérence du code sur plusieurs années d'évolution du projet.  
> Mis à jour à chaque sprint. Version courante : **3.0.2**

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
- Aucun import de police ou bibliothèque inutilisé
- Aucun bloc CSS en doublon (une règle = un seul endroit dans `style.css`)

### 3. Zéro onclick inline — UNE SEULE délégation globale

**Règle permanente anti-boutons-muets :**
- **JAMAIS** de `addEventListener` direct sur un bouton dont le rendu est conditionnel ou tardif
- **TOUJOURS** passer par `_onGlobalClick` dans `app.js`
- `_bindEvents()` ne lie en direct **que** les éléments garantis dans le DOM au chargement :
  `themeToggle`, `sidebarToggle`, `mobileMenuBtn`, `yearSelect`, `btnExport`, `btnImport`, `fileImport`

```js
// ✅ Correct — dans _onGlobalClick
if (e.target.closest('#btnAddDiv')) { _openModalDiv(null); return; }

// ❌ Interdit — dans _bindEvents ou ailleurs
document.getElementById('btnAddDiv').addEventListener('click', () => _openModalDiv(null));
// Raison : btnAddDiv est dans view-structures qui est display:none au chargement
```

Les boutons dans les tableaux générés dynamiquement utilisent `data-action` :
```html
<button data-action="edit-div" data-id="div_123">✎</button>
<button data-action="add-gc" data-disc-id="disc_456">+</button>
```
Captés dans `_onGlobalClick` via `e.target.closest('[data-action]')`.

### 4. Un fichier = une responsabilité stricte

| Fichier | Responsabilité | Interdit |
|---------|---------------|---------|
| `data.js` | SEUL fichier qui touche `localStorage` | DOM, calculs métier |
| `calculs.js` | Fonctions pures uniquement | DOM, `localStorage`, `DGHData.save()` |
| `app.js` | Contrôleur UI | `localStorage` direct, calculs métier |
| `style.css` | SEUL endroit pour les styles | `<style>` injectés en JS |

### 5. Cohérence HTML ↔ JS
- Chaque `id` utilisé dans `app.js` doit exister dans `index.html`
- Chaque `id` dans `index.html` doit être utilisé ou documenté

### 6. Vérifications avant livraison
```bash
grep -n "onclick" index.html          # doit retourner vide
grep -rn "localStorage" assets/js/app.js    # doit retourner vide
grep -rn "localStorage" assets/js/calculs.js # doit retourner vide
grep -n "Syne\|Inter\|Roboto\|Arial" assets/css/style.css  # doit retourner vide
```

---

## Architecture des fichiers

```
index.html              → SPA — toutes les vues dans des <section class="view">
assets/css/style.css    → Design system (variables CSS light/dark + tous les composants)
assets/js/data.js       → Couche données (localStorage, schéma, migrations, CRUD)
assets/js/calculs.js    → Moteur de calcul pur (ORS, DGH, besoins MEN, suggestions)
assets/js/app.js        → Contrôleur UI (navigation, rendu vues, délégation événements)
data/exemple.json       → Données fictives anonymisées (schéma v3)
SKILL.md                → Ce fichier
CHANGELOG.md            → Historique des versions
README.md               → Documentation utilisateur
```

---

## Modèle de données — Schéma v3.0

```js
// Racine
{
  _meta: { version: '3.0.0', createdAt, updatedAt },
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
  structures: [DivisionObject],
  disciplines: [DisciplineObject],
  repartition: [RepartitionObject],
  heuresPedaComp: [HPCObject],
  enseignants: [],            // Sprint 6
  alertes: []
}

// DivisionObject
{ id, niveau: '6e'|'5e'|'4e'|'3e'|'SEGPA'|'ULIS'|'UPE2A', nom, effectif, dispositif }

// DisciplineObject
{ id, nom, couleur }

// RepartitionObject
{
  disciplineId, hPoste, hsa, commentaire,
  groupesCours: [GroupeCoursObject]  // sous-lignes dans la vue Dotation
}

// GroupeCoursObject — rattaché à une discipline, constitué de classes précises
{
  id, nom,
  classesIds: [divisionId],   // sélection par classes (pas par niveau)
  heures,                     // heures prof / semaine
  commentaire
  // effectif calculé dynamiquement = somme effectifs des classes sélectionnées
}

// HPCObject — Heures Pédagogiques Complémentaires
{
  id, nom,
  categorie: 'option'|'labo'|'dispositif'|'vie-classe'|'arts'|'sport'|'accompagnement'|'autre',
  disciplineId,               // null si hors discipline
  classesIds: [divisionId],   // sélection par classes
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

### HP vs HSA — distinction fondamentale
- **H-Poste** : constituent les postes d'enseignants. Décidées par la DSDEN. Apparaissent dans les services.
- **HSA** : heures supplémentaires payées. Budget CA. Ne constituent pas de postes.
- La DGH est ventilée en HP + HSA par discipline dans le tableau Dotation.
- Chaque discipline a une colonne HP et une colonne HSA, modifiables inline.

### Besoin théorique vs heures allouées
- **Besoin théorique** = calculé depuis GRILLES_MEN × nb divisions par niveau (automatique)
- **Heures allouées** = HP + HSA saisies manuellement pour chaque discipline
- **Écart** = allouées - théorique → affiché avec couleur (vert/orange/rouge)

### Groupes de cours — modèle LV2
Un groupe de cours est rattaché à une discipline et constitué de classes précises.
Ex : LV2 Espagnol → discipline LV2, classes [5eA, 5eB, 5eC, 4eA, 4eB]
Ex : LV2 Allemand → discipline LV2, classes [5eC, 4eC]

**Point crucial** : une classe peut appartenir à plusieurs groupes simultanément (5eC dans les deux groupes LV2). Cela ne se traduit pas en doublement d'effectif — les groupes sont des unités prof, pas des unités élèves. L'impact DGH exact par créneau sera géré dans le module Pilotage pédagogique (Sprint 7).

### Heures Pédagogiques Complémentaires
Heures hors grille standard (options, labo, dispositifs, arts, sport, accompagnement).
Elles ont un coût DGH (heures prof) mais ne sont pas dans la grille MEN par division.
Exemples : Latin 4e, Labo SVT, Chorale, Savoir nager, Orchestre, Devoirs faits, HVC.

### TRM (Tableau de Répartition des Moyens)
Document DSDEN qui attribue précisément les HP et HSA par discipline.
**Sprint 6** : import TRM → pré-remplissage automatique des colonnes HP/HSA dans Dotation.
En attendant : bouton "💡 Suggérer HP" qui distribue proportionnellement au besoin théorique.

### Suggestion automatique HP
`Calculs.suggererRepartition(anneeData)` distribue `hPosteEnveloppe` proportionnellement aux besoins MEN.
Résultat = point de départ à ajuster selon le TRM réel. Ne touche pas aux HSA.

---

## Design System

### Variables CSS (ne jamais hardcoder de couleurs)
```css
/* Fonds */
--c-bg, --c-surface, --c-surface2, --c-surface3
/* Bordures */
--c-border, --c-border2
/* Textes */
--c-text, --c-text-muted, --c-text-dim
/* Couleurs sémantiques */
--c-accent, --c-accent-hover, --c-accent-light   /* vert sauge */
--c-green, --c-green-bg     /* validation */
--c-amber, --c-amber-bg     /* attention */
--c-red, --c-red-bg         /* erreur/danger */
--c-blue, --c-blue-bg       /* info */
--c-indigo, --c-indigo-bg   /* HSA / secondaire */
/* Sidebar (toujours sombre quelle que soit le thème) */
--c-sb-bg, --c-sb-text, --c-sb-muted, --c-sb-border, --c-sb-hover, --c-sb-active, --c-sb-active-t
```

### Typographie
- **UI, titres, labels, boutons** : `font-family: 'Outfit', sans-serif`
- **Données chiffrées, valeurs DGH, codes** : `font-family: 'JetBrains Mono', monospace`
- Polices via `@import` dans `style.css` uniquement — jamais de `<link>` dans le HTML

### Thème dark/light
- Light par défaut : `localStorage.getItem('dgh-theme') || 'light'`
- Appliqué via `data-theme="dark|light"` sur `<html>`
- Toutes les variables CSS ont leur contrepartie dans `[data-theme="dark"]`
- HP → couleur `--c-accent` (vert) ; HSA → couleur `--c-indigo`

### Composants réutilisables
```
.kpi-card[data-color="blue|green|amber|red|indigo|teal"]
.section-card + .section-card-header
.btn-primary / .btn-secondary / .btn-link / .btn-danger
.modal-overlay.modal-open + .modal (.modal-sm / .modal-lg)
.modal-tabs + .modal-tab + .modal-tab-panel   ← onglets internes modal
.progress-track + .dot-bar-hp + .dot-bar-hsa-part  ← barre duale HP/HSA
.struct-table / .dot-table  ← tableaux standards
.dot-input-h.dot-input-hp / .dot-input-hsa  ← inputs inline dotation
.niveau-badge.niveau-6e / .5e / .4e / .3e  ← badges niveaux colorés
.niv-check-label + .niv-check  ← checkboxes niveaux (masquées, label cliquable)
.classes-check  ← idem mais pour classes précises (modal GC et HPC)
.details-avancees  ← <details> dépliable (dispositif division)
app.toast(msg, 'success|error|info|warning', duration?)
```

---

## Moteur de calcul — API publique de calculs.js

```js
// Constantes
Calculs.ORS                    // { certifie: { label, ors }, ... }
Calculs.GRILLES_MEN            // { '6e': { 'Français': 4.5, ... }, ... }
Calculs.H_THEORIQUES_NIV       // { '6e': 26, '5e': 26, '4e': 26, '3e': 26.5 }

// Calculs principaux
Calculs.bilanDotation(anneeData)
  → { enveloppe, hPosteEnv, hsaEnv, totalHP, totalHSA, totalAlloue, solde, pctConsomme, nbDisciplines, depassement }

Calculs.resumeStructures(structures)
  → { nbDivisions, effectifTotal, parNiveau[{niveau, nbDivisions, effectif, hTheoriqueDiv, hTheoriqueTotal}], niveauxPresents, hTheoriqueTotal }

Calculs.besoinsParDiscipline(structures, disciplines, repartition)
  → [{ disciplineId, nom, couleur, besoinTheorique, hPoste, hsa, total, heuresGroupes, ecart, commentaire, groupesCours }]

Calculs.suggererRepartition(anneeData)
  → [{ disciplineId, nom, suggested }]  // HP suggérées proportionnellement au besoin MEN

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
// Init
DGHData.init()

// Getters globaux
DGHData.get()               → données brutes complètes
DGHData.getEtab()           → { nom, uai, academie, commune }
DGHData.getAnneeActive()    → '2025-2026'
DGHData.getAnnees()         → ['2025-2026', '2024-2025', ...]  (triées desc)
DGHData.getAnnee(annee?)    → AnneeObject (annee active si omis)
DGHData.getNiveaux()        → ['6e', '5e', '4e', '3e', 'SEGPA', 'ULIS', 'UPE2A']
DGHData.getCategoriesHPC()  → [{ value, label }]
DGHData.getDisciplinesMEN() → liste des 17 disciplines standard avec couleurs

// Structures
DGHData.getStructures(annee?)           → [DivisionObject] triées
DGHData.getDivision(id, annee?)         → DivisionObject | null
DGHData.addDivision(fields)             → DivisionObject
DGHData.updateDivision(id, fields)      → Boolean
DGHData.deleteDivision(id)              → Boolean  // nettoie aussi les classesIds des GC et HPC
DGHData.duplicateDivisions(id, count)   → [DivisionObject]
DGHData.appliquerMatrice(matrice, remplacer)  // matrice = [{niveau, nbDivisions, effectifMoyen}]

// Disciplines & répartition
DGHData.getDisciplines(annee?)                    → [DisciplineObject] triées
DGHData.getDiscipline(id, annee?)                 → DisciplineObject | null
DGHData.getRepartition(annee?)                    → [RepartitionObject enrichi avec groupesCours]
DGHData.addDiscipline(fields)                     → DisciplineObject  // crée aussi la ligne repartition
DGHData.updateDiscipline(id, fields)              → Boolean
DGHData.deleteDiscipline(id)                      → Boolean  // supprime aussi la ligne repartition
DGHData.setRepartition(disciplineId, fields)      // { hPoste?, hsa?, commentaire? }
DGHData.initDisciplinesMEN()                      → nb (disciplines ajoutées)

// Groupes de cours (sous-lignes discipline dans Dotation)
DGHData.getGroupeCours(disciplineId, gcId, annee?) → GroupeCoursObject | null
DGHData.addGroupeCours(disciplineId, fields)        → GroupeCoursObject
DGHData.updateGroupeCours(disciplineId, gcId, fields) → Boolean
DGHData.deleteGroupeCours(disciplineId, gcId)       → Boolean

// Heures pédagogiques complémentaires
DGHData.getHeuresPedaComp(annee?)   → [HPCObject] triées
DGHData.getHPC(id, annee?)          → HPCObject | null
DGHData.addHPC(fields)              → HPCObject
DGHData.updateHPC(id, fields)       → Boolean
DGHData.deleteHPC(id)               → Boolean

// Setters
DGHData.setEtab(fields)                           // { nom?, uai?, academie?, commune? }
DGHData.setAnneeActive(annee)                     // crée l'année si elle n'existe pas
DGHData.setDotation(hPosteEnveloppe, hsaEnveloppe, commentaire?)

// Années
DGHData.resetAnnee(annee?)          // réinitialise (structures, dotation, enseignants)
DGHData.deleteAnnee(annee)          → { ok, message? }  // refuse si seule année ou active

// Persistance
DGHData.save()
DGHData.exportJSON()                → filename
DGHData.importJSON(file)            → Promise<{ etablissement, annees }>  // backup auto avant
DGHData.genId(prefix)               → 'prefix_timestamp_random'
DGHData.isEmpty()                   → Boolean
```

---

## Ajouter un nouveau module (checklist)

1. **`data.js`** : ajouter le champ dans `_annee()` + migration dans `_migrate()` + incrémenter VERSION
2. **`index.html`** : `<section class="view" id="view-monmodule">` + `<li class="nav-item" data-view="monmodule">` dans la sidebar
3. **`app.js`** :
   - Entrée dans `VIEWS = { monmodule: 'Titre affiché' }`
   - `if (viewId === 'monmodule') _renderMonmodule()` dans `navigate()`
   - Fonction `_renderMonmodule()` dans la section appropriée
   - Boutons dans `_onGlobalClick` (jamais de listener direct)
4. **`style.css`** : styles avec variables CSS existantes uniquement (pas de couleurs hardcodées)
5. **`calculs.js`** : ajouter les fonctions pures nécessaires
6. Mettre à jour `SKILL.md` et `README.md`

---

## Prochains sprints — Conception validée

### Sprint 6 — Enseignants & TRM
**Priorité haute**

Module enseignants :
- Fiche par enseignant : nom, prénom, grade (→ ORS auto), matière, statut (titulaire/TZR/contractuel/complément)
- Services affectés : liste des disciplines/groupes avec heures → total calculé vs ORS
- Détail : heures normales + HSA + éventuellement Pacte / IMP
- TZR : établissement de rattachement, heures en complément

Import TRM :
- Copier-coller depuis le tableau DSDEN (CSV ou texte tabulé)
- OU saisie manuelle discipline par discipline
- Résultat : pré-remplissage HP/HSA dans Dotation
- Le TRM arrive **avant** la ventilation → afficher un bandeau de guidance "étape suivante"

Flux guidé à implémenter :
```
Structures → TRM / Enveloppe → Dotation (ventilation) → Groupes → HPC → Enseignants
```

### Sprint 7 — Pilotage pédagogique
**Onglet dédié "Pilotage pédagogique"**

- Déclarer des **dédoublements** : une classe → deux groupes simultanés sur un même créneau
  - Ex : SVT labo (3e → groupe A + groupe B, même heure) = 2h prof au lieu de 1h
  - Ex : LV2 (5eC → groupe Espagnol + groupe Allemand) = 2 × 2,5h prof
- Déclarer du **co-enseignement** : 2 profs dans la même classe au même moment
- Vue : tableau de toutes les classes avec leurs créneaux dédoublés
- **Simulation** : curseurs "si je supprime ce dédoublement → économie de Xh"
- Impact DGH calculé automatiquement et intégré dans la Dotation

> Point de conception important : les groupes de cours actuels (Sprint 5) ne modélisent pas la simultanéité. Le Sprint 7 ajoute la notion de "créneau" pour calculer le coût réel par heure de cours.

### Sprint 8 — Synthèses & exports
- Tableau de synthèse DGH imprimable (format A4) pour présentation au CA
- Tableau par discipline : besoin théorique / HP / HSA / écart / enseignants affectés
- Tableau par enseignant : service complet
- Export HTML copiable dans un mail ou dans Word
- Export PDF via `window.print()` avec CSS @media print

### Sprint 9 — Historique pluriannuel
- Comparaison DGH N vs N-1 : évolution par discipline
- Évolution des effectifs et du nombre de divisions
- Graphiques SVG inline (pas de bibliothèque)
- Détection des tendances (discipline en hausse/baisse)

---

## Conventions de code

### Nommage
- Variables/fonctions **publiques** : `camelCase`
- Fonctions **privées** dans les IIFE : `_camelCase` (préfixe underscore)
- IDs HTML : `kebab-case`
- Classes CSS : `kebab-case`
- Modules JS : `PascalCase` (`DGHData`, `Calculs`, `app`)

### Structure d'app.js
```
// ── INIT
// ── THÈME
// ── NAVIGATION
// ── DASHBOARD
// ── STRUCTURES
// ── MODAL SAISIE MATRICIELLE
// ── MODAL DIVISION
// ── DOTATION
// ── MODAL DISCIPLINE
// ── SUGGESTION HP
// ── MODAL GROUPE DE COURS
// ── HPC (Heures Pédagogiques Complémentaires)
// ── MODAL HPC
// ── ONGLETS MODAL ÉTABLISSEMENT
// ── MODAL ÉTABLISSEMENT
// ── ALERTES
// ── DISCIPLINES MEN INIT
// ── RENDU GLOBAL
// ── DÉLÉGATION GLOBALE (_onGlobalClick)
// ── EVENTS (_bindEvents)
// ── PREVIEW DUP
// ── TOAST
// ── UTIL (_set, _setVal, _esc)
```

### Commentaires
- Chaque section : séparateur `// ── Titre ─────────────────────────────────────`
- Fonctions publiques : JSDoc minimal avec `@param` et `@returns`
- Règles métier : citer la source réglementaire (ex : "BO spécial n°11 du 26 novembre 2015")

### Commits Git
```
feat:     fonctionnalité ajoutée
fix:      bug corrigé
refactor: restructuration sans nouvelle fonctionnalité
docs:     mise à jour README, SKILL.md ou CHANGELOG
style:    changement CSS uniquement
data:     modification du schéma de données
```

---

## RGPD — Rappels permanents

- ❌ Jamais d'appel API externe avec des données nominatives enseignants
- ❌ Jamais de `console.log` avec des noms/données personnelles en production
- ✅ Données nominatives : `localStorage` + fichier JSON local uniquement
- ✅ `.gitignore` exclut `data/` sauf `data/exemple.json`
- ✅ Toute future fonctionnalité IA (ex : import TRM par OCR) : anonymiser avant envoi API

---

## Checklist avant chaque livraison

- [ ] Tous les fichiers modifiés ont été **lus en entier** avant modification
- [ ] `grep -n "onclick" index.html` → vide
- [ ] `grep -n "localStorage" assets/js/app.js` → vide
- [ ] `grep -n "localStorage" assets/js/calculs.js` → vide
- [ ] Aucun `id` JS sans équivalent HTML
- [ ] Aucune couleur hardcodée dans le CSS (tout via variables)
- [ ] Aucun style injecté en JS (tout dans `style.css`)
- [ ] `data/exemple.json` mis à jour si le schéma a changé
- [ ] `CHANGELOG.md` mis à jour avec la version et les changements
- [ ] `VERSION` dans `data.js` incrémentée si schéma modifié
- [ ] Aucune donnée réelle committée
- [ ] Migrations testées (import d'un fichier v2 dans une app v3)

---

*Ce fichier fait partie intégrante du projet DGH App.*  
*Le mettre à jour à chaque évolution structurelle ou décision de conception.*  
*Version : 3.0.2 — Dernière mise à jour : Sprint 5*
