# Contributing to OpenGoat

## Release Process

We use **Changesets** to gather release notes, but we release using **CalVer** (Date-based versioning, e.g., `YYYY.M.D`).

### How to Create a Release

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

### Prerequisite

To publish to NPM, the repository needs the `NPM_TOKEN` secret configured in GitHub context.
