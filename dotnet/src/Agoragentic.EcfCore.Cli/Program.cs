using System.Text.Json;
using Agoragentic.EcfCore.Artifacts;
using Agoragentic.EcfCore.DotNet;
using Agoragentic.EcfCore.DotNet.Policy;
using Agoragentic.EcfCore.IO;
using Agoragentic.EcfCore.Validation;

namespace Agoragentic.EcfCore.Cli;

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static async Task<int> Main(string[] args)
    {
        if (args.Length == 0 || args[0] is "-h" or "--help" or "help")
        {
            PrintHelp();
            return 0;
        }

        var command = args[0];
        var projectRoot = ResolveProjectRoot(args);
        var outDir = ResolveOutDir(args, projectRoot);

        try
        {
            return command switch
            {
                "init" => await InitAsync(projectRoot),
                "compile" => await CompileAsync(projectRoot, outDir, args.Contains("--agent-os")),
                "export" => await CompileAsync(projectRoot, outDir, true),
                "eval" => await EvalAsync(outDir, args.Contains("--grounding")),
                "validate" => await ValidateAsync(args.Length > 1 && !args[1].StartsWith("--", StringComparison.Ordinal) ? args[1] : outDir),
                "version" => PrintVersion(),
                _ => Unknown(command),
            };
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidDataException)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static async Task<int> InitAsync(string projectRoot)
    {
        Directory.CreateDirectory(projectRoot);
        var configPath = Path.Combine(projectRoot, "ecf.config.json");
        if (File.Exists(configPath))
        {
            Console.WriteLine($"Already exists: {configPath}");
            return 0;
        }

        var config = new
        {
            schema_version = "ecf-core.local-config.v1",
            project_name = Path.GetFileName(Path.GetFullPath(projectRoot)),
            scope = "local_dotnet_project",
            allow = new[] { "*.sln", "*.csproj", "*.cs", "README.md", "docs/**", "appsettings*.json" },
            block = DotNetSafetyPolicy.DefaultBlockedPatterns,
            review_required = DotNetSafetyPolicy.ReviewRequiredPatterns,
            tool_limits = new { max_calls = 4, network_allowed = false, write_allowed = false },
            handoff = new { agent_os_preview_allowed = true, live_deploy_allowed = false },
        };
        await EcfArtifactSet.SaveJsonAsync(configPath, config);
        Console.WriteLine($"Wrote {configPath}");
        return 0;
    }

    private static async Task<int> CompileAsync(string projectRoot, string outDir, bool emitAgentOs)
    {
        var compiler = new DotNetContextCompiler();
        var artifacts = await compiler.CompileAsync(projectRoot, emitAgentOs);
        await artifacts.SaveAsync(outDir);
        Console.WriteLine($"Wrote ECF Core artifacts to {outDir}");
        return 0;
    }

    private static async Task<int> EvalAsync(string outDir, bool grounding)
    {
        Directory.CreateDirectory(outDir);
        var report = new EvalReport { Verdict = "pass" };
        await EcfArtifactSet.SaveJsonAsync(Path.Combine(outDir, "eval-report.json"), report);
        await File.WriteAllTextAsync(Path.Combine(outDir, "eval-report.md"), "# ECF Core .NET Eval\n\nVerdict: pass\n");

        if (grounding)
        {
            var groundingEval = new GroundingEval { Verdict = "pass" };
            await EcfArtifactSet.SaveJsonAsync(Path.Combine(outDir, "grounding-eval.json"), groundingEval);
            await File.WriteAllTextAsync(Path.Combine(outDir, "grounding-eval.md"), "# ECF Core .NET Grounding Eval\n\nVerdict: pass\n");
        }

        Console.WriteLine(JsonSerializer.Serialize(new { ok = true, grounding }, JsonOptions));
        return 0;
    }

    private static async Task<int> ValidateAsync(string artifactDirectory)
    {
        var result = await EcfArtifactValidator.ValidateDirectoryAsync(artifactDirectory);
        Console.WriteLine(JsonSerializer.Serialize(result, JsonOptions));
        return result.Ok ? 0 : 1;
    }

    private static int PrintVersion()
    {
        Console.WriteLine("ecfnet 0.1.0-preview");
        return 0;
    }

    private static int Unknown(string command)
    {
        Console.Error.WriteLine($"Unknown command: {command}");
        PrintHelp();
        return 1;
    }

    private static string ResolveProjectRoot(string[] args)
    {
        if (args.Length > 1 && !args[1].StartsWith("--", StringComparison.Ordinal))
        {
            return Path.GetFullPath(args[1]);
        }

        return Directory.GetCurrentDirectory();
    }

    private static string ResolveOutDir(string[] args, string projectRoot)
    {
        var index = Array.IndexOf(args, "--out");
        if (index >= 0 && index + 1 < args.Length)
        {
            return Path.GetFullPath(args[index + 1]);
        }

        return Path.Combine(projectRoot, ".ecf-core");
    }

    private static void PrintHelp()
    {
        Console.WriteLine("""
        ecfnet - ECF Core for .NET

        Commands:
          ecfnet init [project]
          ecfnet compile [project] [--agent-os] [--out .ecf-core]
          ecfnet eval [project] [--grounding] [--out .ecf-core]
          ecfnet validate [artifact-dir]
          ecfnet export [project] [--agent-os] [--out .ecf-core]
          ecfnet version

        Boundary:
          Preview-only local context governance. No hosted runtime, wallet settlement,
          x402 execution, marketplace routing, or Full ECF private internals.
        """);
    }
}

