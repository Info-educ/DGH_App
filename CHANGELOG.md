# Changelog — DGH App

Toutes les modifications notables sont documentées ici.  
Format : [Semantic Versioning](https://semver.org/) — `MAJEUR.MINEUR.CORRECTIF`

---

## v4.3.1 — Cache-busting des fichiers (2026-06-13)

### Corrigé
- **Anti-cache navigateur** : tous les fichiers JS et le CSS sont désormais appelés avec un suffixe `?v=4.3.1` dans `index.html`. Après chaque déploiement (GitHub Pages), le navigateur recharge automatiquement les fichiers à jour au lieu de servir une version mise en cache. C'est la cause la plus fréquente de « je ne vois pas les dernières fonctionnalités après mise à jour ».
- **Rappel** : ce suffixe doit être incrémenté à chaque release (voir checklist de version dans SKILL.md).

### Note de diagnostic
- Les jauges HP/HSA ne s'affichent que si la **dotation (enveloppe HP + HSA)** est renseignée dans le module Dotation — sinon le bloc reste masqué (comportement inchangé).
- La grille de saisie des scénarios apparaît dans **Pilotage → déplier un scénario (▼) → bouton ▦ Grille**.

---

### Nouveau
- **Mode Grille** dans l'onglet Scénarios (bascule Liste / Grille) : tableau **disciplines en lignes × classes en colonnes**. Chaque case = un nombre d'heures + un **type** de modalité (Déd. / Co-ens. / G.E.R. / G.B.I. / Autre) + **HP/HSA**, tous réglables par case.
  - Taper des heures dans une case crée la modalité (dédoublement par défaut) ; la passer à 0 la supprime.
  - Colonne Σ par discipline ; impact sur la dotation mis à jour en direct dans l'en-tête du panneau.
  - Les modalités multi-classes (créées en vue Liste) restent comptées et éditables en vue Liste ; un repère l'indique.
- La saisie en grille rafraîchit immédiatement le bandeau scénario et le tableau de bord si le scénario est actif.

---

### Amélioré
- **Tableau de bord** : l'encart HP/HSA devient deux **jauges visuelles** distinctes au format demandé — *Dotation / Consommé / Marge* — avec pourcentage de consommation, barre colorée selon l'état (vert : marge ; ambre : marge nulle ; rouge : dépassement) et la marge signée mise en évidence.
- **Surcouche simulation** : si un scénario est actif, chaque jauge affiche un repère ⊕ à la position de consommation simulée et une ligne « avec scénario : consommé X h · marge Y h ».

---

### Amélioré
- **Tableau de bord** : le bandeau « Scénario actif » est enrichi — nom, coût (HP/HSA), et **solde de référence → solde simulé** avec l'écart. Le sous-titre du KPI *Solde disponible* affiche désormais le solde simulé, et son infobulle détaille le coût et le solde simulés.
- **Synthèse CA** : ajout d'un bloc « Scénario en simulation » (coût, total et solde simulés) clairement étiqueté. La répartition par discipline reste fondée sur la ventilation de référence (votée) — la simulation est une surcouche explicite, jamais un écrasement silencieux.
- **Onglet Scénarios** : le panneau d'édition d'un scénario affiche en en-tête l'**impact courant sur la dotation** (solde réf. → solde simulé + écart), mis à jour au fil de l'ajout des modalités — pour savoir immédiatement où en est la ventilation.

### Note
- Aucun changement de schéma de données (les figures « de référence » de la dotation restent inchangées ; le scénario est affiché en parallèle, avec mention « simulation »).

---

### Nouveau module — Répartition de service
- **Affectation classe × discipline → enseignant** : on attribue chaque classe à un enseignant pour une discipline (ex : 6eA en Maths → M. Petit, 4eB en Maths → Mme Bodeau)
- **Deux modes de saisie** (bascule au choix) :
  - *Par discipline* : on choisit une discipline → toutes les classes → un enseignant par classe
  - *Par enseignant* : on choisit un enseignant → on coche ses classes par discipline
- **Classe partagée** : plusieurs enseignants d'une même discipline sur une même classe (ex : 4A Français = Mme Briant + Mme Forgeais), avec répartition des heures
- **Heures pré-remplies** depuis la grille réglementaire MEN du niveau (ajustables) — saisie minimale
- **Professeurs principaux** : désignation par classe, parmi les enseignants affectés ; le PP est marqué « responsable » (★) sur sa discipline dans la grille
- **Grille récapitulative** classe × discipline (lecture seule)
- **Contrôles de cohérence** : classes sans enseignant sur une discipline attendue, écart aux heures grille, classes sans PP

### Propagation automatique (zéro double saisie)
- Les **heures de service par discipline** sont désormais **recalculées automatiquement** à partir des affectations dès qu'il en existe ; sinon la saisie manuelle reste maîtresse (non destructif). La vue « Par discipline » de l'équipe affiche un badge « auto » en lecture seule
- **Pilotage / onglet Impact** : les modalités (dédoublement, co-enseignement, groupe à effectif réduit…) sont **pré-attribuées automatiquement** au(x) professeur(s) de la classe concernée, avec surcharge manuelle possible
- Étape **facultative** : pensée pour mai/juin (après vote du CA, postes connus) — les scénarios de février continuent de fonctionner sans aucune affectation

### Données & schéma
- Nouvel objet `AffectationObject` `{ id, divisionId, disciplineId, ensId, heures }` (tableau `annees[].affectations[]`)
- Champ `ppEnsId` sur chaque division (professeur principal)
- Migration automatique v4.2 + nettoyage des affectations orphelines (références supprimées)
- Cascades de suppression : supprimer une division / discipline / enseignant nettoie les affectations, le PP et les affectations d'impact des scénarios
- **Correction de la dérive de version** : `data.js`, `index.html`, `data/exemple.json` synchronisés sur **4.2.0**

### Technique
- Nouveau module `assets/js/modules/repartition.js` (`DGHRepartition`)
- `calculs.js` : `heuresGrille`, `affectationsExistent`, `profsDeClasseDiscipline`, `grilleRepartition`, `controlesRepartition`
- `data.js` : CRUD affectations, `setProfesseurPrincipal`, recalcul `_recomputeHeuresFromAffectations`, `disciplinePiloteeParAffectation`
- Nouvelle entrée de menu « Répartition de service » (section Équipe) + vue + délégation d'événements

---

### Nouveau
- **⬇ Exporter Excel** : export CSV (séparateur `;`, BOM UTF-8, décimales à virgule — ouverture native dans Excel français, zéro dépendance, 100% local/RGPD)
  - Module **Dotation** : enveloppe, tableau complet par discipline (besoin réel/MEN, HP, HSA, écart, groupes, commentaires) + liste des HPC
  - Module **Instances** : export de l'onglet actif — Services enseignants (service complet par enseignant avec ORS, écart, Pacte/IMP), Synthèse CA, Dialogue de gestion
- Nouvel utilitaire public `app.downloadCSV(filename, rows)` (app.js)
- Nouvelles actions globales : `dot-export-csv`, `inst-export-csv`

---

## v4.0.1 — Lot P1 : corrections réglementaires & fiabilité (2026-06-10)

### Réglementaire
- **Grilles MEN corrigées** (arrêté du 19 mai 2015 modifié, en vigueur 2025-2026) :
  - 6e : EPS 4h (au lieu de 3h) ; sciences globalisées SVT 1,5h + Physique-Chimie 1,5h (la ligne « Sciences et Technologie » 6e est supprimée) ; total 25h (arrêté du 4 avril 2025)
  - HG-EMC : la ligne réglementaire unique (3h / 3h / 3h / 3,5h dont 0,5h EMC) est répartie HG 2,5h (3h en 3e) + EMC 0,5h — fin du double compte de 0,5h/division
  - 3e : Mathématiques 3,5h (au lieu de 4h)
  - AP retiré du besoin théorique (modalité prise dans les heures obligatoires) ; la discipline AP reste disponible pour la ventilation
- Note réglementaire HG-EMC affichée sous le tableau Dotation (`.dot-note-reglementaire`)

### Bugs corrigés
- `Calculs.ORS.contractuel` : 18 → 0, conforme au comportement documenté (ORS = quotité contractuelle via orsManuel)
- `genererAlertes` : les heures allouées intègrent désormais les HPC — alertes de dépassement cohérentes avec le solde du dashboard
- `importJSON` : acceptation par extension `.json` (file.type est souvent vide sous Windows/Firefox) — l'import de sauvegardes fonctionne sur tous les navigateurs

---

## v3.5.0 — Sprint 8 : Module Pilotage pédagogique (2026-04-18)

### Nouveau module
- **Pilotage pédagogique** : simulation de scénarios DGH (S8-01 à S8-07)
  - Scénarios nommés avec 3 types de modificateurs : dédoublement, co-enseignement, projet
  - Calcul d'impact en temps réel avant validation (preview instantané)
  - Comparateur côte à côte : solde simulé par scénario, détail par discipline
  - Scénario actif : bandeau dans le dashboard et dans le module Pilotage
  - Duplication de scénario en 1 clic

### Données
- `scenarios[]` remplace `simulation` (stub inutilisé) dans le schéma d'année — migration automatique (S8-01)
- VERSION → 3.5.0

### Calculs
- `Calculs.bilanScenario(anneeData, modificateurs)` — fonction pure, zéro DOM (S8-02)
- `Calculs.comparerScenarios(anneeData, scenarios)` — triés par solde simulé décroissant (S8-02)

---

## v3.4.0 — Sprint 7 : Stabilisation & Fondations (2026-04-17)

### Bugs corrigés
- **`affecterEnsHPCDirect`** : le paramètre `ensId` était ignoré — corrigé (S7-01)
- **`_refreshKPI`** : déclenchait un re-render complet du tableau après chaque édition inline — corrigé, seule la KPI strip est mise à jour (S7-02)
- **`confirmerSelEns` (branche discipline)** : doublon de discipline et risque d’heures négatives — corrigé (S7-03)

### Nettoyage
- 13 occurrences de `style="font-family:'JetBrains Mono'"` remplacées par `.font-mono` dans `dotation.js`, `hpc.js`, `structures.js` (S7-04)
- Classe utilitaire `.font-mono` ajoutée dans `style.css` (S7-04)
- `data.js.bak` supprimé du dépôt (S7-06)
- `.gitignore` complété : `*.bak`, `data/*.json` sauf exemple (S7-06)

### Fondations
- `typeEtab: 'college'` ajouté dans le schéma `etablissement` (migration automatique) (S7-05)
- `data/exemple.json` mis à jour au schéma v3.4 (S7-07)
- `SKILL.md` v3.4 : règle `.font-mono`, `EtablissementObject` mis à jour, checklist complétée (S7-08)

---


## [3.2.0] — Sprint 6 — Module Enseignants & Import CSV Pronote

### Ajouté
- ◉ **Module Enseignants** (`assets/js/modules/enseignants.js`, namespace `DGHEnseignants`)
  - Tableau avec KPI�: nb enseignants, total heures, nb sous-service, nb HSA
  - Modal saisie/modification�: nom, prénom, grade, statut, discipline, heures, ORS manuelle
  - Apercu ORS en temps réel selon le grade sélectionné
  - Écart coloré�: indigo (HSA) / rouge (sous-service) / neutre (équilibre)
  - Badges statut�: Titulaire / BMP / TZR / Contractuel
- 📥 **Import CSV Pronote** (Ressources > Professeurs > Export tableur)
  - Zone drag & drop + sélection fichier
  - Détection automatique du séparateur (`;` ou `,`) et des colonnes
  - Import partiel si colonnes manquantes (avertissement explicité)
  - Détection doublons nom+prénom → mise à jour plutôt que création en double
  - Prévisualisation complète avant confirmation

### Modifié
- `calculs.js` — `detailEnseignant()` accepte `ens.heures` (Number) + rétro-compat `services[]`
- `calculs.js` — `genererAlertes()` seuil sous-service�: > 2h = warning, ≤ 2h = info
- `data.js` — VERSION 3.2.0, CRUD enseignants complet, migration `services[]` → `heures`
- `data/exemple.json` — v3.2.0, 4 enseignants fictifs

### Technique
- `Calculs.bilanEnseignants(enseignants)` — KPIs agrégés (fonction pure)
- CRUD data.js�: `addEnseignant`, `updateEnseignant`, `deleteEnseignant`, `getEnseignants`,
  `getEnseignant`, `findEnseignantByNomPrenom`
- Styles CSS dédiés (tableau, badges, zone drag & drop, prévisualisation CSV)

---

## [3.1.1] — Sprint 5 ter — Corrections réglementaires & UX Dotation

### Corrigé
- 📜 **Référence réglementaire corrigée** — la mention « BO spécial n°11 du 26 novembre 2015 » (qui désigne les programmes) est remplacée par la référence exacte des grilles horaires : *arrêté du 19 mai 2015 relatif à l'organisation des enseignements dans les classes de collège, J.O. du 20 mai 2015, modifié* (source : Légifrance)
- 🗑️ **Doublon CSS `.dot-ecart`** supprimé (deux blocs identiques coexistaient dans `style.css`)
- 📐 **`.disc-resume-nom`** corrigé en `flex:1; min-width:0` pour éviter le débordement dans la grille deux colonnes

### Ajouté
- ✱ **Clic sur Écart (Dotation DGH)** — lorsque l'écart d'une discipline n'est pas nul, il s'affiche comme un bouton cliquable (bordure pointillée + ✱). Un clic ajuste automatiquement les HP pour que l'écart soit égal à 0 (HP = besoin − HSA). Le bouton disparaît dès que l'écart est à 0.
- 📊 **Tableau de bord — deux colonnes** — la section « Répartition par discipline » est maintenant accompagnée, côte à côte, d'un résumé des **Heures pédagogiques complémentaires** (intitulé, heures/sem, catégorie, total). Responsive : une colonne sous 860 px.

### Technique
- Nouvelle fonction `_ecartZero(discId, besoin, hsa)` dans `app.js`
- Nouvelle action `ecart-zero` dans `_onGlobalClick`
- Nouveau CSS : `.dash-resume-grid`, `.dash-resume-col`, `.dash-resume-col-header`, `.dash-hpc-empty`, `.dot-ecart-btn`
- Nouveau `id` HTML : `dashHPCList` (rendu par `_renderDashboard`)

---

## [3.1.0] — Sprint 5 bis — UX & Dashboard enrichi

### Ajouté
- 📐 **HP/HSA sur les heures pédagogiques complémentaires** — chaque HPC peut être déclarée en H-Poste ou HSA ; impact immédiat sur le solde et les totaux du tableau de bord
- 🖱️ **Bouton « Tout sélectionner / désélectionner »** dans la modal HPC pour sélectionner toutes les classes en un clic
- 📊 **Encart HP/HSA dans le tableau de bord** — enveloppe / consommées / disponibles, avec barre de progression séparée pour HP et HSA
- 🔍 **Tooltips au survol des KPI** du tableau de bord (enveloppe, HP, HSA, solde) : détail complet avec ventilation Dotation / HPC
- ⊞ **Bouton « Tout déplier / replier »** dans Dotation DGH pour afficher tous les groupes de cours en un clic
- 📋 **Tableau des besoins MEN par niveau** dans Dotation DGH — divisions, h/div, total MEN, HP allouées, HSA, écart par niveau
- 📊 **Total général** en bas du tableau Dotation (HP + HSA allouées)
- 🏷️ **Badge « Structure »** dans la colonne Dispositif des classes — s'affiche automatiquement si la classe est rattachée à des groupes de cours ou des HPC
- 💬 **Titre modal HPC au pluriel** — « Heures complémentaires »

### Corrigé
- 🐛 **Modal établissement** trop étroit (520px → 640px) — meilleure lisibilité des onglets et champs

### Technique
- `data.js` v3.1.0 — migration automatique `typeHeure: 'hp'` sur les HPC existantes
- `bilanDotation()` intègre désormais les HPC dans les totaux HP/HSA
- Rafraîchissement dashboard après toute modification HPC (ajout, modification, suppression)

---

## [1.3.0] — Sprint 3 — Dotation DGH

### Ajouté
- ◎ **Module Dotation DGH** — vue complète remplaçant le placeholder Sprint 3
- ➕ Ajout, modification et suppression de disciplines avec modal dédiée
- 🎨 Couleur de repérage par discipline (color picker natif)
- 📊 **Saisie inline des heures allouées** — champ numérique directement dans le tableau, sauvegarde à la perte de focus
- 📐 **Besoin théorique automatique** — calculé par `besoinsParDiscipline()` à partir des grilles MEN (BO spécial n°11 du 26 novembre 2015) × nombre de divisions par niveau
- ⚡ **Écart alloué / théorique** — badge coloré (vert = équilibré, amber = excédent, rouge = insuffisant)
- 📊 Barre de proportion par discipline (% de l'enveloppe consommé par discipline)
- 🔢 Barre KPI : enveloppe, total alloué, solde (vert/rouge selon dépassement), % consommé, nb disciplines
- 🔴 Barre de progression de l'enveloppe (cohérente avec le Dashboard)
- 🗑️ Confirmation explicite avant suppression (supprime aussi la ligne de répartition)
- `bilanDotation()` dans `calculs.js` — bilan global dotation (fonction pure)
- `besoinsParDiscipline()` dans `calculs.js` — besoins théoriques MEN vs alloués (fonction pure)
- `addDiscipline()`, `updateDiscipline()`, `deleteDiscipline()` dans `data.js`
- `getDisciplines()`, `getDiscipline()`, `getRepartition()`, `setRepartition()` dans `data.js`
- Migration automatique des fichiers JSON existants (v1.2 → v1.3)

### Technique
- Délégation `_onGlobalClick` étendue : `edit-disc`, `delete-disc`, `btnAddDisc`, modals disc
- Listeners `change` sur `.dot-input-h` posés après chaque rendu du tableau (dans `_renderDotation`)
- Aucun `onclick` inline — vérification : `grep -n "onclick" index.html` → vide

---

## [1.2.0] — Corrections & améliorations structures

### Ajouté
- 🔁 **Duplication de divisions** — en mode ajout, choisir N copies supplémentaires ; le suffixe s'incrémente automatiquement (6eA → 6eB → 6eC, 6e1 → 6e2 → 6e3, gestion Z → AA)
- 🗑️ **Réinitialisation d'une année** — bouton dans la zone de danger de la modal établissement ; efface structures, dotation et enseignants de l'année active, avec confirmation obligatoire
- `resetAnnee()` dans `data.js` — remet une année à zéro sans la supprimer de la liste
- `duplicateDivisions(id, count)` dans `data.js` — crée N copies en incrémentant le suffixe
- `_nextDivName()` et `_nextLetters()` dans `data.js` — logique d'incrément alphabétique et numérique

### Corrigé
- **PAP et PPS retirés** du select dispositif dans la modal division — ce sont des mesures individuelles d'élèves, pas des attributs de division de classe
- Le bloc duplication est masqué en mode édition (visible uniquement à la création)

---

## [1.1.0] — Sprint 2 — Structures de classes

### Ajouté
- ⊞ **Module Structures** — vue complète avec barre KPI (divisions, effectif total, niveaux présents)
- ➕ Ajout, modification et suppression de divisions avec modal dédié
- 🏷️ Badges niveaux colorés (6e=bleu, 5e=indigo, 4e=vert, 3e=amber, dispositifs=rouge)
- 🏷️ Tags options (LV2, Latin…) et dispositif (ULIS, UPE2A, SEGPA)
- 🗑️ Confirmation explicite avant suppression
- 📊 KPI Divisions + Effectif ajoutés au Dashboard
- ◬ Alerte automatique si aucune division saisie
- `resumeStructures()` dans `calculs.js` — bilan par niveau
- Gestion des années scolaires depuis la modal établissement (ajout d'une nouvelle année)

### Technique
- Délégation globale unique `_onGlobalClick` — zéro listener direct sur boutons de contenu
- Échappement HTML `_esc()` sur toutes les données affichées en innerHTML

---

## [1.0.0] — Sprint 1 — Dashboard & infrastructure

### Ajouté
- 🏠 Dashboard — KPIs, barre progression, alertes
- ⚙️ Modal paramètres établissement
- 🗂️ Navigation sidebar — 8 modules
- 🔄 Gestion multi-années scolaires
- 💾 Export JSON local (Ctrl+S ou bouton)
- 📥 Import JSON avec backup automatique
- 🔔 Toasts (succès, erreur, info, warning)
- 🧠 Moteur ORS (certifié 18h, agrégé 15h, PLP 17h, EPS 20h, doc 36h, CPE 35h)
- 📐 Grilles MEN collège (6e/5e/4e/3e)
- ◬ Alertes automatiques
- 📱 Responsive desktop/tablette/mobile
- 🔐 RGPD : données 100% locales

---

## À venir

### [1.3.0] — Sprint 3
- ◎ Module Dotation DGH (répartition par discipline, calcul des besoins via grilles MEN)

### [1.4.0] — Sprint 4
- ◉ Module Enseignants (fiches individuelles, ORS, HSA, TZR, compléments)

### [1.5.0] — Sprint 5
- ⟳ Module Simulation
- ◬ Module Alertes enrichi

### [1.6.0] — Sprint 6
- ▤ Module Synthèses (PDF + HTML pour CA)
- Pacte enseignant + IMP

### [2.0.0] — Sprint 7
- ◷ Module Historique (comparaisons pluriannuelles)

## v3.2.0 — Refactorisation structurelle (2026-04-16)

### Architecture
- Éclatement de app.js (~1 390 lignes) en 5 modules IIFE séparés :
  - `assets/js/modules/dashboard.js` (DGHDashboard) — 241 lignes
  - `assets/js/modules/structures.js` (DGHStructures) — 247 lignes
  - `assets/js/modules/dotation.js` (DGHDotation) — 468 lignes
  - `assets/js/modules/hpc.js` (DGHHPC) — 185 lignes
  - `assets/js/modules/etab.js` (DGHEtab) — 190 lignes
  - `assets/js/app.js` noyau réduit — 360 lignes
- Chargement ordonné dans `index.html` : data → calculs → modules → app

### Corrections fragilités
- **`addEventListener` sur éléments dynamiques supprimés** : `.dot-input-h`, `.grille-input`, `.btn-toggle-gc`, inputs enveloppe, checkboxes classes → tous délégués via `document.addEventListener('change'|'dblclick'|'blur')` dans `_onGlobalChange/_onGlobalDblClick/_onGlobalBlur`
- **Garde `_bound` supprimée** : remplacée par délégation propre sur `document`
- **`bilanDGH()` supprimée** de `calculs.js` — doublon de `bilanDotation()`, jamais appelée
- **Doublons CSS supprimés** : bloc `dot-table / dot-kpi-bar / disc-color-dot` dupliqué (lignes ~898–964) supprimé
- **Classes utilitaires CSS ajoutées** : `.is-hidden`, `.badge-hidden`, `.solde-danger`, `.solde-neutre`, `.solde-positif`, `.solde-hsa`, `.kpi-solde-danger` — remplacent les injections `.style.color` et `.style.display` sémantiques
- **Version sidebar** mise à jour : v3.2.0

### Conformité SKILL.md
- Zéro `onclick` inline dans `index.html`
- Zéro `localStorage` dans `modules/` et `calculs.js`
- `localStorage` dans `app.js` limité au thème UI (exception documentée)
- Zéro appel de fonction privée entre modules (tout passe par l'API publique `return{}`)
- Zéro style injecté en JS sauf valeurs calculées dynamiquement (width%, marginLeft%)

## v3.2.1 — Corrections post-refactorisation (2026-04-16)

### Bugs corrigés

- **Dashboard — répartition disciplines et HPC invisibles** : `disciplineResume` avait
  `style="display:none"` dans le HTML et `class="is-hidden"` ajouté en second attribut.
  Le navigateur ignore le second attribut `class=` — l'élément restait caché.
  Corrigé : fusion en `class="section-card is-hidden"`. Même correction sur
  `structNiveauCard`, `dotTotalBar`, `tab-annees`, `tab-danger`, `dashHpHsaGrid`.

- **Tooltips KPI et disciplines invisibles au survol** : `#kpiFloatTip` et `#discFloatTip`
  ont `display: none` dans leur règle CSS propre. `classList.remove('is-hidden')` ne
  peut pas annuler une règle CSS ciblant directement l'id. Corrigé : retour à
  `style.display = 'block'/'none'` pour ces deux éléments uniquement (exception documentée
  dans SKILL.md).

- **Tooltip disciplines clignotant** : `mouseover` se déclenche sur chaque enfant du
  `.disc-tip-wrap`, provoquant des clignotements lors du survol. Corrigé avec un tracker
  `_activeWrap` : le tooltip ne change d'état que si le wrapper change vraiment.

- **Couleurs écarts et badges HP/HSA disparues** : le bloc CSS `MODULE DOTATION DGH — HP + HSA`
  supprimé lors de la refactorisation contenait des règles uniques non présentes dans le
  premier bloc : `.dot-ecart-ok/over/under`, `.dot-col-badge`, `.dot-col-hp/hsa`,
  `.dot-bar-track`, `.dot-input-hp/hsa:focus`. Restaurées depuis le CSS original v3.1.6
  dans le bon ordre de cascade (`.dot-ecart-btn` déclaré après les couleurs).

### Comportement modifié

- **Bouton écart (Dotation DGH)** : le clic règle désormais HP = besoin théorique
  **et** remet HSA = 0. Précédemment : HP ajustée à (besoin − HSA existantes), HSA inchangées.
  Nouveau tooltip : "Cliquer : HP → Xh · HSA → 0h (écart = 0)".

### Documentation

- SKILL.md v3.2.1 : ajout de 4 nouveaux pièges (double attribut class, exception
  tooltips flottants, tooltip clignotant, suppression CSS partielle).
