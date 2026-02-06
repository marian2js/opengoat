# Contributing to OpenGoat

## Release Process

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

### How to Create a Release

1.  **Work as usual**: Make your changes in a feature branch.
2.  **Add a changeset**: Before merging, run `npm run changeset`.
    - This will prompt you to select the packages you are changing.
    - Select the version bump type (patch, minor, or major).
    - Write a summary of the changes. This will end up in the changelog.
3.  **Merge**: Merge your PR to `main`.
4.  **Automated Release**:
    - The GitHub Action "Release" will detect the changeset.
    - It will open a "Version Packages" PR that bumps the version in `package.json` and updates `CHANGELOG.md`.
    - When you merge that "Version Packages" PR, the action will automatically publish the new version to NPM and create a GitHub Release.

### Prerequisite

To publish to NPM, the repository needs the `NPM_TOKEN` secret configured in GitHub context.
