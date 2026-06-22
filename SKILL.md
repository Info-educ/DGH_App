# SKILL.md — Instructions de développement DGH App

> **À fournir à Claude au début de chaque session de développement.**
> Version courante : **4.16.1** — pastilles d'avancement par phase : `calculs.phaseStatuts(annee)` (fonction pure) déduit l'état (à faire / en cours / terminé) de chaque phase à partir des données réelles ; pastille colorée dans chaque en-tête de phase, rafraîchie à chaque navigation. (Précédent : CRUD équipe fixe en phase 1, v4.15.0. Le « parcours de l'année » est désormais complet.)

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

### 8. Modales — UNE SEULE convention d'affichage : `.modal-open`

`.modal-overlay` est `display:none` par défaut ; une modale ne s'affiche QUE via la classe `.modal-open`.

```js
// ✅ Correct — ouvrir / fermer
overlay.classList.add('modal-open');     // ouvrir
overlay.classList.remove('modal-open');  // fermer

// ❌ Interdit — n'a aucun effet d'affichage sur une modale
overlay.classList.remove('is-hidden');   // .modal-overlay reste display:none
```

- **Ne jamais** poser `is-hidden` sur un `.modal-overlay` (HTML ou JS). `.is-hidden` est `display:none !important` : combiné à `.modal-open`, le `!important` l'emporte et la modale reste invisible.
- Dans le HTML, un overlay de modale a `class="modal-overlay"` **seul** (jamais ` is-hidden`).
- Régression historique : `missions.js` (bouton « Ajouter une mission ») et `historique.js` (« Figer l'année » / « Supprimer snapshot ») utilisaient `is-hidden` → modales jamais ouvertes. Corrigé en v4.3.4.

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
  edt.js                → DGHEdt (barrettes avec fréquence A/B, co-interventions,
                          indisponibilités enseignants, contraintes libres, notice EDT)
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

### Bascule automatique HP → HSA (v4.9.6 — Sprint 19) — RÈGLE CENTRALE
L'apport de chaque enseignant dans l'établissement compte en **heures-poste
jusqu'à son seuil**. Tout dépassement bascule **automatiquement en HSA**.
Aucune ressaisie : un seul chiffre d'apport pilote HP et HSA partout.

```
apportPoste = somme(disciplines.heures) + somme(HPC typées 'hp')
seuil       = plafondHP(ens)        ← voir ci-dessous
HP  = min(apportPoste, seuil)
HSA = max(0, apportPoste − seuil)  +  HPC typées 'hsa' (forçage explicite)
```

### `plafondHP(ens)` — seuil HP par statut (v4.9.6)
```js
// Retourne { plafond:Number, source:'bmp'|'ors-manuel'|'ors-grade'|'aucun' }
```
- **BMP** : seuil = `ens.volumeBMP` (volume du bloc implanté). BMP 15h → 15h HP max.
- ORS manuelle saisie (`ens.orsManuel`) : seuil = cette valeur. **Motif obligatoire**
  (`ens.motifORS`) dès qu'elle diffère de l'ORS du grade — tracé pour la TRM.
- Sinon : seuil = ORS du grade (18 certifié, 15 agrégé, 17 PLP, 20 EPS).
- Contractuel sans seuil → tout reste HP, pas de bascule.

### `serviceTotalEnseignant(ens, hpcs)` — API publique de calculs.js (v4.9.6)

```js
// Retourne :
{
  hpDisc,       // part disciplines imputée en HP (≤ seuil)
  hpHPC,        // part HPC-HP imputée en HP (hpTotal − hpDisc)
  hpTotal,      // HP total = min(apportPoste, seuil)
  hsaAuto,      // HSA issue du dépassement d'apport
  hsaForce,     // HSA issue des HPC typées 'hsa'
  hsaTotal,     // hsaAuto + hsaForce
  apportPoste,  // disciplines + HPC-HP (avant plafonnement)
  totalGeneral, // hpTotal + hsaTotal
  detailHSA,    // [{source, nom, heures}] — tooltip HSA (dépassement + HPC HSA)
  detailHPCHp,  // [{source, nom, heures}] — tooltip HPC-HP
  ors,          // seuil HP effectif (= plafondHP.plafond)
  plafondSource,// 'bmp'|'ors-manuel'|'ors-grade'|'aucun'
  ecartORS,     // apportPoste − seuil (null si sans seuil)
  statutORS     // 'sans-ors'|'hsa'|'sous-service'|'equilibre'
}
```

### `bilanEquipe(enseignants, hpcs)` — agrégat établissement (v4.9.6)
Source de vérité pour la remontée TRM. Retourne `{ nbEns, totalHP, totalHSA,
totalGeneral, parStatut:[{statut,nb,hp,hsa}], rows:[…] }`. Intégré à
`bilanDotation` via `equipeHP`, `equipeHSA`, `equipeTotal`, `soldeEquipe`.

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
- BMP → **volume du bloc** (`volumeBMP`) = seuil HP (Sprint 19)
- TZR → ORS grade, modifiable
- Temps partiel → orsManuel obligatoire
- Contractuel → orsManuel si renseigné, sinon ORS=0 → pas d'écart
- Toute ORS dérogatoire (≠ ORS du grade) → `motifORS` obligatoire (Sprint 19)

### Vue « Équipe & HP/HSA » (Cadre de l'année) — `DGHEquipe` (v4.9.6)
- Fichier : `assets/js/modules/equipe.js` — `renderEquipe()`, `exporterCSV()`
- Vue : `#view-equipe` · nav `data-view="equipe"` · router dans `app.js`
- Tableau : Nom | Statut | Discipline | Apport | Seuil HP | HP | HSA | Répartition
- KPI : HP équipe, HSA équipe, Total service, solde vs enveloppe
- Bandeau par statut (`bilanEquipe.parStatut`), export CSV « TRM »
- Carte miroir sur le dashboard : `#dashEquipeCard` (`_renderEquipeCard`)
- Champs fiche enseignant ajoutés : `#inputEnsVolumeBMP` (visible si statut=bmp),
  `#inputEnsMotifORS` (visible si ORS ≠ grade). Aperçu HP/HSA live.

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

## Sprints réalisés (historique condensé)

- Sprint 8 — Synthèses & exports (Synthèse CA, Dialogue de gestion, Services enseignants)
- Sprint 9 — Historique pluriannuel (comparaison N/N-1, snapshots)
- Sprint 10 — Comparaison N/N-1 figée, KPI delta
- Sprint 11 — PACTE/IMP, référentiel Groupes
- Sprint 12 — Répartition de service (affectations classe×discipline→enseignant, PP)
- Sprint 13 — Dashboard scénario-aware, gauges HP/HSA, saisie en grille
- **Sprint 14 (v4.8.0) — Préparation EDT** : voir section dédiée ci-dessous

## Sprints futurs — Conception à valider lors d'une prochaine session

### Dette technique connue — CSS dupliqué (audité v4.16.1)
`style.css` contient **146 sélecteurs redéfinis dans le même contexte** (tous en
contexte `BASE`, pas des variantes thème/impression). Audit de v4.16.1 :
- **~81 occurrences = copies exactes** (mêmes propriétés, mêmes valeurs) → la 2ᵉ est
  redondante, la supprimer serait *render-neutre*.
- **~92 occurrences = surcharges porteuses** : soit valeurs divergentes (la dernière
  l'emporte par cascade — ex. `.scen-tableau th`, `.scen-form-grid`), soit ajout de
  propriétés uniques (souvent `font-family` sur cellules chiffrées — ex. `.dot-theorique`,
  `.dot-input-h`, `.ens-onglet` défini 3×). **Ces blocs sont vivants : ne pas les retirer.**

Régions principalement concernées : bloc `.dot-*` (≈ L829-936 dupliqué partiellement
L950-1014), bloc `.scen-*` (≈ L2608-2928 vs L3308-3816, parfois en triple), onglets
`.ens-onglet*` (L1917/2136/2204).

**Règle de traitement (haut risque — cf. §2 « CSS = haut risque ») :** aucun retrait en
masse. Les copies exactes et les surcharges porteuses sont **entrelacées** dans chaque
région ; il n'existe aucun bloc entier supprimable d'un coup. Consolider **opportunément**,
sélecteur par sélecteur, **uniquement** quand on édite déjà la section concernée, en
vérifiant propriété par propriété qu'aucune règle unique n'est perdue, puis **QA visuelle
en navigateur réel** (la simulation Node ne rend pas le CSS). Outil d'audit reproductible :
le script `css_audit` / `css_classify` utilisé en v4.16.1 (suit la pile `@media`/`@supports`
par comptage d'accolades et compare les jeux de propriétés).

### Dispositifs spécialisés SEGPA / ULIS / UPE2A
Grilles MEN spécifiques non implémentées. Contraintes EDT propres à ces dispositifs
(enseignants partagés avec d'autres établissements, horaires AESH, emplois du temps
individualisés) — actuellement hors périmètre, à concevoir avec JB le jour où
l'établissement ouvre l'un de ces dispositifs.

### Scénario → contraintes EDT (conversion automatique)
Convertir un modificateur de scénario (dédoublement, co-enseignement) en barrette EDT
pré-remplie depuis l'onglet Impact du Pilotage, pour éviter la double saisie entre
simulation budgétaire et préparation EDT. Nécessite de définir précisément le mapping
type de modificateur → structure de slots.

### Tests automatisés sur calculs.js
Aucun test unitaire formalisé à ce jour (risque identifié). Les fonctions pures de
calculs.js sont testables sans DOM ; un harnais Node simple (comme ceux utilisés en
cours de développement du Sprint 14) pourrait être committé sous `tests/`.

---

## Préparation EDT (Sprint 14 / v4.8.0)

### Contexte métier
L'objectif n'est pas de remplacer Index Éducation mais de **centraliser avant la saisie**
tout ce que le PERDIR doit avoir sous les yeux pour poser un EDT sans rien oublier :
contraintes élèves (salles spécialisées), contraintes enseignants (indisponibilités),
puis barrettes. Aucun export technique vers EDT n'existe : Index Éducation ne propose
pas d'import de fichier externe pour les indisponibilités — seule la notice imprimable
a de la valeur.

### Modèle de données ajouté

```js
// EtablissementObject — champs ajoutés v4.8.0
{
  ...,
  salles: [{ id, nom, type, capacite, nb }],
  // type: 'svt'|'physique'|'musique'|'arts'|'techno'|'gym'|'autre'
  // nb = nombre d'exemplaires disponibles (sert à la détection de saturation)
  heuresBleues: { actif: boolean, creneaux: [{jour, debut, fin}], commentaire }
  // 1 à 4 créneaux candidats ; recommandation calculée par Calculs.creneauBleuOptimal
}

// contraintesEDT — champs ajoutés v4.8.0 (annees[].contraintesEDT)
{
  barrettes: [...],       // existant — chaque slot a désormais .frequence
  coInterventions: [...], // existant, inchangé
  indisponibilites: [
    { id, ensId, type:'dure'|'souple', jour, plage:'matin'|'aprem'|'journee'|'creneau',
      heureDebut, heureFin, motif }
  ],
  contraintesLibres: [
    { id, titre, jour, heureDebut, heureFin, scope:'etablissement'|'classe'|'groupe',
      classeIds[], ensIds[], commentaire }
  ]
}

// BarretteSlot — champ ajouté v4.8.0
{ type, ref, nomLibre, ensIds[], frequence: 'hebdo'|'semaine-A'|'semaine-B' }
// hebdo = toutes les semaines. La fréquence se règle PAR SLOT (pas sur la barrette),
// pour permettre par ex. Gr.1 SVT semaine-A / Gr.1 PC semaine-B sur le même groupe.
```

⚠️ Historique : un champ `contraintesEDT.indisponibilites` avait été retiré en v3.8
("gérées directement dans Index Éducation"). Le schéma v4.8.0 le réintroduit avec une
structure différente (dure/souple + créneaux) — ce n'est pas une régression, c'est une
fonctionnalité repensée avec un objet de données distinct.

### Onglets du module EDT (4, contre 3 avant v4.8.0)
1. **Barrettes** — inchangé dans sa logique, slot enrichi du sélecteur de fréquence
2. **Co-interventions** — inchangé
3. **Indisponibilités** — *nouveau* : indispos enseignants (dure/souple) + contraintes
   libres (ex. orchestre/conservatoire, concerne classes ET/OU enseignants)
4. **Notice EDT** — *remplace* l'ancienne « Fiche synthèse ». 7 sections dans l'ordre du
   flux réel de préparation : alertes → cadre général (dont heure bleue retenue) →
   salles → contraintes enseignants → contraintes libres → barrettes → co-interventions

### Salles & heure bleue — gérées dans la modale Établissement, pas dans le module EDT
Nouvel onglet modale **« Salles & Heure bleue »** (`DGHEtab.renderSalles` /
`renderHeuresBleues`). Choix architectural : les salles et l'heure bleue sont des
propriétés de l'établissement (stables d'une année sur l'autre), pas de l'année
scolaire — cohérent avec leur emplacement dans `_data.etablissement`, pas dans
`_annee()`.

### Heure bleue — recommandation de créneau optimal
`Calculs.creneauBleuOptimal(enseignants, indisponibilites, contraintesLibres, creneaux)`
calcule pour chaque créneau candidat un score = nb_enseignants_total −
nb_indisponibles_durs − (nb_vœux_souples × 0.5), classe les créneaux, et marque le
meilleur `optimal`. **Limite assumée et affichée à l'utilisateur** : ce score ignore les
cours déjà posés dans Index Éducation (donnée non disponible côté DGH App) — c'est une
recommandation sur les seules contraintes saisies, jamais une certitude.

### Détection de conflits — `Calculs.controlesEDT(anneeData, etab)`
Fonction pure, retourne `[{severite, categorie, message, ref}]` :
- **Conflit de barrette** : même enseignant dans 2 slots dont les fréquences se
  chevauchent (hebdo entre en conflit avec tout ; semaine-A ne conflicte qu'avec
  hebdo/semaine-A — jamais avec semaine-B)
- **Salle saturée** : nombre de slots simultanés sur une discipline associée à un type
  de salle (SVT/Physique/Musique/Arts/Techno/Gym) supérieur au nombre d'exemplaires
  disponibles dans `etab.salles`
- **Indisponibilité suspecte** : enseignant marqué indisponible la journée entière sur
  les 5 jours (signal probable d'erreur de saisie)

### API publique ajoutée — `data.js`
```js
DGHData.getTypesSalle() / getJoursSemaine()           // → constantes UI
DGHData.getSalles() / getSalle(id)
DGHData.addSalle / updateSalle / deleteSalle(fields|id)
DGHData.getHeuresBleues() / setHeuresBleues(fields)
DGHData.getIndisponibilites(annee?) / getIndisponibilitesEnseignant(ensId, annee?)
DGHData.addIndisponibilite / updateIndisponibilite / deleteIndisponibilite
DGHData.getContraintesLibres(annee?)
DGHData.addContrainteLibre / updateContrainteLibre / deleteContrainteLibre
```
Cascades : `deleteEnseignant` nettoie désormais aussi ses indisponibilités, ses
références dans `contraintesLibres.ensIds`, les slots de barrettes et les
co-interventions. `deleteDivision` nettoie `contraintesLibres.classeIds` et
`coInterventions.classeIds`.

### API publique ajoutée — `calculs.js`
```js
Calculs.controlesEDT(anneeData, etab)               // → [{severite, categorie, message, ref}]
Calculs.creneauBleuOptimal(enseignants, indispos, contraintesLibres, creneaux)
  // → [{ jour, debut, fin, jourLabel, nbTotal, nbDisponibles,
  //      indisponiblesDurs[], voeuxSouples[], score, recommandation }]
  // recommandation: 'optimal' | 'correct' | 'deconseille'
```

### Délégation globale ajoutée — `app.js`
```js
// _onGlobalClick — data-action
'salle-add' | 'salle-edit' | 'salle-save' | 'salle-cancel' | 'salle-delete'
  → DGHEtab.*Salle(...)
'hb-add-creneau' | 'hb-remove-creneau' | 'hb-calculer' → DGHEtab.hb*(...)
'edt-edit-indispo' | 'edt-save-indispo' | 'edt-cancel-indispo' | 'edt-delete-indispo'
  → DGHEdt.*Indispo(...)
'edt-edit-clibre' | 'edt-save-clibre' | 'edt-cancel-clibre' | 'edt-delete-clibre'
  → DGHEdt.*Clibre(...)

// _onGlobalChange
'inputHBActif' (id)                          → DGHEtab.hbToggleActif(checked)
'edt-indispo-plage-change' (data-action)     → DGHEdt.onIndispoPlageChange()

// Boutons statiques (_onGlobalClick)
'#btnAddIndispo' → DGHEdt.startAddIndispo()
'#btnAddClibre'  → DGHEdt.startAddClibre()
```

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
- [ ] Pour tout nouveau rendu HTML généré en JS (onglets, formulaires) : test fonctionnel
      avec un DOM minimal simulé en Node (`getElementById`/`innerHTML` factices) avant
      livraison — `node --check` ne détecte pas les erreurs d'exécution comme un nom de
      fonction interne incorrect (ex. router d'onglet appelant une fonction renommée)

### Tests automatisés à lancer avant livraison
```bash
node tests/check-version.js   # cohérence des marqueurs de version
node tests/test-service.js    # moteur de calcul (cas de verifs.js)
node tests/test-import.js     # compatibilité ascendante de l'import / migration
node tests/test-phases.js     # avancement par phase (Calculs.phaseStatuts)
```
Les trois doivent renvoyer exit 0. `test-import.js` rejoue l'import d'un vrai fichier
ancien (`tests/fixtures/legacy-4.8.0.json`) dans le schéma courant : c'est le filet qui
garantit qu'aucun sprint futur ne casse la relecture des données déjà enregistrées par
les utilisateurs. **Ne jamais supprimer la fixture** ; en ajouter une nouvelle à chaque
changement de schéma majeur (`legacy-<version>.json`).

---

## RGPD — Rappels permanents

- ❌ Jamais d'appel API externe avec des données nominatives
- ❌ Jamais de `console.log` avec des noms/données personnelles en production
- ✅ Données nominatives : `localStorage` + fichier JSON local uniquement

---

*Ce fichier fait partie intégrante du projet DGH App.*
*Le mettre à jour à chaque évolution structurelle.*
*Version : 4.16.1 — Dernière mise à jour : correctif heure bleue (grille) + purge du code mort EDT*

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

### Délégation globale — `app.js` (scénarios)

```js
// Dans _onGlobalClick — data-action
'delete-mod'         → DGHPilotage.deleteModificateur(scenId, modId)  // suppr. modalité (grille à 0, ou liste de nettoyage multi-classes)
'edit-scenario'      → DGHPilotage.toggleEditScenario(id)            // déplie/replie l'accordéon (= ouvre la grille)
'duplicate-scenario' → DGHPilotage.dupliquerScenario(id)
'delete-scenario'    → DGHPilotage.confirmDeleteScenario(id)
'set-actif-scenario' → DGHPilotage.setActif(id)
'#btnAddScenario'    → DGHPilotage.startNewScenario()
'#btnDesactiverScen' → DGHPilotage.desactiverScenario()

// Dans _onGlobalBlur
'.scen-nom-input'    → DGHPilotage.saveNom(el)
```

> ⚠️ v4.4.0 : le mode **Liste** a été supprimé. Les handlers `add-mod`, `save-mod`, `cancel-mod`, `edit-mod`, `save-edit-mod`, `cancel-edit-mod`, `scen-view-mode`, `mod-sel-niv` et les change-handlers `mod-*` n'existent plus. Ne pas les réintroduire sans réintroduire la vue Liste.


## Scénarios — Saisie en grille + encart multi-classes (v4.5)

Déplier un scénario (▼) ouvre :
1. **Encart « Aménagement multi-classes »** (au-dessus) — pour les modalités couvrant ≥ 2 classes : groupes de besoins inter-classes, dédoublement multi-classes, barrettes. Sélection par cases à cocher groupées par niveau. Minimum 2 classes requis.
2. **Grille** (en-dessous) — tableau disciplines × classes, une case = une modalité mono-classe.

Délégation (app.js) :
```
// _onGlobalClick — data-action
'save-mc'       → DGHPilotage.saveMultiClasse(scenId)      // ajoute modalité multi-classes
'mc-sel-niv'    → DGHPilotage.mcSelectNiveau(btn)           // sélection rapide par niveau (btn.dataset.niveau = niv | 'all' | 'none')
'delete-mod'    → DGHPilotage.deleteModificateur(scenId, modId)  // supprime toute modalité (grille à 0 ou bouton ✕ encart)

// _onGlobalChange (déclenché par CLASSE CSS)
'.grid-h'       → DGHPilotage.gridCellH(el)    // crée (>0) / màj / supprime (=0) mono-classe
'.grid-type'    → DGHPilotage.gridCellType(el)  // change le type
'.grid-th'      → DGHPilotage.gridCellTH(el)    // change HP/HSA

// _onGlobalBlur
'.scen-nom-input' → DGHPilotage.saveNom(el)
```

Règles :
- Encart : au moins 2 classes. Une seule classe = relève de la grille.
- Grille : 1 case = 1 classe × 1 discipline (mono-classe uniquement).
- Les modalités multi-classes existantes apparaissent dans la `mc-liste` sous le formulaire de l'encart (pas dans la grille).
- Toute mutation appelle `_renderOngletScenarios()` + `renderBannerAndDashboard()`.
- Type par défaut encart : `groupes-besoins` ; type par défaut grille : `dedoublement` ; HP/HSA par défaut : `hsa`.

## Cache-busting des assets (v4.3.1)

`index.html` appelle tous les JS et le CSS avec un suffixe `?v=X.Y.Z` correspondant à la version courante. **À chaque release, incrémenter ce suffixe en même temps que les autres marqueurs de version** (data.js VERSION, footer index.html, exemple.json _meta.version). Sans cela, les navigateurs (et GitHub Pages) servent les anciens fichiers en cache → l'utilisateur ne voit pas les nouveautés après déploiement.

Checklist de version (à synchroniser à chaque release) :
1. `assets/js/data.js` → `const VERSION`
2. `index.html` → footer `<span>vX.Y.Z</span>`
3. `index.html` → suffixe `?v=X.Y.Z` sur chaque `<script>` et le `<link>` CSS
4. `data/exemple.json` → `_meta.version`
5. `README.md` → titre + badge
6. `CHANGELOG.md` → nouvelle entrée
7. `assets/js/tutorial.js` → `CONTENT_VER` **uniquement si le contenu d'aide a changé** (sinon laisser tel quel — incrémenter inutilement reproposerait l'aide à tous les utilisateurs sans raison)

**Garde-fou automatique** — après toute mise à jour de version, exécuter :
```bash
node tests/check-version.js   # exit 0 si tous les marqueurs concordent, exit 1 sinon
```
Ce script prend `const VERSION` de `data.js` comme source de vérité et vérifie le footer, tous les suffixes `?v=`, `exemple.json`, le titre + badge du README, la dernière entrée du CHANGELOG et la ligne « Version courante » du SKILL. **Aucune livraison ne doit sortir avec un exit 1.**

## Aide contextuelle embarquée — `tutorial.js` (v4.6.0)

Module **100 % autonome** : accompagnement utilisateur uniquement. Chargé **après `app.js`**.

### Règles propres au module
- **Stockage** : une seule clé `localStorage 'dgh-tutorial'`, gérée *dans* `tutorial.js`. Contenu UI uniquement (`enabled`, `welcomeDone`, `tourDone`, `seen{}`) → **ZÉRO donnée personnelle**. Exception documentée, même statut que `dgh-theme`. Ne jamais y stocker de données métier ni nominatives.
- **Délégation** : UNE seule délégation de clic sur l'arbre du module, via l'attribut **`data-help-action`** (distinct de `data-action` de l'app). Aucun `onclick` inline. **Ne pas** router l'aide par `_onGlobalClick` de `app.js`.
- **Couplage** : `app.js` n'est **pas** modifié. Le module observe la vue active par `MutationObserver` sur `.view` et réutilise `app.navigate()`. L'aide situationnelle écoute l'événement `dgh:storage-error` déjà émis par `data.js`.
- **Styles** : tout dans la section « AIDE CONTEXTUELLE EMBARQUÉE » de `style.css`, 100 % variables de thème. Le seul `style` inline JS autorisé concerne la **géométrie** du spotlight/carte de visite (positionnement), jamais la typographie ni les couleurs.

### Ajouter l'aide d'un nouvel onglet
1. Ajouter une entrée dans l'objet `HELP` de `tutorial.js` : `vueId: { titre, quoi, pourquoi, neFaitPas, siBloque }`.
2. Rien d'autre : la pop-up s'affiche automatiquement à la première visite de la vue.
3. Rédaction : ton direct, non technique, phrases courtes, **≤ 5 lignes** par message. Toujours renseigner les 4 champs (dont « si ça bloque » → jamais de cul-de-sac).

### Reproposer l'aide après une refonte du contenu
Incrémenter `CONTENT_VER` dans `tutorial.js` : réinitialise `seen{}` en conservant le choix `enabled` de l'utilisateur.
