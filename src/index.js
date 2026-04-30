'use strict';

const {
    compileProject,
    buildAgentOsHandoff,
    validateCompiledArtifacts,
} = require('./compile');
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

module.exports = {
    AdapterRegistry,
    ContextAdapter,
    FilesystemAdapter,
    buildAgentOsHandoff,
    classifyPath,
    compileProject,
    createDefaultConfig,
    loadConfig,
    matchesAny,
    normalizeConfig,
    normalizePath,
    validateCompiledArtifacts,
};
