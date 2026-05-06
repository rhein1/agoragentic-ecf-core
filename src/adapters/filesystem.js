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

function recordSkippedDirectory(root, dir, error, state) {
    if (!state || !Array.isArray(state.skippedDirectories)) return;
    state.skippedDirectories.push({
        path: normalizePath(path.relative(root, dir)),
        code: error.code || 'unreadable',
        reason: error.message,
    });
}

function isNestedGitRepository(root, dir) {
    if (path.resolve(root) === path.resolve(dir)) return false;
    try {
        return fs.existsSync(path.join(dir, '.git'));
    } catch {
        return false;
    }
}

function walkFiles(root, config, dir = root, output = [], state = null) {
    let entries = [];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        recordSkippedDirectory(root, dir, error, state);
        return output;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = normalizePath(path.relative(root, fullPath));
        if (entry.isDirectory()) {
            if (!shouldSkipDirectory(relativePath, config) && !isNestedGitRepository(root, fullPath)) {
                walkFiles(root, config, fullPath, output, state);
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
        const fileInventory = input.fileInventory || walkFiles(projectRoot, config);
        for (const fullPath of fileInventory) {
            const relativePath = normalizePath(path.relative(projectRoot, fullPath));
            let stat;
            try {
                stat = fs.statSync(fullPath);
            } catch (error) {
                records.push({
                    id: sourceId(relativePath),
                    path: relativePath,
                    type: fileType(relativePath),
                    classification: 'review_required',
                    reason: `file metadata could not be read: ${error.code || 'unreadable'}`,
                    byte_count: 0,
                    line_count: 0,
                    hash: sha256(`stat-error:${relativePath}:${error.code || error.message}`),
                    summary: 'File metadata requires explicit review before inclusion.',
                    provenance: {
                        adapter: this.name,
                        root: projectRoot,
                        source_kind: 'local_file',
                    },
                });
                continue;
            }
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

            let raw;
            try {
                raw = fs.readFileSync(fullPath);
            } catch (error) {
                records.push({
                    ...baseRecord,
                    classification: 'review_required',
                    reason: `allowed path matched, but file could not be read: ${error.code || 'unreadable'}`,
                    hash: sha256(`read-error:${relativePath}:${stat.size}:${Math.trunc(stat.mtimeMs)}:${error.code || error.message}`),
                    summary: 'Unreadable file requires explicit review before inclusion.',
                });
                continue;
            }
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
    summarizeText,
    walkFiles,
};
