/* People tab rules with no DOM access, kept apart from people.js so they
   can be tested on their own. Loaded before people.js as a classic script. */
var PeopleCore = (function () {
  var STAGES = ['Found', 'Queued', 'Requested', 'Connected', 'Asked', 'Referred'];
  var CLOSED = ['Declined', 'No response', 'Skipped'];
  var ORDER = STAGES.concat(CLOSED);
  var DATE_FIELD = { Queued: 'dateQueued', Requested: 'dateRequested', Connected: 'dateConnected', Asked: 'dateAsked' };
  var DEFAULT_CONFIG = {
    // null = no limit for the three caps below (set a number in outreach-config.json to cap one).
    maxRequestsPerDay: null, maxRequestsPerWeek: null, noteSelection: 'manual',
    noteBudgetPerMonth: null, noteCharLimit: 200, maxProfileViewsPerRun: 40,
    contactsPerCompany: 5, minSendGapSeconds: 20, maxSendGapSeconds: 60,
    followupAfterDays: 6, staleInviteDays: 21, defaultAttachment: 'tailored',
    baseResumePath: ''
  };

  function withDefaults(cfg) {
    var out = {}, k;
    for (k in DEFAULT_CONFIG) out[k] = DEFAULT_CONFIG[k];
    for (k in (cfg || {})) out[k] = cfg[k];
    return out;
  }

  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Remaining under a cap, or null when that cap is off (null/absent).
  function left(limit, used) {
    return limit == null ? null : Math.max(0, limit - used);
  }

  function quota(contacts, cfg, today) {
    cfg = withDefaults(cfg);
    var weekStart = addDays(today, -6), month = today.slice(0, 7);
    var q = { requestsToday: 0, requestsWeek: 0, notesSent: 0, notesSelected: 0 };
    contacts.forEach(function (c) {
      var sent = c.dateRequested || '';
      if (sent === today) q.requestsToday++;
      if (sent && sent >= weekStart && sent <= today) q.requestsWeek++;
      if (c.useNote && c.connectNote && sent.slice(0, 7) === month) q.notesSent++;
      // Only Found/Queued contacts still consume the note budget by being
      // selected; a Skipped or other closed-stage card with useNote left on
      // (the toggle is hidden there) must not tie up the budget forever.
      if (c.useNote && (c.stage === 'Found' || c.stage === 'Queued')) q.notesSelected++;
    });
    var day = left(cfg.maxRequestsPerDay, q.requestsToday);
    q.remainingWeek = left(cfg.maxRequestsPerWeek, q.requestsWeek);
    q.remainingToday = day == null ? q.remainingWeek
      : q.remainingWeek == null ? day : Math.min(day, q.remainingWeek);
    q.remainingNotes = left(cfg.noteBudgetPerMonth, q.notesSent + q.notesSelected);
    return q;
  }

  function level(used, limit) {
    if (limit == null) return 'ok';
    if (limit <= 0 || used >= limit) return 'full';
    return used / limit >= 0.8 ? 'warn' : 'ok';
  }

  // Stat cards for the People view, in the same shape as the Jobs page KPIs:
  // [{label, value, level}]. Only what needs a decision or tells you how it's
  // going; per-stage counts are already on the board's column headers.
  // Requests this week is always shown (LinkedIn caps weekly invites itself);
  // requests today and notes this month appear only when you set a limit for
  // them, and then read "used/limit" with a level.
  function stats(contacts, cfg, today) {
    cfg = withDefaults(cfg);
    var q = quota(contacts, cfg, today);
    var n = function (stage) { return contacts.filter(function (c) { return c.stage === stage; }).length; };
    var due = contacts.filter(function (c) {
      return c.nextFollowup && c.nextFollowup <= today && CLOSED.indexOf(c.stage) < 0 && c.stage !== 'Referred';
    }).length;
    var usage = function (label, used, limit) {
      return limit == null ? { label: label, value: String(used), level: '' }
                           : { label: label, value: used + '/' + limit, level: level(used, limit) };
    };
    var out = [
      { label: 'People', value: String(contacts.length), level: '' },
      { label: 'To connect', value: String(n('Found') + n('Queued')), level: '' },
      { label: 'Ready to ask', value: String(n('Connected')), level: '' },
      { label: 'Follow-ups due', value: String(due), level: '' },
      { label: 'Referred', value: String(n('Referred')), level: '' }
    ];
    if (cfg.maxRequestsPerDay != null) out.push(usage('Requests today', q.requestsToday, cfg.maxRequestsPerDay));
    out.push(usage('Requests this week', q.requestsWeek, cfg.maxRequestsPerWeek));
    if (cfg.noteSelection !== 'off' && cfg.noteBudgetPerMonth != null) {
      out.push(usage('Notes this month', q.notesSent + q.notesSelected, cfg.noteBudgetPerMonth));
    }
    return out;
  }

  function canToggleNote(contact, contacts, cfg, today) {
    cfg = withDefaults(cfg);
    if (cfg.noteSelection === 'off' || contact.dateRequested) return false;
    if (contact.useNote) return true;
    var rem = quota(contacts, cfg, today).remainingNotes;
    return rem == null || rem > 0;
  }

  function moveStage(contact, stage, today) {
    if (ORDER.indexOf(stage) < 0) throw new Error('unknown stage ' + stage);
    if (stage !== contact.stage) contact.askApproved = false;
    contact.stage = stage;
    var field = DATE_FIELD[stage];
    if (field && !contact[field]) contact[field] = today;
    return contact;
  }

  function approve(contact, today) {
    return contact.stage === 'Found' ? moveStage(contact, 'Queued', today) : contact;
  }

  function setAttachmentSource(contact, source, cfg) {
    cfg = withDefaults(cfg);
    contact.attachmentSource = source;
    contact.attachment = source === 'base' ? cfg.baseResumePath : '';
    contact.askApproved = false;
    return contact;
  }

  function canApproveAsk(contact) {
    return contact.stage === 'Connected' && !!(contact.askMessage || '').trim() && !!contact.attachment;
  }

  // The reply waiting to be sent to someone who answered. Older drafts sit at the end of the
  // notes after "[reply draft]"; the first edit moves them into replyMessage.
  // Must match replyDraft in your-move.js.
  var REPLY_MARK = '[reply draft]';
  function replyDraft(contact) {
    if ((contact.replyMessage || '').trim()) return contact.replyMessage;
    var notes = contact.notes || '', i = notes.indexOf(REPLY_MARK);
    return i < 0 ? '' : notes.slice(i + REPLY_MARK.length).trim();
  }

  function setReplyDraft(contact, text) {
    var notes = contact.notes || '', i = notes.indexOf(REPLY_MARK);
    if (i >= 0) contact.notes = notes.slice(0, i).trim();
    contact.replyMessage = text;
    contact.replyApproved = false;
  }

  // The notes without a draft that still sits in them, so the draft is shown once.
  function notesText(contact) {
    var notes = contact.notes || '', i = notes.indexOf(REPLY_MARK);
    return i < 0 ? notes : notes.slice(0, i).trim();
  }

  function furthest(contacts) {
    var best = -1;
    contacts.forEach(function (c) { best = Math.max(best, STAGES.indexOf(c.stage)); });
    if (best >= 0) return STAGES[best];
    return contacts.length ? 'Closed' : '';
  }

  function forCompany(contacts, company) {
    var key = (company || '').trim().toLowerCase();
    return contacts.filter(function (c) { return (c.company || '').trim().toLowerCase() === key; });
  }

  function column(stage) {
    return CLOSED.indexOf(stage) >= 0 ? 'Closed' : stage;
  }

  // Same starting scores people-finder uses, so manual adds sort alongside found ones.
  var RELATION_SCORE = { 'ex-colleague': 75, 'alumni': 60, 'same-org engineer': 50,
                         'hiring manager': 45, 'recruiter': 40 };
  var RELATIONS = Object.keys(RELATION_SCORE);

  // Must match normalize_linkedin_url in server.py (the dedupe key).
  function normalizeUrl(url) {
    url = (url || '').trim();
    if (!url) return '';
    if (url.indexOf('://') < 0) url = 'https://' + url;
    var m = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^\/?#]*)([^?#]*)/i);
    return m ? ('https://' + m[1].replace(/^www\./i, '') + m[2].replace(/\/+$/, '')).toLowerCase() : url.toLowerCase();
  }

  // Lower-cased address, or '' when it isn't one. Must match normalize_email in contacts_store.py.
  function normalizeEmail(email) {
    email = (email || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  }

  // How this person is reached: 'email' when set so, or when there is no LinkedIn profile to use.
  function channelOf(contact) {
    if (contact.channel === 'email' && contact.email) return 'email';
    return !contact.linkedinUrl && contact.email ? 'email' : 'linkedin';
  }

  // exceptId: when editing, the person being edited may keep their own URL.
  // A person needs a way to be reached: a LinkedIn profile, or an email address.
  function validateNew(fields, contacts, exceptId) {
    if (!(fields.name || '').trim()) return 'Name is required.';
    if (!(fields.company || '').trim()) return 'Company is required.';
    var url = normalizeUrl(fields.linkedinUrl);
    var email = normalizeEmail(fields.email);
    if ((fields.email || '').trim() && !email) return 'That email address doesn\'t look right.';
    if (!url && !email) return 'Add a LinkedIn profile URL or an email address.';
    if (fields.channel === 'email' && !email) return 'Add an email address to reach this person by email.';
    for (var i = 0; i < contacts.length; i++) {
      if (exceptId && contacts[i].id === exceptId) continue;
      if (url ? normalizeUrl(contacts[i].linkedinUrl) === url
              : !contacts[i].linkedinUrl && normalizeEmail(contacts[i].email) === email) {
        return 'Already in People: ' + contacts[i].name + '.';
      }
    }
    return '';
  }

  // Edits change who someone is, never where they are in the pipeline (stage, dates, messages).
  function applyEdit(contact, fields, appIds) {
    var like = parseInt(fields.likelihood, 10);
    contact.name = fields.name.trim();
    contact.company = fields.company.trim();
    contact.title = (fields.title || '').trim();
    contact.linkedinUrl = normalizeUrl(fields.linkedinUrl);
    contact.relation = fields.relation || '';
    contact.notes = (fields.notes || '').trim();
    // Email fields are only written once someone has an address, so older contacts keep their shape.
    var email = normalizeEmail(fields.email);
    if (email || contact.email) contact.email = email;
    if (email || contact.channel) contact.channel = email && (fields.channel === 'email' || !contact.linkedinUrl) ? 'email' : 'linkedin';
    if (!isNaN(like)) contact.likelihood = Math.max(0, Math.min(100, like));  // blank keeps the current score
    contact.appIds = appIds;
    return contact;
  }

  // Mirrors add_contacts in contacts_store.py so manual and skill-added contacts look the same.
  function newContact(fields, cfg, today, id, appIds) {
    cfg = withDefaults(cfg);
    var url = normalizeUrl(fields.linkedinUrl), email = normalizeEmail(fields.email);
    var channel = email && (fields.channel === 'email' || !url) ? 'email' : 'linkedin';
    // Someone reached by email has no connection request to accept, so they start ready to ask.
    var stage = fields.connected || channel === 'email' ? 'Connected' : 'Found';
    var relation = fields.relation || '';
    var c = newContactBase(fields, cfg, today, id, appIds, stage, relation, url);
    if (email) { c.email = email; c.emailSource = 'Added by you'; c.channel = channel; }
    return c;
  }

  function newContactBase(fields, cfg, today, id, appIds, stage, relation, url) {
    return {
      id: id, company: fields.company.trim(), appIds: appIds || [], name: fields.name.trim(),
      title: (fields.title || '').trim(), linkedinUrl: url, location: '',
      relation: relation, likelihood: RELATION_SCORE[relation] || 50, why: 'Added by you',
      stage: stage, useNote: false, connectNote: '', askMessage: '', askApproved: false, followupMessage: '',
      attachmentSource: cfg.defaultAttachment,
      attachment: cfg.defaultAttachment === 'base' ? cfg.baseResumePath : '',
      dateFound: today, dateQueued: '', dateRequested: '', dateConnected: stage === 'Connected' ? today : '',
      dateAsked: '', dateFollowedUp: '', dateReplied: '', nextFollowup: '', notes: (fields.notes || '').trim()
    };
  }

  return {
    STAGES: STAGES, CLOSED: CLOSED, ORDER: ORDER, DEFAULT_CONFIG: DEFAULT_CONFIG, RELATIONS: RELATIONS,
    withDefaults: withDefaults, quota: quota, level: level, stats: stats, canToggleNote: canToggleNote,
    moveStage: moveStage, approve: approve, setAttachmentSource: setAttachmentSource,
    canApproveAsk: canApproveAsk, replyDraft: replyDraft, setReplyDraft: setReplyDraft,
    notesText: notesText, furthest: furthest, forCompany: forCompany, column: column,
    normalizeUrl: normalizeUrl, normalizeEmail: normalizeEmail, channelOf: channelOf,
    validateNew: validateNew, newContact: newContact, applyEdit: applyEdit
  };
})();
