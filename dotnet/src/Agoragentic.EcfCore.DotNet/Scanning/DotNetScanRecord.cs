namespace Agoragentic.EcfCore.DotNet.Scanning;

public sealed record DotNetScanRecord(
    string Id,
    string Path,
    string Type,
    string Classification,
    string Summary,
    IReadOnlyDictionary<string, string> Provenance);

