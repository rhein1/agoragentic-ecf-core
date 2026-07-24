'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const checker = path.join(__dirname, '..', 'scripts', 'verify-doc-links.mjs');

function runFixture(readme, files = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-docs-links-'));
    fs.writeFileSync(path.join(root, 'README.md'), readme, 'utf8');
    for (const [relativePath, contents] of Object.entries(files)) {
        const absolute = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, contents, 'utf8');
    }
    const result = spawnSync(process.execPath, [checker], {
        cwd: root,
        encoding: 'utf8',
    });
    fs.rmSync(root, { recursive: true, force: true });
    return result;
}

test('documentation links accept balanced and escaped parentheses', () => {
    const result = runFixture(
        '[balanced](docs/foo_(bar).md)\n\n[escaped](docs/foo_\\(bar\\).md)\n',
        { 'docs/foo_(bar).md': '# Parentheses\n' },
    );

    assert.equal(result.status, 0, result.stderr);
});

test('documentation links keep shorter markers inside a longer fence', () => {
    const result = runFixture('````markdown\n```text\n[ignored](missing.md)\n```\n````\n');

    assert.equal(result.status, 0, result.stderr);
});

test('documentation links still reject missing targets', () => {
    const result = runFixture('[missing](missing.md)\n');

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing missing\.md/);
});
