## What this changes

<!-- One or two sentences. What can the app do after this that it could not before? -->

## Which AIR models are involved

<!-- Every model call must run on the ASU AI Research Acceleration Platform.
     Name the models this PR adds, removes, or re-routes, with measured latency
     where you have it. Delete the row if this PR touches no model calls. -->

| Model | Job | Measured |
| ----- | --- | -------- |
|       |     |          |

## How it was built

- [ ] Application code written by AIR models via `opencode` (say which, and roughly how many runs)
- [ ] Hand-written (say why — tooling, config, or a fix too small to delegate)

## Checks

- [ ] `npx tsc --noEmit` clean in every project touched
- [ ] `npx eslint src` clean in every project touched
- [ ] Services still start: `asu-guide` :3000 · `asu-auth-idp` :4000 · `asu-tools-api` :5000 · `asu-events-api` :5001 · `asu-search-api` :5003
- [ ] Tried it in the browser, signed in **and** signed out
- [ ] No secrets, `.env`, `*.db`, or generated pointer files staged

## Data and platform rules

- [ ] No regulated data or PII sent to the gateway — public or synthetic data only
- [ ] Nothing claims a capability the platform does not have (see the notes in `docs/`)
- [ ] Any latency or accuracy figure in the code, README, or UI was actually measured

## What is still weak

<!-- Be specific and honest. A reviewer should not have to discover the soft spots
     themselves, and the jury will ask. "Nothing" is rarely true. -->
