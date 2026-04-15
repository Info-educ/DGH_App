# Changelog — DGH App

Toutes les modifications notables sont documentées ici.  
Format : [Semantic Versioning](https://semver.org/) — `MAJEUR.MINEUR.CORRECTIF`

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
