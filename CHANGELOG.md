# Changelog — DGH App

Toutes les modifications notables sont documentées ici.  
Format : [Semantic Versioning](https://semver.org/) — `MAJEUR.MINEUR.CORRECTIF`

---

## [1.1.0] — Sprint 2 — Structures de classes

### Ajouté
- ⊞ **Module Structures** — vue complète avec barre KPI (divisions, effectif total, niveaux présents)
- ➕ Ajout, modification et suppression de divisions avec modal dédié
- 🏷️ Badges niveaux colorés (6e=bleu, 5e=indigo, 4e=vert, 3e=amber, dispositifs=rouge)
- 🏷️ Tags options (LV2, Latin…) et dispositif (ULIS, UPE2A, SEGPA, PAP, PPS)
- 🗑️ Confirmation explicite avant suppression (modal dédiée, irréversible)
- 📊 KPI Divisions + Effectif ajoutés au Dashboard
- ◬ Alerte automatique si aucune division saisie
- `resumeStructures()` dans `calculs.js` — fonction pure de bilan par niveau

### Modifié
- `data.js` → v1.1.0 : CRUD structures (`addDivision`, `updateDivision`, `deleteDivision`, `getStructures`, `getDivision`)
- `data.js` → migration automatique des données v1.0.0 (rétrocompatibilité)
- `app.js` → v2.3 : `_renderStructures()`, `_openModalDiv()`, `_saveModalDiv()`, `_confirmDeleteDiv()`, `_execDeleteDiv()`
- `calculs.js` → v1.1.0 : `resumeStructures()` + alerte structures vides
- `index.html` → v1.1.0 : vue structures, 2 nouvelles modals, KPI dashboard enrichi
- `style.css` → v2.2 : styles module structures, `.btn-danger`, `.form-row-2`, badges niveaux

### Technique
- Zéro `onclick` inline — 100% `addEventListener` + délégation `[data-action]`
- Échappement HTML (`_esc()`) sur toutes les données affichées en `innerHTML`
- Toutes les vérifications d'intégrité du SKILL.md passent ✅

---

## [1.0.0] — Sprint 1 — Dashboard & infrastructure

### Ajouté
- 🏠 **Dashboard** — KPIs (enveloppe DGH, heures affectées, solde, alertes, enseignants, HSA)
- 📊 Barre de progression de consommation DGH
- ⚙️ Modal paramètres établissement (nom, UAI, académie, enveloppe DGH)
- 🗂️ Navigation sidebar avec 8 modules (Dashboard, Structures, Dotation, Enseignants, Simulation, Alertes, Synthèses, Historique)
- 🔄 Gestion multi-années scolaires (basculement + historique)
- 💾 Export JSON local (`Ctrl+S` ou bouton Exporter)
- 📥 Import JSON avec backup automatique avant remplacement
- 🔔 Système de notifications toast (succès, erreur, info, warning)
- 🧠 Moteur ORS intégré (certifié 18h, agrégé 15h, PLP 17h, EPS 20h, doc 36h, CPE 35h)
- 📐 Grilles horaires MEN collège (6e/5e/4e/3e) modifiables
- ◬ Alertes automatiques (dépassement DGH, sous-services, HSA élevées)
- 📱 Interface responsive (desktop + tablette + mobile)
- 🔐 RGPD : données 100% locales, `.gitignore` protège les fichiers JSON

### Architecture
- `data.js` — couche données (localStorage + import/export)
- `calculs.js` — moteur de calcul pur (ORS, HSA, bilan DGH, alertes)
- `app.js` — contrôleur UI (navigation, rendu, events)
- `SKILL.md` — instructions de développement cohérent avec Claude

---

## À venir

### [1.2.0] — Sprint 3
- ◎ Module Dotation DGH (répartition par discipline, calcul des besoins via grilles MEN)

### [1.3.0] — Sprint 4
- ◉ Module Enseignants (fiches individuelles, ORS, HSA, TZR, compléments)

### [1.4.0] — Sprint 5
- ⟳ Module Simulation (scénarios sans modifier les données réelles)
- ◬ Module Alertes enrichi (vue dédiée avec navigation vers la source)

### [1.5.0] — Sprint 6
- ▤ Module Synthèses (export PDF + tableaux HTML pour CA et équipes)
- Pacte enseignant + IMP

### [2.0.0] — Sprint 7
- ◷ Module Historique (comparaisons pluriannuelles)
- Import partiel STS Web
