using System.Text.Json;
using System.Text.Json.Serialization;

namespace Agoragentic.EcfCore.Artifacts;

public sealed record ContextPacket
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.context-packet.v1";

    [JsonPropertyName("packet_id")]
    public string PacketId { get; init; } = string.Empty;

    [JsonPropertyName("scope")]
    public string Scope { get; init; } = "local_project";

    [JsonPropertyName("created_at")]
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    [JsonPropertyName("sources")]
    public IReadOnlyList<ContextSource> Sources { get; init; } = Array.Empty<ContextSource>();

    [JsonPropertyName("citations")]
    public IReadOnlyList<ContextCitation> Citations { get; init; } = Array.Empty<ContextCitation>();

    [JsonPropertyName("policy")]
    public ContextPolicy Policy { get; init; } = new();

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? ExtensionData { get; init; }
}

public sealed record ContextSource
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("path")]
    public string Path { get; init; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; init; } = string.Empty;

    [JsonPropertyName("hash")]
    public string Hash { get; init; } = string.Empty;

    [JsonPropertyName("summary")]
    public string Summary { get; init; } = string.Empty;

    [JsonPropertyName("byte_count")]
    public long? ByteCount { get; init; }

    [JsonPropertyName("line_count")]
    public int? LineCount { get; init; }

    [JsonPropertyName("provenance")]
    public SourceProvenance Provenance { get; init; } = new();
}

public sealed record SourceProvenance
{
    [JsonPropertyName("adapter")]
    public string Adapter { get; init; } = string.Empty;

    [JsonPropertyName("framework")]
    public string? Framework { get; init; }

    [JsonPropertyName("source_kind")]
    public string? SourceKind { get; init; }
}

public sealed record ContextCitation
{
    [JsonPropertyName("source_id")]
    public string SourceId { get; init; } = string.Empty;

    [JsonPropertyName("path")]
    public string Path { get; init; } = string.Empty;

    [JsonPropertyName("heading")]
    public string? Heading { get; init; }
}

public sealed record ContextPolicy
{
    [JsonPropertyName("allowed_sources")]
    public IReadOnlyList<string> AllowedSources { get; init; } = Array.Empty<string>();

    [JsonPropertyName("blocked_sources")]
    public IReadOnlyList<string> BlockedSources { get; init; } = Array.Empty<string>();

    [JsonPropertyName("review_required")]
    public IReadOnlyList<string> ReviewRequired { get; init; } = Array.Empty<string>();
}

public sealed record SourceMap
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.source-map.v1";

    [JsonPropertyName("sources")]
    public IReadOnlyList<SourceMapEntry> Sources { get; init; } = Array.Empty<SourceMapEntry>();
}

public sealed record SourceMapEntry
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("path")]
    public string Path { get; init; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; init; } = string.Empty;

    [JsonPropertyName("classification")]
    public string Classification { get; init; } = "allowed";

    [JsonPropertyName("summary")]
    public string Summary { get; init; } = string.Empty;
}

public sealed record PolicySummary
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.policy-summary.v1";

    [JsonPropertyName("allowed_sources")]
    public IReadOnlyList<string> AllowedSources { get; init; } = Array.Empty<string>();

    [JsonPropertyName("blocked_sources")]
    public IReadOnlyList<string> BlockedSources { get; init; } = Array.Empty<string>();

    [JsonPropertyName("review_required")]
    public IReadOnlyList<string> ReviewRequired { get; init; } = Array.Empty<string>();

    [JsonPropertyName("tool_limits")]
    public ToolLimits ToolLimits { get; init; } = new();

    [JsonPropertyName("handoff")]
    public HandoffPolicy Handoff { get; init; } = new();
}

public sealed record ToolLimits
{
    [JsonPropertyName("network_allowed")]
    public bool NetworkAllowed { get; init; }

    [JsonPropertyName("write_allowed")]
    public bool WriteAllowed { get; init; }

    [JsonPropertyName("max_calls")]
    public int MaxCalls { get; init; } = 4;
}

public sealed record HandoffPolicy
{
    [JsonPropertyName("agent_os_preview_allowed")]
    public bool AgentOsPreviewAllowed { get; init; } = true;

    [JsonPropertyName("live_deploy_allowed")]
    public bool LiveDeployAllowed { get; init; }
}

public sealed record DeploymentPreview
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.deployment-preview.v1";

    [JsonPropertyName("mode")]
    public string Mode { get; init; } = "agent_os_preview";

    [JsonPropertyName("live_deploy_allowed")]
    public bool LiveDeployAllowed { get; init; }

    [JsonPropertyName("checks")]
    public IReadOnlyList<PreviewCheck> Checks { get; init; } = Array.Empty<PreviewCheck>();

    [JsonPropertyName("artifacts")]
    public PreviewArtifacts Artifacts { get; init; } = new();
}

public sealed record PreviewCheck
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = "pass";

    [JsonPropertyName("detail")]
    public string Detail { get; init; } = string.Empty;
}

public sealed record PreviewArtifacts
{
    [JsonPropertyName("context_packet")]
    public string ContextPacket { get; init; } = "context-packet.json";

    [JsonPropertyName("source_map")]
    public string SourceMap { get; init; } = "source-map.json";

    [JsonPropertyName("policy_summary")]
    public string PolicySummary { get; init; } = "policy-summary.json";

    [JsonPropertyName("evidence_units")]
    public string EvidenceUnits { get; init; } = "evidence-units.json";

    [JsonPropertyName("context_evidence_units")]
    public string ContextEvidenceUnits { get; init; } = "context-evidence-units.json";

    [JsonPropertyName("context_compaction_report")]
    public string ContextCompactionReport { get; init; } = "context-compaction-report.json";

    [JsonPropertyName("deployment_preview")]
    public string DeploymentPreview { get; init; } = "deployment-preview.json";

    [JsonPropertyName("grounding_eval")]
    public string? GroundingEval { get; init; } = "grounding-eval.json";
}

public sealed record EcfManifest
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.manifest.v1";

    [JsonPropertyName("generated_by")]
    public string GeneratedBy { get; init; } = "ecfnet";

    [JsonPropertyName("counts")]
    public ManifestCounts Counts { get; init; } = new();
}

public sealed record ManifestCounts
{
    [JsonPropertyName("allowed_sources")]
    public int AllowedSources { get; init; }

    [JsonPropertyName("review_required_sources")]
    public int ReviewRequiredSources { get; init; }

    [JsonPropertyName("blocked_patterns")]
    public int BlockedPatterns { get; init; }
}

public sealed record AgentOsHandoff
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.agent-os-handoff.v1";

    [JsonPropertyName("context_packet")]
    public string ContextPacket { get; init; } = "context-packet.json";

    [JsonPropertyName("source_map")]
    public string SourceMap { get; init; } = "source-map.json";

    [JsonPropertyName("policy_summary")]
    public string PolicySummary { get; init; } = "policy-summary.json";

    [JsonPropertyName("evidence_units")]
    public string EvidenceUnits { get; init; } = "evidence-units.json";

    [JsonPropertyName("deployment_preview")]
    public string DeploymentPreview { get; init; } = "deployment-preview.json";

    [JsonPropertyName("agent_os_harness")]
    public string AgentOsHarness { get; init; } = "agent-os-harness.json";

    [JsonPropertyName("agent_os_preview")]
    public AgentOsPreviewPolicy AgentOsPreview { get; init; } = new();

    [JsonPropertyName("boundary")]
    public HarnessBoundary Boundary { get; init; } = new();
}

public sealed record AgentOsHarness
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.agent-os-harness.v1";

    [JsonPropertyName("generated_by")]
    public string GeneratedBy { get; init; } = "ecf-core";

    [JsonPropertyName("context_layer")]
    public string ContextLayer { get; init; } = "ecf_core";

    [JsonPropertyName("artifacts")]
    public PreviewArtifacts Artifacts { get; init; } = new();

    [JsonPropertyName("boundary")]
    public HarnessBoundary Boundary { get; init; } = new();

    [JsonPropertyName("readiness")]
    public HarnessReadiness Readiness { get; init; } = new();
}

public sealed record AgentOsPreviewPolicy
{
    [JsonPropertyName("allowed")]
    public bool Allowed { get; init; } = true;

    [JsonPropertyName("live_deploy_allowed")]
    public bool LiveDeployAllowed { get; init; }

    [JsonPropertyName("recommended_next_step")]
    public string RecommendedNextStep { get; init; } = "review_in_agent_os_preview";
}

public sealed record HarnessReadiness
{
    [JsonPropertyName("live_deploy_allowed")]
    public bool LiveDeployAllowed { get; init; }

    [JsonPropertyName("checks")]
    public IReadOnlyList<PreviewCheck> Checks { get; init; } = Array.Empty<PreviewCheck>();
}

public sealed record HarnessBoundary
{
    [JsonPropertyName("includes_hosted_runtime")]
    public bool IncludesHostedRuntime { get; init; }

    [JsonPropertyName("includes_wallet_or_settlement")]
    public bool IncludesWalletOrSettlement { get; init; }

    [JsonPropertyName("includes_full_ecf_private_internals")]
    public bool IncludesFullEcfPrivateInternals { get; init; }

    [JsonPropertyName("includes_marketplace_routing")]
    public bool IncludesMarketplaceRouting { get; init; }
}

public sealed record AgentOsImport
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.agent-os-import.v1";

    [JsonPropertyName("import_mode")]
    public string ImportMode { get; init; } = "preview_only";

    [JsonPropertyName("live_deploy_allowed")]
    public bool LiveDeployAllowed { get; init; }

    [JsonPropertyName("required_files")]
    public IReadOnlyList<string> RequiredFiles { get; init; } = Array.Empty<string>();

    [JsonPropertyName("acceptance_checks")]
    public IReadOnlyList<AcceptanceCheck> AcceptanceChecks { get; init; } = Array.Empty<AcceptanceCheck>();

    [JsonPropertyName("boundary")]
    public HarnessBoundary Boundary { get; init; } = new();

    [JsonPropertyName("evidence")]
    public AgentOsImportEvidence Evidence { get; init; } = new();

    [JsonPropertyName("next_step")]
    public string NextStep { get; init; } = "agent_os_preview_import";
}

public sealed record AcceptanceCheck
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("required_status")]
    public IReadOnlyList<string> RequiredStatus { get; init; } = Array.Empty<string>();
}

public sealed record AgentOsImportEvidence
{
    [JsonPropertyName("evidence_units")]
    public string EvidenceUnits { get; init; } = "evidence-units.json";

    [JsonPropertyName("context_evidence_units")]
    public string ContextEvidenceUnits { get; init; } = "context-evidence-units.json";

    [JsonPropertyName("context_compaction_report")]
    public string ContextCompactionReport { get; init; } = "context-compaction-report.json";

    [JsonPropertyName("grounding_eval")]
    public string? GroundingEval { get; init; } = "grounding-eval.json";
}

public sealed record EvalReport
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.eval-report.v1";

    [JsonPropertyName("verdict")]
    public string Verdict { get; init; } = "pass";
}

public sealed record GroundingEval
{
    [JsonPropertyName("schema_version")]
    public string SchemaVersion { get; init; } = "ecf-core.grounding-eval.v1";

    [JsonPropertyName("verdict")]
    public string Verdict { get; init; } = "pass";
}
