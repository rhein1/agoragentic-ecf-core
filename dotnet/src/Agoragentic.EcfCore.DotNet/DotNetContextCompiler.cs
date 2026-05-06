using System.Security.Cryptography;
using System.Text;
using Agoragentic.EcfCore.Artifacts;
using Agoragentic.EcfCore.IO;
using Agoragentic.EcfCore.DotNet.Policy;
using Agoragentic.EcfCore.DotNet.Scanning;

namespace Agoragentic.EcfCore.DotNet;

public sealed class DotNetContextCompiler
{
    private readonly IReadOnlyList<object> scanners = new object[]
    {
        new SolutionScanner(),
        new ProjectScanner(),
        new CSharpSourceScanner(),
        new AspNetRouteScanner(),
        new EfCoreScanner(),
        new AppSettingsScanner(),
    };

    public async Task<EcfArtifactSet> CompileAsync(string projectRoot, bool emitAgentOs, CancellationToken cancellationToken = default)
    {
        var root = Path.GetFullPath(projectRoot);
        var records = Scan(root).ToArray();
        var allowed = records.Where(record => record.Classification == "allowed").ToArray();
        var reviewRequired = records.Where(record => record.Classification == "review_required").ToArray();
        var sources = allowed.Select(ToContextSource).ToArray();
        var sourceMapEntries = records.Select(ToSourceMapEntry)
            .Concat(DotNetSafetyPolicy.DefaultBlockedPatterns.Select(pattern => new SourceMapEntry
            {
                Id = $"dotnet_block_{StableId(pattern)}",
                Path = pattern,
                Type = "dotnet_policy_block",
                Classification = "blocked",
                Summary = ".NET safety policy blocks this path pattern by default.",
            }))
            .ToArray();

        var policy = new PolicySummary
        {
            AllowedSources = allowed.Select(record => record.Path).Distinct().Order().ToArray(),
            BlockedSources = DotNetSafetyPolicy.DefaultBlockedPatterns,
            ReviewRequired = reviewRequired.Select(record => record.Path).Concat(DotNetSafetyPolicy.ReviewRequiredPatterns).Distinct().Order().ToArray(),
            ToolLimits = new ToolLimits { NetworkAllowed = false, WriteAllowed = false, MaxCalls = 4 },
            Handoff = new HandoffPolicy { AgentOsPreviewAllowed = true, LiveDeployAllowed = false },
        };
        var contextPacket = new ContextPacket
        {
            PacketId = $"ctx_dotnet_{StableId(root)}",
            Scope = "local_dotnet_project",
            Sources = sources,
            Citations = sources.Select(source => new ContextCitation { SourceId = source.Id, Path = source.Path }).ToArray(),
            Policy = new ContextPolicy
            {
                AllowedSources = policy.AllowedSources,
                BlockedSources = policy.BlockedSources,
                ReviewRequired = policy.ReviewRequired,
            },
        };
        var checks = new[]
        {
            new PreviewCheck
            {
                Id = "no_spend_or_settlement",
                Status = "pass",
                Detail = "ECF Core .NET exports are preview-only and do not authorize wallet, x402, or settlement actions.",
            },
            new PreviewCheck
            {
                Id = "live_deploy_disabled",
                Status = "pass",
                Detail = "Live deploy remains disabled and requires a separate Agent OS launch flow.",
            },
            new PreviewCheck
            {
                Id = "review_required_excluded",
                Status = "pass",
                Detail = $"{reviewRequired.Length} review-required records were kept out of context-packet.json.",
            },
        };
        var artifacts = new PreviewArtifacts();
        var requiredFiles = new[]
        {
            "context-packet.json",
            "source-map.json",
            "policy-summary.json",
            "manifest.json",
            "deployment-preview.json",
            "agent-os-handoff.json",
            "agent-os-harness.json",
            "agent-os-import.json",
            "evidence-units.json",
            "context-evidence-units.json",
            "context-compaction-report.json",
            "grounding-eval.json",
        };
        var acceptanceChecks = checks.Select(check => new AcceptanceCheck
        {
            Id = check.Id,
            RequiredStatus = new[] { "pass" },
        }).ToArray();

        return new EcfArtifactSet(
            contextPacket,
            new SourceMap { Sources = sourceMapEntries },
            policy,
            new EcfManifest
            {
                Counts = new ManifestCounts
                {
                    AllowedSources = allowed.Length,
                    ReviewRequiredSources = reviewRequired.Length,
                    BlockedPatterns = DotNetSafetyPolicy.DefaultBlockedPatterns.Count,
                },
            },
            emitAgentOs ? new DeploymentPreview { Mode = "agent_os_preview", LiveDeployAllowed = false, Checks = checks, Artifacts = artifacts } : null,
            emitAgentOs ? new AgentOsHandoff { AgentOsPreview = new AgentOsPreviewPolicy { Allowed = true, LiveDeployAllowed = false }, Boundary = new HarnessBoundary() } : null,
            emitAgentOs ? new AgentOsHarness { Artifacts = artifacts, Readiness = new HarnessReadiness { LiveDeployAllowed = false, Checks = checks } } : null,
            emitAgentOs ? new AgentOsImport
            {
                ImportMode = "preview_only",
                LiveDeployAllowed = false,
                RequiredFiles = requiredFiles,
                AcceptanceChecks = acceptanceChecks,
                Boundary = new HarnessBoundary(),
                Evidence = new AgentOsImportEvidence(),
                NextStep = "agent_os_preview_import",
            } : null,
            null,
            null);
    }

    private IEnumerable<DotNetScanRecord> Scan(string root)
    {
        foreach (var scanner in scanners)
        {
            var method = scanner.GetType().GetMethod("Scan", new[] { typeof(string) })
                ?? throw new InvalidOperationException($"Scanner {scanner.GetType().Name} is missing Scan(string).");
            foreach (var record in (IEnumerable<DotNetScanRecord>)method.Invoke(scanner, new object[] { root })!)
            {
                yield return record;
            }
        }
    }

    private static ContextSource ToContextSource(DotNetScanRecord record) => new()
    {
        Id = record.Id,
        Path = record.Path,
        Type = record.Type,
        Hash = StableId($"{record.Path}:{record.Summary}"),
        Summary = record.Summary,
        Provenance = new SourceProvenance
        {
            Adapter = record.Provenance.TryGetValue("adapter", out var adapter) ? adapter : "dotnet_scanner",
            Framework = record.Provenance.TryGetValue("target_frameworks", out var framework) ? framework : null,
            SourceKind = record.Type,
        },
    };

    private static SourceMapEntry ToSourceMapEntry(DotNetScanRecord record) => new()
    {
        Id = record.Id,
        Path = record.Path,
        Type = record.Type,
        Classification = record.Classification,
        Summary = record.Summary,
    };

    private static string StableId(string value)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(hash)[..16].ToLowerInvariant();
    }
}
