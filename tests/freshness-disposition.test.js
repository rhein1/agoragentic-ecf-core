'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { captureSnapshot, compileFresh, inspectFresh } = require('../src/freshness');
const { FilesystemAdapter, metadataDisposition } = require('../src/adapters/filesystem');
const config = { allow: ['*.md', '*.txt', '*.bin', '*.js', '*.json'], block: ['.env'], max_file_bytes: 65536 };
const digest = text => createHash('sha256').update(text).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-disposition-'));
  fs.writeFileSync(path.join(root, 'README.md'), '# Fixture\nLocal evidence.\n');
  fs.writeFileSync(path.join(root, 'ecf.config.json'), JSON.stringify(config));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
const records = root => new FilesystemAdapter().discover({ projectRoot: root, config });
function touch(file) {
  const before = fs.statSync(file);
  fs.utimesSync(file, before.atime, new Date(Math.trunc(before.mtimeMs) + 5000));
}
for (const [name, size, prefix] of [['binary.bin', 8, 'review'], ['oversized.txt', 65537, 'oversize']]) {
  test(`${name}: canonical metadata-only fingerprint and stale context refusal`, async t => {
    const root = fixture(t), file = path.join(root, name);
    fs.writeFileSync(file, Buffer.alloc(size, 65));
    const before = (await records(root)).find(r => r.path === name);
    assert.equal(before.classification, 'review_required');
    const stat = fs.statSync(file);
    assert.equal(before.hash, digest(`${prefix}:${name}:${stat.size}:${Math.trunc(stat.mtimeMs)}`));
    const snapshot = captureSnapshot(root, config);
    assert.equal(snapshot.files.some(r => r[0] === name), false);
    assert.equal(snapshot.restricted_inventory.find(r => r[0] === name)[5], before.hash);
    await compileFresh(root);
    assert.equal(inspectFresh(root, { includeContext: true }).state, 'fresh');
    touch(file);
    const after = (await records(root)).find(r => r.path === name);
    assert.notEqual(before.hash, after.hash);
    const read = inspectFresh(root, { includeContext: true });
    assert.equal(read.state, 'stale');
    assert.equal(read.context, null);
  });
}
test('binary and oversized content is not opened by snapshot or canonical adapter', async t => {
  const root = fixture(t);
  const restricted = ['binary.bin', 'oversized.txt', '.env'];
  for (const name of restricted) fs.writeFileSync(path.join(root, name), Buffer.alloc(name === 'oversized.txt' ? 65537 : 8, 65));
  const open = fs.openSync, read = fs.readFileSync;
  const check = file => assert.equal(restricted.includes(path.basename(String(file))), false, 'metadata-only content was opened');
  t.mock.method(fs, 'openSync', function (file, ...args) { check(file); return open.call(fs, file, ...args); });
  t.mock.method(fs, 'readFileSync', function (file, ...args) { check(file); return read.call(fs, file, ...args); });
  const snapshot = captureSnapshot(root, config), sourceRecords = await records(root);
  for (const entry of snapshot.restricted_inventory) {
    const canonical = sourceRecords.find(r => r.path === entry[0]);
    assert.equal(canonical.classification, entry[1]);
    assert.equal(canonical.reason, entry[2]);
    assert.equal(canonical.byte_count, entry[3]);
    assert.equal(canonical.hash, entry[5]);
  }
});
test('metadata-only oversized file above content-read ceiling is represented without allocation', async t => {
  const root = fixture(t), file = path.join(root, 'large.txt');
  const fd = fs.openSync(file, 'wx');
  try { fs.ftruncateSync(fd, 3 * 1024 * 1024); } finally { fs.closeSync(fd); }
  const snapshot = captureSnapshot(root, config);
  assert.equal(snapshot.restricted_inventory.find(r => r[0] === 'large.txt')[3], 3 * 1024 * 1024);
  await compileFresh(root);
  assert.equal(inspectFresh(root).state, 'fresh');
  touch(file);
  assert.equal(inspectFresh(root).state, 'stale');
});
test('restored timestamps detect edits only for content-hashed sources', t => {
  const root = fixture(t), text = path.join(root, 'small.txt'), binary = path.join(root, 'binary.bin');
  fs.writeFileSync(text, 'AAAA'); fs.writeFileSync(binary, 'AAAA');
  const timestamp = new Date('2026-01-01T00:00:00.000Z');
  fs.utimesSync(text, timestamp, timestamp); fs.utimesSync(binary, timestamp, timestamp);
  const before = captureSnapshot(root, config);
  fs.writeFileSync(binary, 'BBBB'); fs.utimesSync(binary, timestamp, timestamp);
  assert.equal(captureSnapshot(root, config).digest, before.digest, 'metadata-only content is intentionally not hashed');
  fs.writeFileSync(text, 'BBBB'); fs.utimesSync(text, timestamp, timestamp);
  assert.notEqual(captureSnapshot(root, config).digest, before.digest);
});
test('effective size threshold uses actual read length as well as initial stat', async t => {
  const root = fixture(t), file = path.join(root, 'small.txt'); fs.writeFileSync(file, 'AAAA');
  const stat = fs.statSync(file);
  assert.equal(metadataDisposition('small.txt', config, stat), null);
  assert.equal(metadataDisposition('small.txt', config, stat, 65537).classification, 'review_required');
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', function (filename, ...args) {
    return filename === file ? Buffer.alloc(65537, 65) : read.call(fs, filename, ...args);
  });
  const record = (await records(root)).find(r => r.path === 'small.txt');
  assert.equal(record.classification, 'review_required');
  assert.equal(record.content_preview, undefined);
});
test('configuration changes that alter effective disposition invalidate the snapshot', t => {
  const root = fixture(t), file = path.join(root, 'oversized.txt'); fs.writeFileSync(file, Buffer.alloc(65537, 65));
  const before = captureSnapshot(root, config);
  const after = captureSnapshot(root, { ...config, max_file_bytes: 100000 });
  assert.notEqual(before.digest, after.digest);
  assert.equal(before.files.some(r => r[0] === 'oversized.txt'), false);
  assert.equal(after.files.some(r => r[0] === 'oversized.txt'), true);
});
test('configuration remains independently content-hashed when source policy restricts it', t => {
  const root = fixture(t), file = path.join(root, 'ecf.config.json');
  const policy = { ...config, block: [...config.block, 'ecf.config.json'] };
  const before = captureSnapshot(root, policy);
  assert(before.files.some(r => r[0] === 'ecf.config.json'));
  assert(before.restricted_inventory.some(r => r[0] === 'ecf.config.json'));
  fs.writeFileSync(file, JSON.stringify({ ...config, project_name: 'changed' }));
  assert.notEqual(captureSnapshot(root, policy).digest, before.digest);
});
