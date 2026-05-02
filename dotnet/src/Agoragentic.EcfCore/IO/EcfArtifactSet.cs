using System.Text.Json;
using Agoragentic.EcfCore.Artifacts;

namespace Agoragentic.EcfCore.IO;

public sealed record EcfArtifactSet(
    ContextPacket ContextPacket,
    SourceMap SourceMap,
    PolicySummary PolicySummary,
    EcfManifest? Manifest,
    DeploymentPreview? DeploymentPreview,
    AgentOsHandoff? AgentOsHandoff,
    AgentOsHarness? AgentOsHarness,
    AgentOsImport? AgentOsImport,
    EvalReport? EvalReport,
    GroundingEval? GroundingEval)
{
    public static JsonSerializerOptions JsonOptions { get; } = new()
    {
        PropertyNamingPolicy = null,
        WriteIndented = true,
    };

    public static async Task<EcfArtifactSet> LoadAsync(string artifactDirectory, CancellationToken cancellationToken = default)
    {
        var root = Path.GetFullPath(artifactDirectory);
        return new EcfArtifactSet(
            await LoadJsonAsync<ContextPacket>(Path.Combine(root, "context-packet.json"), cancellationToken),
            await LoadJsonAsync<SourceMap>(Path.Combine(root, "source-map.json"), cancellationToken),
            await LoadJsonAsync<PolicySummary>(Path.Combine(root, "policy-summary.json"), cancellationToken),
            await LoadOptionalJsonAsync<EcfManifest>(Path.Combine(root, "manifest.json"), cancellationToken),
            await LoadOptionalJsonAsync<DeploymentPreview>(Path.Combine(root, "deployment-preview.json"), cancellationToken),
            await LoadOptionalJsonAsync<AgentOsHandoff>(Path.Combine(root, "agent-os-handoff.json"), cancellationToken),
            await LoadOptionalJsonAsync<AgentOsHarness>(Path.Combine(root, "agent-os-harness.json"), cancellationToken),
            await LoadOptionalJsonAsync<AgentOsImport>(Path.Combine(root, "agent-os-import.json"), cancellationToken),
            await LoadOptionalJsonAsync<EvalReport>(Path.Combine(root, "eval-report.json"), cancellationToken),
            await LoadOptionalJsonAsync<GroundingEval>(Path.Combine(root, "grounding-eval.json"), cancellationToken));
    }

    public async Task SaveAsync(string artifactDirectory, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(artifactDirectory);
        await SaveJsonAsync(Path.Combine(artifactDirectory, "context-packet.json"), ContextPacket, cancellationToken);
        await SaveJsonAsync(Path.Combine(artifactDirectory, "source-map.json"), SourceMap, cancellationToken);
        await SaveJsonAsync(Path.Combine(artifactDirectory, "policy-summary.json"), PolicySummary, cancellationToken);

        if (Manifest is not null)
        {
            await SaveJsonAsync(Path.Combine(artifactDirectory, "manifest.json"), Manifest, cancellationToken);
        }

        if (DeploymentPreview is not null)
        {
            await SaveJsonAsync(Path.Combine(artifactDirectory, "deployment-preview.json"), DeploymentPreview, cancellationToken);
        }

        if (AgentOsHandoff is not null)
        {
            await SaveJsonAsync(Path.Combine(artifactDirectory, "agent-os-handoff.json"), AgentOsHandoff, cancellationToken);
        }

        if (AgentOsHarness is not null)
        {
            await SaveJsonAsync(Path.Combine(artifactDirectory, "agent-os-harness.json"), AgentOsHarness, cancellationToken);
        }

        if (AgentOsImport is not null)
        {
            await SaveJsonAsync(Path.Combine(artifactDirectory, "agent-os-import.json"), AgentOsImport, cancellationToken);
        }

        if (EvalReport is not null)
        {
            await SaveJsonAsync(Path.Combine(artifactDirectory, "eval-report.json"), EvalReport, cancellationToken);
        }

        if (GroundingEval is not null)
        {
            await SaveJsonAsync(Path.Combine(artifactDirectory, "grounding-eval.json"), GroundingEval, cancellationToken);
        }
    }

    public static async Task<T> LoadJsonAsync<T>(string path, CancellationToken cancellationToken = default)
    {
        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, cancellationToken)
            ?? throw new InvalidDataException($"Could not deserialize {path}.");
    }

    public static async Task<T?> LoadOptionalJsonAsync<T>(string path, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(path))
        {
            return default;
        }

        return await LoadJsonAsync<T>(path, cancellationToken);
    }

    public static async Task SaveJsonAsync<T>(string path, T value, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, value, JsonOptions, cancellationToken);
        await stream.WriteAsync("\n"u8.ToArray(), cancellationToken);
    }
}
