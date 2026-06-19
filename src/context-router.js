'use strict';

const { sha256 } = require('./core/hash');
const { rankRecords } = require('./core/ranking');

function stableId(prefix, value) {
    return `${prefix}_${sha256(value).slice(0, 12)}`;
}

function normalizePath(input) {
    return String(input || '').replace(/\\/g, '/');
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function safeLine(line) {
    return String(line || '').slice(0, 400);
}

function normalizeTopK(topK, fallback = 5) {
    const value = Number(topK);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(1, Math.min(Math.floor(value), 20));
}

function limitUniqueResults(results, topK) {
    const seen = new Set();
    const output = [];
    for (const result of results) {
        const key = result.source_id || result.id || result.path;
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        output.push(result);
        if (output.length >= topK) break;
    }
    return output;
}

function capture(line, regex, type, output) {
    const match = safeLine(line).match(regex);
    if (!match || !match[1]) return;
    output.push({
        name: match[1],
        kind: type,
    });
}

function extractModule(line, regex, output) {
    const match = safeLine(line).match(regex);
    if (!match || !match[1]) return;
    output.push(match[1]);
}

function extractCodeFacts(text, sourcePath = '') {
    const symbols = [];
    const imports = [];
    const entrypoints = [];
    const lines = String(text || '').split(/\r?\n/);
    for (const rawLine of lines.slice(0, 2000)) {
        const line = safeLine(rawLine);
        capture(line, /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/, 'function', symbols);
        capture(line, /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/, 'class', symbols);
        capture(line, /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, 'function', symbols);
        capture(line, /^\s*def\s+([A-Za-z_][\w]*)\s*\(/, 'function', symbols);
        capture(line, /^\s*class\s+([A-Za-z_][\w]*)\b/, 'class', symbols);
        capture(line, /^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z_][\w]*)\s*\(/, 'function', symbols);
        capture(line, /^\s*type\s+([A-Za-z_][\w]*)\s+(?:struct|interface)\b/, 'type', symbols);
        capture(line, /^\s*(?:public|private|protected|internal|static|\s)*\s*(?:class|interface|enum|record)\s+([A-Za-z_][\w]*)\b/, 'type', symbols);
        capture(line, /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/, 'function', symbols);
        extractModule(line, /^\s*import\s+.*?\s+from\s+['"]([^'"]+)['"]/, imports);
        extractModule(line, /^\s*import\s+['"]([^'"]+)['"]/, imports);
        extractModule(line, /\brequire\(\s*['"]([^'"]+)['"]\s*\)/, imports);
        extractModule(line, /^\s*from\s+([A-Za-z0-9_.-]+)\s+import\s+/, imports);
        extractModule(line, /^\s*import\s+([A-Za-z0-9_.-]+)\s*$/, imports);
        extractModule(line, /^\s*using\s+([A-Za-z0-9_.]+)\s*;/, imports);
    }
    const pathLower = normalizePath(sourcePath).toLowerCase();
    if (/(^|\/)(index|main|app|server|agent|program)\.(js|mjs|cjs|ts|tsx|py|go|rs|cs|java)$/.test(pathLower)) {
        entrypoints.push('filename_entrypoint_hint');
    }
    return {
        symbols: unique(symbols.map((symbol) => `${symbol.kind}:${symbol.name}`)).map((item) => {
            const [kind, name] = item.split(':');
            return { name, kind };
        }),
        imports: unique(imports),
        entrypoints: unique(entrypoints),
    };
}

function buildCodeIndex({ contextPacket, createdAt }) {
    const sources = (contextPacket.sources || [])
        .filter((source) => source.type === 'code')
        .map((source) => {
            const facts = source.code_facts || extractCodeFacts(source.content_preview || '', source.path);
            return {
                source_id: source.id,
                path: source.path,
                hash: source.hash,
                symbols: facts.symbols || [],
                imports: facts.imports || [],
                entrypoints: facts.entrypoints || [],
                provenance: source.provenance || {},
            };
        });
    const symbolCount = sources.reduce((sum, source) => sum + source.symbols.length, 0);
    const importCount = sources.reduce((sum, source) => sum + source.imports.length, 0);
    return {
        schema_version: 'ecf-core.code-index.v1',
        generated_by: 'ecf-core',
        generated_at: createdAt,
        dependency_status: 'builtin_local_only',
        sources,
        summary: {
            source_count: sources.length,
            symbol_count: symbolCount,
            import_count: importCount,
            entrypoint_hint_count: sources.reduce((sum, source) => sum + source.entrypoints.length, 0),
        },
    };
}

function buildSourceManifest({ records, generatedRecords = [], walkState = {}, contextPacket, codeIndex, createdAt }) {
    const includedIds = new Set((contextPacket.sources || []).map((source) => source.id));
    const entries = records.map((record) => ({
        id: record.id,
        path: record.path,
        type: record.type,
        classification: record.classification,
        included_in_context_packet: includedIds.has(record.id),
        reason: record.reason,
        hash: record.hash,
        byte_count: record.byte_count || 0,
        line_count: record.line_count || 0,
        has_content_preview: Boolean(record.content_preview),
        has_code_facts: Boolean(record.code_facts),
        provenance: record.provenance || {},
    }));
    const generated = [
        ...generatedRecords.map((record) => ({
            path: record.path,
            type: record.type,
            reason: 'generated ECF artifact excluded from source stats',
        })),
        ...((walkState.generatedArtifactPaths || []).map((artifactPath) => ({
            path: artifactPath,
            type: 'directory',
            reason: 'generated ECF artifact directory skipped before adapter discovery',
        }))),
    ];
    return {
        schema_version: 'ecf-core.source-manifest.v1',
        generated_by: 'ecf-core',
        generated_at: createdAt,
        entries,
        generated_artifacts_excluded: generated,
        summary: {
            total_entries: entries.length,
            included_sources: entries.filter((entry) => entry.included_in_context_packet).length,
            blocked_sources: entries.filter((entry) => entry.classification === 'blocked').length,
            review_required_sources: entries.filter((entry) => entry.classification === 'review_required').length,
            generated_sources_excluded: generated.length,
            code_sources: codeIndex?.summary?.source_count || 0,
            code_symbols: codeIndex?.summary?.symbol_count || 0,
            secrets_blocked_by_default: entries.some((entry) => entry.classification === 'blocked' && /(^|\/)\.env(\.|$)?/.test(entry.path)),
        },
        boundary: {
            raw_blocked_source_content_included: false,
            generated_ecf_artifacts_indexed_as_sources: false,
            dependency_status: 'builtin_local_only',
        },
    };
}

function routeDefinitions() {
    return [
        {
            id: 'exact_text_lookup',
            strategy: 'exact_text_lookup',
            when: 'Use for quoted strings, policy sentences, and exact provenance lookups.',
            artifacts: ['context-packet.json', 'source-manifest.json'],
        },
        {
            id: 'policy_lookup',
            strategy: 'policy_lookup',
            when: 'Use for policy, PII, secrets, blocklist, approval, and boundary questions.',
            artifacts: ['policy-summary.json', 'source-map.json', 'source-manifest.json'],
        },
        {
            id: 'code_symbol_lookup',
            strategy: 'code_symbol_lookup',
            when: 'Use for code, function, class, import, entrypoint, and implementation questions.',
            artifacts: ['code-index.json', 'tree-index.json', 'context-packet.json'],
        },
        {
            id: 'source_manifest_query',
            strategy: 'source_manifest_query',
            when: 'Use for included/excluded file lists, source stats, hashes, and provenance coverage.',
            artifacts: ['source-manifest.json', 'manifest.json'],
        },
        {
            id: 'deterministic_stats',
            strategy: 'deterministic_stats',
            when: 'Use for counts and yes/no integrity checks that should not be generated from prose.',
            artifacts: ['manifest.json', 'source-manifest.json', 'code-index.json'],
        },
        {
            id: 'semantic_summary',
            strategy: 'semantic_summary',
            when: 'Use only after exact, policy, code, and manifest routes are not a better fit.',
            artifacts: ['context-packet.json', 'retrieval-plan.json'],
        },
    ];
}

function buildContextRouter({ sourceManifest, codeIndex, retrievalPlan, createdAt }) {
    return {
        schema_version: 'ecf-core.context-router.v1',
        generated_by: 'ecf-core',
        generated_at: createdAt,
        dependency_status: 'builtin_local_only',
        preferred_order: [
            'exact_text_lookup',
            'policy_lookup',
            'code_symbol_lookup',
            'source_manifest_query',
            'deterministic_stats',
            'semantic_summary',
        ],
        routes: routeDefinitions(),
        artifact_summary: {
            included_sources: sourceManifest?.summary?.included_sources || 0,
            blocked_sources: sourceManifest?.summary?.blocked_sources || 0,
            review_required_sources: sourceManifest?.summary?.review_required_sources || 0,
            code_sources: codeIndex?.summary?.source_count || 0,
            code_symbols: codeIndex?.summary?.symbol_count || 0,
            retrieval_queries: retrievalPlan?.summary?.query_count || 0,
        },
        sample_queries: [
            { query: 'Where does it say customer PII cannot leave the repo?', route: 'policy_lookup' },
            { query: 'What code files are indexed?', route: 'code_symbol_lookup' },
            { query: 'What files were blocked and why?', route: 'source_manifest_query' },
            { query: 'How many generated ECF artifacts were excluded?', route: 'deterministic_stats' },
        ],
        boundary: {
            read_only: true,
            raw_blocked_source_content_included: false,
            external_vector_or_llm_dependency: false,
            hosted_runtime: false,
            wallet_or_settlement: false,
            full_ecf_private_internals: false,
        },
    };
}

function classifyQuery(query) {
    const normalized = String(query || '').toLowerCase();
    if (/["'`].{6,}["'`]/.test(query) || normalized.includes('exact')) return 'exact_text_lookup';
    if (/\b(count|counts|stats?|statistics)\b/.test(normalized) || /\bhow many\b/.test(normalized)) return 'deterministic_stats';
    if (/\b(policy|pii|secret|blocked|blocklist|approval|boundary|allowed|customer)\b/.test(normalized)) return 'policy_lookup';
    if (/\b(code|function|class|import|entrypoint|symbol|agent\.js|implementation)\b/.test(normalized)) return 'code_symbol_lookup';
    if (/\b(files?|sources?|included|excluded|manifest|hash|provenance)\b/.test(normalized)) return 'source_manifest_query';
    if (/\bsummary\b/.test(normalized)) return 'deterministic_stats';
    return 'semantic_summary';
}

function sourceResults(contextPacket, query, topK, rankingProvider) {
    const records = contextPacket?.sources || [];
    const limit = normalizeTopK(topK);
    return rankRecords(records, query, limit, { provider: rankingProvider || 'semantic_lite' }).hits.map((hit) => {
        const source = records.find((record) => record.id === hit.id);
        return {
            source_id: hit.id,
            path: hit.path,
            score: hit.score,
            summary: source?.summary || null,
            content_preview: source?.content_preview || null,
            provenance: source?.provenance || {},
        };
    });
}

function extractExactNeedle(query) {
    const text = String(query || '');
    const quoted = text.match(/["'`]([^"'`]{6,400})["'`]/);
    if (quoted && quoted[1]) return quoted[1].trim();
    if (!/\bexact(?:ly)?\b/i.test(text)) return null;
    const cleaned = text
        .replace(/\b(?:find|lookup|search|show|match|exact|exactly|text|quote|quoted|string|for|the)\b/gi, ' ')
        .replace(/[?:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.length >= 6 ? cleaned : null;
}

function exactTextResults(contextPacket, query, topK) {
    const limit = normalizeTopK(topK);
    const needle = extractExactNeedle(query);
    if (!needle) {
        return {
            results: [],
            stats: {
                exact_text: {
                    exact_match_required: true,
                    needle_present: false,
                    matches: 0,
                },
            },
        };
    }
    const records = contextPacket?.sources || [];
    const results = records
        .filter((source) => [source.summary, source.content_preview].some((value) => String(value || '').includes(needle)))
        .map((source) => ({
            source_id: source.id,
            path: source.path,
            score: 1,
            summary: source.summary || null,
            content_preview: source.content_preview || null,
            provenance: source.provenance || {},
        }));
    return {
        results: results.slice(0, limit),
        stats: {
            exact_text: {
                exact_match_required: true,
                needle_present: true,
                matches: results.length,
            },
        },
    };
}

function manifestResult(entry, score = 1) {
    return {
        source_id: entry.id,
        path: entry.path,
        type: entry.type,
        classification: entry.classification,
        included_in_context_packet: entry.included_in_context_packet,
        reason: entry.reason,
        hash: entry.hash,
        score,
        provenance: entry.provenance || {},
    };
}

function policyResults(sourceManifest, contextPacket, query, topK, rankingProvider) {
    const limit = normalizeTopK(topK);
    const normalized = String(query || '').toLowerCase();
    const entries = sourceManifest?.entries || [];
    const wantsBlocked = /\b(blocked|blocklist|secret|secrets|env|excluded|denied|private)\b/.test(normalized);
    const wantsReview = /\b(review|approval|approve|boundary|allowed|allowlist|policy)\b/.test(normalized);
    const manifestEntries = entries.filter((entry) => {
        if (wantsBlocked) return entry.classification !== 'allowed';
        if (wantsReview) {
            return entry.classification !== 'allowed'
                || /\b(policy|privacy|security|governance|rules?)\b/i.test(entry.path)
                || entry.path.startsWith('docs/');
        }
        return entry.classification !== 'allowed';
    });
    const manifestRows = manifestEntries.map((entry) => manifestResult(entry, entry.classification === 'allowed' ? 0.5 : 1));
    const contextRows = sourceResults(contextPacket, query, limit, rankingProvider)
        .map((result) => ({ ...result, classification: 'allowed', included_in_context_packet: true }));
    const ordered = wantsBlocked ? [...manifestRows, ...contextRows] : [...contextRows, ...manifestRows];
    return limitUniqueResults(ordered, limit);
}

function codeResults(codeIndex, query, topK) {
    const limit = normalizeTopK(topK);
    const terms = String(query || '').toLowerCase().split(/[^a-z0-9_$.-]+/).filter(Boolean);
    const sources = codeIndex?.sources || [];
    const ranked = sources.map((source) => {
        const haystack = [
            source.path,
            ...(source.symbols || []).map((symbol) => `${symbol.kind} ${symbol.name}`),
            ...(source.imports || []),
            ...(source.entrypoints || []),
        ].join(' ').toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { ...source, score };
    }).filter((source) => source.score > 0)
        .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
        .slice(0, limit);
    if (ranked.length) return ranked;
    return sources
        .map((source) => ({ ...source, score: 0 }))
        .sort((a, b) => a.path.localeCompare(b.path))
        .slice(0, limit);
}

function manifestResults(sourceManifest, query, topK) {
    const limit = normalizeTopK(topK);
    const normalized = String(query || '').toLowerCase();
    const entries = sourceManifest?.entries || [];
    if (/\bblocked|excluded|secret|env\b/.test(normalized)) {
        return entries.filter((entry) => entry.classification !== 'allowed').slice(0, limit);
    }
    if (/\bcode|function|class|symbol\b/.test(normalized)) {
        return entries.filter((entry) => entry.type === 'code').slice(0, limit);
    }
    return entries.slice(0, limit);
}

function routeCompiledQuery({ query, contextPacket, sourceManifest, codeIndex, contextRouter, topK = 5, rankingProvider = 'semantic_lite' }) {
    const strategy = classifyQuery(query);
    const route = (contextRouter?.routes || routeDefinitions()).find((entry) => entry.id === strategy)
        || routeDefinitions().find((entry) => entry.id === 'semantic_summary');
    let results = [];
    let stats = null;
    if (strategy === 'code_symbol_lookup') {
        results = codeResults(codeIndex, query, topK);
    } else if (strategy === 'source_manifest_query') {
        results = manifestResults(sourceManifest, query, topK);
    } else if (strategy === 'deterministic_stats') {
        stats = {
            source_manifest: sourceManifest?.summary || null,
            code_index: codeIndex?.summary || null,
            context_router: contextRouter?.artifact_summary || null,
        };
    } else if (strategy === 'policy_lookup') {
        results = policyResults(sourceManifest, contextPacket, query, topK, rankingProvider);
        stats = {
            policy_lookup: {
                blocked_sources: sourceManifest?.summary?.blocked_sources || 0,
                review_required_sources: sourceManifest?.summary?.review_required_sources || 0,
                raw_blocked_source_content_included: false,
            },
        };
    } else if (strategy === 'exact_text_lookup') {
        const exact = exactTextResults(contextPacket, query, topK);
        results = exact.results;
        stats = exact.stats;
    } else {
        results = sourceResults(contextPacket, query, topK, rankingProvider);
    }
    return {
        schema_version: 'ecf-core.mcp.routed-query.v1',
        query,
        route: {
            id: route.id,
            strategy: route.strategy,
            reason: route.when,
        },
        results,
        stats,
        artifact_summary: contextRouter?.artifact_summary || null,
        boundary: {
            read_only: true,
            deterministic_router: true,
            external_llm_called: false,
            hosted_runtime: false,
            wallet_or_settlement: false,
            full_ecf_private_internals: false,
        },
    };
}

module.exports = {
    buildCodeIndex,
    buildContextRouter,
    buildSourceManifest,
    classifyQuery,
    extractCodeFacts,
    routeCompiledQuery,
};
