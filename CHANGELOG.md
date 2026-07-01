# Changelog — DGH App

Toutes les modifications notables sont documentées ici.  
Format : [Semantic Versioning](https://semver.org/) — `MAJEUR.MINEUR.CORRECTIF`

## [4.19.1] — Correction attribution HSA scénario

### Corrigé
- **Bug : un enseignant non affecté apparaissait comme ayant déjà atteint son ORS.** `attribuerHSAScenario()` répartissait l'enveloppe HSA du scénario par ordre décroissant d'ORS, sans tenir compte des affectations réelles — le premier enseignant du classement (souvent non affecté à une seule classe) pouvait absorber toute l'enveloppe scénario d'un coup, faisant apparaître un total de service quasi complet avant toute affectation réelle.
- **Nouvelle règle** :
  - Tant qu'**aucun** enseignant de la discipline n'a de vraie affectation, l'enveloppe scénario n'est attribuée à personne (retour `{}`) — elle est affichée comme *« en attente »* dans l'onglet Répartition des HSA.
  - Dès qu'au moins un enseignant a des heures réelles, l'enveloppe est répartie **au prorata de ce que chacun porte déjà** (arrondi demi-heure, méthode des plus forts restes pour un total exact), et non plus par priorité de grade.
  - L'ajustement manuel (`hsaAbsorbees[disciplineId].profs`) reste toujours prioritaire et inchangé.

### Technique
- `calculs.js` : nouvelle fonction privée `_heuresReellesDiscipline(ens, discNom)`. `attribuerHSAScenario()` réécrite (prorata sur heures réelles au lieu du tri ORS glouton).
- `bilanEquipeAvecScenario()` expose désormais `nonRepartieParDisc` et `nonRepartieTotal` (heures de scénario non attribuables faute d'enseignant engagé).
- `repartition.js` — onglet « Répartition des HSA » : nouvel état vide *« HSA en attente »* quand l'enveloppe n'est pas répartie, bandeau mis à jour avec le total en attente, texte d'aide reformulé (prorata au lieu d'ORS).
- `style.css` : `.rep-hsa-banner-kpi.rep-hsa-nonrep`.

---

## [4.18.0] — Sprint 15

### Ajouté
- **Répartition de services — intégration du scénario actif** : la vue Répartition intègre désormais les modificateurs du scénario actif, exactement comme les modules Besoins et Pilotage.
  - **Bandeau scénario actif** en tête de vue (nom du scénario, nombre de modificateurs).
  - **Mode « Par discipline »** : chaque ligne classe × discipline affiche la référence simulée (grille MEN + delta scénario) à côté des heures affectées. Le delta est signalé `+Xh⚡` et la couleur de cohérence (vert/orange/rouge) est calculée sur la référence simulée.
  - **Mode saisie rapide** : les cellules dont le scénario apporte un delta sont légèrement colorées en ambre ; les cellules cochées affichent le delta simulé `/Yh⚡` sous les heures affectées ; les cellules vides avec delta affichent un indicateur discret `+Xh⚡`.
  - Sans scénario actif, le comportement est identique à la version précédente (référence grille MEN pure).

### Technique
- Nouvelle fonction privée `_deltaScenarioParCase(modificateurs, disciplineId, divisionId)` dans `repartition.js` : calcule le delta heures d'un scénario pour un couple (division, discipline) précis, en gérant les types `dedoublement`, `co-enseignement`, `groupe-effectif-reduit`, `groupes-besoins`, `autre`.
- Nouvelles classes CSS : `.rep-cell-scen`, `.rep-scen-icon/mods/info`, `.rep-rapid-cell-scen`, `.rep-rapid-scen`, `.rep-rapid-scen-hint`.

---

## v4.17.0 — Saisie rapide : en-têtes figés, filtre discipline, correction décocher (2026-06-29)

### UX — Saisie rapide (Répartition des services)

- **En-têtes toujours visibles en scroll** : la ligne niveaux (6e, 5e…) et la ligne
  des classes sont désormais `position: sticky` avec `top: 0` et `top: 37px`
  respectivement. La colonne enseignant (déjà sticky à gauche) est maintenue.
  Le wrap reçoit `max-height: 420px; overflow-y: auto` pour délimiter la zone de
  défilement sans déborder dans la page.

- **Filtre discipline par défaut** : seuls les enseignants rattachés à la discipline
  sélectionnée sont affichés. Les enseignants hors-discipline qui ont **déjà une
  affectation existante** sur cette discipline restent toujours visibles (sécurité
  contre la perte d'affectation invisible). Un bouton « ▼ Voir tous les enseignants
  (N autres) » permet d'afficher les autres ponctuellement ; il se remet à masqué
  lors d'un changement de discipline (`_showAutres` réinitialisé dans
  `selectDiscipline()`).

- **Correction du "voyant bleu persistant"** : après décocher une case pour un
  enseignant hors-discipline, `renderRepartition()` recalcule `nbAff` depuis la
  couche data après suppression. La position de scroll (`scrollLeft`, `scrollTop`)
  est mémorisée avant le re-render et restaurée après sur `#repRapidWrap`, ce qui
  rend le changement visuellement immédiat sans perdre la position dans le tableau.

- **Indicateur visuel des cellules cochées** : nouvelle classe `.rep-rapid-cell-checked`
  (fond légèrement teinté en accent) pour mieux distinguer les cases cochées des
  cases vides, indépendamment de la couleur de la checkbox.

### Architecture
- `_showAutres` ajouté à l'état du module (reset à `false` au changement de disc).
- `toggleAutres()` nouvelle fonction publique, câblée sur `data-action="rep-rapid-toggle-autres"` dans `app.js`.
- `toggleEnsClasse()` préserve le scroll avant/après `renderRepartition()`.
- CSS : remplacement du bloc `.rep-rapid-*` — tous les `z-index` revus pour la combinaison sticky gauche × sticky top.

---

## v4.16.4 — Accessibilité lecteurs d'écran : h1 unique + aria-hidden (2026-06-28)

### Accessibilité (WCAG 1.3.1, 4.1.2)
- **[I6] Un seul `<h1>` par page** (`index.html`) : les 12 titres de vue étaient tous
  en `<h1>`, visibles simultanément par les lecteurs d'écran. Désormais seul le
  « Tableau de bord » (vue initiale) conserve `<h1>`. Les 11 autres titres de vue
  passent en `<h2 class="view-title">` — rendu visuel identique (la mise en forme est
  portée par la classe CSS, pas par la balise).
- **`aria-hidden` sur les vues inactives** (`index.html`, `app.js`) : chaque
  `<section class="view">` inactive reçoit `aria-hidden="true"` dès le HTML statique.
  À chaque navigation, `navigate()` pose `aria-hidden="true"` sur toutes les vues
  puis le retire sur la vue activée. Les utilisateurs de lecteurs d'écran ne
  traversent donc plus 12 sections de contenu masqué pour atteindre la vue courante.

---

## v4.16.3 — Améliorations audit : UX, CSS, architecture (2026-06-28)

### Améliorations UX
- **[I2] Fin des `confirm()` natifs** (`app.js`, `edt.js`, `pilotage.js`, `structures.js`) :
  toutes les confirmations de suppression passent désormais par une modale stylisée
  générique `confirmGeneric` (HTML + logique `app.confirmAction()`). Concernées :
  barrette, co-intervention, contrainte libre, salle, groupe, scénario, restauration
  de sauvegarde. Cohérence UX complète, plus aucun dialogue navigateur bloquant.

### Performance
- **[I5] Double `bilanScenario` supprimé** (`app.js`) : lors d'une navigation vers le
  dashboard, `renderTopbar()` n'est plus appelé deux fois (une fois par `renderDashboard`
  en interne, une fois après). Le calcul `bilanScenario` n'est donc plus doublé sur
  cette navigation.

### CSS — conformité SKILL.md
- **[I4] Zéro style inline `width:0%`** (`index.html`, `style.css`) : les 7 barres de
  progression et jauges portaient leur largeur initiale en attribut HTML. Ces valeurs
  sont désormais dans les classes CSS (`.progress-fill`, `.gauge-fill`,
  `.dash-equipe-bar-hp/hsa`, `.dot-bar-hp`, `.dot-bar-hsa-part` avec `margin-left:0%`).
- **[A1] 5 `!important` injustifiés supprimés** (`style.css`) : `.btn-icon-gc` (→
  sélecteur composé `.btn-icon.btn-icon-gc`), `.gc-indent` (→ `.gc-subrow td.gc-indent`),
  `.struct-total-row td` (→ `.struct-niveau-table .struct-total-row td`), `.btn-add-gc`
  et `.gc-subrows-row > td` (→ spécificité naturelle suffisante après vérification).

### Lisibilité / maintenabilité
- **[A2] `_migrate()` découpée** (`data.js`) : la fonction monolithique de 220 lignes
  est remplacée par 8 sous-fonctions nommées par version/domaine (`_migrateV30Annees`,
  `_migrateV34Etab`, `_migrateV35Scenarios`, `_migrateV410Forcage`, `_migrateV36EDT`,
  `_migrateV38Groupes`, `_migrateV42Affectations`, `_migrateV48Etab`, `_migrateV48EDT`)
  orchestrées par `_migrate()`. Comportement identique, lisibilité et auditabilité
  améliorées.

---

## v4.16.2 — Corrections audit (2026-06-28)

### Corrigé
- **[B3] Modales sans Échap** (`app.js`) : `modalGenBarrettes`, `modalMission` et
  `confirmMission` étaient absentes de la liste du gestionnaire `keydown 'Escape'`.
  Un utilisateur ne pouvait pas fermer ces modales au clavier. Désormais les 20 modales
  de l'application répondent à la touche Échap.
- **[I3] Résidu `typeHeure` dans les affectations de scénario** (`app.js`, `pilotage.js`) :
  le handler `impact-th-radio` sauvegardait le champ `typeHeure` dans `mod.affectations[]`
  tandis que la migration Sprint 21 avait aligné tout sur `forcage`. Le field sauvegardé
  est désormais `forcage`; la lecture combine `aff.forcage || aff.typeHeure` pour la
  compatibilité des données existantes; l'init d'une nouvelle affectation utilise aussi
  `forcage: 'hsa'`.

### Accessibilité / bonnes pratiques
- **[I1] `font-size` relatif** (`style.css`) : remplace `font-size: 14px` fixe par
  `font-size: 87.5%` (≈ 14 px sur base 16 px navigateur), ce qui respecte le zoom texte
  du système — conformité WCAG 1.4.4.
- **[A5] Styles inline `font-family`** (`index.html`) : les 6 `<span>` portant
  `style="font-family:'JetBrains Mono',monospace"` utilisent désormais la classe `.font-mono`
  déjà définie dans le design system. Zéro style inline.

### En-têtes & code
- **[B2] En-têtes de version** (`app.js`, `data.js`, `calculs.js`) : synchronisés sur
  `v4.16.1` (étaient restés à `v4.9.5` depuis le Sprint 19 environ).
- **[A3] `substr` déprécié** (`data.js`, `genId`) : remplacé par `substring(2, 8)`.

---

## v4.16.1 — Correctif heure bleue (grille) + purge du code mort EDT (2026-06-21)

### Corrigé
- **Heure bleue (onglet Préparation EDT › Contraintes établissement)** : la section
  affichait l'ancienne interface « liste de créneaux candidats » dont les boutons
  « + Ajouter ce créneau » et ✕ étaient inertes (fonctions devenues vides lors du
  passage à la grille). Elle est remplacée par la **grille cliquable**, cohérente avec
  celle des indisponibilités : un clic pose/retire un créneau candidat.
- **Source de données unifiée** : la liste affichée et le bouton « Calculer le créneau
  optimal » lisaient deux sources différentes (`heuresBleues.creneaux` vs
  `grilleHeureBleue`). Tout passe désormais par la grille — plus d'incohérence.
- **Onglet Indisponibilités** : suppression du bouton « + Indisponibilité » mort
  (la saisie se fait à la grille). Disparition au passage d'un doublon d'`id`
  `btnAddClibre` qui rendait le DOM invalide quand l'onglet était actif.

### Nettoyé (code mort, aucun impact fonctionnel)
- `edt.js` : retrait des fonctions fantômes `startAddIndispo`, `editIndispo`,
  `saveIndispo`, `cancelIndispo`, `deleteIndispo`, `onIndispoPlageChange`,
  `hbAddCreneau`, `hbRemoveCreneau` et de la variable inutilisée `_editIndispoId`.
- `app.js` : retrait de 9 handlers orphelins (`edt-edit/save/cancel/delete-indispo`,
  `edt-indispo-plage-change`, `hb-add-creneau`, `hb-remove-creneau`, `#btnAddIndispo`,
  `sel-ens-hpc-direct`).
- `enseignants.js` : retrait de la fonction orpheline `affecterEnsHPCDirect`.

### Outillage
- `tests/check-version.js` surveille désormais **aussi** la ligne de pied de page de
  `SKILL.md` (`*Version : X.Y.Z …*`), qui était restée à 4.8.0 sans être détectée.

### Conformité SKILL
- Grille heure bleue calquée sur `_htmlGrilleIndispo`, branchée sur l'API existante
  (`getGrilleHeureBleue` / `setGrilleHeureBleue` / `grilleHbToggle`), tokens CSS
  existants (`etat-hb-*`). Zéro `onclick`, zéro style inline. Validé par simulation DOM
  en Node + les 4 suites de tests existantes.

---

## v4.16.0 — Pastilles d'avancement par phase (2026-06-21)

### Besoin
Donner, dans la barre latérale, la sécurité que l'Excel ne donne pas : voir d'un
coup d'œil où en est chaque phase de l'année, sans rien déclarer à la main.

### Ajouté
- `calculs.js` › `phaseStatuts(annee)` — **fonction pure** (zéro DOM) qui déduit
  l'état de chaque phase (`afaire` / `encours` / `termine`) à partir des données
  réelles, selon les règles validées avec le PERDIR :
  - **Phase 1** : terminé si structures + enveloppe DGH + ≥ 1 enseignant.
  - **Phase 2** : terminé si l'année est figée (snapshot).
  - **Phase 3** : terminé si tous les enseignants ont ≥ 1 affectation.
  - **Phase 4** : terminé si barrettes ET indisponibilités saisies.
- `index.html` : pastille `.nav-phase-pill` dans chaque en-tête de phase.
- `app.js` : `_renderPhaseStatuts()` colore les pastilles, appelé à chaque
  navigation et dans `renderAll()` (donc après import / restauration / changement
  d'année). Pastille simple à trois états (rouge / orange / vert).
- `tests/test-phases.js` : 12 cas unitaires couvrant les règles ci-dessus.

### Conformité SKILL
- Logique d'avancement = fonction pure dans `calculs.js`, testée hors navigateur.
- Couleurs via tokens (`--c-red` / `--c-amber` / `--c-green`), aucune en dur.

---

## v4.15.0 — Équipe fixe : créer / modifier / supprimer depuis la phase 1 (2026-06-21)

### Besoin
Dans la nouvelle navigation par phases, l'onglet « Équipe & HP/HSA » de la phase 1
doit permettre de gérer directement les membres de l'équipe fixe (ajout,
modification, suppression), sans avoir à basculer vers l'onglet « Équipe
pédagogique » de la phase 3.

### Ajouté
- `equipe.js` : bouton « + Ajouter un membre » visible au-dessus du tableau
  (et plus seulement à l'état vide) ; bouton « Supprimer » (✕) sur chaque ligne,
  à côté du bouton « Modifier » existant.
- Réutilisation des **fenêtres existantes et éprouvées** de `enseignants.js`
  (`openModalEns`, `confirmDeleteEns`) déjà câblées dans `app.js` — aucune
  duplication de logique de saisie ou de suppression.

### Corrigé
- `enseignants.js` › `execDeleteEns` : rafraîchit désormais la vue Équipe quand
  elle est active (la création le faisait déjà, pas la suppression). La ligne
  supprimée disparaît immédiatement du tableau de la phase 1.

### Conformité SKILL
- Boutons en délégation `data-action` (`open-ens-modal`, `edit-ens`,
  `delete-ens`), tous handlers déjà présents dans `app.js`. Zéro `onclick`.
- CSS via tokens (`--c-red` pour le survol « supprimer »), aucune couleur en dur.

---

## v4.14.0 — Navigation en « parcours de l'année » (4 phases pliables) (2026-06-21)

### Besoin
L'ancienne barre latérale mélangeait deux logiques : des sections temporelles
(« Préparer les instances ») et des sections par objet (« Équipe », « Outils »).
Rien n'indiquait *quand* on se sert de quoi. La barre devient un fil chronologique
qui suit le rythme réel du travail de l'année.

### Découpage retenu (validé)
- **Tableau de bord** — tout en haut, hors phases (point d'entrée).
- **Phase 1 · Construire & arbitrer la DGH** (dépliée par défaut) — Structures,
  Dotation DGH, Équipe & HP/HSA, HPC, Scénarios, Besoins & apports, Alertes.
- **Phase 2 · Présenter (CA / dialogue)** — Synthèse CA, Dialogue de gestion.
- **Phase 3 · Répartir les services** — Équipe pédagogique, Répartition, PACTE/IMP.
- **Phase 4 · Préparer l'EDT** — Contraintes EDT, Services enseignants.
- **Boîte à outils** — Historique (Export / Import / Restaurer restent les boutons
  d'action en bas de la barre).

### Comportement
- Pli/dépli **manuel**, aucun automatisme de date. Une seule phase dépliée à la
  fois ; les autres restent accessibles d'un clic, jamais masquées.
- La phase contenant l'onglet actif se **déplie automatiquement** lors d'une
  navigation (l'onglet en cours n'est jamais caché).

### Détail technique
- `index.html` : bloc `<nav>` reconstruit en phases (`.nav-phase` / `.nav-phase-hd`
  `data-phase-toggle` / `.nav-phase-items`). Chaque onglet reste un
  `.nav-item[data-view]` → le routage existant fonctionne sans modification.
- `app.js` : `_setPhase(n)` + branche de délégation `.nav-phase-hd` dans
  `_onGlobalClick` (après le test `.nav-item`, donc les onglets routent
  normalement) + auto-dépliage dans `navigate()`.
- `style.css` : styles des phases via tokens de thème uniquement, mode réduit
  géré (tous les onglets restent accessibles en icônes).
- **Aucune vue modifiée** : seul le contenant de navigation change.

### À suivre (non inclus dans cette version)
- Pastilles d'avancement par phase (à faire / en cours / terminé) — règles métier
  à valider avant implémentation.
- CRUD de l'équipe fixe dans l'onglet Équipe de la phase 1.

### Conformité SKILL
- Zéro `onclick` inline ; pli/dépli en délégation globale.
- Zéro couleur en dur ajoutée (tokens de thème).

---

## v4.13.0 — Import sécurisé : bouton « Restaurer la sauvegarde » (2026-06-21)

### Besoin
L'app créait déjà une sauvegarde de secours avant chaque import, mais celle-ci
n'était pas récupérable : en cas d'import par erreur (mauvais fichier, mauvaise
année), aucun moyen de revenir en arrière depuis l'interface. Pour un outil de
direction manipulant des données qu'on ne veut surtout pas perdre, ce filet doit
être actionnable d'un clic.

### Ajouté
- `data.js` › `restoreBackup()` — restaure la sauvegarde de secours. Fonctionne
  par **échange** : l'état courant devient la nouvelle sauvegarde, donc la
  restauration est elle-même réversible (un second clic revient en arrière).
  Refus propre si aucune sauvegarde n'existe ou si elle est invalide.
- `index.html` : bouton « ⟲ Restaurer » dans le bloc actions de la barre latérale
  (réutilise la classe `.btn-data`, aucun nouveau style, compatible mode réduit).
- `app.js` : câblage du bouton avec confirmation explicite avant écrasement, puis
  re-rendu complet et toast de confirmation.
- `tests/test-import.js` : +3 cas (retour à l'état d'avant import, réversibilité,
  refus propre sans sauvegarde) → 10 cas au total.

### Conformité SKILL
- Tout accès `localStorage` reste dans `data.js` ; `app.js` passe par l'API.
- Aucun `onclick` inline ; bouton statique câblé en `addEventListener` dans l'init
  (même motif que `btnExport` / `btnImport`).
- Aucune couleur en dur ajoutée (classe `.btn-data` réutilisée).

---

## v4.12.2 — Robustesse : filet de test de l'import / migration (2026-06-21)

### Besoin
La promesse centrale de l'outil est « je retrouve mes données », y compris des
années plus tard à partir d'un fichier exporté par une ancienne version. Rien ne
garantissait jusqu'ici qu'un sprint futur ne casse pas silencieusement la
relecture des anciens fichiers.

### Ajouté
- `tests/fixtures/legacy-4.8.0.json` — un vrai fichier de données 4.8.0 conservé
  comme témoin de compatibilité ascendante.
- `tests/test-import.js` — rejoue le vrai chemin `DGHData.importJSON` (avec
  `localStorage` / `FileReader` simulés) et vérifie : import 4.8.0 sans rejet,
  migration exécutée (version réestampillée), structure conforme au schéma
  courant, calcul métier réel exécuté sans erreur sur les données migrées,
  rejet propre des fichiers invalides, présence d'une sauvegarde de secours.
- `SKILL.md` : bloc « tests automatisés à lancer avant livraison » (3 commandes).

### Conformité SKILL
- Aucune modification de logique applicative, de schéma ni d'UI.
- Test pur (Node), même mécanique que `tests/test-service.js`.

---

## v4.12.1 — Maintenance : resynchronisation des versions + garde-fou (2026-06-21)

### Besoin
Le numéro de version était écrit à une dizaine d'endroits qui ne concordaient
plus : le footer affichait `4.9.7`, le README annonçait `4.8.0`, alors que la
version réellement livrée (CHANGELOG) était `4.12.0`. Sur un projet destiné à
durer plusieurs années, cette dérive doit être impossible.

### Corrigé
- Tous les marqueurs de version réalignés sur la version courante : footer
  `index.html`, suffixes de cache `?v=` (redevenus homogènes), `data.js`
  `VERSION`, `data/exemple.json` `_meta.version`, titre + badge `README.md`,
  ligne « Version courante » du `SKILL.md`.

### Ajouté
- `tests/check-version.js` — garde-fou Node sans dépendance. Prend `data.js`
  `VERSION` comme source de vérité et échoue (exit 1) si un marqueur diverge.
  À exécuter avant chaque livraison.
- `SKILL.md` : commande `node tests/check-version.js` ajoutée à la checklist
  de version.

### Conformité SKILL
- Aucune modification de logique applicative, de schéma ni d'UI.
- Script de test pur (Node), cohérent avec `tests/test-service.js`.

---

## v4.12.0 — Sprint 22 : Alerte BMP — suggestions de pilotage (2026-06-21)

### Besoin
Quand les HSA d'une discipline dépassent ce que les chaires en place peuvent absorber
de façon imposable, la direction repose sur du volontariat pour boucler sa structure.
L'outil doit signaler ce risque et suggérer qu'un BMP serait plus sûr — avec un
argument chiffré défendable en dialogue de gestion.

### Règle métier validée
- **Capacité HSA imposable** = nb enseignants `titulaire` (temps plein) dont
  `disciplinePrincipale` = la discipline × 2. BMP, contractuels, TZR et
  temps partiels exclus de la capacité.
- **HSA effectives** = HSA réelles (dotation) + HSA du scénario actif = photo
  complète, pas seulement le delta du scénario.
- **Seuil de déclenchement** : dépassement ≥ 3h (en dessous, un BMP n'est pas
  réaliste à instruire).
- **Suggestion** : volume BMP = le dépassement exact, exprimé en heures et en
  fraction de support (ORS de référence 18h certifié).

### Ajouté
- `calculs.js` › `alertesBMP(anneeData, modificateurs, seuil)` — fonction pure,
  renvoie la liste des disciplines en dépassement triées par urgence décroissante.
- `dashboard.js` › `_renderAlertesBMP` — encart **distinct** de l'encart
  Vérification (bleu, conseil de gestion) : masqué si aucune alerte, déplié avec
  une ligne par discipline si des alertes existent. Toggle replier/déplier.
- `index.html` : conteneur `#dashAlertesBMP` sous `#dashVerifs`.
- `app.js` : délégation `data-action="toggle-bmp"`.
- `verifs.js` : +4 cas (51 vérifications) : dépassement ≥ seuil, dans capacité,
  sous seuil, exclusion BMP/contractuels.

### Conformité SKILL
- Aucun `onclick` inline ; toggle via délégation globale.
- `alertesBMP` est une fonction pure testée navigateur + Node.
- Styles via tokens (`--c-blue`, `--c-blue-bg`), compatibles thème sombre.

---



### Besoin
En janvier, la ventilation HP/HSA d'une modalité ne devrait pas être une question
posée à chaque saisie : c'est une conséquence de l'enveloppe. On remplit d'abord
les heures-poste disponibles (service dû), et le débordement part en HSA. La
direction doit pouvoir forcer à la marge pour caler le solde.

### Comportement (interprétation « enveloppe », raisonnement en masse)
- Chaque modalité de scénario consomme d'abord l'**enveloppe HP disponible**
  (`hPosteEnveloppe − HP déjà engagé`), puis bascule en **HSA** au-delà.
- **Ordre = ordre de saisie** des modalités (option retenue : la plus lisible).
- Une modalité peut être **à cheval** : 2h HP dispo + modalité 5h → 2 HP + 3 HSA,
  avec la mention « enveloppe HP épuisée ».
- **Forçage** par modalité (`Auto` / `HP forcé` / `HSA forcé`) : mémorisé, prime
  sur l'auto, réversible. HSA forcé n'entame pas l'enveloppe HP ; HP forcé est
  respecté même enveloppe épuisée.

### Modifié
- `calculs.js` › `bilanScenario` : ventilation par consommation d'enveloppe
  (fonction `_ventiler`), au lieu d'un type figé par modalité. `detailParMod`
  expose désormais `coutHP`/`coutHSA` réels (peuvent être mixtes) + `forcage`.
- `data.js` : **migration v4.10** — `modificateur.typeHeure` → `modificateur.forcage`.
  Les scénarios existants sont convertis en forçage explicite : **comportement
  identique**, aucune valeur ne bouge.
- `pilotage.js` : imputation par défaut = **Auto** ; sélecteurs et badges affichent
  Auto / HP forcé / HSA forcé ; récap discipline affiche la ventilation réelle
  (chip mixte « x HP + y HSA » le cas échéant). Panneau nominatif : fallback aligné
  sur `forcage` (l'onglet nominatif détaillé reste pour plus tard).
- `verifs.js` : +5 cas scénario (6 → 11 cas, 30 → 40 vérifications) : auto plein HP,
  à cheval, épuisement sur 2 modalités, forçage HP, forçage HSA. Visibles dans
  l'encart « Vérification » du tableau de bord.

### Conformité SKILL
- Aucun `onclick` inline ; toggles via délégation globale existante.
- Styles via tokens (`--c-accent-light`), compatibles thème sombre.
- `bilanScenario` reste une fonction pure (testée navigateur + Node).

### Reste à faire (brique 2, sprint suivant)
- Alerte « capacité HSA imposable dépassée → BMP » par discipline
  (seuil = nb titulaires temps plein rattachés × 2), sur HSA effectives.

---



### Contexte
Pour qu'un autre personnel de direction ose confier sa vraie DGH à l'outil, il
faut une preuve visible que les calculs d'heures (HP/HSA, ORS, bascule, BMP,
sous-service) tombent juste — et qu'ils le restent après chaque sprint. C'est le
chantier « confiance » identifié comme prioritaire.

### Ajouté
- **`assets/js/verifs.js`** — batterie de contrôles métier (fonctions pures,
  zéro DOM/localStorage) rejouée sur `calculs.js`. 7 cas, 30 vérifications :
  chorale HP/HSA × prof 18h/16h, BMP, temps partiel, contractuel sans ORS.
  Les cas sont définis **une seule fois** ici (pas de duplication).
- **Encart « Vérification » sur le tableau de bord** (`dashboard.js` ›
  `_renderVerifs`), modelé sur le bandeau scénario :
  - tout OK → ligne verte sobre, repliée, dépliable au clic ;
  - au moins un échec → bandeau **rouge bien visible**, détail des contrôles
    fautifs déplié d'office. Se relance à chaque rendu du tableau de bord.
- **`tests/test-service.js`** — même batterie, hors navigateur
  (`node tests/test-service.js`), pour le filet de sécurité de développement.
  Réutilise `verifs.js` : navigateur et CLI disent toujours la même chose.

### Note métier (à trancher)
Le cas 1 documente la règle ACTUELLE : une chorale typée HP dont le prof dépasse
son ORS bascule **silencieusement** en HSA (les disciplines sont servies en HP en
priorité). Si l'on préfère garder la chorale en HP et lever une **alerte de
dépassement**, c'est une évolution de `serviceTotalEnseignant` — l'encart
servira à la border.

### Conformité
- Aucune ligne ajoutée à `calculs.js` (lecture seule).
- Aucun `onclick` inline ; toggle replier/déplier via délégation globale
  (`data-action="toggle-verifs"` dans `app.js`).
- Styles dans `style.css` (tokens existants `--c-green`/`--c-red`, compatibles
  thème sombre).

---



### Ajouté
- **Nouvel onglet « Besoins & apports établissement »** (Cadre de l'année).
  Par discipline : besoin (répartition × divisions, + scénario actif si présent)
  vs apport HP de l'équipe, HSA dans une colonne séparée, écart chiffré pour
  calibrer les BMP. **HSA absorbées** saisissables par discipline, avec détail
  dépliable par enseignant de la discipline. Export Excel.
  Calcul : `Calculs.bilanBesoinsApports`. Persistance : `ann.hsaAbsorbees`.
- **Grades PSTG et FSTG** (professeur / fonctionnaire stagiaire), ORS 18 h par
  défaut, éditable. Ajoutés dans `calculs.js`, `enseignants.js` et la fiche.
- **Tri du tableau Équipe pédagogique** (vue par enseignant) : colonnes Nom,
  Discipline, ORS, HP disc. et HSA cliquables — re-clic = sens inverse.

### Corrigé
- **Boîtes de dialogue qui se fermaient au clic.** Sélectionner une valeur dans
  un menu déroulant pouvait fermer la modale si la souris était relâchée sur le
  fond. La fermeture par fond ne se déclenche désormais que si le geste a
  *débuté* sur le fond (suivi du `mousedown`).

### Schéma
- Année : ajout de `hsaAbsorbees` ({ [disciplineId]: { total, profs } }).
  Migration automatique (v4.9.7).

### À venir (noté)
- Vue Équipe : afficher réel + simulé côte à côte quand un scénario est actif.

---

## v4.9.6 — Sprint 19 : bascule automatique HP / HSA et vue Équipe (2026-06-18)

### Contexte
Clarification de la répartition Heures-Poste (HP) / HSA, qui conditionne le
calcul de la dotation et la remontée TRM de février. Les enseignants en poste
et les BMP sont comptabilisés en heures-poste sur leur apport dans
l'établissement ; tout dépassement bascule automatiquement en HSA.

### Ajouté
- **Bascule automatique HP → HSA** (`calculs.js` › `serviceTotalEnseignant`).
  L'apport de chaque enseignant compte en HP jusqu'à son seuil, le dépassement
  devient HSA. Aucune ressaisie : un seul chiffre d'apport pilote tout.
- **Seuil HP par statut** (`calculs.js` › `plafondHP`) : ORS du grade pour les
  titulaires/TZR ; volume du bloc pour les BMP ; ORS manuelle motivée sinon.
- **Champ « Volume du BMP »** dans la fiche enseignant — visible uniquement
  pour le statut BMP, sert de plafond HP.
- **Champ « Motif de l'ORS modifiée »** — obligatoire dès que l'ORS diffère de
  l'ORS réglementaire du grade (mission, décharge, temps partiel). Repris dans
  l'export TRM.
- **Aperçu HP/HSA en direct** dans la fiche enseignant pendant la saisie.
- **Nouvelle vue « Équipe & HP/HSA »** (Cadre de l'année) : tableau de
  constitution de l'équipe, apport de chacun, seuil, HP, HSA, barre de
  répartition, totaux par statut et synthèse vs enveloppe. Export CSV « TRM ».
- **Carte « Service de l'équipe — apport réel »** sur le tableau de bord :
  HP/HSA consommées par l'équipe, solde vs enveloppe.
- **`bilanEquipe`** (`calculs.js`) : agrégat HP/HSA établissement, source de
  vérité pour la TRM. Intégré à `bilanDotation` (`equipeHP`, `equipeHSA`…).

### Schéma
- Enseignant : ajout de `volumeBMP` et `motifORS`. Migration automatique
  (v4.9.6) — les enseignants existants reçoivent ces champs vides.

---

## v4.9.5 — Audit métier : indisponibilités effectives, cascades de suppression, validations (2026-06-18)

### Contexte
Seconde revue approfondie, orientée attentes métier (DGH, structure, préparation
EDT et compatibilité Index Éducation). Objectif : que chaque fonctionnalité
produise réellement l'effet attendu par un chef d'établissement, et que les
données restent cohérentes après toute opération.

### Corrigé — fonctionnel métier
- **Indisponibilités enseignants : saisie sans effet sur les calculs.** La saisie
  se fait via la grille visuelle (`grillesIndispo`), mais le calcul de l'heure
  bleue (`creneauBleuOptimal`) et les contrôles EDT (`controlesEDT`) lisaient
  l'ancien tableau `indisponibilites[]`, désormais non alimenté par l'interface.
  Conséquence : les indisponibilités saisies étaient **ignorées** par les deux
  fonctionnalités phares du module EDT. Ajout d'un adaptateur unique
  `DGHData.getIndisponibilitesPourCalcul()` qui convertit la grille
  (`'lun-08':'dure'` → créneau horaire typé) et fusionne avec l'ancien format ;
  branché sur l'heure bleue et la notice EDT. La recommandation d'heure bleue et
  les alertes tiennent maintenant compte des indisponibilités réelles.
- **Détection « indisponible toute la semaine »** : le seuil fixe de 5 jours en
  « journée entière » ne se déclenchait jamais avec la grille (créneaux horaires)
  ni pour les établissements à 4 jours. Remplacé par une comparaison aux jours
  réellement ouvrés de l'établissement.

### Corrigé — intégrité des données (cascades de suppression)
- **Suppression d'une division** : nettoie désormais aussi les groupes EDT
  rattachés (et supprime ceux devenus vides), ainsi que les slots de barrettes
  pointant sur la division ou sur un groupe supprimé. Plus de groupes ni de slots
  orphelins.
- **Suppression d'un enseignant** : nettoie désormais sa grille d'indisponibilités
  (`grillesIndispo[ensId]`), qui restait auparavant en base.
- **Suppression d'une discipline** : nettoie désormais les `disciplineIds` des
  barrettes et des groupes EDT, et les `discId` de slots concernés (plus de « ? »
  résiduels).

### Ajouté — validations de saisie (compatibilité Index Éducation)
- **Divisions** : refus des libellés en doublon (Index Éducation impose des
  libellés de division uniques) et des effectifs négatifs.

### Nettoyé — qualité de code (règle « zéro code zombie » du SKILL.md)
- Suppression de trois fonctions mortes : `_htmlListeBarrettes` (ancienne vue
  liste remplacée par le kanban, ~40 lignes), `_heuresHint` (enseignants),
  `_set` (répartition).

### Vérifications
Banc d'essai d'exécution étendu : chargement des 16 fichiers, rendu des 10 vues,
parcours des 5 onglets EDT, cycles écriture/relecture, cascades de suppression et
validations — tous au vert sur les données d'exemple. Audit RGPD : zéro appel
réseau, stockage strictement local. Audit XSS : échappement systématique au point
d'insertion HTML confirmé.

## v4.9.4 — Correctifs de robustesse : audit complet et réparation des chemins EDT/Structures (2026-06-17)

### Contexte
Audit développement approfondi de l'ensemble du code (≈11 000 lignes JS). Plusieurs
régressions silencieuses introduites lors des sprints EDT (v4.8/v4.9) ne se
manifestaient qu'à l'exécution, sur des onglets précis — non détectables par une
simple vérification de syntaxe. Toutes ont été reproduites puis corrigées, et un
banc d'essai d'exécution (chargement des modules + rendu de toutes les vues +
parcours des onglets EDT + cycles écriture/relecture sur données d'exemple) valide
désormais l'ensemble.

### Corrigé
- **EDT — module entièrement cassé au chargement.** Les fonctions
  `startAddClibre / editClibre / cancelClibre / saveClibre / deleteClibre` étaient
  listées dans l'API publique de `DGHEdt` mais jamais définies ; l'évaluation du
  bloc `return` levait une `ReferenceError`, laissant `DGHEdt` indéfini et faisant
  planter toute l'application (app.js appelle `DGHEdt.renderEdt()`). Les cinq
  fonctions et le formulaire `_htmlFormClibre` (intitulé, jour, plage horaire,
  enseignants et classes concernés) ont été implémentés dans le style des
  formulaires existants (co-interventions).
- **EDT — onglets « Indisponibilités » et « Heure bleue » non fonctionnels.** Les
  méthodes `getGrilleIndispo / setGrilleIndispo / getGrilleHeureBleue /
  setGrilleHeureBleue` existaient dans `data.js` mais étaient absentes de l'export
  de `DGHData` (« is not a function » au rendu). Exportées.
- **Dotation — modale « Ajouter un groupe de cours » plantait.** Lecture de
  `Calculs.GRILLES_MEN`, constante non exportée par `Calculs` → `Object.entries(undefined)`.
  Constante exportée + garde défensive côté appelant.
- **Structures — onglet « Groupes » plantait au rendu** (`genBannerHtml is not
  defined`) : la bannière de génération rapide n'était jamais construite. Appel au
  constructeur existant `_htmlGenGroupesRapides()` rétabli.
- **Structures — bouton « Génération rapide — demi-classes » inactif** : aucun
  handler ne reliait `data-action="sg-generer-groupes-rapides"` à
  `genererGroupesRapides()`. Délégation ajoutée dans `app.js`.

### Modifié
- Nettoyage d'une écriture morte `DGHMissions._editId = _editId` (jamais relue).
- Harmonisation des numéros de version : l'archive annonçait v4.9.4 alors que tout
  le code restait figé en v4.8.0 (badge, cache-busters `?v=`, en-têtes de modules).

## v4.8.0 — Préparation EDT : salles, heure bleue, indisponibilités, notice consolidée (2026-06-17)

### Contexte
Sprint conçu pour que l'application devienne un atout concret au moment de la saisie
dans Index Éducation : centraliser, avant d'ouvrir EDT, toutes les contraintes
aujourd'hui dispersées entre fiches papier, mémoire et tableurs.

### Ajouté
- **Salles spécialisées** (modale Établissement → onglet « Salles & Heure bleue ») :
  référentiel des salles critiques (labo SVT, Physique-Chimie, Musique, Arts
  plastiques, Technologie…) avec nombre d'exemplaires disponibles. Sert de base à la
  détection de saturation dans la notice EDT.
- **Heure bleue avec recommandation de créneau optimal.** L'utilisateur saisit 1 à 4
  créneaux candidats ; l'application calcule pour chacun le nombre d'enseignants
  réellement disponibles (hors indisponibilités dures et contraintes libres qui les
  concernent, pénalité partielle pour les vœux souples) et recommande le meilleur.
  Limite assumée et affichée : ignore les cours déjà posés dans Index Éducation
  (donnée non disponible côté DGH App).
- **Indisponibilités enseignants** (nouvel onglet « Indisponibilités » du module EDT) :
  distinction explicite entre indisponibilité **dure** (réelle — BMP sur un autre
  établissement, temps partiel non travaillé) et **vœu souple** (à éviter, non
  bloquant). Saisie par jour + plage (matin/après-midi/journée/créneau précis).
- **Contraintes libres** : contraintes ad hoc à titre libre (ex. « Orchestre —
  Conservatoire », jeudi 8h–11h), pouvant concerner des classes ET/OU des enseignants.
- **Fréquence semaine A/B sur les barrettes.** Chaque slot d'une barrette porte
  désormais une fréquence (`hebdo` / `semaine-A` / `semaine-B`), réglable
  indépendamment par slot — permet par exemple un même groupe en SVT semaine A et en
  Physique-Chimie semaine B.
- **Notice EDT** (remplace la Fiche synthèse) : document consolidé et imprimable en
  7 sections dans l'ordre du flux réel de préparation — alertes détectées, cadre
  général (dont heure bleue retenue), salles spécialisées, contraintes enseignants,
  contraintes libres, barrettes (avec tag de fréquence), co-interventions.
- **Détection de conflits** (`Calculs.controlesEDT`) : enseignant dans deux barrettes à
  fréquence incompatible, salle spécialisée saturée (plus de cours simultanés que
  d'exemplaires disponibles), indisponibilité dure suspecte (journée entière sur les
  5 jours).

### Modifié
- Module EDT : 3 → 4 onglets (Barrettes, Co-interventions, Indisponibilités, Notice EDT).
- `data.js` : migration v4.8.0 — `etablissement.salles[]`, `etablissement.heuresBleues`,
  `contraintesEDT.indisponibilites[]`, `contraintesEDT.contraintesLibres[]`,
  `barrette.slots[].frequence`. Cascades de suppression étendues (`deleteEnseignant`,
  `deleteDivision`) pour couvrir les nouvelles références croisées.
- `data/exemple.json` enrichi avec des données représentatives du nouveau schéma.

### Précision historique
Un champ `contraintesEDT.indisponibilites` avait été retiré en v3.8 avec la mention
« gérées directement dans Index Éducation ». Ce sprint le réintroduit avec un schéma
distinct (dure/souple + créneaux + motif) répondant à un besoin de préparation amont,
non de gestion fine heure par heure — ce n'est pas un retour en arrière.

### Détails techniques
- `calculs.js` : `controlesEDT(anneeData, etab)`, `creneauBleuOptimal(enseignants, indisponibilites, contraintesLibres, creneaux)` — fonctions pures.
- `data.js` : `getSalles/addSalle/updateSalle/deleteSalle`, `getHeuresBleues/setHeuresBleues`, `getIndisponibilites/...Enseignant/add/update/delete`, `getContraintesLibres/add/update/delete`.
- `etab.js` : `renderSalles`, `renderHeuresBleues`, `hbAddCreneau/hbRemoveCreneau/hbToggleActif/hbCalculer`.
- `edt.js` : onglet `indispos` (formulaires indisponibilité + contrainte libre), notice refondue, sélecteur de fréquence sur chaque slot de barrette.
- `index.html` : modale Établissement +1 onglet ; vue EDT 3→4 onglets ; cache-busting `?v=4.8.0`.
- `style.css` : classes `.salle-*`, `.hb-*`, `.edt-indispo-*`, `.edt-clibre-*`, `.edt-freq-tag`, `.edt-notice-*`.
- `tutorial.js` : contenu d'aide de l'onglet EDT mis à jour, `CONTENT_VER` 1→2.

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
