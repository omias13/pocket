# Omias Pocket

The phone half of [Omias](https://github.com/omias13/claude-os-dan) — a one-file check-in that
works when the PC does not.

Omias runs as a loopback-only server on a desktop. That is the right call for a dashboard that can
shell out to git, and it means the daily check-in only exists where the laptop is — which is
exactly where it is not, most of the day. A tunnel does not fix that: a tunnel still needs the
machine at the far end to be awake.

So this page never talks to Omias. Each save appends one small JSON document to a **private** repo,
which is awake whether or not any machine is, and the PC drains that mailbox on its next session.

## What is in this repo

`index.html`, a manifest and two icons. That is all of it: no build, no dependencies, no data.

The token that reaches the data is typed into the phone once and lives in that phone's
localStorage. It is a fine-grained GitHub token scoped to the private data repo and nothing else,
so the worst a lost phone can reach is two weeks of habit ticks and a task list.

## Setting up a phone

1. Open the page, tap the gear.
2. Data repo: `<owner>/pocket-data`.
3. Token: github.com → Settings → Developer settings → Personal access tokens → **Fine-grained**.
   Repository access: **only** that one repo. Permissions: **Contents: Read and write**.
4. Add to Home Screen.

## The other half

`scripts/pocket-sync.ts` and `src/lib/pocket.ts` in the Omias repo: the drain, the snapshot, and
the rules that make applying a document twice produce exactly the same result as applying it once.
