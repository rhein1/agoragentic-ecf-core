'use strict';

const DEFAULT_SYNONYMS = {
    api: ['openapi', 'swagger', 'endpoint', 'route'],
    database: ['sqlite', 'schema', 'table', 'db'],
    deploy: ['deployment', 'handoff', 'preview', 'agent', 'os'],
    governance: ['policy', 'boundary', 'allowed', 'blocked', 'control'],
    memory: ['context', 'source', 'citation', 'provenance'],
    refund: ['payment', 'billing', 'invoice', 'charge'],
    security: ['secret', 'secrets', 'credential', 'key', 'blocked'],
};

const EXTERNAL_RANKING_PROVIDERS = new Set([
    'qdrant',
    'chroma',
    'gitnexus_code_graph',
    'mcp_context_provider',
]);

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

function hashToken(token) {
    let hash = 2166136261;
    for (const char of String(token)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function vectorize(value, options = {}) {
    const dimensions = Math.max(8, Math.min(Number(options.dimensions || 64), 512));
    const tokens = expandTokens(tokenize(value), options.synonyms);
    const vector = Array.from({ length: dimensions }, () => 0);
    for (const token of tokens) {
        const index = hashToken(token) % dimensions;
        vector[index] += 1;
    }
    return vector;
}

function cosineSimilarity(left, right) {
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
        dot += left[index] * right[index];
        leftNorm += left[index] * left[index];
        rightNorm += right[index] * right[index];
    }
    if (!leftNorm || !rightNorm) return 0;
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function scoreLocalVector(query, record, options = {}) {
    return cosineSimilarity(
        vectorize(query, options),
        vectorize(recordText(record), options),
    );
}

function normalizeProvider(value) {
    return String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function rankingOptionsFromConfig(evalConfig = {}) {
    const ranking = evalConfig.ranking || {};
    const provider = normalizeProvider(ranking.provider || ranking.mode);
    return {
        ...ranking,
        provider: provider || (evalConfig.semantic_lite === false ? 'lexical' : 'semantic_lite'),
        semanticLite: evalConfig.semantic_lite !== false,
    };
}

function sortHits(hits) {
    return hits
        .filter((record) => record.score > 0)
        .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

function builtInRank(records, query, k, options = {}) {
    const provider = normalizeProvider(options.provider);
    const useVector = provider === 'local_vector';
    const semanticLite = provider === 'lexical' ? false : options.semanticLite !== false;
    const hits = records.map((record) => ({
        id: record.id,
        path: record.path,
        score: useVector ? scoreLocalVector(query, record, options) : scoreRecord(query, record, { ...options, semanticLite }),
    }));
    return {
        hits: sortHits(hits).slice(0, k),
        ranking_mode: useVector ? 'local_vector' : (semanticLite ? 'semantic_lite' : 'lexical'),
        dependency_status: 'builtin',
    };
}

function precomputedRank(records, query, k, options = {}) {
    const results = options.precomputed_results || options.results || {};
    const queryKey = String(query || '');
    const configured = results[queryKey] || results[queryKey.toLowerCase()] || [];
    const byId = new Map(records.map((record) => [record.id, record]));
    const byPath = new Map(records.map((record) => [record.path, record]));
    const hits = [];
    configured.forEach((item, index) => {
        const key = typeof item === 'string'
            ? item
            : (item.id || item.source_id || item.path);
        const record = byId.get(key) || byPath.get(key);
        if (!record) return;
        hits.push({
            id: record.id,
            path: record.path,
            score: Number.isFinite(Number(item.score)) ? Number(item.score) : Number((1 - (index * 0.01)).toFixed(4)),
        });
    });
    return hits.slice(0, k);
}

function rankRecords(records, query, k, options = {}) {
    const provider = normalizeProvider(options.provider || options.mode || (options.semanticLite === false ? 'lexical' : 'semantic_lite'));
    if (provider === 'semantic_lite' || provider === 'lexical' || provider === 'local_vector') {
        return builtInRank(records, query, k, { ...options, provider });
    }
    if (EXTERNAL_RANKING_PROVIDERS.has(provider)) {
        const hits = precomputedRank(records, query, k, options);
        if (hits.length > 0) {
            return {
                hits,
                ranking_mode: provider,
                dependency_status: `${provider}_adapter_configured`,
            };
        }
        const fallback = normalizeProvider(options.fallback || 'semantic_lite');
        const fallbackResult = builtInRank(records, query, k, {
            ...options,
            provider: fallback === 'lexical' ? 'lexical' : 'semantic_lite',
            semanticLite: fallback !== 'lexical',
        });
        return {
            hits: fallbackResult.hits,
            ranking_mode: `${provider}_fallback_${fallbackResult.ranking_mode}`,
            dependency_status: `${provider}_adapter_skipped`,
        };
    }
    return builtInRank(records, query, k, options);
}

function topK(records, query, k, options = {}) {
    return rankRecords(records, query, k, options).hits;
}

module.exports = {
    DEFAULT_SYNONYMS,
    EXTERNAL_RANKING_PROVIDERS,
    expandTokens,
    rankRecords,
    rankingOptionsFromConfig,
    scoreRecord,
    scoreLocalVector,
    tokenize,
    topK,
};
