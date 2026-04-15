# ◈ DGH App — v3.0.2

> Outil de pilotage de la Dotation Globale Horaire pour collège  
> Développé par et pour les personnels de direction d'EPLE

[![Version](https://img.shields.io/badge/version-3.0.2-green)](#)
[![Licence](https://img.shields.io/badge/licence-MIT-lightgrey)](#)
[![RGPD](https://img.shields.io/badge/RGPD-100%25%20local-blue)](#)

---

## 🎯 Objectif

DGH App permet à une équipe de direction de collège de **piloter, ventiler et documenter la répartition de la DGH** — de l'enveloppe globale reçue de la DSDEN jusqu'aux services individuels des enseignants, en passant par les structures de classes, les groupes de cours et toutes les heures pédagogiques complémentaires.

---

## 🔐 RGPD & Confidentialité

> **Les données ne quittent jamais votre poste.**

- Application **100% dans le navigateur** — aucun serveur, aucun cloud, aucune dépendance externe
- Données stockées dans le `localStorage` du navigateur
- Export/import via fichier **JSON local** (à conserver sur votre poste ou un Drive privé d'équipe)
- `.gitignore` exclut les données réelles du dépôt Git
- Compatible partage par clé USB ou Drive privé d'équipe de direction

---

## 🚀 Utilisation

### Sans installation
Télécharger le ZIP → extraire → ouvrir `index.html` dans Chrome ou Firefox.  
Aucun serveur, aucune installation, aucune connexion internet requise.

### Avec GitHub Pages
```bash
git clone https://github.com/Info-educ/DGH_App.git
# Pousser sur GitHub → Pages se met à jour automatiquement
```

### Raccourcis clavier
| Raccourci | Action |
|-----------|--------|
| `Ctrl+S` | Exporter les données (JSON) |
| `Échap` | Fermer la modal ouverte |

---

## 📦 Modules — État d'avancement

| Module | Description | Statut |
|--------|-------------|--------|
| ⬡ **Dashboard** | KPIs (enveloppe HP/HSA, solde, divisions), barre de progression duale, résumé disciplines | ✅ v3.0 |
| ⊞ **Structures** | Saisie matricielle (6e→3e), tableau récap par niveau avec h théoriques MEN, dispositifs masqués | ✅ v3.0 |
| ◎ **Dotation DGH** | Enveloppe HP/HSA séparée, suggestion auto depuis besoin MEN, tableau disciplines avec groupes de cours dépliables, sélection par classes | ✅ v3.0 |
| ◈ **H. Péda. Complémentaires** | Options, labo/TP, dispositifs, arts & culture, sport, accompagnement — avec sélection classes et calcul effectif auto | ✅ v3.0 |
| ◉ **Enseignants** | Services individuels, ORS auto par grade, HSA, TZR, compléments | 🔜 Sprint 6 |
| ◷ **Pilotage pédagogique** | Dédoublements, co-enseignement, simulation impact DGH | 🔜 Sprint 7 |
| ◬ **Alertes** | Dépassements, sous-services, anomalies détectées automatiquement | ✅ actif (enrichissement Sprint 6) |
| ▤ **Synthèses** | Documents imprimables pour CA + tableaux HTML copiables | 🔜 Sprint 8 |
| ◷ **Historique** | Comparaisons pluriannuelles, évolution DGH | 🔜 Sprint 9 |
| ⟳ **Import TRM** | Import du Tableau de Répartition des Moyens DSDEN pour pré-remplir HP/HSA | 🔜 Sprint 6 |

---

## 🏫 Concepts métier intégrés

### Enveloppe DGH
La DGH (Dotation Globale Horaire) se compose de deux types d'heures :
- **H-Poste (HP)** : heures structurelles qui constituent les postes d'enseignants — attribuées par la DSDEN. Ce sont les heures qui "font" les emplois du temps.
- **HSA (Heures Supplémentaires Annuelles)** : heures supplémentaires payées, votées lors du CA — budget de l'établissement. Ne constituent pas de postes.

### Besoin théorique MEN
Calculé automatiquement depuis les grilles horaires nationales (BO spécial n°11 du 26 novembre 2015) × nombre de divisions par niveau. Sert de référence pour la ventilation et la détection d'écarts.

### Grilles horaires intégrées (h/élève/semaine)

| Discipline | 6e | 5e | 4e | 3e |
|------------|----|----|----|----|
| Français | 4,5 | 4,5 | 4,5 | 4 |
| Mathématiques | 4,5 | 3,5 | 3,5 | 4 |
| Histoire-Géographie | 3 | 3 | 3 | 3,5 |
| LV1 | 4 | 3 | 3 | 3 |
| LV2 | — | 2,5 | 2,5 | 2,5 |
| SVT | 1,5 | 1,5 | 1,5 | 1,5 |
| Physique-Chimie | — | 1,5 | 1,5 | 1,5 |
| Sciences & Techno | 1,5 | — | — | — |
| Technologie | — | 1,5 | 1,5 | 1,5 |
| Arts plastiques | 1 | 1 | 1 | 1 |
| Éducation musicale | 1 | 1 | 1 | 1 |
| EPS | 3 | 3 | 3 | 3 |
| EMC | 0,5 | 0,5 | 0,5 | 0,5 |
| AP | 3 | 2 | 2 | 2 |

### Groupes de cours vs Heures pédagogiques complémentaires

**Groupes de cours** (dans Dotation DGH, sous-lignes d'une discipline) :  
Heures de cours rattachées à une discipline de la grille, avec scission de classes.  
Ex : *LV2 Espagnol* (5eA + 5eB + 5eC) et *LV2 Allemand* (5eC uniquement) s'imputent tous deux sur la discipline LV2. L'effectif est calculé automatiquement depuis les classes sélectionnées.

> ⚠️ Une classe peut appartenir à **plusieurs groupes simultanément** sur le même créneau horaire (ex : 5eC → groupe Espagnol ET groupe Allemand). Chaque groupe coûte une heure prof distincte. L'impact DGH exact par créneau sera modélisé dans le module Pilotage pédagogique (Sprint 7).

**Heures pédagogiques complémentaires** (onglet dédié) :  
Heures hors grille standard — options (Latin, Grec), labo/TP, savoir nager, chorale, orchestre, devoirs faits, HVC, AP dédoublé, UNSS…

### ORS intégrées

| Corps / Grade | ORS hebdomadaire |
|---------------|-----------------|
| Certifié, Contractuel | 18 h |
| Agrégé | 15 h |
| PLP | 17 h |
| Professeur d'EPS | 20 h |
| Documentaliste | 36 h présence |
| CPE, Psy-EN | 35 h |

Les ORS sont modifiables manuellement par enseignant (réductions réglementaires, BMP, etc.).

---

## 💾 Gestion des données

### Format du fichier JSON (v3.0)
```json
{
  "_meta": { "version": "3.0.0", "updatedAt": "..." },
  "etablissement": { "nom": "...", "uai": "...", "academie": "..." },
  "anneeActive": "2025-2026",
  "annees": {
    "2025-2026": {
      "dotation": {
        "hPosteEnveloppe": 320,
        "hsaEnveloppe": 30,
        "commentaire": ""
      },
      "structures": [
        { "id": "div_...", "niveau": "6e", "nom": "6eA", "effectif": 28, "dispositif": null }
      ],
      "disciplines": [
        { "id": "disc_...", "nom": "Français", "couleur": "#3b82f6" }
      ],
      "repartition": [
        {
          "disciplineId": "disc_...",
          "hPoste": 18, "hsa": 2, "commentaire": "",
          "groupesCours": [
            { "id": "gc_...", "nom": "LV2 Espagnol", "classesIds": ["div_...", "div_..."], "heures": 2.5 }
          ]
        }
      ],
      "heuresPedaComp": [
        { "id": "hpc_...", "nom": "Latin 4e", "categorie": "option", "disciplineId": null, "classesIds": ["div_..."], "heures": 3, "effectif": 12 }
      ],
      "enseignants": []
    }
  }
}
```

### Migrations automatiques
`data.js` migre automatiquement les fichiers des versions précédentes :
- v1 → v2 : `heuresAllouees` → `hPoste`
- v2 → v3 : `dotation.enveloppe` → `hPosteEnveloppe` + `hsaEnveloppe`
- v2 → v3 : `groupes` → `heuresPedaComp` (avec mapping des catégories)

---

## 🏗️ Architecture technique

```
dgh-app/
├── index.html              # SPA — toutes les vues (sections HTML)
├── assets/
│   ├── css/style.css       # Design system complet (light + dark)
│   └── js/
│       ├── data.js         # Couche données (localStorage + import/export + migrations)
│       ├── calculs.js      # Moteur de calcul pur (ORS, DGH, besoins MEN, suggestions)
│       └── app.js          # Contrôleur UI (navigation, rendu, délégation événements)
├── data/
│   └── exemple.json        # Données fictives anonymisées
├── SKILL.md                # Instructions de développement pour Claude
├── CHANGELOG.md
└── README.md
```

**Stack : HTML5 + CSS3 + JS Vanilla**  
Zéro dépendance, zéro build, zéro framework. Maintenable en autonomie sur plusieurs années.

---

## 🗓️ Feuille de route

### Sprint 6 — Enseignants & TRM
- Module enseignants : fiche par personne (grade → ORS auto, services affectés, HSA, TZR, compléments de service)
- Import TRM DSDEN (CSV ou copier-coller) → pré-remplissage HP/HSA enveloppe
- Flux guidé : Structures → TRM → Dotation → Groupes

### Sprint 7 — Pilotage pédagogique
- Déclaration de dédoublements (SVT labo, Techno, EPS mixte…)
- Co-enseignement
- Impact DGH par créneau et par classe (gestion du cas LV2 multi-groupes simultanés)
- Simulation : "si je supprime ce dédoublement, je récupère Xh"

### Sprint 8 — Synthèses & exports
- Document PDF/HTML imprimable pour le CA
- Tableaux copiables pour Excel
- Rapport par discipline et par enseignant

### Sprint 9 — Historique pluriannuel
- Comparaison DGH N vs N-1
- Évolution des effectifs et des dotations
- Graphiques de tendance

---

## 👤 Auteur

Développé par un personnel de direction d'EPLE (Principal adjoint).  
Inspiré des travaux de la communauté [#PartagePerdir](https://x.com/hashtag/PartagePerdir).

---

*DGH App — Outil libre, conçu pour et par les personnels de direction de collège.*
