'use strict';

const fs = require('node:fs');
const path = require('node:path');

function readJson(filePath, errors) {
    if (!fs.existsSync(filePath)) {
        errors.push(`${path.basename(filePath)} missing`);
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        errors.push(`${path.basename(filePath)} invalid JSON: ${error.message}`);
        return null;
    }
}

function inspectAgentOsPreview(artifactDir) {
    const resolvedDir = path.resolve(artifactDir || '.ecf-core');
    const errors = [];
    const agentOsImport = readJson(path.join(resolvedDir, 'agent-os-import.json'), errors);
    const deploymentPreview = readJson(path.join(resolvedDir, 'deployment-preview.json'), errors);
    const groundingEvalPath = path.join(resolvedDir, 'grounding-eval.json');
    const groundingEval = fs.existsSync(groundingEvalPath) ? readJson(groundingEvalPath, errors) : null;
    const pageIndexPath = path.join(resolvedDir, 'page-index.json');
    const treeIndexPath = path.join(resolvedDir, 'tree-index.json');
    const retrievalPlanPath = path.join(resolvedDir, 'retrieval-plan.json');
    const pageIndex = fs.existsSync(pageIndexPath) ? readJson(pageIndexPath, errors) : null;
    const treeIndex = fs.existsSync(treeIndexPath) ? readJson(treeIndexPath, errors) : null;
    const retrievalPlan = fs.existsSync(retrievalPlanPath) ? readJson(retrievalPlanPath, errors) : null;

    if (agentOsImport && agentOsImport.schema_version !== 'ecf-core.agent-os-import.v1') {
        errors.push('agent-os-import.json has unsupported schema_version');
    }
    if (deploymentPreview && deploymentPreview.schema_version !== 'ecf-core.deployment-preview.v1') {
        errors.push('deployment-preview.json has unsupported schema_version');
    }
    if (groundingEval && groundingEval.schema_version !== 'ecf-core.grounding-eval.v1') {
        errors.push('grounding-eval.json has unsupported schema_version');
    }
    if (pageIndex && pageIndex.schema_version !== 'ecf-core.page-index.v1') {
        errors.push('page-index.json has unsupported schema_version');
    }
    if (treeIndex && treeIndex.schema_version !== 'ecf-core.tree-index.v1') {
        errors.push('tree-index.json has unsupported schema_version');
    }
    if (retrievalPlan && retrievalPlan.schema_version !== 'ecf-core.retrieval-plan.v1') {
        errors.push('retrieval-plan.json has unsupported schema_version');
    }

    const requiredFiles = Array.isArray(agentOsImport?.required_files) ? agentOsImport.required_files : [];
    const missingFiles = requiredFiles.filter((fileName) => !fs.existsSync(path.join(resolvedDir, fileName)));
    for (const fileName of missingFiles) errors.push(`${fileName} missing`);

    const previewChecks = new Map((deploymentPreview?.checks || []).map((check) => [check.id, check]));
    const acceptance = (agentOsImport?.acceptance_checks || []).map((check) => {
        const actual = previewChecks.get(check.id);
        const required = Array.isArray(check.required_status) ? check.required_status : [];
        return {
            id: check.id,
            status: actual?.status || 'missing',
            accepted: Boolean(actual && required.includes(actual.status)),
            required_status: required,
        };
    });
    const failedAcceptance = acceptance.filter((check) => !check.accepted);
    for (const check of failedAcceptance) errors.push(`acceptance check failed: ${check.id}`);

    const boundary = agentOsImport?.boundary || {};
    const boundarySafe = boundary.includes_hosted_runtime === false
        && boundary.includes_wallet_or_settlement === false
        && boundary.includes_full_ecf_private_internals === false
        && boundary.includes_marketplace_routing === false
        && agentOsImport?.live_deploy_allowed === false
        && deploymentPreview?.live_deploy_allowed === false;
    if (!boundarySafe) errors.push('Agent OS import boundary is not preview-only');

    return {
        schema_version: 'ecf-core.agent-os-preview-check.v1',
        ok: errors.length === 0,
        artifact_dir: resolvedDir,
        import_mode: agentOsImport?.import_mode || null,
        live_deploy_allowed: false,
        required_files: requiredFiles,
        missing_files: missingFiles,
        acceptance_checks: acceptance,
        grounding_eval: groundingEval ? {
            verdict: groundingEval.verdict,
            summary: groundingEval.summary,
        } : null,
        context_index_readiness: agentOsImport?.context_index_readiness || deploymentPreview?.context_index_readiness || null,
        boundary_safe: boundarySafe,
        next_step: errors.length === 0
            ? 'send_artifact_dir_to_agent_os_preview_import'
            : 'fix_ecf_core_artifacts_before_agent_os_preview',
        errors,
    };
}

module.exports = {
    inspectAgentOsPreview,
};
