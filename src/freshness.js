'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { classifyPath, shouldSkipDirectory } = require('./core/policy');
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const MAX_FILE = 2 * 1024 * 1024;
const MAX_TOTAL = 64 * 1024 * 1024;
const MAX_ENTRIES = 10000;
function readBounded(filename, max = MAX_FILE) {
  const initial = fs.lstatSync(filename);
  if (initial.isSymbolicLink()) fail('symlink_rejected');
  if (!initial.isFile() || initial.size > max) fail('file_limit');
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size > max) fail('file_limit');
    const buffer = Buffer.alloc(Math.min(max + 1, before.size + 1));
    let count = 0;
    while (count < buffer.length) {
      const n = fs.readSync(fd, buffer, count, buffer.length - count, null);
      if (!n) break;
      count += n;
    }
    const after = fs.fstatSync(fd);
    const current = fs.lstatSync(filename);
    if (count !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs || current.isSymbolicLink() || current.ino !== before.ino || current.dev !== before.dev) fail('file_changed_during_read');
    return buffer.subarray(0, count);
  } finally { fs.closeSync(fd); }
}
function directory(filename, create = false) {
  if (create && !fs.existsSync(filename)) fs.mkdirSync(filename, { mode: 0o700 });
  const stat = fs.lstatSync(filename);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('unsafe_directory');
  return fs.realpathSync(filename);
}
function captureSnapshot(projectRoot, config) {
  const root = directory(path.resolve(projectRoot));
  let entries = 0, total = 0;
  const files = [];
  const walk = (dir, prefix = '') => {
    const handle = fs.opendirSync(dir);
    try {
      for (;;) {
        const entry = handle.readSync(); if (!entry) break;
        if (++entries > MAX_ENTRIES) fail('inventory_limit');
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (relative.split('/').some(x => x === '.ecf-core' || x === '.micro-ecf') || shouldSkipDirectory(relative, config)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) fail('symlink_rejected');
        if (entry.isDirectory()) {
          if (fs.existsSync(path.join(full, '.git'))) continue;
          directory(full); walk(full, relative); continue;
        }
        if (!entry.isFile()) fail('non_regular_source');
        // Blocked and review-only source contents are never read to establish freshness.
        const classification = classifyPath(relative, config).classification;
        if (classification !== 'allowed' && relative !== 'ecf.config.json') continue;
        const bytes = readBounded(full);
        total += bytes.length;
        if (total > MAX_TOTAL) fail('total_byte_limit');
        files.push([relative, hash(bytes)]);
      }
    } finally { handle.closeSync(); }
  };
  walk(root);
  files.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const configHash = hash(JSON.stringify(config));
  return { workspace_hash: hash(root), config_hash: configHash, files,
    source_digest: hash(JSON.stringify(files)), digest: hash(JSON.stringify([hash(root), configHash, files])) };
}
function currentConfig(root) {
  const configFile = path.join(root, 'ecf.config.json');
  if (fs.existsSync(configFile)) readBounded(configFile, 65536);
  return require('./core/config').loadConfig({ projectRoot: root });
}
function compilerDigest() {
  const files = [];
  const walk = dir => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, item.name);
      if (item.isSymbolicLink()) fail('compiler_symlink');
      if (item.isDirectory()) walk(p);
      else if (item.isFile() && item.name.endsWith('.js')) files.push([path.relative(__dirname, p).replace(/\\/g, '/'), hash(readBounded(p))]);
      if (files.length > 2000) fail('compiler_limit');
    }
  };
  walk(__dirname);
  for (const name of ['package.json', 'package-lock.json']) {
    const p = path.join(__dirname, '..', name);
    if (fs.existsSync(p)) files.push([name, hash(readBounded(p))]);
  }
  files.sort((a, b) => a[0] < b[0] ? -1 : 1);
  return hash(JSON.stringify(files));
}
function generationArtifacts(dir) {
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'freshness.json') continue;
    if (!item.isFile() || !/^[a-z0-9-]+\.json$/.test(item.name)) fail('unexpected_artifact');
    if (files.length >= 32) fail('artifact_limit');
    files.push([item.name, hash(readBounded(path.join(dir, item.name), 8 * 1024 * 1024))]);
  }
  for (const name of ['context-packet.json', 'policy-summary.json', 'source-map.json']) if (!files.some(x => x[0] === name)) fail('missing_artifact');
  return files.sort((a,b) => a[0] < b[0] ? -1 : 1);
}
function atomicJson(filename, value) {
  const temp = `${filename}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  try { fs.renameSync(temp, filename); }
  catch (error) { fs.unlinkSync(temp); throw error; }
}
async function compileFresh(projectRoot, dependencies = {}) {
  const root = directory(path.resolve(projectRoot));
  const config = currentConfig(root);
  const before = captureSnapshot(root, config);
  const compiler = compilerDigest();
  const artifactRoot = path.join(root, '.ecf-core'); directory(artifactRoot, true);
  const generations = path.join(artifactRoot, 'fresh'); directory(generations, true);
  const lock = path.join(generations, '.lock');
  try { fs.mkdirSync(lock, { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') fail('refresh_locked'); throw error; }
  const generation = `gen-${randomUUID()}`;
  const outDir = path.join(generations, generation);
  try {
    directory(outDir, true);
    const compile = dependencies.compile || require('./compile').compileProject;
    await compile({ projectRoot: root, outDir, emitAgentOs: true });
    const after = captureSnapshot(root, currentConfig(root));
    if (before.digest !== after.digest || compiler !== compilerDigest()) fail('source_changed_during_compile');
    const artifacts = generationArtifacts(outDir);
    const seal = { schema_version: 'ecf-core.freshness.v1', generation, snapshot: after,
      compiler_digest: compiler, artifacts, created_at: new Date().toISOString(),
      compiler_mode: dependencies.compile ? 'injected_test_only' : 'ecf_core',
      host_consumption_verified: false };
    atomicJson(path.join(outDir, 'freshness.json'), seal);
    atomicJson(path.join(generations, 'current.json'), { generation, seal_hash: hash(readBounded(path.join(outDir, 'freshness.json'))) });
    return { state: dependencies.compile ? 'test_only' : 'fresh', generation, compiler_mode: seal.compiler_mode, host_consumption_verified: false };
  } finally { fs.rmdirSync(lock); }
}
function inspectFresh(projectRoot, { includeContext = false } = {}) {
  try {
    const root = directory(path.resolve(projectRoot));
    directory(path.join(root, '.ecf-core'));
    const generations = directory(path.join(root, '.ecf-core', 'fresh'));
    const pointer = JSON.parse(readBounded(path.join(generations, 'current.json'), 4096));
    if (!/^gen-[a-f0-9-]{36}$/.test(pointer.generation) || !/^[a-f0-9]{64}$/.test(pointer.seal_hash)) fail('invalid_generation');
    const outDir = directory(path.join(generations, pointer.generation));
    const bytes = readBounded(path.join(outDir, 'freshness.json'));
    if (hash(bytes) !== pointer.seal_hash) fail('seal_changed');
    const seal = JSON.parse(bytes);
    if (seal.schema_version !== 'ecf-core.freshness.v1' || seal.generation !== pointer.generation) fail('invalid_seal');
    if (seal.compiler_mode !== 'ecf_core') fail('test_generation_not_current_context');
    const snapshot = captureSnapshot(root, currentConfig(root));
    if (snapshot.digest !== seal.snapshot?.digest) return { state: 'stale', generation: seal.generation, reason: 'source_or_policy_changed', context: null };
    if (compilerDigest() !== seal.compiler_digest) return { state: 'stale', generation: seal.generation, reason: 'compiler_changed', context: null };
    if (JSON.stringify(generationArtifacts(outDir)) !== JSON.stringify(seal.artifacts)) fail('artifact_changed');
    const context = includeContext ? JSON.parse(readBounded(path.join(outDir, 'context-packet.json'), 8 * 1024 * 1024)) : undefined;
    // Recheck after reading; never serve a cached generation following detected drift.
    if (captureSnapshot(root, currentConfig(root)).digest !== snapshot.digest) fail('source_changed_during_read');
    if (hash(readBounded(path.join(outDir, 'context-packet.json'), 8 * 1024 * 1024)) !== seal.artifacts.find(x => x[0] === 'context-packet.json')[1]) fail('artifact_changed');
    return { state: 'fresh', generation: seal.generation, source_digest: snapshot.source_digest,
      host_consumption_verified: false, ...(includeContext ? { context } : {}) };
  } catch (error) {
    return { state: 'unknown', context: null, reason: /^[a-z_]+$/.test(error.code || '') ? error.code : 'freshness_unavailable' };
  }
}
module.exports = { readBounded, captureSnapshot, compileFresh, inspectFresh };
