using System.Text.RegularExpressions;

namespace Agoragentic.EcfCore.DotNet.Scanning;

public sealed partial class AspNetRouteScanner
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
            var minimalRoutes = MinimalRouteRegex().Matches(content)
                .Select(match => $"{match.Groups["method"].Value.ToUpperInvariant()} {match.Groups["route"].Value}")
                .Distinct()
                .ToArray();
            var controllerRoutes = ControllerRouteRegex().Matches(content)
                .Select(match => match.Groups["route"].Value)
                .Distinct()
                .ToArray();

            if (minimalRoutes.Length == 0 && controllerRoutes.Length == 0)
            {
                continue;
            }

            yield return new DotNetScanRecord(
                $"aspnet_routes_{Sanitize(relative)}",
                relative,
                "aspnet_routes",
                "allowed",
                $"ASP.NET routes detected: {string.Join(", ", minimalRoutes.Concat(controllerRoutes).Take(12))}.",
                new Dictionary<string, string> { ["adapter"] = "aspnet_route_scanner" });
        }
    }

    private static string Sanitize(string value) => Regex.Replace(value.ToLowerInvariant(), "[^a-z0-9]+", "_").Trim('_');

    [GeneratedRegex("Map(?<method>Get|Post|Put|Delete|Patch)\\s*\\(\\s*\"(?<route>[^\"]+)\"", RegexOptions.IgnoreCase)]
    private static partial Regex MinimalRouteRegex();

    [GeneratedRegex("\\[(?:Route|HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)\\s*\\(\\s*\"(?<route>[^\"]+)\"", RegexOptions.IgnoreCase)]
    private static partial Regex ControllerRouteRegex();
}

