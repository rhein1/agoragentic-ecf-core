'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { inspectAgentOsPreview } = require('./agent-os-preview');
const { rankRecords } = require('./core/ranking');
const { version: packageVersion } = require('../package.json');

const SERVER_NAME = 'agoragentic-ecf-core';
const SERVER_VERSION = packageVersion;

const TOOLS = [
    {
        name: 'ecf_core.search_context',
        description: 'Search compiled ECF Core context-packet sources with deterministic semantic-lite ranking.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                top_k: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
                ranking_provider: { type: 'string', enum: ['semantic_lite', 'lexical', 'local_vector'] },
            },
            required: ['query'],
        },
    },
    {
        name: 'ecf_core.get_source',
        description: 'Read one compiled source record by source_id or path from ECF Core artifacts.',
        inputSchema: {
            type: 'object',
            properties: {
                source_id: { type: 'string' },
                path: { type: 'string' },
            },
        },
    },
    {
        name: 'ecf_core.get_policy',
        description: 'Return the compiled ECF Core policy summary.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'ecf_core.get_manifest',
        description: 'Return the compiled ECF Core manifest and artifact counts.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'ecf_core.agent_os_preview_check',
        description: 'Run the local Agent OS preview-import readiness check over compiled artifacts.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
];

function readJson(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadArtifacts(artifactDir) {
    const resolvedDir = path.resolve(artifactDir || '.ecf-core');
    return {
        artifactDir: resolvedDir,
        contextPacket: readJson(path.join(resolvedDir, 'context-packet.json')),
        sourceMap: readJson(path.join(resolvedDir, 'source-map.json')),
        policySummary: readJson(path.join(resolvedDir, 'policy-summary.json')),
        manifest: readJson(path.join(resolvedDir, 'manifest.json')),
    };
}

function requireArtifact(value, name) {
    if (!value) {
        throw new Error(`${name} is missing. Run ecf-core compile . --agent-os first.`);
    }
}

function sourceRecords(contextPacket) {
    return (contextPacket.sources || []).map((source) => ({
        ...source,
        summary: source.summary || '',
        provenance: source.provenance || {},
    }));
}

function findCitation(contextPacket, sourceId) {
    return (contextPacket.citations || []).find((citation) => citation.source_id === sourceId) || null;
}

function searchContext(artifacts, args = {}) {
    requireArtifact(artifacts.contextPacket, 'context-packet.json');
    const query = String(args.query || '').trim();
    if (!query) throw new Error('query is required');
    const topLimit = Math.max(1, Math.min(Number(args.top_k || 5), 20));
    const records = sourceRecords(artifacts.contextPacket);
    const ranking = rankRecords(records, query, topLimit, { provider: args.ranking_provider || 'semantic_lite' });
    const ranked = ranking.hits.map((hit) => {
        const source = records.find((record) => record.id === hit.id);
        const citation = findCitation(artifacts.contextPacket, hit.id);
        return {
            source_id: hit.id,
            path: hit.path,
            score: hit.score,
            type: source?.type || null,
            summary: source?.summary || null,
            citation_id: citation?.id || null,
            provenance: source?.provenance || {},
        };
    });
    return {
        schema_version: 'ecf-core.mcp.search-result.v1',
        query,
        top_k: topLimit,
        ranking: {
            mode: ranking.ranking_mode,
            dependency_status: ranking.dependency_status,
        },
        results: ranked,
        boundary: {
            read_only: true,
            live_deploy_allowed: false,
            includes_wallet_or_settlement: false,
            includes_full_ecf_private_internals: false,
        },
    };
}

function getSource(artifacts, args = {}) {
    requireArtifact(artifacts.contextPacket, 'context-packet.json');
    const records = sourceRecords(artifacts.contextPacket);
    const source = records.find((record) => (
        (args.source_id && record.id === args.source_id)
        || (args.path && record.path === args.path)
    ));
    if (!source) {
        throw new Error('source not found by source_id or path');
    }
    return {
        schema_version: 'ecf-core.mcp.source.v1',
        source,
        citation: findCitation(artifacts.contextPacket, source.id),
        source_map_entry: (artifacts.sourceMap?.sources || []).find((record) => record.id === source.id) || null,
    };
}

function getPolicy(artifacts) {
    requireArtifact(artifacts.policySummary, 'policy-summary.json');
    return {
        schema_version: 'ecf-core.mcp.policy.v1',
        policy_summary: artifacts.policySummary,
        boundary: {
            read_only: true,
            hosted_runtime: false,
            wallet_settlement: false,
            marketplace_routing: false,
            full_ecf_private_internals: false,
        },
    };
}

function getManifest(artifacts) {
    requireArtifact(artifacts.manifest, 'manifest.json');
    return {
        schema_version: 'ecf-core.mcp.manifest.v1',
        manifest: artifacts.manifest,
    };
}

function callTool({ artifactDir, name, args }) {
    const artifacts = loadArtifacts(artifactDir);
    if (name === 'ecf_core.search_context') return searchContext(artifacts, args);
    if (name === 'ecf_core.get_source') return getSource(artifacts, args);
    if (name === 'ecf_core.get_policy') return getPolicy(artifacts);
    if (name === 'ecf_core.get_manifest') return getManifest(artifacts);
    if (name === 'ecf_core.agent_os_preview_check') return inspectAgentOsPreview(artifacts.artifactDir);
    throw new Error(`unknown tool: ${name}`);
}

function textResult(value) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(value, null, 2),
            },
        ],
    };
}

function errorResponse(id, error) {
    return {
        jsonrpc: '2.0',
        id,
        error: {
            code: -32000,
            message: error.message || String(error),
        },
    };
}

function handleMcpRequest(request, options = {}) {
    if (!request || request.jsonrpc !== '2.0') {
        throw new Error('invalid JSON-RPC request');
    }
    if (!Object.prototype.hasOwnProperty.call(request, 'id')) {
        return null;
    }
    if (request.method === 'initialize') {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: { listChanged: false },
                },
                serverInfo: {
                    name: SERVER_NAME,
                    version: SERVER_VERSION,
                },
            },
        };
    }
    if (request.method === 'tools/list') {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: { tools: TOOLS },
        };
    }
    if (request.method === 'tools/call') {
        const params = request.params || {};
        const value = callTool({
            artifactDir: options.artifactDir,
            name: params.name,
            args: params.arguments || {},
        });
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: textResult(value),
        };
    }
    throw new Error(`unsupported MCP method: ${request.method}`);
}

function runMcpServer(options = {}) {
    const artifactDir = path.resolve(options.artifactDir || '.ecf-core');
    const input = options.input || process.stdin;
    const output = options.output || process.stdout;
    const rl = readline.createInterface({ input });

    rl.on('line', (line) => {
        if (!line.trim()) return;
        let response = null;
        try {
            const request = JSON.parse(line);
            response = handleMcpRequest(request, { artifactDir });
        } catch (error) {
            let id = null;
            try {
                id = JSON.parse(line).id ?? null;
            } catch (_) {
                id = null;
            }
            response = errorResponse(id, error);
        }
        if (response) {
            output.write(`${JSON.stringify(response)}\n`);
        }
    });
}

module.exports = {
    TOOLS,
    callTool,
    handleMcpRequest,
    runMcpServer,
};
