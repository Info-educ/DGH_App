# ◈ DGH App

> Outil de pilotage de la Dotation Globale Horaire pour collège  
> Développé par et pour les personnels de direction d'EPLE

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-en%20ligne-brightgreen)](https://votre-username.github.io/dgh-app/)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](#)
[![Licence](https://img.shields.io/badge/licence-MIT-lightgrey)](#)

---

## 🎯 Objectif

DGH App permet à une équipe de direction de collège de **piloter, simuler et documenter la répartition de la DGH** — de l'enveloppe globale reçue de la DSDEN jusqu'aux services individuels des enseignants.

**Ce que l'outil fait :**
- Visualiser la répartition HSA/HSE par discipline
- Simuler des scénarios de DGH (ajouter/retirer des heures)
- Détecter les dépassements et sous-services automatiquement
- Suivre les services de chaque enseignant en temps réel
- Générer des documents de synthèse pour le CA et les équipes pédagogiques

---

## 🔐 RGPD & Confidentialité

> **Les données ne quittent jamais votre poste.**

- L'application fonctionne **100% dans le navigateur** — aucun serveur, aucun cloud
- Les données sont stockées dans le `localStorage` de votre navigateur
- L'export produit un fichier **JSON local** à conserver sur votre poste ou un Drive privé
- Le fichier `data/` est exclu du dépôt Git via `.gitignore` — **vos données n'apparaissent jamais sur GitHub**
- Compatible partage par clé USB ou Drive privé d'équipe de direction

---

## 🚀 Utilisation

### Accès en ligne
👉 **[Ouvrir DGH App](https://info-educ.github.io/DGH_App/)**

### En local (sans connexion)
```bash
git clone https://info-educ.github.io/DGH_App/
# Ouvrir index.html dans votre navigateur
```

---

## 📦 Fonctionnalités — État d'avancement

| Module | Description | Statut |
|--------|-------------|--------|
| 🏠 **Dashboard** | KPIs, bilan DGH, alertes globales | ✅ v1.0 |
| ⊞ **Structures** | Divisions par niveau, options, dispositifs | 🔜 Sprint 2 |
| ◎ **Dotation DGH** | Enveloppe + répartition par discipline | 🔜 Sprint 3 |
| ◉ **Enseignants** | Services, ORS, HSA, TZR, Pacte, IMP | 🔜 Sprint 4 |
| ⟳ **Simulation** | Scénarios sans modifier les données réelles | 🔜 Sprint 5 |
| ◬ **Alertes** | Dépassements, sous-services, anomalies | 🔜 Sprint 5 |
| ▤ **Synthèses** | Export PDF + HTML pour CA / équipes | 🔜 Sprint 6 |
| ◷ **Historique** | Multi-années, comparaisons | 🔜 Sprint 7 |

---

## 💾 Gestion des données

### Exporter vos données
Cliquez sur **↓ Exporter** dans la barre latérale (ou `Ctrl+S`).  
Un fichier `nom-collège_2025-2026_YYYY-MM-DD.json` est téléchargé.

### Importer des données
Cliquez sur **↑ Importer** et sélectionnez votre fichier JSON.  
Un backup automatique est créé avant tout import.

### Format du fichier JSON
```json
{
  "_meta": { "version": "1.0.0", ... },
  "etablissement": { "nom": "...", "uai": "..." },
  "anneeActive": "2025-2026",
  "annees": {
    "2025-2026": {
      "dotation": { "enveloppe": 450 },
      "structures": [...],
      "enseignants": [...],
      ...
    }
  }
}
```

Voir [`data/exemple.json`](data/exemple.json) pour un exemple complet anonymisé.

---

## 🧠 ORS intégrées

| Corps / Grade | ORS hebdomadaire |
|---------------|-----------------|
| Certifié, Contractuel | 18 h |
| Agrégé | 15 h |
| PLP | 17 h |
| Professeur d'EPS | 20 h |
| Documentaliste | 36 h (présence) |
| CPE, Psy-EN | 35 h |

Les ORS sont modifiables manuellement par enseignant (réductions réglementaires, BMP, etc.)

---

## 🏗️ Architecture technique

```
dgh-app/
├── index.html              # Point d'entrée unique (SPA)
├── assets/
│   ├── css/style.css       # Design system complet
│   └── js/
│       ├── data.js         # Couche données (localStorage + import/export)
│       ├── calculs.js      # Moteur ORS / HSA / alertes / DGH
│       └── app.js          # Routeur et contrôleur UI
├── data/
│   └── exemple.json        # Données fictives pour démonstration
├── .gitignore              # Exclut les données réelles du dépôt
└── README.md
```

**Technologie : HTML5 + CSS3 + JS Vanilla**  
Zéro dépendance, zéro build, zéro framework. Maintenable en autonomie sur plusieurs années.

---

## 🔄 Workflow de mise à jour

```bash
# 1. Modifier les fichiers
# 2. Tester localement (ouvrir index.html)
# 3. Pousser sur GitHub
git add .
git commit -m "feat: module structures de classes"
git push
# → GitHub Pages se met à jour automatiquement (~2 min)
```

---

## 📋 Développement avec Claude (Skill)

Ce projet est conçu pour être développé de manière cohérente avec Claude.  
Le fichier [`SKILL.md`](SKILL.md) contient les instructions de développement à fournir à Claude pour maintenir la cohérence du code sur plusieurs années.

---

## 📝 Changelog

Voir [`CHANGELOG.md`](CHANGELOG.md)

---

## 👤 Auteur

Développé par un personnel de direction d'EPLE (Principal adjoint).  
Inspiré des travaux de la communauté [#PartagePerdir](https://x.com/hashtag/PartagePerdir).

---

*DGH App — Outil libre, conçu pour et par les personnels de direction de collège.*
