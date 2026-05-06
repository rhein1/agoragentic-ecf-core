'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ALLOW = [
    'README.md',
    'docs/**',
    'src/**',
    'schemas/**',
    'examples/**',
    'package.json',
    'schema.sql',
    '*.schema.sql',
    'openapi.json',
    'openapi.yaml',
    'openapi.yml',
    'swagger.json',
    'swagger.yaml',
    'swagger.yml',
    'mcp.json',
    '.mcp.json',
    '*.md',
    '*.json',
    '*.yaml',
    '*.yml',
];

const DEFAULT_BLOCK = [
    '.env',
    '.env.*',
    'secrets/**',
    '**/secrets/**',
    '**/*.pem',
    '**/*.key',
    '**/*.secret',
    'node_modules/**',
    '**/node_modules/**',
    '.git/**',
    '**/.git/**',
    '.ecf-core/**',
    '**/.ecf-core/**',
    '.micro-ecf/**',
    '**/.micro-ecf/**',
    '.venv/**',
    '**/.venv/**',
    'venv/**',
    '**/venv/**',
    '.deps*/**',
    '**/.deps*/**',
    '.worktrees/**',
    '**/.worktrees/**',
    '.tools/**',
    '**/.tools/**',
    'scratch/**',
    '**/scratch/**',
    'temp/**',
    '**/temp/**',
    'temp-*/**',
    '**/temp-*/**',
    'temp_*/**',
    '**/temp_*/**',
    'logs/**',
    '**/logs/**',
    'tmp/**',
    '**/tmp/**',
    '.tmp/**',
    '**/.tmp/**',
    '.cache/**',
    '**/.cache/**',
    '.pytest_cache/**',
    '**/.pytest_cache/**',
    '__pycache__/**',
    '**/__pycache__/**',
    'dist/**',
    '**/dist/**',
    'build/**',
    '**/build/**',
    'coverage/**',
    '**/coverage/**',
    '*.db',
    '*.sqlite',
    '*.sqlite3',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.webp',
    '*.pdf',
    '*.zip',
    '*.tar',
    '*.gz',
    '*.exe',
    '*.dll',
];

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function createDefaultConfig(options = {}) {
    return {
        schema_version: 'ecf-core.local-config.v1',
        project_name: options.projectName || 'local-project',
        scope: options.scope || 'local_project',
        allow: [...DEFAULT_ALLOW],
        block: [...DEFAULT_BLOCK],
        max_file_bytes: 65536,
        adapters: {
            filesystem: { enabled: true },
            markdown_docs: { enabled: true },
            sqlite_summary: { enabled: true },
            openapi: { enabled: true },
            mcp_context: { enabled: true },
        },
        context_index_providers: [
            {
                provider_id: 'ecf_core_local_context_index',
                type: 'page_index',
                mode: 'local_adapter',
                capabilities: [
                    'page_structure',
                    'tree_search',
                    'doc_search',
                    'agentic_retrieval',
                    'vectorless_retrieval',
                ],
                outputs: [
                    'page-index.json',
                    'tree-index.json',
                    'retrieval-plan.json',
                ],
            },
        ],
        eval: {
            queries: [
                'context policy',
                'agent os handoff',
                'openapi',
                'sqlite schema',
            ],
            top_k: 3,
            semantic_lite: true,
            grounding_enabled: false,
            grounding_required: true,
            max_retries: 2,
            rewrite_enabled: true,
            unsupported_response: "I don't know based on the allowed context.",
            grounding_queries: [],
            compression: {
                enabled: true,
                max_summary_chars: 96,
            },
        },
        tool_limits: {
            max_calls: 10,
            network_allowed: false,
            write_allowed: false,
        },
        handoff: {
            agent_os_preview_allowed: true,
            live_deploy_allowed: false,
        },
    };
}

function normalizeConfig(raw = {}, options = {}) {
    const defaults = createDefaultConfig(options);
    const config = {
        ...defaults,
        ...raw,
        allow: unique(Array.isArray(raw.allow) ? raw.allow : defaults.allow),
        block: unique([...defaults.block, ...(Array.isArray(raw.block) ? raw.block : [])]),
        tool_limits: {
            ...defaults.tool_limits,
            ...(raw.tool_limits || {}),
        },
        adapters: {
            ...defaults.adapters,
            ...(raw.adapters || {}),
        },
        context_index_providers: Array.isArray(raw.context_index_providers)
            ? raw.context_index_providers
            : defaults.context_index_providers,
        eval: {
            ...defaults.eval,
            ...(raw.eval || {}),
        },
        handoff: {
            ...defaults.handoff,
            ...(raw.handoff || {}),
            live_deploy_allowed: false,
        },
    };

    if (!['local_project', 'self_hosted_workspace', 'agent_os_preview'].includes(config.scope)) {
        config.scope = 'local_project';
    }
    config.max_file_bytes = Number.isFinite(Number(config.max_file_bytes))
        ? Math.max(1024, Number(config.max_file_bytes))
        : defaults.max_file_bytes;
    return config;
}

function loadConfig(options = {}) {
    const projectRoot = path.resolve(options.projectRoot || '.');
    const configPath = options.configPath
        ? path.resolve(options.configPath)
        : path.join(projectRoot, 'ecf.config.json');
    if (!fs.existsSync(configPath)) {
        return normalizeConfig({}, { projectName: path.basename(projectRoot) || 'local-project' });
    }
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return normalizeConfig(raw, { projectName: raw.project_name || path.basename(projectRoot) || 'local-project' });
}

module.exports = {
    DEFAULT_ALLOW,
    DEFAULT_BLOCK,
    createDefaultConfig,
    loadConfig,
    normalizeConfig,
};
