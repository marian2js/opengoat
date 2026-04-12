# Desktop Releases

OpenGoat desktop releases are versioned from the root [`VERSION`](../VERSION) file.

## What ships

The desktop release workflow publishes:

- macOS desktop bundles for Apple Silicon as `.app` and `.dmg`
- Windows desktop installers as `.msi` and NSIS `.exe`

The workflow is defined in [`/.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml).

## How to cut a desktop release

Use GitHub Actions and run the `Desktop Release` workflow manually.

Inputs:

- `version`: release version without the `v` prefix, for example `2026.4.7`
- `prerelease`: set to `true` when publishing a prerelease

The workflow will:

1. Synchronize the repository version metadata to the requested release version
2. Commit the version bump as `chore(release): cut vX.Y.Z`
3. Create and push the `vX.Y.Z` tag
4. Create the GitHub release if it does not already exist
5. Build macOS and Windows desktop bundles
6. Upload the generated installers to that release

If the requested tag already exists, the manual workflow reuses that existing tag and GitHub release entry. That makes it possible to rebuild and replace assets for the same version when fixing signing or packaging problems.

The workflow also runs automatically on `v*` tag pushes. That makes it compatible with the existing Changesets-based npm release flow: once the npm release workflow tags a version, desktop artifacts are attached to the same GitHub release.

## Repository prerequisites

- GitHub Actions must have `Read and write permissions` so the workflow can push the release commit and tag with `GITHUB_TOKEN`
- If your default branch is protected, GitHub Actions must be allowed to push the automated `chore(release): cut vX.Y.Z` commit, or you should cut releases from an unprotected release branch
- Hosted runners must stay enabled for both `macos-latest` and `windows-latest`

## Signing

OpenGoat's current public macOS release path is unsigned. The release workflow explicitly uses `--no-sign` on macOS to avoid shipping Tauri's ad-hoc-signed bundles, which Gatekeeper can reject more harshly.

That means macOS users should still expect the normal unverified-app friction, such as right-click `Open` or the System Settings `Open Anyway` path. It does not provide Apple Developer ID verification or notarization.

Windows code-signing is still optional, but recommended for public distribution.
