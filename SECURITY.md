# Security Policy

## Supported versions

CubeLab is a static, client-side web application. Security fixes are applied to the
latest commit on `main` and to the currently deployed GitHub Pages site.

| Version | Supported |
| --- | :---: |
| `main` / current deployment | ✅ |
| Older snapshots | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's
[private vulnerability reporting](https://github.com/somphol/rubiks-cube/security/advisories/new).
If that is unavailable, contact the maintainer via the email address on the
[GitHub profile](https://github.com/somphol).

Please include:

- A description of the issue and its impact.
- Steps to reproduce, or a minimal proof of concept.
- The browser and operating system used.
- Any suggested mitigation, if you have one.

You can expect an acknowledgment within a few days. Valid reports will be investigated,
fixed on `main`, and credited in the release notes unless you prefer to remain anonymous.

## Scope

CubeLab has no server, accounts, analytics, or telemetry. Any data the app remembers is
stored in the browser. Relevant areas include:

- cross-site scripting through `localStorage` values or rendered move/status text;
- unsafe HTML rendering of labels, move history, or other user-controlled text;
- denial of service through pathological input or oversized `localStorage` values;
- unintended data exposure from persisted preferences or personal best;
- supply-chain risk from the Three.js scripts loaded from jsDelivr;
- worker isolation: the solver worker is built from an inlined Blob, not a remote script.

The following are generally out of scope:

- vulnerabilities in the browser itself;
- social engineering or physical access;
- reports that require a compromised device or malicious browser extension;
- missing security headers on GitHub Pages beyond what the platform allows.

## Security design

- The application is served as static HTML, CSS, and JavaScript. There is no backend,
  database, account system, or API key.
- User-controlled text is rendered as text rather than injected as HTML; move strings are
  validated against the known move set before use.
- Preferences and the personal best stay in `localStorage` on the user's device. No data is
  uploaded.
- The solver worker is a Blob built from the inlined vendor source; no external worker
  script is fetched.
- Three.js is loaded from jsDelivr at a pinned version. The app does not use Subresource
  Integrity; pinning limits drift but does not remove CDN supply-chain risk. Vendoring
  Three.js or adding SRI is a future hardening option.
- There are no analytics, tracking scripts, or third-party requests beyond the Three.js
  scripts.
