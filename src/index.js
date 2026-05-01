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
    inspectAgentOsPreview,
} = require('./agent-os-preview');
const {
    scoreRecord,
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
    classifyPath,
    compileProject,
    createDefaultConfig,
    evaluateCompressionExperiment,
    inspectAgentOsPreview,
    loadConfig,
    matchesAny,
    normalizeConfig,
    normalizePath,
    runEvaluation,
    runGroundingEval,
    scoreRecord,
    validateCompiledArtifacts,
    topK,
};
