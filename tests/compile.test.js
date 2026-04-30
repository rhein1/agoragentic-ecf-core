'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
    FilesystemAdapter,
    compileProject,
    validateCompiledArtifacts,
} = require('../src');
const { CustomKeywordAdapter } = require('../examples/custom-adapter/custom-keyword-adapter');

function makeProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-core-test-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules', 'ignored'), { recursive: true });
    fs.writeFileSync(path.join(root, 'README.md'), '# Test Project\n\nA local agent fixture.\n');
    fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '# Guide\n\nUse safe local context.\n');
    fs.writeFileSync(path.join(root, 'src', 'app.js'), 'export function run() { return "ok"; }\n');
    fs.writeFileSync(path.join(root, 'schema.sql'), 'CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, created_at TEXT);\n');
    fs.writeFileSync(path.join(root, 'openapi.yaml'), 'openapi: 3.1.0\npaths:\n  /agents:\n    get:\n      summary: List agents\n');
    fs.writeFileSync(path.join(root, 'mcp.json'), JSON.stringify({
        mcpServers: {
            local: { command: 'node', args: ['server.js'] },
        },
        tools: [{ name: 'search_context' }],
    }, null, 2));
    fs.writeFileSync(path.join(root, '.env'), 'SECRET=do-not-read\n');
    fs.writeFileSync(path.join(root, 'node_modules', 'ignored', 'index.js'), 'module.exports = "ignored";\n');
    fs.writeFileSync(path.join(root, 'ecf.config.json'), JSON.stringify({
        schema_version: 'ecf-core.local-config.v1',
        project_name: 'fixture',
        scope: 'local_project',
        allow: ['README.md', 'docs/**', 'src/**', 'schema.sql', 'openapi.yaml', 'mcp.json'],
        block: ['.env', 'node_modules/**'],
        tool_limits: {
            max_calls: 4,
            network_allowed: false,
            write_allowed: false,
        },
        handoff: {
            agent_os_preview_allowed: true,
            live_deploy_allowed: false,
        },
    }, null, 2));
    return root;
}

test('compileProject emits source map, context packet, policy summary, and handoff', async () => {
    const root = makeProject();
    const outDir = path.join(root, '.ecf-core');
    const result = await compileProject({ projectRoot: root, outDir, emitAgentOs: true });

    assert.equal(result.contextPacket.schema_version, 'ecf-core.context-packet.v1');
    assert.equal(result.sourceMap.schema_version, 'ecf-core.source-map.v1');
    assert.equal(result.policySummary.schema_version, 'ecf-core.policy-summary.v1');
    assert.equal(result.agentOsHandoff.schema_version, 'ecf-core.agent-os-handoff.v1');
    assert.equal(result.deploymentPreview.schema_version, 'ecf-core.deployment-preview.v1');
    assert.equal(result.agentOsHarness.schema_version, 'ecf-core.agent-os-harness.v1');
    assert.equal(result.agentOsImport.schema_version, 'ecf-core.agent-os-import.v1');
    assert.equal(result.agentOsHandoff.boundary.includes_wallet_or_settlement, false);
    assert.equal(result.agentOsHarness.boundary.includes_hosted_runtime, false);
    assert.equal(result.agentOsImport.live_deploy_allowed, false);

    const sourcePaths = result.contextPacket.sources.map((source) => source.path).sort();
    assert.ok(sourcePaths.includes('README.md'));
    assert.ok(sourcePaths.includes('README.md#test-project'));
    assert.ok(sourcePaths.includes('docs/guide.md#guide'));
    assert.ok(sourcePaths.includes('schema.sql#sqlite-schema-summary'));
    assert.ok(sourcePaths.includes('openapi.yaml#openapi-summary'));
    assert.ok(sourcePaths.includes('mcp.json#mcp-context-summary'));
    assert.equal(result.contextPacket.citations.length, result.contextPacket.sources.length);
    assert.ok(result.sourceMap.sources.some((source) => source.path === '.env' && source.classification === 'blocked'));
    assert.ok(!result.contextPacket.sources.some((source) => source.path.includes('node_modules')));

    const validation = validateCompiledArtifacts(outDir);
    assert.equal(validation.ok, true);
});

test('filesystem adapter returns deterministic source ids for the same paths', async () => {
    const root = makeProject();
    const adapter = new FilesystemAdapter();
    const first = await adapter.discover({
        projectRoot: root,
        config: require('../src').loadConfig({ projectRoot: root }),
    });
    const second = await adapter.discover({
        projectRoot: root,
        config: require('../src').loadConfig({ projectRoot: root }),
    });
    assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
});

test('CLI init compile and validate work without runtime dependencies', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-core-cli-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'README.md'), '# CLI Fixture\n');
    fs.writeFileSync(path.join(root, 'docs', 'note.md'), '# Note\n');

    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    execFileSync(process.execPath, [cli, 'init', root], { stdio: 'pipe' });
    const output = execFileSync(process.execPath, [cli, 'compile', root, '--json', '--agent-os'], { encoding: 'utf8' });
    const manifest = JSON.parse(output);
    assert.equal(manifest.schema_version, 'ecf-core.manifest.v1');
    assert.ok(manifest.counts.allowed_sources >= 2);

    const validation = execFileSync(process.execPath, [cli, 'validate', path.join(root, '.ecf-core')], { encoding: 'utf8' });
    assert.equal(JSON.parse(validation).ok, true);
});

test('CLI eval writes deterministic JSON and Markdown reports', () => {
    const root = makeProject();
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    const output = execFileSync(process.execPath, [cli, 'eval', root, '--json'], { encoding: 'utf8' });
    const summary = JSON.parse(output);

    assert.equal(summary.schema_version, 'ecf-core.eval-report.v1');
    assert.equal(summary.verdict, 'pass');
    assert.equal(summary.metrics.policy_block.pass, true);
    assert.equal(summary.metrics.citation_survival.coverage, 1);
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'eval-report.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'eval-report.md')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'agent-os-harness.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'deployment-preview.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'agent-os-import.json')));
});

test('custom adapters can extend context without changing core compiler', async () => {
    const root = makeProject();
    const result = await compileProject({
        projectRoot: root,
        emitAgentOs: true,
        adapters: [new CustomKeywordAdapter(['external user validation fixture'])],
    });

    const custom = result.contextPacket.sources.find((source) => source.type === 'custom_keyword');
    assert.ok(custom);
    assert.equal(custom.provenance.adapter, 'custom_keyword_adapter');
});

test('stable schema manifest lists every generated artifact contract', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'schema-manifest.json'), 'utf8'));
    const expected = [
        'ecf-core.context-packet.v1',
        'ecf-core.source-map.v1',
        'ecf-core.policy-summary.v1',
        'ecf-core.local-config.v1',
        'ecf-core.connector-adapter.v1',
        'ecf-core.agent-os-handoff.v1',
        'ecf-core.agent-os-harness.v1',
        'ecf-core.deployment-preview.v1',
        'ecf-core.eval-report.v1',
        'ecf-core.agent-os-import.v1',
    ];
    assert.equal(manifest.stability, 'stable');
    assert.deepEqual(manifest.schemas.sort(), expected.sort());
});

test('example project exercises docs sqlite openapi mcp and Agent OS import outputs', () => {
    const root = path.join(__dirname, '..', 'examples', 'local-project');
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    const output = execFileSync(process.execPath, [cli, 'eval', root, '--json'], { encoding: 'utf8' });
    const summary = JSON.parse(output);
    const contextPacket = JSON.parse(fs.readFileSync(path.join(root, '.ecf-core', 'context-packet.json'), 'utf8'));

    assert.equal(summary.verdict, 'pass');
    assert.ok(contextPacket.sources.some((source) => source.type === 'markdown_section'));
    assert.ok(contextPacket.sources.some((source) => source.type === 'sqlite_schema_summary'));
    assert.ok(contextPacket.sources.some((source) => source.type === 'openapi_summary'));
    assert.ok(contextPacket.sources.some((source) => source.type === 'mcp_context_summary'));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'agent-os-import.json')));

    fs.rmSync(path.join(root, '.ecf-core'), { recursive: true, force: true });
});
