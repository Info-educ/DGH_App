# SKILL.md — Instructions de développement DGH App

> Ce fichier est à fournir à Claude au début de chaque session de développement.
> Il garantit la cohérence du code sur plusieurs années d'évolution du projet.

---

## Contexte du projet

**DGH App** est une application web monopage (SPA) de pilotage de la Dotation Globale Horaire pour collège.
- Hébergée sur **GitHub Pages** (HTML/CSS/JS Vanilla — zéro framework, zéro build)
- Données stockées en **localStorage** + export/import **JSON local** (RGPD : aucun serveur)
- Utilisateurs : équipe de direction (principal + principal adjoint)
- Objectif de maintenabilité : **plusieurs années sans refactorisation majeure**

---

## ⚠️ RÈGLES DE QUALITÉ — NON NÉGOCIABLES

Ces règles s'appliquent à chaque modification, sans exception.

### 1. Lire avant d'écrire
Avant toute modification, **lire le fichier entier** avec le `view` tool.
Ne jamais modifier à l'aveugle sur la base d'un contexte partiel.

### 2. Zéro code zombie
Après chaque modification, **vérifier qu'aucun résidu de l'ancienne version ne subsiste** :
- Aucune variable déclarée deux fois
- Aucun `id` HTML référencé dans le JS qui n'existe plus dans le HTML
- Aucun import de police ou de bibliothèque qui ne sert plus
- Aucun bloc CSS injecté en JS qui double des règles dans `style.css`

### 3. Zéro onclick inline — et UNE SEULE délégation globale
**Interdiction absolue** d'utiliser `onclick="..."` dans le HTML.

**Règle permanente anti-boutons-muets** (introduite après bug Sprint 2) :
- **JAMAIS** de `addEventListener` direct sur un bouton dont le rendu est conditionnel ou tardif (bouton dans une vue qui démarre `display:none`, bouton généré par `innerHTML`, etc.)
- **TOUJOURS** passer par la délégation globale `_onGlobalClick` dans `app.js`
- `_bindEvents()` ne lie en direct **que** les éléments garantis dans le DOM au chargement : `themeToggle`, `sidebarToggle`, `mobileMenuBtn`, `yearSelect`, `btnExport`, `btnImport`, `fileImport`
- Tous les autres boutons (modals, actions dans les vues, boutons ajoutés dynamiquement) sont gérés dans `_onGlobalClick` via `e.target.closest('#id')` ou `e.target.closest('[data-action]')`

```js
// ✅ Correct — dans _onGlobalClick
if (e.target.closest('#btnAddDiv')) { _openModalDiv(null); return; }

// ❌ Interdit — dans _bindEvents
document.getElementById('btnAddDiv').addEventListener('click', () => _openModalDiv(null));
// Raison : btnAddDiv est dans view-structures qui est display:none au chargement
// Le querySelector réussit, mais des conflits entre listeners peuvent silencieusement neutraliser le bouton
```

### 4. Vérification d'intégrité après chaque livraison
Avant de livrer des fichiers, vérifier :
```bash
# Aucun onclick inline
grep -n "onclick" index.html   # doit retourner vide

# Aucune variable dupliquée dans app.js
grep -n "const themeToggle\|let themeToggle\|var themeToggle" assets/js/app.js  # max 1 résultat

# Aucune référence à d'anciennes polices
grep -n "Syne\|DM Mono\|Inter\|Roboto\|Arial" assets/css/style.css  # doit retourner vide
```

### 5. Cohérence HTML ↔ JS
Chaque `id` utilisé dans `app.js` doit exister dans `index.html`.
Chaque `id` dans `index.html` doit être utilisé soit en JS, soit avoir une raison d'être.

### 6. Un fichier = une responsabilité
- `data.js`    → SEUL fichier qui touche localStorage. Jamais de `localStorage` dans app.js.
- `calculs.js` → fonctions pures uniquement. Jamais de DOM, jamais de `DGHData.save()`.
- `app.js`     → contrôleur UI. Jamais de calculs métier, jamais de localStorage direct.
- `style.css`  → SEUL endroit pour les styles. Jamais de `<style>` injecté en JS.

---

## Architecture — NE PAS MODIFIER sans raison valide

```
index.html           → Point d'entrée unique, toutes les vues (sections HTML)
assets/css/style.css → Design system complet avec variables CSS
assets/js/data.js    → Couche données (SEUL fichier qui touche localStorage)
assets/js/calculs.js → Moteur de calcul pur (ORS, HSA, DGH, alertes)
assets/js/app.js     → Contrôleur UI (navigation, rendu, events)
data/exemple.json    → Données fictives anonymisées pour démonstration
```

---

## Design System — Règles strictes

### Variables CSS (ne jamais hardcoder de couleurs)
```css
--c-bg, --c-surface, --c-surface2, --c-surface3   /* fonds */
--c-border, --c-border2                            /* bordures */
--c-text, --c-text-muted, --c-text-dim             /* textes */
--c-accent, --c-accent-hover, --c-accent-light     /* vert sauge principal */
--c-green, --c-green-bg                            /* validation */
--c-amber, --c-amber-bg                            /* attention */
--c-red, --c-red-bg                                /* erreur */
--c-blue, --c-blue-bg                              /* info */
--c-indigo, --c-indigo-bg                          /* secondaire */
--c-sidebar-bg, --c-sidebar-text, ...              /* sidebar (toujours sombre) */
```

### Typographie
- **UI, titres, labels, boutons** : `font-family: 'Outfit', sans-serif`
- **Données chiffrées, valeurs DGH** : `font-family: 'JetBrains Mono', monospace`
- Polices chargées via `@import` dans `style.css` — jamais de `<link>` dans le HTML

### Thème dark/light
- Light par défaut (`localStorage.getItem('dgh-theme') || 'light'`)
- Appliqué via `data-theme="dark|light"` sur `<html>`
- Toutes les variables CSS ont leur contrepartie dans `[data-theme="dark"]`

### Composants existants (réutiliser, ne pas recréer)
- `.kpi-card[data-color="blue|green|amber|red|indigo|teal"]`
- `.section-card` + `.section-card-header`
- `.btn-primary`, `.btn-secondary`, `.btn-link`
- `.modal-overlay.hidden` + `.modal`
- `app.toast(message, 'success|error|info|warning')`
- `.view` + `.view-header` + `.view-title`

---

## Couche données — Règles strictes

### Accès TOUJOURS via DGHData
```js
// ✅ Correct
const annee = DGHData.getAnnee();
DGHData.setEtab({ nom: 'Collège Jean Moulin' });
DGHData.save();

// ❌ Interdit
localStorage.setItem('truc', JSON.stringify(data));
```

### Modification du schéma JSON
1. Ajouter le champ dans `defaultSchema()` ou `defaultAnnee()` dans `data.js`
2. Ajouter une migration dans `_migrate()` pour les fichiers existants
3. Mettre à jour `data/exemple.json`
4. Incrémenter la version (`VERSION`) dans `data.js`

### IDs d'objets
Toujours utiliser `DGHData.genId('prefix')` pour générer des identifiants uniques.

---

## Moteur de calcul — Règles strictes

Fonctions pures uniquement dans `calculs.js` :
```js
// ✅ Correct
function bilanDGH(anneeData) { return { enveloppe, solde, ... }; }

// ❌ Interdit dans calculs.js
DGHData.save();
document.getElementById('...');
```

### Ajouter un corps ORS
Dans `calculs.js`, objet `ORS` :
```js
'nouveau_corps': { label: 'Libellé', ors: 18, seuil_hsa: 1 }
```

### Ajouter une alerte
Dans `genererAlertes()` :
```js
alertes.push({ type: 'mon-type', severite: 'error|warning|info', message: '...', ref: 'id' });
```

---

## Ajouter un nouveau module

1. **HTML** : `<section class="view" id="view-monmodule">` dans `#viewContainer`
2. **Nav** : `<li class="nav-item" data-view="monmodule">` dans `.nav-list`
3. **app.js** : entrée dans `VIEWS` + `if (viewId === 'monmodule') _renderMonmodule()` dans `navigate()`
4. **Styles** : variables CSS existantes uniquement
5. **Données** : `defaultAnnee()` dans `data.js` si nécessaire + migration

---

## Conventions de code

### Nommage
- Variables/fonctions publiques : `camelCase`
- Fonctions privées : `_camelCase` (préfixe underscore)
- IDs HTML : `kebab-case`
- Classes CSS : `kebab-case`
- Modules JS : `PascalCase` (ex: `DGHData`, `Calculs`, `app`)

### Commentaires
- Chaque section d'un fichier : séparateur `// ── Titre ──────`
- Fonctions publiques : JSDoc minimal
- Règles métier (ORS, seuils) : citer la source réglementaire

### Commits Git
```
feat: fonctionnalité ajoutée
fix: bug corrigé
refactor: restructuration sans nouvelle fonctionnalité
docs: mise à jour README ou SKILL.md
style: changement CSS uniquement
```

---

## RGPD — Rappels permanents

- ❌ Jamais d'appel API externe avec des données nominatives enseignants
- ❌ Jamais de `console.log` avec des noms en production
- ✅ Données nominatives : localStorage + fichier JSON local uniquement
- ✅ `.gitignore` exclut `data/` sauf `data/exemple.json`
- ✅ Toute future fonctionnalité IA : anonymiser les données avant envoi à l'API

---

## Checklist avant chaque commit

- [ ] Tous les fichiers modifiés ont été **lus en entier** avant modification
- [ ] `grep -n "onclick" index.html` → vide
- [ ] Aucune variable déclarée deux fois dans app.js
- [ ] Aucun `id` JS sans équivalent dans le HTML
- [ ] Aucune référence à d'anciennes polices ou couleurs hardcodées
- [ ] Aucun style injecté en JS (tout est dans style.css)
- [ ] `data/exemple.json` à jour si le schéma a changé
- [ ] `CHANGELOG.md` mis à jour
- [ ] Aucune donnée réelle committée

---

*Ce fichier fait partie intégrante du projet DGH App.*
*Le mettre à jour à chaque évolution structurelle.*
