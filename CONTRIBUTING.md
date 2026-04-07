# Contributing to OpenGoat

## Release Process

We use **Changesets** to gather release notes, but we release using **CalVer** (Date-based versioning, e.g., `YYYY.M.D`).

### Package Releases

1.  **Work as usual**: Make your changes in a feature branch.
2.  **Add a changeset**: Before merging, run `npm run changeset`.
    - This will prompt you to select the packages.
    - **Note**: The "major/minor/patch" selection is ignored for versioning (we always use the date), but the summary you write will go into the changelog.
3.  **Merge**: Merge your PR to `main`.
4.  **Automated Release**:
    - The GitHub Action "Release" will detect the changeset.
    - It will automatically:
      - Bump the version to `YYYY.M.D` (or `YYYY.M.D.patch` if same day).
      - Update `CHANGELOG.md`.
      - Publish to NPM.
      - Push the version commit and tag back to the repo.

### Desktop Releases

Desktop installers are published through the GitHub Actions workflow `Desktop Release`.

- Run it manually with a target version such as `2026.4.7`, or let it react automatically to a pushed `v2026.4.7` tag.
- The workflow synchronizes `VERSION`, package metadata, Tauri config, and Cargo workspace version before building desktop artifacts.
- It publishes macOS and Windows installers to the matching GitHub release.

See [`docs/releases.md`](docs/releases.md) for the desktop release workflow details and repository prerequisites.

### Prerequisite

To publish packages from GitHub Actions, npm trusted publishing must remain configured for this repository.
