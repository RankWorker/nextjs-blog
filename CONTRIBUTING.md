# Contributing

Thanks for helping improve `@rankworker/nextjs-blog`.

## Setup

Use Node.js 20.9 or newer and npm:

```bash
npm install
npm run check
```

Keep public APIs server-first, typed, and composable. New behavior must include focused unit tests. Bug fixes should include a regression test. Avoid adding client components or browser JavaScript unless the feature cannot be implemented with semantic HTML and server components.

## Changesets

Any user-visible change needs a Changeset:

```bash
npm run changeset
```

Use patch releases for fixes, minor releases for backward-compatible features, and major releases for breaking changes. Explain consumer action for any migration.

## Pull requests

- Keep changes scoped and document public behavior.
- Preserve both RankWorker Direct API and local MDX modes.
- Do not weaken strict TypeScript, lint, package, or coverage checks.
- Never commit API keys, webhook secrets, or customer content.

## Releases

Maintainers prepare a release by running `npm run version-packages`, reviewing the resulting version and changelog changes, and merging those changes to `main`. Create and push a `v<package-version>` tag only after every required CI check succeeds on that exact commit.

The tag-triggered publish workflow verifies that the tag matches `package.json`, reruns the complete release checks, and publishes through npm trusted publishing with provenance. Configure the npm trusted publisher to match the `release.yml` workflow and its `npm` GitHub environment. Do not add a long-lived npm token to the repository.
