/**
 * DGH App — Module Équipe & HP/HSA (Sprint 19)
 *
 * Vue "Cadre de l'année > Équipe" : tableau de constitution de l'équipe,
 * apport de chaque enseignant dans l'établissement, et bascule automatique
 * HP → HSA (HP jusqu'au seuil ORS / volume BMP, dépassement en HSA).
 *
 * Source de vérité pour la remontée TRM de février.
 *
 * Architecture : IIFE, zéro localStorage direct (passe par DGHData),
 * zéro addEventListener sur éléments dynamiques (délégation dans app.js).
 */
const DGHEquipe = (() => {

  const STATUT_LABELS = {
    titulaire:      'Titulaire',
    bmp:            'BMP',
    tzr:            'TZR',
    contractuel:    'Contractuel',
    'temps-partiel':'Temps partiel'
  };

  const SRC_LABELS = {
    'ors-grade':  'ORS grade',
    'ors-manuel': 'ORS saisie',
    'bmp':        'volume BMP',
    'aucun':      '—'
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function _h(n) { return (Math.round((n||0)*2)/2); }
  function _set(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }

  // ── RENDER PRINCIPAL ────────────────────────────────────────────────
  function renderEquipe() {
    const enseignants = DGHData.getEnseignants();
    const hpcs        = DGHData.getHeuresPedaComp();
    const bilan       = Calculs.bilanEquipe(enseignants, hpcs);
    const bilanDot    = Calculs.bilanDotation(DGHData.getAnnee());

    _renderKPI(bilan, bilanDot);
    _renderStatutStrip(bilan);
    _renderTable(bilan);
  }

  // ── KPI ─────────────────────────────────────────────────────────────
  function _renderKPI(bilan, bilanDot) {
    _set('eq-kpi-hp',  _h(bilan.totalHP)  + ' h');
    _set('eq-kpi-hsa', _h(bilan.totalHSA) + ' h');
    _set('eq-kpi-tot', _h(bilan.totalGeneral) + ' h');

    _set('eq-kpi-hp-sub',  bilan.nbEns + ' enseignant' + (bilan.nbEns > 1 ? 's' : ''));
    const partHSA = bilan.totalGeneral > 0
      ? Math.round((bilan.totalHSA / bilan.totalGeneral) * 100) : 0;
    _set('eq-kpi-hsa-sub', partHSA + ' % du service');

    // Solde vs enveloppe DGH (source : team apport)
    const env = bilanDot.enveloppe || 0;
    const soldeEl = document.getElementById('eq-kpi-solde');
    if (soldeEl) {
      if (env <= 0) {
        soldeEl.textContent = '— h';
        soldeEl.className = 'eq-kpi-value';
        _set('eq-kpi-solde-sub', 'enveloppe non saisie');
      } else {
        const solde = _h(env - bilan.totalGeneral);
        soldeEl.textContent = (solde >= 0 ? '+' : '') + solde + ' h';
        soldeEl.className = 'eq-kpi-value ' + (solde < 0 ? 'is-over' : 'is-ok');
        _set('eq-kpi-solde-sub', solde < 0 ? 'dépassement enveloppe' : 'sous enveloppe (' + env + ' h)');
      }
    }
    _set('eq-kpi-tot-sub', 'HP ' + _h(bilan.totalHP) + ' + HSA ' + _h(bilan.totalHSA));
  }

  // ── RÉPARTITION PAR STATUT ──────────────────────────────────────────
  function _renderStatutStrip(bilan) {
    const strip = document.getElementById('eq-statut-strip');
    if (!strip) return;
    if (!bilan.parStatut.length) { strip.innerHTML = ''; return; }
    const order = ['titulaire','bmp','tzr','contractuel','temps-partiel'];
    const sorted = bilan.parStatut.slice().sort(
      (a,b) => (order.indexOf(a.statut) - order.indexOf(b.statut)));
    strip.innerHTML = sorted.map(s =>
      '<div class="eq-statut-chip">'
      + '<span class="eq-statut-chip-name">' + _esc(STATUT_LABELS[s.statut]||s.statut)
      + ' · ' + s.nb + '</span>'
      + '<span class="eq-statut-chip-detail">'
      + '<span class="eq-mini-hp">' + _h(s.hp) + ' HP</span> · '
      + '<span class="eq-mini-hsa">' + _h(s.hsa) + ' HSA</span></span>'
      + '</div>'
    ).join('');
  }

  // ── TABLEAU ─────────────────────────────────────────────────────────
  function _renderTable(bilan) {
    const wrap = document.getElementById('eq-table-wrap');
    if (!wrap) return;

    if (!bilan.rows.length) {
      wrap.innerHTML = '<div class="eq-empty"><p>Aucun enseignant dans l\u2019équipe.</p>'
        + '<p class="eq-empty-hint">Ajoutez vos titulaires, BMP, TZR et contractuels — '
        + 'les HP / HSA se calculent automatiquement.</p>'
        + '<p style="margin-top:14px"><button class="btn-primary" data-action="open-ens-modal">+ Ajouter un enseignant</button></p></div>';
      return;
    }

    let html = '<div class="eq-table-actions"><button class="btn-primary eq-btn-add" data-action="open-ens-modal">+ Ajouter un membre</button></div>'
      + '<table class="eq-table"><thead><tr>'
      + '<th>Nom</th>'
      + '<th>Statut</th>'
      + '<th class="eq-hide-sm">Discipline</th>'
      + '<th class="eq-num">Apport</th>'
      + '<th class="eq-num">Seuil HP</th>'
      + '<th class="eq-num">HP</th>'
      + '<th class="eq-num">HSA</th>'
      + '<th class="eq-hide-sm">Répartition</th>'
      + '<th></th>'
      + '</tr></thead><tbody>';

    bilan.rows.forEach(r => {
      const stCls = 'eq-badge-' + (r.statut || 'titulaire');
      const stLbl = STATUT_LABELS[r.statut] || r.statut || '—';

      // Seuil + source
      let seuilCell;
      if (r.ors > 0) {
        seuilCell = '<span class="eq-seuil">' + _h(r.ors) + ' h</span>'
          + '<span class="eq-seuil-src">' + (SRC_LABELS[r.plafondSource]||'') + '</span>';
        if (r.motifORS) {
          seuilCell += '<span class="eq-motif" title="' + _esc(r.motifORS) + '">⚑ '
            + _esc(r.motifORS.length > 22 ? r.motifORS.slice(0,22)+'…' : r.motifORS) + '</span>';
        }
      } else {
        seuilCell = '<span class="eq-seuil">— h</span><span class="eq-seuil-src">hors champ</span>';
      }

      // HSA cell + tooltip détail
      let hsaCell;
      if (r.hsaTotal > 0) {
        const lines = (r.detailHSA||[]).map(d => '• ' + d.nom + ' : ' + d.heures + 'h').join('\n');
        hsaCell = '<span class="eq-hsa-val" title="' + _esc(lines) + '">' + _h(r.hsaTotal) + ' h</span>';
      } else {
        hsaCell = '<span class="eq-hsa-zero">—</span>';
      }

      // Barre proportionnelle HP/HSA
      const tot = r.totalGeneral > 0 ? r.totalGeneral : 1;
      const pctHP  = Math.round((r.hpTotal  / tot) * 100);
      const pctHSA = 100 - pctHP;
      const bar = '<div class="eq-bar" title="HP ' + _h(r.hpTotal) + 'h · HSA ' + _h(r.hsaTotal) + 'h">'
        + '<div class="eq-bar-hp" style="width:' + pctHP + '%"></div>'
        + '<div class="eq-bar-hsa" style="width:' + pctHSA + '%"></div></div>';

      html += '<tr>'
        + '<td><span class="eq-name">' + _esc(r.nom) + '</span> '
          + '<span class="eq-firstname">' + _esc(r.prenom) + '</span></td>'
        + '<td><span class="eq-badge ' + stCls + '">' + _esc(stLbl) + '</span></td>'
        + '<td class="eq-hide-sm">' + _esc(r.disciplinePrincipale || '—') + '</td>'
        + '<td class="eq-num">' + _h(r.apportPoste) + ' h</td>'
        + '<td class="eq-num">' + seuilCell + '</td>'
        + '<td class="eq-num"><span class="eq-hp-val">' + _h(r.hpTotal) + ' h</span></td>'
        + '<td class="eq-num">' + hsaCell + '</td>'
        + '<td class="eq-hide-sm">' + bar + '</td>'
        + '<td class="eq-num eq-row-actions">'
          + '<button class="eq-action-btn" data-action="edit-ens" data-id="' + r.id + '" title="Modifier">✎</button>'
          + '<button class="eq-action-btn eq-action-del" data-action="delete-ens" data-id="' + r.id + '" title="Supprimer">✕</button>'
          + '</td>'
        + '</tr>';
    });

    html += '</tbody><tfoot><tr>'
      + '<td colspan="3">TOTAL ÉQUIPE — ' + bilan.nbEns + ' enseignant' + (bilan.nbEns > 1 ? 's' : '') + '</td>'
      + '<td class="eq-num">' + _h(bilan.totalGeneral) + ' h</td>'
      + '<td class="eq-num"></td>'
      + '<td class="eq-num"><span class="eq-hp-val">' + _h(bilan.totalHP) + ' h</span></td>'
      + '<td class="eq-num"><span class="eq-hsa-val">' + _h(bilan.totalHSA) + ' h</span></td>'
      + '<td class="eq-hide-sm" colspan="2"></td>'
      + '</tr></tfoot></table>';

    wrap.innerHTML = html;
  }

  // ── EXPORT CSV (TRM) ────────────────────────────────────────────────
  function exporterCSV() {
    const bilan = Calculs.bilanEquipe(DGHData.getEnseignants(), DGHData.getHeuresPedaComp());
    if (!bilan.rows.length) { app.toast('Aucun enseignant à exporter.', 'warning'); return; }
    const rows = [['Nom','Prénom','Statut','Grade','Discipline','Apport (h)','Seuil HP (h)','HP (h)','HSA (h)','Total (h)','Motif ORS']];
    bilan.rows.forEach(r => {
      rows.push([
        r.nom, r.prenom, STATUT_LABELS[r.statut]||r.statut, r.grade,
        r.disciplinePrincipale, _h(r.apportPoste), _h(r.ors),
        _h(r.hpTotal), _h(r.hsaTotal), _h(r.totalGeneral), r.motifORS||''
      ]);
    });
    rows.push([]);
    rows.push(['TOTAL', '', '', '', '', '', '', _h(bilan.totalHP), _h(bilan.totalHSA), _h(bilan.totalGeneral), '']);
    app.downloadCSV('equipe-hp-hsa-TRM.csv', rows);
    app.toast('Tableau équipe exporté.', 'success');
  }

  return { renderEquipe, exporterCSV };
})();
