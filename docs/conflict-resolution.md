# Merge conflict resolution playbook

Use this when GitHub says **"This branch has conflicts"**.

## Conflict prevention protocol (agent-owned)

This section defines what the agent must do to minimize conflict burden on you.

1. **Single integration branch policy**
   - Keep all agent changes on one named integration branch (`work`) unless explicitly told otherwise.
   - Do not create similarly named alternate branches.

2. **Small, linear change sets**
   - Prefer small commits that touch the minimum file set.
   - Avoid batching unrelated docs/UI/algorithm rewrites in one commit.

3. **Sync before editing hot files**
   - Before editing high-churn files (`harmonic-lab-new.html`, `src/app/main.js`, `src/ui/output-format.js`), sync/rebase against the current base branch tip.

4. **Conflict-surface reporting in each update**
   - Explicitly list files touched and why.
   - Call out overlap risk with known hot files.

5. **No "PR created" ambiguity**
   - Distinguish between:
     - "PR metadata created" (internal/tool record only), and
     - "GitHub PR created" (actual remote PR URL exists).

6. **If conflict risk rises, stop and split**
   - Pause large edits and split into independent, mergeable slices.
   - Land docs-only changes separately from runtime code changes.

These are process obligations on the agent, not actions required from you.


## GitHub mobile buttons: what they actually do

When you are viewing a pull request on GitHub mobile/web:

- **Update branch**: merges the base branch (for example `main`) into the PR branch.
  - This only refreshes the PR branch with latest base changes.
  - It does **not** create a new PR.
- **Create PR** / **Create pull request**: opens a new PR from the currently selected compare branch into a base branch.
- **Merge pull request**: merges an existing PR into the base branch.

If you tap **Update branch** and then see **Create PR**, that means you are now on a branch view/compare state where no PR currently exists for that exact branch pair.

## Recommended zero-guess tablet workflow

1. Open repository → **Pull requests**.
2. If PR exists, open it and use only:
   - **Update branch** (optional), then
   - **Merge pull request**.
3. If no PR exists:
   - open branch selector, pick the branch with latest commits,
   - tap **Contribute** / **Compare & pull request**,
   - tap **Create pull request**.
4. After merge, open **Actions** and confirm Pages deploy is green.

This avoids branch-hopping and reduces accidental merges from the wrong branch.

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
