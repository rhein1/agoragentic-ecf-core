'use strict';

const { sha256 } = require('./core/hash');

const DEFAULT_CONTEXT_INDEX_PROVIDER = {
    provider_id: 'ecf_core_local_context_index',
    type: 'page_index',
    mode: 'local_adapter',
    capabilities: [
        'page_structure',
        'tree_search',
        'doc_search',
        'agentic_retrieval',
        'vectorless_retrieval',
    ],
    outputs: [
        'page-index.json',
        'tree-index.json',
        'retrieval-plan.json',
    ],
};

const ALLOWED_PROVIDER_TYPES = new Set([
    'page_index',
    'tree_index',
    'code_graph',
    'tool_graph',
    'policy_graph',
]);

const ALLOWED_PROVIDER_MODES = new Set([
    'local_adapter',
    'external_import',
]);

function stableNodeId(prefix, value) {
    return `${prefix}_${sha256(value).slice(0, 12)}`;
}

function stripFragment(sourcePath) {
    return String(sourcePath || '').split('#')[0];
}

function sourceDocumentPath(source) {
    return source?.provenance?.parent_path || stripFragment(source?.path);
}

function normalizeProvider(provider) {
    if (!provider || typeof provider !== 'object') return null;
    const providerId = String(provider.provider_id || '').trim();
    if (!providerId) return null;
    const type = ALLOWED_PROVIDER_TYPES.has(provider.type) ? provider.type : 'page_index';
    const mode = ALLOWED_PROVIDER_MODES.has(provider.mode) ? provider.mode : 'local_adapter';
    return {
        provider_id: providerId,
        type,
        mode,
        capabilities: Array.isArray(provider.capabilities)
            ? provider.capabilities.map((item) => String(item)).filter(Boolean)
            : [],
        outputs: Array.isArray(provider.outputs)
            ? provider.outputs.map((item) => String(item)).filter(Boolean)
            : [],
    };
}

function normalizeConfiguredContextIndexProviders(config = {}) {
    const configured = Array.isArray(config.context_index_providers)
        ? config.context_index_providers
        : [DEFAULT_CONTEXT_INDEX_PROVIDER];
    return configured.map(normalizeProvider).filter(Boolean);
}

function policyFlagsForSource({ source, sourceMap, config }) {
    const mapped = sourceMap?.sources?.find((entry) => entry.id === source.id);
    const classification = mapped?.classification || 'allowed';
    return {
        classification,
        allowed_for_agent: classification === 'allowed',
        requires_review: classification !== 'allowed',
        public_safe: false,
        requires_public_exposure_review: true,
        live_deploy_allowed: false,
        agent_os_preview_allowed: Boolean(config?.handoff?.agent_os_preview_allowed),
    };
}

function sectionTypeForSource(source) {
    if (source.type === 'markdown_section') return 'section';
    if (source.type === 'openapi_summary') return 'api_surface';
    if (source.type === 'sqlite_schema_summary') return 'schema_summary';
    if (source.path === sourceDocumentPath(source)) return 'document_summary';
    return 'section';
}

function claimsFromSource(source) {
    const summary = String(source.summary || '').trim();
    if (!summary) return [];
    return [summary.length > 320 ? `${summary.slice(0, 317)}...` : summary];
}

function buildDocumentGroups({ contextPacket, sourceMap, config }) {
    const groups = new Map();
    for (const source of contextPacket.sources || []) {
        const docPath = sourceDocumentPath(source);
        if (!docPath) continue;
        if (!groups.has(docPath)) {
            groups.set(docPath, {
                docPath,
                document_node_id: stableNodeId('doc', docPath),
                sources: [],
                policy_flags: {
                    classification: 'allowed',
                    allowed_for_agent: true,
                    requires_review: false,
                    public_safe: false,
                    requires_public_exposure_review: true,
                    live_deploy_allowed: false,
                    agent_os_preview_allowed: Boolean(config?.handoff?.agent_os_preview_allowed),
                },
            });
        }
        groups.get(docPath).sources.push({
            ...source,
            node_id: stableNodeId('node', source.id),
            section_type: sectionTypeForSource(source),
            policy_flags: policyFlagsForSource({ source, sourceMap, config }),
        });
    }
    return [...groups.values()].sort((a, b) => a.docPath.localeCompare(b.docPath));
}

function buildPageIndex({ groups, providers, createdAt, sourceMap }) {
    const sources = groups.map((group) => ({
        source_id: group.document_node_id,
        path: group.docPath,
        type: 'document',
        policy_flags: group.policy_flags,
        pages: [
            {
                page_number: 1,
                summary: `${group.sources.length} indexed context section(s).`,
                sections: group.sources.map((source) => ({
                    section_id: source.node_id,
                    source_id: source.id,
                    source_path: source.path,
                    type: source.section_type,
                    heading: source.heading || source.provenance?.source_kind || source.type,
                    claims: claimsFromSource(source),
                    citations: [source.path],
                    policy_flags: source.policy_flags,
                })),
            },
        ],
    }));
    const sectionCount = sources.reduce((sum, source) => sum + source.pages.reduce((pageSum, page) => (
        pageSum + page.sections.length
    ), 0), 0);
    return {
        schema_version: 'ecf-core.page-index.v1',
        generated_by: 'ecf-core',
        generated_at: createdAt,
        providers,
        dependency_status: 'builtin_local_only',
        placeholder_adapters: [
            {
                adapter_id: 'pdf_image_vision_adapter',
                status: 'contract_only',
                capabilities: ['pdf_page_structure', 'image_layout', 'vision_rag'],
                reason: 'PDF/image OCR and VLM extraction are intentionally not enabled by the baseline local adapter.',
            },
        ],
        sources,
        summary: {
            source_count: sources.length,
            page_count: sources.length,
            section_count: sectionCount,
            blocked_source_count: (sourceMap?.sources || []).filter((source) => source.classification === 'blocked').length,
        },
    };
}

function buildTreeIndex({ groups, providers, createdAt, sourceMap }) {
    const nodes = [];
    const edges = [];
    for (const group of groups) {
        nodes.push({
            node_id: group.document_node_id,
            type: 'document',
            source_id: null,
            source_path: group.docPath,
            parent: null,
            children: group.sources.map((source) => source.node_id),
            policy_flags: group.policy_flags,
        });
        for (const source of group.sources) {
            nodes.push({
                node_id: source.node_id,
                type: source.section_type,
                source_id: source.id,
                source_path: source.path,
                parent: group.document_node_id,
                children: [],
                heading: source.heading || source.provenance?.source_kind || source.type,
                summary: source.summary,
                citations: [source.path],
                policy_flags: source.policy_flags,
            });
            edges.push({
                from: group.document_node_id,
                to: source.node_id,
                type: 'contains',
            });
        }
    }
    return {
        schema_version: 'ecf-core.tree-index.v1',
        generated_by: 'ecf-core',
        generated_at: createdAt,
        providers,
        dependency_status: 'builtin_local_only',
        nodes,
        edges,
        summary: {
            node_count: nodes.length,
            document_count: groups.length,
            section_count: nodes.filter((node) => node.type !== 'document').length,
            blocked_source_count: (sourceMap?.sources || []).filter((source) => source.classification === 'blocked').length,
        },
    };
}

function questionText(entry) {
    return typeof entry === 'string' ? entry : entry?.question;
}

function expectedSources(entry) {
    return Array.isArray(entry?.expected_sources) ? entry.expected_sources : [];
}

function buildRetrievalPlan({ treeIndex, config, createdAt }) {
    const questions = Array.isArray(config?.eval?.grounding_queries) && config.eval.grounding_queries.length
        ? config.eval.grounding_queries
        : config?.eval?.queries || [];
    const sourceNodeMap = new Map();
    for (const node of treeIndex.nodes || []) {
        if (!node.source_id) continue;
        sourceNodeMap.set(node.source_id, node);
        sourceNodeMap.set(node.source_path, node);
    }
    const queries = questions.map((entry) => {
        const expected = expectedSources(entry);
        const requiredNodes = expected.map((item) => sourceNodeMap.get(item)).filter(Boolean);
        return {
            query: String(questionText(entry) || '').trim(),
            preferred_strategy: 'tree_search_then_grounding_eval',
            required_sources: expected,
            required_node_ids: requiredNodes.map((node) => node.node_id),
            fallback: 'unsupported_response',
        };
    }).filter((entry) => entry.query);
    return {
        schema_version: 'ecf-core.retrieval-plan.v1',
        generated_by: 'ecf-core',
        generated_at: createdAt,
        preferred_default_strategy: 'tree_search_then_grounding_eval',
        provider_dependency_status: 'builtin_local_only',
        unsupported_response: config?.eval?.unsupported_response || "I don't know based on the allowed context.",
        queries,
        unsupported_questions: [],
        summary: {
            query_count: queries.length,
            expected_source_query_count: queries.filter((entry) => entry.required_sources.length > 0).length,
        },
    };
}

function buildContextIndexes({ contextPacket, sourceMap, config, createdAt }) {
    const providers = normalizeConfiguredContextIndexProviders(config);
    const groups = buildDocumentGroups({ contextPacket, sourceMap, config });
    const pageIndex = buildPageIndex({ groups, providers, createdAt, sourceMap });
    const treeIndex = buildTreeIndex({ groups, providers, createdAt, sourceMap });
    const retrievalPlan = buildRetrievalPlan({ treeIndex, config, createdAt });
    return {
        providers,
        pageIndex,
        treeIndex,
        retrievalPlan,
    };
}

function findTreeNodesForSource(treeIndex, sourceId) {
    if (!treeIndex || !Array.isArray(treeIndex.nodes)) return [];
    return treeIndex.nodes.filter((node) => node.source_id === sourceId);
}

module.exports = {
    DEFAULT_CONTEXT_INDEX_PROVIDER,
    buildContextIndexes,
    findTreeNodesForSource,
    normalizeConfiguredContextIndexProviders,
};
