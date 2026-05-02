using System.Text.RegularExpressions;

namespace Agoragentic.EcfCore.DotNet.Policy;

public static class DotNetSafetyPolicy
{
    public static readonly IReadOnlyList<string> DefaultBlockedPatterns = new[]
    {
        "bin/**",
        "obj/**",
        ".vs/**",
        ".git/**",
        ".ecf-core/**",
        ".micro-ecf/**",
        "TestResults/**",
        "*.pfx",
        "*.snk",
        "*.user",
        "*.suo",
        "*.nupkg",
        "*.dll",
        "*.exe",
        "*.pdb",
        "*.db",
        "*.sqlite",
        "*.bak",
        "*.publishsettings",
        "Properties/ServiceDependencies/**",
    };

    public static readonly IReadOnlyList<string> ReviewRequiredPatterns = new[]
    {
        "appsettings.Production.json",
        "appsettings.Staging.json",
        "Properties/launchSettings.json",
        "launchSettings.json",
        "secrets.json",
        "UserSecretsId",
        "Migrations/**",
    };

    public static readonly IReadOnlyList<string> RedactionKeyPatterns = new[]
    {
        "ConnectionStrings",
        "Password",
        "Secret",
        "ClientSecret",
        "ApiKey",
        "Token",
        "PrivateKey",
        "Certificate",
        "InstrumentationKey",
        "ApplicationInsights",
        "AzureWebJobsStorage",
        "ServiceBus",
        "Cosmos",
        "Redis",
        "OpenAI",
        "Anthropic",
        "Groq",
        "Stripe",
        "Coinbase",
    };

    public static bool ShouldBlock(string relativePath) =>
        DefaultBlockedPatterns.Any(pattern => MatchesPattern(relativePath, pattern));

    public static bool RequiresReview(string relativePath, string? content = null)
    {
        if (ReviewRequiredPatterns.Any(pattern => MatchesPattern(relativePath, pattern)))
        {
            return true;
        }

        return content is not null && content.Contains("UserSecretsId", StringComparison.OrdinalIgnoreCase);
    }

    public static string RedactSensitiveJson(string json)
    {
        var redacted = json;
        foreach (var key in RedactionKeyPatterns)
        {
            redacted = SensitiveJsonValueRegex(key).Replace(redacted, "$1\"[redacted]\"");
        }

        return redacted;
    }

    private static bool MatchesPattern(string relativePath, string pattern)
    {
        var normalized = relativePath.Replace('\\', '/');
        var normalizedPattern = pattern.Replace('\\', '/');

        if (normalizedPattern.EndsWith("/**", StringComparison.Ordinal))
        {
            var prefix = normalizedPattern[..^3];
            return normalized.Equals(prefix, StringComparison.OrdinalIgnoreCase)
                || normalized.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase);
        }

        if (normalizedPattern.StartsWith("*.", StringComparison.Ordinal))
        {
            return normalized.EndsWith(normalizedPattern[1..], StringComparison.OrdinalIgnoreCase);
        }

        return normalized.Equals(normalizedPattern, StringComparison.OrdinalIgnoreCase)
            || normalized.EndsWith("/" + normalizedPattern, StringComparison.OrdinalIgnoreCase);
    }

    private static Regex SensitiveJsonValueRegex(string key)
    {
        var escaped = Regex.Escape(key);
        return new Regex($"(\"{escaped}\"\\s*:\\s*)\"[^\"]*\"", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }
}
