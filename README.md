# ◈ DGH App — v3.4.0

> Outil de pilotage de la Dotation Globale Horaire pour collège  
> Développé par et pour les personnels de direction d'EPLE

[![Version](https://img.shields.io/badge/version-3.4.0-green)](#)
[![Licence](https://img.shields.io/badge/licence-MIT-lightgrey)](#)
[![RGPD](https://img.shields.io/badge/RGPD-100%25%20local-blue)](#)
[![Stack](https://img.shields.io/badge/stack-HTML5%20%2B%20CSS3%20%2B%20JS%20Vanilla-orange)](#)

---

## 🎯 Objectif

DGH App permet à une équipe de direction de collège de **piloter, ventiler et documenter la répartition de la DGH** — de l'enveloppe globale reçue de la DSDEN jusqu'aux services individuels des enseignants, en passant par les structures de classes, les groupes de cours et toutes les heures pédagogiques complémentaires.

---

## 🔐 RGPD & Confidentialité

> **Les données ne quittent jamais votre poste.**

- Application **100% dans le navigateur** — aucun serveur, aucun cloud, aucune dépendance externe
- Données stockées dans le `localStorage` du navigateur
- Export/import via fichier **JSON local** (à conserver sur votre poste ou un Drive privé d'équipe)
- Compatible partage par clé USB ou Drive privé d'équipe de direction

---

## 🚀 Utilisation

### Sans installation
Télécharger le ZIP → extraire → ouvrir `index.html` dans Chrome ou Firefox.

### Raccourcis clavier
| Raccourci | Action |
|-----------|--------|
| `Ctrl+S` | Exporter les données (JSON) |
| `Échap` | Fermer la modal ouverte |

---

## 📦 Modules — État d'avancement

| Module | Description | Statut |
|--------|-------------|--------|
| ⬡ **Dashboard** | KPIs, barre HP/HSA, tooltips, résumé disciplines | ✅ v3.1 |
| ⊞ **Structures** | Saisie matricielle, récap par niveau | ✅ v3.1 |
| ◎ **Dotation DGH** | Enveloppe HP/HSA, grilles éditables, groupes de cours | ✅ v3.1 |
| ◈ **H. Péda. Complémentaires** | Options, labo, arts, sport — HP/HSA cliquable, multi-enseignants | ✅ v3.3 |
| ◉ **Équipe pédagogique** | 3 vues (Liste · Par discipline · HPC). Service calculé. ORS inline éditable. | ✅ v3.4 |
| ◬ **Alertes** | Dépassements, sous-services, anomalies | ✅ actif |
| ▤ **Synthèses** | Tableau de synthèse DGH pour le CA, rapports par discipline et par enseignant | 🔜 Sprint 8 |
| ◷ **Historique** | Comparaisons pluriannuelles N / N-1 | 🔜 Sprint 9 |

---

## 🏫 Concepts métier intégrés

### Enveloppe DGH
- **H-Poste (HP)** : heures structurelles, postes d'enseignants, attribuées par la DSDEN.
- **HSA** : heures supplémentaires payées, votées au CA. Ne constituent pas de postes.

### Service enseignant — modèle de calcul (v3.3)

Le service est **calculé automatiquement** depuis les affectations, jamais saisi globalement :

```
ORS (réglementaire ou saisi manuellement)
  ├── HPC-HP  : heures HPC typées HP → déduites de l'ORS
  ├── H.dispo : ORS − HPC-HP = heures disponibles pour les disciplines
  └── HP disc.: heures saisies "Par discipline" (doivent rester ≤ H.dispo)

HSA   : heures HPC typées HSA (hors ORS, payées en supplément)
Total : HP disc. + HPC-HP + HSA
```

**Règle fondamentale** : les HPC-HP sont déduites de l'ORS avant les disciplines.  
Ex : Certifié (ORS 18h) + Chorale HP 2h → **16h disponibles** pour ses disciplines.

### ORS par grade et statut

| Grade | ORS | Statut | ORS |
|-------|-----|--------|-----|
| Certifié | 18h | Titulaire | ORS du grade |
| Agrégé | 15h | BMP / TZR | ORS du grade (modifiable) |
| PLP | 17h | Temps partiel | Manuel obligatoire |
| Prof. EPS | 20h | Contractuel | Manuel si renseigné |

L'ORS est **éditable inline** dans la vue liste. Laisser vide = ORS du grade.  
Un **commentaire** (icône 💬) peut documenter toute spécificité (décharge syndicale, temps partiel thérapeutique…).

### Heures Pédagogiques Complémentaires

Chaque HPC est typée **HP** ou **HSA** (bascule au clic). Ce typage se répercute sur le service de chaque enseignant affecté. Plusieurs enseignants peuvent être affectés à une HPC avec des quotités différentes.

### Besoin réel vs besoin MEN
- **Besoin MEN** = grille réglementaire × nb divisions (modifiable, double-clic pour réinitialiser)
- **Besoin réel** = si groupes de cours → coût réel (h × classes) prévaut
- **Écart** = heures allouées − besoin réel

---

## 💾 Format JSON (v3.4)

```json
{
  "_meta": { "version": "3.4.0" },
  "etablissement": {
    "nom": "Collège Exemple",
    "uai": "0000000A",
    "academie": "Académie Exemple",
    "commune": "Exemple",
    "typeEtab": "college"
  },
  "heuresPedaComp": [{
    "id": "hpc_...", "nom": "Latin 4e", "typeHeure": "hp", "heures": 3,
    "enseignants": [{ "ensId": "ens_...", "heures": 3 }]
  }],
  "enseignants": [{
    "id": "ens_...", "nom": "DUPONT", "grade": "certifie", "statut": "titulaire",
    "disciplines": [{ "discNom": "Français", "heures": 16 }],
    "orsManuel": null, "commentaire": "Décharge syndicale 2h"
  }]
}
```

### Migrations automatiques
- v3.2 → v3.3 : `hpc.enseignantId` → `hpc.enseignants: [{ensId, heures}]`
- v3.3 → v3.4 : `etablissement.typeEtab: 'college'` ajouté si absent

---

## 🏗️ Architecture

```
dgh-app/
├── index.html
├── assets/css/style.css
└── assets/js/
    ├── data.js          # localStorage, migrations, CRUD
    ├── calculs.js       # Fonctions pures : serviceTotalEnseignant, ORS, DGH…
    ├── app.js           # Navigation, délégation globale
    └── modules/
        ├── dashboard.js
        ├── structures.js
        ├── dotation.js
        ├── hpc.js
        ├── etab.js
        └── enseignants.js   # 3 vues : liste / par discipline / HPC
```

**Stack : HTML5 + CSS3 + JS Vanilla** — zéro dépendance, zéro build, zéro framework.

---

## 🗓️ Feuille de route

| Sprint | Intitulé | Statut |
|--------|----------|--------|
| S1–S6 | Modules de base (Dashboard, Structures, Dotation, HPC, Enseignants) | ✅ Livré |
| **S7** | **Stabilisation & Fondations** (bugs, nettoyage, typeEtab) | ✅ **Livré — v3.4.0** |
| S8 | Synthèses & exports (bilan DGH pour CA, rapports PDF) | 🔜 Planifié |
| S9 | Historique pluriannuel (comparaison N / N-1, graphiques SVG) | 🔜 Planifié |

---

## 👤 Auteur

Développé par un personnel de direction d'EPLE (Principal adjoint).  
Inspiré des travaux de la communauté [#PartagePerdir](https://x.com/hashtag/PartagePerdir).

---

## 🛠️ Pour les développeurs

Le fichier `SKILL.md` à la racine du projet contient l'intégralité des règles de développement, le schéma de données, l'API publique et la checklist de livraison. **Il doit être fourni à Claude au début de chaque session de développement.**

---

*DGH App — Outil libre, conçu pour et par les personnels de direction de collège.*
