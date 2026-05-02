using System.Text.Json;

namespace Agoragentic.EcfCore.DotNet.Scanning;

public sealed class AppSettingsScanner
{
    public IEnumerable<DotNetScanRecord> Scan(string projectRoot)
    {
        foreach (var path in Directory.EnumerateFiles(projectRoot, "appsettings*.json", SearchOption.AllDirectories)
            .Concat(Directory.EnumerateFiles(projectRoot, "launchSettings.json", SearchOption.AllDirectories)))
        {
            var relative = Path.GetRelativePath(projectRoot, path);
            if (Policy.DotNetSafetyPolicy.ShouldBlock(relative))
            {
                continue;
            }

            var content = File.ReadAllText(path);
            var redacted = Policy.DotNetSafetyPolicy.RedactSensitiveJson(content);
            var classification = Policy.DotNetSafetyPolicy.RequiresReview(relative, content) ? "review_required" : "allowed";
            var topLevelKeys = ReadTopLevelKeys(redacted);

            yield return new DotNetScanRecord(
                $"dotnet_config_{Path.GetFileNameWithoutExtension(path).ToLowerInvariant()}",
                relative,
                "dotnet_config_summary",
                classification,
                $"Configuration file with top-level keys: {(topLevelKeys.Count == 0 ? "none" : string.Join(", ", topLevelKeys))}. Sensitive values are redacted before export.",
                new Dictionary<string, string> { ["adapter"] = "appsettings_scanner" });
        }
    }

    private static IReadOnlyList<string> ReadTopLevelKeys(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.ValueKind == JsonValueKind.Object
                ? document.RootElement.EnumerateObject().Select(property => property.Name).ToArray()
                : Array.Empty<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }
}

