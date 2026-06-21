/**
 * DGH App — Module Missions (PACTE / IMP) v3.9.0
 * Saisie et pilotage des missions PACTE et IMP par enseignant.
 *
 * Architecture :
 *  - IIFE, namespace DGHMissions
 *  - Zéro addEventListener direct — toutes les actions via data-action dans app.js
 *  - Données : DGHData.getMissions / addMission / updateMission / deleteMission
 *  - Les missions sont HORS DGH : elles n'impactent pas la barre de consommation HP/HSA
 */

const DGHMissions = (() => {

  let _editId     = null;   // null = création, string = édition
  let _confirmId  = null;   // id mission à supprimer
  let _sortKey    = 'type'; // 'type' | 'intitule' | 'enseignant' | 'heures'
  let _sortDir    = 1;      // 1 = asc, -1 = desc

  // ── Init / Render ─────────────────────────────────────────────────
  function init() {}

  function renderMissions() {
    const el = document.getElementById('view-missions');
    if (!el) return;

    const missions     = DGHData.getMissions();
    const enseignants  = DGHData.getEnseignants();
    const etab         = DGHData.getEtab();
    const envPacte     = etab.enveloppePacte || 0;
    const envImp       = etab.enveloppeImp   || 0;

    const totalPacte = missions.filter(m => m.type === 'pacte').reduce((s, m) => s + (m.heures || 0), 0);
    const totalImp   = missions.filter(m => m.type === 'imp')  .reduce((s, m) => s + (m.heures || 0), 0);

    el.innerHTML = `
<div class="view-header">
  <h1 class="view-title">PACTE / IMP</h1>
  <p class="view-subtitle">Missions hors&#8209;DGH · ${missions.length} mission${missions.length !== 1 ? 's' : ''}</p>
</div>

${_htmlKpis(totalPacte, envPacte, totalImp, envImp)}

<div class="section-card" style="margin-top:1.25rem">
  <div class="section-card-header">
    <div class="section-card-title">Missions saisies</div>
    <button class="btn-primary btn-sm" id="btnAddMission">+ Ajouter une mission</button>
  </div>
  ${_htmlFiltres()}
  ${missions.length === 0 ? _htmlEmpty() : _htmlTable(missions, enseignants)}
</div>`;
  }

  function _htmlKpis(totalPacte, envPacte, totalImp, envImp) {
    const kpi = (label, total, env, type) => {
      const pct    = env > 0 ? Math.min(100, Math.round((total / env) * 100)) : 0;
      const solde  = env > 0 ? env - total : null;
      const danger = env > 0 && total > env;
      return `
<div class="hist-kpi-card missions-kpi-${type}">
  <div class="hist-kpi-label">${label}</div>
  <div class="hist-kpi-values" style="justify-content:center">
    <span class="hist-kpi-n"><span class="font-mono">${total}h</span><small>consommées</small></span>
    ${env > 0 ? `<span class="hist-kpi-arrow">/</span>
    <span class="hist-kpi-n1"><span class="font-mono">${env}h</span><small>enveloppe</small></span>` : '<small style="font-size:.7rem;opacity:.6">(enveloppe non renseignée)</small>'}
  </div>
  ${env > 0 ? `
  <div class="progress-track" style="margin:.5rem 0">
    <div class="progress-fill ${type === 'pacte' ? 'missions-bar-pacte' : 'missions-bar-imp'}" style="width:${pct}%"></div>
  </div>
  <div class="hist-kpi-delta ${danger ? 'hist-delta-neg' : solde === 0 ? 'hist-delta-zero' : 'hist-delta-pos'}">
    Solde : ${danger ? '' : '+'}${solde !== null ? solde + 'h' : '\u2014'}
  </div>` : ''}
</div>`;
    };

    const totalGlobal = totalPacte + totalImp;
    return `
<div class="hist-kpi-grid missions-kpi-grid">
  ${kpi('PACTE', totalPacte, envPacte, 'pacte')}
  ${kpi('IMP', totalImp, envImp, 'imp')}
  <div class="hist-kpi-card">
    <div class="hist-kpi-label">Total missions</div>
    <div class="hist-kpi-values" style="justify-content:center">
      <span class="hist-kpi-n"><span class="font-mono">${totalGlobal}h</span><small>hors DGH</small></span>
    </div>
    <div class="hist-kpi-delta hist-delta-zero" style="font-size:.72rem">Ces heures n&apos;impactent pas l&apos;enveloppe DGH</div>
  </div>
</div>`;
  }

  function _htmlFiltres() {
    return `<div class="missions-filtres">
  <button class="btn-filter active" data-action="missions-filtre" data-filtre="tous">Toutes</button>
  <button class="btn-filter" data-action="missions-filtre" data-filtre="pacte"><span class="badge-pacte">PACTE</span></button>
  <button class="btn-filter" data-action="missions-filtre" data-filtre="imp"><span class="badge-imp">IMP</span></button>
</div>`;
  }

  function _htmlEmpty() {
    return `<div class="placeholder-view" style="padding:2rem">
  <div class="placeholder-icon">◑</div>
  <p><strong>Aucune mission</strong></p>
  <p style="margin-top:.5rem;opacity:.7">Cliquez sur « Ajouter une mission » pour enregistrer un PACTE ou une IMP.</p>
</div>`;
  }

  function _htmlTable(missions, enseignants) {
    const ensMap = {};
    enseignants.forEach(e => { ensMap[e.id] = e; });

    const arrow = k => _sortKey === k ? (_sortDir === 1 ? ' ▲' : ' ▼') : '';
    const thS   = 'missions-th-sort';

    const sorted = missions.slice().sort((a, b) => {
      let va, vb;
      switch (_sortKey) {
        case 'intitule':    va = (a.intitule||'').toLowerCase();  vb = (b.intitule||'').toLowerCase(); break;
        case 'enseignant': {
          const ea = ensMap[a.enseignantId]; const eb = ensMap[b.enseignantId];
          va = ea ? (ea.nom + ' ' + (ea.prenom||'')).toLowerCase() : 'zzz';
          vb = eb ? (eb.nom + ' ' + (eb.prenom||'')).toLowerCase() : 'zzz';
          break;
        }
        case 'heures':  va = a.heures||0; vb = b.heures||0; break;
        default:        va = a.type||''; vb = b.type||''; // 'type'
      }
      if (typeof va === 'string') return va.localeCompare(vb, 'fr') * _sortDir;
      return (va - vb) * _sortDir;
    });

    const rows = sorted.map(m => {
      const ens  = ensMap[m.enseignantId];
      const nom  = ens ? _esc(ens.nom + ' ' + (ens.prenom || '')) : '<span style="opacity:.5">Non affecté</span>';
      const hHebdo = m.heures > 0 ? (Math.round(m.heures / 36 * 10) / 10) + 'h/sem' : '\u2014';
      const badge  = m.type === 'pacte'
        ? '<span class="badge-pacte">PACTE</span>'
        : '<span class="badge-imp">IMP</span>';
      return `<tr data-mission-type="${m.type}">
  <td>${badge}</td>
  <td>${_esc(m.intitule)}</td>
  <td>${nom}</td>
  <td class="font-mono">${m.heures}h</td>
  <td class="font-mono" style="opacity:.7">${hHebdo}</td>
  <td class="td-actions">
    <button class="btn-icon" data-action="edit-mission" data-id="${m.id}" title="Modifier">✎</button>
    <button class="btn-icon btn-icon-danger" data-action="delete-mission" data-id="${m.id}" title="Supprimer">✕</button>
  </td>
</tr>`;
    }).join('');

    return `<table class="ens-table missions-table">
  <thead>
    <tr>
      <th class="${thS}" data-action="missions-sort" data-key="type" title="Trier par type">Type${arrow('type')}</th>
      <th class="${thS}" data-action="missions-sort" data-key="intitule" title="Trier par intitulé">Intitulé${arrow('intitule')}</th>
      <th class="${thS}" data-action="missions-sort" data-key="enseignant" title="Trier par enseignant">Enseignant${arrow('enseignant')}</th>
      <th class="${thS}" data-action="missions-sort" data-key="heures" title="Trier par heures">H/an${arrow('heures')}</th>
      <th>H/sem</th>
      <th></th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  // ── Filtre ────────────────────────────────────────────────────────
  function filtrer(filtre) {
    // Mettre à jour les boutons
    document.querySelectorAll('.btn-filter[data-filtre]').forEach(b => {
      b.classList.toggle('active', b.dataset.filtre === filtre);
    });
    // Masquer/afficher les lignes
    document.querySelectorAll('tr[data-mission-type]').forEach(tr => {
      const show = filtre === 'tous' || tr.dataset.missionType === filtre;
      tr.style.display = show ? '' : 'none';
    });
  }

  // ── Modal création/édition ────────────────────────────────────────
  function openModal(id) {
    _editId = id || null;
    const m    = id ? DGHData.getMission(id) : null;
    const etab = DGHData.getEtab();

    const overlay = document.getElementById('modalMission');
    if (!overlay) return;
    overlay.classList.remove('is-hidden');   // au cas où le HTML en conserve une trace
    overlay.classList.add('modal-open');

    const title = document.getElementById('modalMissionTitle');
    if (title) title.textContent = id ? 'Modifier la mission' : 'Nouvelle mission';

    // Type
    document.querySelectorAll('.mission-type-radio').forEach(r => {
      r.checked = (r.value === (m ? m.type : 'pacte'));
    });

    // Champs texte
    const fields = { inputMissionIntitule: m?.intitule || '', inputMissionComment: m?.commentaire || '' };
    Object.entries(fields).forEach(([fid, val]) => {
      const el = document.getElementById(fid); if (el) el.value = val;
    });

    // Heures
    const hEl = document.getElementById('inputMissionHeures');
    if (hEl) { hEl.value = m ? m.heures : ''; }
    _updateHHebdo();

    // Enseignants
    _populateEnsSelect(m?.enseignantId || null);

    // Disciplines
    _populateDiscSelect(m?.disciplineId || null);
  }

  function _populateEnsSelect(selectedId) {
    const sel = document.getElementById('inputMissionEns');
    if (!sel) return;
    const ens = DGHData.getEnseignants();
    sel.innerHTML = '<option value="">— Sélectionner un enseignant —</option>'
      + ens.map(e => `<option value="${e.id}"${e.id === selectedId ? ' selected' : ''}>${_esc(e.nom)} ${_esc(e.prenom || '')} (${e.disciplinePrincipale || '?'})</option>`).join('');
    _updateEnsInfo(selectedId);
  }

  function _populateDiscSelect(selectedId) {
    const sel = document.getElementById('inputMissionDisc');
    if (!sel) return;
    const discs = DGHData.getDisciplines();
    sel.innerHTML = '<option value="">— Aucune —</option>'
      + discs.map(d => `<option value="${d.id}"${d.id === selectedId ? ' selected' : ''}>${_esc(d.nom)}</option>`).join('');
  }

  function updateHHebdo() { _updateHHebdo(); }
  function _updateHHebdo() {
    const hEl   = document.getElementById('inputMissionHeures');
    const dest  = document.getElementById('missionHHebdo');
    if (!hEl || !dest) return;
    const h = parseFloat(hEl.value);
    dest.textContent = (!isNaN(h) && h > 0) ? Math.round(h / 36 * 10) / 10 + 'h/sem' : '\u2014';
  }

  function updateEnsInfo() {
    const sel = document.getElementById('inputMissionEns');
    _updateEnsInfo(sel ? sel.value : null);
  }
  function _updateEnsInfo(ensId) {
    const dest = document.getElementById('missionEnsInfo');
    if (!dest) return;
    if (!ensId) { dest.textContent = ''; return; }
    const ens  = DGHData.getEnseignant(ensId);
    const hpcs = DGHData.getHeuresPedaComp();
    if (!ens) { dest.textContent = ''; return; }
    const svc  = Calculs.serviceTotalEnseignant(ens, hpcs);
    dest.textContent = `Service actuel : ${svc.hpTotal}h HP + ${svc.hsaTotal}h HSA = ${svc.totalGeneral}h total (ORS ${svc.ors}h)`;
  }

  function closeModal() {
    const overlay = document.getElementById('modalMission');
    if (overlay) overlay.classList.remove('modal-open');
    _editId = null;
  }

  function saveMission() {
    const type      = document.querySelector('.mission-type-radio:checked')?.value || 'pacte';
    const intitule  = document.getElementById('inputMissionIntitule')?.value.trim() || '';
    const ensId     = document.getElementById('inputMissionEns')?.value || null;
    const heures    = parseFloat(document.getElementById('inputMissionHeures')?.value) || 0;
    const discId    = document.getElementById('inputMissionDisc')?.value || null;
    const comment   = document.getElementById('inputMissionComment')?.value.trim() || '';

    if (!intitule) { app.toast('L\u2019intitulé est obligatoire.', 'warning'); return; }
    if (!ensId)    { app.toast('Sélectionnez un enseignant.', 'warning'); return; }
    if (heures <= 0) { app.toast('Saisissez un nombre d\u2019heures valide.', 'warning'); return; }

    const fields = { type, intitule, enseignantId: ensId, heures, disciplineId: discId, commentaire: comment };
    if (_editId) {
      DGHData.updateMission(_editId, fields);
      app.toast('Mission mise à jour.', 'success');
    } else {
      DGHData.addMission(fields);
      app.toast('Mission ajoutée.', 'success');
    }
    closeModal();
    renderMissions();
  }

  // ── Suppression ───────────────────────────────────────────────────
  function confirmDelete(id) {
    _confirmId = id;
    const m   = DGHData.getMission(id);
    const msg = document.getElementById('confirmMissionMsg');
    if (msg && m) msg.textContent = `Supprimer la mission « ${m.intitule} » ?`;
    const overlay = document.getElementById('confirmMission');
    if (overlay) { overlay.classList.remove('is-hidden'); overlay.classList.add('modal-open'); }
  }

  function closeConfirmMission() {
    _confirmId = null;
    const overlay = document.getElementById('confirmMission');
    if (overlay) overlay.classList.remove('modal-open');
  }

  function execDeleteMission() {
    if (!_confirmId) return;
    DGHData.deleteMission(_confirmId);
    _confirmId = null;
    closeConfirmMission();
    app.toast('Mission supprimée.', 'info');
    renderMissions();
  }

  // ── Utilitaires ───────────────────────────────────────────────────
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setSort(key) {
    if (_sortKey === key) _sortDir = -_sortDir;
    else { _sortKey = key; _sortDir = 1; }
    renderMissions();
  }

  return {
    init, renderMissions,
    openModal, closeModal, saveMission,
    updateHHebdo, updateEnsInfo, filtrer,
    confirmDelete, closeConfirmMission, execDeleteMission,
    setSort
  };

})();
