'use strict';

const {
    compileProject,
    buildAgentOsHarness,
    buildAgentOsHandoff,
    buildDeploymentPreview,
    validateCompiledArtifacts,
} = require('./compile');
const {
    runEvaluation,
} = require('./eval');
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
    buildDeploymentPreview,
    classifyPath,
    compileProject,
    createDefaultConfig,
    loadConfig,
    matchesAny,
    normalizeConfig,
    normalizePath,
    runEvaluation,
    validateCompiledArtifacts,
};
