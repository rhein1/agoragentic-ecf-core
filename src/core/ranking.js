'use strict';

const DEFAULT_SYNONYMS = {
    api: ['openapi', 'swagger', 'endpoint', 'route'],
    database: ['sqlite', 'schema', 'table', 'db'],
    deploy: ['deployment', 'handoff', 'preview', 'agent', 'os'],
    governance: ['policy', 'boundary', 'allowed', 'blocked', 'control'],
    memory: ['context', 'source', 'citation', 'provenance'],
    security: ['secret', 'secrets', 'credential', 'key', 'blocked'],
};

function tokenize(value) {
    return new Set(String(value || '').toLowerCase().split(/[^a-z0-9_/-]+/).filter((token) => token.length > 1));
}

function expandTokens(tokens, synonyms = DEFAULT_SYNONYMS) {
    const expanded = new Set(tokens);
    for (const token of tokens) {
        for (const [root, related] of Object.entries(synonyms)) {
            if (token === root || related.includes(token)) {
                expanded.add(root);
                for (const synonym of related) expanded.add(synonym);
            }
        }
    }
    return expanded;
}

function recordText(record) {
    return [
        record.path,
        record.type,
        record.summary,
        record.heading,
        record.provenance?.adapter,
        record.provenance?.source_type,
    ].filter(Boolean).join(' ');
}

function scoreRecord(query, record, options = {}) {
    const semanticLite = options.semanticLite !== false;
    const queryTokens = semanticLite ? expandTokens(tokenize(query), options.synonyms) : tokenize(query);
    if (queryTokens.size === 0) return 0;
    const haystack = semanticLite ? expandTokens(tokenize(recordText(record)), options.synonyms) : tokenize(recordText(record));
    let matches = 0;
    for (const token of queryTokens) {
        if (haystack.has(token)) matches += 1;
    }
    return matches / queryTokens.size;
}

function topK(records, query, k, options = {}) {
    return records
        .map((record) => ({ id: record.id, path: record.path, score: scoreRecord(query, record, options) }))
        .filter((record) => record.score > 0)
        .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
        .slice(0, k);
}

module.exports = {
    DEFAULT_SYNONYMS,
    expandTokens,
    scoreRecord,
    tokenize,
    topK,
};
