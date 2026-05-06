'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AdapterRegistry } = require('./adapters/base');
const { FilesystemAdapter, walkFiles } = require('./adapters/filesystem');
const { MarkdownDocsAdapter } = require('./adapters/markdown-docs');
const { McpContextProviderAdapter } = require('./adapters/mcp-context');
const { OpenApiAdapter } = require('./adapters/openapi');
const { SqliteSummaryAdapter } = require('./adapters/sqlite-summary');
const { loadConfig } = require('./core/config');
const { sha256 } = require('./core/hash');
const {
    buildContextCompactionReport,
    buildContextEvidenceUnits,
} = require('./evidence-units');
const { buildContextIndexes } = require('./context-index');

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

function buildContextIndexReadiness(contextIndexes) {
    if (!contextIndexes) return null;
    const { pageIndex, treeIndex, retrievalPlan } = contextIndexes;
    const nodes = treeIndex?.summary?.node_count || 0;
    const sections = pageIndex?.summary?.section_count || 0;
    return {
        providers: pageIndex?.providers || [],
        files: {
            page_index: 'page-index.json',
            tree_index: 'tree-index.json',
            retrieval_plan: 'retrieval-plan.json',
        },
        source_count: pageIndex?.summary?.source_count || 0,
        page_count: pageIndex?.summary?.page_count || 0,
        tree_node_count: nodes,
        evidence_unit_count: sections,
        retrieval_query_count: retrievalPlan?.summary?.query_count || 0,
        unsupported_questions: retrievalPlan?.unsupported_questions || [],
        sources_requiring_public_exposure_review: (treeIndex?.nodes || [])
            .filter((node) => node.source_id && node.policy_flags?.requires_public_exposure_review)
            .map((node) => node.source_path),
        dependency_status: pageIndex?.dependency_status || 'builtin_local_only',
    };
}

function buildDeploymentPreview({ contextPacket, sourceMap, config, contextIndexes = null, groundingSummary = null }) {
    const checks = buildReadinessChecks({ contextPacket, sourceMap, config });
    const contextIndexReadiness = buildContextIndexReadiness(contextIndexes);
    if (contextIndexReadiness) {
        checks.push({
            id: 'context_index',
            status: contextIndexReadiness.tree_node_count > 0 ? 'pass' : 'warn',
            detail: `${contextIndexReadiness.tree_node_count} tree nodes and ${contextIndexReadiness.evidence_unit_count} indexed sections generated.`,
            dependency_status: contextIndexReadiness.dependency_status,
        });
    }
    if (groundingSummary) {
        checks.push({
            id: 'grounding_eval',
            status: groundingSummary.verdict === 'pass' ? 'pass' : 'warn',
            detail: `${groundingSummary.summary.grounded}/${groundingSummary.summary.queries} grounding queries passed.`,
            hallucination_risk: groundingSummary.summary.hallucination_risk,
        });
    }
    return {
        schema_version: 'ecf-core.deployment-preview.v1',
        mode: 'agent_os_preview',
        live_deploy_allowed: false,
        checks,
        artifacts: {
            context_packet: 'context-packet.json',
            source_map: 'source-map.json',
            policy_summary: 'policy-summary.json',
            context_evidence_units: 'context-evidence-units.json',
            context_compaction_report: 'context-compaction-report.json',
            page_index: contextIndexes ? 'page-index.json' : null,
            tree_index: contextIndexes ? 'tree-index.json' : null,
            retrieval_plan: contextIndexes ? 'retrieval-plan.json' : null,
            grounding_eval: groundingSummary ? 'grounding-eval.json' : null,
        },
        context_index_readiness: contextIndexReadiness,
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
            context_evidence_units: 'context-evidence-units.json',
            context_compaction_report: 'context-compaction-report.json',
            page_index: deploymentPreview.artifacts.page_index,
            tree_index: deploymentPreview.artifacts.tree_index,
            retrieval_plan: deploymentPreview.artifacts.retrieval_plan,
            deployment_preview: 'deployment-preview.json',
            grounding_eval: deploymentPreview.artifacts.grounding_eval,
        },
        boundary: baseBoundary(),
        readiness: {
            live_deploy_allowed: false,
            checks: deploymentPreview.checks,
        },
        context_index_readiness: deploymentPreview.context_index_readiness,
        agent_os_preview: {
            allowed: deploymentPreview.checks.every((check) => check.status !== 'fail'),
            requires_user_review: true,
        },
    };
}

function buildAgentOsImport({ deploymentPreview }) {
    const requiredFiles = [
        'context-packet.json',
        'source-map.json',
        'policy-summary.json',
        'context-evidence-units.json',
        'context-compaction-report.json',
        'deployment-preview.json',
        'agent-os-harness.json',
        'agent-os-handoff.json',
    ];
    for (const artifact of ['page_index', 'tree_index', 'retrieval_plan']) {
        if (deploymentPreview.artifacts[artifact]) requiredFiles.push(deploymentPreview.artifacts[artifact]);
    }
    if (deploymentPreview.artifacts.grounding_eval) requiredFiles.push(deploymentPreview.artifacts.grounding_eval);
    return {
        schema_version: 'ecf-core.agent-os-import.v1',
        import_mode: 'preview_only',
        live_deploy_allowed: false,
        required_files: requiredFiles,
        acceptance_checks: deploymentPreview.checks.map((check) => ({
            id: check.id,
            required_status: check.id === 'citation_coverage' ? ['pass', 'warn'] : ['pass'],
        })),
        boundary: baseBoundary(),
        evidence: {
            context_evidence_units: deploymentPreview.artifacts.context_evidence_units,
            context_compaction_report: deploymentPreview.artifacts.context_compaction_report,
            page_index: deploymentPreview.artifacts.page_index,
            tree_index: deploymentPreview.artifacts.tree_index,
            retrieval_plan: deploymentPreview.artifacts.retrieval_plan,
            grounding_eval: deploymentPreview.artifacts.grounding_eval,
        },
        context_index_readiness: deploymentPreview.context_index_readiness,
        next_step: 'agent_os_preview_import',
    };
}

function buildAgentOsHandoff({
    contextPacketPath,
    sourceMapPath,
    policySummaryPath,
    pageIndexPath,
    treeIndexPath,
    retrievalPlanPath,
    deploymentPreviewPath,
    agentOsHarnessPath,
    config,
}) {
    return {
        schema_version: 'ecf-core.agent-os-handoff.v1',
        context_packet: contextPacketPath,
        source_map: sourceMapPath,
        policy_summary: policySummaryPath,
        page_index: pageIndexPath,
        tree_index: treeIndexPath,
        retrieval_plan: retrievalPlanPath,
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

function applyGroundingEvidence({ outDir, grounding }) {
    const deploymentPreviewPath = path.join(outDir, 'deployment-preview.json');
    const agentOsHarnessPath = path.join(outDir, 'agent-os-harness.json');
    const agentOsImportPath = path.join(outDir, 'agent-os-import.json');
    const manifestPath = path.join(outDir, 'manifest.json');
    const retrievalPlanPath = path.join(outDir, 'retrieval-plan.json');
    if (!fs.existsSync(deploymentPreviewPath) || !fs.existsSync(agentOsHarnessPath) || !fs.existsSync(agentOsImportPath)) {
        return;
    }
    const deploymentPreview = JSON.parse(fs.readFileSync(deploymentPreviewPath, 'utf8'));
    const agentOsHarness = JSON.parse(fs.readFileSync(agentOsHarnessPath, 'utf8'));
    const agentOsImport = JSON.parse(fs.readFileSync(agentOsImportPath, 'utf8'));
    const check = {
        id: 'grounding_eval',
        status: grounding.verdict === 'pass' ? 'pass' : 'warn',
        detail: `${grounding.summary.grounded}/${grounding.summary.queries} grounding queries passed.`,
        hallucination_risk: grounding.summary.hallucination_risk,
    };
    const unsupportedQuestions = (grounding.questions || [])
        .filter((question) => question.status !== 'grounded')
        .map((question) => ({
            question: question.question,
            status: question.status,
            suggested_fix: question.suggested_fix,
        }));
    deploymentPreview.artifacts.grounding_eval = 'grounding-eval.json';
    deploymentPreview.checks = [
        ...deploymentPreview.checks.filter((item) => item.id !== 'grounding_eval'),
        check,
    ];
    if (deploymentPreview.context_index_readiness) {
        deploymentPreview.context_index_readiness.unsupported_questions = unsupportedQuestions;
    }
    agentOsHarness.artifacts.grounding_eval = 'grounding-eval.json';
    agentOsHarness.readiness.checks = [
        ...agentOsHarness.readiness.checks.filter((item) => item.id !== 'grounding_eval'),
        check,
    ];
    if (agentOsHarness.context_index_readiness) {
        agentOsHarness.context_index_readiness.unsupported_questions = unsupportedQuestions;
    }
    if (!agentOsImport.required_files.includes('grounding-eval.json')) {
        agentOsImport.required_files.push('grounding-eval.json');
    }
    agentOsImport.evidence = {
        ...(agentOsImport.evidence || {}),
        grounding_eval: 'grounding-eval.json',
    };
    if (agentOsImport.context_index_readiness) {
        agentOsImport.context_index_readiness.unsupported_questions = unsupportedQuestions;
    }
    writeJson(deploymentPreviewPath, deploymentPreview);
    writeJson(agentOsHarnessPath, agentOsHarness);
    writeJson(agentOsImportPath, agentOsImport);
    if (fs.existsSync(retrievalPlanPath)) {
        const retrievalPlan = JSON.parse(fs.readFileSync(retrievalPlanPath, 'utf8'));
        retrievalPlan.unsupported_questions = unsupportedQuestions;
        writeJson(retrievalPlanPath, retrievalPlan);
    }
    if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifest.files.grounding_eval = 'grounding-eval.json';
        writeJson(manifestPath, manifest);
    }
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
    const groundingEvalPath = path.join(artifactDir, 'grounding-eval.json');
    const evidenceUnitsPath = path.join(artifactDir, 'context-evidence-units.json');
    const compactionReportPath = path.join(artifactDir, 'context-compaction-report.json');
    const pageIndexPath = path.join(artifactDir, 'page-index.json');
    const treeIndexPath = path.join(artifactDir, 'tree-index.json');
    const retrievalPlanPath = path.join(artifactDir, 'retrieval-plan.json');

    validateSchemaVersion(contextPacket, 'ecf-core.context-packet.v1', 'context-packet.json', errors);
    validateSchemaVersion(sourceMap, 'ecf-core.source-map.v1', 'source-map.json', errors);
    validateSchemaVersion(policySummary, 'ecf-core.policy-summary.v1', 'policy-summary.json', errors);

    if (contextPacket && !Array.isArray(contextPacket.sources)) errors.push('context-packet.json sources must be an array');
    if (contextPacket && !Array.isArray(contextPacket.citations)) errors.push('context-packet.json citations must be an array');
    if (sourceMap && !Array.isArray(sourceMap.sources)) errors.push('source-map.json sources must be an array');
    if (policySummary && !Array.isArray(policySummary.allowed_sources)) errors.push('policy-summary.json allowed_sources must be an array');
    if (policySummary && !Array.isArray(policySummary.blocked_sources)) errors.push('policy-summary.json blocked_sources must be an array');
    if (fs.existsSync(groundingEvalPath)) {
        const groundingEval = readJsonIfPresent(groundingEvalPath, errors);
        validateSchemaVersion(groundingEval, 'ecf-core.grounding-eval.v1', 'grounding-eval.json', errors);
        if (groundingEval && !Array.isArray(groundingEval.questions)) errors.push('grounding-eval.json questions must be an array');
        if (groundingEval && !groundingEval.summary) errors.push('grounding-eval.json summary is required');
    }
    if (fs.existsSync(evidenceUnitsPath)) {
        const evidenceUnits = readJsonIfPresent(evidenceUnitsPath, errors);
        validateSchemaVersion(evidenceUnits, 'ecf-core.context-evidence-units.v1', 'context-evidence-units.json', errors);
        if (evidenceUnits && !Array.isArray(evidenceUnits.units)) errors.push('context-evidence-units.json units must be an array');
    }
    if (fs.existsSync(compactionReportPath)) {
        const compactionReport = readJsonIfPresent(compactionReportPath, errors);
        validateSchemaVersion(compactionReport, 'ecf-core.context-compaction-report.v1', 'context-compaction-report.json', errors);
        if (compactionReport && !compactionReport.retrieval_preservation) errors.push('context-compaction-report.json retrieval_preservation is required');
    }
    if (fs.existsSync(pageIndexPath)) {
        const pageIndex = readJsonIfPresent(pageIndexPath, errors);
        validateSchemaVersion(pageIndex, 'ecf-core.page-index.v1', 'page-index.json', errors);
        if (pageIndex && !Array.isArray(pageIndex.sources)) errors.push('page-index.json sources must be an array');
        if (pageIndex && !pageIndex.summary) errors.push('page-index.json summary is required');
    }
    if (fs.existsSync(treeIndexPath)) {
        const treeIndex = readJsonIfPresent(treeIndexPath, errors);
        validateSchemaVersion(treeIndex, 'ecf-core.tree-index.v1', 'tree-index.json', errors);
        if (treeIndex && !Array.isArray(treeIndex.nodes)) errors.push('tree-index.json nodes must be an array');
        if (treeIndex && !Array.isArray(treeIndex.edges)) errors.push('tree-index.json edges must be an array');
    }
    if (fs.existsSync(retrievalPlanPath)) {
        const retrievalPlan = readJsonIfPresent(retrievalPlanPath, errors);
        validateSchemaVersion(retrievalPlan, 'ecf-core.retrieval-plan.v1', 'retrieval-plan.json', errors);
        if (retrievalPlan && !Array.isArray(retrievalPlan.queries)) errors.push('retrieval-plan.json queries must be an array');
    }

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

    const walkState = { skippedDirectories: [] };
    const fileInventory = walkFiles(projectRoot, config, projectRoot, [], walkState);
    const records = await registry.discoverAll({ projectRoot, config, fileInventory, walkState });
    const allowed = records.filter((record) => record.classification === 'allowed');
    const blocked = records.filter((record) => record.classification === 'blocked');
    const reviewRequired = records.filter((record) => record.classification === 'review_required');

    const sources = allowed.map((record) => ({
        id: record.id,
        path: record.path,
        type: record.type,
        hash: record.hash,
        summary: record.summary,
        heading: record.heading || null,
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
    const evidenceUnits = buildContextEvidenceUnits({ contextPacket, createdAt });
    const compactionReport = buildContextCompactionReport({
        contextPacket,
        evidenceUnits,
        queries: Array.isArray(config.eval?.queries) ? config.eval.queries : [],
        topKSize: Number.isFinite(Number(config.eval?.top_k)) ? Math.max(1, Number(config.eval.top_k)) : 3,
        evalConfig: config.eval || {},
    });
    const contextIndexes = buildContextIndexes({
        contextPacket,
        sourceMap,
        config,
        createdAt,
    });

    const contextPacketPath = path.join(outDir, 'context-packet.json');
    const sourceMapPath = path.join(outDir, 'source-map.json');
    const policySummaryPath = path.join(outDir, 'policy-summary.json');
    writeJson(contextPacketPath, contextPacket);
    writeJson(sourceMapPath, sourceMap);
    writeJson(policySummaryPath, policySummary);
    writeJson(path.join(outDir, 'context-evidence-units.json'), evidenceUnits);
    writeJson(path.join(outDir, 'context-compaction-report.json'), compactionReport);
    writeJson(path.join(outDir, 'page-index.json'), contextIndexes.pageIndex);
    writeJson(path.join(outDir, 'tree-index.json'), contextIndexes.treeIndex);
    writeJson(path.join(outDir, 'retrieval-plan.json'), contextIndexes.retrievalPlan);

    let agentOsHandoff = null;
    let deploymentPreview = null;
    let agentOsHarness = null;
    let agentOsImport = null;
    if (options.emitAgentOs) {
        deploymentPreview = buildDeploymentPreview({ contextPacket, sourceMap, config, contextIndexes });
        agentOsHarness = buildAgentOsHarness({ deploymentPreview });
        agentOsImport = buildAgentOsImport({ deploymentPreview });
        writeJson(path.join(outDir, 'deployment-preview.json'), deploymentPreview);
        writeJson(path.join(outDir, 'agent-os-harness.json'), agentOsHarness);
        writeJson(path.join(outDir, 'agent-os-import.json'), agentOsImport);
        agentOsHandoff = buildAgentOsHandoff({
            contextPacketPath: 'context-packet.json',
            sourceMapPath: 'source-map.json',
            policySummaryPath: 'policy-summary.json',
            pageIndexPath: 'page-index.json',
            treeIndexPath: 'tree-index.json',
            retrievalPlanPath: 'retrieval-plan.json',
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
            context_evidence_units: relativeArtifact(projectRoot, outDir, 'context-evidence-units.json'),
            context_compaction_report: relativeArtifact(projectRoot, outDir, 'context-compaction-report.json'),
            page_index: relativeArtifact(projectRoot, outDir, 'page-index.json'),
            tree_index: relativeArtifact(projectRoot, outDir, 'tree-index.json'),
            retrieval_plan: relativeArtifact(projectRoot, outDir, 'retrieval-plan.json'),
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
            context_evidence_units: evidenceUnits.units.length,
            page_index_sources: contextIndexes.pageIndex.summary.source_count,
            tree_index_nodes: contextIndexes.treeIndex.summary.node_count,
            retrieval_plan_queries: contextIndexes.retrievalPlan.summary.query_count,
        },
    };
    writeJson(path.join(outDir, 'manifest.json'), manifest);

    return {
        config,
        contextPacket,
        sourceMap,
        policySummary,
        evidenceUnits,
        compactionReport,
        contextIndexes,
        pageIndex: contextIndexes.pageIndex,
        treeIndex: contextIndexes.treeIndex,
        retrievalPlan: contextIndexes.retrievalPlan,
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
    applyGroundingEvidence,
    validateCompiledArtifacts,
};
