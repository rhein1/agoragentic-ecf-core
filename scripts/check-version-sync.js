#!/usr/bin/env node
'use strict';

// Release guard: assert the package version is mirrored consistently across
// package.json, glama.json (both occurrences), and CITATION.cff, and that
// CITATION.cff's date-released matches the corresponding CHANGELOG.md entry.
// This prevents the metadata drift that previously left CITATION.cff and
// glama.json behind package.json between releases.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const pkg = JSON.parse(read('package.json'));
const expected = pkg.version;

if (!expected) {
  console.error('check-version-sync: package.json has no "version"');
  process.exit(1);
}

// glama.json: top-level version and every packages[].version
const glama = JSON.parse(read('glama.json'));
if (glama.version !== expected) {
  errors.push(`glama.json version "${glama.version}" != package.json "${expected}"`);
}
for (const [i, entry] of (glama.packages || []).entries()) {
  if (entry && entry.version !== expected) {
    errors.push(`glama.json packages[${i}].version "${entry.version}" != package.json "${expected}"`);
  }
}

// CITATION.cff: version and date-released (simple YAML line scan, no dep)
const cff = read('CITATION.cff');
const cffVersion = (cff.match(/^version:\s*"?([^"\r\n]+)"?/m) || [])[1];
if (cffVersion !== expected) {
  errors.push(`CITATION.cff version "${cffVersion}" != package.json "${expected}"`);
}
const cffDate = (cff.match(/^date-released:\s*"?([^"\r\n]+)"?/m) || [])[1];

// CHANGELOG.md: date for the current version's entry, e.g. "## [1.5.0] - 2026-06-18"
const changelog = read('CHANGELOG.md');
const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const changelogMatch = changelog.match(new RegExp(`^##\\s*\\[${escaped}\\]\\s*-\\s*([0-9]{4}-[0-9]{2}-[0-9]{2})`, 'm'));
if (!changelogMatch) {
  errors.push(`CHANGELOG.md has no entry for version ${expected}`);
} else if (cffDate !== changelogMatch[1]) {
  errors.push(`CITATION.cff date-released "${cffDate}" != CHANGELOG.md ${expected} date "${changelogMatch[1]}"`);
}

if (errors.length > 0) {
  console.error('check-version-sync: version/date metadata is out of sync:');
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log(`check-version-sync: version ${expected} is consistent across package.json, glama.json, and CITATION.cff.`);
