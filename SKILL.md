# SKILL.md — Instructions de développement DGH App

> **À fournir à Claude au début de chaque session de développement.**
> Version courante : **4.2.0** — Dernière mise à jour : Sprint 12 (Répartition de service)

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
  structures.js         → DGHStructures (divisions + groupes référentiel, ppEnsId)
  dotation.js           → DGHDotation
  hpc.js                → DGHHPC
  etab.js               → DGHEtab
  enseignants.js        → DGHEnseignants (3 vues : liste / par discipline / HPC)
  repartition.js        → DGHRepartition (v4.2 : affectations classe×discipline, PP) ← NOUVEAU
  pilotage.js           → DGHPilotage (scénarios, récap, impact, synthèse)
  edt.js                → DGHEdt (barrettes, co-interventions)
  historique.js         → DGHHistorique (comparaison N/N-1, snapshots)
  missions.js           → DGHMissions (PACTE / IMP)
  instances.js          → DGHInstances (Synthèse CA, Dialogue, Services — impression/projection)
data/exemple.json       → Données fictives anonymisées (schéma v4.2)
```

### Ordre de chargement des scripts (index.html — app.js TOUJOURS en dernier)
```
data.js → calculs.js → dashboard.js → structures.js → dotation.js → hpc.js →
etab.js → enseignants.js → repartition.js → pilotage.js → edt.js →
historique.js → missions.js → instances.js → app.js
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

## Modèle de données — `ScenarioObject` (v3.5)

```js
// ScenarioObject
{
  id, nom, description, createdAt, updatedAt,
  actif: boolean,       // un seul actif à la fois
  modificateurs: [ModificateurObject]
}

// ModificateurObject — 3 types
// type:'dedoublement'    → { disciplineId, classeIds[], heuresParGroupe, commentaire }
// type:'co-enseignement' → { disciplineId, classeIds[], heuresParGroupe, commentaire }
// type:'projet'          → { nom, heuresHP, heuresHSA, commentaire }
```


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
*Version : 4.2.0 — Dernière mise à jour : Sprint 12*

## Modèle de données — Répartition de service (v4.2)

```js
// AffectationObject — annees[].affectations[]
{ id, divisionId, disciplineId, ensId, heures }
// Plusieurs affectations sur un même (divisionId, disciplineId) = classe partagée
// (co-titularité), ex : 4A Français = Mme Briant + Mme Forgeais.

// Division (structures[]) — champ ajouté v4.2
{ ..., ppEnsId }   // professeur principal de la classe (ensId | null)
```

### Règle d'or — heures de service dérivées (non destructif)
- Dès qu'il existe ≥ 1 affectation pour un couple (enseignant, discipline),
  `ens.disciplines[].heures` de cette discipline est **écrasé** par la somme des
  affectations (via `_recomputeHeuresFromAffectations` dans `data.js`).
- Sans affectation → la saisie manuelle (vue « Par discipline ») reste maîtresse.
- Conséquence : tout le reste de l'app (serviceTotalEnseignant, bilanParDiscipline,
  recapServices…) lit `ens.disciplines[].heures` **sans modification** — la dérivation
  est transparente. La vue « Par discipline » passe la cellule en lecture seule + badge « auto ».
- **Étape facultative** : pensée mai/juin (postes connus). Les scénarios de février
  fonctionnent sans aucune affectation. Ne jamais en faire un prérequis.

### Cascades obligatoires (déjà implémentées)
- `deleteDivision`   → supprime ses affectations.
- `deleteDiscipline` → supprime ses affectations.
- `deleteEnseignant` → supprime ses affectations, `ppEnsId` qui le réfèrent,
  ses entrées dans `hpc.enseignants[]` et dans `modificateur.affectations[]`, puis recalcule.

### API publique — data.js (v4.2)
```js
DGHData.getAffectations(annee?)                       // → [AffectationObject]
DGHData.getAffectationsCell(divisionId, disciplineId) // → [AffectationObject]
DGHData.getAffectationsEnseignant(ensId)              // → [AffectationObject]
DGHData.addAffectation({divisionId,disciplineId,ensId,heures})  // → AffectationObject|null
DGHData.updateAffectation(id, fields)                 // → boolean (recalcule)
DGHData.deleteAffectation(id)                         // → boolean (recalcule)
DGHData.setProfesseurPrincipal(divisionId, ensId)     // → boolean
DGHData.disciplinePiloteeParAffectation(ensId, discNom) // → boolean
```

### API publique — calculs.js (v4.2, fonctions pures)
```js
Calculs.heuresGrille(niveau, discNom)                 // → heures MEN (0 si hors grille)
Calculs.affectationsExistent(anneeData)               // → boolean
Calculs.profsDeClasseDiscipline(anneeData, disciplineId, classeIds) // → [ensId]
Calculs.grilleRepartition(anneeData)                  // → { divisions, disciplines, cells }
Calculs.controlesRepartition(anneeData)               // → [{severite, message, ref}]
```

### Délégation globale — Répartition (app.js)
```js
// _onGlobalClick — data-action
'rep-mode'    → DGHRepartition.setMode(mode)
'rep-del-aff' → DGHRepartition.deleteAff(id)
// _onGlobalChange — data-action
'rep-sel-disc'          → selectDiscipline(el)
'rep-sel-ens'           → selectEnseignant(el)
'rep-add'               → addFromSelect(el)        // select : ensId, data-division-id, data-discipline-id
'rep-add-disc-ens'      → addDiscToEns(el)
'rep-toggle-ens-classe' → toggleEnsClasse(el)
'rep-aff-h'             → setHeures(el)            // input number, data-id = affId
'rep-set-pp'            → setPP(el)                // select PP, data-division-id
```

### Intégration Pilotage (onglet Impact)- Si `Calculs.affectationsExistent(data)` → chaque modalité est **pré-cochée**
  sur les profs retournés par `profsDeClasseDiscipline(data, mod.disciplineId, mod.classeIds)`.
- `mod.affectations[]` (override manuel) reste prioritaire sur l'auto.
- Aucune écriture auto en base : l'auto n'est qu'un défaut d'affichage tant que
  l'utilisateur n'a pas coché/décoché (ce qui crée alors un `mod.affectations[]`).

## API publique — Scénarios (v3.5)

### `data.js` — Scénarios

```js
DGHData.getScenarios()                        // → [ScenarioObject]
DGHData.getScenario(id)                       // → ScenarioObject | null
DGHData.getScenarioActif()                    // → ScenarioObject | null
DGHData.addScenario(fields)                   // → ScenarioObject
DGHData.updateScenario(id, fields)            // → boolean
DGHData.deleteScenario(id)                    // → boolean
DGHData.dupliquerScenario(id)                 // → ScenarioObject | null
DGHData.setScenarioActif(id)                  // → void  (null = désactiver tous)

// Modificateurs
DGHData.addModificateur(scenarioId, fields)              // → ModificateurObject | null
DGHData.updateModificateur(scenarioId, modId, fields)    // → boolean
DGHData.deleteModificateur(scenarioId, modId)            // → boolean
```

### `calculs.js` — Scénarios

```js
Calculs.bilanScenario(anneeData, modificateurs)
  // → { coutHP, coutHSA, coutTotal, soldeBase, soldeSimule,
  //        enveloppe, depassement, detailParDisc, detailParMod }

Calculs.comparerScenarios(anneeData, scenarios)
  // → [{ scenario, bilan }]  // triés par soldeSimule décroissant
```

### Délégation globale — `app.js` (Sprint 8)

```js
// Dans _onGlobalClick — data-action
'add-mod'            → DGHPilotage.openModForm(type, scenId)
'save-mod'           → DGHPilotage.saveModificateur(scenId)
'cancel-mod'         → DGHPilotage.cancelModForm()
'delete-mod'         → DGHPilotage.deleteModificateur(scenId, modId)
'duplicate-scenario' → DGHPilotage.dupliquerScenario(id)
'delete-scenario'    → DGHPilotage.confirmDeleteScenario(id)
'set-actif-scenario' → DGHPilotage.setActif(id)
'#btnAddScenario'    → DGHPilotage.startNewScenario()
'#btnDesactiverScen' → DGHPilotage.desactiverScenario()

// Dans _onGlobalChange
'.mod-disc-select'   → DGHPilotage.previewImpact()
'.mod-classe-check'  → DGHPilotage.previewImpact()
'.mod-h-input'       → DGHPilotage.previewImpact()

// Dans _onGlobalBlur
'.scen-nom-input'    → DGHPilotage.saveNom(el)
```


## Scénarios — Mode Grille de saisie (v4.3)

L'onglet Scénarios propose deux modes de saisie des modalités (état `_scenViewMode` dans `pilotage.js`, bascule `data-action="scen-view-mode"`) :
- **Liste** : formulaire classique (1 modalité = 1 type + N classes).
- **Grille** : tableau disciplines (lignes) × classes (colonnes). Chaque case remplie = **une modalité mono-classe** `{ type, disciplineId, classeIds:[divId], heuresParGroupe, typeHeure }`.

Délégation (app.js) :
```
// change
'grid-cell-h'    → DGHPilotage.gridCellH(el)    // crée (>0) / met à jour / supprime (=0) la modalité ; data-scen-id, data-disc-id, data-div-id, [data-mod-id]
'grid-cell-type' → DGHPilotage.gridCellType(el) // change le type (data-mod-id requis)
'grid-cell-th'   → DGHPilotage.gridCellTH(el)   // change HP/HSA (data-mod-id requis)
// click
'scen-view-mode' → DGHPilotage.setScenView(mode)
```

Règles :
- La grille ne gère que les modalités **mono-classe** ; les multi-classes (vue Liste) sont comptées dans le bilan mais signalées comme éditables uniquement en Liste.
- Toute mutation appelle `_renderOngletScenarios()` + `renderBannerAndDashboard()` (rafraîchit bandeau actif + dashboard).
- Type par défaut à la création : `dedoublement` ; HP/HSA par défaut : `hsa`. Titre recalculé via `_titreModificateur`.

## Cache-busting des assets (v4.3.1)

`index.html` appelle tous les JS et le CSS avec un suffixe `?v=X.Y.Z` correspondant à la version courante. **À chaque release, incrémenter ce suffixe en même temps que les autres marqueurs de version** (data.js VERSION, footer index.html, exemple.json _meta.version). Sans cela, les navigateurs (et GitHub Pages) servent les anciens fichiers en cache → l'utilisateur ne voit pas les nouveautés après déploiement.

Checklist de version (à synchroniser à chaque release) :
1. `assets/js/data.js` → `const VERSION`
2. `index.html` → footer `<span>vX.Y.Z</span>`
3. `index.html` → suffixe `?v=X.Y.Z` sur chaque `<script>` et le `<link>` CSS
4. `data/exemple.json` → `_meta.version`
5. `README.md` → titre + badge
6. `CHANGELOG.md` → nouvelle entrée
