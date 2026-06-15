# Changelog — DGH App

Toutes les modifications notables sont documentées ici.  
Format : [Semantic Versioning](https://semver.org/) — `MAJEUR.MINEUR.CORRECTIF`

---

## v4.7.1 — Consommation du scénario actif visible sur le tableau de bord (2026-06-15)

### Corrigé
- **Barre « Consommation DGH » du tableau de bord** : elle ignorait le scénario actif. Elle affiche désormais un **segment orange** correspondant aux heures consommées par le scénario, et le libellé indique le total simulé : « X / Y h (dont +Z h scénario) ».
- **Jauges HP/HSA — surcouche simulation masquée à tort.** La ligne « ⊕ avec scénario » n'apparaissait que si l'enveloppe du type était > 0. Pour un scénario tout en HSA avec une enveloppe HSA à 0, la consommation devenait invisible. La surcouche s'affiche maintenant dès que le scénario consomme ce type (marge négative = surconsommation clairement visible).

### Modifié
- **Bandeau scénario du tableau de bord** : le coût n'affiche plus « +0 h HP » quand le scénario n'a pas d'impact HP ; seuls les types réellement consommés sont listés (ex. « Coût : +6 h HSA »).

### Rappel d'usage
- Le tableau de bord (comme toute l'app depuis v4.7.0) reflète le scénario **ACTIF** — celui marqué « ● Actif » dans l'onglet Scénarios, activé via « Activer ». Le menu déroulant de l'onglet *Récapitulatif DGH* ne sert qu'à la comparaison et n'active pas le scénario.

### Détails techniques
- `index.html` : 1 segment de barre (`#progressBarScen`).
- `dashboard.js` : segment + libellé simulés dans la barre ; garde `dotation > 0` retirée dans `_renderJauge` (calcul de `pctSim` sécurisé) ; coût du bandeau conditionnel.
- `style.css` : `.dash-bar-scen`.
- Aucune modification du modèle de données ni de `calculs.js`.

---

## v4.7.0 — Scénario actif propagé partout + listing modalités condensé (2026-06-15)

### Ajouté
- **Solde simulé dans la barre supérieure, sur toutes les vues.** Dès qu'un scénario est actif, la barre du haut (présente partout) remplace « Solde » par **« ⊕ Solde simulé »** (vert/rouge selon dépassement). La barre est désormais rafraîchie à chaque navigation.
- **Vue Dotation DGH** : le KPI **Solde** affiche la valeur **simulée** (label « h solde simulé ») quand un scénario est actif.

### Contexte
- Le **tableau de bord** et les **synthèses (CA / Dialogue de gestion)** affichaient déjà le coût et le solde simulés — inchangés. Avec cette version, l'incidence du scénario actif est visible sur **toutes** les vues principales.
- **Hors périmètre assumé** : les « Services enseignants » ne sont pas surchargés automatiquement (l'imputation HP/HSA par enseignant relève de l'onglet *Impact enseignants*, qui le gère déjà finement).

### Modifié
- **Onglet Scénarios — listing des modalités condensé.** La colonne « Modalités » n'affiche plus une ligne par dédoublement (illisible au-delà de quelques modalités). Elle affiche désormais le **nombre total** + un **résumé par type** (ex. « 64 modalités · Déd. ×64 »). Le détail reste accessible dans l'accordéon (▼) et l'onglet **Récapitulatif DGH**.

### Détails techniques
- `dashboard.js` : extraction de `_renderTopbar()` (exporté `renderTopbar`), appelé par `app.navigate()`.
- `app.js` : 1 ligne (`DGHDashboard.renderTopbar()`) en fin de `navigate()`.
- `dotation.js` : surcouche `bilanScenario` sur le KPI solde.
- `pilotage.js` : `_renderOngletScenarios` — résumé par type, suppression du code mort (`types`/`badges` inutilisés).
- `style.css` : `.topbar-stat-scen`, `.topbar-solde-ok/neg`, `.scen-mods-count`.
- Aucune modification du modèle de données ni de `calculs.js`.

---

## v4.6.1 — Récap DGH : scroll, bandeau d'onglets, HSA du scénario (2026-06-15)

### Corrigé
- **Scroll horizontal du Récapitulatif DGH** : le tableau (très large quand un scénario porte de nombreuses modalités) débordait et étirait toute la page. Cause : piège flexbox `min-width: auto` sur `.main-content`. Ajout de `min-width: 0` (+ `.view-container`) → le débordement est désormais **confiné au tableau** via son `overflow-x: auto`.
- **Bandeau d'onglets** (Scénarios / Récapitulatif DGH / Impact / Synthèse) : il s'élargissait avec le tableau et devenait partiellement inaccessible. Conséquence directe du même correctif : il reste **figé et cliquable**.

### Modifié
- **Récapitulatif DGH — impact du scénario visible dans le volume.** Sous scénario actif (ou sélectionné), les colonnes **Dotation allouée** (HP, HSA, Total, Écart) affichent désormais la **valeur simulée**, avec le **Δ du scénario en orange**. La barre de consommation et la ligne **Total** intègrent le coût du scénario (projets hors discipline comptés au Total). Légende explicative ajoutée. Revenir à « — Aucun scénario — » réaffiche la base.

### Détails techniques
- `style.css` : `min-width:0` sur `.main-content` et `.view-container` ; styles `.rc-delta`, `.rc-legende`.
- `pilotage.js` (`_renderOngletRecap`) : coût HP/HSA **par discipline** reconstruit depuis `bilanScenario().detailParMod` (filtre `mod.disciplineId`) ; valeurs simulées HP/HSA/Total/Écart + badges Δ ; totaux simulés via `coutHP/coutHSA/coutTotal`.
- Aucune modification du modèle de données ni de `calculs.js`.

---

## v4.6.0 — Aide contextuelle embarquée (2026-06-15)

### Ajouté
- **Système d'aide contextuelle complet** — module autonome `assets/js/tutorial.js` (`DGHTutorial`), vanilla, zéro dépendance, zéro CDN.
  - **Écran de bienvenue** au premier lancement (cadre RGPD + règle d'or de sauvegarde).
  - **Pop-ups contextuelles par onglet** à la première visite : structure imposée *À faire / Pourquoi / Pas pour / Si ça bloque*, ton direct, ≤ 5 lignes.
  - **Visite guidée** pas à pas avec spotlight (cibles statiques → jamais de blocage).
  - **Aide situationnelle** branchée sur l'événement `dgh:storage-error` déjà émis par `data.js` (sauvegarde impossible → « Exporter maintenant »).
  - **Bouton « ? » permanent** (bas-droite) ouvrant un panneau de réglages : aide de la page, relancer la visite, revoir la bienvenue, réafficher toutes les aides, **toggle global** des aides automatiques.
  - **« Ne plus afficher les aides »** sur chaque pop-up + toggle global dans le panneau.
- **Section CSS dédiée** dans `style.css` (« AIDE CONTEXTUELLE EMBARQUÉE »), 100 % variables de thème (clair/sombre).

### Intégration (minimale, conforme SKILL.md)
- `index.html` : **une seule ligne** ajoutée (`<script src="assets/js/tutorial.js?v=4.6.0">`), après `app.js`.
- `app.js` : **aucune modification** — le module observe la vue active via `MutationObserver` et réutilise `app.navigate()`.
- Délégation **unique** propre au module (attribut `data-help-action` sur son propre arbre DOM) — zéro `onclick` inline, zéro collision avec `_onGlobalClick`.

### Données & RGPD
- Préférences d'aide stockées sous la clé `dgh-tutorial` (booléens « vu / activé » uniquement) — **zéro donnée personnelle**. Même statut documenté que le thème UI.

---

## v4.5.0 — Encart aménagements multi-classes dans les scénarios (2026-06-14)

### Ajouté
- **Encart « Aménagement multi-classes »** au-dessus de la grille de saisie, dans le panneau accordéon d'un scénario.
  - Couvre les cas que la grille mono-case ne peut pas exprimer : **groupes de besoins inter-classes**, **dédoublement sur plusieurs classes simultanément**, **barrette**, etc.
  - Formulaire compact : type, discipline (optionnel), H/gr/sem, imputation HP/HSA, commentaire.
  - **Sélection des classes** par cases à cocher groupées par niveau, avec raccourcis par niveau (clic sur le label du niveau pour l'ajouter à la sélection) et boutons Tout / Aucun.
  - Validation : au moins 2 classes requises (sinon toast d'avertissement avec message explicatif). Une classe seule relève de la grille.
  - **Liste des aménagements multi-classes enregistrés** affichée sous le formulaire, avec bouton ✕ de suppression individuelle.
- Nouvelles fonctions dans `pilotage.js` : `_htmlEncartMultiClasse`, `saveMultiClasse`, `mcSelectNiveau`.
- Nouveaux handlers dans `app.js` : `save-mc` → `DGHPilotage.saveMultiClasse`, `mc-sel-niv` → `DGHPilotage.mcSelectNiveau`.
- CSS dédié : bloc `.mc-encart` / `.mc-form` / `.mc-classes-grid` / `.mc-liste` / `.mc-item`.

### Changé
- La note « modalités multi-classes » précédemment affichée en bas de la grille est **supprimée** (les aménagements multi-classes sont maintenant gérés dans l'encart, plus dans la grille).
- `_htmlGrilleModalites` ne collecte plus les `multiMods` — simplification interne.
- CSS mort `.scen-view-toggle` / `.scen-view-btn` (supprimés en v4.4.0) retirés du fichier CSS.

---

## v4.4.0 — Scénarios : saisie en grille uniquement (2026-06-14)

### Changé
- **Suppression du mode « Liste » des scénarios.** La saisie des modalités se fait désormais **exclusivement via la grille** (disciplines en lignes × classes en colonnes). Le sélecteur Liste / Grille a été retiré : déplier un scénario (▼) ouvre directement la grille.
  - Tout le CRUD mono-classe reste couvert par la grille : saisir des heures crée la modalité, ajuster type / HP-HSA la modifie, mettre 0 la supprime.
  - **Modalités multi-classes ou sans discipline** (qui ne peuvent exister que via l'ancienne vue Liste) : elles ne sont pas éditables dans la grille (une case = 1 classe × 1 discipline) mais **restent comptées dans le bilan** et sont désormais **listées sous la grille avec un bouton de suppression** (✕), pour pouvoir les nettoyer.

### Retiré (code mort, conformité « zéro code zombie »)
- `pilotage.js` : fonctions `_htmlFormModalite`, `_htmlFormModaliteEdit`, `previewImpact`, `selectionnerNiveau`, `setScenView`, `openEditMod`, `cancelEditMod`, `saveEditMod`, `saveModificateur`, `onTypeChange` ; états `_modEditId`, `_modEditScenId`, `_scenViewMode`.
- `app.js` : handlers `edit-mod`, `save-edit-mod`, `cancel-edit-mod`, `save-mod`, `scen-view-mode`, `mod-sel-niv`, et les change-handlers `mod-disc-select` / `mod-classe-check` / `mod-h-input` / `mod-th-radio` / `mod-type-select`. Le handler `delete-mod` est **conservé** (réutilisé par la liste de nettoyage des modalités multi-classes).

### Note de dette technique (non traité — à tracer)
- **CSS désormais inutilisé** du formulaire Liste (`.scen-form-add`, `.scen-view-toggle`, `.scen-view-btn`, `.scen-mods-table`, `.mod-niv-*`, etc.) laissé en place volontairement (suppression CSS = risque de régression selon SKILL). À nettoyer en livraison dédiée, en même temps que les doublons `.scen-tableau` / `.scen-mods-table` / `.scen-comp-wrap`.
- **Cache-busting** : suffixe `?v=` incrémenté à `4.4.0`.

---

## v4.3.4 — Correctifs d'affichage des modales (2026-06-14)

### Corrigé
- **Bouton « Ajouter une mission » (PACTE / IMP) sans effet** : la modale `modalMission` (et la confirmation de suppression `confirmMission`) s'affichaient via `is-hidden` au lieu de la convention `.modal-open` utilisée par toutes les autres modales. Or `.modal-overlay` est `display:none` par défaut et ne s'affiche qu'avec `.modal-open` ; de plus `.is-hidden` est en `display:none !important`, qui aurait masqué la modale même si `.modal-open` avait été ajouté. La fenêtre ne s'ouvrait donc jamais. Correctif : `is-hidden` retiré du HTML des deux overlays + bascule via `.modal-open` dans `missions.js`.
- **Même bug latent dans l'Historique** : les confirmations **« Figer l'année »** et **« Supprimer le snapshot »** (`histConfirm`) reposaient sur le même mécanisme `is-hidden` et n'apparaissaient jamais. Corrigé dans `historique.js` (template + ouverture/fermeture) selon la même convention `.modal-open`.
- **Pièce manquante du défilement sidebar (réconciliation de branche)** : ajout de `min-height: 0` sur `.nav-list`, absent de ce build. Sans cette règle, l'enfant flex refuse de rétrécir sous la hauteur de son contenu et déborde au lieu de déclencher son `overflow-y:auto`. Complète le correctif `.sidebar { height:100vh/100dvh }` de la v4.3.2.

### Note de conception
- **Convention unique des modales** désormais documentée dans `SKILL.md` : toute modale `.modal-overlay` s'ouvre **uniquement** via `classList.add('modal-open')` et se ferme via `classList.remove('modal-open')`. Ne jamais utiliser `is-hidden` sur un `.modal-overlay`.

### Note de dette technique (non traité ici)
- Blocs CSS en double repérés (`.scen-tableau`, `.scen-mods-table`, `.scen-comp-wrap`) — à consolider en livraison dédiée et tracée (règle SKILL : ne jamais supprimer un bloc « doublon » sans vérifier chaque règle individuellement).
- **Cache-busting** : suffixe `?v=` incrémenté à `4.3.4`.

---

## v4.3.2 — Correctif défilement de la barre latérale (2026-06-13)

### Corrigé
- **Barre latérale non défilable** : sur les écrans dont la hauteur est inférieure à celle du menu complet, les derniers items de navigation (Outils, boutons Exporter/Importer, pied de page) passaient sous l'écran sans possibilité de scroller. Cause : `.sidebar` était bornée en `min-height: 100vh` (qui autorise le débordement) au lieu de `height`, si bien que le conteneur flex grandissait au-delà de l'écran et que `.nav-list` (pourtant en `overflow-y:auto`) n'avait aucune contrainte de hauteur à respecter. Corrigé en `height: 100vh` + `height: 100dvh` (hauteur dynamique, robuste à la barre d'adresse mobile).
- **Cache-busting** : suffixe `?v=` incrémenté à `4.3.2` pour forcer le rechargement de `style.css` après déploiement.

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
