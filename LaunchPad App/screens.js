/* Screens on top of the boards: the job panel, Companies, Interviews, the command palette and
   the keyboard shortcuts. Rules live in companies.js and interviews.js; this file only renders.
   Uses these globals from index.html: state, today, dataset, companyOpen, esc, pill, toast, save,
   render, setDataset, openEdit, addClicked, openDoc, cycleTheme, exportJSON, exportCSV, uid,
   quickActions, tierBadge, ymJob, ymChip, ymContacts, fitParts, fitCls, cleanNotes, docsSection,
   prepSection, hasPrep, ageStr, dueClass, ALL_STATUSES; and People from people.js. */
var Screens = (function () {
  const $ = id => document.getElementById(id);
  const IV_STATUSES = ['Applied'].concat(Interviews.ACTIVE, ['Offer', 'Accepted']);
  const STAGE_TONE = { Referred: 'green', Asked: 'blue', Connected: 'blue', Requested: 'amber', Queued: 'amber' };
  let jobId = null;
  let roundEdit = null;   // {jobId, roundId} while the interview form edits a round; null when it adds one

  function job(id) { return state.apps.find(a => a.id === id); }
  function contactMove(c) { return window.YourMove ? YourMove.forContact(c, state.apps, window.AUTOPILOT) : null; }
  function peopleAt(company) { return window.People ? PeopleCore.forCompany(People.list(), company) : []; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function fact(label, value, cls) {
    return value ? `<div><dt>${label}</dt><dd${cls ? ` class="${cls}"` : ''}>${esc(String(value))}</dd></div>` : '';
  }
  function whyBox(m, who) {
    return m ? `<p class="dwhy lv-${m.level}"><strong>${esc(m.verb)}.</strong> ${who ? esc(who) + ': ' : ''}${esc(m.why)}</p>` : '';
  }
  function personRow(c) {
    return `<button class="lrow" type="button" data-person="${esc(c.id)}"><span class="lt"><strong>${esc(c.name)}</strong>` +
      `<span>${esc([c.title, c.relation].filter(Boolean).join(' · '))}</span></span>${ymChip(contactMove(c))}` +
      `<span class="pill t-${STAGE_TONE[c.stage] || 'grey'}">${esc(c.stage)}</span></button>`;
  }
  function jobRow(a) {
    return `<button class="lrow" type="button" data-job="${esc(a.id)}"><span class="lt"><strong>${esc(a.role || 'Role not set')}</strong>` +
      `<span>${esc([a.location, a.fitScore ? 'Fit ' + a.fitScore : ''].filter(Boolean).join(' · '))}</span></span>${ymChip(ymJob(a))}${pill(a.status)}</button>`;
  }

  /* ---------- interview form: a side panel like the job and person forms ---------- */
  function roundFormHtml() {
    return `<div class="modal" id="ivmodal"><form class="sheet" id="ivsheet" autocomplete="off">
      <div class="dhead"><div class="dt"><h2 id="iv_title">Add interview</h2></div><button class="xbtn" type="button" data-ivclose aria-label="Close">×</button></div>
      <div class="grid" style="margin-top:14px">
        <div class="field full"><label for="iv_job">Job *</label><select id="iv_job" required></select></div>
        <div class="field"><label for="iv_round">Round</label><select id="iv_round"></select></div>
        <div class="field"><label for="iv_with">Who with</label><input id="iv_with"></div>
        <div class="field"><label for="iv_date">Date</label><input id="iv_date" type="date"></div>
        <div class="field"><label for="iv_time">Time</label><input id="iv_time" type="time"></div>
        <div class="field full"><label for="iv_notes">Notes</label><textarea id="iv_notes"></textarea></div>
      </div>
      <div class="foot"><button class="btn danger" type="button" id="iv_delete">Remove</button>
        <div style="display:flex;gap:8px"><button class="btn" type="button" data-ivclose>Cancel</button><button class="btn primary" type="submit" id="iv_submit">Add interview</button></div></div>
    </form></div>`;
  }
  // Jobs a round can be added to: open ones, those already at an interview stage first.
  function roundJobs() {
    const rank = a => Interviews.ACTIVE.includes(a.status) ? 0 : a.status === 'Applied' ? 1 : a.status === 'Offer' ? 2 : 3;
    return state.apps.filter(Companies.isOpen).sort((x, y) => rank(x) - rank(y) || (x.company || '').localeCompare(y.company || ''));
  }
  // forJob: preselect that job (from its panel or a "To schedule" line). roundId: edit that round.
  function openRound(forJob, roundId) {
    const a = forJob ? job(forJob) : null;
    const r = a && roundId ? Interviews.rounds(a).find(x => x.id === roundId) : null;
    roundEdit = r ? { jobId: a.id, roundId: r.id } : null;
    const jobs = roundJobs();
    if (a && !jobs.includes(a)) jobs.unshift(a);   // a closed job can still get its rounds corrected
    $('iv_job').innerHTML = '<option value="">Which job?</option>' + jobs.map(x =>
      `<option value="${esc(x.id)}">${esc(x.company)} · ${esc(x.role || 'Role not set')} (${esc(x.status)})</option>`).join('');
    $('iv_job').value = a ? a.id : '';
    $('iv_job').disabled = !!r;
    const names = !r || Interviews.ROUNDS.includes(r.round) ? Interviews.ROUNDS : Interviews.ROUNDS.concat([r.round]);
    $('iv_round').innerHTML = names.map(x => `<option>${esc(x)}</option>`).join('');
    $('iv_round').value = r ? r.round : (a && a.status === 'Take-home' ? 'Take-home' : Interviews.ROUNDS[0]);
    $('iv_date').value = r ? r.date || '' : '';
    $('iv_time').value = r ? r.time || '' : '';
    $('iv_with').value = r ? r.with || '' : '';
    $('iv_notes').value = r ? r.notes || '' : '';
    $('iv_title').textContent = r ? 'Edit interview' : 'Add interview';
    $('iv_submit').textContent = r ? 'Save' : 'Add interview';
    $('iv_delete').style.display = r ? '' : 'none';
    $('ivmodal').classList.add('show');
    $('ivsheet').scrollTop = 0;
    (a ? $('iv_date') : $('iv_job')).focus();
  }
  function closeRound() {
    roundEdit = null;
    $('ivmodal').classList.remove('show');
    if (document.activeElement) document.activeElement.blur();
  }
  function onRoundSubmit(e) {
    e.preventDefault();
    const editing = roundEdit, a = job(editing ? editing.jobId : $('iv_job').value);
    if (!a) { toast('⚠ Pick the job this interview is for.'); return; }
    const fields = { round: $('iv_round').value, date: $('iv_date').value, time: $('iv_time').value, with: $('iv_with').value, notes: $('iv_notes').value };
    const err = editing ? Interviews.update(a, editing.roundId, fields) : Interviews.add(a, fields, uid().replace('app-', 'iv-'));
    if (err) { toast('⚠ ' + err); return; }
    closeRound();
    save(); render();
    toast((editing ? 'Interview saved for ' : 'Interview added for ') + a.company + '.');
  }
  function removeRound(a, id) {
    if (!a || !confirm('Remove this interview round from ' + a.company + '?')) return;
    Interviews.remove(a, id);
    closeRound();
    save(); render();
  }
  function onRoundClick(e) {
    const t = e.target;
    if (t.id === 'ivmodal' || t.closest('[data-ivclose]')) closeRound();
    else if (t.id === 'iv_delete' && roundEdit) removeRound(job(roundEdit.jobId), roundEdit.roundId);
  }

  /* ---------- job panel ---------- */
  function roundsHtml(a) {
    const items = Interviews.rounds(a).map(r =>
      `<div class="ivitem" data-round="${esc(r.id)}"><span class="lt"><strong>${esc(r.round)}</strong> · ${esc(r.date || 'no date yet')}${r.time ? ' ' + esc(r.time) : ''}` +
      `<span>${esc([r.with, r.notes].filter(Boolean).join(' · '))}</span></span>` +
      `<select data-iv="outcome" aria-label="Outcome">${Interviews.OUTCOMES.map(o => `<option value="${esc(o)}"${o === (r.outcome || '') ? ' selected' : ''}>${o || 'Outcome…'}</option>`).join('')}</select>` +
      `<span class="minibtn" data-iv="edit">Edit</span><span class="minibtn" data-iv="remove">Remove</span></div>`).join('');
    return (items || '<p class="lempty">No rounds yet.</p>') + '<div class="rowbtns" style="margin-top:12px"><span class="minibtn" data-iv="add">Add round</span></div>';
  }

  function jobHtml(a) {
    const people = peopleAt(a.company);
    const link = a.url && a.url.startsWith('http') ? `<a class="btnlink" href="${esc(a.url)}" target="_blank" rel="noopener">Open posting ↗</a>` : '';
    const docs = docsSection(a) + prepSection(a);
    const notes = cleanNotes(a.notes);
    const showRounds = Interviews.rounds(a).length || IV_STATUSES.includes(a.status);
    return `<div class="dhead"><div class="dt"><h2>${esc(a.company)}</h2><p class="dsub">${esc(a.role)}</p></div>
        <button class="xbtn" type="button" data-close aria-label="Close">×</button></div>
      <div class="dchips">${pill(a.status)}${tierBadge(a).replace('tierb', 'tierb tierb-inline')}${a.fitScore ? `<span class="fitb ${fitCls(a.fitScore)}">Fit ${esc(String(a.fitScore))}</span>` : ''}</div>
      ${whyBox(ymJob(a))}
      <div class="dsec"><div class="rowbtns">${quickActions(a)}${link}<span class="minibtn" data-edit>Edit</span></div>
        <select class="pmove" data-movejob="${esc(a.id)}" aria-label="Move to another status"><option value="">Move to…</option>${ALL_STATUSES.filter(s => s !== a.status).map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></div>
      <div class="dsec"><h3>Details</h3><dl class="facts">${fact('Location', a.location)}${fact('Arrangement', a.arrangement)}${fact('Salary', a.salary)}${fact('Excitement', a.excitement ? a.excitement + ' of 5' : '')}
        ${fact('Added', a.dateAdded ? a.dateAdded + ' · ' + ageStr(a.dateAdded) : '')}${fact('Applied', a.dateApplied)}${fact('Next follow-up', a.nextFollowup, dueClass(a.nextFollowup))}${fact('Last contact', a.lastContact)}
        ${fact('Contact', a.contact)}${fact('Source', a.source)}${fact('Resume version', a.resumeVersion)}</dl>${fitParts(a)}</div>
      ${notes ? `<div class="dsec"><h3>Notes</h3><p class="dnotes">${esc(notes)}</p></div>` : ''}
      ${docs ? `<div class="dsec"><h3>Documents</h3>${docs}</div>` : ''}
      <div class="dsec"><h3>People at ${esc(a.company)}<span class="spacer"></span><span class="minibtn" data-co="${esc(a.company)}">Company page</span></h3>
        ${people.length ? people.map(personRow).join('') : '<p class="lempty">No one found here yet. The people search adds them once the job is in To Apply.</p>'}</div>
      ${showRounds ? `<div class="dsec"><h3>Interview rounds</h3>${roundsHtml(a)}</div>` : ''}`;
  }

  function markSelected() {
    document.querySelectorAll('.cardx').forEach(el => el.classList.toggle('sel', el.dataset.id === jobId));
  }
  function paintJob() {
    const a = job(jobId);
    if (!a) { closeJob(); return; }
    $('jsheet').innerHTML = jobHtml(a);
  }
  function openJob(id) {
    if (!job(id)) return;
    jobId = id;
    paintJob();
    $('jsheet').scrollTop = 0;
    $('jdrawer').classList.add('show');
    markSelected();
  }
  function closeJob() {
    jobId = null;
    $('jdrawer').classList.remove('show');
    markSelected();
  }

  // Typing in a panel must survive a re-render caused by a save or a background reload.
  function typingIn(root) {
    const el = document.activeElement;
    return !!el && root.contains(el) && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox'));
  }
  // Called at the end of every render(): keep open panels in step with the data.
  function refresh() {
    if (jobId && !typingIn($('jsheet'))) paintJob();
    markSelected();
    if (window.People && People.refreshDetail) People.refreshDetail();
  }

  function onJobClick(e) {
    const t = e.target;
    if (t.id === 'jdrawer' || t.closest('[data-close]')) { closeJob(); return; }
    if (t.closest('[data-edit]')) { openEdit(jobId); return; }
    const co = t.closest('[data-co]');
    if (co) { closeJob(); openCompany(co.dataset.co); return; }
    const p = t.closest('[data-person]');
    if (p && window.People) { People.open(p.dataset.person); return; }
    const iv = t.closest('[data-iv]'), act = iv && iv.dataset.iv, row = t.closest('[data-round]');
    if (act === 'add') openRound(jobId);
    else if (act === 'edit') openRound(jobId, row.dataset.round);
    else if (act === 'remove') removeRound(job(jobId), row.dataset.round);
  }
  function onJobChange(e) {
    const t = e.target, a = job(jobId);
    if (!a || !t.dataset || t.dataset.iv !== 'outcome') return;
    Interviews.setOutcome(a, t.closest('[data-round]').dataset.round, t.value);
    save(); render();
  }
  /* ---------- Companies ---------- */
  function allCompanies() {
    return Companies.list(state.apps, ymContacts(), { moveForJob: ymJob, moveForContact: contactMove });
  }
  function openCompany(name) {
    const h = '#companies/' + encodeURIComponent(name);
    if (location.hash === h) { render(); return; }
    location.hash = h;   // the hashchange handler in index.html switches the screen, and Back returns
  }
  function stepsBar(co) {
    return `<span class="steps">${Companies.REFERRAL.map((s, i) => `<i class="${i <= co.furthest ? (co.furthest === 5 ? 'done' : 'on') : ''}"></i>`).join('')}</span>`;
  }
  function rolesLine(co) {
    if (!co.jobs.length) return 'No roles tracked';
    if (!co.open.length) return plural(co.jobs.length, 'role') + ' · all closed';
    return plural(co.open.length, 'open role') + ' · ' + co.stage + (co.tier ? ' · Tier ' + co.tier : '') + (co.fit ? ' · fit ' + co.fit : '');
  }
  function peopleLine(co) {
    if (!co.people.length) return 'No people yet';
    const connected = co.referral.Connected + co.referral.Asked + co.referral.Referred;
    return plural(co.people.length, 'person', 'people') + (connected ? ' · ' + connected + ' connected' : '');
  }
  function companyPage(el, co) {
    const closed = co.jobs.filter(a => !Companies.isOpen(a));
    const stepper = Companies.REFERRAL.map(s => `<div class="${co.referral[s] ? (s === 'Referred' ? 'done' : 'on') : ''}"><b>${co.referral[s]}</b><span>${s}</span></div>`).join('');
    el.innerHTML = `<button class="back" type="button" data-back>← All companies</button>
      <div class="cohead"><h2>${esc(co.name)}</h2><p>${esc(rolesLine(co))} · ${esc(peopleLine(co))}</p></div>
      <div style="max-width:720px">${whyBox(co.next, co.next && co.next.who)}</div>
      <div class="dsec"><h3>Referral progress</h3><div class="stepper">${stepper}</div></div>
      <div class="cogrid">
        <div class="dsec"><h3>Roles</h3>${co.open.map(jobRow).join('') || '<p class="lempty">No open roles here.</p>'}
          ${closed.length ? `<h3 style="margin-top:16px">Closed</h3>${closed.map(jobRow).join('')}` : ''}</div>
        <div class="dsec"><h3>People<span class="spacer"></span><span class="minibtn" data-addperson>Add person</span><span class="minibtn" data-board>Open on the People board</span></h3>
          ${co.people.slice().sort((x, y) => (Number(y.likelihood) || 0) - (Number(x.likelihood) || 0)).map(personRow).join('') || '<p class="lempty">No one found here yet.</p>'}</div>
      </div>`;
  }
  function renderCompanies() {
    const el = $('companies'), all = allCompanies();
    if (companyOpen) {
      const co = all.find(c => c.key === companyOpen.trim().toLowerCase());
      if (co) { companyPage(el, co); return; }
      el.innerHTML = `<button class="back" type="button" data-back>← All companies</button><div class="emptybig"><h2>${esc(companyOpen)} is not on your list.</h2><p>It may have been archived, or renamed on its job.</p></div>`;
      return;
    }
    const q = ($('q').value || '').toLowerCase();
    const list = all.filter(c => !q || c.name.toLowerCase().includes(q));
    if (!all.length) { el.innerHTML = '<div class="emptybig"><h2>No companies yet.</h2><p>Add a job or a person and its company appears here.</p></div>'; return; }
    const needs = all.filter(c => c.needsYou).length, referred = all.filter(c => c.referral.Referred).length;
    el.innerHTML = `<p class="ymintro">${plural(all.length, 'company', 'companies')} · ${needs} need${needs === 1 ? 's' : ''} you · ${referred} with a referral. The ones waiting on you come first.</p>
      <div class="colist">${list.map(c => `<button class="corow" type="button" data-co="${esc(c.name)}">
        <span style="min-width:0"><span class="cn" style="display:block">${esc(c.name)}</span><span class="cs" style="display:block">${esc(rolesLine(c))}</span></span>
        <span class="cs ccol-people">${esc(peopleLine(c))}</span>
        <span class="ccol-steps">${stepsBar(c)}<span class="stepcap" style="display:block">${esc(c.furthestStage || 'No outreach yet')}</span></span>
        <span class="cnext">${c.next ? ymChip(c.next) : ''}</span></button>`).join('') || '<p class="lempty" style="padding:14px 0">No company matches that search.</p>'}</div>`;
  }
  function onCompaniesClick(e) {
    const t = e.target;
    if (t.closest('[data-back]')) { location.hash = '#companies'; return; }
    if (t.closest('[data-addperson]') && window.People) { People.openAdd(companyOpen); return; }
    if (t.closest('[data-board]') && window.People) { People.show(companyOpen); return; }
    const co = t.closest('[data-co]');
    if (co) { openCompany(co.dataset.co); return; }
    const j = t.closest('[data-job]');
    if (j) { openJob(j.dataset.job); return; }
    const p = t.closest('[data-person]');
    if (p && window.People) People.open(p.dataset.person);
  }

  /* ---------- Interviews ---------- */
  function dateBlock(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '<div class="ivdate"><b>–</b><span>no date</span></div>';
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return `<div class="ivdate"><b>${+m[3]}</b><span>${esc(d.toLocaleDateString(undefined, { month: 'short' }))} · ${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))}</span></div>`;
  }
  function roundRow(x) {
    const a = x.job, r = x.round;
    return `<div class="ivrow" data-job="${esc(a.id)}">${dateBlock(r.date)}<div class="ivmain"><strong>${esc(a.company)} · ${esc(r.round)}</strong>` +
      `<div>${esc([a.role, r.time, r.with ? 'with ' + r.with : ''].filter(Boolean).join(' · '))}</div>${r.notes ? `<div>${esc(r.notes)}</div>` : ''}</div>` +
      (r.outcome ? `<span class="pill t-${r.outcome === 'Passed' ? 'green' : r.outcome === 'Did not pass' ? 'red' : 'grey'}">${esc(r.outcome)}</span>` : '') +
      (hasPrep(a) ? `<span class="minibtn" data-prep="${esc(a.id)}">Prep</span>` : '') +
      `<span class="ivwhen">${esc(x.when)}</span></div>`;
  }
  // The header's "+ Add interview" (and `n`) opens the interview form.
  function addInterview() { openRound(null); }
  function renderInterviews() {
    const el = $('interviews'), r = Interviews.compute(state.apps, today);
    if (r.empty) {
      const applied = state.apps.filter(a => a.status === 'Applied').length, toApply = state.apps.filter(a => a.status === 'To Apply').length;
      el.innerHTML = `<div class="emptybig"><h2>No interviews yet.</h2>
        <p>A role shows up here when it reaches Phone Screen or later. Open the job to add each round with its date, and a prep document made for the role is linked next to it.</p>
        <p>Right now: ${plural(applied, 'applied role')} waiting for an answer, ${toApply} to apply.</p>
        <div class="rowbtns"><button class="btn primary" type="button" data-addiv>Add an interview</button><button class="btn" type="button" data-go="move">See what needs you today</button><button class="btn" type="button" data-go="jobs">Go to Jobs</button></div></div>`;
      return;
    }
    const sec = (title, body) => body ? `<section class="ymsec"><h3>${title}</h3>${body}</section>` : '';
    el.innerHTML = '<div class="ympage">' +
      sec('Coming up', r.upcoming.map(roundRow).join('')) +
      sec('To schedule', r.unscheduled.map(a => `<div class="ymline" data-job="${esc(a.id)}"><span class="ymtext"><strong>${esc(a.company)} · ${esc(a.role)}</strong>` +
        `<span class="ymsub">${esc(a.status)} with no round coming up. Add the date once you have it.</span></span>${hasPrep(a) ? `<span class="minibtn" data-prep="${esc(a.id)}">Prep</span>` : ''}<span class="minibtn" data-addiv="${esc(a.id)}">Add round</span></div>`).join('')) +
      sec('Past', r.past.map(roundRow).join('')) + '</div>';
  }
  function onInterviewsClick(e) {
    const t = e.target, go = t.closest('[data-go]'), prep = t.closest('[data-prep]'), j = t.closest('[data-job]');
    const add = t.closest('[data-addiv]');
    if (add) openRound(add.dataset.addiv || null);
    else if (go) setDataset(go.dataset.go);
    else if (prep) openDoc(prep.dataset.prep, 'prep');
    else if (j) openJob(j.dataset.job);
  }

  /* ---------- command palette ---------- */
  let palItems = [], palIdx = 0;
  function commands() {
    const go = (label, d) => ({ group: 'Go to', title: label, sub: '', run: () => setDataset(d) });
    return [go('Today', 'move'), go('Jobs', 'jobs'), go('People', 'people'), go('Companies', 'companies'), go('Interviews', 'interviews'), go('Insights', 'insights'),
      { group: 'Do', title: 'Add a job', sub: '', run: () => openEdit(null) },
      { group: 'Do', title: 'Add an interview', sub: '', run: () => { setDataset('interviews'); addInterview(); } },
      { group: 'Do', title: 'Add a person', sub: '', run: () => { if (window.People) { setDataset('people'); People.openAdd(); } } },
      { group: 'Do', title: 'Switch theme', sub: 'system, light, dark', run: cycleTheme },
      { group: 'Do', title: 'Export jobs as JSON', sub: '', run: exportJSON },
      { group: 'Do', title: 'Export jobs as CSV', sub: '', run: exportCSV }];
  }
  function palSearch(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = text => words.every(w => text.toLowerCase().includes(w));
    const cmds = commands().filter(c => hit(c.group + ' ' + c.title + ' ' + c.sub));
    if (!words.length) return cmds;
    const jobs = state.apps.filter(a => hit((a.company || '') + ' ' + (a.role || '') + ' ' + (a.status || ''))).slice(0, 7)
      .map(a => ({ group: 'Jobs', title: a.company, sub: [a.role, a.status].filter(Boolean).join(' · '), run: () => openJob(a.id) }));
    const people = ymContacts().filter(c => hit((c.name || '') + ' ' + (c.company || '') + ' ' + (c.title || ''))).slice(0, 7)
      .map(c => ({ group: 'People', title: c.name, sub: [c.company, c.stage].filter(Boolean).join(' · '), run: () => People.open(c.id) }));
    const cos = allCompanies().filter(c => hit(c.name)).slice(0, 5)
      .map(c => ({ group: 'Companies', title: c.name, sub: rolesLine(c), run: () => openCompany(c.name) }));
    return jobs.concat(people, cos, cmds);
  }
  function paintPalette() {
    palItems = palSearch($('palq').value);
    palIdx = Math.min(palIdx, Math.max(0, palItems.length - 1));
    let group = '';
    $('pallist').innerHTML = palItems.map((it, i) => {
      const head = it.group !== group ? `<div class="palgrp">${esc(it.group)}</div>` : '';
      group = it.group;
      return head + `<div class="palitem${i === palIdx ? ' on' : ''}" data-i="${i}"><strong>${esc(it.title)}</strong><span>${esc(it.sub)}</span></div>`;
    }).join('') || '<div class="palgrp">Nothing matches.</div>';
    const on = $('pallist').querySelector('.palitem.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    document.querySelectorAll('.menu.show').forEach(m => m.classList.remove('show'));
    $('pal').classList.add('show');
    $('palq').value = '';
    palIdx = 0;
    paintPalette();
    $('palq').focus();
  }
  function closePalette() { $('pal').classList.remove('show'); $('palq').blur(); }
  function runPalette(i) {
    const it = palItems[i];
    if (!it) return;
    closePalette();
    it.run();
  }
  function onPaletteKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (palItems.length) palIdx = (palIdx + (e.key === 'ArrowDown' ? 1 : palItems.length - 1)) % palItems.length;
      paintPalette();
    } else if (e.key === 'Enter') { e.preventDefault(); runPalette(palIdx); }
  }

  /* ---------- keyboard ---------- */
  function anyOpen(sel) { return !!document.querySelector(sel); }
  // Escape closes the top layer only. Returns true when it closed something here; the two forms
  // (#modal, #pmodal) close themselves.
  function escape() {
    if ($('pal').classList.contains('show')) { closePalette(); return true; }
    if (anyOpen('.menu.show, .colmenu.show')) { document.querySelectorAll('.menu.show, .colmenu.show').forEach(m => m.classList.remove('show')); return true; }
    if ($('ivmodal').classList.contains('show')) { closeRound(); return true; }
    if (anyOpen('#modal.show, #pmodal.show')) return false;
    if (window.People && People.detailOpen && People.detailOpen()) { People.closeDetail(); return true; }
    if (jobId) { closeJob(); return true; }
    return false;
  }
  const KEY_SCREEN = { 1: 'move', 2: 'jobs', 3: 'people', 4: 'companies', 5: 'interviews', 6: 'insights' };
  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if ($('pal').classList.contains('show')) closePalette(); else openPalette();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // A field in a panel that has just closed can still hold focus; only a visible one counts as typing.
    const el = e.target, typing = el && el.offsetParent !== null && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    if (typing || anyOpen('.modal.show, #pal.show')) return;
    if (e.key === '/') { if ($('controls').style.display !== 'none') { e.preventDefault(); $('q').focus(); } }
    else if (e.key === 'n') { e.preventDefault(); addClicked(); }
    else if (KEY_SCREEN[e.key]) setDataset(KEY_SCREEN[e.key]);
  }

  function init() {
    const drawer = $('jdrawer');
    drawer.addEventListener('click', onJobClick);
    drawer.addEventListener('change', onJobChange);
    $('companies').addEventListener('click', onCompaniesClick);
    $('interviews').addEventListener('click', onInterviewsClick);
    document.body.insertAdjacentHTML('beforeend', roundFormHtml());
    $('ivmodal').addEventListener('click', onRoundClick);
    $('ivsheet').addEventListener('submit', onRoundSubmit);
    $('pal').addEventListener('click', e => {
      const it = e.target.closest('.palitem');
      if (it) runPalette(+it.dataset.i); else if (e.target.id === 'pal') closePalette();
    });
    $('palq').addEventListener('input', () => { palIdx = 0; paintPalette(); });
    $('palq').addEventListener('keydown', onPaletteKey);
    document.addEventListener('keydown', onKey);
    if (/Mac|iPhone|iPad/.test(navigator.platform || '')) $('palkey').textContent = '⌘K';
  }

  init();
  return { openJob: openJob, closeJob: closeJob, jobId: function () { return jobId; }, refresh: refresh,
           renderCompanies: renderCompanies, renderInterviews: renderInterviews, addInterview: addInterview, openCompany: openCompany,
           openPalette: openPalette, escape: escape };
})();

render();
