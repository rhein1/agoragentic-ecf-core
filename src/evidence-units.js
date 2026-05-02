'use strict';

const { sha256 } = require('./core/hash');
const { rankRecords, rankingOptionsFromConfig } = require('./core/ranking');

function byteLength(value) {
    return Buffer.byteLength(String(value || ''), 'utf8');
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function firstSentence(value) {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
    return match ? match[1].trim() : normalized;
}

function compact(value, maxChars = 220) {
    const normalized = normalizeText(value);
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function claimFingerprint(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2)
        .sort()
        .join(' ');
}

function sourceBytes(source) {
    return byteLength(JSON.stringify({
        id: source.id,
        path: source.path,
        type: source.type,
        hash: source.hash,
        heading: source.heading || null,
        summary: source.summary || '',
        provenance: source.provenance || {},
    }));
}

function unitBytes(unit) {
    return byteLength(JSON.stringify({
        unit_id: unit.unit_id,
        source_id: unit.source_id,
        source_path: unit.source_path,
        claim: unit.claim,
        supported_answer: unit.supported_answer,
        citations: unit.citations,
        policy: unit.policy,
        hash: unit.hash,
    }));
}

function buildContextEvidenceUnits({ contextPacket, createdAt = new Date().toISOString() }) {
    const citationsBySource = new Map((contextPacket.citations || []).map((citation) => [citation.source_id, citation]));
    const units = (contextPacket.sources || []).map((source) => {
        const citation = citationsBySource.get(source.id);
        const claim = firstSentence(source.summary) || `Source ${source.path} is available as allowed local context.`;
        const supportedAnswer = compact(source.summary || claim);
        const hash = sha256(`${source.id}:${source.hash}:${claim}:${supportedAnswer}`);
        return {
            unit_id: `ceu_${hash.slice(0, 16)}`,
            source_id: source.id,
            source_path: source.path,
            source_type: source.type,
            claim,
            supported_answer: supportedAnswer,
            summary: `${claim} ${supportedAnswer}`,
            citations: citation ? [citation.path] : [],
            citation_labels: citation?.label ? [citation.label] : [],
            policy: {
                allowed_for_agent: true,
                public_safe: true,
                requires_review: false,
                live_deploy_allowed: false,
            },
            provenance: source.provenance || {},
            hash,
            created_at: createdAt,
        };
    });

    return {
        schema_version: 'ecf-core.context-evidence-units.v1',
        generated_by: 'ecf-core',
        created_at: createdAt,
        source_count: contextPacket.sources.length,
        unit_count: units.length,
        units,
    };
}

function groupDuplicates(units) {
    const groups = new Map();
    for (const unit of units) {
        const key = claimFingerprint(unit.claim);
        if (!key) continue;
        const group = groups.get(key) || [];
        group.push(unit);
        groups.set(key, group);
    }
    return [...groups.values()].filter((group) => group.length > 1);
}

function buildContextCompactionReport({ contextPacket, evidenceUnits, queries = [], topKSize = 3, evalConfig = {} }) {
    const units = evidenceUnits.units || [];
    const duplicateGroups = groupDuplicates(units);
    const sourceTotalBytes = (contextPacket.sources || []).reduce((sum, source) => sum + sourceBytes(source), 0);
    const unitTotalBytes = units.reduce((sum, unit) => sum + unitBytes(unit), 0);
    const compressionRatio = unitTotalBytes > 0 ? sourceTotalBytes / unitTotalBytes : 1;
    const citationSurvival = units.length ? units.filter((unit) => unit.citations.length > 0).length / units.length : 1;
    const rankingOptions = rankingOptionsFromConfig(evalConfig);
    const retrievalQueries = queries.map((query) => {
        const baseline = rankRecords(contextPacket.sources || [], query, topKSize, rankingOptions);
        const compacted = rankRecords(units.map((unit) => ({
            id: unit.source_id,
            path: unit.source_path,
            type: unit.source_type,
            summary: `${unit.claim} ${unit.supported_answer}`,
            provenance: unit.provenance,
        })), query, topKSize, rankingOptions);
        const compactedIds = new Set(compacted.hits.map((item) => item.id));
        const preserved = baseline.hits.filter((item) => compactedIds.has(item.id)).length;
        const preservation = baseline.hits.length ? preserved / baseline.hits.length : 1;
        return {
            query,
            preservation: Number(preservation.toFixed(4)),
            baseline_top_paths: baseline.hits.map((item) => item.path),
            evidence_unit_top_paths: compacted.hits.map((item) => item.path),
        };
    });
    const preservationAverage = retrievalQueries.length
        ? retrievalQueries.reduce((sum, query) => sum + query.preservation, 0) / retrievalQueries.length
        : 1;

    return {
        schema_version: 'ecf-core.context-compaction-report.v1',
        strategy: 'deterministic_context_evidence_units',
        dependency_status: 'baseline_only',
        input_source_count: contextPacket.sources.length,
        evidence_unit_count: units.length,
        duplicate_claim_count: duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0),
        duplicate_claim_groups: duplicateGroups.map((group) => ({
            claim: group[0].claim,
            source_paths: group.map((unit) => unit.source_path),
        })),
        repeated_boilerplate_count: duplicateGroups.length,
        compression_ratio: Number(compressionRatio.toFixed(4)),
        citation_survival: Number(citationSurvival.toFixed(4)),
        retrieval_preservation: {
            top_k: topKSize,
            average_preservation: Number(preservationAverage.toFixed(4)),
            queries: retrievalQueries,
        },
        verdict: citationSurvival >= 0.95 && preservationAverage >= 0.95 ? 'pass' : 'review',
    };
}

module.exports = {
    buildContextCompactionReport,
    buildContextEvidenceUnits,
};

