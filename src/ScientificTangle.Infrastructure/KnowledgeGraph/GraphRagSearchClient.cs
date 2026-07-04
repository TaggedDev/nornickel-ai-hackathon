using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using ScientificTangle.Application.KnowledgeGraph;
using ScientificTangle.Core.KnowledgeGraph;

namespace ScientificTangle.Infrastructure.KnowledgeGraph;

public sealed class GraphRagSearchClient : IKnowledgeGraphSearchClient
{
    private readonly HttpClient _httpClient;

    public GraphRagSearchClient(HttpClient httpClient, IOptions<GraphRagOptions> options)
    {
        _httpClient = httpClient;
        _httpClient.BaseAddress = new Uri(options.Value.BaseUrl.TrimEnd('/') + "/", UriKind.Absolute);
        _httpClient.Timeout = TimeSpan.FromSeconds(Math.Max(30, options.Value.TimeoutSeconds));
    }

    public async Task<KnowledgeGraphSearchResult> SearchAsync(string query, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.PostAsJsonAsync("search", new GraphRagSearchRequest(query),
            GraphRagJsonContext.Default.GraphRagSearchRequest, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var detail = await ReadErrorDetailAsync(response, cancellationToken);
            throw new GraphRagSearchException(
                $"GraphRAG search failed with status {(int)response.StatusCode}: {detail}");
        }

        var payload = await response.Content.ReadFromJsonAsync(GraphRagJsonContext.Default.GraphRagSearchResponse,
            cancellationToken);

        if (payload is null)
        {
            throw new GraphRagSearchException("GraphRAG search returned an empty response.");
        }

        return new KnowledgeGraphSearchResult(
            payload.Query ?? query,
            payload.Intent ?? "lookup",
            payload.AnswerMarkdown ?? string.Empty,
            MapContext(payload),
            new KnowledgeGraphSearchMeta(
                payload.Meta?.RetrievedFacts ?? 0,
                payload.Meta?.UsedFacts ?? 0,
                payload.Meta?.Model,
                payload.Meta?.NoData ?? false));
    }

    private static async Task<string> ReadErrorDetailAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var payload = await response.Content.ReadFromJsonAsync(GraphRagJsonContext.Default.GraphRagErrorResponse,
                cancellationToken);
            return payload?.Detail ?? response.ReasonPhrase ?? "unknown error";
        }
        catch (JsonException)
        {
            return response.ReasonPhrase ?? "unknown error";
        }
    }

    private static ChatKnowledgeContext MapContext(GraphRagSearchResponse payload)
    {
        var nodes = payload.Subgraph?.Nodes?
            .Select(node => new KnowledgeGraphNode(
                node.Id ?? string.Empty,
                node.Type ?? "Entity",
                node.Label ?? node.Id ?? string.Empty,
                node.CanonicalName ?? node.Label ?? node.Id ?? string.Empty,
                node.Aliases ?? [],
                MapProperties(node.Props)))
            .Where(node => !string.IsNullOrWhiteSpace(node.Id))
            .ToList() ?? [];

        var edges = payload.Subgraph?.Edges?
            .Select(edge => new KnowledgeGraphEdge(
                edge.Id ?? $"{edge.Source}->{edge.Target}:{edge.Type}",
                edge.Type ?? "related_to",
                edge.Source ?? string.Empty,
                edge.Target ?? string.Empty,
                MapProperties(edge.Props)))
            .Where(edge => !string.IsNullOrWhiteSpace(edge.Id) &&
                           !string.IsNullOrWhiteSpace(edge.Source) &&
                           !string.IsNullOrWhiteSpace(edge.Target))
            .ToList() ?? [];

        var documents = payload.Citations?
            .Select(citation => new ReferencedDocument(
                citation.Id,
                citation.DocId ?? citation.Id.ToString(CultureInfo.InvariantCulture),
                citation.Title ?? "Untitled document",
                citation.Snippet ?? string.Empty,
                citation.Section,
                citation.Page,
                citation.Confidence ?? 0,
                citation.Geo,
                citation.Year,
                citation.Language))
            .ToList() ?? [];

        return new ChatKnowledgeContext(
            new KnowledgeGraphSnapshot(nodes, edges),
            documents,
            nodes.Select(node => node.Id).ToList(),
            new ChatKnowledgeSearchMeta(
                payload.Query ?? string.Empty,
                payload.Intent ?? "lookup",
                payload.Meta?.RetrievedFacts ?? 0,
                payload.Meta?.UsedFacts ?? 0,
                payload.Meta?.Model,
                payload.Meta?.NoData ?? false));
    }

    private static IReadOnlyDictionary<string, string> MapProperties(IReadOnlyDictionary<string, JsonElement>? props)
    {
        if (props is null || props.Count == 0)
        {
            return new Dictionary<string, string>();
        }

        return props.ToDictionary(pair => pair.Key, pair => FormatJsonValue(pair.Value), StringComparer.Ordinal);
    }

    private static string FormatJsonValue(JsonElement value)
        => value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? string.Empty,
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.True => bool.TrueString,
            JsonValueKind.False => bool.FalseString,
            JsonValueKind.Null => string.Empty,
            _ => value.GetRawText()
        };
}

public sealed class GraphRagSearchException : Exception
{
    public GraphRagSearchException(string message) : base(message)
    {
    }
}

public sealed record GraphRagSearchRequest(string Query);

public sealed record GraphRagSearchResponse(
    string? Query,
    string? Intent,
    [property: JsonPropertyName("answer_md")] string? AnswerMarkdown,
    IReadOnlyCollection<GraphRagCitation>? Citations,
    IReadOnlyCollection<JsonElement>? Consensus,
    IReadOnlyCollection<JsonElement>? Contradictions,
    IReadOnlyCollection<JsonElement>? Gaps,
    GraphRagSubgraph? Subgraph,
    GraphRagMeta? Meta);

public sealed record GraphRagCitation(
    int Id,
    [property: JsonPropertyName("doc_id")] string? DocId,
    string? Title,
    string? Snippet,
    string? Section,
    int? Page,
    double? Confidence,
    string? Geo,
    int? Year,
    [property: JsonPropertyName("lang")] string? Language);

public sealed record GraphRagSubgraph(
    IReadOnlyCollection<GraphRagNode>? Nodes,
    IReadOnlyCollection<GraphRagEdge>? Edges);

public sealed record GraphRagNode(
    string? Id,
    string? Type,
    string? Label,
    [property: JsonPropertyName("canonical_name")] string? CanonicalName,
    IReadOnlyCollection<string>? Aliases,
    [property: JsonPropertyName("props")] IReadOnlyDictionary<string, JsonElement>? Props);

public sealed record GraphRagEdge(
    string? Id,
    string? Type,
    string? Source,
    string? Target,
    [property: JsonPropertyName("props")] IReadOnlyDictionary<string, JsonElement>? Props);

public sealed record GraphRagMeta(
    [property: JsonPropertyName("retrieved_facts")] int RetrievedFacts,
    [property: JsonPropertyName("used_facts")] int UsedFacts,
    string? Model,
    [property: JsonPropertyName("no_data")] bool NoData);

public sealed record GraphRagErrorResponse(string? Detail);

[JsonSerializable(typeof(GraphRagSearchRequest))]
[JsonSerializable(typeof(GraphRagSearchResponse))]
[JsonSerializable(typeof(GraphRagErrorResponse))]
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
internal sealed partial class GraphRagJsonContext : JsonSerializerContext;
