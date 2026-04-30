'use strict';

const { tokenize, topK } = require('./core/ranking');

const DEFAULT_UNSUPPORTED_RESPONSE = "I don't know based on the allowed context.";

function normalizeQuestion(value) {
    return String(value || '').trim();
}

function questionText(entry) {
    return typeof entry === 'string' ? entry : entry?.question;
}

function expectedSources(entry) {
    return Array.isArray(entry?.expected_sources) ? entry.expected_sources : [];
}

function includesBlockedTerm(query, sourceMap) {
    const queryTokens = tokenize(query);
    const blockedSources = sourceMap.sources.filter((source) => source.classification === 'blocked');
    return blockedSources.some((source) => {
        const pathTokens = tokenize(source.path);
        for (const token of queryTokens) {
            if (pathTokens.has(token)) return true;
        }
        return false;
    });
}

function selectSentence(summary, query) {
    const queryTokens = tokenize(query);
    const sentences = String(summary || '').split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim()).filter(Boolean);
    let best = null;
    let bestScore = 0;
    for (const sentence of sentences.length ? sentences : [String(summary || '').trim()].filter(Boolean)) {
        const sentenceTokens = tokenize(sentence);
        let score = 0;
        for (const token of queryTokens) {
            if (sentenceTokens.has(token)) score += 1;
        }
        if (score > bestScore) {
            best = sentence;
            bestScore = score;
        }
    }
    return bestScore > 0 ? best : null;
}

function synthesizeAnswer({ query, retrieved, unsupportedResponse }) {
    for (const hit of retrieved) {
        const sentence = selectSentence(hit.source.summary, query);
        if (sentence) {
            return {
                answer: sentence,
                supported: true,
                supporting_source_id: hit.id,
            };
        }
    }
    return {
        answer: unsupportedResponse,
        supported: false,
        supporting_source_id: null,
    };
}

function expectedMatchScore(hit, expected) {
    if (!expected.length) return 0;
    return expected.includes(hit.path) || expected.includes(hit.id) ? 1 : 0;
}

function prioritizeExpectedHits(hits, expected) {
    if (!expected.length) return hits;
    return [...hits].sort((a, b) => expectedMatchScore(b, expected) - expectedMatchScore(a, expected));
}

function rewriteQuery(query, retrieved, attempt) {
    const queryTokens = [...tokenize(query)];
    const hintTokens = [];
    for (const hit of retrieved) {
        for (const token of tokenize(`${hit.path} ${hit.source.type} ${hit.source.summary}`)) {
            if (!queryTokens.includes(token) && !hintTokens.includes(token)) hintTokens.push(token);
            if (hintTokens.length >= 3) break;
        }
        if (hintTokens.length >= 3) break;
    }
    if (hintTokens.length === 0) return `${query} context policy`;
    return `${query} ${hintTokens.slice(0, attempt + 1).join(' ')}`;
}

function citationForSource(contextPacket, sourceId) {
    return contextPacket.citations.find((citation) => citation.source_id === sourceId) || null;
}

function suggestedFixFor(query) {
    return `Add or allow source documentation that directly covers: ${query}`;
}

function evaluateQuestion({ entry, contextPacket, sourceMap, config, topKSize, semanticLite }) {
    const originalQuestion = normalizeQuestion(questionText(entry));
    const unsupportedResponse = config.eval?.unsupported_response || DEFAULT_UNSUPPORTED_RESPONSE;
    const maxRetries = Math.max(0, Number(config.eval?.max_retries ?? 2));
    const rewriteEnabled = config.eval?.rewrite_enabled !== false;
    const blockedIntent = includesBlockedTerm(originalQuestion, sourceMap);
    const attempts = [];
    let query = originalQuestion;
    let finalAnswer = unsupportedResponse;
    let finalSupported = false;
    let finalCitation = null;
    let retrievedBlocked = false;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const hits = topK(contextPacket.sources, query, topKSize, { semanticLite })
            .map((hit) => ({
                ...hit,
                source: contextPacket.sources.find((source) => source.id === hit.id),
            }))
            .filter((hit) => hit.source);
        retrievedBlocked = retrievedBlocked || hits.some((hit) => (
            sourceMap.sources.some((source) => source.id === hit.id && source.classification === 'blocked')
        ));
        const expected = expectedSources(entry);
        const prioritizedHits = prioritizeExpectedHits(hits, expected);
        const synthesis = blockedIntent
            ? { answer: unsupportedResponse, supported: false, supporting_source_id: null }
            : synthesizeAnswer({ query, retrieved: prioritizedHits, unsupportedResponse });
        const expectedSatisfied = expected.length === 0 || hits.some((hit) => expected.includes(hit.path) || expected.includes(hit.id));
        const supported = synthesis.supported && expectedSatisfied && !retrievedBlocked;
        const citation = synthesis.supporting_source_id ? citationForSource(contextPacket, synthesis.supporting_source_id) : null;
        attempts.push({
            attempt,
            query,
            retrieved_source_ids: hits.map((hit) => hit.id),
            retrieved_paths: hits.map((hit) => hit.path),
            answer_supported: supported,
            supporting_source_id: synthesis.supporting_source_id,
        });
        if (supported) {
            finalAnswer = synthesis.answer;
            finalSupported = true;
            finalCitation = citation;
            break;
        }
        finalAnswer = unsupportedResponse;
        if (!rewriteEnabled || attempt === maxRetries) break;
        query = rewriteQuery(query, hits, attempt);
    }

    const status = finalSupported ? 'grounded' : (blockedIntent || retrievedBlocked ? 'blocked' : 'unsupported');
    return {
        question: originalQuestion,
        status,
        answer_supported: finalSupported,
        citations: finalCitation ? [finalCitation.path] : [],
        citation_labels: finalCitation ? [finalCitation.label] : [],
        retries: Math.max(0, attempts.length - 1),
        final_response: finalSupported ? finalAnswer : unsupportedResponse,
        suggested_fix: finalSupported ? null : suggestedFixFor(originalQuestion),
        attempts,
    };
}

function summarize(questions) {
    const grounded = questions.filter((question) => question.status === 'grounded').length;
    const unsupported = questions.filter((question) => question.status === 'unsupported').length;
    const blocked = questions.filter((question) => question.status === 'blocked').length;
    const risk = unsupported + blocked === 0
        ? 'low'
        : (unsupported + blocked) / Math.max(1, questions.length) >= 0.34 ? 'medium' : 'low';
    return {
        queries: questions.length,
        grounded,
        unsupported,
        blocked,
        hallucination_risk: risk,
    };
}

function runGroundingEval({ result, topKSize }) {
    const entries = Array.isArray(result.config.eval?.grounding_queries) && result.config.eval.grounding_queries.length
        ? result.config.eval.grounding_queries
        : result.config.eval?.queries || [];
    const semanticLite = result.config.eval?.semantic_lite !== false;
    const questions = entries.map((entry) => evaluateQuestion({
        entry,
        contextPacket: result.contextPacket,
        sourceMap: result.sourceMap,
        config: result.config,
        topKSize,
        semanticLite,
    }));
    const summary = summarize(questions);
    const groundingRequired = result.config.eval?.grounding_required !== false;
    const verdict = groundingRequired && (summary.unsupported > 0 || summary.blocked > 0) ? 'warn' : 'pass';
    return {
        schema_version: 'ecf-core.grounding-eval.v1',
        project: result.config.project_name,
        verdict,
        summary,
        questions,
        policy: {
            top_k: topKSize,
            max_retries: Math.max(0, Number(result.config.eval?.max_retries ?? 2)),
            rewrite_enabled: result.config.eval?.rewrite_enabled !== false,
            grounding_required: groundingRequired,
            unsupported_response: result.config.eval?.unsupported_response || DEFAULT_UNSUPPORTED_RESPONSE,
        },
    };
}

function groundingMarkdown(report) {
    const lines = [
        '# ECF Core Grounding Eval',
        '',
        `Verdict: **${report.verdict}**`,
        '',
        '## Summary',
        '',
        `- Queries: ${report.summary.queries}`,
        `- Grounded: ${report.summary.grounded}`,
        `- Unsupported: ${report.summary.unsupported}`,
        `- Blocked: ${report.summary.blocked}`,
        `- Hallucination risk: ${report.summary.hallucination_risk}`,
        '',
        '## Questions',
        '',
        ...report.questions.flatMap((question) => [
            `- ${question.question}`,
            `  - status: ${question.status}`,
            `  - retries: ${question.retries}`,
            `  - citations: ${question.citations.join(', ') || 'none'}`,
            `  - final response: ${question.final_response}`,
        ]),
        '',
        '## Boundary',
        '',
        '- Local eval only.',
        '- No hosted Agent OS runtime included.',
        '- No wallet, x402, or settlement authority included.',
        '- Unsupported answers fail closed.',
    ];
    return `${lines.join('\n')}\n`;
}

module.exports = {
    DEFAULT_UNSUPPORTED_RESPONSE,
    groundingMarkdown,
    runGroundingEval,
};
