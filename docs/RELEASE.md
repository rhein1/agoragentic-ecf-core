# Release Checklist

Use this checklist before any tagged release or package publication.

## Required Checks

```bash
npm ci
npm test
npm run check
npm run pack:dry
npm run release:dry
```

## Manual Review

- Bump the version in `package.json`, `glama.json` (both the top-level `version` and the `packages[].version`), and `CITATION.cff`, and set `CITATION.cff` `date-released` to the matching `CHANGELOG.md` entry date so the metadata never drifts. `npm run release:dry` asserts these versions agree.
- Confirm the README does not claim SOC 2, audit status, enterprise readiness, hosted Agent OS runtime, wallet settlement, or Full ECF internals.
- Confirm examples do not include secrets, private customer data, local databases, or generated `.ecf-core/` artifacts.
- Confirm `npm pack --dry-run` only includes public package files.
- Confirm the package can compile a clean local fixture.
- Confirm CI is green, including the `dotnet` workflow that compiles the shipped C# and runs the .NET safety-policy checks in `dotnet/tests/Agoragentic.EcfCore.Tests`.
- Confirm CodeQL scans both JavaScript/TypeScript and C# (`csharp`), and Dependabot covers npm, GitHub Actions, and NuGet for the shipped `dotnet/` projects.
- Confirm the Agent OS preview check passes on at least one fixture.

## Versioning

Use semantic versioning. See [Versioning And Compatibility](VERSIONING.md).

## Publishing Boundary

Publishing this package does not publish Agent OS, Router, marketplace, settlement, or Full ECF private infrastructure.

## Publish

After the release PR is reviewed, approved, and merged, create a GitHub release whose tag exactly matches `v<package.json version>`. The tokenless `publish-npm.yml` workflow verifies the tag, runs `npm ci` plus `npm run release:dry`, and publishes with npm provenance.

For 1.5.1, the exact tag is:

```bash
v1.5.1
```

Do not publish from a local npm token or create the tag before the reviewed release commit is on `main`.
