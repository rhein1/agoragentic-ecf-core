'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
    FilesystemAdapter,
    compileProject,
    loadConfig,
    rankRecords,
    validateCompiledArtifacts,
} = require('../src');
const { walkFiles } = require('../src/adapters/filesystem');
const { CustomKeywordAdapter } = require('../examples/custom-adapter/custom-keyword-adapter');

function makeProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-core-test-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules', 'ignored'), { recursive: true });
    fs.writeFileSync(path.join(root, 'README.md'), '# Test Project\n\nA local agent fixture.\n');
    fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '# Guide\n\nUse safe local context.\n');
    fs.writeFileSync(path.join(root, 'docs', 'billing.md'), '# Billing\n\nPayment disputes are reviewed by the billing owner.\n');
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
    assert.equal(result.compileStageEvidenceUnits.schema_version, 'ecf-core.evidence-units.v1');
    assert.equal(result.evidenceUnits.schema_version, 'ecf-core.context-evidence-units.v1');
    assert.equal(result.compactionReport.schema_version, 'ecf-core.context-compaction-report.v1');
    assert.equal(result.pageIndex.schema_version, 'ecf-core.page-index.v1');
    assert.equal(result.treeIndex.schema_version, 'ecf-core.tree-index.v1');
    assert.equal(result.retrievalPlan.schema_version, 'ecf-core.retrieval-plan.v1');
    assert.equal(result.agentOsHandoff.schema_version, 'ecf-core.agent-os-handoff.v1');
    assert.equal(result.deploymentPreview.schema_version, 'ecf-core.deployment-preview.v1');
    assert.equal(result.agentOsHarness.schema_version, 'ecf-core.agent-os-harness.v1');
    assert.equal(result.agentOsImport.schema_version, 'ecf-core.agent-os-import.v1');
    assert.equal(result.agentOsHandoff.boundary.includes_wallet_or_settlement, false);
    assert.equal(result.agentOsHarness.boundary.includes_hosted_runtime, false);
    assert.equal(result.agentOsImport.live_deploy_allowed, false);
    assert.equal(result.agentOsImport.evidence.evidence_units, 'evidence-units.json');
    assert.equal(result.agentOsImport.evidence.context_evidence_units, 'context-evidence-units.json');
    assert.equal(result.agentOsImport.evidence.context_compaction_report, 'context-compaction-report.json');
    assert.equal(result.agentOsImport.evidence.page_index, 'page-index.json');
    assert.equal(result.agentOsImport.evidence.tree_index, 'tree-index.json');
    assert.equal(result.agentOsImport.required_files.includes('page-index.json'), true);
    assert.equal(result.agentOsImport.required_files.includes('tree-index.json'), true);
    assert.equal(result.agentOsImport.required_files.includes('evidence-units.json'), true);
    assert.equal(result.agentOsImport.context_compile_readiness.context_compile_verdict, 'preview_ready');
    assert.equal(result.deploymentPreview.context_compile_readiness.evidence_units, result.compileStageEvidenceUnits.units.length);
    assert.equal(result.agentOsHandoff.page_index, 'page-index.json');
    assert.equal(result.agentOsHandoff.evidence_units, 'evidence-units.json');

    const sourcePaths = result.contextPacket.sources.map((source) => source.path).sort();
    assert.ok(sourcePaths.includes('README.md'));
    assert.ok(sourcePaths.includes('README.md#test-project'));
    assert.ok(sourcePaths.includes('docs/guide.md#guide'));
    assert.ok(sourcePaths.includes('schema.sql#sqlite-schema-summary'));
    assert.ok(sourcePaths.includes('openapi.yaml#openapi-summary'));
    assert.ok(sourcePaths.includes('mcp.json#mcp-context-summary'));
    assert.equal(result.contextPacket.citations.length, result.contextPacket.sources.length);
    assert.equal(result.compileStageEvidenceUnits.units.length, result.contextPacket.sources.length);
    assert.ok(result.compileStageEvidenceUnits.units.every((unit) => unit.source_hash));
    assert.ok(result.compileStageEvidenceUnits.units.every((unit) => Array.isArray(unit.tags)));
    assert.ok(result.compileStageEvidenceUnits.units.every((unit) => Array.isArray(unit.entities)));
    assert.equal(result.evidenceUnits.units.length, result.contextPacket.sources.length);
    assert.ok(result.evidenceUnits.units.every((unit) => unit.policy.live_deploy_allowed === false));
    assert.ok(result.evidenceUnits.units.every((unit) => unit.citations.length > 0));
    assert.equal(result.compactionReport.dependency_status, 'baseline_only');
    assert.equal(result.compactionReport.citation_survival, 1);
    assert.ok(result.treeIndex.nodes.some((node) => node.type === 'section' && node.heading === 'Billing'));
    assert.ok(!result.pageIndex.sources.some((source) => source.path === '.env'));
    assert.ok(!result.treeIndex.nodes.some((node) => node.source_path === '.env'));
    const billingNode = result.treeIndex.nodes.find((node) => node.source_path === 'docs/billing.md#billing');
    assert.equal(billingNode.policy_flags.allowed_for_agent, true);
    assert.equal(billingNode.policy_flags.live_deploy_allowed, false);
    assert.equal(result.deploymentPreview.artifacts.page_index, 'page-index.json');
    assert.equal(result.deploymentPreview.context_index_readiness.tree_node_count, result.treeIndex.summary.node_count);
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

test('default walker skips generated logs temp folders and nested dependencies', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecf-core-walk-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'logs', 'reports'), { recursive: true });
    fs.mkdirSync(path.join(root, '.tmp', 'codex_ecf'), { recursive: true });
    fs.mkdirSync(path.join(root, 'packages', 'sample', 'node_modules', 'dep'), { recursive: true });
    fs.mkdirSync(path.join(root, '.venv', 'Lib'), { recursive: true });
    fs.mkdirSync(path.join(root, 'vendor', 'nested-repo', '.git'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '# Guide\n');
    fs.writeFileSync(path.join(root, 'logs', 'reports', 'stale.md'), '# Stale report\n');
    fs.writeFileSync(path.join(root, '.tmp', 'codex_ecf', 'index.json'), '{}\n');
    fs.writeFileSync(path.join(root, 'packages', 'sample', 'node_modules', 'dep', 'README.md'), '# Dep\n');
    fs.writeFileSync(path.join(root, '.venv', 'Lib', 'module.py'), 'print("ignore")\n');
    fs.writeFileSync(path.join(root, 'vendor', 'nested-repo', 'README.md'), '# Nested repo\n');

    const config = loadConfig({ projectRoot: root });
    const paths = walkFiles(root, config).map((fullPath) => path.relative(root, fullPath).replace(/\\/g, '/'));

    assert.deepEqual(paths, ['docs/guide.md']);
});

test('compileProject shares one file inventory with adapters', async () => {
    const root = makeProject();
    class InventoryCheckingAdapter extends CustomKeywordAdapter {
        async discover(input) {
            assert.equal(Array.isArray(input.fileInventory), true);
            assert.ok(input.fileInventory.length > 0);
            return super.discover(input);
        }
    }

    const result = await compileProject({
        projectRoot: root,
        emitAgentOs: true,
        adapters: [new InventoryCheckingAdapter(['shared inventory fixture'])],
    });
    assert.ok(result.records.some((record) => record.type === 'custom_keyword'));
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

test('CLI resident status and context pack expose compiled local context without hosted authority', () => {
    const root = makeProject();
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    execFileSync(process.execPath, [cli, 'compile', root, '--agent-os'], { stdio: 'pipe' });

    const status = JSON.parse(execFileSync(process.execPath, [cli, 'status', root, '--write'], { encoding: 'utf8' }));
    assert.equal(status.schema_version, 'ecf-core.resident-status.v1');
    assert.equal(status.ok, true);
    assert.equal(status.resident_state, 'ready');
    assert.equal(status.authority_boundary.local_only, true);
    assert.equal(status.authority_boundary.no_spend, true);
    assert.equal(status.authority_boundary.no_deploy, true);
    assert.equal(status.authority_boundary.no_x402_settlement, true);
    assert.equal(status.authority_boundary.full_ecf_private_internals_included, false);
    assert.ok(status.mcp.tools.includes('ecf_core.status'));
    assert.ok(status.mcp.tools.includes('ecf_core.context_pack'));
    assert.ok(status.mcp.tools.includes('ecf_core.worklog_status'));
    assert.ok(status.mcp.tools.includes('ecf_core.handoff'));
    assert.ok(status.mcp.tools.includes('ecf_core.work_memory'));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'resident-status.json')));

    const pack = JSON.parse(execFileSync(process.execPath, [
        cli,
        'context-pack',
        root,
        '--task',
        'inspect current session',
        '--write',
    ], { encoding: 'utf8' }));
    assert.equal(pack.schema_version, 'ecf-core.context-pack.v1');
    assert.equal(pack.ok, true);
    assert.equal(pack.task, 'inspect current session');
    assert.equal(pack.authority_boundary.no_wallet_mutation, true);
    assert.equal(pack.authority_boundary.no_marketplace_publication, true);
    assert.equal(pack.summary.source_counts.allowed_sources > 0, true);
    assert.equal(pack.summary.live_deploy_allowed, false);
    assert.ok(pack.assistant_bootstrap.read_order.includes('ecf.config.json'));
    assert.ok(pack.assistant_bootstrap.read_order.includes('.ecf-core/worklog/latest-summary.md'));
    assert.ok(pack.assistant_bootstrap.refresh_commands.includes('ecf-core docs-sync plan .'));
    assert.ok(pack.assistant_bootstrap.refresh_commands.includes('ecf-core handoff . --write'));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'context-pack.json')));

    const codexHome = path.join(root, 'codex-home');
    const mcpConfig = JSON.parse(execFileSync(process.execPath, [
        cli,
        'mcp-config',
        '--target',
        'codex',
        root,
        '--write',
        '--codex-home',
        codexHome,
        '--server-name',
        'test_ecf_core',
    ], { encoding: 'utf8' }));
    assert.equal(mcpConfig.schema_version, 'ecf-core.mcp-config.v1');
    assert.equal(mcpConfig.server_name, 'test_ecf_core');
    assert.match(mcpConfig.toml, /\[mcp_servers\.test_ecf_core\]/);
    assert.match(mcpConfig.toml, /serve-mcp/);
    assert.equal(mcpConfig.codex_config_updated, false);
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'codex-mcp.toml')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'CODEX_MCP_INSTALL.md')));

    const installedConfig = JSON.parse(execFileSync(process.execPath, [
        cli,
        'mcp-config',
        '--target',
        'codex',
        root,
        '--install-codex',
        '--codex-home',
        codexHome,
        '--server-name',
        'test_ecf_core',
    ], { encoding: 'utf8' }));
    assert.equal(installedConfig.codex_config_updated, true);
    const codexConfig = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    assert.match(codexConfig, /BEGIN ECF Core resident test_ecf_core/);
    assert.match(codexConfig, /\[mcp_servers\.test_ecf_core\]/);
    assert.match(codexConfig, /ecf-core\.js/);
});

test('CLI worklog docs-sync and handoff persist local-only resident work memory', () => {
    const root = makeProject();
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    execFileSync(process.execPath, [cli, 'compile', root, '--agent-os'], { stdio: 'pipe' });

    const begin = JSON.parse(execFileSync(process.execPath, [
        cli,
        'worklog',
        'begin',
        root,
        '--goal',
        'Add resident work memory',
        '--json',
    ], { encoding: 'utf8' }));
    assert.equal(begin.ok, true);
    assert.equal(begin.current.schema_version, 'ecf-core.worklog-current.v1');
    assert.equal(begin.current.authority_boundary.local_only, true);
    assert.equal(begin.current.authority_boundary.wallet_mutation_enabled, false);
    assert.equal(begin.current.authority_boundary.x402_settlement_enabled, false);
    assert.equal(begin.current.authority_boundary.hosted_runtime_enabled, false);
    assert.equal(begin.current.authority_boundary.full_ecf_private_internals_included, false);

    const checkpoint = JSON.parse(execFileSync(process.execPath, [
        cli,
        'worklog',
        'checkpoint',
        root,
        '--summary',
        'Wired CLI commands',
        '--files',
        'bin/ecf-core.js,src/work-memory.js',
        '--validation',
        'node --check src/work-memory.js',
        '--json',
    ], { encoding: 'utf8' }));
    assert.equal(checkpoint.checkpoint.schema_version, 'ecf-core.worklog-checkpoint.v1');
    assert.ok(checkpoint.current.changed_files.includes('src/work-memory.js'));

    const finished = JSON.parse(execFileSync(process.execPath, [
        cli,
        'worklog',
        'finish',
        root,
        '--summary',
        'Resident work memory shipped',
        '--commit',
        'abc1234',
        '--tests',
        'npm test',
        '--unfinished',
        'Full ECF resident manager',
        '--next-prompt',
        'Implement private Full ECF resident workspace manager',
        '--json',
    ], { encoding: 'utf8' }));
    assert.equal(finished.finished.schema_version, 'ecf-core.worklog-finished.v1');
    assert.equal(finished.finished.status, 'finished');
    assert.ok(finished.finished.validation.includes('npm test'));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'worklog', 'latest-summary.md')));

    const docsPlan = JSON.parse(execFileSync(process.execPath, [
        cli,
        'docs-sync',
        'plan',
        root,
        '--json',
    ], { encoding: 'utf8' }));
    assert.equal(docsPlan.schema_version, 'ecf-core.docs-sync-plan.v1');
    assert.equal(docsPlan.auto_edit_enabled, false);
    assert.equal(docsPlan.authority_boundary.deploy_enabled, false);
    assert.ok(docsPlan.recommended_updates.some((item) => item.path === 'README.md'));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'docs-sync-plan.json')));

    const handoff = JSON.parse(execFileSync(process.execPath, [
        cli,
        'handoff',
        root,
        '--write',
        '--json',
    ], { encoding: 'utf8' }));
    assert.equal(handoff.schema_version, 'ecf-core.handoff.v1');
    assert.equal(handoff.work.next_prompt, 'Implement private Full ECF resident workspace manager');
    assert.ok(handoff.read_order.includes('.ecf-core/worklog/latest-summary.md'));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'handoff.md')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'handoff.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'next-session.md')));

    const status = JSON.parse(execFileSync(process.execPath, [
        cli,
        'worklog',
        'status',
        root,
        '--json',
    ], { encoding: 'utf8' }));
    assert.equal(status.schema_version, 'ecf-core.worklog-status.v1');
    assert.equal(status.active, false);
    assert.equal(status.history_count >= 3, true);
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
    assert.equal(summary.metrics.retrieval_preservation.ranking_mode, 'semantic_lite');
    assert.equal(summary.metrics.compression_experiment.dependency_status, 'baseline_only');
    assert.equal(summary.metrics.compression_experiment.verdict, 'pass');
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'eval-report.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'eval-report.md')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'agent-os-harness.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'deployment-preview.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'agent-os-import.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'evidence-units.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'context-evidence-units.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'context-compaction-report.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'page-index.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'tree-index.json')));
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'retrieval-plan.json')));
    assert.equal(summary.metrics.context_evidence_units.evidence_unit_count > 0, true);
    assert.equal(summary.metrics.context_evidence_units.file, 'evidence-units.json');
    assert.equal(summary.metrics.context_evidence_units.legacy_file, 'context-evidence-units.json');
    assert.equal(summary.metrics.compile_stage.evidence_unit_count > 0, true);
    assert.equal(summary.metrics.compile_stage.blocked_source_exclusion, true);
    assert.equal(summary.metrics.compile_stage.context_compile_verdict, 'preview_ready');
    assert.equal(summary.metrics.context_evidence_units.citation_survival, 1);
    assert.equal(summary.metrics.context_index.tree_node_count > 0, true);
    assert.equal(summary.metrics.context_index.dependency_status, 'builtin_local_only');

    const preview = execFileSync(process.execPath, [cli, 'agent-os-preview', path.join(root, '.ecf-core'), '--json'], { encoding: 'utf8' });
    const previewCheck = JSON.parse(preview);
    assert.equal(previewCheck.ok, true);
    assert.equal(previewCheck.context_compile_readiness.context_compile_verdict, 'preview_ready');
    assert.equal(previewCheck.context_index_readiness.tree_node_count > 0, true);
});

test('missing context index provider configuration still emits local index artifacts', async () => {
    const root = makeProject();
    const configPath = path.join(root, 'ecf.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.context_index_providers = [];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await compileProject({ projectRoot: root, outDir: path.join(root, '.ecf-core'), emitAgentOs: true });
    assert.deepEqual(result.pageIndex.providers, []);
    assert.equal(result.pageIndex.dependency_status, 'builtin_local_only');
    assert.equal(result.treeIndex.summary.node_count > 0, true);
    assert.equal(result.agentOsImport.required_files.includes('retrieval-plan.json'), true);
});

test('optional ranking providers remain dependency-free and bounded', () => {
    const root = makeProject();
    const configPath = path.join(root, 'ecf.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.eval = {
        queries: ['billing payment'],
        top_k: 3,
        ranking: {
            provider: 'local_vector',
            dimensions: 32,
        },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    let output = execFileSync(process.execPath, [cli, 'eval', root, '--json'], { encoding: 'utf8' });
    let summary = JSON.parse(output);
    assert.equal(summary.metrics.retrieval_preservation.ranking_mode, 'local_vector');
    assert.equal(summary.metrics.retrieval_preservation.ranking_dependency_status, 'builtin');

    config.eval.ranking = {
        provider: 'qdrant',
        precomputed_results: {
            'billing payment': ['docs/billing.md#billing', 'docs/billing.md'],
        },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    output = execFileSync(process.execPath, [cli, 'eval', root, '--json'], { encoding: 'utf8' });
    summary = JSON.parse(output);
    assert.equal(summary.metrics.retrieval_preservation.ranking_mode, 'qdrant');
    assert.equal(summary.metrics.retrieval_preservation.ranking_dependency_status, 'qdrant_adapter_configured');

    config.eval.ranking = { provider: 'chroma' };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    output = execFileSync(process.execPath, [cli, 'eval', root, '--json'], { encoding: 'utf8' });
    summary = JSON.parse(output);
    assert.equal(summary.metrics.retrieval_preservation.ranking_mode, 'chroma_fallback_semantic_lite');
    assert.equal(summary.metrics.retrieval_preservation.ranking_dependency_status, 'chroma_adapter_skipped');

    const hits = rankRecords([
        { id: 'a', path: 'docs/a.md', summary: 'wallet budget receipts' },
        { id: 'b', path: 'docs/b.md', summary: 'policy boundary citations' },
    ], 'receipt budget', 1, { provider: 'local_vector' });
    assert.equal(hits.ranking_mode, 'local_vector');
    assert.equal(hits.hits[0].id, 'a');
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
        'ecf-core.agent-os-preview-check.v1',
        'ecf-core.grounding-eval.v1',
        'ecf-core.evidence-units.v1',
        'ecf-core.context-evidence-units.v1',
        'ecf-core.context-compaction-report.v1',
        'ecf-core.page-index.v1',
        'ecf-core.tree-index.v1',
        'ecf-core.retrieval-plan.v1',
    ];
    assert.equal(manifest.stability, 'stable');
    assert.deepEqual(manifest.schemas.sort(), expected.sort());
});

test('public package keeps durable handoff and workflow examples', () => {
    const root = path.join(__dirname, '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const ecfHandoff = fs.readFileSync(path.join(root, 'ECF.md'), 'utf8');
    const workflowIndex = fs.readFileSync(path.join(root, 'examples', 'workflows', 'README.md'), 'utf8');
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    const boundary = fs.readFileSync(path.join(root, 'docs', 'BOUNDARY.md'), 'utf8');
    const imagesDoc = fs.readFileSync(path.join(root, 'docs', 'IMAGES.md'), 'utf8');
    const mcpDoc = fs.readFileSync(path.join(root, 'docs', 'MCP_SERVER.md'), 'utf8');
    const codexMcpDoc = fs.readFileSync(path.join(root, 'docs', 'CODEX_MCP.md'), 'utf8');
    const residentMemoryDoc = fs.readFileSync(path.join(root, 'docs', 'RESIDENT_WORK_MEMORY.md'), 'utf8');
    const evidenceUnitsDoc = fs.readFileSync(path.join(root, 'docs', 'EVIDENCE_UNITS.md'), 'utf8');
    const importerExample = fs.readFileSync(path.join(root, 'examples', 'importers', 'agent-os-import-consumer.example.json'), 'utf8');

    assert.ok(pkg.files.includes('ECF.md'));
    assert.ok(fs.existsSync(path.join(root, 'docs', 'images', 'ecf-core-hero.gif')));
    assert.match(ecfHandoff, /Required Disclosure/);
    assert.match(ecfHandoff, /Consent-Gated Setup/);
    assert.match(ecfHandoff, /agent-os-import\.json/);
    assert.match(ecfHandoff, /support@agoragentic\.com/);
    assert.match(readme, /support@agoragentic\.com/);
    assert.match(readme, /docs\/images\/ecf-core-hero\.gif/);
    assert.match(readme, /not a self-serve public SKU/);
    assert.match(boundary, /contact path only/i);
    assert.match(imagesDoc, /ecf-core-hero\.gif/);
    assert.match(mcpDoc, /ecf_core\.search_context/);
    assert.match(mcpDoc, /ecf-core mcp-config --target codex/);
    assert.match(codexMcpDoc, /Resident MCP for Codex/);
    assert.match(codexMcpDoc, /ecf_core\.context_pack/);
    assert.match(residentMemoryDoc, /worklog begin/);
    assert.match(residentMemoryDoc, /docs-sync plan/);
    assert.match(residentMemoryDoc, /handoff --write/);
    assert.match(residentMemoryDoc, /does not auto-edit docs/i);
    assert.match(evidenceUnitsDoc, /Context Evidence Units/);
    assert.match(evidenceUnitsDoc, /live_deploy_allowed/);
    assert.match(readme, /docs\/EVIDENCE_UNITS\.md/);
    assert.match(importerExample, /preview_only/);
    assert.match(workflowIndex, /IDE Coding Agent Context Check/);
    assert.match(workflowIndex, /Grounded Docs Agent Readiness/);
    assert.match(workflowIndex, /Agent OS Preview Handoff/);
});

test('dotnet lane is artifact-compatible and keeps the public ECF boundary', () => {
    const root = path.join(__dirname, '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const dotnetReadme = fs.readFileSync(path.join(root, 'dotnet', 'README.md'), 'utf8');
    const dotnetDocs = fs.readFileSync(path.join(root, 'docs', 'DOTNET.md'), 'utf8');
    const coreModels = fs.readFileSync(path.join(root, 'dotnet', 'src', 'Agoragentic.EcfCore', 'Artifacts', 'ArtifactModels.cs'), 'utf8');
    const safetyPolicy = fs.readFileSync(path.join(root, 'dotnet', 'src', 'Agoragentic.EcfCore.DotNet', 'Policy', 'DotNetSafetyPolicy.cs'), 'utf8');
    const compiler = fs.readFileSync(path.join(root, 'dotnet', 'src', 'Agoragentic.EcfCore.DotNet', 'DotNetContextCompiler.cs'), 'utf8');
    const cli = fs.readFileSync(path.join(root, 'dotnet', 'src', 'Agoragentic.EcfCore.Cli', 'Program.cs'), 'utf8');

    assert.ok(pkg.files.includes('dotnet/'));
    assert.ok(fs.existsSync(path.join(root, 'dotnet', 'src', 'Agoragentic.EcfCore', 'Agoragentic.EcfCore.csproj')));
    assert.ok(fs.existsSync(path.join(root, 'dotnet', 'src', 'Agoragentic.EcfCore.DotNet', 'Agoragentic.EcfCore.DotNet.csproj')));
    assert.ok(fs.existsSync(path.join(root, 'dotnet', 'src', 'Agoragentic.EcfCore.Cli', 'Agoragentic.EcfCore.Cli.csproj')));
    assert.ok(fs.existsSync(path.join(root, 'dotnet', 'examples', 'AspNetMinimalApi', 'Program.cs')));
    assert.ok(fs.existsSync(path.join(root, 'dotnet', 'examples', 'EfCoreApp', 'Data', 'AppDbContext.cs')));

    assert.match(dotnetReadme, /not Full ECF/i);
    assert.match(dotnetReadme, /preview-only/i);
    assert.match(dotnetDocs, /does not deploy agents/i);
    assert.match(dotnetDocs, /does not handle wallets/i);
    assert.match(dotnetDocs, /does not run x402 execution/i);
    assert.match(dotnetDocs, /does not route marketplace calls/i);
    assert.match(dotnetDocs, /does not include Full ECF private internals/i);

    assert.match(coreModels, /ecf-core\.context-packet\.v1/);
    assert.match(coreModels, /ecf-core\.manifest\.v1/);
    assert.match(coreModels, /ecf-core\.agent-os-handoff\.v1/);
    assert.match(coreModels, /ecf-core\.agent-os-import\.v1/);
    assert.match(coreModels, /LiveDeployAllowed/);
    assert.match(compiler, /LiveDeployAllowed = false/);
    assert.match(compiler, /ImportMode = "preview_only"/);
    assert.match(compiler, /RequiredFiles = requiredFiles/);
    assert.match(compiler, /AcceptanceChecks = acceptanceChecks/);
    assert.match(compiler, /review-required records were kept out of context-packet\.json/);
    assert.doesNotMatch(compiler, /allowed\.Concat\(reviewRequired\)/);
    assert.match(compiler, /DotNetSafetyPolicy\.DefaultBlockedPatterns/);

    for (const pattern of ['bin/**', 'obj/**', '.vs/**', '*.pfx', '*.snk', '*.publishsettings']) {
        assert.match(safetyPolicy, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const key of ['ConnectionStrings', 'ClientSecret', 'ApiKey', 'PrivateKey', 'AzureWebJobsStorage', 'OpenAI']) {
        assert.match(safetyPolicy, new RegExp(key));
    }

    for (const command of ['"init"', '"compile"', '"eval"', '"validate"', '"export"']) {
        assert.match(cli, new RegExp(command));
    }
});

test('grounding eval grounds supported queries and fails closed for unsupported context', () => {
    const root = makeProject();
    const config = JSON.parse(fs.readFileSync(path.join(root, 'ecf.config.json'), 'utf8'));
    config.eval = {
        queries: ['safe local context'],
        grounding_queries: [
            {
                question: 'How are refund disputes handled? billing payment',
                expected_sources: ['docs/billing.md#billing'],
            },
            'Can the agent read payment refunds?',
        ],
        top_k: 3,
        max_retries: 1,
        rewrite_enabled: true,
        grounding_required: true,
        unsupported_response: "I don't know based on the allowed context.",
    };
    fs.writeFileSync(path.join(root, 'ecf.config.json'), JSON.stringify(config, null, 2));
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    const output = execFileSync(process.execPath, [cli, 'eval', root, '--json', '--grounding'], { encoding: 'utf8' });
    const summary = JSON.parse(output);
    const grounding = JSON.parse(fs.readFileSync(path.join(root, '.ecf-core', 'grounding-eval.json'), 'utf8'));

    assert.equal(summary.metrics.grounding_eval.verdict, 'warn');
    assert.equal(summary.metrics.compile_stage.grounding_pass_rate, 0.5);
    assert.equal(grounding.summary.grounded, 1);
    assert.equal(grounding.summary.unsupported, 1);
    assert.equal(grounding.questions[0].status, 'grounded');
    assert.equal(grounding.questions[0].citations.includes('docs/billing.md#billing'), true);
    assert.equal(grounding.questions[0].tree_node_paths.includes('docs/billing.md#billing'), true);
    assert.equal(grounding.questions[1].status, 'unsupported');
    assert.equal(grounding.questions[1].final_response, "I don't know based on the allowed context.");
    assert.equal(grounding.questions[1].retries, 1);
    assert.ok(fs.existsSync(path.join(root, '.ecf-core', 'grounding-eval.md')));

    const preview = JSON.parse(execFileSync(process.execPath, [cli, 'agent-os-preview', path.join(root, '.ecf-core'), '--json'], { encoding: 'utf8' }));
    assert.equal(preview.ok, true);
    assert.equal(preview.grounding_eval.verdict, 'warn');
    assert.equal(preview.context_compile_readiness.grounded_queries, '1/2');
    assert.equal(preview.context_index_readiness.unsupported_questions.length, 1);

    const validation = validateCompiledArtifacts(path.join(root, '.ecf-core'));
    assert.equal(validation.ok, true);
});

test('grounding eval blocks queries aimed at blocked sources and enforces max retries', () => {
    const root = makeProject();
    const config = JSON.parse(fs.readFileSync(path.join(root, 'ecf.config.json'), 'utf8'));
    config.eval = {
        queries: ['env secret'],
        grounding_queries: ['What does .env say about secrets?'],
        top_k: 2,
        max_retries: 0,
        rewrite_enabled: true,
        grounding_required: true,
    };
    fs.writeFileSync(path.join(root, 'ecf.config.json'), JSON.stringify(config, null, 2));
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    execFileSync(process.execPath, [cli, 'eval', root, '--grounding'], { stdio: 'pipe' });
    const grounding = JSON.parse(fs.readFileSync(path.join(root, '.ecf-core', 'grounding-eval.json'), 'utf8'));

    assert.equal(grounding.summary.blocked, 1);
    assert.equal(grounding.questions[0].status, 'blocked');
    assert.equal(grounding.questions[0].attempts[0].retrieved_paths.includes('.env'), false);
    assert.equal(grounding.questions[0].retries, 0);
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

test('real-world examples compile and keep preview imports bounded', () => {
    const examples = [
        path.join(__dirname, '..', 'examples', 'real-world', 'docs-knowledge-base'),
        path.join(__dirname, '..', 'examples', 'real-world', 'api-service'),
        path.join(__dirname, '..', 'examples', 'real-world', 'sqlite-app'),
    ];
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');

    for (const root of examples) {
        const output = execFileSync(process.execPath, [cli, 'eval', root, '--json'], { encoding: 'utf8' });
        const summary = JSON.parse(output);
        assert.equal(summary.verdict, 'pass');
        assert.equal(summary.metrics.compression_experiment.dependency_status, 'baseline_only');

        const preview = JSON.parse(execFileSync(process.execPath, [cli, 'agent-os-preview', path.join(root, '.ecf-core'), '--json'], { encoding: 'utf8' }));
        assert.equal(preview.ok, true);
        assert.equal(preview.live_deploy_allowed, false);
        assert.equal(preview.boundary_safe, true);
        fs.rmSync(path.join(root, '.ecf-core'), { recursive: true, force: true });
    }
});

test('local MCP server exposes read-only compiled context tools', () => {
    const root = makeProject();
    const cli = path.join(__dirname, '..', 'bin', 'ecf-core.js');
    execFileSync(process.execPath, [cli, 'compile', root, '--agent-os'], { stdio: 'pipe' });
    execFileSync(process.execPath, [cli, 'worklog', 'begin', root, '--goal', 'MCP resident memory'], { stdio: 'pipe' });
    execFileSync(process.execPath, [cli, 'worklog', 'checkpoint', root, '--summary', 'MCP checkpoint'], { stdio: 'pipe' });
    execFileSync(process.execPath, [cli, 'handoff', root, '--write'], { stdio: 'pipe' });
    const requests = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'ecf_core.search_context',
                arguments: { query: 'billing payment', top_k: 2 },
            },
        },
        {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'ecf_core.get_policy',
                arguments: {},
            },
        },
        {
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: {
                name: 'ecf_core.status',
                arguments: {},
            },
        },
        {
            jsonrpc: '2.0',
            id: 6,
            method: 'tools/call',
            params: {
                name: 'ecf_core.context_pack',
                arguments: { task: 'mcp context' },
            },
        },
        {
            jsonrpc: '2.0',
            id: 7,
            method: 'tools/call',
            params: {
                name: 'ecf_core.worklog_status',
                arguments: {},
            },
        },
        {
            jsonrpc: '2.0',
            id: 8,
            method: 'tools/call',
            params: {
                name: 'ecf_core.handoff',
                arguments: {},
            },
        },
        {
            jsonrpc: '2.0',
            id: 9,
            method: 'tools/call',
            params: {
                name: 'ecf_core.work_memory',
                arguments: {},
            },
        },
    ].map((item) => JSON.stringify(item)).join('\n');
    const result = spawnSync(process.execPath, [cli, 'serve-mcp', path.join(root, '.ecf-core')], {
        input: `${requests}\n`,
        encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    const responses = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(responses[0].result.serverInfo.name, 'agoragentic-ecf-core');
    assert.ok(responses[1].result.tools.some((tool) => tool.name === 'ecf_core.search_context'));
    assert.ok(responses[1].result.tools.some((tool) => tool.name === 'ecf_core.status'));
    assert.ok(responses[1].result.tools.some((tool) => tool.name === 'ecf_core.context_pack'));
    assert.ok(responses[1].result.tools.some((tool) => tool.name === 'ecf_core.worklog_status'));
    assert.ok(responses[1].result.tools.some((tool) => tool.name === 'ecf_core.handoff'));
    assert.ok(responses[1].result.tools.some((tool) => tool.name === 'ecf_core.work_memory'));
    const searchPayload = JSON.parse(responses[2].result.content[0].text);
    assert.equal(searchPayload.boundary.read_only, true);
    assert.equal(searchPayload.boundary.live_deploy_allowed, false);
    assert.equal(searchPayload.boundary.includes_wallet_or_settlement, false);
    assert.ok(searchPayload.results.some((item) => item.path.includes('billing')));
    const policyPayload = JSON.parse(responses[3].result.content[0].text);
    assert.equal(policyPayload.boundary.hosted_runtime, false);
    assert.equal(policyPayload.boundary.full_ecf_private_internals, false);
    const statusPayload = JSON.parse(responses[4].result.content[0].text);
    assert.equal(statusPayload.resident_state, 'ready');
    assert.equal(statusPayload.authority_boundary.no_cloud_call, true);
    const packPayload = JSON.parse(responses[5].result.content[0].text);
    assert.equal(packPayload.task, 'mcp context');
    assert.equal(packPayload.summary.live_deploy_allowed, false);
    const worklogPayload = JSON.parse(responses[6].result.content[0].text);
    assert.equal(worklogPayload.schema_version, 'ecf-core.worklog-status.v1');
    assert.equal(worklogPayload.active, true);
    const handoffPayload = JSON.parse(responses[7].result.content[0].text);
    assert.equal(handoffPayload.schema_version, 'ecf-core.handoff.v1');
    assert.equal(handoffPayload.work.goal, 'MCP resident memory');
    const memoryPayload = JSON.parse(responses[8].result.content[0].text);
    assert.equal(memoryPayload.schema_version, 'ecf-core.work-memory.v1');
    assert.equal(memoryPayload.authority_boundary.local_only, true);
});
