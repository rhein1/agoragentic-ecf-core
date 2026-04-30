'use strict';

const { topK } = require('./core/ranking');

function byteLength(value) {
    return Buffer.byteLength(String(value || ''), 'utf8');
}

function compactSummary(value, maxChars) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function median(values) {
    if (values.length === 0) return 1;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
    if (values.length === 0) return 1;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sourceRepresentation(source) {
    return JSON.stringify({
        id: source.id,
        path: source.path,
        type: source.type,
        hash: source.hash,
        heading: source.heading || null,
        summary: source.summary || '',
        provenance: source.provenance || {},
    });
}

function buildCompressedSources(sources, options = {}) {
    const configuredMax = options.maxSummaryChars ?? options.max_summary_chars;
    const maxSummaryChars = Number.isFinite(Number(configuredMax))
        ? Math.max(24, Number(configuredMax))
        : 96;
    return sources.map((source) => ({
        id: source.id,
        path: source.path,
        type: source.type,
        hash: source.hash,
        heading: source.heading || null,
        summary: compactSummary(source.summary || '', maxSummaryChars),
        provenance: source.provenance,
        citation_label: source.citation_label,
    }));
}

function evaluateCompressionExperiment({ contextPacket, queries = [], topKSize = 3, options = {} }) {
    const baselineSources = contextPacket.sources.map((source) => ({
        ...source,
        citation_label: contextPacket.citations.find((citation) => citation.source_id === source.id)?.label || null,
    }));
    const compressedSources = buildCompressedSources(baselineSources, options);
    const ratios = baselineSources.map((source, index) => {
        const baselineBytes = Math.max(1, byteLength(sourceRepresentation(source)));
        const compressedBytes = Math.max(1, byteLength(sourceRepresentation(compressedSources[index])));
        return baselineBytes / compressedBytes;
    });
    const queryReports = queries.map((query) => {
        const baselineTop = topK(baselineSources, query, topKSize, { semanticLite: true });
        const compressedTop = topK(compressedSources, query, topKSize, { semanticLite: true });
        const compressedIds = new Set(compressedTop.map((item) => item.id));
        const preserved = baselineTop.filter((item) => compressedIds.has(item.id)).length;
        const preservation = baselineTop.length ? preserved / baselineTop.length : 1;
        return {
            query,
            preservation: Number(preservation.toFixed(4)),
            baseline_top_paths: baselineTop.map((item) => item.path),
            compressed_top_paths: compressedTop.map((item) => item.path),
        };
    });
    const citationCoverage = compressedSources.length
        ? compressedSources.filter((source) => source.citation_label).length / compressedSources.length
        : 1;
    const provenanceCoverage = compressedSources.length
        ? compressedSources.filter((source) => source.provenance?.adapter && source.hash).length / compressedSources.length
        : 1;
    const preservationAverage = average(queryReports.map((query) => query.preservation));
    const medianRatio = median(ratios);

    return {
        enabled: true,
        strategy: 'deterministic_summary_compaction',
        dependency_status: 'baseline_only',
        source_count: baselineSources.length,
        median_compression_ratio: Number(medianRatio.toFixed(4)),
        average_compression_ratio: Number(average(ratios).toFixed(4)),
        citation_survival: Number(citationCoverage.toFixed(4)),
        provenance_preservation: Number(provenanceCoverage.toFixed(4)),
        retrieval_preservation: {
            top_k: topKSize,
            average_preservation: Number(preservationAverage.toFixed(4)),
            queries: queryReports,
        },
        verdict: citationCoverage >= 0.95 && provenanceCoverage >= 0.95 && preservationAverage >= 0.95
            ? 'pass'
            : 'review',
    };
}

module.exports = {
    buildCompressedSources,
    evaluateCompressionExperiment,
};
