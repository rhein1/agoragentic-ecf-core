using System.Text.RegularExpressions;

namespace Agoragentic.EcfCore.DotNet.Scanning;

public sealed partial class SolutionScanner
{
    public IEnumerable<DotNetScanRecord> Scan(string projectRoot)
    {
        foreach (var path in Directory.EnumerateFiles(projectRoot, "*.sln*", SearchOption.TopDirectoryOnly))
        {
            var relative = Path.GetRelativePath(projectRoot, path);
            var content = File.ReadAllText(path);
            var projectCount = ProjectLineRegex().Matches(content).Count;
            yield return new DotNetScanRecord(
                $"dotnet_solution_{Sanitize(relative)}",
                relative,
                "dotnet_solution",
                "allowed",
                $"Solution file with {projectCount} project references.",
                new Dictionary<string, string> { ["adapter"] = "solution_scanner" });
        }
    }

    private static string Sanitize(string value) => Regex.Replace(value.ToLowerInvariant(), "[^a-z0-9]+", "_").Trim('_');

    [GeneratedRegex("Project\\(", RegexOptions.IgnoreCase)]
    private static partial Regex ProjectLineRegex();
}

