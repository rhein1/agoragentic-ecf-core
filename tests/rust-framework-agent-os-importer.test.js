'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('Rust framework Agent OS Harness importer example stays HTTP/JSON and preview-only', () => {
    const example = readJson('examples/importers/rust-framework-agent-os-harness-import.example.json');
    const runtime = example.input.rust_framework_runtime;

    assert.equal(example.schema_version, 'ecf-core.rust-framework-agent-os-harness-import-example.v1');
    assert.equal(example.input.required_harness_schema_version, 'ecf-core.agent-os-harness.v1');
    assert.equal(runtime.framework, 'agoragentic-rust-framework');
    assert.equal(runtime.integration_boundary, 'http_json');
    assert.match(runtime.base_url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(runtime.public_schema_id, 'https://agoragentic.com/schema/agoragentic-rust-framework.v1.json');

    assert.deepEqual(runtime.required_endpoints, [
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/.well-known/agent-card.json' },
        { method: 'GET', path: '/tools' },
        { method: 'POST', path: '/invoke' },
        { method: 'POST', path: '/a2a/invoke' },
        { method: 'GET', path: '/schema/agoragentic-rust-framework.json' },
        { method: 'GET', path: '/openapi.json' },
    ]);

    for (const key of [
        'hosted_agent_os_provisioning_enabled',
        'wallet_or_settlement_enabled',
        'x402_settlement_enabled',
        'marketplace_publication_enabled',
        'trust_mutation_enabled',
        'router_ranking_enabled',
        'full_ecf_private_internals_included',
        'global_execute_route_mutation_enabled',
        'global_invoke_route_mutation_enabled',
    ]) {
        assert.equal(example.authority_boundary[key], false, `${key} must stay disabled`);
    }

    for (const forbidden of [
        'auto_deploy',
        'hosted_runtime_provisioning',
        'wallet_spend',
        'x402_enablement',
        'marketplace_publish',
        'trust_mutation',
        'router_ranking_mutation',
        'full_ecf_access',
        'global_execute_route_mutation',
        'global_invoke_route_mutation',
    ]) {
        assert.ok(example.forbidden_side_effects.includes(forbidden), `${forbidden} must be forbidden`);
    }

    assert.equal(example.compatibility_artifacts.native_bindings_required, false);
    assert.equal(example.next_step, 'create_agent_os_preview_report_only');
});

test('Rust framework importer docs expose the example and preserve public boundaries', () => {
    const importerReadme = fs.readFileSync(path.join(root, 'examples/importers/README.md'), 'utf8');
    const importDoc = fs.readFileSync(path.join(root, 'docs/AGENT_OS_IMPORT.md'), 'utf8');
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

    assert.match(importerReadme, /rust-framework-agent-os-harness-import\.example\.json/);
    assert.match(importerReadme, /HTTP\/JSON/);
    assert.match(importerReadme, /without invoking paid or side-effecting work/);
    assert.match(importerReadme, /change global `\/api\/execute` or `\/api\/invoke\/:id` behavior/);

    assert.match(importDoc, /Rust Framework Runtime Metadata/);
    assert.match(importDoc, /GET \/health/);
    assert.match(importDoc, /GET \/\.well-known\/agent-card\.json/);
    assert.match(importDoc, /POST \/invoke/);
    assert.match(importDoc, /GET \/openapi\.json/);
    assert.match(importDoc, /does not deploy a Rust agent/);
    assert.match(importDoc, /grant Full ECF access/);

    assert.match(readme, /local Agoragentic Rust framework HTTP\/JSON runtime/);
    assert.match(importerReadme, /Agent Card/);
});
