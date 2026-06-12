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

function makeFirstRunProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-core-adoption-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(root, '.micro-ecf'), { recursive: true });
    fs.writeFileSync(path.join(root, 'agent.js'), [
        'export async function run(input) {',
        '  return { ok: true, input };',
        '}',
        '',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'docs', 'policy.md'), [
        '# Policy',
        '',
        POLICY_SENTENCE,
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
        manifest: result.manifest,
    });

    assert.match(artifactText, new RegExp(POLICY_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(artifactText, /sk-test-fake-secret|API_KEY/);
    assert.ok(result.sourceMap.sources.some((source) => source.path === '.env' && source.classification === 'blocked'));
    assert.ok(result.contextPacket.sources.some((source) => source.path === 'agent.js' && source.type === 'code'));
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
    assert.match(hit.summary, new RegExp(POLICY_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    const source = callMcpTool({
        artifactDir: outDir,
        name: 'ecf_core.get_source',
        args: { path: hit.path },
    });
    assert.match(JSON.stringify(source), /docs\/policy\.md/);
    assert.match(JSON.stringify(source), new RegExp(POLICY_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Agent OS preview off-ramp gives a real command and URL', async () => {
    const root = makeFirstRunProject();
    const outDir = path.join(root, '.ecf-core');
    await compileProject({ projectRoot: root, outDir, emitAgentOs: true });

    const report = inspectAgentOsPreview(outDir);
    assert.equal(report.ok, true);
    assert.match(report.next_step, /AGORAGENTIC_API_KEY=amk_/);
    assert.match(report.next_step, /npx -y agoragentic-os preview \.ecf-core\/agent-os-import\.json/);
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
