/**
 * DGH App — Module Besoins & apports établissement (Sprint 19.1)
 *
 * Par discipline : besoin (répartition × divisions, + scénario actif) vs apport
 * de l'équipe (HP plafonné), HSA dans une colonne séparée, écart à arbitrer
 * (BMP / HSA / compléments). HSA absorbées saisies par discipline avec détail
 * dépliable par enseignant de la discipline.
 *
 * IIFE, zéro localStorage direct, zéro addEventListener sur éléments dynamiques.
 */
const DGHBesoins = (() => {

  const STATUT_LABELS = {
    titulaire:'Titulaire', bmp:'BMP', tzr:'TZR',
    contractuel:'Contractuel', 'temps-partiel':'Temps partiel'
  };

  let _open = new Set(); // disciplineId dépliés

  function _esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function _h(n){return Math.round((n||0)*2)/2;}
  function _set(id,t){const el=document.getElementById(id);if(el)el.textContent=t;}

  function renderBesoins() {
    const data    = DGHData.getAnnee();
    const scen    = DGHData.getScenarioActif();
    const bilan   = Calculs.bilanBesoinsApports(data, scen ? scen.modificateurs : null);
    const hsaAbs  = DGHData.getHsaAbsorbees();

    _renderBanner(scen);
    _renderKPI(bilan, hsaAbs);
    _renderTable(bilan, hsaAbs);
  }

  function _renderBanner(scen) {
    const el = document.getElementById('baScenBanner');
    if (!el) return;
    if (scen) {
      el.classList.remove('is-hidden');
      el.textContent = '⊕ Scénario actif « ' + (scen.nom || 'sans nom') + ' » : les besoins intègrent ses modificateurs.';
    } else {
      el.classList.add('is-hidden');
    }
  }

  function _renderKPI(bilan, hsaAbs) {
    _set('ba-kpi-besoin', _h(bilan.totBesoin) + ' h');
    _set('ba-kpi-hp',     _h(bilan.totApportHP) + ' h');
    _set('ba-kpi-hsa',    _h(bilan.totApportHSA) + ' h');
    const ecEl = document.getElementById('ba-kpi-ecart');
    if (ecEl) {
      const ec = _h(bilan.totEcart);
      ecEl.textContent = (ec > 0 ? '+' : '') + ec + ' h';
      ecEl.className = 'ba-kpi-value ' + (ec > 0 ? 'is-over' : ec < 0 ? 'is-ok' : '');
    }
  }

  function _renderTable(bilan, hsaAbs) {
    const wrap = document.getElementById('ba-table-wrap');
    if (!wrap) return;
    if (!bilan.rows.length) {
      wrap.innerHTML = '<div class="ba-empty"><p>Aucune discipline saisie.</p>'
        + '<p class="ba-empty-hint">Renseignez vos disciplines dans Dotation DGH pour voir les besoins et apports.</p></div>';
      return;
    }

    let html = '<table class="ba-table"><thead><tr>'
      + '<th>Discipline</th>'
      + '<th class="ba-num">Besoin</th>'
      + '<th class="ba-num">Apport HP</th>'
      + '<th class="ba-num">HSA équipe</th>'
      + '<th class="ba-num">Écart</th>'
      + '<th class="ba-num">HSA absorbées</th>'
      + '</tr></thead><tbody>';

    bilan.rows.forEach(r => {
      const isOpen = _open.has(r.disciplineId);
      const abs    = hsaAbs[r.disciplineId] || { total: 0, profs: {} };
      const dot    = '<span class="ba-disc-dot" style="background:' + (r.couleur || '#6b6860') + '"></span>';
      const caret  = '<span class="ba-caret' + (isOpen ? ' open' : '') + '">▸</span>';

      // Écart
      let ecCls = 'ba-ecart-zero', ecTxt = '0 h';
      if (r.ecart > 0) { ecCls = 'ba-ecart-pos'; ecTxt = '+' + _h(r.ecart) + ' h'; }
      else if (r.ecart < 0) { ecCls = 'ba-ecart-neg'; ecTxt = _h(r.ecart) + ' h'; }

      // Besoin + delta scénario
      const deltaTxt = r.deltaScen > 0
        ? ' <span class="ba-delta">(+' + _h(r.deltaScen) + ' scén.)</span>' : '';

      // Input HSA absorbées (total discipline)
      const hsaInput = '<input type="number" class="ba-hsa-input" min="0" max="200" step="0.5"'
        + ' value="' + (abs.total || '') + '" placeholder="0"'
        + ' data-ba-disc="' + r.disciplineId + '" data-ba-field="total"'
        + ' title="HSA absorbées sur cette discipline" />';

      html += '<tr class="ba-disc-row" data-action="ba-toggle" data-disc="' + r.disciplineId + '">'
        + '<td>' + caret + dot + '<span class="ba-disc-name">' + _esc(r.nom) + '</span></td>'
        + '<td class="ba-num ba-besoin-val">' + _h(r.besoin) + ' h' + deltaTxt + '</td>'
        + '<td class="ba-num"><span class="ba-hp-val">' + _h(r.apportHP) + ' h</span></td>'
        + '<td class="ba-num">' + (r.apportHSA > 0 ? '<span class="ba-hsa-val">' + _h(r.apportHSA) + ' h</span>' : '<span class="ba-zero">—</span>') + '</td>'
        + '<td class="ba-num"><span class="' + ecCls + '">' + ecTxt + '</span></td>'
        + '<td class="ba-num" onclick="event.stopPropagation()">' + hsaInput + '</td>'
        + '</tr>';

      // Sous-lignes : enseignants de la discipline (HSA absorbée par enseignant)
      if (isOpen) {
        if (r.profs.length === 0) {
          html += '<tr class="ba-prof-row"><td colspan="6"><em class="ba-zero">Aucun enseignant rattaché à cette discipline.</em></td></tr>';
        } else {
          let sommeProfs = 0;
          r.profs.forEach(p => {
            const hsaProf = (abs.profs && abs.profs[p.id]) || '';
            sommeProfs += parseFloat(hsaProf) || 0;
            const profInput = '<input type="number" class="ba-hsa-input" min="0" max="40" step="0.5"'
              + ' value="' + hsaProf + '" placeholder="0"'
              + ' data-ba-disc="' + r.disciplineId + '" data-ba-field="prof" data-ba-ens="' + p.id + '"'
              + ' title="HSA absorbées par cet enseignant sur ' + _esc(r.nom) + '" />';
            html += '<tr class="ba-prof-row">'
              + '<td><span class="ba-prof-name">' + _esc(p.nom) + ' ' + _esc(p.prenom) + '</span>'
                + '<span class="ba-prof-statut">' + (STATUT_LABELS[p.statut] || p.statut) + '</span></td>'
              + '<td class="ba-num ba-zero">' + _h(p.heures) + ' h</td>'
              + '<td class="ba-num"><span class="ba-hp-val">' + _h(p.hp) + ' h</span></td>'
              + '<td class="ba-num">' + (p.hsa > 0 ? '<span class="ba-hsa-val">' + _h(p.hsa) + ' h</span>' : '<span class="ba-zero">—</span>') + '</td>'
              + '<td class="ba-num"></td>'
              + '<td class="ba-num">' + profInput + '</td>'
              + '</tr>';
          });
          if (sommeProfs > 0) {
            html += '<tr class="ba-prof-row"><td colspan="6"><span class="ba-prof-sum">Somme HSA par enseignant : '
              + _h(sommeProfs) + ' h</span></td></tr>';
          }
        }
      }
    });

    html += '</tbody><tfoot><tr>'
      + '<td>TOTAL</td>'
      + '<td class="ba-num">' + _h(bilan.totBesoin) + ' h</td>'
      + '<td class="ba-num"><span class="ba-hp-val">' + _h(bilan.totApportHP) + ' h</span></td>'
      + '<td class="ba-num"><span class="ba-hsa-val">' + _h(bilan.totApportHSA) + ' h</span></td>'
      + '<td class="ba-num">' + (bilan.totEcart > 0 ? '+' : '') + _h(bilan.totEcart) + ' h</td>'
      + '<td class="ba-num"></td>'
      + '</tr></tfoot></table>';

    wrap.innerHTML = html;
  }

  // ── ACTIONS ─────────────────────────────────────────────────────
  function toggle(disciplineId) {
    if (_open.has(disciplineId)) _open.delete(disciplineId);
    else _open.add(disciplineId);
    renderBesoins();
  }

  function saveHsa(input) {
    const discId = input.dataset.baDisc;
    const field  = input.dataset.baField;
    const val    = input.value;
    if (field === 'prof') {
      DGHData.setHsaAbsorbeeEnseignant(discId, input.dataset.baEns, val);
    } else {
      DGHData.setHsaAbsorbeeDiscipline(discId, val);
    }
    // Pas de re-render complet pour ne pas perdre le focus ; MAJ silencieuse.
  }

  function exporterCSV() {
    const data  = DGHData.getAnnee();
    const scen  = DGHData.getScenarioActif();
    const bilan = Calculs.bilanBesoinsApports(data, scen ? scen.modificateurs : null);
    const hsaAbs = DGHData.getHsaAbsorbees();
    if (!bilan.rows.length) { app.toast('Aucune donnée à exporter.', 'warning'); return; }
    const rows = [['Discipline','Besoin (h)','Apport HP (h)','HSA équipe (h)','Écart (h)','HSA absorbées (h)']];
    bilan.rows.forEach(r => {
      const abs = hsaAbs[r.disciplineId] || { total: 0 };
      rows.push([r.nom, _h(r.besoin), _h(r.apportHP), _h(r.apportHSA), _h(r.ecart), _h(abs.total || 0)]);
    });
    rows.push([]);
    rows.push(['TOTAL', _h(bilan.totBesoin), _h(bilan.totApportHP), _h(bilan.totApportHSA), _h(bilan.totEcart), '']);
    app.downloadCSV('besoins-apports.csv', rows);
    app.toast('Besoins & apports exportés.', 'success');
  }

  return { renderBesoins, toggle, saveHsa, exporterCSV };
})();
