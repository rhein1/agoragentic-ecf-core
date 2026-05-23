'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORKLOG_DIR = 'worklog';
const CURRENT_WORK_FILE = 'current.json';
const HISTORY_FILE = 'history.jsonl';
const CHECKPOINTS_FILE = 'checkpoints.jsonl';
const LATEST_SUMMARY_FILE = 'latest-summary.md';
const DOCS_SYNC_PLAN_FILE = 'docs-sync-plan.json';
const HANDOFF_FILE = 'handoff.md';
const NEXT_SESSION_FILE = 'next-session.md';

function portablePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function relativePortable(from, to) {
    return portablePath(path.relative(from, to) || '.');
}

function resolveWorkspace(options = {}) {
    const projectRoot = path.resolve(options.projectRoot || process.cwd());
    const artifactDir = path.resolve(options.artifactDir || options.outDir || path.join(projectRoot, '.ecf-core'));
    const worklogDir = path.join(artifactDir, WORKLOG_DIR);
    return { projectRoot, artifactDir, worklogDir };
}

function nowIso() {
    return new Date().toISOString();
}

function splitList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value || '')
        .split(/[,\n;]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
    return filePath;
}

function safeReadJson(filePath, fallback = null) {
    if (!fs.existsSync(filePath)) return fallback;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return { parse_error: error.message };
    }
}

function appendJsonl(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
    return filePath;
}

function readJsonl(filePath) {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                return {
                    parse_error: error.message,
                    raw_length: line.length,
                };
            }
        });
}

function safeGit(projectRoot, args) {
    try {
        return execFileSync('git', args, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return '';
    }
}

function gitSnapshot(projectRoot) {
    const statusShort = safeGit(projectRoot, ['status', '--short']);
    const branch = safeGit(projectRoot, ['branch', '--show-current']);
    const head = safeGit(projectRoot, ['rev-parse', '--short', 'HEAD']);
    const changedFiles = safeGit(projectRoot, ['diff', '--name-only'])
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    const stagedFiles = safeGit(projectRoot, ['diff', '--cached', '--name-only'])
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    return {
        branch: branch || null,
        head: head || null,
        status_short: statusShort,
        changed_files: changedFiles,
        staged_files: stagedFiles,
        raw_diff_included: false,
    };
}

function authorityBoundary() {
    return {
        local_only: true,
        proposal_first: true,
        docs_auto_edit_enabled: false,
        deploy_enabled: false,
        spend_enabled: false,
        wallet_mutation_enabled: false,
        x402_settlement_enabled: false,
        marketplace_publication_enabled: false,
        hosted_runtime_enabled: false,
        full_ecf_private_internals_included: false,
        raw_secret_content_included: false,
    };
}

function currentWorkPath(worklogDir) {
    return path.join(worklogDir, CURRENT_WORK_FILE);
}

function historyPath(worklogDir) {
    return path.join(worklogDir, HISTORY_FILE);
}

function checkpointsPath(worklogDir) {
    return path.join(worklogDir, CHECKPOINTS_FILE);
}

function requireCurrent(worklogDir) {
    const current = safeReadJson(currentWorkPath(worklogDir), null);
    if (!current || current.parse_error) {
        throw new Error('No active worklog. Run ecf-core worklog begin --goal "..." first.');
    }
    return current;
}

function createWorkId(goal) {
    const safeGoal = String(goal || 'work')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'work';
    return `${safeGoal}-${Date.now().toString(36)}`;
}

function beginWorklog(options = {}) {
    const { projectRoot, artifactDir, worklogDir } = resolveWorkspace(options);
    const goal = String(options.goal || options.summary || '').trim();
    if (!goal) throw new Error('worklog begin requires --goal "..."');
    const current = {
        schema_version: 'ecf-core.worklog-current.v1',
        work_id: options.workId || createWorkId(goal),
        goal,
        status: 'active',
        started_at: nowIso(),
        updated_at: nowIso(),
        project_root: relativePortable(process.cwd(), projectRoot),
        artifact_dir: relativePortable(process.cwd(), artifactDir),
        decisions: splitList(options.decisions),
        changed_files: splitList(options.files),
        validation: splitList(options.validation),
        commits: [],
        unfinished_work: splitList(options.unfinished),
        next_prompt: String(options.nextPrompt || '').trim() || null,
        git: gitSnapshot(projectRoot),
        authority_boundary: authorityBoundary(),
    };
    writeJson(currentWorkPath(worklogDir), current);
    appendJsonl(historyPath(worklogDir), {
        event: 'begin',
        work_id: current.work_id,
        goal: current.goal,
        at: current.started_at,
    });
    return {
        ok: true,
        current,
        current_path: relativePortable(process.cwd(), currentWorkPath(worklogDir)),
    };
}

function checkpointWorklog(options = {}) {
    const { projectRoot, worklogDir } = resolveWorkspace(options);
    const current = requireCurrent(worklogDir);
    const checkpoint = {
        schema_version: 'ecf-core.worklog-checkpoint.v1',
        work_id: current.work_id,
        at: nowIso(),
        summary: String(options.summary || '').trim() || 'Checkpoint recorded.',
        decisions: splitList(options.decisions),
        changed_files: splitList(options.files),
        validation: splitList(options.validation),
        unfinished_work: splitList(options.unfinished),
        next_prompt: String(options.nextPrompt || '').trim() || null,
        git: gitSnapshot(projectRoot),
        authority_boundary: authorityBoundary(),
    };
    current.updated_at = checkpoint.at;
    current.decisions = [...new Set([...(current.decisions || []), ...checkpoint.decisions])];
    current.changed_files = [...new Set([...(current.changed_files || []), ...checkpoint.changed_files, ...checkpoint.git.changed_files])];
    current.validation = [...new Set([...(current.validation || []), ...checkpoint.validation])];
    current.unfinished_work = checkpoint.unfinished_work.length ? checkpoint.unfinished_work : current.unfinished_work;
    current.next_prompt = checkpoint.next_prompt || current.next_prompt;
    current.git = checkpoint.git;
    writeJson(currentWorkPath(worklogDir), current);
    appendJsonl(checkpointsPath(worklogDir), checkpoint);
    appendJsonl(historyPath(worklogDir), {
        event: 'checkpoint',
        work_id: current.work_id,
        summary: checkpoint.summary,
        at: checkpoint.at,
    });
    return {
        ok: true,
        checkpoint,
        current,
        checkpoint_path: relativePortable(process.cwd(), checkpointsPath(worklogDir)),
    };
}

function finishWorklog(options = {}) {
    const { projectRoot, worklogDir } = resolveWorkspace(options);
    const current = requireCurrent(worklogDir);
    const finished = {
        ...current,
        schema_version: 'ecf-core.worklog-finished.v1',
        status: 'finished',
        summary: String(options.summary || '').trim() || current.summary || 'Work finished.',
        completed_at: nowIso(),
        updated_at: nowIso(),
        validation: [...new Set([...(current.validation || []), ...splitList(options.validation), ...splitList(options.tests)])],
        commits: [...new Set([...(current.commits || []), ...splitList(options.commit)])],
        unfinished_work: splitList(options.unfinished),
        next_prompt: String(options.nextPrompt || '').trim() || current.next_prompt || null,
        git: gitSnapshot(projectRoot),
        authority_boundary: authorityBoundary(),
    };
    writeJson(currentWorkPath(worklogDir), finished);
    appendJsonl(historyPath(worklogDir), {
        event: 'finish',
        work_id: finished.work_id,
        summary: finished.summary,
        at: finished.completed_at,
    });
    const summaryPath = writeLatestSummary({ worklogDir, work: finished });
    return {
        ok: true,
        finished,
        current_path: relativePortable(process.cwd(), currentWorkPath(worklogDir)),
        latest_summary_path: relativePortable(process.cwd(), summaryPath),
    };
}

function docsCandidate(projectRoot, filePath, reason, exists = true) {
    return {
        path: filePath,
        exists: Boolean(exists),
        reason,
        auto_apply: false,
    };
}

function planDocsSync(options = {}) {
    const { projectRoot, artifactDir, worklogDir } = resolveWorkspace(options);
    const current = safeReadJson(currentWorkPath(worklogDir), null);
    const recommendedUpdates = [
        docsCandidate(projectRoot, 'README.md', 'Update if the public CLI or install workflow changed.', fs.existsSync(path.join(projectRoot, 'README.md'))),
        docsCandidate(projectRoot, 'ECF.md', 'Update if resident read order, handoff, or context boundaries changed.', fs.existsSync(path.join(projectRoot, 'ECF.md'))),
        docsCandidate(projectRoot, 'docs/README.md', 'Update if new docs were added to the public docs index.', fs.existsSync(path.join(projectRoot, 'docs', 'README.md'))),
        docsCandidate(projectRoot, 'docs/MCP_SERVER.md', 'Update if MCP tools or resident behavior changed.', fs.existsSync(path.join(projectRoot, 'docs', 'MCP_SERVER.md'))),
        docsCandidate(projectRoot, 'docs/CODEX_MCP.md', 'Update if Codex resident MCP install behavior changed.', fs.existsSync(path.join(projectRoot, 'docs', 'CODEX_MCP.md'))),
    ].filter((item) => item.exists);
    const plan = {
        schema_version: 'ecf-core.docs-sync-plan.v1',
        ok: true,
        generated_at: nowIso(),
        project_root: relativePortable(process.cwd(), projectRoot),
        artifact_dir: relativePortable(process.cwd(), artifactDir),
        work_id: current?.work_id || null,
        goal: current?.goal || null,
        recommended_updates: recommendedUpdates,
        apply_required: false,
        auto_edit_enabled: false,
        apply_command: 'No apply command exists in ECF Core V1. Edit docs explicitly after owner review.',
        authority_boundary: authorityBoundary(),
    };
    const outputPath = writeJson(path.join(artifactDir, DOCS_SYNC_PLAN_FILE), plan);
    return {
        ...plan,
        plan_path: relativePortable(process.cwd(), outputPath),
    };
}

function formatList(items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return '- none';
    return list.map((item) => `- ${item}`).join('\n');
}

function summaryText(work) {
    return `# ECF Core Work Summary

Goal: ${work.goal || 'No goal recorded.'}
Status: ${work.status || 'unknown'}

Summary:
${work.summary || 'No summary recorded.'}

Commits:
${formatList(work.commits)}

Changed files:
${formatList(work.changed_files)}

Validation:
${formatList(work.validation)}

Unfinished work:
${formatList(work.unfinished_work)}

Next prompt:
${work.next_prompt || 'None recorded.'}
`;
}

function writeLatestSummary({ worklogDir, work }) {
    const summaryPath = path.join(worklogDir, LATEST_SUMMARY_FILE);
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, summaryText(work), 'utf8');
    return summaryPath;
}

function buildWorklogStatus(options = {}) {
    const { worklogDir } = resolveWorkspace(options);
    const current = safeReadJson(currentWorkPath(worklogDir), null);
    const history = readJsonl(historyPath(worklogDir));
    const checkpoints = readJsonl(checkpointsPath(worklogDir));
    return {
        schema_version: 'ecf-core.worklog-status.v1',
        ok: true,
        generated_at: nowIso(),
        active: Boolean(current && !current.parse_error && current.status !== 'finished'),
        current,
        history_count: history.length,
        checkpoint_count: checkpoints.length,
        latest_history: history.slice(-5),
        latest_checkpoints: checkpoints.slice(-5),
        authority_boundary: authorityBoundary(),
    };
}

function buildHandoff(options = {}) {
    const { projectRoot, artifactDir, worklogDir } = resolveWorkspace(options);
    const current = safeReadJson(currentWorkPath(worklogDir), null);
    const docsPlan = safeReadJson(path.join(artifactDir, DOCS_SYNC_PLAN_FILE), null);
    const work = current && !current.parse_error ? current : {
        goal: String(options.goal || '').trim() || 'No active worklog.',
        status: 'unknown',
        summary: 'No worklog current.json found.',
        changed_files: [],
        validation: [],
        commits: [],
        unfinished_work: [],
        next_prompt: null,
    };
    return {
        schema_version: 'ecf-core.handoff.v1',
        ok: true,
        generated_at: nowIso(),
        project_root: relativePortable(process.cwd(), projectRoot),
        artifact_dir: relativePortable(process.cwd(), artifactDir),
        read_order: [
            'AGENTS.md',
            'ECF.md',
            'ecf.config.json',
            '.ecf-core/context-pack.json',
            '.ecf-core/policy-summary.json',
            '.ecf-core/agent-os-import.json',
            '.ecf-core/worklog/latest-summary.md',
            '.ecf-core/next-session.md',
        ],
        work,
        docs_sync_plan: docsPlan,
        authority_boundary: authorityBoundary(),
    };
}

function handoffMarkdown(handoff) {
    return `# ECF Core Next Session Handoff

Generated: ${handoff.generated_at}

## Read Order

${formatList(handoff.read_order)}

## Goal

${handoff.work.goal || 'No goal recorded.'}

## Status

${handoff.work.status || 'unknown'}

## Summary

${handoff.work.summary || 'No summary recorded.'}

## Commits

${formatList(handoff.work.commits)}

## Changed Files

${formatList(handoff.work.changed_files)}

## Validation

${formatList(handoff.work.validation)}

## Unfinished Work

${formatList(handoff.work.unfinished_work)}

## Next Prompt

${handoff.work.next_prompt || 'None recorded.'}

## Docs Sync Plan

${handoff.docs_sync_plan
        ? formatList((handoff.docs_sync_plan.recommended_updates || []).map((item) => `${item.path}: ${item.reason}`))
        : 'No docs-sync plan recorded.'}

## Boundary

This handoff is local-only. It does not deploy, spend, mutate wallets, settle x402, publish marketplace listings, provision hosted runtime, or expose Full ECF private internals.
`;
}

function writeHandoff(options = {}) {
    const { artifactDir, worklogDir } = resolveWorkspace(options);
    const handoff = buildHandoff(options);
    const handoffJsonPath = writeJson(path.join(artifactDir, HANDOFF_FILE.replace(/\.md$/, '.json')), handoff);
    const handoffPath = path.join(artifactDir, HANDOFF_FILE);
    fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
    fs.writeFileSync(handoffPath, handoffMarkdown(handoff), 'utf8');
    const nextSessionPath = path.join(artifactDir, NEXT_SESSION_FILE);
    fs.writeFileSync(nextSessionPath, handoffMarkdown(handoff), 'utf8');
    if (handoff.work && handoff.work.goal) {
        writeLatestSummary({ worklogDir, work: handoff.work });
    }
    return {
        ...handoff,
        handoff_json_path: relativePortable(process.cwd(), handoffJsonPath),
        handoff_path: relativePortable(process.cwd(), handoffPath),
        next_session_path: relativePortable(process.cwd(), nextSessionPath),
    };
}

function readWorklogArtifacts(options = {}) {
    const { artifactDir, worklogDir } = resolveWorkspace(options);
    return {
        schema_version: 'ecf-core.work-memory.v1',
        ok: true,
        status: buildWorklogStatus(options),
        docs_sync_plan: safeReadJson(path.join(artifactDir, DOCS_SYNC_PLAN_FILE), null),
        handoff: safeReadJson(path.join(artifactDir, HANDOFF_FILE.replace(/\.md$/, '.json')), null),
        latest_summary: fs.existsSync(path.join(worklogDir, LATEST_SUMMARY_FILE))
            ? fs.readFileSync(path.join(worklogDir, LATEST_SUMMARY_FILE), 'utf8')
            : null,
        authority_boundary: authorityBoundary(),
    };
}

module.exports = {
    CHECKPOINTS_FILE,
    CURRENT_WORK_FILE,
    DOCS_SYNC_PLAN_FILE,
    HANDOFF_FILE,
    HISTORY_FILE,
    LATEST_SUMMARY_FILE,
    NEXT_SESSION_FILE,
    WORKLOG_DIR,
    beginWorklog,
    buildHandoff,
    buildWorklogStatus,
    checkpointWorklog,
    finishWorklog,
    planDocsSync,
    readWorklogArtifacts,
    writeHandoff,
};
