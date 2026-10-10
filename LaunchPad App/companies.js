/* Companies rules with no DOM access: one entry per company, built from the jobs and the
   people. Nothing here changes data. Loaded as a classic script after people-core.js. */
var Companies = (function () {
  var REFERRAL = ['Found', 'Queued', 'Requested', 'Connected', 'Asked', 'Referred'];
  var CLOSED_PEOPLE = ['Declined', 'No response', 'Skipped'];
  // Furthest first: how far a role has got.
  var JOB_ORDER = ['Accepted', 'Offer', 'Final Round', 'Take-home', 'Interviewing', 'Phone Screen', 'Applied',
                   'To Apply', 'Screening', 'Researching'];
  var CLOSED_JOBS = ['Rejected', 'Withdrawn', 'Ghosted', "Won't Apply"];
  var RANK = { red: 0, amber: 1, grey: 2, wait: 3 };

  function key(s) { return (s || '').trim().toLowerCase(); }
  function tierOf(a) { return a.tier || ((/Tier\s*([ABC])\b/.exec(a.notes || '') || [])[1] || ''); }
  function isOpen(a) { return CLOSED_JOBS.indexOf(a.status) < 0; }

  /* opts.moveForJob(job) and opts.moveForContact(person) return a "Your move"
     ({level, verb, why}) or null; the page passes YourMove's rules in. */
  function build(name, jobs, people, opts) {
    opts = opts || {};
    var open = jobs.filter(isOpen);
    var stage = '';
    JOB_ORDER.some(function (s) {
      if (open.some(function (a) { return a.status === s; })) { stage = s; return true; }
      return false;
    });
    var fits = open.map(function (a) { return parseInt(a.fitScore, 10) || 0; }).filter(Boolean);
    var tiers = open.map(tierOf).filter(Boolean).sort();
    var counts = {}, furthest = -1;
    REFERRAL.forEach(function (s) { counts[s] = 0; });
    people.forEach(function (c) {
      var i = REFERRAL.indexOf(c.stage);
      if (i >= 0) { counts[c.stage]++; furthest = Math.max(furthest, i); }
    });
    var live = people.filter(function (c) { return CLOSED_PEOPLE.indexOf(c.stage) < 0; });
    var moves = [];
    jobs.forEach(function (a) {
      var m = opts.moveForJob && opts.moveForJob(a);
      if (m) moves.push({ level: m.level, verb: m.verb, why: m.why, who: a.role || '' });
    });
    people.forEach(function (c) {
      var m = opts.moveForContact && opts.moveForContact(c);
      if (m) moves.push({ level: m.level, verb: m.verb, why: m.why, who: c.name || '' });
    });
    moves.sort(function (x, y) { return RANK[x.level] - RANK[y.level]; });
    return {
      name: name, key: key(name), jobs: jobs, open: open, people: people, live: live,
      stage: stage || (jobs.length ? 'Closed' : ''),
      tier: tiers[0] || '', fit: fits.length ? Math.max.apply(null, fits) : 0,
      referral: counts, furthest: furthest, furthestStage: furthest >= 0 ? REFERRAL[furthest] : '',
      next: moves[0] || null,
      needsYou: moves.filter(function (m) { return m.level === 'red' || m.level === 'amber'; }).length
    };
  }

  // Every company that has a job or a person, the ones that need you first.
  function list(apps, contacts, opts) {
    var by = {}, order = [];
    function slot(name) {
      var k = key(name);
      if (!k) return null;
      if (!by[k]) { by[k] = { name: name.trim(), jobs: [], people: [] }; order.push(k); }
      return by[k];
    }
    (apps || []).forEach(function (a) { var s = slot(a.company); if (s) s.jobs.push(a); });
    (contacts || []).forEach(function (c) { var s = slot(c.company); if (s) s.people.push(c); });
    var out = order.map(function (k) { return build(by[k].name, by[k].jobs, by[k].people, opts); });
    out.sort(function (x, y) {
      var a = x.next ? RANK[x.next.level] : 9, b = y.next ? RANK[y.next.level] : 9;
      if (a !== b) return a - b;
      var sx = JOB_ORDER.indexOf(x.stage), sy = JOB_ORDER.indexOf(y.stage);
      if (sx < 0) sx = 99;
      if (sy < 0) sy = 99;
      if (sx !== sy) return sx - sy;
      if (y.fit !== x.fit) return y.fit - x.fit;
      return x.name.localeCompare(y.name);
    });
    return out;
  }

  function find(apps, contacts, name, opts) {
    var k = key(name), hit = null;
    list(apps, contacts, opts).some(function (c) { if (c.key === k) { hit = c; return true; } return false; });
    return hit;
  }

  return { REFERRAL: REFERRAL, list: list, find: find, isOpen: isOpen };
})();
