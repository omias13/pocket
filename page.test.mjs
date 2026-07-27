// The phone page has no build step and no framework, which is the right call for something that
// must load on a bad signal — but it also means nothing type-checks it and nobody can open it on
// the device it ships to. A typo in a render function is a blank screen at a substation, and the
// entry that would have been made there is simply never made.
//
// So: run the page's script against a stub DOM and assert what it draws.
//
//   node pocket/page.test.mjs
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

let pass = 0;
let fail = 0;
const ok = (label, cond) => {
  if (cond) { pass++; console.log(`ok   ${label}`); }
  else { fail++; console.log(`FAIL ${label}`); }
};

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date());
const daysAgo = (n) => ymd(new Date(Date.now() - n * 86400000));

// ── a DOM just real enough ─────────────────────────────────────────────────
// textContent is an accessor, not a field: the page clears a container with `box.textContent = ""`
// and a plain property would leave the children in place, so every assertion below would pass on a
// list that never actually emptied.
function element(tag) {
  const node = {
    tagName: tag,
    children: [],
    style: {},
    className: "",
    hidden: false,
    value: "",
    type: "",
    onclick: null,
    _text: "",
    append(...kids) { for (const k of kids) node.children.push(typeof k === "string" ? { _text: k, children: [] } : k); },
    setAttribute(k, v) { node[k] = v; },
    addEventListener() {},
    scrollIntoView() {},
    focus() {},
    showModal() { node.open = true; },
    close() { node.open = false; },
  };
  Object.defineProperty(node, "textContent", {
    get: () => node._text + node.children.map((c) => c.textContent ?? c._text ?? "").join(""),
    set: (v) => { node.children.length = 0; node._text = String(v); },
  });
  return node;
}

/** Every id the page asks for, invented on demand and remembered. */
function makeDocument() {
  const byId = new Map();
  return {
    byId,
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, element("div"));
      return byId.get(id);
    },
    createElement: (tag) => element(tag),
    createTextNode: (t) => ({ _text: String(t), children: [], get textContent() { return this._text; } }),
    addEventListener() {},
    visibilityState: "visible",
  };
}

const SNAPSHOT = {
  publishedAt: new Date(Date.now() - 3600_000).toISOString(),
  by: "test-pc",
  today: TODAY,
  habits: [
    { id: "water", kind: "toggle", label: "Water", routine: "morning" },
    { id: "walk", kind: "toggle", label: "Walk", routine: "evening" },
  ],
  parts: ["legs"],
  cats: ["egat"],
  days: { [daysAgo(1)]: { habits: { water: true } }, [daysAgo(2)]: { habits: { water: true } } },
  todos: [
    { id: "late11", text: "overdue thing", due: daysAgo(2), done: false },
    { id: "today1", text: "due today", due: TODAY, done: false },
    { id: "some11", text: "no date", done: false },
  ],
  review: { week: "2026-W31", weekDone: false, month: TODAY.slice(0, 7), monthDone: true },
};

function boot(store = {}) {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const document = makeDocument();
  const ctx = {
    document,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
    },
    navigator: {},
    console,
    setTimeout,
    scrollTo() {},
    TextEncoder,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    // Nothing in these tests is allowed to touch the network: the point is what gets drawn from
    // the snapshot already on the phone.
    fetch: async () => ({ ok: false, status: 0, text: async () => "" }),
  };
  ctx.window = ctx;
  ctx.self = ctx;
  createContext(ctx);
  runInContext(code, ctx);
  return { ctx, document, $: (id) => document.getElementById(id) };
}

const texts = (node) => node.children.map((c) => c.textContent);
const flat = (node) => texts(node).join(" | ");

// ── home draws the same summary Omias does ─────────────────────────────────
{
  const { $ } = boot({
    "pocket.cfg": JSON.stringify({ repo: "omias13/pocket-data", token: "github_pat_x" }),
    "pocket.snapshot": JSON.stringify(SNAPSHOT),
  });

  ok("home is what opens", $("pane-home").hidden === false && $("pane-checkin").hidden === true);

  const band = flat($("attention").children[0] ?? $("attention"));
  ok("an unfilled today is the first thing said", band.includes("Today isn't checked in"));
  ok("overdue work is called out", band.includes("1 task overdue"));
  ok("so is what is due today", band.includes("1 due today"));
  ok("an unreviewed week says where to do it", band.includes("2026-W31") && band.includes("on the PC"));
  ok("a month already reviewed is not mentioned", !band.includes(`${TODAY.slice(0, 7)} hasn't`));

  const leaves = flat($("leaves"));
  ok("today's leaf counts the habits logged", leaves.includes("0/2"));
  ok("it says nothing is recorded rather than inventing a streak", leaves.includes("nothing recorded yet"));
  ok("the to-do leaf counts every open task", leaves.includes("3"));
  ok("the phone's own state is on the page too", leaves.includes("PC published"));
  ok("and what the phone deliberately cannot see is spelled out", $("home-foot").textContent.includes("stay on the PC"));
}

// ── the streak counts days with an entry, not perfect days ─────────────────
{
  const { $ } = boot({
    "pocket.cfg": JSON.stringify({ repo: "r/r", token: "github_pat_x" }),
    "pocket.snapshot": JSON.stringify({
      ...SNAPSHOT,
      days: { [TODAY]: { habits: { water: true } }, [daysAgo(1)]: { habits: { water: false } }, [daysAgo(2)]: { habits: { water: true } } },
    }),
  });
  const leaves = flat($("leaves"));
  ok("a logged 'no' keeps the chain alive — showing up is the habit", leaves.includes("3 days in a row"));
  ok("and the day counts as checked in", !leaves.includes("nothing recorded yet"));
}

// ── the backfill strip ─────────────────────────────────────────────────────
{
  const { $ } = boot({
    "pocket.cfg": JSON.stringify({ repo: "r/r", token: "github_pat_x" }),
    "pocket.snapshot": JSON.stringify(SNAPSHOT),
  });
  const chips = $("days").children;
  ok("at least the last three days are always offered", chips.length >= 4);
  ok("today is the last chip, and selected", chips[chips.length - 1].className.includes("on"));
  // The dot is what makes a wider strip useful rather than just longer.
  // `style` is assigned as a string, the way the page writes it — browsers forward that to cssText.
  const marked = chips.filter((c) => c.children.some((k) => String(k.style ?? "").includes("--good")));
  ok("days already answered are marked", marked.length === 2);
}

// ── nothing waiting says so, rather than showing an empty box ──────────────
{
  const { $ } = boot({
    "pocket.cfg": JSON.stringify({ repo: "r/r", token: "github_pat_x" }),
    "pocket.snapshot": JSON.stringify({
      ...SNAPSHOT,
      days: { [TODAY]: { habits: { water: true, walk: true } } },
      todos: [],
      review: { week: "2026-W31", weekDone: true, month: TODAY.slice(0, 7), monthDone: true },
    }),
  });
  ok("a clear day is stated, not implied", $("attention").textContent.includes("Nothing is waiting on you"));
  ok("both habits register as met", flat($("leaves")).includes("2/2"));
}

// ── the tabs actually switch ───────────────────────────────────────────────
{
  const { $ } = boot({
    "pocket.cfg": JSON.stringify({ repo: "r/r", token: "github_pat_x" }),
    "pocket.snapshot": JSON.stringify(SNAPSHOT),
  });
  $("view-checkin").onclick();
  ok("check-in opens on tap", $("pane-checkin").hidden === false && $("pane-home").hidden === true);
  $("view-home").onclick();
  ok("and home comes back", $("pane-home").hidden === false);
}

// ── an alert is a way in, not just a notice ────────────────────────────────
{
  const { $ } = boot({
    "pocket.cfg": JSON.stringify({ repo: "r/r", token: "github_pat_x" }),
    "pocket.snapshot": JSON.stringify(SNAPSHOT),
  });
  const rows = $("attention").children[0].children;
  const todayRow = rows.find((r) => r.textContent.includes("Today isn't checked in"));
  ok("the today alert is tappable", typeof todayRow.onclick === "function");
  todayRow.onclick();
  ok("tapping it lands on the check-in", $("pane-checkin").hidden === false);
  // Reviews are written on the PC; an alert that pretended otherwise would be a dead end.
  const weekRow = rows.find((r) => r.textContent.includes("2026-W31"));
  ok("the week review is a notice, not a dead link", !weekRow.onclick);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
