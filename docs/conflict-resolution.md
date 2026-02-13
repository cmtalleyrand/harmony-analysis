# Merge conflict resolution playbook

Use this when GitHub says **"This branch has conflicts"**.

## 1) Fast check: is your local branch clean?

```bash
git status
rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .
```

- `git status` should show no uncommitted changes.
- `rg` should return no conflict markers.

## 2) Reproduce the conflict locally against target branch

Replace `main` with the actual PR base branch if different.

```bash
git fetch origin
git checkout work
git merge origin/main
```

- If Git reports conflicts, continue.
- If merge succeeds, commit the merge and push.

## 3) Resolve conflicts file-by-file

Check conflicted files:

```bash
git status --short
```

For each conflicted file, decide one of:

- Keep current branch version:
  ```bash
  git checkout --ours <file>
  ```
- Keep target branch version:
  ```bash
  git checkout --theirs <file>
  ```
- Manually combine both edits:
  - open file,
  - remove `<<<<<<<`, `=======`, `>>>>>>>`,
  - preserve intended behavior.

Then stage:

```bash
git add <file>
```

Repeat until `git status` has no unmerged paths.

## 4) Validate before committing

```bash
rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .
node --check src/app/main.js
node --check src/config/constants.js
node --check src/ui/output-format.js
```

## 5) Commit + push resolved merge

```bash
git commit -m "Resolve merge conflicts with main"
git push origin work
```

## 6) If GitHub still reports conflicts

Likely reasons:
- New commits landed on `main` after your resolution.
- PR base branch changed.

Re-run steps 2–5 against the latest base branch tip.


## Tablet-only (no terminal) path

Use this if you do not want CLI steps.

1. Open the repository in mobile browser or GitHub app.
2. Open the branch dropdown and switch to your working branch (for example `work`).
3. If GitHub shows conflicts on a PR, tap **Resolve conflicts** (if available).
4. If conflict editor is not available on your device, open `github.dev` by pressing `.` in the repo web view, switch to your branch, and resolve conflicts in-editor.
5. Commit the resolved files from the web editor.
6. Return to PR and merge.

### If there is no PR to open

No PR usually means your branch is not on GitHub yet. Without terminal, create a new branch directly in GitHub web editor (`github.dev`), commit there, and then tap **Create pull request** from GitHub UI.

### What repository Settings can do

- Can configure Pages deployment behavior.
- Cannot push local-only commits/branches from another machine/environment.
