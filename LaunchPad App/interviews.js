/* Interview rules with no DOM access. A job may carry an optional `interviews` list:
   [{id, date, time, round, with, notes, outcome}]. Jobs without it keep working, and the
   list is removed again when its last round is deleted. Loaded as a classic script. */
var Interviews = (function () {
  var ROUNDS = ['Recruiter screen', 'Phone screen', 'Hiring manager', 'Technical', 'Take-home',
                'Onsite / loop', 'Final round', 'Other'];
  var OUTCOMES = ['', 'Passed', 'Waiting to hear', 'Did not pass'];
  // Statuses where an interview is expected, so a job without a dated round needs one.
  var ACTIVE = ['Phone Screen', 'Interviewing', 'Take-home', 'Final Round'];

  function rounds(a) {
    return Array.isArray(a && a.interviews)
      ? a.interviews.filter(function (r) { return r && typeof r === 'object'; }) : [];
  }

  function daysBetween(from, to) {
    return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
  }

  function when(date, today) {
    if (!date) return '';
    var n = daysBetween(today, date);
    if (isNaN(n)) return '';
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    return n > 0 ? 'In ' + n + ' days' : -n + ' days ago';
  }

  /* {upcoming, past, unscheduled, empty}. upcoming and past hold {job, round, when};
     unscheduled holds jobs at an interview stage with no round still to come. */
  function compute(apps, today) {
    var upcoming = [], past = [], unscheduled = [];
    (apps || []).forEach(function (a) {
      var ahead = 0;
      rounds(a).forEach(function (r) {
        var item = { job: a, round: r, when: when(r.date, today) };
        if (r.date && r.date >= today) { upcoming.push(item); ahead++; }
        else past.push(item);
      });
      if (ACTIVE.indexOf(a.status) >= 0 && !ahead) unscheduled.push(a);
    });
    var stamp = function (x) { return (x.round.date || '') + ' ' + (x.round.time || ''); };
    upcoming.sort(function (x, y) { return stamp(x) < stamp(y) ? -1 : stamp(x) > stamp(y) ? 1 : 0; });
    past.sort(function (x, y) { return stamp(x) > stamp(y) ? -1 : stamp(x) < stamp(y) ? 1 : 0; });
    return { upcoming: upcoming, past: past, unscheduled: unscheduled,
             empty: !upcoming.length && !past.length && !unscheduled.length };
  }

  function clean(s) { return String(s == null ? '' : s).trim(); }

  function badDate(fields) {
    var date = clean(fields.date);
    return date && !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'The date must look like 2026-01-31.' : '';
  }

  function fill(r, fields) {
    r.date = clean(fields.date);
    r.time = clean(fields.time);
    r.round = clean(fields.round) || 'Other';
    r.with = clean(fields.with);
    r.notes = clean(fields.notes);
    return r;
  }

  // Returns an error message, or '' after adding the round to the job.
  function add(a, fields, id) {
    var err = badDate(fields);
    if (err) return err;
    if (!Array.isArray(a.interviews)) a.interviews = [];
    a.interviews.push(fill({ id: id, outcome: '' }, fields));
    return '';
  }

  // Returns an error message, or '' after changing the round; its id and outcome are kept.
  function update(a, id, fields) {
    var err = badDate(fields), hit = null;
    if (err) return err;
    rounds(a).forEach(function (r) { if (r.id === id) hit = r; });
    if (!hit) return 'That round is no longer on this job.';
    fill(hit, fields);
    return '';
  }

  function setOutcome(a, id, outcome) {
    rounds(a).forEach(function (r) { if (r.id === id) r.outcome = OUTCOMES.indexOf(outcome) >= 0 ? outcome : ''; });
  }

  function remove(a, id) {
    if (!Array.isArray(a.interviews)) return;
    a.interviews = a.interviews.filter(function (r) { return !r || r.id !== id; });
    if (!a.interviews.length) delete a.interviews;
  }

  return { ROUNDS: ROUNDS, OUTCOMES: OUTCOMES, ACTIVE: ACTIVE, rounds: rounds, compute: compute,
           when: when, add: add, update: update, setOutcome: setOutcome, remove: remove };
})();
