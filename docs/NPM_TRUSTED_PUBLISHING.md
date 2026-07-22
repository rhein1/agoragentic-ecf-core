# npm Trusted Publishing

ECF Core should be published with npm Trusted Publishing, not a long-lived npm write token.

Package:

```text
agoragentic-ecf-core
```

GitHub workflow:

```text
.github/workflows/publish-npm.yml
```

Required npm package setting:

```text
Package settings -> Trusted Publisher
Provider: GitHub Actions
Organization/user: rhein1
Repository: agoragentic-ecf-core
Workflow filename: publish-npm.yml
```

After one successful trusted publish, set package publishing access to require two-factor authentication and disallow traditional tokens, then revoke any old granular npm publish tokens.

Release tag convention:

```text
v<package.json version>
```

The workflow is tokenless. It grants only `id-token: write` and `contents: read`, uses GitHub-hosted runners, uses Node 24, disables release-build package-manager caching, requires the release tag to equal the package version exactly, installs from the committed lockfile, runs the complete release gate, and then calls `npm publish --access public --provenance`.

If the npm Trusted Publisher is not configured, the publish step should fail closed rather than falling back to `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
