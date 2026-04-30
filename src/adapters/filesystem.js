'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ContextAdapter } = require('./base');
const { sha256, sourceId } = require('../core/hash');
const { classifyPath, normalizePath, shouldSkipDirectory } = require('../core/policy');

const TEXT_EXTENSIONS = new Set([
    '.cjs',
    '.css',
    '.csv',
    '.html',
    '.js',
    '.json',
    '.jsx',
    '.md',
    '.mjs',
    '.ps1',
    '.py',
    '.rb',
    '.rs',
    '.sh',
    '.sql',
    '.ts',
    '.tsx',
    '.txt',
    '.yaml',
    '.yml',
]);

function fileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.md') return 'markdown';
    if (ext === '.json') return 'json';
    if (ext === '.yaml' || ext === '.yml') return 'yaml';
    if (ext === '.sql') return 'sql';
    if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.rs', '.sh', '.ps1'].includes(ext)) return 'code';
    if (['.html', '.css'].includes(ext)) return 'web';
    if (['.txt', '.csv'].includes(ext)) return 'text';
    return 'file';
}

function isTextFile(filePath) {
    return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function summarizeJson(text) {
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return `JSON array with ${parsed.length} items.`;
        if (parsed && typeof parsed === 'object') return `JSON object with keys: ${Object.keys(parsed).slice(0, 12).join(', ')}.`;
    } catch {
        return null;
    }
    return null;
}

function firstMarkdownHeading(text) {
    const line = text.split(/\r?\n/).find((item) => /^#{1,6}\s+/.test(item.trim()));
    return line ? line.replace(/^#{1,6}\s+/, '').trim() : null;
}

function summarizeText(text, type) {
    if (type === 'json') {
        const jsonSummary = summarizeJson(text);
        if (jsonSummary) return jsonSummary;
    }
    const heading = firstMarkdownHeading(text);
    if (heading) return heading;
    const line = text
        .split(/\r?\n/)
        .map((item) => item.trim())
        .find(Boolean);
    if (!line) return 'Empty text file.';
    return line.length > 240 ? `${line.slice(0, 237)}...` : line;
}

function walkFiles(root, config, dir = root, output = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = normalizePath(path.relative(root, fullPath));
        if (entry.isDirectory()) {
            if (!shouldSkipDirectory(relativePath, config)) {
                walkFiles(root, config, fullPath, output);
            }
            continue;
        }
        if (entry.isFile()) output.push(fullPath);
    }
    return output;
}

class FilesystemAdapter extends ContextAdapter {
    constructor() {
        super({
            name: 'filesystem',
            capabilities: ['local_files', 'source_map', 'citations'],
        });
    }

    canHandle(input) {
        return Boolean(input && input.projectRoot && fs.existsSync(input.projectRoot));
    }

    async discover(input) {
        const { projectRoot, config } = input;
        const records = [];
        for (const fullPath of walkFiles(projectRoot, config)) {
            const relativePath = normalizePath(path.relative(projectRoot, fullPath));
            const stat = fs.statSync(fullPath);
            const policy = classifyPath(relativePath, config);
            const type = fileType(relativePath);
            const baseRecord = {
                id: sourceId(relativePath),
                path: relativePath,
                type,
                classification: policy.classification,
                reason: policy.reason,
                byte_count: stat.size,
                line_count: 0,
                provenance: {
                    adapter: this.name,
                    root: projectRoot,
                    source_kind: 'local_file',
                },
            };

            if (policy.classification !== 'allowed') {
                records.push({
                    ...baseRecord,
                    hash: sha256(`${policy.classification}:${relativePath}:${stat.size}:${Math.trunc(stat.mtimeMs)}`),
                    summary: policy.reason,
                });
                continue;
            }

            if (!isTextFile(relativePath)) {
                records.push({
                    ...baseRecord,
                    classification: 'review_required',
                    reason: 'allowed path matched, but file type is not text-readable by the baseline adapter',
                    hash: sha256(`review:${relativePath}:${stat.size}:${Math.trunc(stat.mtimeMs)}`),
                    summary: 'Non-text file requires an explicit adapter.',
                });
                continue;
            }

            const raw = fs.readFileSync(fullPath);
            if (raw.length > config.max_file_bytes) {
                records.push({
                    ...baseRecord,
                    classification: 'review_required',
                    reason: `file exceeds max_file_bytes=${config.max_file_bytes}`,
                    hash: sha256(`oversize:${relativePath}:${stat.size}:${Math.trunc(stat.mtimeMs)}`),
                    summary: 'Oversized file requires explicit review or a specialized adapter.',
                });
                continue;
            }

            const text = raw.toString('utf8');
            records.push({
                ...baseRecord,
                hash: sha256(text),
                summary: summarizeText(text, type),
                heading: firstMarkdownHeading(text),
                line_count: text.length ? text.split(/\r?\n/).length : 0,
            });
        }
        return records;
    }
}

module.exports = {
    FilesystemAdapter,
    fileType,
    isTextFile,
};
