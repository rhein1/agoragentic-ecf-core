using Agoragentic.EcfCore.Artifacts;
using Agoragentic.EcfCore.IO;

namespace Agoragentic.EcfCore.Validation;

public sealed record EcfValidationResult(bool Ok, IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings)
{
    public static EcfValidationResult Pass(IReadOnlyList<string>? warnings = null) =>
        new(true, Array.Empty<string>(), warnings ?? Array.Empty<string>());

    public static EcfValidationResult Fail(IReadOnlyList<string> errors, IReadOnlyList<string>? warnings = null) =>
        new(false, errors, warnings ?? Array.Empty<string>());
}

public static class EcfArtifactValidator
{
    public static async Task<EcfValidationResult> ValidateDirectoryAsync(string artifactDirectory, CancellationToken cancellationToken = default)
    {
        var errors = new List<string>();
        foreach (var fileName in new[] { "context-packet.json", "source-map.json", "policy-summary.json" })
        {
            if (!File.Exists(Path.Combine(artifactDirectory, fileName)))
            {
                errors.Add($"Missing required artifact: {fileName}");
            }
        }

        if (errors.Count > 0)
        {
            return EcfValidationResult.Fail(errors);
        }

        return Validate(await EcfArtifactSet.LoadAsync(artifactDirectory, cancellationToken));
    }

    public static EcfValidationResult Validate(EcfArtifactSet artifacts)
    {
        var errors = new List<string>();
        var warnings = new List<string>();

        RequireSchema(artifacts.ContextPacket.SchemaVersion, "ecf-core.context-packet.v1", "context-packet", errors);
        RequireSchema(artifacts.SourceMap.SchemaVersion, "ecf-core.source-map.v1", "source-map", errors);
        RequireSchema(artifacts.PolicySummary.SchemaVersion, "ecf-core.policy-summary.v1", "policy-summary", errors);

        if (artifacts.AgentOsImport is not null)
        {
            RequirePreviewOnly(artifacts.AgentOsImport, errors);
        }

        if (artifacts.AgentOsHandoff is not null)
        {
            if (artifacts.AgentOsHandoff.AgentOsPreview.LiveDeployAllowed)
            {
                errors.Add("agent-os-handoff agent_os_preview.live_deploy_allowed must remain false.");
            }

            RequireNoPrivateRuntime(artifacts.AgentOsHandoff.Boundary, errors);
        }

        if (artifacts.AgentOsHarness is not null)
        {
            RequireNoPrivateRuntime(artifacts.AgentOsHarness.Boundary, errors);
        }

        if (artifacts.ContextPacket.Sources.Count == 0)
        {
            warnings.Add("Context packet has no allowed sources.");
        }

        return errors.Count == 0
            ? EcfValidationResult.Pass(warnings)
            : EcfValidationResult.Fail(errors, warnings);
    }

    private static void RequireSchema(string actual, string expected, string artifact, ICollection<string> errors)
    {
        if (!StringComparer.Ordinal.Equals(actual, expected))
        {
            errors.Add($"{artifact} schema_version must be {expected}, got {actual}.");
        }
    }

    private static void RequirePreviewOnly(AgentOsImport import, ICollection<string> errors)
    {
        if (!StringComparer.Ordinal.Equals(import.ImportMode, "preview_only"))
        {
            errors.Add("agent-os-import import_mode must remain preview_only.");
        }

        if (import.LiveDeployAllowed)
        {
            errors.Add("agent-os-import live_deploy_allowed must remain false.");
        }

        if (import.RequiredFiles.Count == 0)
        {
            errors.Add("agent-os-import required_files must not be empty.");
        }

        if (import.AcceptanceChecks.Count == 0)
        {
            errors.Add("agent-os-import acceptance_checks must not be empty.");
        }

        if (string.IsNullOrWhiteSpace(import.NextStep))
        {
            errors.Add("agent-os-import next_step is required.");
        }

        RequireNoPrivateRuntime(import.Boundary, errors);
    }

    private static void RequireNoPrivateRuntime(HarnessBoundary boundary, ICollection<string> errors)
    {
        if (boundary.IncludesHostedRuntime)
        {
            errors.Add("agent-os-harness must not include hosted runtime.");
        }

        if (boundary.IncludesWalletOrSettlement)
        {
            errors.Add("agent-os-harness must not include wallet or settlement behavior.");
        }

        if (boundary.IncludesFullEcfPrivateInternals)
        {
            errors.Add("agent-os-harness must not include Full ECF private internals.");
        }

        if (boundary.IncludesMarketplaceRouting)
        {
            errors.Add("agent-os-harness must not include marketplace routing.");
        }
    }
}
