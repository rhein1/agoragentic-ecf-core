using System.Text.RegularExpressions;

namespace Agoragentic.EcfCore.DotNet.Scanning;

public sealed partial class CSharpSourceScanner
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
            var publicTypes = PublicTypeRegex().Matches(content).Select(match => match.Groups["name"].Value).Distinct().ToArray();
            var classification = Policy.DotNetSafetyPolicy.RequiresReview(relative, content) ? "review_required" : "allowed";

            yield return new DotNetScanRecord(
                $"csharp_source_{Sanitize(relative)}",
                relative,
                "csharp_source",
                classification,
                publicTypes.Length == 0
                    ? "C# source file with no public type declarations detected."
                    : $"C# source declares public types: {string.Join(", ", publicTypes.Take(8))}.",
                new Dictionary<string, string> { ["adapter"] = "csharp_source_scanner" });
        }
    }

    private static string Sanitize(string value) => Regex.Replace(value.ToLowerInvariant(), "[^a-z0-9]+", "_").Trim('_');

    [GeneratedRegex("\\bpublic\\s+(?:sealed\\s+|abstract\\s+|partial\\s+)?(?:class|interface|record|struct)\\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)")]
    private static partial Regex PublicTypeRegex();
}

