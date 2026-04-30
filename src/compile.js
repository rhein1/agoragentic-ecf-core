'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AdapterRegistry } = require('./adapters/base');
const { FilesystemAdapter } = require('./adapters/filesystem');
const { MarkdownDocsAdapter } = require('./adapters/markdown-docs');
const { McpContextProviderAdapter } = require('./adapters/mcp-context');
const { OpenApiAdapter } = require('./adapters/openapi');
const { SqliteSummaryAdapter } = require('./adapters/sqlite-summary');
const { loadConfig } = require('./core/config');
const { sha256 } = require('./core/hash');

function nowIso() {
    return new Date().toISOString();
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relativeArtifact(projectRoot, outDir, fileName) {
    return path.relative(projectRoot, path.join(outDir, fileName)).replace(/\\/g, '/');
}

function buildPolicySummary(config) {
    return {
        schema_version: 'ecf-core.policy-summary.v1',
        allowed_sources: config.allow,
        blocked_sources: config.block,
        tool_limits: config.tool_limits,
        handoff: config.handoff,
    };
}

function baseBoundary() {
    return {
        includes_hosted_runtime: false,
        includes_wallet_or_settlement: false,
        includes_full_ecf_private_internals: false,
        includes_marketplace_routing: false,
    };
}

function buildReadinessChecks({ contextPacket, sourceMap, config }) {
    const sourceIds = new Set(contextPacket.sources.map((source) => source.id));
    const citationIds = new Set(contextPacket.citations.map((citation) => citation.source_id));
    const missingCitationIds = [...sourceIds].filter((id) => !citationIds.has(id));
    const blockedInPacket = contextPacket.sources.filter((source) => (
        sourceMap.sources.some((mapped) => mapped.id === source.id && mapped.classification === 'blocked')
    ));
    return [
        {
            id: 'no_spend_or_settlement',
            status: 'pass',
            detail: 'ECF Core exports are preview-only and do not authorize wallet, x402, or settlement actions.',
        },
        {
            id: 'live_deploy_disabled',
            status: config.handoff.live_deploy_allowed === false ? 'pass' : 'fail',
            detail: 'ECF Core can prepare Agent OS preview artifacts, but live deploy remains disabled.',
        },
        {
            id: 'citation_coverage',
            status: missingCitationIds.length === 0 ? 'pass' : 'warn',
            detail: `${contextPacket.citations.length}/${contextPacket.sources.length} sources have citations.`,
            missing_source_ids: missingCitationIds,
        },
        {
            id: 'blocked_sources_excluded',
            status: blockedInPacket.length === 0 ? 'pass' : 'fail',
            detail: `${blockedInPacket.length} blocked sources appeared in the context packet.`,
            blocked_source_ids: blockedInPacket.map((source) => source.id),
        },
    ];
}

function buildDeploymentPreview({ contextPacket, sourceMap, config }) {
    const checks = buildReadinessChecks({ contextPacket, sourceMap, config });
    return {
        schema_version: 'ecf-core.deployment-preview.v1',
        mode: 'agent_os_preview',
        live_deploy_allowed: false,
        checks,
        artifacts: {
            context_packet: 'context-packet.json',
            source_map: 'source-map.json',
            policy_summary: 'policy-summary.json',
        },
        next_step: checks.every((check) => check.status !== 'fail')
            ? 'review_agent_os_preview'
            : 'fix_failed_checks_before_preview',
    };
}

function buildAgentOsHarness({ deploymentPreview }) {
    return {
        schema_version: 'ecf-core.agent-os-harness.v1',
        generated_by: 'ecf-core',
        context_layer: 'ecf_core',
        artifacts: {
            context_packet: 'context-packet.json',
            source_map: 'source-map.json',
            policy_summary: 'policy-summary.json',
            deployment_preview: 'deployment-preview.json',
        },
        boundary: baseBoundary(),
        readiness: {
            live_deploy_allowed: false,
            checks: deploymentPreview.checks,
        },
        agent_os_preview: {
            allowed: deploymentPreview.checks.every((check) => check.status !== 'fail'),
            requires_user_review: true,
        },
    };
}

function buildAgentOsImport({ deploymentPreview }) {
    return {
        schema_version: 'ecf-core.agent-os-import.v1',
        import_mode: 'preview_only',
        live_deploy_allowed: false,
        required_files: [
            'context-packet.json',
            'source-map.json',
            'policy-summary.json',
            'deployment-preview.json',
            'agent-os-harness.json',
            'agent-os-handoff.json',
        ],
        acceptance_checks: deploymentPreview.checks.map((check) => ({
            id: check.id,
            required_status: check.id === 'citation_coverage' ? ['pass', 'warn'] : ['pass'],
        })),
        boundary: baseBoundary(),
        next_step: 'agent_os_preview_import',
    };
}

function buildAgentOsHandoff({ contextPacketPath, sourceMapPath, policySummaryPath, deploymentPreviewPath, agentOsHarnessPath, config }) {
    return {
        schema_version: 'ecf-core.agent-os-handoff.v1',
        context_packet: contextPacketPath,
        source_map: sourceMapPath,
        policy_summary: policySummaryPath,
        deployment_preview: deploymentPreviewPath,
        agent_os_harness: agentOsHarnessPath,
        agent_os_preview: {
            allowed: Boolean(config.handoff.agent_os_preview_allowed),
            live_deploy_allowed: false,
            recommended_next_step: 'review_in_agent_os_preview',
        },
        boundary: baseBoundary(),
    };
}

function validateSchemaVersion(value, expected, fileName, errors) {
    if (!value || value.schema_version !== expected) {
        errors.push(`${fileName} missing schema_version=${expected}`);
    }
}

function readJsonIfPresent(filePath, errors) {
    if (!fs.existsSync(filePath)) {
        errors.push(`${filePath} does not exist`);
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        errors.push(`${filePath} is not valid JSON: ${error.message}`);
        return null;
    }
}

function validateCompiledArtifacts(artifactDir) {
    const errors = [];
    const contextPacket = readJsonIfPresent(path.join(artifactDir, 'context-packet.json'), errors);
    const sourceMap = readJsonIfPresent(path.join(artifactDir, 'source-map.json'), errors);
    const policySummary = readJsonIfPresent(path.join(artifactDir, 'policy-summary.json'), errors);

    validateSchemaVersion(contextPacket, 'ecf-core.context-packet.v1', 'context-packet.json', errors);
    validateSchemaVersion(sourceMap, 'ecf-core.source-map.v1', 'source-map.json', errors);
    validateSchemaVersion(policySummary, 'ecf-core.policy-summary.v1', 'policy-summary.json', errors);

    if (contextPacket && !Array.isArray(contextPacket.sources)) errors.push('context-packet.json sources must be an array');
    if (contextPacket && !Array.isArray(contextPacket.citations)) errors.push('context-packet.json citations must be an array');
    if (sourceMap && !Array.isArray(sourceMap.sources)) errors.push('source-map.json sources must be an array');
    if (policySummary && !Array.isArray(policySummary.allowed_sources)) errors.push('policy-summary.json allowed_sources must be an array');
    if (policySummary && !Array.isArray(policySummary.blocked_sources)) errors.push('policy-summary.json blocked_sources must be an array');

    return {
        ok: errors.length === 0,
        artifact_dir: artifactDir,
        errors,
    };
}

async function compileProject(options = {}) {
    const projectRoot = path.resolve(options.projectRoot || '.');
    const outDir = path.resolve(options.outDir || path.join(projectRoot, '.ecf-core'));
    const config = loadConfig({ projectRoot, configPath: options.configPath });
    const createdAt = nowIso();

    const registry = new AdapterRegistry();
    registry.register(new FilesystemAdapter());
    registry.register(new MarkdownDocsAdapter());
    registry.register(new SqliteSummaryAdapter());
    registry.register(new OpenApiAdapter());
    registry.register(new McpContextProviderAdapter());
    for (const adapter of options.adapters || []) registry.register(adapter);

    const records = await registry.discoverAll({ projectRoot, config });
    const allowed = records.filter((record) => record.classification === 'allowed');
    const blocked = records.filter((record) => record.classification === 'blocked');
    const reviewRequired = records.filter((record) => record.classification === 'review_required');

    const sources = allowed.map((record) => ({
        id: record.id,
        path: record.path,
        type: record.type,
        hash: record.hash,
        summary: record.summary,
        byte_count: record.byte_count,
        line_count: record.line_count,
        provenance: record.provenance,
    }));

    const citations = allowed.map((record, index) => ({
        source_id: record.id,
        label: `[${index + 1}] ${record.path}`,
        path: record.path,
        heading: record.heading || null,
    }));

    const packetHash = sha256(`${config.project_name}:${allowed.map((record) => `${record.path}:${record.hash}`).join('|')}`);
    const contextPacket = {
        schema_version: 'ecf-core.context-packet.v1',
        packet_id: `ctx_${packetHash.slice(0, 16)}`,
        scope: config.scope,
        created_at: createdAt,
        sources,
        citations,
        policy: {
            allowed_context: config.allow,
            blocked_context: config.block,
            tool_limits: config.tool_limits,
            handoff: config.handoff,
        },
    };

    const sourceMap = {
        schema_version: 'ecf-core.source-map.v1',
        sources: records.map((record) => ({
            id: record.id,
            path: record.path,
            hash: record.hash,
            classification: record.classification,
            reason: record.reason,
            type: record.type,
            provenance: record.provenance,
        })),
    };

    const policySummary = buildPolicySummary(config);

    const contextPacketPath = path.join(outDir, 'context-packet.json');
    const sourceMapPath = path.join(outDir, 'source-map.json');
    const policySummaryPath = path.join(outDir, 'policy-summary.json');
    writeJson(contextPacketPath, contextPacket);
    writeJson(sourceMapPath, sourceMap);
    writeJson(policySummaryPath, policySummary);

    let agentOsHandoff = null;
    let deploymentPreview = null;
    let agentOsHarness = null;
    let agentOsImport = null;
    if (options.emitAgentOs) {
        deploymentPreview = buildDeploymentPreview({ contextPacket, sourceMap, config });
        agentOsHarness = buildAgentOsHarness({ deploymentPreview });
        agentOsImport = buildAgentOsImport({ deploymentPreview });
        writeJson(path.join(outDir, 'deployment-preview.json'), deploymentPreview);
        writeJson(path.join(outDir, 'agent-os-harness.json'), agentOsHarness);
        writeJson(path.join(outDir, 'agent-os-import.json'), agentOsImport);
        agentOsHandoff = buildAgentOsHandoff({
            contextPacketPath: 'context-packet.json',
            sourceMapPath: 'source-map.json',
            policySummaryPath: 'policy-summary.json',
            deploymentPreviewPath: 'deployment-preview.json',
            agentOsHarnessPath: 'agent-os-harness.json',
            config,
        });
        writeJson(path.join(outDir, 'agent-os-handoff.json'), agentOsHandoff);
    }

    const manifest = {
        schema_version: 'ecf-core.manifest.v1',
        created_at: createdAt,
        project_root: projectRoot,
        out_dir: outDir,
        files: {
            context_packet: relativeArtifact(projectRoot, outDir, 'context-packet.json'),
            source_map: relativeArtifact(projectRoot, outDir, 'source-map.json'),
            policy_summary: relativeArtifact(projectRoot, outDir, 'policy-summary.json'),
            agent_os_handoff: agentOsHandoff ? relativeArtifact(projectRoot, outDir, 'agent-os-handoff.json') : null,
            deployment_preview: deploymentPreview ? relativeArtifact(projectRoot, outDir, 'deployment-preview.json') : null,
            agent_os_harness: agentOsHarness ? relativeArtifact(projectRoot, outDir, 'agent-os-harness.json') : null,
            agent_os_import: agentOsImport ? relativeArtifact(projectRoot, outDir, 'agent-os-import.json') : null,
        },
        counts: {
            total_sources: records.length,
            allowed_sources: allowed.length,
            blocked_sources: blocked.length,
            review_required_sources: reviewRequired.length,
            citations: citations.length,
        },
    };
    writeJson(path.join(outDir, 'manifest.json'), manifest);

    return {
        config,
        contextPacket,
        sourceMap,
        policySummary,
        agentOsHandoff,
        deploymentPreview,
        agentOsHarness,
        agentOsImport,
        manifest,
        records,
    };
}

module.exports = {
    buildAgentOsHarness,
    buildAgentOsHandoff,
    buildAgentOsImport,
    buildDeploymentPreview,
    compileProject,
    validateCompiledArtifacts,
};
