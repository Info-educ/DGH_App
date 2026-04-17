# SKILL.md — Instructions de développement DGH App

> **À fournir à Claude au début de chaque session de développement.**
> Version courante : **3.4.0** — Dernière mise à jour : Sprint 7

---

## Contexte du projet

**DGH App** est une SPA de pilotage de la Dotation Globale Horaire pour collège.

- **Stack** : HTML5 + CSS3 + JS Vanilla — zéro framework, zéro build, zéro dépendance externe
- **Hébergement** : GitHub Pages ou fichier local (`index.html`)
- **Données** : `localStorage` + export/import JSON local — **aucun serveur, 100% RGPD**
- **Utilisateurs** : équipe de direction (principal + principal adjoint)

---

## ⚠️ RÈGLES DE QUALITÉ — NON NÉGOCIABLES

### 1. Lire avant d'écrire
Avant toute modification, **lire le fichier entier** avec le `view` tool.

### 2. Zéro code zombie
Aucun `id` HTML absent du JS, aucune variable en doublon, aucun bloc CSS en doublon.

### 3. Zéro onclick inline — UNE SEULE délégation globale

```js
// ✅ Correct — dans _onGlobalClick
if (e.target.closest('#btnAddDiv')) { DGHStructures.openModalDiv(null); return; }

// ❌ Interdit
document.getElementById('btnAddDiv').addEventListener('click', ...);
```

Boutons dynamiques → `data-action` capté dans `_onGlobalClick`.

### 4. Un fichier = une responsabilité stricte

| Fichier | Responsabilité | Interdit |
|---------|---------------|---------|
| `data.js` | SEUL fichier qui touche `localStorage` | DOM, calculs |
| `calculs.js` | Fonctions pures uniquement | DOM, `localStorage` |
| `app.js` | Contrôleur UI | `localStorage` direct |
| `style.css` | SEUL endroit pour les styles | `<style>` en JS |

### 5. Vérifications avant livraison
```bash
grep -n "onclick" index.html              # doit retourner vide
grep -rn "localStorage" assets/js/app.js # doit retourner vide (sauf thème)
grep -rn "localStorage" assets/js/calculs.js # doit retourner vide
```

### 6. Modifications Python — TOUJOURS écrire via .encode('utf-8')
Les fichiers JS contiennent des caractères Unicode. Toujours tester l'encodage avant écriture :
```python
content.encode('utf-8')  # lève UnicodeEncodeError si surrogate → corriger avant d'écrire
with open(path, 'w', encoding='utf-8') as f: f.write(content)
```

### 7. Jamais de `style="font-family:..."` inline dans les modules JS
Utiliser uniquement la classe CSS `.font-mono` pour la police monospace (définie dans `style.css`).
Toute valeur numérique DGH doit utiliser `.font-mono` — jamais d'attribut `style` pour la typographie.

---

## Architecture des fichiers

```
index.html              → SPA — toutes les vues dans des <section class="view">
assets/css/style.css    → Design system (variables CSS light/dark + tous les composants)
assets/js/data.js       → Couche données (localStorage, schéma, migrations, CRUD)
assets/js/calculs.js    → Moteur de calcul pur (ORS, DGH, besoins MEN, service enseignant)
assets/js/app.js        → Contrôleur UI (navigation, rendu vues, délégation événements)
assets/js/modules/
  dashboard.js          → DGHDashboard
  structures.js         → DGHStructures
  dotation.js           → DGHDotation
  hpc.js                → DGHHPC
  etab.js               → DGHEtab
  enseignants.js        → DGHEnseignants (3 vues : liste / par discipline / HPC)
data/exemple.json       → Données fictives anonymisées (schéma v3.3)
```

---

## Modèle de données — Schéma v3.4

```js
// EtablissementObject — v3.4
{
  nom, uai, academie, commune,
  typeEtab: 'college' | 'lycee'  // ← ajouté v3.4 (migration automatique)
}

// HPCObject — clé : enseignants[] remplace enseignantId depuis v3.3
{
  id, nom, categorie, disciplineId, classesIds,
  heures, effectif, typeHeure: 'hp'|'hsa',
  enseignants: [{ ensId: string, heures: number }],  // multi-affectation avec quotités
  commentaire
}

// EnseignantObject — clé : disciplines[] est la source de vérité
{
  id, nom, prenom, grade, statut,
  disciplines: [{ discNom: string, heures: number }], // heures par discipline
  disciplinePrincipale,  // = disciplines[0].discNom (compat)
  heures,                // = somme disciplines (calculé, maintenu par cohérence)
  orsManuel,             // null = utiliser ORS du grade; nombre = override
  commentaire            // spécificité ORS (décharge, temps partiel thérapeutique…)
}
```

### Migration obligatoire si schéma modifié
1. Ajouter le champ dans `_annee()` dans `data.js`
2. Ajouter la migration dans `_migrate()` avec vérification `=== undefined`
3. Incrémenter `VERSION` dans `data.js`
4. Mettre à jour `data/exemple.json`

---

## Concepts métier — À connaître absolument

### HP vs HSA — distinction fondamentale
- **H-Poste (HP)** : constituent les postes. Décidées par la DSDEN.
- **HSA** : heures supplémentaires payées. Budget CA. Ne constituent pas de postes.

### Service enseignant — modèle Option B (v3.3)

```
ORS (grade ou orsManuel)
  ├── HPC-HP  = heures HPC typées HP affectées à cet enseignant
  ├── H.dispo = ORS − HPC-HP   ← heures disponibles pour disciplines
  └── HP disc.= heures saisies "Par discipline" (doit rester ≤ H.dispo)

HSA = heures HPC typées HSA  (hors ORS)
Total = HP disc. + HPC-HP + HSA
```

**Implication** : les HPC-HP sont déduites de l'ORS avant les disciplines.
Un certifié (18h ORS) affecté à une Chorale HP 2h → 16h disponibles pour ses disciplines.

### `serviceTotalEnseignant(ens, hpcs)` — API publique de calculs.js

```js
// Retourne :
{
  hpDisc,      // HP disciplines (somme ens.disciplines[].heures)
  hpHPC,       // HP depuis HPC typées HP
  hpTotal,     // hpDisc + hpHPC
  hsaTotal,    // HSA depuis HPC typées HSA
  totalGeneral,// hpTotal + hsaTotal
  detailHSA,   // [{source, nom, heures}] — tooltip HSA
  detailHPCHp, // [{source, nom, heures}] — tooltip HPC-HP + déduction ORS vue discipline
  ors,         // ORS effectif (manuel ou grade)
  ecartORS,    // hpTotal - ors (null si sans-ors)
  statutORS    // 'sans-ors'|'hsa'|'sous-service'|'equilibre'
}
```

**Règle ORS** : tous les statuts peuvent avoir un ORS (BMP, TZR, temps-partiel avec orsManuel). Contractuel sans orsManuel → ORS=0 → pas d'écart.

### Vue liste — colonnes (v3.3)
`Nom | Prénom | Grade | Statut | Discipline(s) | ORS | HP disc. | HPC-HP | HSA | Dispo. | Actions`

- **ORS** : input inline éditable pour tous les statuts. Placeholder = ORS du grade. Vide = grade par défaut.
- **HP disc.** : heures disciplines (vert)
- **HPC-HP** : heures HPC-HP (orange/amber) — tooltip au survol liste les HPC concernées
- **HSA** : heures HSA (indigo) — tooltip au survol liste les sources
- **Dispo.** : ORS − HPC-HP (vert si positif, rouge si négatif)
- **Icône 💬** : apparaît si `ens.commentaire` renseigné — tooltip + clic → modal détail

### Vue Par discipline — colonnes (v3.3)
`Nom | Prénom | Grade | Statut | H.établ. | H.discipline | H.dispo. | Actions`

- **H.dispo.** = ORS − HPC-HP − somme toutes disciplines (ou H.établ. − disciplines si pas d'ORS)
- **⚡Xh HPC** : badge orange si HPC-HP présentes, tooltip liste les HPC

### Vue HPC (onglet H. Péda. Comp.) — colonnes (v3.3)
`Intitulé | Classe(s) | Discipline | Type | H/sem | Effectif | Enseignant(s)`

- Colonne Enseignant(s) toujours en DERNIÈRE position, alignée à droite
- Plusieurs enseignants par HPC avec quotités différentes
- Bouton + pour ajouter, ✕ individuel pour retirer

### HPC — schéma enseignants[]
```js
hpc.enseignants = [{ ensId: 'ens_xxx', heures: 2 }, { ensId: 'ens_yyy', heures: 1 }]
// Migration automatique : hpc.enseignantId (v3.2) → hpc.enseignants[] (v3.3)
```

### ORS — règles par statut
- Titulaire → ORS grade, modifiable
- BMP / TZR → ORS grade, modifiable (service partiel/complément)
- Temps partiel → orsManuel obligatoire
- Contractuel → orsManuel si renseigné, sinon ORS=0 → pas d'écart

---

## Design System

### Variables CSS
```css
--c-accent, --c-accent-hover, --c-accent-light   /* vert sauge — HP disc. */
--c-amber, --c-amber-bg                          /* orange — HPC-HP */
--c-indigo, --c-indigo-bg                        /* HSA */
--c-blue, --c-blue-bg                            /* info */
--c-green, --c-green-bg                          /* validation */
--c-red, --c-red-bg                              /* erreur */
--c-text, --c-text-muted, --c-text-dim
--c-surface, --c-surface2, --c-surface3
--c-border, --c-border2
```

### Classes CSS enseignants (v3.3)
```css
/* Vue liste */
.ens-service-hp          /* HP disc. — vert */
.ens-service-hpc-hp      /* HPC-HP — orange, cursor:help */
.ens-service-hsa-nonzero /* HSA non-zéro — indigo, cursor:help */
.ens-service-hsa-zero    /* HSA zéro — gris */
.ens-dispo-ok            /* Dispo positive — vert */
.ens-inline-ors          /* Input ORS inline */
.ens-ors-wrap            /* Wrapper ORS + icône 💬 */
.ens-comment-btn         /* Bouton icône 💬 */
.ens-ecart-hsa           /* Info HSA dans l'écart */

/* Vue HPC */
.ens-disc-table-hpc      /* Table 7 colonnes */
.hpc-col-ens             /* Dernière colonne enseignant, align right */
.hpc-ens-wrap            /* Flex wrapper, justify-content: flex-end */
.hpc-ens-tag             /* Tag individuel enseignant */
.hpc-ens-h               /* Quotité horaire dans le tag */
.hpc-ens-retirer         /* Bouton ✕ dans le tag */
.ens-disc-hpchp-info     /* Badge ⚡Xh HPC dans vue discipline */

/* Modal sélection enseignant */
.sel-ens-deja            /* "Actuel : Xh" dans la modal HPC */
.sel-ens-ors             /* Info ORS dans la modal */
```

### Typographie
- UI, titres, labels : `font-family: 'Outfit', sans-serif`
- Données chiffrées, valeurs DGH : `font-family: 'JetBrains Mono', monospace`

---

## API publique — data.js (v3.3)

```js
// HPC
DGHData.getHeuresPedaComp()     → [HPCObject]
DGHData.getHPC(id)              → HPCObject | null
DGHData.addHPC(fields)          → HPCObject  // fields.enseignants = [{ensId, heures}]
DGHData.updateHPC(id, fields)   → Boolean    // fields.enseignants = [{ensId, heures}]
DGHData.deleteHPC(id)           → Boolean

// Enseignants
DGHData.getEnseignants()        → [EnseignantObject] triés
DGHData.getEnseignant(id)       → EnseignantObject | null
DGHData.addEnseignant(fields)   → EnseignantObject
DGHData.updateEnseignant(id, fields) → Boolean
DGHData.deleteEnseignant(id)    → Boolean
DGHData.deleteAllEnseignants()  → number
DGHData.findEnseignantByNomPrenom(nom, prenom) → EnseignantObject | null
```

## API publique — calculs.js (v3.3)

```js
Calculs.serviceTotalEnseignant(ens, hpcs)
  → { hpDisc, hpHPC, hpTotal, hsaTotal, totalGeneral,
      detailHSA, detailHPCHp, ors, ecartORS, statutORS }

Calculs.detailEnseignant(ens)
  → { ors, heuresFait, ecart, hsa, sousService, statut, affichageEcart }

Calculs.bilanEnseignants(enseignants)
  → { nbEnseignants, totalHeures, nbSousService, nbHSA, nbEquilibre }

Calculs.bilanParDiscipline(enseignants, repartition, disciplines)
  → [{ disc, couleur, membres, heuresDisc, heuresDotation, ecart, dansDotation }]
```

---

## Délégation globale — actions liées aux enseignants (app.js)

```js
// Dans _onGlobalClick
'edit-ens'           → DGHEnseignants.openModalEns(id)
'delete-ens'         → DGHEnseignants.confirmDeleteEns(id)
'add-ens-disc'       → DGHEnseignants.openModalEnsDisc(disc)
'retirer-ens-disc'   → DGHEnseignants.retirerEnsDisc(id, disc)
'toggle-disc'        → DGHEnseignants.toggleDiscBloc(disc)
'toggle-all-disc'    → DGHEnseignants.toggleAllDiscs(open)
'affecter-ens-hpc'   → DGHEnseignants.openModalAffecterHPC(hpcId)
'retirer-ens-hpc'    → DGHEnseignants.retirerEnsHPC(hpcId, ensIdx)  // ensIdx = index dans enseignants[]
'toggle-hpc-cat'     → DGHEnseignants.toggleHPCCat(cat)
'toggle-all-hpc'     → DGHEnseignants.toggleAllHPC(open)

// Dans _onGlobalChange
'.ens-inline-select' → DGHEnseignants.handleInlineEdit(el)
'.ens-inline-num'    → DGHEnseignants.handleInlineEdit(el)  // inclut orsManuel
'.ens-inline-hdisc'  → DGHEnseignants.handleInlineEdit(el)

// Dans _onGlobalBlur (capture)
'.ens-inline-input'  → DGHEnseignants.handleInlineEdit(el)  // texte (nom, prenom)
```

---

## Prochains sprints — Conception validée

### Sprint 8 — Synthèses & exports
- Tableau de synthèse DGH pour le CA (format A4)
- Rapport par discipline : besoin / HP / HSA / enseignants
- Rapport par enseignant : service complet avec décomposition HP disc. / HPC-HP / HSA

### Sprint 9 — Historique pluriannuel
- Comparaison N vs N-1
- Graphiques SVG inline (sans bibliothèque)

---

## Checklist avant chaque livraison

- [ ] Tous les fichiers modifiés ont été **lus en entier** avant modification
- [ ] `grep -n "onclick" index.html` → vide
- [ ] `grep -n "localStorage" assets/js/app.js` → vide (sauf thème)
- [ ] `grep -n "localStorage" assets/js/calculs.js` → vide
- [ ] `grep -rn "font-family" assets/js/modules/` → vide
- [ ] `data/exemple.json` version = VERSION dans `data.js`
- [ ] Aucun `id` JS sans équivalent HTML
- [ ] Aucune couleur hardcodée dans le CSS
- [ ] `data/exemple.json` mis à jour si schéma modifié
- [ ] `CHANGELOG.md` mis à jour
- [ ] `VERSION` dans `data.js` incrémentée si schéma modifié
- [ ] Aucune donnée réelle committée
- [ ] **Encodage Python** : tester `.encode('utf-8')` avant écriture

---

## RGPD — Rappels permanents

- ❌ Jamais d'appel API externe avec des données nominatives
- ❌ Jamais de `console.log` avec des noms/données personnelles en production
- ✅ Données nominatives : `localStorage` + fichier JSON local uniquement

---

*Ce fichier fait partie intégrante du projet DGH App.*
*Le mettre à jour à chaque évolution structurelle.*
*Version : 3.4.0 — Dernière mise à jour : Sprint 7*
