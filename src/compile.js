'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AdapterRegistry } = require('./adapters/base');
const { FilesystemAdapter } = require('./adapters/filesystem');
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

function buildAgentOsHandoff({ contextPacketPath, sourceMapPath, policySummaryPath, config }) {
    return {
        schema_version: 'ecf-core.agent-os-handoff.v1',
        context_packet: contextPacketPath,
        source_map: sourceMapPath,
        policy_summary: policySummaryPath,
        agent_os_preview: {
            allowed: Boolean(config.handoff.agent_os_preview_allowed),
            live_deploy_allowed: false,
            recommended_next_step: 'review_in_agent_os_preview',
        },
        boundary: {
            includes_hosted_runtime: false,
            includes_wallet_or_settlement: false,
            includes_full_ecf_private_internals: false,
        },
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
    if (options.emitAgentOs) {
        agentOsHandoff = buildAgentOsHandoff({
            contextPacketPath: 'context-packet.json',
            sourceMapPath: 'source-map.json',
            policySummaryPath: 'policy-summary.json',
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
        manifest,
    };
}

module.exports = {
    buildAgentOsHandoff,
    compileProject,
    validateCompiledArtifacts,
};
