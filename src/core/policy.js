'use strict';

const path = require('node:path');

function normalizePath(input) {
    return String(input || '')
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '');
}

function escapeRegex(value) {
    return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegex(pattern) {
    const normalized = normalizePath(pattern);
    let out = '^';
    for (let i = 0; i < normalized.length; i += 1) {
        const char = normalized[i];
        const next = normalized[i + 1];
        if (char === '*' && next === '*') {
            out += '.*';
            i += 1;
        } else if (char === '*') {
            out += '[^/]*';
        } else if (char === '?') {
            out += '[^/]';
        } else {
            out += escapeRegex(char);
        }
    }
    out += '$';
    return new RegExp(out);
}

function matchesPattern(relativePath, pattern) {
    const normalizedPath = normalizePath(relativePath);
    const normalizedPattern = normalizePath(pattern);
    if (!normalizedPattern) return false;
    if (normalizedPattern.endsWith('/**')) {
        const prefix = normalizedPattern.slice(0, -3);
        if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) return true;
    }
    const basename = path.posix.basename(normalizedPath);
    const target = normalizedPattern.includes('/') ? normalizedPath : basename;
    return globToRegex(normalizedPattern).test(target) || globToRegex(normalizedPattern).test(normalizedPath);
}

function matchesAny(relativePath, patterns = []) {
    return patterns.some((pattern) => matchesPattern(relativePath, pattern));
}

const DEFAULT_SKIP_DIRECTORIES = [
    '.git/**',
    '**/.git/**',
    'node_modules/**',
    '**/node_modules/**',
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
];

function classifyPath(relativePath, config) {
    const normalized = normalizePath(relativePath);
    if (matchesAny(normalized, config.block)) {
        return {
            classification: 'blocked',
            reason: 'matched block policy',
        };
    }
    if (matchesAny(normalized, config.allow)) {
        return {
            classification: 'allowed',
            reason: 'matched allow policy',
        };
    }
    return {
        classification: 'review_required',
        reason: 'not matched by allow policy',
    };
}

function shouldSkipDirectory(relativePath, config) {
    const normalized = normalizePath(relativePath);
    if (!normalized) return false;
    return matchesAny(`${normalized}/placeholder`, config.block)
        || matchesAny(`${normalized}/placeholder`, DEFAULT_SKIP_DIRECTORIES)
        || matchesAny(`${normalized}/`, DEFAULT_SKIP_DIRECTORIES);
}

module.exports = {
    classifyPath,
    DEFAULT_SKIP_DIRECTORIES,
    globToRegex,
    matchesAny,
    matchesPattern,
    normalizePath,
    shouldSkipDirectory,
};
