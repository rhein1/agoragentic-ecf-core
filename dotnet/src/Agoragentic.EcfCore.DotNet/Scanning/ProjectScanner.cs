using System.Xml.Linq;

namespace Agoragentic.EcfCore.DotNet.Scanning;

public sealed class ProjectScanner
{
    public IEnumerable<DotNetScanRecord> Scan(string projectRoot)
    {
        foreach (var path in Directory.EnumerateFiles(projectRoot, "*.csproj", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(projectRoot, path);
            if (Policy.DotNetSafetyPolicy.ShouldBlock(relative))
            {
                continue;
            }

            var document = XDocument.Load(path);
            var targetFrameworks = document.Descendants()
                .Where(element => element.Name.LocalName is "TargetFramework" or "TargetFrameworks")
                .Select(element => element.Value)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .ToArray();
            var packageReferences = document.Descendants()
                .Where(element => element.Name.LocalName == "PackageReference")
                .Select(element => element.Attribute("Include")?.Value)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Cast<string>()
                .ToArray();
            var projectReferences = document.Descendants()
                .Where(element => element.Name.LocalName == "ProjectReference")
                .Select(element => element.Attribute("Include")?.Value)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Cast<string>()
                .ToArray();
            var classification = Policy.DotNetSafetyPolicy.RequiresReview(relative, document.ToString()) ? "review_required" : "allowed";

            yield return new DotNetScanRecord(
                $"dotnet_project_{Path.GetFileNameWithoutExtension(path).ToLowerInvariant()}",
                relative,
                "dotnet_project",
                classification,
                $"Project targets {FormatList(targetFrameworks)} with {packageReferences.Length} packages and {projectReferences.Length} project references.",
                new Dictionary<string, string>
                {
                    ["adapter"] = "project_scanner",
                    ["target_frameworks"] = FormatList(targetFrameworks),
                });
        }
    }

    private static string FormatList(IReadOnlyCollection<string> values) => values.Count == 0 ? "unknown" : string.Join(", ", values);
}

