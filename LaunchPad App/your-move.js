/* "Your move": what needs the user right now, worked out from the data.
   No DOM access here (like people-core.js), so the rules stay in one place.
   Levels: 'red' = overdue / time-sensitive, 'amber' = needs you,
   'grey' = a decision when you have a minute, 'wait' = waiting on others. */
var YourMove = (function () {
  var INTERVIEW = ['Phone Screen', 'Interviewing', 'Final Round'];
  var CLOSED = ['Rejected', 'Withdrawn', 'Ghosted', "Won't Apply", 'Accepted'];
  var RANK = { red: 0, amber: 1, grey: 2, wait: 3 };
  // A job is "approved" once it's in To Apply or any later active stage. Approving a job
  // is what sends connection requests: the routine connects with its people automatically.
  var APPROVED = ['To Apply', 'Applied', 'Phone Screen', 'Take-home', 'Interviewing', 'Final Round', 'Offer'];

  function daysBetween(from, to) {
    var a = Date.parse(from), b = Date.parse(to);
    return isNaN(a) || isNaN(b) ? 0 : Math.round((b - a) / 86400000);
  }
  function key(s) { return (s || '').trim().toLowerCase(); }
  function contactsFor(a, contacts) {
    return (contacts || []).filter(function (c) {
      return (c.appIds || []).indexOf(a.id) >= 0 || key(c.company) === key(a.company);
    });
  }
  function linkedJobs(c, apps) {
    var ids = c.appIds || [];
    return (apps || []).filter(function (a) {
      return ids.length ? ids.indexOf(a.id) >= 0 : key(a.company) === key(c.company);
    });
  }
  function jobApproved(c, apps) {
    return linkedJobs(c, apps).some(function (a) { return APPROVED.indexOf(a.status) >= 0; });
  }
  function toConnect(c) { return c.stage === 'Found' || c.stage === 'Queued'; }

  /* Autopilot (Data/autopilot.json, switched on the Your move tab). Off by default.
     jobs: the routine moves Screening cards with fitScore >= minFit in the chosen tiers
     to To Apply (stamping autoApproved). messages: drafted asks and follow-ups send on
     the first run holdHours after drafting, unless the contact is on Hold. */
  var AP_DEFAULT = { jobs: { enabled: false, minFit: 80, tiers: ['A'] }, messages: { enabled: false, holdHours: 12 } };
  function autopilot(ap) {
    ap = ap || {};
    var j = ap.jobs || {}, m = ap.messages || {};
    return {
      jobs: { enabled: !!j.enabled, minFit: j.minFit != null ? +j.minFit : AP_DEFAULT.jobs.minFit, tiers: j.tiers || AP_DEFAULT.jobs.tiers },
      messages: { enabled: !!m.enabled, holdHours: m.holdHours != null ? +m.holdHours : AP_DEFAULT.messages.holdHours }
    };
  }
  function autoApproveJob(a, ap) {
    var j = autopilot(ap).jobs;
    return j.enabled && (a.status === 'Screening' || a.status === 'Researching') &&
      (parseInt(a.fitScore, 10) || 0) >= j.minFit && j.tiers.indexOf((a.tier || '').toUpperCase()) >= 0;
  }
  // 'ask' / 'followup' when a drafted message is waiting for approval, else ''.
  function pendingMessage(c) {
    if (c.stage === 'Connected' && (c.askMessage || '').trim() && !c.askApproved) return 'ask';
    if (c.stage === 'Asked' && c.followupMessage && !c.dateFollowedUp && !c.dateReplied) return 'followup';
    return '';
  }
  function autoSends(c, ap) { return autopilot(ap).messages.enabled && !!pendingMessage(c) && !c.hold; }
  function first(name) { return (name || '').split(' ')[0]; }

  // One action per job card: the most urgent thing, or null when nothing is pending.
  function forJob(a, contacts, today, followupAfterDays, ap) {
    var s = a.status;
    var due = a.nextFollowup && a.nextFollowup <= today;
    if (CLOSED.indexOf(s) >= 0) return null;
    if (s === 'Take-home') {
      return due ? { level: 'red', verb: 'Take-home due', why: 'Follow-up date ' + a.nextFollowup + ' has passed' }
                 : { level: 'amber', verb: 'Do take-home', why: 'Take-home assignment in progress' };
    }
    if (INTERVIEW.indexOf(s) >= 0 || s === 'Applied') {
      return due ? { level: 'red', verb: 'Follow up', why: 'Follow-up was due ' + a.nextFollowup } : null;
    }
    if (s === 'Offer') return { level: 'amber', verb: 'Decide on offer', why: 'An offer is waiting for your answer' };
    if (s === 'To Apply') {
      if (a.dateApplied) return null;
      var cs = contactsFor(a, contacts);
      var referred = cs.filter(function (c) { return c.stage === 'Referred'; });
      if (referred.length) {
        return { level: 'amber', verb: 'Apply now', why: 'Referral from ' + referred.map(function (c) { return c.name; }).join(', ') };
      }
      var asked = cs.filter(function (c) { return c.stage === 'Asked' && c.dateAsked; });
      var stale = asked.length && asked.every(function (c) {
        return !c.dateReplied && daysBetween(c.dateAsked, today) >= followupAfterDays;
      });
      if (stale) return { level: 'amber', verb: 'Apply directly', why: 'No referral after ' + followupAfterDays + '+ days of asking' };
      var live = cs.filter(function (c) { return ['Declined', 'No response', 'Skipped'].indexOf(c.stage) < 0; });
      if (!live.length && daysBetween(a.dateAdded, today) >= 3) {
        return { level: 'amber', verb: 'Apply directly', why: 'No referral contacts found for this company' };
      }
      return { level: 'wait', verb: 'Referral in progress', why: live.length + ' contact' + (live.length === 1 ? '' : 's') + ' in outreach' };
    }
    if ((s === 'Screening' || s === 'Researching') && autoApproveJob(a, ap)) {
      return { level: 'wait', verb: 'Autopilot approves next run', why: 'Fit ' + a.fitScore + ', Tier ' + a.tier + ' meets your autopilot rule' };
    }
    if (s === 'Screening' || s === 'Researching') {
      var ready = contactsFor(a, contacts).filter(toConnect).length;
      return { level: 'grey', verb: 'Keep or drop?', why: ready
        ? 'Approving it connects with ' + ready + ' ' + (ready === 1 ? 'person' : 'people') + ' automatically'
        : 'Approve to move it to To Apply, or drop it' };
    }
    return null;
  }

  /* One action per contact. Connection requests need no review: once a linked job is
     approved, the routine sends them (plain, no note). Approving a person by hand
     (Found → Queued) connects them next run even if the job isn't approved. Messages (asks, follow-ups,
     replies) are still approved in the People tab; the tracker never sends anything. */
  function forContact(c, apps, ap) {
    if (c.stage === 'Referred') {
      return /\[reply draft\]/.test(c.notes || '')
        ? { level: 'red', verb: 'Approve reply', why: first(c.name) + ' agreed to refer — a reply with your referral note is drafted' }
        : { level: 'red', verb: 'Send details', why: first(c.name) + ' agreed to refer — send the job link and referral note' };
    }
    if (c.stage === 'Asked' && c.dateReplied) return { level: 'red', verb: 'Reply', why: first(c.name) + ' replied on ' + c.dateReplied };
    if (autoSends(c, ap)) {
      var h = autopilot(ap).messages.holdHours;
      return { level: 'wait', verb: 'Auto-sends', why: 'Autopilot sends this ' + (pendingMessage(c) === 'ask' ? 'ask' : 'follow-up') +
        ' on the first run ' + h + 'h after it was drafted' + (c.dateDrafted ? ' (' + String(c.dateDrafted).slice(0, 10) + ')' : '') + ', unless you Hold it' };
    }
    if (toConnect(c)) {
      if (c.stage === 'Queued') return { level: 'wait', verb: 'Connecting next run', why: 'Approved by you: a plain connection request goes out on the next run' };
      return jobApproved(c, apps)
        ? { level: 'wait', verb: 'Connecting next run', why: 'Job approved: a plain connection request goes out automatically' }
        : { level: 'wait', verb: 'Connects once job approved', why: 'Approve the job card (To Apply), or Approve this person, to connect' };
    }
    if (c.stage === 'Connected' && (c.askMessage || '').trim()) {
      return c.askApproved
        ? { level: 'wait', verb: 'Ready to send', why: 'Ask approved — it goes out on the next run' }
        : { level: 'amber', verb: 'Approve message', why: 'Read the drafted ask, tick Approve ask, then tell Claude "send outreach"' };
    }
    if (c.stage === 'Asked' && c.followupMessage && !c.dateFollowedUp) {
      return { level: 'amber', verb: 'Follow-up ready', why: 'Tell Claude "send outreach" to send the one follow-up' };
    }
    if (c.stage === 'Requested') return { level: 'wait', verb: 'Awaiting accept', why: 'Connection request pending' };
    if (c.stage === 'Asked') return { level: 'wait', verb: 'Awaiting reply', why: 'Asked on ' + c.dateAsked };
    return null;
  }

  function needsYou(x) { return !!x && (x.level === 'red' || x.level === 'amber'); }

  /* The "Your move" panel: a short list, most urgent first.
     Each line: {level, text, sub, target} where target is
     {type:'job', id} | {type:'people', id?} | {type:'screening'}. A people target with an id
     is one person (open their panel); without one it is a group (go to People). */
  function summary(apps, contacts, today, followupAfterDays, ap) {
    var lines = [];
    (apps || []).forEach(function (a) {
      var m = forJob(a, contacts, today, followupAfterDays, ap);
      if (needsYou(m)) lines.push({ level: m.level, text: a.company + ' — ' + m.verb, sub: (a.role || '') + ' · ' + m.why, target: { type: 'job', id: a.id } });
    });
    var replies = [], asks = 0, followups = 0, waitAsk = 0, waitReq = 0, connecting = 0, autoMsgs = 0;
    (contacts || []).forEach(function (c) {
      var m = forContact(c, apps, ap);
      if (!m) return;
      if (m.level === 'red') replies.push(c);
      else if (m.verb === 'Connecting next run') connecting++;
      else if (m.verb === 'Auto-sends' || m.verb === 'Ready to send') autoMsgs++;
      else if (m.verb === 'Approve message') asks++;
      else if (m.verb === 'Follow-up ready') followups++;
      else if (m.verb === 'Awaiting reply') waitAsk++;
      else if (m.verb === 'Awaiting accept') waitReq++;
    });
    replies.forEach(function (c) {
      var m = forContact(c, apps, ap);
      lines.push({ level: 'red', text: c.name + ' (' + c.company + ') — ' + m.verb, sub: m.why, target: { type: 'people', id: c.id } });
    });
    if (asks) {
      lines.push({ level: 'amber', text: 'Approve outreach — ' + asks + ' message' + (asks === 1 ? '' : 's'),
        sub: 'Review all here (one click), or one by one in People. Approved messages go out on the next run', target: { type: 'people' } });
    }
    if (followups) {
      lines.push({ level: 'amber', text: 'Follow-ups ready — ' + followups,
        sub: 'Tell Claude "send outreach", or switch on message autopilot', target: { type: 'people' } });
    }
    lines.sort(function (x, y) { return RANK[x.level] - RANK[y.level]; });
    var recent = (apps || []).filter(function (a) { return a.autoClosed && daysBetween(a.autoClosed, today) <= 1; }).length;
    if (recent) {
      lines.push({ level: 'grey', text: recent + ' role' + (recent === 1 ? '' : 's') + ' auto-closed by cleanup — undo?',
        sub: 'Stale in Screening 21+ days, or no reply 30+ days after applying. Drag a card back to its column to undo.', target: { type: 'autoclosed' } });
    }
    var approvedRecent = (apps || []).filter(function (a) { return a.autoApproved && daysBetween(a.autoApproved, today) <= 1; }).length;
    if (approvedRecent) {
      lines.push({ level: 'grey', text: approvedRecent + ' role' + (approvedRecent === 1 ? '' : 's') + ' approved by autopilot — undo?',
        sub: 'Moved to To Apply by your autopilot rule. Drop or move a card back to undo.', target: { type: 'autoapproved' } });
    }
    var screening = (apps || []).filter(function (a) { return (a.status === 'Screening' || a.status === 'Researching') && !autoApproveJob(a, ap); }).length;
    if (screening) {
      lines.push({ level: 'grey', text: 'Decide — ' + screening + ' Screening role' + (screening === 1 ? '' : 's') + ': approve or drop?',
        sub: 'Approve moves it to To Apply and connects with its people automatically; drop the rest', target: { type: 'screening' } });
    }
    var waiting = [];
    if (waitAsk) waiting.push(waitAsk + ' ask' + (waitAsk === 1 ? '' : 's') + ' out');
    if (autoMsgs) waiting.push(autoMsgs + ' message' + (autoMsgs === 1 ? '' : 's') + ' going out automatically');
    if (connecting) waiting.push(connecting + ' to connect next run');
    if (waitReq) waiting.push(waitReq + ' request' + (waitReq === 1 ? '' : 's') + ' pending');
    var inprog = (apps || []).filter(function (a) { var m = forJob(a, contacts, today, followupAfterDays, ap); return m && m.level === 'wait'; }).length;
    if (inprog) waiting.unshift(inprog + ' role' + (inprog === 1 ? '' : 's') + ' awaiting referrals');
    return {
      lines: lines,
      count: lines.filter(function (l) { return l.level === 'red' || l.level === 'amber'; }).length,
      waiting: waiting.join(' · ')
    };
  }

  function peopleCount(contacts, apps, ap) {
    return (contacts || []).filter(function (c) { return needsYou(forContact(c, apps, ap)); }).length;
  }

  return { forJob: forJob, forContact: forContact, summary: summary, needsYou: needsYou, peopleCount: peopleCount, jobApproved: jobApproved,
    autopilot: autopilot, autoApproveJob: autoApproveJob, pendingMessage: pendingMessage, autoSends: autoSends };
})();
