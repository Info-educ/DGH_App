# Changelog — DGH App

Toutes les modifications notables sont documentées ici.  
Format : [Semantic Versioning](https://semver.org/) — `MAJEUR.MINEUR.CORRECTIF`

---

## [1.0.0] — 2025-XX-XX

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

### [1.1.0] — Sprint 2
- ⊞ Module Structures de classes (divisions, niveaux, effectifs, options, dispositifs)

### [1.2.0] — Sprint 3
- ◎ Module Dotation DGH (répartition par discipline, calcul des besoins)

### [1.3.0] — Sprint 4
- ◉ Module Enseignants (fiches individuelles, ORS, HSA, TZR, compléments)

### [1.4.0] — Sprint 5
- ⟳ Module Simulation (scénarios)
- ◬ Module Alertes (vue dédiée)

### [1.5.0] — Sprint 6
- ▤ Module Synthèses (PDF + HTML pour CA)
- Pacte enseignant + IMP

### [2.0.0] — Sprint 7
- ◷ Module Historique (comparaisons pluriannuelles)
- Import partiel STS Web
