# Contributing to OpenGoat

Thank you for considering contributing to OpenGoat! We appreciate your help in making this project better.

## How to Contribute

1. **Fork the Repository**: Create your own fork of the repo.
2. **Create a Branch**: Work on a feature branch (e.g., `feature/new-doc`).
3. **Make Changes**: Follow the guidelines below.
4. **Commit Your Changes**: Use clear commit messages.
5. **Open a Pull Request**: Describe your changes and link any related issues.

## Guidelines

- **Code Style**: Follow existing patterns. Run linters before committing.
- **Documentation**: Keep docs up-to-date with your changes.
- **Testing**: Add tests for new features.
- **Non-Code Contributions**: Welcome improvements to docs, README, templates, etc.

## Reporting Issues

Use GitHub Issues to report bugs or suggest features. Provide as much detail as possible.

## Release Process

We use **Changesets** for release notes and **CalVer** for versioning.

### Creating a Release

1. Make changes in a feature branch.
2. Run `npm run changeset` to add a changeset.
3. Merge to `main`.
4. The CI will handle versioning, changelog, and NPM publish.

### Prerequisites

- `NPM_TOKEN` secret in GitHub for publishing.

For questions, open an issue or contact the maintainers.
