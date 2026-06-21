/**
 * DGH App — Module Dashboard
 * Rendu du tableau de bord et du bouton établissement.
 *
 * v3.8.0 : Quand un scénario est actif, il devient la VÉRITÉ affichée.
 *   - Tous les KPI reflètent les valeurs simulées (pas de double lecture).
 *   - Un bandeau coloré bien visible rappelle le scénario actif + bouton désactiver.
 *   - Le bilan de base reste accessible dans les tooltips KPI.
 */

const DGHDashboard = (() => {

  // ── RENDU PRINCIPAL ───────────────────────────────────────────────
  function renderDashboard() {
    try {
      const data       = DGHData.getAnnee();
      const bilanBase  = Calculs.bilanDotation(data);
      const scenActif  = DGHData.getScenarioActif();
      const bilanScen  = scenActif ? Calculs.bilanScenario(data, scenActif.modificateurs) : null;

      // ── Bilan "effectif" : scénario actif s'il existe, sinon base ──
      // Quand un scénario est actif, l'application se comporte comme si
      // c'était la réalité. bilanEff est la source de vérité pour les KPI.
      const bilanEff   = bilanScen ? _bilanEffectif(bilanBase, bilanScen) : bilanBase;

      const alertes    = Calculs.genererAlertes(data);
      const resume     = Calculs.resumeStructures(DGHData.getStructures());

      _set('dashYear', DGHData.getAnneeActive().replace('-', '–'));

      // KPI Enveloppe DGH : toujours la valeur DSDEN (ne change pas avec le scénario)
      _set('kpi-dghtotal',  bilanBase.enveloppe ? bilanBase.enveloppe + ' h' : '— h');

      // KPI HP / HSA : valeurs effectives (simulées si scénario actif)
      _set('kpi-hposte',    bilanBase.hPosteEnv ? bilanBase.hPosteEnv + ' h' : '— h');
      _set('kpi-hsa-total', bilanBase.hsaEnv    ? bilanBase.hsaEnv + ' h'    : '— h');
      _set('kpi-hposte-sub', bilanBase.hPosteEnv ? 'enveloppe HP' : 'dotation structurelle');
      _set('kpi-hsa-sub',   bilanBase.hsaEnv     ? 'enveloppe HSA' : 'heures sup payées');
      _set('kpi-alertes',   alertes.filter(a => a.severite !== 'info').length || '—');
      _set('kpi-divisions', resume.nbDivisions || '—');
      _set('kpi-effectif',  resume.effectifTotal ? resume.effectifTotal + ' élèves' : '— élèves');

      // KPI Solde — affiche le solde effectif (simulé si scénario actif)
      const soldeEl  = document.getElementById('kpi-solde');
      const soldeSub = document.getElementById('kpi-solde-sub');
      const soldeEff = bilanEff.solde;
      if (soldeEl) {
        soldeEl.textContent = bilanBase.enveloppe ? soldeEff + ' h' : '— h';
        soldeEl.classList.toggle('kpi-solde-danger', !!bilanEff.depassement);
      }
      if (soldeSub) {
        if (scenActif) {
          soldeSub.textContent = 'avec scénario actif';
        } else {
          soldeSub.textContent = bilanBase.depassement ? 'dépassement !' : 'heures restantes';
        }
      }

      // Badge alertes sidebar
      const nb    = alertes.filter(a => a.severite === 'error' || a.severite === 'warning').length;
      const badge = document.getElementById('badge-alertes');
      if (badge) {
        badge.textContent = nb || '';
        badge.classList.toggle('badge-hidden', !nb);
      }

      // Stats topbar
      _renderTopbar();

      // ── Barre de progression — reflète la consommation effective ──
      const barHP   = document.getElementById('progressBarHP');
      const barHSA  = document.getElementById('progressBarHSA');
      const barScen = document.getElementById('progressBarScen');
      const lbl     = document.getElementById('progress-label');

      if (bilanBase.enveloppe > 0) {
        const totalHP  = bilanBase.totalHP;
        const totalHSA = bilanBase.totalHSA;
        const coutScen = bilanScen ? bilanScen.coutTotal : 0;

        const pctHP  = Math.min(100, Math.round((totalHP  / bilanBase.enveloppe) * 100));
        const pctHSA = Math.min(100 - pctHP, Math.round((totalHSA / bilanBase.enveloppe) * 100));
        if (barHP)  barHP.style.width  = pctHP  + '%';
        if (barHSA) { barHSA.style.width = pctHSA + '%'; barHSA.style.marginLeft = pctHP + '%'; }

        if (barScen) {
          if (coutScen > 0) {
            const pctScen = Math.min(
              Math.max(0, 100 - pctHP - pctHSA),
              Math.round((coutScen / bilanBase.enveloppe) * 100)
            );
            barScen.style.width      = pctScen + '%';
            barScen.style.marginLeft = (pctHP + pctHSA) + '%';
            barScen.classList.remove('is-hidden');
          } else {
            barScen.classList.add('is-hidden');
          }
        }

        if (lbl) {
          const totalEff = Math.round((totalHP + totalHSA + (bilanScen ? bilanScen.coutTotal : 0)) * 2) / 2;
          lbl.textContent = scenActif
            ? totalEff + ' / ' + bilanBase.enveloppe + ' h (dont +' + bilanScen.coutTotal + ' h scénario)'
            : totalHP + totalHSA + ' / ' + bilanBase.enveloppe + ' h';
        }
      } else if (barScen) {
        barScen.classList.add('is-hidden');
      }
      _set('prog-leg-hp',  bilanBase.totalHP  + ' h');
      _set('prog-leg-hsa', bilanBase.totalHSA + ' h');

      // ── Jauges HP / HSA — valeurs effectives (simulation intégrée si scénario) ──
      const hpHsaGrid = document.getElementById('dashHpHsaGrid');
      if (hpHsaGrid) {
        if (bilanBase.enveloppe > 0) {
          hpHsaGrid.classList.remove('is-hidden');
          _renderJauge('hp',  bilanBase.hPosteEnv, bilanBase.totalHP,  bilanScen ? bilanScen.coutHP  : 0, !!scenActif);
          _renderJauge('hsa', bilanBase.hsaEnv,    bilanBase.totalHSA, bilanScen ? bilanScen.coutHSA : 0, !!scenActif);
        } else {
          hpHsaGrid.classList.add('is-hidden');
        }
      }

      // ── Tooltips KPI — montrent toujours base + simulation ──
      const tooltipDGH = document.getElementById('kpi-tooltip-dghtotal');
      if (tooltipDGH && bilanBase.enveloppe > 0) {
        tooltipDGH.innerHTML = '<strong>Enveloppe DSDEN</strong><br>HP\u00a0: ' + bilanBase.hPosteEnv + '\u00a0h<br>HSA\u00a0: ' + bilanBase.hsaEnv + '\u00a0h<br>Total\u00a0: ' + bilanBase.enveloppe + '\u00a0h';
      }
      const tooltipHP = document.getElementById('kpi-tooltip-hposte');
      if (tooltipHP && bilanBase.hPosteEnv > 0) {
        tooltipHP.innerHTML = '<strong>H-Poste</strong><br>Enveloppe\u00a0: ' + bilanBase.hPosteEnv + '\u00a0h<br>Allouées (base)\u00a0: ' + bilanBase.totalHP + '\u00a0h'
          + (bilanScen ? '<br>+ Scénario\u00a0: +' + bilanScen.coutHP + '\u00a0h' : '')
          + '<br>Dont Dotation\u00a0: ' + (bilanBase.totalHPDisc||0) + '\u00a0h<br>Dont HPC\u00a0: ' + (bilanBase.totalHPHPC||0) + '\u00a0h';
      }
      const tooltipHSA = document.getElementById('kpi-tooltip-hsa');
      if (tooltipHSA && bilanBase.hsaEnv > 0) {
        tooltipHSA.innerHTML = '<strong>HSA</strong><br>Enveloppe\u00a0: ' + bilanBase.hsaEnv + '\u00a0h<br>Allouées (base)\u00a0: ' + bilanBase.totalHSA + '\u00a0h'
          + (bilanScen ? '<br>+ Scénario\u00a0: +' + bilanScen.coutHSA + '\u00a0h' : '')
          + '<br>Dont Dotation\u00a0: ' + (bilanBase.totalHSADisc||0) + '\u00a0h<br>Dont HPC\u00a0: ' + (bilanBase.totalHSAHPC||0) + '\u00a0h';
      }
      const tooltipSolde = document.getElementById('kpi-tooltip-solde');
      if (tooltipSolde && bilanBase.enveloppe > 0) {
        let tipHtml = '<strong>Solde de base</strong><br>Enveloppe\u00a0: ' + bilanBase.enveloppe + '\u00a0h<br>Consommées\u00a0: ' + bilanBase.totalAlloue + '\u00a0h<br>Solde\u00a0: ' + (bilanBase.solde >= 0 ? '+' : '') + bilanBase.solde + '\u00a0h (' + bilanBase.pctConsomme + '% consommé)';
        if (bilanScen) {
          tipHtml += '<br><br><strong>Avec scénario \u00ab ' + _esc(scenActif.nom) + ' \u00bb</strong><br>Coût\u00a0: +' + bilanScen.coutTotal + '\u00a0h<br>Solde simulé\u00a0: ' + (bilanScen.soldeSimule >= 0 ? '+' : '') + bilanScen.soldeSimule + '\u00a0h';
        }
        tooltipSolde.innerHTML = tipHtml;
      }

      // Empty state
      const isEmpty  = DGHData.isEmpty();
      const emptyEl  = document.getElementById('emptyState');
      const resumeEl = document.getElementById('disciplineResume');
      if (emptyEl)  emptyEl.classList.toggle('is-hidden', !isEmpty);
      if (resumeEl) resumeEl.classList.toggle('is-hidden', isEmpty);

      // Carte équipe — apport réel HP/HSA (source TRM)
      _renderEquipeCard(bilanBase);

      // Résumé disciplines (passé bilanEff pour que les ecarts reflètent le scénario)
      _renderDiscResume(bilanBase);

      // Résumé HPC
      _renderHPCResume();

      // ── Bandeau scénario actif (bien visible, en haut du dashboard) ──
      _renderBandeauScenario(scenActif, bilanBase, bilanScen);

      // ── Encart Vérification du moteur de calcul (discret si OK, alarmant si problème) ──
      _renderVerifs();

      // ── Encart Suggestions de pilotage — alertes BMP ──────────────────────────────────
      _renderAlertesBMP(data, scenActif ? scenActif.modificateurs : []);

    } catch(e) { console.error('[DGH] renderDashboard:', e); }
    updateBtnEtab();
  }

  /**
   * Construit un bilan "effectif" fusionnant base + scénario,
   * pour que les KPI affichent les valeurs simulées directement.
   */
  function _bilanEffectif(bilanBase, bilanScen) {
    return {
      enveloppe:   bilanBase.enveloppe,
      hPosteEnv:   bilanBase.hPosteEnv,
      hsaEnv:      bilanBase.hsaEnv,
      totalHP:     Math.round((bilanBase.totalHP  + bilanScen.coutHP)  * 2) / 2,
      totalHSA:    Math.round((bilanBase.totalHSA + bilanScen.coutHSA) * 2) / 2,
      totalAlloue: Math.round((bilanBase.totalAlloue + bilanScen.coutTotal) * 2) / 2,
      solde:       bilanScen.soldeSimule,
      depassement: bilanScen.depassement,
      pctConsomme: bilanBase.enveloppe > 0
        ? Math.round(((bilanBase.totalAlloue + bilanScen.coutTotal) / bilanBase.enveloppe) * 100)
        : 0
    };
  }

  /** Bandeau coloré bien visible en haut du dashboard quand un scénario est actif. */
  function _renderBandeauScenario(scenActif, bilanBase, bilanScen) {
    const el = document.getElementById('dashScenActif');
    if (!el) return;

    if (!scenActif) {
      el.classList.add('is-hidden');
      el.innerHTML = '';
      return;
    }

    const soldeSimule = bilanScen.soldeSimule;
    const delta       = Math.round((soldeSimule - bilanBase.solde) * 2) / 2;
    const sCls        = bilanScen.depassement ? 'scen-solde-danger' : 'scen-solde-ok';
    const ssign       = soldeSimule >= 0 ? '+' : '';
    const dsign       = delta >= 0 ? '+' : '';
    const coutParts   = [
      bilanScen.coutHP  > 0 ? '+' + bilanScen.coutHP  + '\u00a0h HP'  : '',
      bilanScen.coutHSA > 0 ? '+' + bilanScen.coutHSA + '\u00a0h HSA' : ''
    ].filter(Boolean);
    const coutTxt = coutParts.length ? coutParts.join(' / ') : '0\u00a0h';

    el.classList.remove('is-hidden');
    el.innerHTML =
      '<div class="dash-scen-actif-banner">'
        + '<div class="dash-scen-actif-left">'
          + '<span class="dash-scen-actif-icon">\u2295</span>'
          + '<div class="dash-scen-actif-info">'
            + '<span class="dash-scen-actif-label">Scénario actif</span>'
            + '<strong class="dash-scen-actif-nom">' + _esc(scenActif.nom) + '</strong>'
          + '</div>'
        + '</div>'
        + '<div class="dash-scen-actif-kpis">'
          + '<span class="dash-scen-actif-kpi"><span class="dash-scen-actif-kpi-lbl">Coût</span><span class="dash-scen-actif-kpi-val font-mono">' + coutTxt + '</span></span>'
          + '<span class="dash-scen-actif-kpi"><span class="dash-scen-actif-kpi-lbl">Solde simulé</span><span class="dash-scen-actif-kpi-val font-mono ' + sCls + '">' + ssign + soldeSimule + '\u00a0h</span></span>'
          + '<span class="dash-scen-actif-kpi"><span class="dash-scen-actif-kpi-lbl">Δ vs base</span><span class="dash-scen-actif-kpi-val font-mono ' + sCls + '">' + dsign + delta + '\u00a0h</span></span>'
        + '</div>'
        + '<div class="dash-scen-actif-actions">'
          + '<button class="btn-link dash-scen-actif-detail" data-navigate="pilotage">Voir détail \u2192</button>'
          + '<button class="btn-secondary btn-sm dash-scen-actif-off" id="btnDesactiverScen">Désactiver</button>'
        + '</div>'
      + '</div>';
  }

  /**
   * Encart « Vérification du moteur de calcul ».
   * Rejoue Verifs.lancer() à chaque rendu du dashboard.
   *  - Tout OK  → ligne verte sobre, repliée, non intrusive.
   *  - Échec(s) → bandeau rouge bien visible, déplié d'office sur les contrôles fautifs.
   */
  function _renderVerifs() {
    const el = document.getElementById('dashVerifs');
    if (!el) return;
    if (typeof Verifs === 'undefined') { el.classList.add('is-hidden'); el.innerHTML = ''; return; }

    let r;
    try { r = Verifs.lancer(); }
    catch (e) {
      console.error('[DGH] Verifs:', e);
      el.classList.remove('is-hidden');
      el.innerHTML = '<div class="dash-verifs dash-verifs-ko">'
        + '<span class="dash-verifs-icon">\u26a0</span>'
        + '<span class="dash-verifs-txt">Impossible de lancer la vérification du moteur de calcul.</span>'
        + '</div>';
      return;
    }

    el.classList.remove('is-hidden');

    if (r.ok) {
      // État sain : sobre, repliable. data-open piloté par délégation globale.
      el.innerHTML =
        '<div class="dash-verifs dash-verifs-ok" id="dashVerifsBox">'
          + '<button class="dash-verifs-head" data-action="toggle-verifs">'
            + '<span class="dash-verifs-icon">\u2713</span>'
            + '<span class="dash-verifs-txt">Moteur de calcul vérifié \u2014 '
              + r.total + ' contrôles OK</span>'
            + '<span class="dash-verifs-chevron">\u203a</span>'
          + '</button>'
          + '<div class="dash-verifs-detail is-hidden">' + _verifsDetailHTML(r) + '</div>'
        + '</div>';
    } else {
      // État problème : rouge, visible, détail ouvert d'emblée.
      el.innerHTML =
        '<div class="dash-verifs dash-verifs-ko" id="dashVerifsBox">'
          + '<button class="dash-verifs-head" data-action="toggle-verifs">'
            + '<span class="dash-verifs-icon">\u26a0</span>'
            + '<span class="dash-verifs-txt"><strong>'
              + r.echoues + ' contrôle' + (r.echoues > 1 ? 's' : '') + ' en échec</strong> '
              + 'sur le moteur de calcul \u2014 le résultat des heures peut être faux.</span>'
            + '<span class="dash-verifs-chevron">\u203a</span>'
          + '</button>'
          + '<div class="dash-verifs-detail">' + _verifsDetailHTML(r, true) + '</div>'
        + '</div>';
    }
  }

  // Détail des contrôles. echecsSeuls=true → n'affiche que les groupes en échec.
  function _verifsDetailHTML(r, echecsSeuls) {
    let html = '';
    r.groupes.forEach(g => {
      const koLignes = g.lignes.filter(l => !l.ok);
      if (echecsSeuls && koLignes.length === 0) return;
      html += '<div class="dash-verifs-groupe"><div class="dash-verifs-groupe-titre">'
            + _esc(g.titre) + '</div>';
      g.lignes.forEach(l => {
        if (echecsSeuls && l.ok) return;
        html += '<div class="dash-verifs-ligne ' + (l.ok ? 'is-ok' : 'is-ko') + '">'
              + '<span class="dash-verifs-ligne-icon">' + (l.ok ? '\u2713' : '\u2717') + '</span>'
              + '<span class="dash-verifs-ligne-lbl">' + _esc(l.label) + '</span>'
              + '<span class="dash-verifs-ligne-val font-mono">'
              + (l.ok ? _esc(String(l.obtenu))
                      : 'obtenu ' + _esc(String(l.obtenu)) + ', attendu ' + _esc(String(l.attendu)))
              + '</span>'
              + '</div>';
      });
      html += '</div>';
    });
    return html;
  }

  /**
   * Encart « Suggestions de pilotage » — alertes BMP.
   * Distinct de l'encart Vérification : c'est du conseil de gestion, pas une erreur.
   *  - Aucune alerte  → encart masqué (invisible, ne prend pas de place).
   *  - Alertes        → encart bleu discret, déplié, une ligne par discipline.
   */
  function _renderAlertesBMP(anneeData, modificateurs) {
    const el = document.getElementById('dashAlertesBMP');
    if (!el) return;

    let alertes;
    try { alertes = Calculs.alertesBMP(anneeData, modificateurs); }
    catch(e) { console.error('[DGH] alertesBMP:', e); el.classList.add('is-hidden'); return; }

    if (!alertes || alertes.length === 0) {
      el.classList.add('is-hidden');
      el.innerHTML = '';
      return;
    }

    el.classList.remove('is-hidden');

    const lignesHTML = alertes.map(a => {
      const pct = Math.round(a.fractionSupport * 100);
      return '<div class="dash-bmp-ligne">'
        + '<span class="dash-bmp-dot" style="background:' + _esc(a.couleur) + '"></span>'
        + '<span class="dash-bmp-disc">' + _esc(a.nom) + '</span>'
        + '<span class="dash-bmp-info">'
          + a.hsaEffective + ' h HSA effectives'
          + ' · ' + a.chaires + ' chaire' + (a.chaires > 1 ? 's' : '')
          + ' · capacité imposable ' + a.capaciteImposable + ' h'
        + '</span>'
        + '<span class="dash-bmp-suggestion">'
          + '→ BMP de ' + a.volumeBMP + ' h suggéré'
          + ' <span class="dash-bmp-fraction">(' + pct + '\u00a0% d\u2019un support)</span>'
        + '</span>'
      + '</div>';
    }).join('');

    el.innerHTML =
      '<div class="dash-bmp-encart" id="dashBMPBox">'
        + '<button class="dash-bmp-head" data-action="toggle-bmp">'
          + '<span class="dash-bmp-icon">💡</span>'
          + '<span class="dash-bmp-txt"><strong>'
            + alertes.length + ' discipline' + (alertes.length > 1 ? 's' : '')
            + ' avec HSA dépassant la capacité imposable</strong>'
            + ' — un BMP serait envisageable'
          + '</span>'
          + '<span class="dash-bmp-chevron">\u203a</span>'
        + '</button>'
        + '<div class="dash-bmp-detail">' + lignesHTML + '</div>'
      + '</div>';
  }

  // Barre supérieure — rendue sur chaque navigation, visible partout.
  // Quand un scénario est actif, affiche le solde SIMULÉ.
  function _renderTopbar() {
    const stats = document.getElementById('topbarStats');
    if (!stats) return;
    const data  = DGHData.getAnnee();
    const bilan = Calculs.bilanDotation(data);
    if (!(bilan.enveloppe > 0)) { stats.innerHTML = ''; return; }
    const scen  = DGHData.getScenarioActif();
    const bScen = scen ? Calculs.bilanScenario(data, scen.modificateurs) : null;

    let html = '<div class="topbar-stat"><span>HP</span><span class="topbar-stat-val">' + bilan.hPosteEnv + 'h</span></div>'
             + '<div class="topbar-stat"><span>HSA</span><span class="topbar-stat-val">' + bilan.hsaEnv + 'h</span></div>';
    if (bScen) {
      const sCls = bScen.depassement ? 'topbar-solde-neg' : 'topbar-solde-ok';
      html += '<div class="topbar-stat topbar-stat-scen" title="Solde simul\u00e9 \u2014 sc\u00e9nario \u00ab ' + _esc(scen.nom) + ' \u00bb actif">'
            + '<span>\u2295 ' + _esc(scen.nom) + '</span>'
            + '<span class="topbar-stat-val ' + sCls + '">' + (bScen.soldeSimule >= 0 ? '+' : '') + bScen.soldeSimule + 'h</span></div>';
    } else {
      html += '<div class="topbar-stat"><span>Solde</span><span class="topbar-stat-val">' + bilan.solde + 'h</span></div>';
    }
    stats.innerHTML = html;
  }

  function _renderDiscResume(bilan) {
    const discListEl = document.getElementById('disciplineList');
    if (!discListEl || DGHData.isEmpty()) return;
    const disciplines = DGHData.getDisciplines();
    const repartition = DGHData.getRepartition();
    const structures  = DGHData.getStructures();
    const grilles     = DGHData.getGrilles();
    const besoins     = Calculs.besoinsParDiscipline(structures, disciplines, repartition, grilles);
    if (disciplines.length === 0) {
      discListEl.innerHTML = '<p style="color:var(--c-text-muted);font-size:.83rem;padding:.5rem 0">Aucune discipline \u2014 initialisez les <button class="btn-link" data-navigate="dotation">disciplines MEN dans Dotation</button>.</p>';
      return;
    }
    const nbDivParNiv = {};
    structures.forEach(s => { nbDivParNiv[s.niveau] = (nbDivParNiv[s.niveau]||0) + 1; });
    const niveauxDispo = ['6e','5e','4e','3e'].filter(niv => nbDivParNiv[niv]);
    let html = '<div class="disc-resume-grid">';
    besoins.forEach(b => {
      const pct      = bilan.enveloppe > 0 ? Math.min(100, Math.round((b.total / bilan.enveloppe) * 100)) : 0;
      const ecartCls = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
      let tipHtml = '<strong>' + _esc(b.nom) + '</strong>';
      niveauxDispo.forEach(niv => {
        const gl = b.grilleLignes && b.grilleLignes[niv];
        const hParDiv = gl ? gl.valeur : null;
        const nb = nbDivParNiv[niv] || 0;
        if (hParDiv !== null && hParDiv !== undefined && hParDiv !== '') {
          const hTot = Math.round(parseFloat(hParDiv) * nb * 2) / 2;
          const modifie = gl && gl.modifie ? ' \u270e' : '';
          tipHtml += '<div class="disc-tip-row"><span class="disc-tip-niv">' + niv + '</span><span class="disc-tip-val">' + hTot + '\u00a0h</span><small>(' + hParDiv + 'h \u00d7 ' + nb + ' div' + modifie + ')</small></div>';
        } else {
          tipHtml += '<div class="disc-tip-row disc-tip-absent"><span class="disc-tip-niv">' + niv + '</span><span>\u2014</span><small>non pr\u00e9vu</small></div>';
        }
      });
      tipHtml += '<hr class="disc-tip-sep">';
      tipHtml += '<div class="disc-tip-row"><span class="disc-tip-hp">HP</span><span>' + b.hPoste + '\u00a0h</span></div>';
      tipHtml += '<div class="disc-tip-row"><span class="disc-tip-hsa">HSA</span><span>' + b.hsa + '\u00a0h</span></div>';
      if (b.besoinTheorique > 0) {
        const ecartCss = b.ecart > 0 ? 'dot-ecart-over' : b.ecart < 0 ? 'dot-ecart-under' : 'dot-ecart-ok';
        tipHtml += '<div class="disc-tip-row">Besoin<span>' + b.besoinTheorique + '\u00a0h</span></div>';
        tipHtml += '<div class="disc-tip-row"><span class="dot-ecart ' + ecartCss + '">' + (b.ecart >= 0 ? '+' : '') + b.ecart + '\u00a0h</span><small>\u00e9cart</small></div>';
      }
      html += '<div class="disc-resume-row disc-tip-wrap">'
        + '<span class="disc-color-dot" style="background:' + _esc(b.couleur) + '"></span>'
        + '<span class="disc-resume-nom">' + _esc(b.nom) + '</span>'
        + '<span class="disc-resume-h">' + b.total + ' h</span>'
        + (b.besoinTheorique > 0 ? '<span class="dot-ecart ' + ecartCls + '" style="font-size:.68rem">' + (b.ecart >= 0 ? '+' : '') + b.ecart + '</span>' : '<span></span>')
        + '<div class="dot-bar-track" style="flex:1;min-width:40px"><div class="dot-bar-fill" style="width:' + pct + '%;background:' + _esc(b.couleur) + '"></div></div>'
        + '<div class="disc-tip">' + tipHtml + '</div>'
        + '</div>';
    });
    html += '</div>';
    discListEl.innerHTML = html;
  }

  function _renderHPCResume() {
    const hpcListEl = document.getElementById('dashHPCList');
    if (!hpcListEl) return;
    const hpcs        = DGHData.getHeuresPedaComp();
    const disciplines = DGHData.getDisciplines();
    if (hpcs.length === 0) {
      hpcListEl.innerHTML = '<p class="dash-hpc-empty">Aucune heure complémentaire saisie.<br><button class="btn-link" data-navigate="hpc">Ajouter des heures complémentaires \u2192</button></p>';
      return;
    }
    const LABELS = {}; DGHData.getCategoriesHPC().forEach(c => { LABELS[c.value] = c.label; });
    const discMap = {}; disciplines.forEach(d => { discMap[d.id] = d; });
    let hpcHtml = '<div class="disc-resume-grid">';
    hpcs.forEach(h => {
      const isHSA    = (h.typeHeure||'hp') === 'hsa';
      const catLabel = (LABELS[h.categorie]||h.categorie||'autre').split('(')[0].trim();
      const discNom  = h.disciplineId && discMap[h.disciplineId] ? discMap[h.disciplineId].nom : null;
      hpcHtml += '<div class="disc-resume-row">'
        + '<span class="disc-color-dot" style="background:' + (isHSA ? 'var(--c-indigo)' : 'var(--c-accent)') + '"></span>'
        + '<span class="disc-resume-nom">' + _esc(h.nom||'—') + (discNom ? '<small style="color:var(--c-text-dim);margin-left:.3em">(' + _esc(discNom) + ')</small>' : '') + '</span>'
        + '<span class="disc-resume-h">' + (h.heures||0) + ' h</span>'
        + '<span class="grp-type-badge" style="font-size:.65rem;padding:1px 5px">' + _esc(catLabel) + '</span>'
        + '</div>';
    });
    const bilanHPC = Calculs.bilanHPC(hpcs, disciplines);
    hpcHtml += '<div class="disc-resume-row" style="border-top:1px solid var(--c-border);margin-top:.25rem;padding-top:.35rem">'
      + '<span></span>'
      + '<span class="disc-resume-nom" style="color:var(--c-text-muted);font-size:.78rem">Total (' + hpcs.length + ' entr\u00e9e' + (hpcs.length>1?'s':'') + ')</span>'
      + '<span class="disc-resume-h" style="font-weight:700">' + bilanHPC.totalHeures + ' h</span>'
      + '<span></span>'
      + '</div>';
    hpcHtml += '</div>';
    hpcListEl.innerHTML = hpcHtml;
  }

  // ── Jauge HP / HSA ──────────────────────────────────────────────
  function _renderJauge(pfx, dotation, conso, coutScen, scenActif) {
    const marge    = Math.round((dotation - conso) * 2) / 2;
    const pct      = dotation > 0 ? (conso / dotation) * 100 : 0;
    const pctClamp = Math.max(0, Math.min(100, Math.round(pct)));

    // Si scénario actif, on affiche la marge SIMULÉE directement
    const consoEff = scenActif ? Math.round((conso + coutScen) * 2) / 2 : conso;
    const margeEff = Math.round((dotation - consoEff) * 2) / 2;
    const etat     = margeEff < 0 ? 'over' : margeEff === 0 ? 'tight' : 'ok';

    _set('dash-' + pfx + '-dotation', dotation + ' h');
    _set('dash-' + pfx + '-conso',    consoEff + ' h');
    const margeEl = document.getElementById('dash-' + pfx + '-marge');
    if (margeEl) {
      margeEl.textContent = (margeEff >= 0 ? '+' : '') + margeEff + ' h';
      margeEl.classList.toggle('gauge-marge-over',  etat === 'over');
      margeEl.classList.toggle('gauge-marge-tight', etat === 'tight');
      margeEl.classList.toggle('gauge-marge-ok',    etat === 'ok');
    }

    const pctEff = dotation > 0 ? Math.max(0, Math.min(100, Math.round((consoEff / dotation) * 100))) : 0;
    _set('dash-' + pfx + '-pct', pctEff + '%');

    const fill = document.getElementById('dash-gauge-' + pfx);
    if (fill) {
      fill.style.width = pctEff + '%';
      fill.classList.toggle('gauge-fill-over',  etat === 'over');
      fill.classList.toggle('gauge-fill-tight', etat === 'tight');
    }

    // Marqueur de simulation : si scénario actif, montrer l'écart vs base
    const simMark = document.getElementById('dash-gauge-' + pfx + '-sim');
    const simLine = document.getElementById('dash-' + pfx + '-sim');
    if (scenActif && coutScen > 0) {
      const pctBase = Math.max(0, Math.min(100, Math.round((conso / dotation) * 100)));
      if (simMark) { simMark.style.left = pctBase + '%'; simMark.classList.remove('is-hidden'); }
      if (simLine) {
        simLine.classList.remove('is-hidden');
        simLine.innerHTML = 'Base : <strong class="font-mono">' + conso + ' h</strong> · +Scénario : <strong class="font-mono">' + coutScen + ' h</strong>';
      }
    } else {
      if (simMark) simMark.classList.add('is-hidden');
      if (simLine) simLine.classList.add('is-hidden');
    }
  }

  // ── BOUTON ÉTABLISSEMENT ──────────────────────────────────────────
  function updateBtnEtab() {
    const btn = document.getElementById('btnEtab'); if (!btn) return;
    try {
      const etab = DGHData.getEtab()||{};
      btn.textContent = (etab.nom && etab.nom.trim()) ? etab.nom.trim() + ' \u2699' : 'Mon Coll\u00e8ge \u2699';
    } catch(e) { btn.textContent = 'Mon Coll\u00e8ge \u2699'; }
  }

  // ── UTILITAIRES LOCAUX ─────────────────────────────────────────────
  function _renderEquipeCard(bilanBase) {
    const card = document.getElementById('dashEquipeCard');
    if (!card) return;
    const bilan = Calculs.bilanEquipe(DGHData.getEnseignants(), DGHData.getHeuresPedaComp());
    if (!bilan.nbEns) { card.classList.add('is-hidden'); return; }
    card.classList.remove('is-hidden');
    const r = n => Math.round((n||0)*2)/2;
    _set('dash-eq-hp',  r(bilan.totalHP)  + ' h');
    _set('dash-eq-hsa', r(bilan.totalHSA) + ' h');
    _set('dash-eq-tot', r(bilan.totalGeneral) + ' h');

    const env = bilanBase.enveloppe || 0;
    const soldeEl = document.getElementById('dash-eq-solde');
    if (soldeEl) {
      if (env <= 0) { soldeEl.textContent = '— h'; soldeEl.className = 'dash-equipe-val'; }
      else {
        const solde = r(env - bilan.totalGeneral);
        soldeEl.textContent = (solde >= 0 ? '+' : '') + solde + ' h';
        soldeEl.className = 'dash-equipe-val' + (solde < 0 ? ' is-over' : '');
      }
    }
    const tot = bilan.totalGeneral > 0 ? bilan.totalGeneral : 1;
    const pctHP = Math.round((bilan.totalHP / tot) * 100);
    const barHP = document.getElementById('dash-eq-bar-hp');
    const barHSA = document.getElementById('dash-eq-bar-hsa');
    if (barHP)  barHP.style.width  = pctHP + '%';
    if (barHSA) barHSA.style.width = (100 - pctHP) + '%';
  }

  function _set(id, val)  { const el=document.getElementById(id); if(el) el.textContent=val; }
  function _esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return { renderDashboard, updateBtnEtab, renderTopbar: _renderTopbar };

})();
