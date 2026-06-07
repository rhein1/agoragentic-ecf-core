'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ContextAdapter } = require('./base');
const { walkFiles } = require('./filesystem');
const { sha256, sourceId } = require('../core/hash');
const { classifyPath, normalizePath } = require('../core/policy');

function parseJsonOpenApi(text) {
    try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || (!parsed.openapi && !parsed.swagger)) return null;
        const paths = Object.entries(parsed.paths || {});
        return paths.flatMap(([route, methods]) => Object.keys(methods || {}).map((method) => ({
            method: method.toUpperCase(),
            path: route,
        })));
    } catch {
        return null;
    }
}

function parseYamlOpenApi(text) {
    if (!/^\s*(openapi|swagger)\s*:/m.test(text)) return null;
    const endpoints = [];
    const lines = text.split(/\r?\n/);
    let inPaths = false;
    let currentPath = null;
    for (const line of lines) {
        if (/^paths\s*:\s*$/.test(line)) {
            inPaths = true;
            continue;
        }
        if (!inPaths) continue;
        const pathMatch = /^\s{2}(\/[^:]+):\s*$/.exec(line);
        if (pathMatch) {
            currentPath = pathMatch[1];
            continue;
        }
        const methodMatch = /^\s{4}(get|post|put|patch|delete|head|options):\s*$/i.exec(line);
        if (methodMatch && currentPath) {
            endpoints.push({
                method: methodMatch[1].toUpperCase(),
                path: currentPath,
            });
        }
    }
    return endpoints;
}

function extractOpenApiEndpoints(text, relativePath) {
    if (path.extname(relativePath).toLowerCase() === '.json') {
        return parseJsonOpenApi(text);
    }
    return parseYamlOpenApi(text);
}

class OpenApiAdapter extends ContextAdapter {
    constructor() {
        super({
            name: 'openapi',
            capabilities: ['api_surface_summary', 'openapi'],
        });
    }

    canHandle(input) {
        return Boolean(input && input.projectRoot && input.config?.adapters?.openapi?.enabled !== false);
    }

    async discover(input) {
        const { projectRoot, config } = input;
        const records = [];
        const fileInventory = input.fileInventory || walkFiles(projectRoot, config);
        for (const fullPath of fileInventory) {
            const relativePath = normalizePath(path.relative(projectRoot, fullPath));
            if (!/^[a-z0-9_-]*(?:openapi|swagger)[^.]*\.(?:json|ya?ml)$/i.test(path.basename(relativePath))) continue;
            const policy = classifyPath(relativePath, config);
            if (policy.classification !== 'allowed') continue;

            const raw = fs.readFileSync(fullPath);
            if (raw.length > config.max_file_bytes) continue;
            const text = raw.toString('utf8');
            const endpoints = extractOpenApiEndpoints(text, relativePath);
            if (!endpoints || endpoints.length === 0) continue;
            const summary = `OpenAPI summary: ${endpoints.slice(0, 30).map((endpoint) => `${endpoint.method} ${endpoint.path}`).join(', ')}.`;
            const virtualPath = `${relativePath}#openapi-summary`;
            records.push({
                id: sourceId(virtualPath),
                path: virtualPath,
                type: 'openapi_summary',
                classification: 'allowed',
                reason: 'API surface summary extracted from allowed OpenAPI document',
                hash: sha256(summary),
                summary,
                heading: 'OpenAPI summary',
                byte_count: Buffer.byteLength(summary),
                line_count: endpoints.length,
                provenance: {
                    adapter: this.name,
                    root: projectRoot,
                    source_kind: 'openapi_summary',
                    parent_path: relativePath,
                    endpoint_count: endpoints.length,
                },
            });
        }
        return records;
    }
}

module.exports = {
    OpenApiAdapter,
    extractOpenApiEndpoints,
};
