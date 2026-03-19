# Contributing to IronFront / Territory Conquest

> **For repo maintainers:** Replace `ORIGINAL_OWNER` in this file and in issue/PR links with your GitHub username or organization (e.g. `https://github.com/yourname/IronFront`).

Thank you for your interest in contributing! This document explains how to get set up and submit changes so maintainers can review and merge your updates.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

- Be respectful and constructive in issues and pull requests.
- Focus on the code and ideas, not on people.

## Getting Started

1. **Fork the repository** on GitHub (click "Fork" at the top right).
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/IronFront.git
   cd IronFront
   ```
3. **Add the upstream repo** (optional, for syncing with the original):
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/IronFront.git
   ```

## Development Setup

1. Install **Node.js** (v16 or higher): https://nodejs.org/
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the game to verify everything works:
   ```bash
   npm start
   ```

See [RUN_INSTRUCTIONS.md](RUN_INSTRUCTIONS.md) for more detailed run instructions and troubleshooting.

## How to Contribute

- **Bug fixes**: Fix issues reported in the [Issues](https://github.com/ORIGINAL_OWNER/IronFront/issues) tab.
- **New features**: Open an issue first to discuss the idea, then implement and open a PR.
- **Documentation**: Improve README, comments, or add guides.
- **Polish**: UI/UX improvements, performance, or code quality.

## Pull Request Process

1. **Create a branch** from the default branch (usually `main` or `master`):
   ```bash
   git checkout -b your-feature-name
   ```
   Use a short, descriptive name (e.g. `fix-menu-crash`, `add-settings-menu`).

2. **Make your changes** and test with `npm start`.

3. **Commit** with a clear message:
   ```bash
   git add .
   git commit -m "Add settings menu for mouse sensitivity"
   ```

4. **Push** to your fork:
   ```bash
   git push origin your-feature-name
   ```

5. **Open a Pull Request** on GitHub:
   - Go to your fork and click "Compare & pull request".
   - Fill in the PR template (what changed, why, how to test).
   - Link any related issues (e.g. "Fixes #12").

6. **Address review feedback** if the maintainers request changes.

7. Once approved, a maintainer will merge your PR. Thank you!

### Tips

- Keep PRs focused (one feature or fix per PR when possible).
- Update the README or docs if you change how the game runs or what it does.
- If you add dependencies, add them to `package.json` with `npm install <package> --save` or `--save-dev` as appropriate.

## Reporting Bugs

Open an [Issue](https://github.com/ORIGINAL_OWNER/IronFront/issues) and include:

- **What happened** (e.g. game crashed when clicking Play Again).
- **What you expected** (e.g. game should restart).
- **Steps to reproduce** (e.g. 1. Start game 2. Win 3. Click Play Again).
- **Environment**: OS (Windows/macOS/Linux), Node version (`node --version`).

## Suggesting Features

Open an [Issue](https://github.com/ORIGINAL_OWNER/IronFront/issues) with the "Feature request" or similar label (if available), and describe:

- The feature and why it would be useful.
- How it might work (optional).
- Any alternatives you considered.

---

Again, thank you for contributing. Your updates help make this game better for everyone!
