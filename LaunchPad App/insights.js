/* "Insights": where roles and outreach are getting through, and where they stall.
   Worked out from the data only. No DOM access here (like your-move.js and
   people-core.js), so the rules stay in one place.
   It reads what is on the board now; archived cards and people are not counted. */
var Insights = (function () {
  var APPROVED = ['To Apply', 'Applied', 'Phone Screen', 'Take-home', 'Interviewing', 'Final Round', 'Offer', 'Accepted'];
  var APPLIED = ['Applied', 'Phone Screen', 'Take-home', 'Interviewing', 'Final Round', 'Offer', 'Accepted', 'Rejected', 'Ghosted'];
  var INTERVIEW = ['Phone Screen', 'Take-home', 'Interviewing', 'Final Round', 'Offer', 'Accepted'];
  var OFFER = ['Offer', 'Accepted'];
  var SCREENING = ['Screening', 'Researching'];
  var PEOPLE_CLOSED = ['Declined', 'No response', 'Skipped'];
  var MIN_SAMPLE = 5;   // below this a rate is shown but never called out
  var MAX_NOTES = 3;

  function has(list, v) { return list.indexOf(v) >= 0; }
  function days(from, to) {
    var a = Date.parse(String(from || '').slice(0, 10)), b = Date.parse(String(to || '').slice(0, 10));
    return isNaN(a) || isNaN(b) ? null : Math.round((b - a) / 86400000);
  }
  function pct(n, of) { return of ? Math.round(100 * n / of) : null; }
  function median(nums) {
    var s = nums.filter(function (n) { return n != null && n >= 0; }).sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  // What a job card has reached, from its status and dates.
  function job(a) {
    var s = a.status || '';
    var applied = !!a.dateApplied || has(APPLIED, s);
    return {
      approved: applied || has(APPROVED, s) || !!a.autoApproved,
      applied: applied,
      interview: has(INTERVIEW, s),
      offer: has(OFFER, s)
    };
  }

  // What a contact has reached. "requested" means a connection request went out;
  // people who were already connected never had one, so they don't count toward the accept rate.
  function person(c) {
    var s = c.stage || '';
    var asked = !!c.dateAsked || s === 'Asked' || s === 'Referred';
    var connected = asked || !!c.dateConnected || s === 'Connected';
    return {
      requested: !!c.dateRequested,
      connected: connected,
      accepted: !!c.dateRequested && connected,
      asked: asked,
      replied: asked && (!!c.dateReplied || s === 'Referred' || s === 'Declined'),
      referred: s === 'Referred'
    };
  }

  function step(label, count, of, ofLabel) {
    return { label: label, count: count, rate: of == null ? null : pct(count, of), of: ofLabel || '' };
  }

  function group(items, keyOf) {
    var map = {}, order = [];
    items.forEach(function (it) {
      var k = keyOf(it) || '(not set)';
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(it);
    });
    return order.map(function (k) { return { key: k, items: map[k] }; })
      .sort(function (x, y) { return y.items.length - x.items.length; });
  }

  function count(items, fn) { return items.filter(fn).length; }

  function compute(apps, contacts, today, opts) {
    apps = apps || []; contacts = contacts || []; opts = opts || {};
    var followupDays = opts.followupDays != null ? opts.followupDays : 6;
    var staleInviteDays = opts.staleInviteDays != null ? opts.staleInviteDays : 21;
    var J = apps.map(function (a) { return { a: a, r: job(a) }; });
    var P = contacts.map(function (c) { return { c: c, r: person(c) }; });

    var nApproved = count(J, function (x) { return x.r.approved; });
    var nApplied = count(J, function (x) { return x.r.applied; });
    var nInterview = count(J, function (x) { return x.r.interview; });
    var nOffer = count(J, function (x) { return x.r.offer; });
    var jobFunnel = [
      step('Roles tracked', apps.length, null),
      step('Approved (To Apply or later)', nApproved, apps.length, 'of tracked'),
      step('Applied', nApplied, nApproved, 'of approved'),
      step('Interviewing or beyond', nInterview, nApplied, 'of applied'),
      step('Offers', nOffer, nApplied, 'of applied')
    ];

    var nRequested = count(P, function (x) { return x.r.requested; });
    var nAccepted = count(P, function (x) { return x.r.accepted; });
    var nConnected = count(P, function (x) { return x.r.connected; });
    var nAsked = count(P, function (x) { return x.r.asked; });
    var nReplied = count(P, function (x) { return x.r.replied; });
    var nReferred = count(P, function (x) { return x.r.referred; });
    var outreachFunnel = [
      step('People found', contacts.length, null),
      step('Connection requests sent', nRequested, contacts.length, 'of people'),
      step('Requests accepted', nAccepted, nRequested, 'of requests'),
      step('Connected (incl. already connected)', nConnected, contacts.length, 'of people'),
      step('Asked for a referral', nAsked, nConnected, 'of connected'),
      step('Replied', nReplied, nAsked, 'of asked'),
      step('Referred', nReferred, nAsked, 'of asked')
    ];

    var toAccept = median(P.filter(function (x) { return x.c.dateRequested && x.c.dateConnected; })
      .map(function (x) { return days(x.c.dateRequested, x.c.dateConnected); }));
    var toReply = median(P.filter(function (x) { return x.c.dateAsked && x.c.dateReplied; })
      .map(function (x) { return days(x.c.dateAsked, x.c.dateReplied); }));

    var byRelation = group(P, function (x) { return (x.c.relation || '').trim(); }).map(function (g) {
      var req = count(g.items, function (x) { return x.r.requested; });
      var acc = count(g.items, function (x) { return x.r.accepted; });
      var ask = count(g.items, function (x) { return x.r.asked; });
      var rep = count(g.items, function (x) { return x.r.replied; });
      return { relation: g.key, people: g.items.length, requested: req, accepted: acc, acceptRate: pct(acc, req),
               asked: ask, replied: rep, replyRate: pct(rep, ask), referred: count(g.items, function (x) { return x.r.referred; }) };
    });

    var bySource = group(J, function (x) { return (x.a.source || '').trim(); }).map(function (g) {
      return { source: g.key, roles: g.items.length,
               approved: count(g.items, function (x) { return x.r.approved; }),
               applied: count(g.items, function (x) { return x.r.applied; }),
               interview: count(g.items, function (x) { return x.r.interview; }) };
    });

    var byTier = group(J, function (x) { return (x.a.tier || '').trim().toUpperCase(); }).map(function (g) {
      var fits = g.items.map(function (x) { return parseInt(x.a.fitScore, 10); }).filter(function (n) { return !isNaN(n); });
      return { tier: g.key, roles: g.items.length,
               avgFit: fits.length ? Math.round(fits.reduce(function (s, n) { return s + n; }, 0) / fits.length) : null,
               approved: count(g.items, function (x) { return x.r.approved; }),
               applied: count(g.items, function (x) { return x.r.applied; }) };
    }).sort(function (x, y) {   // A, B, C, then roles with no tier
      var u = x.tier === '(not set)', v = y.tier === '(not set)';
      return u !== v ? (u ? 1 : -1) : (x.tier < y.tier ? -1 : 1);
    });

    // Things that have been sitting. Each: {label, count, detail}.
    var waitingToApply = J.filter(function (x) { return x.a.status === 'To Apply' && !x.a.dateApplied; });
    var oldestApprove = Math.max.apply(null, [0].concat(waitingToApply.map(function (x) { return days(x.a.dateAdded, today) || 0; })));
    var oldScreening = count(J, function (x) { return has(SCREENING, x.a.status) && (days(x.a.dateAdded, today) || 0) >= 14; });
    var staleInvites = count(P, function (x) {
      return x.c.stage === 'Requested' && (days(x.c.dateRequested, today) || 0) >= staleInviteDays;
    });
    var quietAsks = count(P, function (x) {
      return x.c.stage === 'Asked' && !x.c.dateReplied && (days(x.c.dateAsked, today) || 0) >= followupDays;
    });
    var notAsked = count(P, function (x) { return x.c.stage === 'Connected'; });
    var stuck = [
      { label: 'Approved, not applied yet', count: waitingToApply.length,
        detail: waitingToApply.length ? 'oldest was added ' + plural(oldestApprove, 'day') + ' ago' : '' },
      { label: 'In Screening 14+ days', count: oldScreening, detail: oldScreening ? 'approve or drop them' : '' },
      { label: 'Connected, not asked yet', count: notAsked, detail: notAsked ? 'an ask is drafted on the next run' : '' },
      { label: 'Asks with no reply after ' + followupDays + '+ days', count: quietAsks, detail: quietAsks ? 'one follow-up, then close out' : '' },
      { label: 'Requests pending ' + staleInviteDays + '+ days', count: staleInvites, detail: staleInvites ? 'consider withdrawing' : '' }
    ];

    // Up to three plain observations, each backed by a number above. Rates are only
    // compared when both sides have MIN_SAMPLE or more, so a 1-of-1 never makes a headline.
    var notes = [];
    if (nApproved >= 3 && nApplied === 0) {
      notes.push(plural(nApproved, 'role') + ' approved and none applied to yet. Referrals in progress are a reason to wait; ' +
        'otherwise the oldest has been on the board ' + plural(oldestApprove, 'day') + '.');
    } else if (waitingToApply.length >= 5 && waitingToApply.length > nApplied) {
      notes.push(waitingToApply.length + ' approved roles are waiting to be applied to, against ' + nApplied +
        ' applied. Referrals in progress are a reason to wait; the oldest has been on the board ' + plural(oldestApprove, 'day') + '.');
    }
    var rated = byRelation.filter(function (r) { return r.requested >= MIN_SAMPLE && r.relation !== '(not set)'; })
      .sort(function (x, y) { return y.acceptRate - x.acceptRate; });
    if (rated.length >= 2 && rated[0].acceptRate - rated[rated.length - 1].acceptRate >= 15) {
      var hi = rated[0], lo = rated[rated.length - 1];
      notes.push('Connection requests to ' + hi.relation + ' contacts are accepted ' + hi.acceptRate + '% of the time (' +
        hi.accepted + ' of ' + hi.requested + '), against ' + lo.acceptRate + '% for ' + lo.relation + ' (' + lo.accepted + ' of ' + lo.requested + ').');
    } else if (nRequested >= MIN_SAMPLE) {
      notes.push(pct(nAccepted, nRequested) + '% of connection requests have been accepted (' + nAccepted + ' of ' + nRequested + ')' +
        (toAccept != null ? ', typically within ' + plural(toAccept, 'day') : '') + '.');
    }
    if (nAsked >= MIN_SAMPLE && !nReplied) {
      notes.push('None of the ' + nAsked + ' referral asks has had a reply yet' +
        (quietAsks ? '; ' + quietAsks + ' have waited ' + followupDays + '+ days.' : '.'));
    } else if (nAsked >= MIN_SAMPLE) {
      notes.push(pct(nReplied, nAsked) + '% of referral asks have had a reply (' + nReplied + ' of ' + nAsked + '), and ' +
        plural(nReferred, 'person', 'people') + ' agreed to refer.');
    }
    if (staleInvites >= 3 && notes.length < MAX_NOTES) {
      notes.push(plural(staleInvites, 'request') + ' have been pending ' + staleInviteDays + '+ days. Old pending invites count against LinkedIn\'s weekly limit.');
    }
    notes = notes.slice(0, MAX_NOTES);

    return {
      empty: !apps.length && !contacts.length,
      thin: apps.length + contacts.length < 10,
      jobFunnel: jobFunnel, outreachFunnel: outreachFunnel,
      medians: { toAccept: toAccept, toReply: toReply },
      byRelation: byRelation, bySource: bySource, byTier: byTier,
      stuck: stuck, notes: notes
    };
  }

  return { compute: compute, job: job, person: person };
})();
