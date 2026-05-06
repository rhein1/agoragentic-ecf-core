'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { evaluateCompressionExperiment } = require('./compression');
const { applyGroundingEvidence, compileProject } = require('./compile');
const { matchesAny } = require('./core/policy');
const { rankRecords, rankingOptionsFromConfig } = require('./core/ranking');
const { groundingMarkdown, runGroundingEval } = require('./grounding');

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, value);
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
        `- Context compile verdict: ${summary.metrics.compile_stage.context_compile_verdict}`,
        `- Evidence units: ${summary.metrics.compile_stage.evidence_unit_count}`,
        `- Review-required evidence units: ${summary.metrics.compile_stage.review_required_unit_count}`,
        `- Blocked source exclusion: ${summary.metrics.compile_stage.blocked_source_exclusion}`,
        `- Grounding pass rate: ${summary.metrics.compile_stage.grounding_pass_rate}`,
        `- Ranking mode: ${summary.metrics.retrieval_preservation.ranking_mode}`,
        `- Compression experiment verdict: ${summary.metrics.compression_experiment.verdict}`,
        `- Compression median ratio: ${summary.metrics.compression_experiment.median_compression_ratio}`,
        `- Compression citation survival: ${summary.metrics.compression_experiment.citation_survival}`,
        `- Context evidence units: ${summary.metrics.context_evidence_units.evidence_unit_count}`,
        `- Context evidence compression ratio: ${summary.metrics.context_evidence_units.compression_ratio}`,
        `- Context evidence citation survival: ${summary.metrics.context_evidence_units.citation_survival}`,
        `- Context index tree nodes: ${summary.metrics.context_index.tree_node_count}`,
        `- Context index retrieval queries: ${summary.metrics.context_index.retrieval_query_count}`,
        ...(summary.metrics.grounding_eval ? [
            `- Grounding eval verdict: ${summary.metrics.grounding_eval.verdict}`,
            `- Grounded queries: ${summary.metrics.grounding_eval.summary.grounded}/${summary.metrics.grounding_eval.summary.queries}`,
        ] : []),
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
    const rankingOptions = rankingOptionsFromConfig(result.config.eval || {});
    const retrievalQueries = queries.map((query) => {
        const baselineRanking = rankRecords(allowedRecords, query, topKSize, rankingOptions);
        const packetRanking = rankRecords(result.contextPacket.sources, query, topKSize, rankingOptions);
        const baselineTop = baselineRanking.hits;
        const packetTop = packetRanking.hits;
        const packetIds = new Set(packetTop.map((item) => item.id));
        const preserved = baselineTop.filter((item) => packetIds.has(item.id)).length;
        const preservation = baselineTop.length ? preserved / baselineTop.length : 1;
        return {
            query,
            preservation: Number(preservation.toFixed(4)),
            ranking_mode: baselineRanking.ranking_mode,
            ranking_dependency_status: baselineRanking.dependency_status,
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
    const compressionExperiment = result.config.eval?.compression?.enabled === false
        ? {
            enabled: false,
            strategy: 'disabled',
            dependency_status: 'baseline_only',
            source_count: result.contextPacket.sources.length,
            median_compression_ratio: 1,
            average_compression_ratio: 1,
            citation_survival: citationCoverage,
            provenance_preservation: provenanceCoverage,
            retrieval_preservation: {
                top_k: topKSize,
                average_preservation: Number(retrievalAverage.toFixed(4)),
                queries: retrievalQueries,
            },
            verdict: 'pass',
        }
        : evaluateCompressionExperiment({
            contextPacket: result.contextPacket,
            queries,
            topKSize,
            options: result.config.eval?.compression || {},
        });
    const compileStageEvidenceUnits = result.compileStageEvidenceUnits || result.evidenceUnits;
    const reviewRequiredUnitCount = (compileStageEvidenceUnits.units || [])
        .filter((unit) => unit.policy?.requires_review).length;
    const contextEvidenceMetrics = {
        file: 'evidence-units.json',
        legacy_file: 'context-evidence-units.json',
        report_file: 'context-compaction-report.json',
        evidence_unit_count: compileStageEvidenceUnits.units.length,
        review_required_unit_count: reviewRequiredUnitCount,
        compression_ratio: result.compactionReport.compression_ratio,
        duplicate_claim_count: result.compactionReport.duplicate_claim_count,
        citation_survival: result.compactionReport.citation_survival,
        retrieval_preservation: result.compactionReport.retrieval_preservation,
        verdict: result.compactionReport.verdict,
    };
    const contextIndexMetrics = {
        page_index_file: 'page-index.json',
        tree_index_file: 'tree-index.json',
        retrieval_plan_file: 'retrieval-plan.json',
        provider_count: result.pageIndex.providers.length,
        dependency_status: result.pageIndex.dependency_status,
        source_count: result.pageIndex.summary.source_count,
        page_count: result.pageIndex.summary.page_count,
        section_count: result.pageIndex.summary.section_count,
        tree_node_count: result.treeIndex.summary.node_count,
        retrieval_query_count: result.retrievalPlan.summary.query_count,
        sources_requiring_public_exposure_review: result.treeIndex.nodes
            .filter((node) => node.source_id && node.policy_flags?.requires_public_exposure_review)
            .length,
    };
    const compileStageMetrics = {
        evidence_units_file: 'evidence-units.json',
        evidence_unit_count: compileStageEvidenceUnits.units.length,
        review_required_unit_count: reviewRequiredUnitCount,
        grounding_pass_rate: null,
        blocked_source_exclusion: blockedInPacket.length === 0,
        citation_coverage: Number(citationCoverage.toFixed(4)),
        retrieval_preservation: Number(retrievalAverage.toFixed(4)),
        context_compile_verdict: policyPass && citationCoverage >= 0.95 && retrievalAverage >= 0.95
            ? 'preview_ready'
            : 'needs_review',
    };
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
                ranking_mode: retrievalQueries[0]?.ranking_mode || rankingOptions.provider,
                ranking_dependency_status: retrievalQueries[0]?.ranking_dependency_status || 'builtin',
                average_preservation: Number(retrievalAverage.toFixed(4)),
                queries: retrievalQueries,
            },
            compile_stage: compileStageMetrics,
            compression_experiment: compressionExperiment,
            context_evidence_units: contextEvidenceMetrics,
            context_index: contextIndexMetrics,
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
    let grounding = null;
    if (options.grounding || result.config.eval?.grounding_enabled) {
        grounding = runGroundingEval({ result, topKSize });
        summary.metrics.grounding_eval = {
            verdict: grounding.verdict,
            summary: grounding.summary,
            file: 'grounding-eval.json',
        };
        summary.metrics.compile_stage.grounding_pass_rate = grounding.summary.queries
            ? Number((grounding.summary.grounded / grounding.summary.queries).toFixed(4))
            : null;
        summary.metrics.compile_stage.context_compile_verdict = grounding.verdict === 'pass'
            && summary.metrics.compile_stage.context_compile_verdict !== 'blocked'
            ? 'preview_ready'
            : summary.metrics.compile_stage.context_compile_verdict;
        summary.files.grounding_eval = 'grounding-eval.json';
        writeJson(path.join(outDir, 'grounding-eval.json'), grounding);
        writeText(path.join(outDir, 'grounding-eval.md'), groundingMarkdown(grounding));
        applyGroundingEvidence({ outDir, grounding });
    }
    const jsonPath = path.join(outDir, 'eval-report.json');
    const markdownPath = path.join(outDir, 'eval-report.md');
    writeJson(jsonPath, summary);
    writeText(markdownPath, markdownReport(summary));
    return {
        summary,
        files: {
            json: jsonPath,
            markdown: markdownPath,
            grounding_json: grounding ? path.join(outDir, 'grounding-eval.json') : null,
            grounding_markdown: grounding ? path.join(outDir, 'grounding-eval.md') : null,
        },
    };
}

module.exports = {
    evaluateCompiled,
    runGroundingEval,
    runEvaluation,
};
