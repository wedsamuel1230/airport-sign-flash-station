---
name: airport-sign-flash-cicd
description: Use when releasing the airport sign GitHub Pages flashing station, generating a merged ESP-IDF image, bundling it for the web flasher, committing release changes, or publishing the repository with gh.
---

# Airport sign flash CI/CD

Use this skill for the `github-pages` project. It produces one deterministic initial-flash artifact and publishes the static Pages site.

## Release pipeline

1. Confirm the ESP-IDF project is at `../esp-idf-mvp` and the target is ESP32-S3.
2. Source the configured ESP-IDF export script and run `idf.py -B build-idf602 merge-bin`.
3. Copy `build-idf602/merged-binary.bin` to `firmware/airport-display.bin`.
4. Check that the artifact is non-empty and is a merged image; never substitute an app-only binary.
5. Run `node --check flasher.js` and serve the site locally for a smoke check.
6. Commit the site and firmware with a descriptive message.
7. Use `gh auth status`; create the repository with `gh repo create airport-sign-flash-station --public --source=. --remote=origin --push` when no remote exists.
8. Enable Pages through the committed `.github/workflows/pages.yml`; report the Actions and Pages URLs from `gh repo view`.

Stop if the build fails, the merged artifact is missing, `gh` is unauthenticated, or a remote points at a different repository. Preserve unrelated changes in the ESP-IDF checkout.

## Required checks

- The browser flasher writes the merged image at address `0x0` after a full erase.
- `firmware/airport-display.bin` is committed with the release.
- The workflow deploys the repository root with `actions/deploy-pages`.
- Physical USB flashing remains an operator check; do not claim it passed from static validation.
