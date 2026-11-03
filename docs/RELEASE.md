# Release process

CubeLab has no package manager and no version file. A release is a commit on `main`, an
optional Git tag, and the GitHub Pages deployment that follows the push.

## Versioning

Use [Semantic Versioning](https://semver.org/) tags:

- `vMAJOR.MINOR.PATCH`
- `MAJOR` for breaking changes to the public behaviour or data format.
- `MINOR` for new features.
- `PATCH` for fixes and documentation.

Tags are optional for small documentation updates, but every user-visible release should
have a tag and a GitHub Release.

## Pre-release checklist

- [ ] `CHANGELOG.md` has an entry for the release, moved out of `Unreleased`.
- [ ] `README.md`, `docs/`, and screenshots describe the current behaviour.
- [ ] `python3 build.py` has been run.
- [ ] `git diff --exit-code -- index.html` passes.
- [ ] `index.html?selftest` reports `RESULT PASS`.
- [ ] The manual matrix in [TESTING.md](TESTING.md) has been checked for the affected areas.
- [ ] No secrets, tokens, personal data, or local paths were added.
- [ ] Third-party notices are current if a dependency changed.
- [ ] The working tree is clean.

## Build and verify

```bash
python3 build.py
git diff --exit-code -- index.html
python3 -m http.server 8000
# open http://localhost:8000/index.html?selftest
```

The build is deterministic: the same `src/` files produce the same `index.html`.

## Commit, tag, and push

```bash
git add -A
git commit -m "release: v1.2.3"
git tag -a v1.2.3 -m "CubeLab v1.2.3"
git push origin main --follow-tags
```

Do not force-push `main`. If a release is wrong, revert the commit or publish a follow-up
patch.

## Deploy

GitHub Pages serves the repository root from `main` (`.nojekyll` is present). A push to
`main` triggers the Pages build. The live site is:

<https://somphol.github.io/rubiks-cube/>

After the Pages workflow completes:

1. Open the live site.
2. Hard-refresh to bypass the cache.
3. Check the new behaviour and the self-test URL.
4. Confirm the deploy corresponds to the release commit.

## Release notes

Create a GitHub Release from the tag. Summarise the user-visible changes, link the
[CHANGELOG](../CHANGELOG.md), and call out breaking changes, known issues, and migration
notes. Do not paste the whole changelog if a short summary is clearer.

## Rollback

Because Pages serves `main`, the fastest rollback is a revert commit:

```bash
git revert <bad-commit>
git push origin main
```

For a broken generated file, rebuild from the last known-good `src/` and push. Avoid
editing `index.html` directly; the next build would overwrite it.

## Hotfix

1. Branch from `main`.
2. Make the smallest fix.
3. Rebuild and run the self-test.
4. Update `CHANGELOG.md`.
5. Open a pull request, merge, tag a patch release, and verify Pages.

## What not to do

- Do not edit `index.html` by hand.
- Do not add a backend, account system, analytics, or tracking to ship a release.
- Do not commit secrets, tokens, private keys, or local filesystem paths.
- Do not publish a release whose self-test fails.
- Do not force-push `main`.
