#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    compileProject,
    createDefaultConfig,
    loadConfig,
    runEvaluation,
    validateCompiledArtifacts,
    inspectAgentOsPreview,
} = require('../src');

function printHelp() {
    console.log(`ECF Core

Usage:
  ecf-core init [project] [--force]
  ecf-core compile [project] [--config ecf.config.json] [--out .ecf-core] [--json] [--agent-os]
  ecf-core eval [project] [--config ecf.config.json] [--out .ecf-core] [--json] [--grounding]
  ecf-core agent-os-preview [artifact-dir] [--json]
  ecf-core validate [artifact-dir]
  ecf-core version

Commands:
  init      Write a safe starter ecf.config.json.
  compile   Build context-packet, source-map, and policy-summary artifacts.
  eval      Compile and write deterministic JSON/Markdown evaluation reports.
  agent-os-preview
            Check compiled ECF Core artifacts before Agent OS preview import.
  validate  Validate required compiled artifacts exist and have expected schema versions.
  version   Print package version.
`);
}

function readFlag(args, name, fallback = null) {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) return true;
    return value;
}

function positional(args) {
    return args.filter((arg, index) => {
        if (arg.startsWith('--')) return false;
            const previous = args[index - 1];
        return !(previous && previous.startsWith('--') && previous !== '--json' && previous !== '--agent-os' && previous !== '--force');
    });
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value, force = false) {
    if (fs.existsSync(filePath) && !force) {
        throw new Error(`${filePath} already exists. Re-run with --force to overwrite.`);
    }
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
    const [command = 'help', ...args] = process.argv.slice(2);

    if (command === 'help' || command === '--help' || command === '-h') {
        printHelp();
        return;
    }

    if (command === 'eval') {
        const [projectArg = '.'] = positional(args);
        const projectRoot = path.resolve(projectArg);
        const configPath = readFlag(args, '--config');
        const outDir = readFlag(args, '--out', '.ecf-core');
        const report = await runEvaluation({
            projectRoot,
            configPath: configPath && configPath !== true ? path.resolve(configPath) : null,
            outDir: path.resolve(projectRoot, outDir),
            grounding: args.includes('--grounding'),
        });
        if (args.includes('--json')) {
            console.log(JSON.stringify(report.summary, null, 2));
        } else {
            console.log(`ECF Core eval verdict: ${report.summary.verdict}`);
            console.log(`JSON report: ${report.files.json}`);
            console.log(`Markdown report: ${report.files.markdown}`);
        }
        return;
    }

    if (command === 'version' || command === '--version' || command === '-v') {
        const pkg = require('../package.json');
        console.log(pkg.version);
        return;
    }

    if (command === 'init') {
        const [projectArg = '.'] = positional(args);
        const projectRoot = path.resolve(projectArg);
        const force = args.includes('--force');
        ensureDir(projectRoot);
        const configPath = path.join(projectRoot, 'ecf.config.json');
        writeJson(configPath, createDefaultConfig({ projectName: path.basename(projectRoot) || 'local-project' }), force);
        console.log(`Wrote ${configPath}`);
        return;
    }

    if (command === 'compile') {
        const [projectArg = '.'] = positional(args);
        const projectRoot = path.resolve(projectArg);
        const configPath = readFlag(args, '--config');
        const outDir = readFlag(args, '--out', '.ecf-core');
        const result = await compileProject({
            projectRoot,
            configPath: configPath && configPath !== true ? path.resolve(configPath) : null,
            outDir: path.resolve(projectRoot, outDir),
            emitAgentOs: args.includes('--agent-os'),
        });
        if (args.includes('--json')) {
            console.log(JSON.stringify(result.manifest, null, 2));
        } else {
            console.log(`Compiled ${result.manifest.counts.allowed_sources} allowed sources into ${result.manifest.out_dir}`);
            console.log(`Blocked ${result.manifest.counts.blocked_sources} sources and marked ${result.manifest.counts.review_required_sources} for review.`);
        }
        return;
    }

    if (command === 'validate') {
        const [artifactArg = '.ecf-core'] = positional(args);
        const artifactDir = path.resolve(artifactArg);
        const report = validateCompiledArtifacts(artifactDir);
        if (!report.ok) {
            console.error(JSON.stringify(report, null, 2));
            process.exitCode = 1;
            return;
        }
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    if (command === 'agent-os-preview') {
        const [artifactArg = '.ecf-core'] = positional(args);
        const report = inspectAgentOsPreview(path.resolve(artifactArg));
        if (args.includes('--json')) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log(`Agent OS preview import: ${report.ok ? 'ready' : 'not ready'}`);
            console.log(`Artifact dir: ${report.artifact_dir}`);
            console.log(`Boundary safe: ${report.boundary_safe}`);
            if (report.errors.length) {
                console.log('Errors:');
                for (const error of report.errors) console.log(`- ${error}`);
            }
            console.log(`Next step: ${report.next_step}`);
        }
        if (!report.ok) process.exitCode = 1;
        return;
    }

    if (command === 'print-config') {
        const [projectArg = '.'] = positional(args);
        console.log(JSON.stringify(loadConfig({ projectRoot: path.resolve(projectArg) }), null, 2));
        return;
    }

    printHelp();
    process.exitCode = 1;
}

main().catch((error) => {
    console.error(`ecf-core: ${error.message}`);
    process.exitCode = 1;
});
