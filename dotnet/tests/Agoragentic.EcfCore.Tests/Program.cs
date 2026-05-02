using Agoragentic.EcfCore.DotNet.Policy;

Require(DotNetSafetyPolicy.ShouldBlock("bin/Debug/net8.0/app.dll"), "bin output must be blocked");
Require(DotNetSafetyPolicy.ShouldBlock("app.pfx"), "certificate files must be blocked");
Require(DotNetSafetyPolicy.RequiresReview("appsettings.Production.json"), "production appsettings must require review");
Require(DotNetSafetyPolicy.RedactSensitiveJson("""{"ApiKey":"secret"}""").Contains("[redacted]", StringComparison.Ordinal), "API keys must redact");

Console.WriteLine("ECF Core .NET source checks passed.");

static void Require(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}

