'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateCompiledArtifacts } = require('./compile');

const RESIDENT_STATUS_FILE = 'resident-status.json';
const CONTEXT_PACK_FILE = 'context-pack.json';

function portablePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function relativePortable(from, to) {
    return portablePath(path.relative(from, to) || '.');
}

function resolveWorkspace(options = {}) {
    const projectRoot = path.resolve(options.projectRoot || process.cwd());
    const artifactDir = path.resolve(options.artifactDir || options.outDir || path.join(projectRoot, '.ecf-core'));
    return { projectRoot, artifactDir };
}

function readJsonIfPresent(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return { parse_error: error.message };
    }
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
    return filePath;
}

function artifactStatus(projectRoot, artifactDir, fileName) {
    const filePath = path.join(artifactDir, fileName);
    const parsed = readJsonIfPresent(filePath);
    return {
        name: fileName,
        exists: fs.existsSync(filePath),
        path: relativePortable(projectRoot, filePath),
        schema_version: parsed?.schema_version || parsed?.schema || null,
        parse_error: parsed?.parse_error || null,
    };
}

function standardArtifacts(projectRoot, artifactDir) {
    return [
        'manifest.json',
        'context-packet.json',
        'source-map.json',
        'policy-summary.json',
        'agent-os-handoff.json',
        'agent-os-harness.json',
        'deployment-preview.json',
        'agent-os-import.json',
        'evidence-units.json',
        'context-evidence-units.json',
        'context-compaction-report.json',
        'page-index.json',
        'tree-index.json',
        'retrieval-plan.json',
    ].map((fileName) => artifactStatus(projectRoot, artifactDir, fileName));
}

function authorityBoundary() {
    return {
        local_only: true,
        no_cloud_call: true,
        no_deploy: true,
        no_spend: true,
        no_wallet_mutation: true,
        no_x402_settlement: true,
        no_marketplace_publication: true,
        no_provider_ranking: true,
        hosted_agent_os_runtime_included: false,
        full_ecf_private_internals_included: false,
        raw_secret_content_included: false,
    };
}

function sourceCounts(sourceMap, manifest) {
    const sourceRecords = Array.isArray(sourceMap?.sources) ? sourceMap.sources : [];
    return {
        allowed_sources: manifest?.counts?.allowed_sources ?? sourceRecords.filter((source) => source.classification !== 'blocked').length,
        blocked_sources: manifest?.counts?.blocked_sources ?? sourceRecords.filter((source) => source.classification === 'blocked').length,
        review_required_sources: manifest?.counts?.review_required_sources ?? sourceRecords.filter((source) => source.classification === 'review_required').length,
    };
}

function policySummary(policy) {
    if (!policy || policy.parse_error) return null;
    return {
        project_name: policy.project_name || policy.name || null,
        scope: policy.scope || null,
        allowed_sources: Array.isArray(policy.allowed_sources) ? policy.allowed_sources.length : null,
        blocked_sources: Array.isArray(policy.blocked_sources) ? policy.blocked_sources.length : null,
        live_deploy_allowed: policy.handoff?.live_deploy_allowed === true || policy.live_deploy_allowed === true,
        agent_os_preview_allowed: policy.handoff?.agent_os_preview_allowed === true || policy.agent_os_preview_allowed === true,
    };
}

function validateArtifacts(artifactDir) {
    if (!fs.existsSync(artifactDir)) {
        return {
            ok: false,
            artifact_dir: artifactDir,
            errors: [`${artifactDir} does not exist`],
        };
    }
    return validateCompiledArtifacts(artifactDir);
}

function buildEcfCoreResidentStatus(options = {}) {
    const { projectRoot, artifactDir } = resolveWorkspace(options);
    const validation = validateArtifacts(artifactDir);
    const artifacts = standardArtifacts(projectRoot, artifactDir);
    const missing = artifacts.filter((artifact) => !artifact.exists).map((artifact) => artifact.name);
    const configPresent = fs.existsSync(path.join(projectRoot, 'ecf.config.json'));
    const ready = validation.ok === true && configPresent;

    return {
        schema_version: 'ecf-core.resident-status.v1',
        ok: ready,
        resident_state: ready ? 'ready' : 'attention_required',
        generated_at: new Date().toISOString(),
        project_root: relativePortable(process.cwd(), projectRoot),
        artifact_dir: relativePortable(process.cwd(), artifactDir),
        config_present: configPresent,
        validation,
        missing_artifacts: missing,
        artifacts,
        codex_context: {
            repo_instructions_present: fs.existsSync(path.join(projectRoot, 'AGENTS.md')),
            ecf_md_present: fs.existsSync(path.join(projectRoot, 'ECF.md')),
            package_handoff_present: fs.existsSync(path.join(projectRoot, 'SKILL.md')),
            disclosure_required: true,
        },
        mcp: {
            available: true,
            command: `ecf-core serve-mcp ${relativePortable(projectRoot, artifactDir)}`,
            tools: [
                'ecf_core.search_context',
                'ecf_core.get_source',
                'ecf_core.get_policy',
                'ecf_core.get_manifest',
                'ecf_core.agent_os_preview_check',
                'ecf_core.status',
                'ecf_core.context_pack',
            ],
        },
        context_pack: {
            available: missing.includes('context-packet.json') === false
                && missing.includes('source-map.json') === false
                && missing.includes('policy-summary.json') === false,
            command: `ecf-core context-pack ${relativePortable(process.cwd(), projectRoot)} --write`,
        },
        authority_boundary: authorityBoundary(),
        next_steps: ready
            ? ['ecf-core context-pack . --write', 'ecf-core serve-mcp .ecf-core']
            : ['ecf-core init .', 'ecf-core compile . --agent-os', 'ecf-core status . --write'],
    };
}

function writeEcfCoreResidentStatus(options = {}) {
    const { artifactDir } = resolveWorkspace(options);
    const status = buildEcfCoreResidentStatus(options);
    const outputPath = writeJson(path.join(artifactDir, RESIDENT_STATUS_FILE), status);
    return {
        ...status,
        status_path: relativePortable(process.cwd(), outputPath),
    };
}

function buildEcfCoreContextPack(options = {}) {
    const { projectRoot, artifactDir } = resolveWorkspace(options);
    const task = String(options.task || '').trim() || 'current_codex_session';
    const status = buildEcfCoreResidentStatus({ projectRoot, artifactDir });
    const manifest = readJsonIfPresent(path.join(artifactDir, 'manifest.json'));
    const sourceMap = readJsonIfPresent(path.join(artifactDir, 'source-map.json'));
    const contextPacket = readJsonIfPresent(path.join(artifactDir, 'context-packet.json'));
    const policy = readJsonIfPresent(path.join(artifactDir, 'policy-summary.json'));
    const preview = readJsonIfPresent(path.join(artifactDir, 'agent-os-import.json'))
        || readJsonIfPresent(path.join(artifactDir, 'deployment-preview.json'));

    return {
        schema_version: 'ecf-core.context-pack.v1',
        ok: status.ok,
        task,
        generated_at: new Date().toISOString(),
        project_root: relativePortable(process.cwd(), projectRoot),
        artifact_dir: relativePortable(process.cwd(), artifactDir),
        status_ref: relativePortable(projectRoot, path.join(artifactDir, RESIDENT_STATUS_FILE)),
        artifacts: {
            manifest: relativePortable(projectRoot, path.join(artifactDir, 'manifest.json')),
            source_map: relativePortable(projectRoot, path.join(artifactDir, 'source-map.json')),
            context_packet: relativePortable(projectRoot, path.join(artifactDir, 'context-packet.json')),
            policy_summary: relativePortable(projectRoot, path.join(artifactDir, 'policy-summary.json')),
            agent_os_import: relativePortable(projectRoot, path.join(artifactDir, 'agent-os-import.json')),
            deployment_preview: relativePortable(projectRoot, path.join(artifactDir, 'deployment-preview.json')),
        },
        summary: {
            source_counts: sourceCounts(sourceMap, manifest),
            citation_count: Array.isArray(contextPacket?.citations) ? contextPacket.citations.length : 0,
            policy: policySummary(policy),
            preview_mode: preview?.import_mode || preview?.mode || null,
            live_deploy_allowed: preview?.live_deploy_allowed === true,
            missing_artifacts: status.missing_artifacts,
        },
        assistant_bootstrap: {
            read_order: [
                'AGENTS.md',
                'ECF.md',
                'ecf.config.json',
                '.ecf-core/context-packet.json',
                '.ecf-core/policy-summary.json',
                '.ecf-core/agent-os-import.json',
            ],
            disclosure: 'ECF Core resident context is compiled local context, not hidden global memory or hosted Agent OS authority.',
            refresh_commands: [
                'ecf-core compile . --agent-os',
                'ecf-core validate .ecf-core',
                'ecf-core status . --write',
                'ecf-core context-pack . --write',
            ],
        },
        authority_boundary: authorityBoundary(),
    };
}

function writeEcfCoreContextPack(options = {}) {
    const { artifactDir } = resolveWorkspace(options);
    const pack = buildEcfCoreContextPack(options);
    const outputPath = writeJson(path.join(artifactDir, CONTEXT_PACK_FILE), pack);
    return {
        ...pack,
        context_pack_path: relativePortable(process.cwd(), outputPath),
    };
}

module.exports = {
    CONTEXT_PACK_FILE,
    RESIDENT_STATUS_FILE,
    buildEcfCoreContextPack,
    buildEcfCoreResidentStatus,
    writeEcfCoreContextPack,
    writeEcfCoreResidentStatus,
};
