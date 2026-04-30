'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { compileProject } = require('./compile');
const { matchesAny } = require('./core/policy');

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, value);
}

function tokenize(value) {
    return new Set(String(value || '').toLowerCase().split(/[^a-z0-9_/-]+/).filter((token) => token.length > 1));
}

function scoreRecord(query, record) {
    const queryTokens = tokenize(query);
    if (queryTokens.size === 0) return 0;
    const haystack = tokenize(`${record.path} ${record.type} ${record.summary || ''} ${record.heading || ''}`);
    let matches = 0;
    for (const token of queryTokens) {
        if (haystack.has(token)) matches += 1;
    }
    return matches / queryTokens.size;
}

function topK(records, query, k) {
    return records
        .map((record) => ({ id: record.id, path: record.path, score: scoreRecord(query, record) }))
        .filter((record) => record.score > 0)
        .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
        .slice(0, k);
}

function average(values) {
    if (values.length === 0) return 1;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function markdownReport(summary) {
    const lines = [
        '# ECF Core Evaluation Report',
        '',
        `Verdict: **${summary.verdict}**`,
        '',
        '## Metrics',
        '',
        `- Policy block pass: ${summary.metrics.policy_block.pass}`,
        `- Blocked sources excluded: ${summary.metrics.policy_block.blocked_sources_excluded}`,
        `- Citation coverage: ${summary.metrics.citation_survival.coverage}`,
        `- Structural provenance coverage: ${summary.metrics.structural_preservation.provenance_coverage}`,
        `- Retrieval preservation@${summary.metrics.retrieval_preservation.top_k}: ${summary.metrics.retrieval_preservation.average_preservation}`,
        '',
        '## Queries',
        '',
        ...summary.metrics.retrieval_preservation.queries.map((query) => (
            `- ${query.query}: preservation=${query.preservation}, baseline=${query.baseline_top_paths.join(', ') || 'none'}`
        )),
        '',
        '## Boundary',
        '',
        '- No hosted Agent OS runtime included.',
        '- No wallet, x402, or settlement authority included.',
        '- No Full ECF private internals included.',
    ];
    return `${lines.join('\n')}\n`;
}

function evaluateCompiled({ result, topKSize }) {
    const allowedRecords = result.records.filter((record) => record.classification === 'allowed');
    const packetSourceIds = new Set(result.contextPacket.sources.map((source) => source.id));
    const citationSourceIds = new Set(result.contextPacket.citations.map((citation) => citation.source_id));
    const blockedSourceIds = new Set(result.sourceMap.sources.filter((source) => source.classification === 'blocked').map((source) => source.id));
    const blockedInPacket = result.contextPacket.sources.filter((source) => blockedSourceIds.has(source.id));
    const blockPatternHits = result.contextPacket.sources.filter((source) => matchesAny(source.path, result.config.block));
    const sourcesWithCitations = result.contextPacket.sources.filter((source) => citationSourceIds.has(source.id));
    const sourcesWithProvenance = result.contextPacket.sources.filter((source) => source.provenance?.adapter && source.hash);
    const queries = Array.isArray(result.config.eval?.queries) ? result.config.eval.queries : [];
    const retrievalQueries = queries.map((query) => {
        const baselineTop = topK(allowedRecords, query, topKSize);
        const packetTop = topK(result.contextPacket.sources, query, topKSize);
        const packetIds = new Set(packetTop.map((item) => item.id));
        const preserved = baselineTop.filter((item) => packetIds.has(item.id)).length;
        const preservation = baselineTop.length ? preserved / baselineTop.length : 1;
        return {
            query,
            preservation: Number(preservation.toFixed(4)),
            baseline_top_paths: baselineTop.map((item) => item.path),
            packet_top_paths: packetTop.map((item) => item.path),
        };
    });
    const retrievalAverage = average(retrievalQueries.map((query) => query.preservation));
    const citationCoverage = result.contextPacket.sources.length
        ? sourcesWithCitations.length / result.contextPacket.sources.length
        : 1;
    const provenanceCoverage = result.contextPacket.sources.length
        ? sourcesWithProvenance.length / result.contextPacket.sources.length
        : 1;
    const policyPass = blockedInPacket.length === 0 && blockPatternHits.length === 0;
    const verdict = policyPass
        && citationCoverage >= 0.95
        && provenanceCoverage >= 0.95
        && retrievalAverage >= 0.95
        ? 'pass'
        : 'review';

    return {
        schema_version: 'ecf-core.eval-report.v1',
        verdict,
        metrics: {
            policy_block: {
                pass: policyPass,
                blocked_sources_excluded: blockedInPacket.length === 0,
                blocked_source_count: blockedSourceIds.size,
                blocked_in_packet: blockedInPacket.map((source) => source.path),
                blocked_pattern_hits: blockPatternHits.map((source) => source.path),
            },
            citation_survival: {
                coverage: Number(citationCoverage.toFixed(4)),
                cited_sources: sourcesWithCitations.length,
                total_sources: result.contextPacket.sources.length,
            },
            structural_preservation: {
                provenance_coverage: Number(provenanceCoverage.toFixed(4)),
                sources_with_provenance: sourcesWithProvenance.length,
                total_sources: result.contextPacket.sources.length,
            },
            retrieval_preservation: {
                top_k: topKSize,
                average_preservation: Number(retrievalAverage.toFixed(4)),
                queries: retrievalQueries,
            },
        },
        files: result.manifest.files,
    };
}

async function runEvaluation(options = {}) {
    const projectRoot = path.resolve(options.projectRoot || '.');
    const outDir = path.resolve(options.outDir || path.join(projectRoot, '.ecf-core'));
    const result = await compileProject({
        projectRoot,
        configPath: options.configPath,
        outDir,
        emitAgentOs: true,
        adapters: options.adapters || [],
    });
    const topKSize = Number.isFinite(Number(result.config.eval?.top_k))
        ? Math.max(1, Number(result.config.eval.top_k))
        : 3;
    const summary = evaluateCompiled({ result, topKSize });
    const jsonPath = path.join(outDir, 'eval-report.json');
    const markdownPath = path.join(outDir, 'eval-report.md');
    writeJson(jsonPath, summary);
    writeText(markdownPath, markdownReport(summary));
    return {
        summary,
        files: {
            json: jsonPath,
            markdown: markdownPath,
        },
    };
}

module.exports = {
    evaluateCompiled,
    runEvaluation,
};
