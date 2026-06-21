# ◈ DGH App — v4.12.0

> Outil de pilotage de la Dotation Globale Horaire pour collège  
> Développé par et pour les personnels de direction d'EPLE

[![Version](https://img.shields.io/badge/version-4.12.0-green)](#)
[![Licence](https://img.shields.io/badge/licence-MIT-lightgrey)](#)
[![RGPD](https://img.shields.io/badge/RGPD-100%25%20local-blue)](#)
[![Stack](https://img.shields.io/badge/stack-HTML5%20%2B%20CSS3%20%2B%20JS%20Vanilla-orange)](#)

---

## 🎯 Objectif

DGH App permet à une équipe de direction de collège de **piloter, ventiler et documenter la répartition de la DGH** — de l'enveloppe globale reçue de la DSDEN jusqu'aux services individuels des enseignants, en passant par les structures de classes, les groupes de cours, les heures pédagogiques complémentaires, le pilotage par scénarios, et la **préparation de l'emploi du temps** dans Index Éducation.

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

### Sauvegarder vos données
Le fichier exporté (bouton **↓ Exporter** ou `Ctrl+S`) est votre sauvegarde complète. Conservez-le précieusement (poste local, clé USB ou Drive privé d'équipe) : c'est le seul moyen de retrouver vos données d'une session à l'autre ou de les transférer sur un autre poste. Le bouton **↑ Importer** recharge ce fichier dans l'application.

### Raccourcis clavier
| Raccourci | Action |
|-----------|--------|
| `Ctrl+S` | Exporter les données (JSON) |
| `Échap` | Fermer la modal ouverte |

---

## 📦 Modules — État d'avancement

| Module | Description | Statut |
|--------|-------------|--------|
| ⬡ **Dashboard** | KPIs, barre HP/HSA, gauges scénario-aware, tooltips, résumé disciplines | ✅ v4.3 |
| ⊞ **Structures** | Saisie matricielle, récap par niveau, référentiel Groupes (mono/inter-classes) | ✅ v3.8 |
| ◎ **Dotation DGH** | Enveloppe HP/HSA, grilles éditables, groupes de cours | ✅ v3.1 |
| ◈ **H. Péda. Complémentaires** | Options, labo, arts, sport — HP/HSA cliquable, multi-enseignants | ✅ v3.3 |
| ◉ **Équipe pédagogique** | 3 vues (Liste · Par discipline · HPC). Service calculé. ORS inline éditable. | ✅ v3.4 |
| ▦ **Répartition de service** | Affectation classe × discipline → enseignant (2 modes), professeurs principaux, grille récap, propagation auto vers services & pilotage | ✅ v4.2 |
| ⊕ **Scénarios / Pilotage** | Simulation de modificateurs (dédoublement, co-enseignement, projets), saisie en grille, comparaison, impact par enseignant | ✅ v4.5 |
| ◷ **Historique** | Comparaisons pluriannuelles N / N-1, snapshots figés | ✅ Sprint 10 |
| ◑ **PACTE / IMP** | Missions hors enveloppe DGH | ✅ Sprint 11 |
| ⊟ **Contraintes EDT** | Barrettes (avec fréquence semaine A/B), co-interventions, indisponibilités enseignants, contraintes libres, notice EDT consolidée avec détection d'alertes | ✅ v4.8 |
| 🏫 **Salles & Heure bleue** | Référentiel salles spécialisées, recommandation de créneau optimal pour les réunions | ✅ v4.8 |
| ◬ **Alertes** | Dépassements, sous-services, anomalies | ✅ actif |
| ▤ **Synthèses** | Tableau de synthèse DGH pour le CA, dialogue de gestion, services enseignants | ✅ Sprint 8 |

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

### Préparation EDT (Index Éducation)

L'application ne remplace pas Index Éducation : elle centralise, **avant** la saisie, tout ce qu'un personnel de direction doit avoir sous les yeux pour ne rien oublier.

- **Salles spécialisées** (labo SVT, Physique-Chimie, Musique, Arts, Technologie…) avec leur nombre d'exemplaires disponibles, pour repérer une saturation avant de la découvrir dans EDT.
- **Heure bleue** : créneau commun pour les réunions. L'application **recommande le meilleur créneau** parmi ceux que vous proposez, en comptant les enseignants réellement disponibles compte tenu des indisponibilités et contraintes saisies. *Limite assumée : elle ne connaît pas les cours déjà posés dans EDT.*
- **Indisponibilités enseignants** : distinction entre indisponibilité **dure** (réelle, ex. BMP sur un autre établissement) et **vœu souple** (à éviter si possible).
- **Contraintes libres** : tout ce qui ne rentre dans aucune case (ex. « Orchestre — Conservatoire », jeudi 8h–11h), pour une classe et/ou un enseignant.
- **Barrettes en semaine A/B** : chaque cours en parallèle peut être réglé sur une fréquence hebdomadaire ou alternée, slot par slot — utile pour condenser l'emploi du temps sur les demi-groupes.
- **Notice EDT** : document imprimable consolidant tout ce qui précède dans l'ordre où vous en avez besoin (contraintes élèves → enseignants → barrettes), avec les conflits potentiels détectés automatiquement.

---

## 💾 Format JSON (v4.12.0)

```json
{
  "_meta": { "version": "4.12.0" },
  "etablissement": {
    "nom": "Collège Exemple",
    "uai": "0000000A",
    "academie": "Académie Exemple",
    "typeEtab": "college",
    "salles": [{ "id": "salle_svt1", "nom": "Labo SVT 1", "type": "svt", "nb": 2 }],
    "heuresBleues": { "actif": true, "creneaux": [{ "jour": "jeu", "debut": "13:00", "fin": "14:00" }] }
  },
  "heuresPedaComp": [{
    "id": "hpc_...", "nom": "Latin 4e", "typeHeure": "hp", "heures": 3,
    "enseignants": [{ "ensId": "ens_...", "heures": 3 }]
  }],
  "enseignants": [{
    "id": "ens_...", "nom": "DUPONT", "grade": "certifie", "statut": "titulaire",
    "disciplines": [{ "discNom": "Français", "heures": 16 }],
    "orsManuel": null, "commentaire": "Décharge syndicale 2h"
  }],
  "contraintesEDT": {
    "barrettes": [{ "slots": [{ "type": "classe", "ref": "div_...", "ensIds": ["ens_..."], "frequence": "semaine-A" }] }],
    "indisponibilites": [{ "ensId": "ens_...", "type": "dure", "jour": "mer", "plage": "journee", "motif": "Temps partiel" }],
    "contraintesLibres": [{ "titre": "Orchestre — Conservatoire", "jour": "jeu", "heureDebut": "08:00", "heureFin": "11:00" }]
  }
}
```

### Migrations automatiques (historique condensé)
- v3.2 → v3.3 : `hpc.enseignantId` → `hpc.enseignants: [{ensId, heures}]`
- v3.3 → v3.4 : `etablissement.typeEtab: 'college'` ajouté si absent
- v4.2 : `affectations[]` (répartition de service), `ppEnsId` sur les divisions
- v4.8 : `etablissement.salles[]` / `heuresBleues`, `contraintesEDT.indisponibilites[]` / `contraintesLibres[]`, `barrette.slots[].frequence`

---

## 🏗️ Architecture

```
dgh-app/
├── index.html
├── SKILL.md             # Règles de dév., schéma, API — à fournir à Claude
├── CHANGELOG.md
├── data/exemple.json    # Données fictives anonymisées
├── assets/css/style.css
└── assets/js/
    ├── data.js          # localStorage, migrations, CRUD
    ├── calculs.js       # Fonctions pures : serviceTotalEnseignant, ORS, DGH, controlesEDT…
    ├── app.js           # Navigation, délégation globale
    ├── tutorial.js       # Aide contextuelle embarquée (autonome)
    └── modules/
        ├── dashboard.js
        ├── structures.js     # Divisions + référentiel Groupes
        ├── dotation.js
        ├── hpc.js
        ├── etab.js            # Établissement, salles, heure bleue, alertes
        ├── enseignants.js     # 3 vues : liste / par discipline / HPC
        ├── repartition.js     # Affectations classe × discipline → enseignant
        ├── pilotage.js        # Scénarios, récap, impact
        ├── edt.js             # Barrettes, co-interventions, indisponibilités, notice EDT
        ├── historique.js      # Comparaison N/N-1, snapshots
        ├── missions.js        # PACTE / IMP
        └── instances.js       # Synthèse CA, Dialogue de gestion, Services
```

**Stack : HTML5 + CSS3 + JS Vanilla** — zéro dépendance, zéro build, zéro framework.

---

## 🗓️ Feuille de route

| Sprint | Intitulé | Statut |
|--------|----------|--------|
| S1–S6 | Modules de base (Dashboard, Structures, Dotation, HPC, Enseignants) | ✅ Livré |
| S7 | Stabilisation & Fondations (bugs, nettoyage, typeEtab) | ✅ Livré |
| S8 | Synthèses & exports (Synthèse CA, Dialogue de gestion, Services) | ✅ Livré |
| S9 | Historique pluriannuel — fondations | ✅ Livré |
| S10 | Comparaison N/N-1 figée, KPI delta | ✅ Livré |
| S11 | PACTE/IMP, référentiel Groupes | ✅ Livré |
| S12 | Répartition de service (affectations, PP) | ✅ Livré |
| S13 | Dashboard scénario-aware, saisie en grille | ✅ Livré |
| **S14** | **Préparation EDT** (salles, heure bleue, indisponibilités, notice) | ✅ **Livré — v4.8.0** |
| S15+ | Dispositifs SEGPA/ULIS/UPE2A, scénario → contraintes EDT, tests automatisés | 🔜 Planifié |

---

## 👤 Auteur

Développé par un personnel de direction d'EPLE (Principal adjoint).  
Inspiré des travaux de la communauté [#PartagePerdir](https://x.com/hashtag/PartagePerdir).

---

## 🛠️ Pour les développeurs

Le fichier `SKILL.md` à la racine du projet contient l'intégralité des règles de développement, le schéma de données, l'API publique et la checklist de livraison. **Il doit être fourni à Claude au début de chaque session de développement.**

---

*DGH App — Outil libre, conçu pour et par les personnels de direction de collège.*
