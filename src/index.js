'use strict';

const {
    compileProject,
    buildAgentOsHarness,
    buildAgentOsHandoff,
    buildAgentOsImport,
    buildDeploymentPreview,
    validateCompiledArtifacts,
} = require('./compile');
const {
    runEvaluation,
    runGroundingEval,
} = require('./eval');
const {
    evaluateCompressionExperiment,
} = require('./compression');
const {
    buildContextCompactionReport,
    buildContextEvidenceUnits,
} = require('./evidence-units');
const {
    buildContextIndexes,
    findTreeNodesForSource,
    normalizeConfiguredContextIndexProviders,
} = require('./context-index');
const {
    inspectAgentOsPreview,
} = require('./agent-os-preview');
const {
    TOOLS: MCP_TOOLS,
    callTool: callMcpTool,
    handleMcpRequest,
    runMcpServer,
} = require('./mcp-server');
const {
    rankRecords,
    rankingOptionsFromConfig,
    scoreRecord,
    scoreLocalVector,
    topK,
} = require('./core/ranking');
const {
    createDefaultConfig,
    loadConfig,
    normalizeConfig,
} = require('./core/config');
const {
    classifyPath,
    normalizePath,
    matchesAny,
} = require('./core/policy');
const {
    ContextAdapter,
    AdapterRegistry,
} = require('./adapters/base');
const {
    FilesystemAdapter,
} = require('./adapters/filesystem');
const {
    MarkdownDocsAdapter,
} = require('./adapters/markdown-docs');
const {
    SqliteSummaryAdapter,
} = require('./adapters/sqlite-summary');
const {
    OpenApiAdapter,
} = require('./adapters/openapi');
const {
    McpContextProviderAdapter,
} = require('./adapters/mcp-context');

module.exports = {
    AdapterRegistry,
    ContextAdapter,
    FilesystemAdapter,
    MarkdownDocsAdapter,
    McpContextProviderAdapter,
    OpenApiAdapter,
    SqliteSummaryAdapter,
    buildAgentOsHarness,
    buildAgentOsHandoff,
    buildAgentOsImport,
    buildDeploymentPreview,
    buildContextCompactionReport,
    buildContextEvidenceUnits,
    buildContextIndexes,
    callMcpTool,
    classifyPath,
    compileProject,
    createDefaultConfig,
    evaluateCompressionExperiment,
    findTreeNodesForSource,
    handleMcpRequest,
    inspectAgentOsPreview,
    loadConfig,
    matchesAny,
    MCP_TOOLS,
    normalizeConfig,
    normalizeConfiguredContextIndexProviders,
    normalizePath,
    rankRecords,
    rankingOptionsFromConfig,
    runMcpServer,
    runEvaluation,
    runGroundingEval,
    scoreRecord,
    scoreLocalVector,
    validateCompiledArtifacts,
    topK,
};
