# Omias Pocket

The phone half of Omias — a one-file check-in that works when the PC does not.

Omias runs as a loopback-only server on a desktop. That is the right call for a dashboard that can
shell out to git, and it means the daily check-in only exists where the laptop is — which is
exactly where it is not, most of the day. A tunnel does not fix that: a tunnel still needs the
machine at the far end to be awake.

So this page never talks to Omias. Each save appends one small JSON document to a **private** repo,
which is awake whether or not any machine is, and the PC drains that mailbox on its next session.

## Where this lives now

This used to be its own repo (`D:\claude-os\pocket\`). It is now part of the Omias agent repo —
`C:\egat\claude-gui\pocket\` — because the app and the phone are the same product and were drifting
apart as two checkouts. The published site (`omias13.github.io/pocket`) and the private data repo
(`omias13/pocket-data`) are unchanged; only where the source is edited moved.

## What is in this folder

`index.html`, a manifest and three icons. That is all of it: no build, no dependencies, no data.
`pocket-page.check.js` sits beside it (stub-DOM test) but is not published — see the deploy skip
list below.

The token that reaches the data is typed into the phone once and lives in that phone's
localStorage. It is a fine-grained GitHub token scoped to the private data repo and nothing else,
so the worst a lost phone can reach is two weeks of habit ticks and a task list.

## Deploying

```
node C:\egat\claude-gui\pocket-deploy.js            # publish pocket/ to omias13/pocket
node C:\egat\claude-gui\pocket-deploy.js --dry-run  # list what would be uploaded, no network call
```

Two repos, on purpose:

- `omias13/pocket` — public, this folder only. An app shell with no data and no secrets, because
  GitHub Pages will not serve a private repo on a free account.
- `omias13/pocket-data` — private, everything personal. The snapshot and the phone's mailbox.

The page holds nothing; the token Dan types into it on his phone is what reaches the data. So the
public half can be read by anyone and still gives away nothing but the layout.

## Setting up a phone

1. Open the page, tap the gear.
2. Data repo: `<owner>/pocket-data`.
3. Token: github.com → Settings → Developer settings → Personal access tokens → **Fine-grained**.
   Repository access: **only** that one repo. Permissions: **Contents: Read and write**.
4. Add to Home Screen.

## The other half

`pocket-sync.js` and `life-pocket.js` in this repo (`C:\egat\claude-gui\`): the drain, the
snapshot, and the rules that make applying a document twice produce exactly the same result as
applying it once.
