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
