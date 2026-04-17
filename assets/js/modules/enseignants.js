/**
 * DGH App — Module Enseignants v3.3.6
 * v1.0.0 : tableau, KPI, modal saisie, import CSV
 * v1.1.0 : édition inline, vue par discipline, suppression globale
 * v1.2.0 : vue discipline avec en-têtes, inline complet, H.discipline par enseignant,
 *           totaux de sous-tableau, ajout depuis une discipline, multi-matières
 *
 * Règles SKILL.md :
 *   - Zéro addEventListener sur éléments dynamiques -> _onGlobalClick/_onGlobalChange/_onGlobalBlur (app.js)
 *   - Zéro localStorage -> uniquement via DGHData.*
 *   - Zéro style.color / style.display -> classes CSS utilitaires
 *   - API publique via return {}
 */

const DGHEnseignants = (() => {

  let _pendingDeleteId = null;
  let _csvLignes       = [];
  let _vueMode         = 'liste'; // 'liste' | 'discipline' | 'hpc'
  let _discOpen        = new Set(); // disciplines dépliées dans vue disc
  let _hpcOpen         = new Set(); // catégories HPC dépliées

  const GRADES = [
    { value: 'certifie',    label: 'Certifié',   ors: 18 },
    { value: 'agrege',      label: 'Agrégé',     ors: 15 },
    { value: 'plp',         label: 'PLP',         ors: 17 },
    { value: 'eps',         label: 'Prof. EPS',   ors: 20 },
    { value: 'contractuel', label: 'Contractuel', ors: 0 }
  ];
  const STATUTS = [
    { value: 'titulaire',    label: 'Titulaire'      },
    { value: 'bmp',          label: 'BMP'            },
    { value: 'tzr',          label: 'TZR'            },
    { value: 'contractuel',  label: 'Contractuel'    },
    { value: 'temps-partiel', label: 'Temps partiel' }
  ];
  const GRADE_LABELS  = Object.fromEntries(GRADES.map(g  => [g.value, g.label]));
  const STATUT_LABELS = Object.fromEntries(STATUTS.map(s => [s.value, s.label]));

  // ── RENDU PRINCIPAL ────────────────────────────────────────────────────────
  function renderEnseignants() {
    const enseignants = DGHData.getEnseignants();
    _renderKPI(Calculs.bilanEnseignants(enseignants));
    if      (_vueMode === 'discipline') _renderVueDisc(enseignants);
    else if (_vueMode === 'hpc')        _renderVueHPC();
    else                               _renderTableau(enseignants);
  }

  // ── MISE À JOUR ONGLETS STATIQUES + KPI STRIP ────────────────────────────
  // Les onglets sont dans le HTML statique — on met seulement à jour les classes et badges
  function _renderKPI(bilan) {
    const nbEns  = bilan.nbEnseignants;
    const nbHPC  = DGHData.getHeuresPedaComp().length;
    const nbDisc = DGHData.getDisciplines().length;

    // Badges numériques
    const bEns  = document.getElementById('badgeOngletEns');
    const bDisc = document.getElementById('badgeOngletDisc');
    const bHPC  = document.getElementById('badgeOngletHPC');
    if (bEns)  { bEns.textContent  = nbEns;  bEns.className  = 'ens-onglet-num ' + (nbEns  > 0 ? 'ens-num-ok' : 'ens-num-warn'); }
    if (bDisc) { bDisc.textContent = nbDisc; bDisc.className = 'ens-onglet-num ' + (nbDisc > 0 ? 'ens-num-ok' : 'ens-num-warn'); }
    if (bHPC)  { bHPC.textContent  = nbHPC;  bHPC.className  = 'ens-onglet-num ' + (nbHPC  > 0 ? 'ens-num-ok' : 'ens-num-warn'); }

    // Classe active sur les onglets
    ['btnVueListe','btnVueDisc','btnVueHPC'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const isActive = (id === 'btnVueListe' && _vueMode === 'liste')
                    || (id === 'btnVueDisc'  && _vueMode === 'discipline')
                    || (id === 'btnVueHPC'   && _vueMode === 'hpc');
      btn.classList.toggle('ens-onglet-active', isActive);
    });

    // KPI strip
    const strip = document.getElementById('ens-kpi-strip');
    if (strip) {
      strip.innerHTML =
        '<span class="ens-kpi-chip">' + nbEns + ' enseignant' + (nbEns > 1 ? 's' : '') + '</span>' +
        '<span class="ens-kpi-chip">' + bilan.totalHeures + 'h/sem.</span>' +
        (bilan.nbSousService > 0 ? '<span class="ens-kpi-chip ens-kpi-chip-danger">' + bilan.nbSousService + ' sous-service</span>' : '') +
        (bilan.nbHSA > 0 ? '<span class="ens-kpi-chip ens-kpi-chip-hsa">' + bilan.nbHSA + ' HSA</span>' : '');
    }
  }

  // ── VUE LISTE ────────────────────────────────────────────────────────────────────────
  // ORS | HP | HSA | Total | Écart HP — tout calculé depuis serviceTotalEnseignant
  // ORS inline éditable, icône 💬 si commentaire renseigné
  function _renderTableau(enseignants) {
    const container = document.getElementById('ens-list');
    if (!container) return;
    if (enseignants.length === 0) {
      container.innerHTML = '<div class="ens-empty"><p>Aucun enseignant saisi.</p><p class="ens-empty-hint">Importez un CSV EDT/Pronote ou ajoutez manuellement.</p></div>';
      return;
    }
    const hpcs = DGHData.getHeuresPedaComp();
    const gradeOpts = GRADES.map(g => {
      const labelORS = g.ors > 0 ? ' (' + g.ors + 'h)' : '';
      return '<option value="' + g.value + '">' + g.label + labelORS + '</option>';
    }).join('');
    const statutOpts = STATUTS.map(s => '<option value="' + s.value + '">' + s.label + '</option>').join('');
    let html = '<table class="ens-table ens-table-service"><thead><tr>'
      + '<th>Nom</th><th>Prénom</th><th>Grade</th><th>Statut</th><th>Discipline(s)</th>'
      + '<th class="ens-col-num" title="ORS réglementaire — éditable">ORS</th>'
      + '<th class="ens-col-num ens-th-hp" title="HP disciplines uniquement">HP disc.</th>'
      + '<th class="ens-col-num ens-th-hpc" title="HPC typées HP — déduites de l’ORS">HPC-HP</th>'
      + '<th class="ens-col-num ens-th-hsa" title="HSA : survoler pour le détail">HSA</th>'
      + '<th class="ens-col-num ens-th-dispo" title="Heures disponibles pour disciplines = ORS − HPC-HP">Dispo.</th>'
      + '<th class="ens-col-actions">Actions</th>'
      + '</tr></thead><tbody>';
    enseignants.forEach(ens => {
      const sv    = Calculs.serviceTotalEnseignant(ens, hpcs);
      const gOpts = gradeOpts.replace('value="' + ens.grade + '"', 'value="' + ens.grade + '" selected');
      const sOpts = statutOpts.replace('value="' + ens.statut + '"', 'value="' + ens.statut + '" selected');
      const orsGrade       = Calculs.getORS(ens.grade, null);
      const orsPlaceholder = orsGrade > 0 ? orsGrade + 'h' : 'Volume';
      const orsVal         = (ens.orsManuel !== null && ens.orsManuel !== undefined && ens.orsManuel !== '') ? ens.orsManuel : '';
      const commentaire    = (ens.commentaire || '').trim();
      const commentIcon    = commentaire
        ? ' <button class="btn-icon ens-comment-btn" data-action="edit-ens" data-id="' + ens.id + '" title="' + _esc(commentaire) + '" aria-label="Commentaire">💬</button>'
        : '';
      const orsCell = '<div class="ens-ors-wrap">'
        + '<input class="ens-inline-input ens-inline-num ens-inline-ors"'
        + ' data-ens-id="' + ens.id + '" data-field="orsManuel"'
        + ' type="number" min="0" max="40" step="0.5"'
        + ' value="' + orsVal + '" placeholder="' + orsPlaceholder + '"'
        + ' title="Laisser vide pour l’ORS du grade (' + orsPlaceholder + ')" />'
        + commentIcon + '</div>';
      // HP disc. : heures disciplines uniquement
      const hpDiscCell = '<span class="ens-service-hp">' + sv.hpDisc + 'h</span>';

      // HPC-HP : heures HPC typées HP, avec tooltip listant les HPC concernées
      let hpcHpCell;
      if (sv.hpHPC > 0) {
        const hpcHpLines = sv.detailHPCHp.map(d => '• ' + d.nom + ' : ' + d.heures + 'h').join('\n');
        hpcHpCell = '<span class="ens-service-hpc-hp" title="' + _esc(hpcHpLines) + '">' + sv.hpHPC + 'h ⓘ</span>';
      } else {
        hpcHpCell = '<span class="ens-service-hsa-zero">—</span>';
      }

      // HSA : tooltip listant toutes les sources
      let hsaCell;
      if (sv.hsaTotal > 0) {
        const lines = sv.detailHSA.map(d => '• ' + d.nom + ' : ' + d.heures + 'h').join('\n');
        hsaCell = '<span class="ens-service-hsa-nonzero" title="' + _esc(lines) + '">' + sv.hsaTotal + 'h ⓘ</span>';
      } else {
        hsaCell = '<span class="ens-service-hsa-zero">—</span>';
      }

      // Dispo = ORS - HPC-HP (heures utilisables pour les disciplines)
      const dispoCell = _affDispoORS(sv);
      html += '<tr data-ens-id="' + ens.id + '">'
        + '<td class="ens-nom"><input class="ens-inline-input ens-inline-nom" data-ens-id="' + ens.id + '" data-field="nom" value="' + _esc(ens.nom||'') + '" placeholder="Nom" /></td>'
        + '<td><input class="ens-inline-input" data-ens-id="' + ens.id + '" data-field="prenom" value="' + _esc(ens.prenom||'') + '" placeholder="Prénom" /></td>'
        + '<td><select class="ens-inline-select" data-ens-id="' + ens.id + '" data-field="grade">' + gOpts + '</select></td>'
        + '<td><select class="ens-inline-select" data-ens-id="' + ens.id + '" data-field="statut">' + sOpts + '</select></td>'
        + '<td class="ens-disc-cell">' + _formatDiscsListe(ens) + '</td>'
        + '<td class="ens-col-num" id="ens-ors-'   + ens.id + '">' + orsCell   + '</td>'
        + '<td class="ens-col-num" id="ens-hp-'     + ens.id + '">' + hpDiscCell + '</td>'
        + '<td class="ens-col-num" id="ens-hpchp-'  + ens.id + '">' + hpcHpCell  + '</td>'
        + '<td class="ens-col-num" id="ens-hsa-'    + ens.id + '">' + hsaCell    + '</td>'
        + '<td class="ens-col-num" id="ens-dispo-'  + ens.id + '">' + dispoCell  + '</td>'
        + '<td class="ens-col-actions">'
          + '<button class="btn-icon" data-action="edit-ens" data-id="' + ens.id + '" title="Détails">✎</button>'
          + '<button class="btn-icon btn-icon-danger" data-action="delete-ens" data-id="' + ens.id + '" title="Supprimer">✕</button>'
        + '</td>'
      + '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // Formatte la colonne Discipline dans la vue liste (multi-disciplines)
  function _formatDiscsListe(ens) {
    const discs = Array.isArray(ens.disciplines) && ens.disciplines.length > 0
      ? ens.disciplines
      : (ens.disciplinePrincipale ? [{ discNom: ens.disciplinePrincipale, heures: ens.heures || 0 }] : []);
    if (discs.length === 0) return '<span class="ens-disc-vide">—</span>';
    if (discs.length === 1) {
      // Discipline unique — champ éditable
      return '<input class="ens-inline-input ens-inline-disc" data-ens-id="' + ens.id + '" data-field="disciplinePrincipale" value="' + _esc(discs[0].discNom) + '" placeholder="Discipline" />';
    }
    // Multi-disciplines — affichage texte avec toutes les disciplines et heures
    const badges = discs.map((d, i) =>
      '<span class="ens-disc-badge' + (i === 0 ? ' ens-disc-badge-main' : '') + '">' +
        _esc(d.discNom) + (d.heures > 0 ? ' ' + d.heures + 'h' : '') +
      '</span>'
    ).join(' ');
    return '<div class="ens-disc-multi">' + badges + '</div>';
  }

  function _heuresHint(statut) {
    if (statut === 'tzr') return 'ici seulement';
    if (statut === 'bmp') return 'partiel';
    if (statut === 'contractuel') return 'selon contrat';
    return '';
  }

  // _affORS/_affEcart : compat descendante (vue discipline)
  function _affORS(d) {
    if (!d || d.ors === 0) return '<span class="ens-disc-vide">—</span>';
    return d.ors + 'h';
  }
  function _affEcart(d) {
    if (!d || d.ors === 0) return '<span class="ens-disc-vide">—</span>';
    const cls  = d.statut === 'hsa' ? 'solde-hsa' : d.statut === 'sous-service' ? 'solde-danger' : 'solde-neutre';
    const sign = d.ecart > 0 ? '+' : '';
    return '<span class="' + cls + '">' + sign + d.ecart + 'h</span>';
  }
  // Affiche les heures disponibles pour disciplines = ORS - HPC-HP
  // Positif (vert) = marge, négatif (rouge) = ORS dépassé par les HPC-HP seules
  function _affDispoORS(sv) {
    if (sv.statutORS === 'sans-ors') return '<span class="ens-disc-vide">—</span>';
    const dispo = Math.round((sv.ors - sv.hpHPC) * 2) / 2;
    const cls   = dispo < 0 ? 'solde-danger' : dispo === 0 ? 'solde-neutre' : 'ens-dispo-ok';
    const icon  = dispo < 0 ? ' ⚠' : '';
    return '<span class="' + cls + '">' + dispo + 'h' + icon + '</span>';
  }

  // _affORSv2/_affEcartv2 : vue liste Option B (service calculé)
  function _affORSv2(sv) {
    if (sv.statutORS === 'sans-ors') return '<span class="ens-disc-vide">—</span>';
    return '<span class="ens-ors-val">' + sv.ors + 'h</span>';
  }
  function _affEcartv2(sv) {
    if (sv.statutORS === 'sans-ors' || sv.ecartORS === null) return '<span class="ens-disc-vide">—</span>';
    const cls  = sv.statutORS === 'hsa' ? 'solde-hsa' : sv.statutORS === 'sous-service' ? 'solde-danger' : 'solde-neutre';
    const sign = sv.ecartORS > 0 ? '+' : '';
    const hsaInfo = sv.hsaTotal > 0
      ? ' <span class="ens-ecart-hsa" title="dont ' + sv.hsaTotal + 'h HSA">(+' + sv.hsaTotal + 'h HSA)</span>'
      : '';
    return '<span class="' + cls + '">' + sign + sv.ecartORS + 'h</span>' + hsaInfo;
  }

  // ── VUE PAR DISCIPLINE ──────────────────────────────────────────────────
  function _renderVueDisc(enseignants) {
    const container = document.getElementById('ens-list');
    if (!container) return;
    const disciplines = DGHData.getDisciplines();
    const repartition = DGHData.getRepartition();
    const bilans      = Calculs.bilanParDiscipline(enseignants, repartition, disciplines);

    if (!bilans.length || bilans.every(b => b.membres.length === 0 && b.heuresDotation === 0)) {
      container.innerHTML = '<div class="ens-empty"><p>Aucune donnée à afficher.</p></div>';
      return;
    }

    let totDisc = 0, totDot = 0;
    const toutOuverts = bilans.filter(b => b.membres.length > 0 || b.heuresDotation > 0)
                              .every(b => _discOpen.has(b.disc));
    let html = '<div class="ens-disc-toolbar">' +
      '<button class="btn-secondary btn-sm" data-action="toggle-all-disc" data-open="' + (!toutOuverts ? '1' : '0') + '">' +
        (toutOuverts ? '▲ Tout replier' : '▼ Tout déplier') +
      '</button>' +
    '</div>';

    bilans.forEach(b => {
      if (b.membres.length === 0 && b.heuresDotation === 0) return;
      totDisc += b.heuresDisc;
      totDot  += b.heuresDotation;
      const eCls  = b.ecart < 0 ? 'solde-danger' : b.ecart > 0 ? 'solde-hsa' : 'solde-neutre';
      const eSign = b.ecart > 0 ? '+' : '';
      const dotBadge = b.dansDotation
        ? '<span class="ens-dot-badge">' + b.heuresDotation + 'h alloué</span>'
        : '<span class="ens-dot-badge ens-dot-badge-hors">hors dotation</span>';

      const isOpen    = _discOpen.has(b.disc);
      const toggleIcon = isOpen ? '▲' : '▼';
      html += '<div class="ens-disc-bloc">' +
        '<div class="ens-disc-header" data-action="toggle-disc" data-disc="' + _esc(b.disc) + '" style="cursor:pointer" title="Déplier/replier">' +
          '<span class="ens-disc-toggle">' + toggleIcon + '</span>' +
          '<span class="ens-disc-color" style="background:' + b.couleur + '"></span>' +
          '<span class="ens-disc-nom">' + _esc(b.disc) + '</span>' +
          dotBadge +
          '<span class="ens-disc-spacer"></span>' +
          '<span class="ens-disc-service">' + b.membres.length + ' ens. · ' + b.heuresDisc + 'h disc.</span>' +
          '<span class="ens-disc-ecart ' + eCls + '">' + eSign + b.ecart + 'h</span>' +
          '<button class="btn-icon btn-icon-add" data-action="add-ens-disc" data-disc="' + _esc(b.disc) + '" title="Ajouter dans cette discipline">+</button>' +
        '</div>' +
        '<div class="ens-disc-body' + (isOpen ? '' : ' is-hidden') + '">';

      if (b.membres.length > 0) {
        // Colonnes: Nom | Prénom | Grade | Statut | H.établ. | H.discipline | H.libres | Actions
        // H.libres = H.établ. - somme de TOUTES ses H.discipline (heures non encore affectées)
        // L'écart individuel par discipline est supprimé : non pertinent
        // L'écart équipe/dotation est dans le tfoot + l'en-tête du bloc
        html += '<table class="ens-table ens-disc-table ens-disc-table-8"><thead><tr>' +
          '<th>Nom</th><th>Prénom</th><th>Grade</th><th>Statut</th>' +
          '<th class="ens-col-num">H. établ.</th>' +
          '<th class="ens-col-num">H. discipline</th>' +
          '<th class="ens-col-num" title="Heures non encore affectées à une discipline">H. libres</th>' +
          '<th class="ens-col-actions">Actions</th>' +
          '</tr></thead><tbody>';

        // hpcsDisc : nécessaire pour calculer H.dispo = ORS - HPC-HP - disciplines
        const hpcsDisc = DGHData.getHeuresPedaComp();
        let totDiscH = 0, totServH = 0, totLibresH = 0;

        b.membres.forEach(m => {
          const ens  = m.ens;
          const dv   = Calculs.detailEnseignant(ens);
          totDiscH  += m.heuresDisc;
          totServH  += dv.heuresFait;

          // H.dispo = ORS - HPC-HP - somme toutes disciplines
          // (les HPC-HP sont déduites de l'ORS avant les disciplines)
          const svEns        = Calculs.serviceTotalEnseignant(ens, hpcsDisc);
          const toutesDiscs  = Array.isArray(ens.disciplines) ? ens.disciplines : [];
          const hToutesDiscs = Math.round(toutesDiscs.reduce((s, d) => s + (d.heures||0), 0) * 2) / 2;
          let hLibres;
          if (svEns.ors > 0) {
            hLibres = Math.round((svEns.ors - svEns.hpHPC - hToutesDiscs) * 2) / 2;
          } else {
            hLibres = Math.round((dv.heuresFait - hToutesDiscs) * 2) / 2;
          }
          const hpcHpInfo = svEns.hpHPC > 0
            ? ' <span class="ens-disc-hpchp-info" title="'
              + _esc(svEns.detailHPCHp.map(d => '• ' + d.nom + ' : ' + d.heures + 'h').join('\n'))
              + '">⚡' + svEns.hpHPC + 'h HPC</span>'
            : '';
          const hLibresCls   = hLibres > 0 ? 'ens-hlibres-pos' : hLibres < 0 ? 'ens-hlibres-neg' : 'ens-hlibres-zero';
          const hLibresTxt   = hLibres > 0 ? hLibres + 'h' : hLibres < 0 ? hLibres + 'h ⚠' : '✓ ok';
          totLibresH        += hLibres;

          // Alerte si H.disc cette discipline > H.établ.
          const discAlert = m.heuresDisc > dv.heuresFait && dv.heuresFait > 0
            ? ' <span class="ens-disc-alert" title="H.discipline dépasse H.établissement">⚠</span>' : '';

          html += '<tr data-ens-id="' + ens.id + '">' +
            '<td class="ens-nom ens-disc-ro">' + _esc(ens.nom||'—') + '</td>' +
            '<td class="ens-disc-ro">' + _esc(ens.prenom||'') + '</td>' +
            '<td class="ens-disc-ro">' + _esc(GRADE_LABELS[ens.grade]||'—') + '</td>' +
            '<td>' + _statutBadge(ens.statut) + '</td>' +
            '<td class="ens-col-num ens-disc-ro">' + dv.heuresFait + 'h</td>' +
            // H.discipline — seul champ éditable
            '<td class="ens-col-num">' +
              '<input class="ens-inline-input ens-inline-num ens-inline-hdisc" ' +
                'data-ens-id="' + ens.id + '" data-disc="' + _esc(b.disc) + '" ' +
                'data-field="heures-disc" type="number" min="0" max="40" step="0.5" ' +
                'value="' + m.heuresDisc + '" />' +
              discAlert +
            '</td>' +
            // H.dispo + info HPC-HP
            '<td class="ens-col-num"><span class="' + hLibresCls + '">' + hLibresTxt + '</span>' + hpcHpInfo + '</td>' +
            '<td class="ens-col-actions">' +
              '<button class="btn-icon" data-action="edit-ens" data-id="' + ens.id + '" title="Modifier dans vue liste">✎</button>' +
              '<button class="btn-icon btn-icon-danger" data-action="retirer-ens-disc" data-id="' + ens.id + '" data-disc="' + _esc(b.disc) + '" title="Retirer de cette discipline">✕</button>' +
            '</td>' +
          '</tr>';
        });

        totDiscH   = Math.round(totDiscH   * 2) / 2;
        totServH   = Math.round(totServH   * 2) / 2;
        totLibresH = Math.round(totLibresH * 2) / 2;

        // Écart équipe vs dotation (affiché dans le tfoot)
        const eqEcart  = Math.round((totDiscH - b.heuresDotation) * 2) / 2;
        const eqCls    = eqEcart < 0 ? 'solde-danger' : eqEcart > 0 ? 'solde-hsa' : 'solde-neutre';
        const eqSign   = eqEcart > 0 ? '+' : '';
        const dotTxt   = b.heuresDotation > 0
          ? 'dot. ' + b.heuresDotation + 'h → ' + eqSign + eqEcart + 'h'
          : 'hors dotation';
        const dotCls   = b.heuresDotation > 0 ? eqCls : 'solde-neutre';

        // Tfoot — 8 colonnes alignées (Nom+Prénom+Grade+Statut + H.établ + H.disc + H.libres + Actions)
        html += '</tbody>' +
          '<tfoot><tr class="ens-disc-tfoot">' +
            '<td colspan="4" class="ens-disc-tfoot-label">' +
              b.membres.length + ' enseignant' + (b.membres.length > 1 ? 's' : '') +
            '</td>' +
            '<td class="ens-col-num ens-disc-tfoot-hserv">' + totServH + 'h</td>' +
            '<td class="ens-col-num ens-disc-tfoot-hdisc">' +
              totDiscH + 'h' +
              '<br><span class="ens-disc-tfoot-ecart ' + dotCls + '">' + dotTxt + '</span>' +
            '</td>' +
            '<td class="ens-col-num">' +
              (totLibresH > 0
                ? '<span class="ens-hlibres-pos">' + totLibresH + 'h</span>'
                : '<span class="solde-neutre">—</span>') +
            '</td>' +
            '<td></td>' +
          '</tr></tfoot>' +
          '</table>';
      } else {
        html += '<p class="ens-disc-empty">Aucun enseignant affecté. <button class="btn-link" data-action="add-ens-disc" data-disc="' + _esc(b.disc) + '">+ Ajouter</button></p>';
      }
      html += '</div></div>'; // ferme ens-disc-body + ens-disc-bloc
    });

    const tEcart = Math.round((totDisc - totDot) * 2) / 2;
    const tCls   = tEcart < 0 ? 'solde-danger' : tEcart > 0 ? 'solde-hsa' : 'solde-neutre';
    html += '<div class="ens-disc-total">' +
      '<span class="ens-disc-total-label">Total général</span>' +
      '<span class="ens-disc-total-dot">' + Math.round(totDot*2)/2 + 'h dot.</span>' +
      '<span class="ens-disc-total-serv">' + Math.round(totDisc*2)/2 + 'h disc.</span>' +
      '<span class="ens-disc-total-ecart ' + tCls + '">' + (tEcart > 0 ? '+' : '') + tEcart + 'h</span>' +
    '</div>';
    container.innerHTML = html;
  }

  // ── VUE HPC ────────────────────────────────────────────────────────────────────────
  // 7 colonnes. Colonne Enseignant(s) en DERNIÈRE position, alignée à droite.
  function _renderVueHPC() {
    const container  = document.getElementById('ens-list');
    if (!container) return;
    const hpcs        = DGHData.getHeuresPedaComp();
    const disciplines = DGHData.getDisciplines();
    const structures  = DGHData.getStructures();
    const discMap     = Object.fromEntries(disciplines.map(d => [d.id, d]));
    const divMap      = Object.fromEntries(structures.map(d => [d.id, d]));
    const CATS = { option:'Options', labo:'Labo / TP', dispositif:'Dispositifs',
      'vie-classe':'Vie de classe', arts:'Arts & culture',
      sport:'Sport / UNSS', accompagnement:'Accompagnement', autre:'Autre' };
    if (hpcs.length === 0) {
      container.innerHTML = '<div class="ens-empty">'
        + '<p>Aucune heure pédagogique complémentaire saisie.</p>'
        + '<p class="ens-empty-hint">Allez dans le module <strong>H. Péda. Complémentaires</strong> pour les ajouter.</p>'
        + '<button class="btn-secondary" data-navigate="hpc" style="margin-top:.75rem">→ Aller aux HPC</button>'
        + '</div>';
      return;
    }
    const parCat = {};
    hpcs.forEach(h => { const c = h.categorie || 'autre'; if (!parCat[c]) parCat[c] = []; parCat[c].push(h); });
    let totalH = 0, totalHP = 0, totalHSA = 0;
    const toutOuvertsHPC = Object.keys(parCat).every(k => _hpcOpen.has(k));
    let html = '<div class="ens-disc-toolbar">'
      + '<button class="btn-secondary btn-sm" data-action="toggle-all-hpc" data-open="' + (!toutOuvertsHPC ? '1' : '0') + '">'
      + (toutOuvertsHPC ? '▲ Tout replier' : '▼ Tout déplier') + '</button></div>';
    Object.entries(parCat).forEach(([cat, liste]) => {
      const catOpen = _hpcOpen.has(cat);
      const catHSum = Math.round(liste.reduce((s, h) => s + (h.heures || 0), 0) * 2) / 2;
      html += '<div class="ens-disc-bloc">'
        + '<div class="ens-disc-header" data-action="toggle-hpc-cat" data-cat="' + _esc(cat) + '" style="cursor:pointer">'
          + '<span class="ens-disc-toggle">' + (catOpen ? '▲' : '▼') + '</span>'
          + '<span class="ens-disc-nom">' + _esc(CATS[cat] || cat) + '</span>'
          + '<span class="ens-disc-spacer"></span>'
          + '<span class="ens-disc-service">' + liste.length + ' entrée' + (liste.length > 1 ? 's' : '') + ' · ' + catHSum + 'h</span>'
        + '</div>'
        + '<div class="ens-disc-body' + (catOpen ? '' : ' is-hidden') + '">';
      html += '<table class="ens-table ens-disc-table ens-disc-table-hpc"><thead><tr>'
        + '<th>Intitulé</th><th>Classe(s)</th><th>Discipline</th>'
        + '<th class="ens-col-num">Type</th><th class="ens-col-num">H/sem</th>'
        + '<th class="ens-col-num">Effectif</th>'
        + '<th class="hpc-col-ens">Enseignant(s)</th>'
        + '</tr></thead><tbody>';
      let catH = 0;
      liste.forEach(h => {
        const disc = h.disciplineId ? (discMap[h.disciplineId]?.nom || '—') : '—';
        const type = (h.typeHeure || 'hp') === 'hsa'
          ? '<span class="dot-col-badge dot-col-hsa">HSA</span>'
          : '<span class="dot-col-badge dot-col-hp">HP</span>';
        catH += h.heures || 0;
        if ((h.typeHeure || 'hp') === 'hsa') totalHSA += h.heures || 0; else totalHP += h.heures || 0;
        const classesNoms = Array.isArray(h.classesIds) && h.classesIds.length > 0
          ? h.classesIds.map(id => divMap[id]?.nom || '?').join(', ')
          : '<span class="ens-disc-vide">Toutes</span>';
        const enseignants = Array.isArray(h.enseignants) ? h.enseignants : [];
        let ensCell = enseignants.length === 0
          ? '<span class="ens-disc-vide">Non affecté</span>'
          : enseignants.map((aff, idx) => {
              const ens = DGHData.getEnseignant(aff.ensId);
              const label = ens
                ? _esc((ens.prenom ? ens.prenom + ' ' : '') + ens.nom)
                  + (aff.heures > 0 ? ' <span class="hpc-ens-h">' + aff.heures + 'h</span>' : '')
                : '<span class="ens-disc-vide">?</span>';
              return '<span class="hpc-ens-tag">' + label
                + '<button class="btn-icon btn-icon-danger hpc-ens-retirer"'
                  + ' data-action="retirer-ens-hpc" data-hpc-id="' + h.id + '" data-ens-idx="' + idx + '"'
                  + ' title="Retirer cet enseignant">✕</button>'
              + '</span>';
            }).join('');
        const addBtn = '<button class="btn-icon btn-icon-add hpc-ens-add"'
          + ' data-action="affecter-ens-hpc" data-hpc-id="' + h.id + '" title="Ajouter un enseignant">+</button>';
        html += '<tr>'
          + '<td class="ens-nom">' + _esc(h.nom || '—') + '</td>'
          + '<td class="ens-disc-ro hpc-classes-cell">' + classesNoms + '</td>'
          + '<td class="ens-disc-ro">' + _esc(disc) + '</td>'
          + '<td class="ens-col-num">' + type + '</td>'
          + '<td class="ens-col-num">' + (h.heures || 0) + 'h</td>'
          + '<td class="ens-col-num">' + (h.effectif > 0 ? h.effectif + ' élèves' : '—') + '</td>'
          + '<td class="hpc-col-ens"><div class="hpc-ens-wrap">' + ensCell + addBtn + '</div></td>'
        + '</tr>';
      });
      catH = Math.round(catH * 2) / 2; totalH += catH;
      html += '</tbody><tfoot><tr class="ens-disc-tfoot">'
        + '<td colspan="4" class="ens-disc-tfoot-label">Sous-total</td>'
        + '<td class="ens-col-num ens-disc-tfoot-hdisc">' + catH + 'h</td>'
        + '<td colspan="2"></td>'
      + '</tr></tfoot></table>';
      html += '</div></div>';
    });
    totalH = Math.round(totalH*2)/2; totalHP = Math.round(totalHP*2)/2; totalHSA = Math.round(totalHSA*2)/2;
    html += '<div class="ens-disc-total">'
      + '<span class="ens-disc-total-label">Total HPC</span>'
      + '<span class="ens-disc-total-dot"><span class="dot-col-badge dot-col-hp">HP</span> ' + totalHP + 'h</span>'
      + '<span class="ens-disc-total-serv"><span class="dot-col-badge dot-col-hsa">HSA</span> ' + totalHSA + 'h</span>'
      + '<span class="ens-disc-total-ecart">' + totalH + 'h total</span>'
    + '</div>';
    container.innerHTML = html;
  }
  // ── AJOUT DEPUIS VUE DISCIPLINE ────────────────────────────────────────
  // Ouvre la modal de sélection d'un enseignant existant pour l'affecter à une discipline
  function openModalEnsDisc(discNom) {
    const modal = document.getElementById('modalSelEns');
    if (!modal) return;
    // Stocker la discipline cible dans le modal
    const discInput = document.getElementById('selEnsDiscCible');
    if (discInput) discInput.value = discNom || '';
    // Titre
    const title = document.getElementById('modalSelEnsTitle');
    if (title) title.textContent = 'Affecter un enseignant à : ' + (discNom || '—');
    // Remplir la liste des enseignants (exclu ceux déjà dans cette discipline)
    _renderSelEnsList(discNom);
    modal.classList.add('modal-open');
  }

  function closeModalSelEns() {
    document.getElementById('modalSelEns')?.classList.remove('modal-open');
  }

  function _renderSelEnsList(discNom) {
    const container = document.getElementById('selEnsList');
    if (!container) return;
    const tous = DGHData.getEnseignants();
    // Enseignants pas encore dans cette discipline
    const disponibles = tous.filter(ens => {
      const discs = Array.isArray(ens.disciplines) ? ens.disciplines : [];
      return !discs.some(d => d.discNom === discNom);
    });

    if (disponibles.length === 0) {
      container.innerHTML = '<p class="sel-ens-empty">Tous les enseignants sont déjà affectés à cette discipline.</p>';
      return;
    }

    let html = '<table class="sel-ens-table"><thead><tr>' +
      '<th>Nom</th><th>Prénom</th><th>Grade</th><th>H. établ.</th><th>H. dans cette discipline</th>' +
      '</tr></thead><tbody>';

    disponibles.forEach(ens => {
      const d = Calculs.detailEnseignant(ens);
      // Heures restantes non affectées à une discipline
      const hDiscs = Array.isArray(ens.disciplines)
        ? ens.disciplines.reduce((s, dd) => s + (dd.heures || 0), 0)
        : 0;
      const hLibres = Math.max(0, Math.round(((ens.heures||0) - hDiscs) * 2) / 2);
      html +=
        '<tr>' +
          '<td class="ens-nom">' + _esc(ens.nom||'—') + '</td>' +
          '<td>' + _esc(ens.prenom||'') + '</td>' +
          '<td>' + _esc(GRADE_LABELS[ens.grade]||'—') + '</td>' +
          '<td class="ens-col-num">' + (ens.heures||0) + 'h' + (hLibres > 0 ? ' <span class="sel-ens-libre">(' + hLibres + 'h libres)</span>' : '') + '</td>' +
          '<td class="ens-col-num">' +
            '<input class="ens-inline-input ens-inline-num sel-ens-hdisc-input" ' +
              'data-ens-id="' + ens.id + '" ' +
              'type="number" min="0" max="' + (ens.heures||40) + '" step="0.5" ' +
              'value="' + hLibres + '" ' +
              'placeholder="h dans cette disc." />' +
          '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // Confirme l'affectation des enseignants sélectionnés (tous ceux avec h > 0)
  // Confirme l'affectation — route vers HPC ou discipline selon la cible
  function confirmerSelEns() {
    const cible = document.getElementById('selEnsDiscCible')?.value || '';
    if (cible.startsWith('__hpc__')) {
      const hpcId = cible.replace('__hpc__', '');
      const hpc   = DGHData.getHPC(hpcId);
      if (!hpc) { closeModalSelEns(); return; }
      const liste  = Array.isArray(hpc.enseignants) ? hpc.enseignants.slice() : [];
      const inputs = document.querySelectorAll('.sel-ens-hdisc-input');
      let nb = 0;
      inputs.forEach(inp => {
        const h = parseFloat(inp.value) || 0; const id = inp.dataset.ensId;
        if (!id || h <= 0) return;
        const existIdx = liste.findIndex(a => a.ensId === id);
        if (existIdx >= 0) liste[existIdx].heures = h; else liste.push({ ensId: id, heures: h });
        nb++;
      });
      DGHData.updateHPC(hpcId, { enseignants: liste });
      closeModalSelEns();
      if (nb > 0) { renderEnseignants(); app.toast(nb + ' enseignant' + (nb > 1 ? 's affectés' : ' affecté') + ' à ' + (hpc.nom || 'cette HPC') + '.', 'success'); }
      else app.toast('Aucune heure saisie — aucune affectation modifiée.', 'info');
      return;
    }
    const discNom  = cible;
    const inputs   = document.querySelectorAll('.sel-ens-hdisc-input');
    let nb = 0;
    inputs.forEach(inp => {
      const h   = parseFloat(inp.value) || 0;
      const id  = inp.dataset.ensId;
      if (h <= 0 || !id) return;
      const ens = DGHData.getEnseignant(id);
      if (!ens) return;
      let discs = Array.isArray(ens.disciplines) ? ens.disciplines.map(d => ({ discNom: d.discNom, heures: d.heures })) : [];
      if (discs.length === 0) { discs = [{ discNom: discNom, heures: h }]; }
      else { discs[0].heures = Math.max(0, Math.round((discs[0].heures - h) * 2) / 2); discs.push({ discNom: discNom, heures: h }); }
      const newTotal = Math.round(discs.reduce((s, d) => s + (d.heures || 0), 0) * 2) / 2;
      DGHData.updateEnseignant(id, { disciplines: discs, heures: Math.max(ens.heures||0, newTotal) });
      nb++;
    });
    closeModalSelEns();
    if (nb > 0) { renderEnseignants(); app.toast(nb + ' enseignant' + (nb > 1 ? 's affectés à ' : ' affecté à ') + discNom + '.', 'success'); }
    else app.toast('Aucune heure saisie — aucun enseignant affecté.', 'info');
  }
  function handleInlineHDisc(el) {
    const id      = el.dataset.ensId;
    const discNom = el.dataset.disc;
    const newH    = parseFloat(el.value) || 0;
    if (!id || !discNom) return;
    const ens = DGHData.getEnseignant(id);
    if (!ens) return;
    const totalEtabl = parseFloat(ens.heures) || 0;

    // Copie des disciplines
    let discs = Array.isArray(ens.disciplines)
      ? ens.disciplines.map(d => ({ discNom: d.discNom, heures: d.heures }))
      : [];

    const idx = discs.findIndex(d => d.discNom === discNom);
    const oldH = idx >= 0 ? (discs[idx].heures || 0) : 0;
    if (idx >= 0) discs[idx].heures = newH;
    else          discs.push({ discNom, heures: newH });

    // Option A : la discipline principale (index 0) absorbe le delta
    // seulement si la discipline modifiée n'est PAS la principale
    if (discs.length > 1 && discs[0].discNom !== discNom) {
      const delta = newH - oldH; // ce qu'on a ajouté dans cette discipline
      discs[0].heures = Math.max(0, Math.round((discs[0].heures - delta) * 2) / 2);
    }

    // Recalculer H.établissement = somme des disciplines
    const newTotal = Math.round(discs.reduce((s, d) => s + (d.heures || 0), 0) * 2) / 2;
    DGHData.updateEnseignant(id, { disciplines: discs, heures: newTotal });
    _refreshKPI();
    _renderVueDisc(DGHData.getEnseignants());
  }

  // Retirer un enseignant d'une discipline (sans le supprimer du tableau)
  function retirerEnsDisc(id, discNom) {
    const ens = DGHData.getEnseignant(id);
    if (!ens) return;
    let discs = Array.isArray(ens.disciplines)
      ? ens.disciplines.map(d => ({ discNom: d.discNom, heures: d.heures }))
      : [];
    const removed = discs.find(d => d.discNom === discNom);
    discs = discs.filter(d => d.discNom !== discNom);
    // Remettre les heures sur la discipline principale si elle existe
    if (removed && discs.length > 0) {
      discs[0].heures = Math.round((discs[0].heures + (removed.heures || 0)) * 2) / 2;
    }
    const newTotal = Math.round(discs.reduce((s, d) => s + (d.heures || 0), 0) * 2) / 2;
    DGHData.updateEnseignant(id, { disciplines: discs, heures: newTotal });
    _renderVueDisc(DGHData.getEnseignants());
    _refreshKPI();
    app.toast('Enseignant retiré de ' + discNom + '.', 'info');
  }

  // ── ÉDITION INLINE ──────────────────────────────────────────────────────────
  function handleInlineEdit(el) {
    const id    = el.dataset.ensId;
    const field = el.dataset.field;
    if (!id || !field) return;
    if (field === 'heures-disc') { handleInlineHDisc(el); return; }
    let val = el.value;
    if (field === 'heures') val = parseFloat(val) || 0;
    if (field === 'orsManuel') {
      val = (val === '' || val === null) ? null : (parseFloat(val) || null);
    }
    if (field === 'nom' && !(val||'').trim()) { el.value = DGHData.getEnseignant(id)?.nom || ''; return; }
    DGHData.updateEnseignant(id, { [field]: val });
    _refreshRowCalc(id);
    _refreshKPI();
  }

  function _refreshRowCalc(id) {
    const ens  = DGHData.getEnseignant(id); if (!ens) return;
    const hpcs = DGHData.getHeuresPedaComp();
    const sv   = Calculs.serviceTotalEnseignant(ens, hpcs);
    // HP disc.
    const hpEl = document.getElementById('ens-hp-' + id);
    if (hpEl) hpEl.innerHTML = '<span class="ens-service-hp">' + sv.hpDisc + 'h</span>';
    // HPC-HP
    const hpcHpEl = document.getElementById('ens-hpchp-' + id);
    if (hpcHpEl) {
      if (sv.hpHPC > 0) {
        const hpcHpLines = sv.detailHPCHp.map(d => '• ' + d.nom + ' : ' + d.heures + 'h').join('\n');
        hpcHpEl.innerHTML = '<span class="ens-service-hpc-hp" title="' + _esc(hpcHpLines) + '">' + sv.hpHPC + 'h ⓘ</span>';
      } else { hpcHpEl.innerHTML = '<span class="ens-service-hsa-zero">—</span>'; }
    }
    // HSA
    const hsaEl = document.getElementById('ens-hsa-' + id);
    if (hsaEl) {
      if (sv.hsaTotal > 0) {
        const lines = sv.detailHSA.map(d => '• ' + d.nom + ' : ' + d.heures + 'h').join('\n');
        hsaEl.innerHTML = '<span class="ens-service-hsa-nonzero" title="' + _esc(lines) + '">' + sv.hsaTotal + 'h ⓘ</span>';
      } else { hsaEl.innerHTML = '<span class="ens-service-hsa-zero">—</span>'; }
    }
    // Dispo
    const dispoEl = document.getElementById('ens-dispo-' + id);
    if (dispoEl) dispoEl.innerHTML = _affDispoORS(sv);
  }
  function _refreshKPI() { renderEnseignants(); }

  // ── BASCULER VUE ───────────────────────────────────────────────────────────
  function setVueListe() { _vueMode = 'liste';       renderEnseignants(); }
  function setVueDisc()  { _vueMode = 'discipline'; renderEnseignants(); }
  function setVueHPC()   { _vueMode = 'hpc';         renderEnseignants(); }

  function toggleDiscBloc(discNom) {
    if (_discOpen.has(discNom)) _discOpen.delete(discNom);
    else                        _discOpen.add(discNom);
    renderEnseignants();
  }
  function toggleAllDiscs(open) {
    const bilans = Calculs.bilanParDiscipline(
      DGHData.getEnseignants(), DGHData.getRepartition(), DGHData.getDisciplines()
    );
    bilans.forEach(b => open ? _discOpen.add(b.disc) : _discOpen.delete(b.disc));
    renderEnseignants();
  }

  // ── BADGE STATUT ────────────────────────────────────────────────────────
  function _statutBadge(statut) {
    const cls = { titulaire:'ens-badge-titulaire', bmp:'ens-badge-bmp', tzr:'ens-badge-tzr', contractuel:'ens-badge-contractuel' }[statut] || '';
    return '<span class="ens-badge ' + cls + '">' + _esc(STATUT_LABELS[statut]||statut||'—') + '</span>';
  }

  // ── MODAL DÉTAILS ────────────────────────────────────────────────────────
  function openModalEns(id) {
    const modal = document.getElementById('modalEns'); if (!modal) return;
    const ens = id ? DGHData.getEnseignant(id) : null;
    const discVal = ens ? (ens.disciplinePrincipale || (Array.isArray(ens.disciplines) && ens.disciplines[0] ? ens.disciplines[0].discNom : '')) : '';
    document.getElementById('modalEnsId').value        = id || '';
    document.getElementById('modalEnsTitle').textContent = ens ? "Modifier l'enseignant" : 'Ajouter un enseignant';
    document.getElementById('inputEnsNom').value        = ens ? (ens.nom||'') : '';
    document.getElementById('inputEnsPrenom').value     = ens ? (ens.prenom||'') : '';
    document.getElementById('inputEnsGrade').value      = ens ? (ens.grade||'certifie') : 'certifie';
    document.getElementById('inputEnsStatut').value     = ens ? (ens.statut||'titulaire') : 'titulaire';
    document.getElementById('inputEnsDisc').value       = discVal;
    document.getElementById('inputEnsHeures').value     = ens ? (ens.heures||'') : '';
    document.getElementById('inputEnsOrsManuel').value  = (ens && ens.orsManuel !== null && ens.orsManuel !== undefined) ? ens.orsManuel : '';
    document.getElementById('inputEnsComment').value    = ens ? (ens.commentaire||'') : '';
    _updateOrsPreview();
    modal.classList.add('modal-open');
    document.getElementById('inputEnsNom').focus();
  }

  function closeModalEns() { document.getElementById('modalEns')?.classList.remove('modal-open'); }

  function saveModalEns() {
    const id = document.getElementById('modalEnsId').value.trim();
    const nom = document.getElementById('inputEnsNom').value.trim();
    const prenom = document.getElementById('inputEnsPrenom').value.trim();
    if (!nom) { app.toast('Le nom est obligatoire.', 'error'); return; }
    const disc   = document.getElementById('inputEnsDisc').value.trim();
    const heures = parseFloat(document.getElementById('inputEnsHeures').value) || 0;
    const fields = {
      nom, prenom,
      grade:   document.getElementById('inputEnsGrade').value,
      statut:  document.getElementById('inputEnsStatut').value,
      orsManuel:   document.getElementById('inputEnsOrsManuel').value.trim() || null,
      commentaire: document.getElementById('inputEnsComment').value.trim(),
      // Initialiser ou mettre a jour la discipline principale
      disciplinePrincipale: disc,
      heures
    };
    if (id) {
      // Mettre a jour en preservant les autres disciplines
      const ens = DGHData.getEnseignant(id);
      const discs = Array.isArray(ens?.disciplines) ? ens.disciplines.slice() : [];
      if (disc && discs.length === 0) discs.push({ discNom: disc, heures });
      else if (disc && discs.length > 0) { discs[0].discNom = disc; if (discs.length === 1) discs[0].heures = heures; }
      fields.disciplines = discs.length > 0 ? discs : (disc ? [{ discNom: disc, heures }] : []);
      DGHData.updateEnseignant(id, fields);
      app.toast('Enseignant mis à jour.', 'success');
    } else {
      if (DGHData.findEnseignantByNomPrenom(nom, prenom)) { app.toast('Cet enseignant existe déjà.', 'warning', 5000); return; }
      DGHData.addEnseignant(fields);
      app.toast('Enseignant ajouté.', 'success');
    }
    closeModalEns(); renderEnseignants();
  }

  function updateOrsPreview() { _updateOrsPreview(); }
  function _updateOrsPreview() {
    const gEl = document.getElementById('inputEnsGrade');
    const mEl = document.getElementById('inputEnsOrsManuel');
    const pEl = document.getElementById('ensOrsPreview');
    if (!gEl || !pEl) return;
    const ors    = Calculs.getORS(gEl.value, mEl && mEl.value.trim() !== '' ? parseFloat(mEl.value) : null);
    const heures = parseFloat(document.getElementById('inputEnsHeures')?.value) || 0;
    if (ors === 0) { pEl.textContent = 'ORS : — (hors champ DGH)'; pEl.className = 'ens-ors-preview'; return; }
    const ecart = Math.round((heures - ors) * 2) / 2;
    const signe = ecart > 0 ? '+' : '';
    pEl.textContent = 'ORS : ' + ors + 'h — Écart : ' + signe + ecart + 'h';
    pEl.className   = 'ens-ors-preview' + (ecart > 0 ? ' solde-hsa' : ecart < 0 ? ' solde-danger' : ' solde-neutre');
  }

  // ── SUPPRESSION INDIVIDUELLE ────────────────────────────────────────────
  function confirmDeleteEns(id) {
    const ens = DGHData.getEnseignant(id); if (!ens) return;
    _pendingDeleteId = id;
    const msg = document.getElementById('confirmEnsMsg');
    if (msg) msg.textContent = (ens.prenom ? ens.prenom + ' ' : '') + ens.nom;
    document.getElementById('confirmEns')?.classList.add('modal-open');
  }
  function closeConfirmEns() { document.getElementById('confirmEns')?.classList.remove('modal-open'); _pendingDeleteId = null; }
  function execDeleteEns() {
    if (!_pendingDeleteId) return;
    DGHData.deleteEnseignant(_pendingDeleteId);
    closeConfirmEns(); renderEnseignants();
    app.toast('Enseignant supprimé.', 'success');
  }

  // ── SUPPRESSION GLOBALE ──────────────────────────────────────────────────
  function confirmDeleteAll() {
    const nb = DGHData.getEnseignants().length;
    if (nb === 0) { app.toast('Aucun enseignant à supprimer.', 'info'); return; }
    const msg = document.getElementById('confirmEnsAllMsg');
    if (msg) msg.textContent = nb + ' enseignant' + (nb > 1 ? 's' : '') + ' seront définitivement supprimés.';
    document.getElementById('confirmEnsAll')?.classList.add('modal-open');
  }
  function closeConfirmAll() { document.getElementById('confirmEnsAll')?.classList.remove('modal-open'); }
  function execDeleteAll() {
    const nb = DGHData.deleteAllEnseignants();
    closeConfirmAll(); renderEnseignants();
    app.toast(nb + ' enseignant' + (nb > 1 ? 's supprimés.' : ' supprimé.'), 'success');
  }

  // ── IMPORT CSV ────────────────────────────────────────────────────────────
  function openModalCSV() {
    const modal = document.getElementById('modalCSV'); if (!modal) return;
    _csvLignes = []; _resetCSVModal(); modal.classList.add('modal-open');
  }
  function closeModalCSV() { document.getElementById('modalCSV')?.classList.remove('modal-open'); _csvLignes = []; }
  function _resetCSVModal() {
    const p = document.getElementById('csvPreview');
    if (p) p.innerHTML = '<p class="csv-hint">Glissez un fichier CSV EDT/Pronote ou cliquez pour sélectionner.</p>';
    document.getElementById('btnCSVConfirm')?.classList.add('is-hidden');
    const input = document.getElementById('csvFileInput'); if (input) input.value = '';
  }
  function handleCSVFile(file) {
    if (!file) return;
    const tryRead = enc => new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsText(file, enc); });
    tryRead('UTF-8').then(text => (text.includes('\ufffd') || /[\x80-\x9f]/.test(text)) ? tryRead('windows-1252') : text).then(text => _parseAndPreviewCSV(text));
  }
  function _parseAndPreviewCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) { _showCSVError('Fichier vide.'); return; }
    const sep = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g,'').toLowerCase());
    const COL_MAP = {
      nom:     ['nom','name','last name','lastname'],
      prenom:  ['prénom','prenom','first name','firstname','given name'],
      grade:   ['corps','grade','catégorie','categorie'],
      matiere: ['matière','matiere','discipline','subject'],
      statut:  ['statut','type','contrat','type de contrat'],
      heures:  ['heures','h/sem','h sem','volume horaire','heures/semaine','apport','ahe (etablissement)','ahe (établissement)']
    };
    const idx = {};
    Object.entries(COL_MAP).forEach(([key, variants]) => {
      idx[key] = -1;
      for (const v of variants) { const i = headers.indexOf(v); if (i !== -1) { idx[key] = i; break; } }
    });
    if (idx.nom === -1 && idx.prenom === -1) { _showCSVError('Colonnes Nom/Prénom non détectées.'); return; }
    let dataStart = 1;
    if (lines.length > 2) {
      const l1 = _splitCSVLine(lines[1], sep);
      const l1n = idx.nom >= 0 ? _cell(l1, idx.nom) : '';
      const l1p = idx.prenom >= 0 ? _cell(l1, idx.prenom) : '';
      if (!l1n && !l1p && l1.some(c => c.trim() !== '')) dataStart = 2;
    }
    const parsed = [];
    for (let i = dataStart; i < lines.length; i++) {
      const cells  = _splitCSVLine(lines[i], sep);
      const nom    = idx.nom    >= 0 ? _cell(cells, idx.nom)    : '';
      const prenom = idx.prenom >= 0 ? _cell(cells, idx.prenom) : '';
      if (!nom && !prenom) continue;
      const gradeRaw   = idx.grade   >= 0 ? _cell(cells, idx.grade)   : '';
      const matiereRaw = idx.matiere >= 0 ? _cell(cells, idx.matiere) : '';
      const statutRaw  = idx.statut  >= 0 ? _cell(cells, idx.statut)  : '';
      const heuresRaw  = idx.heures  >= 0 ? _cell(cells, idx.heures)  : '';
      const matiere    = _normalizeDiscipline(matiereRaw);
      parsed.push({ nom, prenom,
        grade: _normalizeGrade(gradeRaw), gradeRaw,
        statut: _normalizeStatut(statutRaw),
        disciplinePrincipale: matiere, matiereRaw,
        heures: _parseHeures(heuresRaw),
        existant: DGHData.findEnseignantByNomPrenom(nom, prenom)
      });
    }
    if (parsed.length === 0) { _showCSVError('Aucune ligne exploitable.'); return; }
    _csvLignes = parsed; _showCSVPreview(parsed, idx);
  }
  function _splitCSVLine(line, sep) {
    const res = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQ = !inQ;
      else if (ch === sep && !inQ) { res.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    res.push(cur.trim()); return res;
  }
  function _cell(cells, i) { return (cells[i]||'').replace(/^["']|["']$/g,'').trim(); }
  function _parseHeures(raw) {
    if (!raw || raw.trim() === '' || raw.trim() === '0h00') return 0;
    const r = raw.trim().toLowerCase();
    const hm = r.match(/^(\d+)h(\d{2})$/);
    if (hm) return Math.round((parseInt(hm[1],10) + parseInt(hm[2],10)/60) * 2) / 2;
    return parseFloat(r.replace(',','.')) || 0;
  }
  function _normalizeDiscipline(raw) {
    if (!raw || !raw.trim()) return '';
    let s = raw.trim().replace(/^[A-Z]\d{4}\s+/,'').trim();
    const MAP = {
      'ARTS PLAST':'Arts plastiques','PHY.CHIMIE':'Physique-Chimie',
      'ANGLAIS':'LV1','ALLEMAND':'LV2','ESPAGNOL':'LV2',
      'LET MODERN':'Français','MATHEMATIQ':'Mathématiques',
      'HIST. GEO.':'Histoire-Géographie','TECHNOLOGI':'Technologie',
      'S. V. T.':'SVT','EDU MUSICA':'Éducation musicale',
      'EDUC.MUSIC.':'Éducation musicale',
      'E.P.S.':'EPS','E. P. S':'EPS','E. P. S.':'EPS','EPS':'EPS',
      'E.M.C.':'EMC','LATIN':'Latin','GREC':'Grec','DOCUMENTATION':'Documentation'
    };
    return MAP[s.toUpperCase().trim()] || s;
  }
  function _normalizeGrade(raw) {
    const r = (raw||'').toLowerCase();
    if (r.includes('agr')) return 'agrege';
    if (r.includes('plp')) return 'plp';
    if (r.startsWith('eps') || r.includes('staps')) return 'eps';
    if (r.includes('contract') || r.includes('vacataire')) return 'contractuel';
    return 'certifie';
  }
  function _normalizeStatut(raw) {
    const r = (raw||'').toLowerCase();
    if (r.includes('bmp')) return 'bmp';
    if (r.includes('tzr') || r.includes('rempla')) return 'tzr';
    if (r.includes('contract') || r.includes('vacataire')) return 'contractuel';
    return 'titulaire';
  }
  function _showCSVError(msg) {
    const p = document.getElementById('csvPreview');
    if (p) p.innerHTML = '<p class="csv-error">\u26a0 ' + _esc(msg) + '</p>';
    document.getElementById('btnCSVConfirm')?.classList.add('is-hidden');
    _csvLignes = [];
  }
  function _showCSVPreview(parsed, idx) {
    const missing = [];
    if (idx.grade === -1) missing.push('Corps/Grade');
    if (idx.matiere === -1) missing.push('Matière');
    if (idx.statut === -1) missing.push('Statut');
    if (idx.heures === -1) missing.push('Heures');
    const nbN = parsed.filter(l => !l.existant).length;
    const nbM = parsed.filter(l =>  l.existant).length;
    let html = '';
    if (missing.length > 0) html += '<p class="csv-warn">\u26a0 Colonnes non détectées : ' + _esc(missing.join(', ')) + '. \xc0 compléter manuellement.</p>';
    html += '<p class="csv-summary">' + parsed.length + ' ligne(s) \xb7 <span class="csv-new">' + nbN + ' nouveau(x)</span>' + (nbM > 0 ? ' \xb7 <span class="csv-update">' + nbM + ' mise(s) \xe0 jour</span>' : '') + '</p>';
    html += '<div class="csv-table-wrap"><table class="csv-preview-table"><thead><tr><th>Nom</th><th>Prénom</th><th>Grade</th><th>Statut</th><th>Discipline</th><th>Heures</th><th>\xc9tat</th></tr></thead><tbody>';
    parsed.forEach(l => {
      const etat = l.existant ? '<span class="csv-badge-update">Mise \xe0 jour</span>' : '<span class="csv-badge-new">Nouveau</span>';
      html += '<tr><td>' + _esc(l.nom) + '</td><td>' + _esc(l.prenom) + '</td><td>' + _esc(GRADE_LABELS[l.grade]||l.gradeRaw||'\u2014') + '</td><td>' + _esc(STATUT_LABELS[l.statut]||'\u2014') + '</td><td>' + _esc(l.disciplinePrincipale||'\u2014') + '</td><td>' + (l.heures > 0 ? l.heures + 'h' : '\u2014') + '</td><td>' + etat + '</td></tr>';
    });
    html += '</tbody></table></div>';
    const p = document.getElementById('csvPreview'); if (p) p.innerHTML = html;
    const btn = document.getElementById('btnCSVConfirm');
    if (btn) { btn.textContent = 'Importer ' + parsed.length + ' enseignant(s)'; btn.classList.remove('is-hidden'); }
  }
  function confirmImportCSV() {
    if (_csvLignes.length === 0) return;
    let nbA = 0, nbM = 0;
    _csvLignes.forEach(l => {
      if (l.existant) {
        DGHData.updateEnseignant(l.existant.id, { grade: l.grade, statut: l.statut, disciplinePrincipale: l.disciplinePrincipale, heures: l.heures });
        nbM++;
      } else {
        DGHData.addEnseignant({ nom: l.nom, prenom: l.prenom, grade: l.grade, statut: l.statut, disciplinePrincipale: l.disciplinePrincipale, heures: l.heures });
        nbA++;
      }
    });
    closeModalCSV(); renderEnseignants();
    app.toast(nbA + ' ajouté(s), ' + nbM + ' mis \xe0 jour.', 'success', 4000);
  }

  // ── DRAG & DROP ───────────────────────────────────────────────────────────────
  function bindDropZone() {
    const zone = document.getElementById('csvDropZone'); if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('csv-drop-active'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('csv-drop-active'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('csv-drop-active'); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); });
  }


  function toggleHPCCat(cat) {
    if (_hpcOpen.has(cat)) _hpcOpen.delete(cat);
    else                    _hpcOpen.add(cat);
    renderEnseignants();
  }
  function toggleAllHPC(open) {
    const hpcs = DGHData.getHeuresPedaComp();
    const cats = new Set(hpcs.map(h => h.categorie || 'autre'));
    cats.forEach(cat => open ? _hpcOpen.add(cat) : _hpcOpen.delete(cat));
    renderEnseignants();
  }

  // ── AFFECTATION ENSEIGNANT(S) À UNE HPC — multi, avec quotés ─────────────────
  function openModalAffecterHPC(hpcId) {
    const modal = document.getElementById('modalSelEns'); if (!modal) return;
    const hpc = DGHData.getHPC(hpcId); if (!hpc) return;
    const discInput = document.getElementById('selEnsDiscCible');
    if (discInput) discInput.value = '__hpc__' + hpcId;
    const title = document.getElementById('modalSelEnsTitle');
    if (title) title.textContent = 'Affecter un enseignant à : ' + (hpc.nom || '—');
    const hint = modal.querySelector('.form-hint');
    if (hint) hint.textContent = 'Saisissez les heures sur cette HPC (' + (hpc.heures || 0) + 'h/sem.). Plusieurs enseignants possibles.';
    _renderSelEnsListeHPC(hpc);
    modal.classList.add('modal-open');
  }

  function _renderSelEnsListeHPC(hpc) {
    const container = document.getElementById('selEnsList'); if (!container) return;
    const tous = DGHData.getEnseignants();
    if (tous.length === 0) { container.innerHTML = '<p class="sel-ens-empty">Aucun enseignant saisi.</p>'; return; }
    const affectes    = Array.isArray(hpc.enseignants) ? hpc.enseignants : [];
    const affectesMap = Object.fromEntries(affectes.map(a => [a.ensId, a.heures]));
    let html = '<table class="sel-ens-table"><thead><tr>'
      + '<th>Nom</th><th>Prénom</th><th>Grade</th>'
      + '<th class="ens-col-num">H. établ.</th><th class="ens-col-num">H. sur cette HPC</th>'
      + '</tr></thead><tbody>';
    tous.forEach(ens => {
      const d = Calculs.detailEnseignant(ens);
      const dejaH = affectesMap[ens.id] !== undefined ? affectesMap[ens.id] : 0;
      html += '<tr>'
        + '<td class="ens-nom">' + _esc(ens.nom || '—') + '</td>'
        + '<td>' + _esc(ens.prenom || '') + '</td>'
        + '<td>' + _esc(GRADE_LABELS[ens.grade] || '—') + '</td>'
        + '<td class="ens-col-num">' + (ens.heures || 0) + 'h'
          + (d.ors > 0 ? ' <span class="sel-ens-ors">/ ' + d.ors + 'h ORS</span>' : '') + '</td>'
        + '<td class="ens-col-num">'
          + (dejaH > 0 ? '<span class="sel-ens-deja">Actuel : ' + dejaH + 'h</span><br>' : '')
          + '<input class="ens-inline-input ens-inline-num sel-ens-hdisc-input"'
            + ' data-ens-id="' + ens.id + '" type="number" min="0" max="40" step="0.5" value="0" placeholder="0h" />'
        + '</td>'
      + '</tr>';
    });
    html += '</tbody></table>'
      + '<p style="margin-top:.5rem;font-size:.77rem;color:var(--c-text-muted)">Saisir > 0 pour affecter. Si déjà affecté, la valeur <strong>remplace</strong> la quoté actuelle.</p>';
    container.innerHTML = html;
  }

  function retirerEnsHPC(hpcId, ensIdx) {
    const hpc = DGHData.getHPC(hpcId); if (!hpc) return;
    const liste = Array.isArray(hpc.enseignants) ? hpc.enseignants.slice() : [];
    const idx   = parseInt(ensIdx, 10);
    if (isNaN(idx) || idx < 0 || idx >= liste.length) return;
    liste.splice(idx, 1);
    DGHData.updateHPC(hpcId, { enseignants: liste });
    renderEnseignants();
    app.toast('Enseignant retiré de la HPC.', 'info');
  }

  function affecterEnsHPCDirect(ensId) { confirmerSelEns(); }

  // ── UTILITAIRES ────────────────────────────────────────────────────────────
  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── API PUBLIQUE ────────────────────────────────────────────────────────
  return {
    renderEnseignants,
    setVueListe, setVueDisc, setVueHPC,
    toggleDiscBloc, toggleAllDiscs,
    toggleHPCCat, toggleAllHPC,
    openModalAffecterHPC, affecterEnsHPCDirect, retirerEnsHPC,
    handleInlineEdit,
    openModalEns, openModalEnsDisc, closeModalSelEns, confirmerSelEns,
    closeModalEns, saveModalEns, updateOrsPreview,
    retirerEnsDisc,
    confirmDeleteEns, closeConfirmEns, execDeleteEns,
    confirmDeleteAll, closeConfirmAll, execDeleteAll,
    openModalCSV, closeModalCSV, handleCSVFile, confirmImportCSV,
    bindDropZone
  };

})();
