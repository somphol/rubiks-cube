# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Auto Solve** — a cinematic auto-solve button that scrambles a solved cube, runs the
  two-phase solver, and plays the full solution with a face-aware camera, a glow on the
  turning layer, and a slow-mo finish. Dragging the cube or pressing `Esc` hands the camera
  back without interrupting playback.
- **Step playback mode** — a fourth speed option that waits after every move. Click Next,
  press `Space`, or press `N` to advance one turn at a time, including during Auto Solve.
- Release-grade documentation set: contributing guide, code of conduct, security policy,
  changelog, issue/PR templates, `AGENTS.md`, `SUPPORT.md`, a docs index, architecture,
  testing, release, design, accessibility, browser support, performance, FAQ, and roadmap.
- A GitHub Actions build check that verifies `index.html` is regenerated from `src/`.
- A question issue template and documentation links in the issue chooser.
- A 1200 × 630 social preview card and Open Graph / Twitter metadata for link previews.
- README refresh with a consistent header, badges, and documentation index.
- `robots.txt` and `sitemap.xml` for the GitHub Pages site.

### Fixed

- Removed references to import/export and saved-state features that CubeLab does not have
  from `CONTRIBUTING.md`, `SECURITY.md`, and the pull request template.
- Replaced the personal email in `CODE_OF_CONDUCT.md` with the private reporting form and
  the maintainer's GitHub profile.
