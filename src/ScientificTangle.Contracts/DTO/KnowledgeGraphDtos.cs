namespace ScientificTangle.Contracts.DTO;

public sealed record KnowledgeGraphDto(
    IReadOnlyCollection<KnowledgeGraphNodeDto> Nodes,
    IReadOnlyCollection<KnowledgeGraphEdgeDto> Edges);

public sealed record KnowledgeGraphNodeDto(
    string Id,
    string Type,
    string Label,
    string CanonicalName,
    IReadOnlyCollection<string> Aliases,
    IReadOnlyDictionary<string, string> Properties);

public sealed record KnowledgeGraphEdgeDto(
    string Id,
    string Type,
    string Source,
    string Target,
    IReadOnlyDictionary<string, string> Properties);

public sealed record ReferencedDocumentDto(
    int CitationId,
    string Id,
    string Title,
    string Snippet,
    string? Section,
    int? Page,
    double Confidence,
    string? Geo,
    int? Year,
    string? Language,
    string DownloadUrl);

public sealed record ChatKnowledgeContextDto(
    KnowledgeGraphDto Graph,
    IReadOnlyCollection<ReferencedDocumentDto> Documents,
    IReadOnlyCollection<string> RepresentedNodeIds,
    ChatKnowledgeSearchMetaDto? Search);

public sealed record ChatKnowledgeSearchMetaDto(
    string Query,
    string Intent,
    int RetrievedFacts,
    int UsedFacts,
    string? Model,
    bool NoData);
