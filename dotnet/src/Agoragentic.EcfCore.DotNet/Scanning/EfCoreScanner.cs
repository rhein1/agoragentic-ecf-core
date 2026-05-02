using System.Text.RegularExpressions;

namespace Agoragentic.EcfCore.DotNet.Scanning;

public sealed partial class EfCoreScanner
{
    public IEnumerable<DotNetScanRecord> Scan(string projectRoot)
    {
        foreach (var path in Directory.EnumerateFiles(projectRoot, "*.cs", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(projectRoot, path);
            if (Policy.DotNetSafetyPolicy.ShouldBlock(relative))
            {
                continue;
            }

            var content = File.ReadAllText(path);
            var dbContext = DbContextRegex().Match(content);
            var dbSets = DbSetRegex().Matches(content).Select(match => match.Groups["entity"].Value).Distinct().ToArray();

            if (!dbContext.Success && dbSets.Length == 0)
            {
                continue;
            }

            yield return new DotNetScanRecord(
                $"efcore_{Sanitize(relative)}",
                relative,
                "efcore_schema_summary",
                "review_required",
                $"EF Core context/schema hints detected. DbSets: {(dbSets.Length == 0 ? "none" : string.Join(", ", dbSets.Take(12)))}.",
                new Dictionary<string, string> { ["adapter"] = "efcore_scanner" });
        }
    }

    private static string Sanitize(string value) => Regex.Replace(value.ToLowerInvariant(), "[^a-z0-9]+", "_").Trim('_');

    [GeneratedRegex(":\\s*DbContext\\b")]
    private static partial Regex DbContextRegex();

    [GeneratedRegex("DbSet\\s*<\\s*(?<entity>[A-Za-z_][A-Za-z0-9_]*)\\s*>")]
    private static partial Regex DbSetRegex();
}

