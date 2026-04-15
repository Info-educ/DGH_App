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

## Architecture — NE PAS MODIFIER sans raison valide

```
index.html          → Point d'entrée unique, contient toutes les vues (sections HTML)
assets/css/style.css → Design system complet avec variables CSS
assets/js/data.js   → Couche données (SEUL fichier qui touche localStorage)
assets/js/calculs.js → Moteur de calcul pur (ORS, HSA, DGH, alertes) — sans effets de bord
assets/js/app.js    → Contrôleur UI (navigation, rendu, events)
```

**Règle d'or :** chaque fichier a une responsabilité unique. Ne jamais mélanger les couches.

---

## Design System — Règles strictes

### Variables CSS (ne pas hardcoder de couleurs)
```css
--c-bg, --c-surface, --c-surface2   /* fonds */
--c-border, --c-border2             /* bordures */
--c-text, --c-text-muted, --c-text-dim  /* textes */
--c-accent, --c-accent-hover, --c-accent-dim  /* bleu principal */
--c-green, --c-amber, --c-red       /* statuts */
--c-indigo, --c-teal                /* secondaires */
```

### Typographie
- **Titres, labels, boutons** : `font-family: 'Syne', sans-serif`
- **Données chiffrées, code, inputs** : `font-family: 'DM Mono', monospace`
- Ne jamais utiliser Arial, Inter, Roboto ou System fonts

### Composants existants (réutiliser, ne pas recréer)
- `.kpi-card[data-color="blue|green|amber|red|indigo|teal"]` — carte KPI
- `.section-card` + `.section-card-header` — bloc avec titre
- `.btn-primary`, `.btn-secondary`, `.btn-link` — boutons
- `.modal-overlay` + `.modal` — fenêtre modale
- `app.toast(message, 'success|error|info|warning')` — notification
- `.view` + `.view-header` + `.view-title` — structure d'une vue

---

## Couche données — Règles strictes

### Accès aux données : TOUJOURS via DGHData
```js
// ✅ Correct
const annee = DGHData.getAnnee();
DGHData.setEtab({ nom: 'Collège Jean Moulin' });
DGHData.save();

// ❌ Interdit
localStorage.setItem('truc', JSON.stringify(data));
```

### Modification du schéma JSON
Si on ajoute un champ au schéma :
1. Ajouter le champ dans `defaultSchema()` ou `defaultAnnee()` dans `data.js`
2. Ajouter une migration dans `_migrate()` pour les fichiers existants
3. Mettre à jour `data/exemple.json`
4. Incrémenter la version dans `data.js` (constante `VERSION`)

### IDs
Toujours utiliser `DGHData.genId('prefix')` pour générer des identifiants uniques.

---

## Moteur de calcul — Règles strictes

Le fichier `calculs.js` doit rester **pur** (fonctions sans effets de bord) :
```js
// ✅ Correct — fonction pure
function bilanDGH(anneeData) { ... return bilan; }

// ❌ Interdit dans calculs.js
DGHData.save();
document.getElementById(...);
```

### ORS — Comment ajouter un nouveau corps
Dans `calculs.js`, section `ORS` :
```js
'nouveau_corps': { label: 'Libellé', ors: 18, seuil_hsa: 1 }
```

### Alertes — Comment ajouter une nouvelle alerte
Dans `genererAlertes()`, ajouter un bloc :
```js
alertes.push({
  type: 'mon-type',     // identifiant unique
  severite: 'error|warning|info',
  message: 'Message lisible',
  ref: 'id-de-la-donnee-concernee'
});
```

---

## Ajouter un nouveau module (vue)

1. **HTML** (`index.html`) : ajouter une `<section class="view" id="view-monmodule">` dans `#viewContainer`
2. **Navigation** (`index.html`) : ajouter un `<li class="nav-item" data-view="monmodule">` dans `.nav-list`
3. **Routeur** (`app.js`) : ajouter l'entrée dans `VIEWS` et le rendu dans `navigate()`
4. **Styles** : utiliser exclusivement les variables et composants existants
5. **Données** : modifier `defaultAnnee()` dans `data.js` si nécessaire + migration

---

## Conventions de code

### Nommage
- Variables/fonctions : `camelCase`
- Constantes globales : `MAJUSCULES_AVEC_TIRETS`
- IDs HTML : `kebab-case` (ex: `kpi-dghtotal`)
- Classes CSS : `kebab-case` (ex: `.kpi-card`)
- Modules JS : `PascalCase` (ex: `DGHData`, `Calculs`, `app`)

### Commentaires
- Chaque fonction publique doit avoir un commentaire JSDoc minimal
- Chaque section d'un fichier doit avoir un séparateur `// ──────`
- Les règles métier importantes (ORS, seuils) doivent citer leur source réglementaire

### Commits Git
```
feat: nom de la fonctionnalité ajoutée
fix: description du bug corrigé
refactor: ce qui a changé sans nouvelle fonctionnalité
docs: mise à jour README ou SKILL.md
style: changement CSS uniquement
```

---

## RGPD — Rappels permanents

- ❌ Jamais d'appel API externe avec des données enseignants
- ❌ Jamais de `console.log` avec des noms d'enseignants en production
- ✅ Les données nominatives restent en localStorage + fichier JSON local
- ✅ Le `.gitignore` exclut `data/` sauf `data/exemple.json`
- ✅ Si on ajoute une fonctionnalité IA (analyse par Claude API), les données doivent être **anonymisées avant envoi**

---

## Checklist avant chaque commit

- [ ] Les variables CSS sont utilisées (pas de couleurs hardcodées)
- [ ] Les données passent par `DGHData` (pas de `localStorage` direct)
- [ ] Les calculs restent dans `calculs.js` (pas dans `app.js`)
- [ ] Le fichier `data/exemple.json` est à jour si le schéma a changé
- [ ] `CHANGELOG.md` est mis à jour
- [ ] Aucune donnée réelle n'est committée

---

*Ce fichier fait partie intégrante du projet DGH App.*  
*Le mettre à jour à chaque évolution structurelle du projet.*
