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
    buildEvidenceUnits,
    buildContextCompactionReport,
    buildContextEvidenceUnits,
} = require('./evidence-units');
const {
    buildContextIndexes,
    findTreeNodesForSource,
    normalizeConfiguredContextIndexProviders,
} = require('./context-index');
const {
    buildCodeIndex,
    buildContextRouter,
    buildSourceManifest,
    classifyQuery: classifyContextQuery,
    extractCodeFacts,
    routeCompiledQuery,
} = require('./context-router');
const {
    inspectAgentOsPreview,
} = require('./agent-os-preview');
const {
    buildEcfCoreContextPack,
    buildEcfCoreMcpConfig,
    buildEcfCoreResidentStatus,
    writeEcfCoreContextPack,
    writeEcfCoreMcpConfig,
    writeEcfCoreResidentStatus,
} = require('./resident');
const {
    beginWorklog,
    buildHandoff,
    buildWorklogStatus,
    checkpointWorklog,
    finishWorklog,
    planDocsSync,
    readWorklogArtifacts,
    writeHandoff,
} = require('./work-memory');
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
    buildCodeIndex,
    buildDeploymentPreview,
    buildEvidenceUnits,
    buildContextCompactionReport,
    buildContextEvidenceUnits,
    buildContextIndexes,
    buildContextRouter,
    buildEcfCoreContextPack,
    buildEcfCoreMcpConfig,
    buildEcfCoreResidentStatus,
    buildSourceManifest,
    beginWorklog,
    buildHandoff,
    buildWorklogStatus,
    callMcpTool,
    checkpointWorklog,
    classifyPath,
    classifyContextQuery,
    compileProject,
    createDefaultConfig,
    evaluateCompressionExperiment,
    extractCodeFacts,
    findTreeNodesForSource,
    handleMcpRequest,
    inspectAgentOsPreview,
    finishWorklog,
    loadConfig,
    matchesAny,
    MCP_TOOLS,
    normalizeConfig,
    normalizeConfiguredContextIndexProviders,
    normalizePath,
    planDocsSync,
    rankRecords,
    readWorklogArtifacts,
    rankingOptionsFromConfig,
    routeCompiledQuery,
    runMcpServer,
    runEvaluation,
    runGroundingEval,
    scoreRecord,
    scoreLocalVector,
    validateCompiledArtifacts,
    writeEcfCoreContextPack,
    writeEcfCoreMcpConfig,
    writeEcfCoreResidentStatus,
    writeHandoff,
    topK,
};
