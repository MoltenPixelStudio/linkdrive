# Release secrets

`.github/workflows/release.yml` needs the following repository or organization
secrets configured at
`https://github.com/MoltenPixelStudio/linkdrive/settings/secrets/actions`:

| Secret | Purpose |
|---|---|
| `WINGET_PAT` | Classic PAT (public_repo scope). `winget-releaser` uses it to fork `microsoft/winget-pkgs`, push the manifest, and open a PR. |
| `SCOOP_BUCKET_PAT` | Classic PAT (repo scope). Used to push updates into `MoltenPixelStudio/scoop-bucket`. |
| `CHOCO_API_KEY` | Generated at https://community.chocolatey.org/account (free). Required by `choco push`. |

## One-time setup

1. **Create the Scoop bucket repo**: https://github.com/new → name it
   `scoop-bucket` under `MoltenPixelStudio`, public. Put `linkdrive.json` in
   a `bucket/` subdirectory before the first release run. Tell users:

       scoop bucket add mps https://github.com/MoltenPixelStudio/scoop-bucket
       scoop install linkdrive

2. **First Chocolatey submission is manual** — `choco pack`, inspect output,
   `choco push` locally. Moderator review happens on the first version;
   subsequent bumps auto-approve.

3. **Winget** first-time submission takes 1–2 hours after the PR is opened
   by `winget-releaser`. Watch the PR for any validation comments.

## Triggering a release

Tag and push: `git tag v0.2.0 && git push origin v0.2.0`. The workflow runs
the build, uploads the exe, computes SHA256, then fans out to the three
publish jobs. Any missing secret causes only that job to fail; others still
ship.
