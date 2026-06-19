'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
    callMcpTool,
    compileProject,
    inspectAgentOsPreview,
} = require('../src');

const POLICY_SENTENCE = 'No customer PII leaves the repo.';
const ROOT_CONFIG_SECRET = 'sk-test-config-secret-do-not-leak';
const CODE_IMPORT_SECRET = 'sk-test-fake-import-secret-do-not-leak';

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function portablePath(filePath) {
    return String(filePath || '').replace(/\\/g, '/');
}

function makeFirstRunProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-core-adoption-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'private-connectors'), { recursive: true });
    fs.mkdirSync(path.join(root, '.micro-ecf'), { recursive: true });
    fs.writeFileSync(path.join(root, 'agent.js'), [
        `const riskyModule = require("${CODE_IMPORT_SECRET}");`,
        'export async function run(input) {',
        '  return { ok: true, input, riskyModule: Boolean(riskyModule) };',
        '}',
        '',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({
        apiKey: ROOT_CONFIG_SECRET,
        publicName: 'first-run fixture',
    }, null, 2));
    fs.writeFileSync(path.join(root, 'docs', 'policy.md'), [
        '# Policy',
        '',
        POLICY_SENTENCE,
        '',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'private-connectors', 'stripe.js'), [
        'export const stripeConnector = true;',
        '',
    ].join('\n'));
    fs.writeFileSync(path.join(root, '.env'), 'API_KEY=sk-test-fake-secret-do-not-leak\n');
    fs.writeFileSync(path.join(root, '.micro-ecf', 'context-packet.json'), JSON.stringify({
        generated: true,
        should_not_be_indexed: POLICY_SENTENCE,
    }, null, 2));
    return root;
}

test('first-run compile preserves policy text, indexes code, and blocks secrets by default', async () => {
    const root = makeFirstRunProject();
    const outDir = path.join(root, '.ecf-core');
    const result = await compileProject({ projectRoot: root, outDir, emitAgentOs: true });
    const artifactText = JSON.stringify({
        contextPacket: result.contextPacket,
        sourceMap: result.sourceMap,
        evidenceUnits: result.compileStageEvidenceUnits,
        pageIndex: result.pageIndex,
        treeIndex: result.treeIndex,
        sourceManifest: result.sourceManifest,
        codeIndex: result.codeIndex,
        contextRouter: result.contextRouter,
        manifest: result.manifest,
    });

    const configSource = result.contextPacket.sources.find((source) => source.path === 'config.json');
    assert.ok(configSource);
    assert.match(configSource.content_preview, /\[REDACTED\]/);
    assert.doesNotMatch(configSource.content_preview, new RegExp(escapeRegex(ROOT_CONFIG_SECRET)));

    assert.match(artifactText, new RegExp(escapeRegex(POLICY_SENTENCE)));
    assert.doesNotMatch(artifactText, new RegExp(`sk-test-fake-secret|${escapeRegex(CODE_IMPORT_SECRET)}|API_KEY|${escapeRegex(ROOT_CONFIG_SECRET)}`));
    assert.ok(result.sourceMap.sources.some((source) => source.path === '.env' && source.classification === 'blocked'));
    assert.ok(result.contextPacket.sources.some((source) => source.path === 'agent.js' && source.type === 'code'));
    const agentIndex = result.codeIndex.sources.find((source) => source.path === 'agent.js');
    assert.ok(agentIndex);
    assert.ok(agentIndex.symbols.some((symbol) => symbol.name === 'run'));
    assert.equal(agentIndex.imports.some((item) => item.includes('sk-test')), false);
    assert.ok(agentIndex.imports.includes('[REDACTED]'));
    assert.ok(result.sourceManifest.entries.some((entry) => entry.path === 'agent.js' && entry.included_in_context_packet));
    assert.ok(result.contextRouter.routes.some((route) => route.id === 'source_manifest_query'));
    assert.ok(result.sourceMap.sources.some((source) => source.path === 'private-connectors/stripe.js' && source.classification === 'review_required'));
    assert.ok(!result.contextPacket.sources.some((source) => source.path === 'private-connectors/stripe.js'));
    assert.ok(result.contextPacket.sources.some((source) => source.path === 'docs/policy.md'));
    assert.ok(result.contextPacket.sources.some((source) => source.path === 'docs/policy.md#policy'));
    assert.ok(!result.sourceMap.sources.some((source) => source.path.startsWith('.micro-ecf/')));
    assert.equal(result.manifest.counts.generated_sources_excluded > 0, true);
});
test('MCP search retrieves the first-run policy sentence with provenance', async () => {
    const root = makeFirstRunProject();
    const outDir = path.join(root, '.ecf-core');
    await compileProject({ projectRoot: root, outDir, emitAgentOs: true });

    const search = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.search_context',
        args: { query: POLICY_SENTENCE, top_k: 5 },
    });
    const hit = search.results.find((result) => result.path === 'docs/policy.md#policy' || result.path === 'docs/policy.md');
    assert.ok(hit);
    assert.match(hit.summary, new RegExp(escapeRegex(POLICY_SENTENCE)));

    const source = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.get_source',
        args: { path: hit.path },
    });
    assert.match(JSON.stringify(source), /docs\/policy\.md/);
    assert.match(JSON.stringify(source), new RegExp(escapeRegex(POLICY_SENTENCE)));

    const routed = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.route_query',
        args: { query: 'Where does it say customer PII cannot leave the repo?', top_k: 5 },
    });
    assert.equal(routed.route.id, 'policy_lookup');
    assert.match(JSON.stringify(routed.results), /docs\/policy\.md/);
    assert.match(JSON.stringify(routed.results), new RegExp(escapeRegex(POLICY_SENTENCE)));

    const blockedRoute = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.route_query',
        args: { query: 'What secrets are blocked?', top_k: 1 },
    });
    assert.equal(blockedRoute.route.id, 'policy_lookup');
    assert.equal(blockedRoute.results.length, 1);
    assert.equal(blockedRoute.results[0].path, '.env');
    assert.equal(blockedRoute.results[0].classification, 'blocked');
    assert.doesNotMatch(JSON.stringify(blockedRoute.results), /API_KEY|sk-test/);

    const exactRoute = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.route_query',
        args: { query: `"${POLICY_SENTENCE}"`, top_k: 5 },
    });
    assert.equal(exactRoute.route.id, 'exact_text_lookup');
    assert.ok(exactRoute.results.some((result) => result.path === 'docs/policy.md' || result.path === 'docs/policy.md#policy'));
    assert.ok(exactRoute.results.every((result) => JSON.stringify(result).includes(POLICY_SENTENCE)));

    const missingExactRoute = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.route_query',
        args: { query: '"No customer passport leaves the repo."', top_k: 5 },
    });
    assert.equal(missingExactRoute.route.id, 'exact_text_lookup');
    assert.deepEqual(missingExactRoute.results, []);

    const codeRoute = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.route_query',
        args: { query: 'What code files are indexed?', top_k: 1 },
    });
    assert.equal(codeRoute.route.id, 'code_symbol_lookup');
    assert.equal(codeRoute.results.length, 1);
    assert.ok(codeRoute.results.some((result) => result.path === 'agent.js'
        && result.symbols.some((symbol) => symbol.name === 'run')));

    const manifestRoute = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.route_query',
        args: { query: 'List source manifest entries', top_k: 1 },
    });
    assert.equal(manifestRoute.route.id, 'source_manifest_query');
    assert.equal(manifestRoute.results.length, 1);

    const countRoute = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.route_query',
        args: { query: 'How many generated ECF artifacts were excluded?', top_k: 5 },
    });
    assert.equal(countRoute.route.id, 'deterministic_stats');
    assert.equal(countRoute.results.length, 0);
    assert.equal(countRoute.stats.source_manifest.generated_sources_excluded > 0, true);
});

test('Agent OS preview off-ramp gives a real command and URL', async () => {
    const root = makeFirstRunProject();
    const outDir = path.join(root, '.ecf-core');
    await compileProject({ projectRoot: root, outDir, emitAgentOs: true });

    const report = inspectAgentOsPreview(outDir);
    assert.equal(report.ok, true);
    assert.match(report.next_step, /AGORAGENTIC_API_KEY=amk_/);
    assert.match(report.next_step, new RegExp(`npx -y agoragentic-os preview ${escapeRegex(portablePath(path.join(outDir, 'agent-os-import.json')))}`));
    assert.match(report.next_step_url, /^https:\/\/agoragentic\.com\/agent-os\/start/);
});

test('usage errors fail non-zero and package does not collide with Micro ECF bin', () => {
    const root = makeFirstRunProject();
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    const result = spawnSync(process.execPath, [cli, 'compile', root, '--config'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /--config requires a value/);

    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    assert.equal(Object.prototype.hasOwnProperty.call(pkg.bin, 'micro-ecf'), false);
});

test('README first screen is installable and MCP-ready without taxonomy overload', () => {
    const root = path.join(__dirname, '..');
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    const mcpDoc = fs.readFileSync(path.join(root, 'docs', 'MCP_SERVER.md'), 'utf8');
    const first25 = readme.split(/\r?\n/).slice(0, 25).join('\n');

    assert.match(first25, /npm install -g agoragentic-ecf-core|npx -y -p agoragentic-ecf-core/);
    assert.match(first25, /ecf-core serve-mcp \.ecf-core/);
    assert.equal((first25.match(/Full ECF|Triptych OS|Micro ECF/g) || []).length <= 1, true);
    assert.match(`${readme}\n${mcpDoc}`, /Claude Code/);
    assert.match(`${readme}\n${mcpDoc}`, /Cursor/);
    assert.match(`${readme}\n${mcpDoc}`, /mcpServers/);
    assert.doesNotMatch(`${readme}\n${mcpDoc}`, /WORKFLOW\.md|github\.com\/agoragentic/);
});

test('Agent OS schemas declare context-router artifact keys', () => {
    const root = path.join(__dirname, '..');
    const harness = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'agent-os-harness.schema.json'), 'utf8'));
    const handoff = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'agent-os-handoff.schema.json'), 'utf8'));
    const agentImport = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'agent-os-import.schema.json'), 'utf8'));

    for (const key of ['source_manifest', 'code_index', 'context_router']) {
        assert.ok(harness.properties.artifacts.properties[key], `harness artifacts missing ${key}`);
        assert.ok(handoff.properties[key], `handoff missing ${key}`);
        assert.ok(agentImport.properties.evidence.properties[key], `agent-os import evidence missing ${key}`);
    }
});
