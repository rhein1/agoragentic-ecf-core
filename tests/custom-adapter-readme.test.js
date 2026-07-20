'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('custom adapter README snippet executes as CommonJS', () => {
    const readme = fs.readFileSync(path.join(repoRoot, 'examples', 'custom-adapter', 'README.md'), 'utf8');
    const snippet = readme.match(/```js\r?\n([\s\S]*?)\r?\n```/);
    assert.ok(snippet, 'expected a JavaScript code block in the custom adapter README');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-custom-adapter-readme-'));
    try {
        fs.copyFileSync(
            path.join(repoRoot, 'examples', 'custom-adapter', 'custom-keyword-adapter.js'),
            path.join(root, 'custom-keyword-adapter.js'),
        );
        const packageDirectory = path.join(root, 'node_modules', 'agoragentic-ecf-core');
        fs.mkdirSync(path.dirname(packageDirectory), { recursive: true });
        fs.symlinkSync(repoRoot, packageDirectory, process.platform === 'win32' ? 'junction' : 'dir');
        fs.writeFileSync(path.join(root, 'example.js'), `${snippet[1]}\n`, 'utf8');

        const result = spawnSync(process.execPath, ['example.js'], {
            cwd: root,
            encoding: 'utf8',
        });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(fs.existsSync(path.join(root, '.ecf-core', 'agent-os-import.json')), true);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
