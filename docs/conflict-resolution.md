# Merge and deployment workflow (main-only)

This repository is now managed as **main-only** on GitHub.

## What this means

- `main` is the only branch expected to exist.
- GitHub Pages deploys from pushes to `main`.
- There is no required PR/branch dance for normal updates.

## Tablet flow (no terminal)

1. Open the repo on GitHub mobile web/app.
2. Confirm branch selector shows `main`.
3. Make/edit files directly in GitHub web editor (`.` opens `github.dev`).
4. Commit directly to `main`.
5. Open **Actions** and wait for **Deploy static site to GitHub Pages** to turn green.
6. Reload the Pages site.

## If changes do not appear

1. Confirm latest commit is on `main`.
2. Confirm latest Pages workflow run succeeded.
3. Hard refresh the site (or use a private tab).

## Agent responsibility standard

- Keep changes small and focused.
- Avoid introducing extra branches unless explicitly requested.
- Do not claim a PR exists unless a real GitHub PR URL exists.
