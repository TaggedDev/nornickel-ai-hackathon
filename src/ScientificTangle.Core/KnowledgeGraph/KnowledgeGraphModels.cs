namespace ScientificTangle.Core.KnowledgeGraph;

public sealed record KnowledgeGraphSnapshot(
    IReadOnlyCollection<KnowledgeGraphNode> Nodes,
    IReadOnlyCollection<KnowledgeGraphEdge> Edges);

public sealed record KnowledgeGraphNode(
    string Id,
    string Type,
    string Label,
    string CanonicalName,
    IReadOnlyCollection<string> Aliases,
    IReadOnlyDictionary<string, string> Properties);

public sealed record KnowledgeGraphEdge(
    string Id,
    string Type,
    string Source,
    string Target,
    IReadOnlyDictionary<string, string> Properties);

public sealed record ReferencedDocument(
    string Id,
    string Title,
    string Snippet,
    string? Section,
    int? Page,
    double Confidence,
    string? Geo,
    int? Year,
    string? Language);

public sealed record ChatKnowledgeContext(
    KnowledgeGraphSnapshot Graph,
    IReadOnlyCollection<ReferencedDocument> Documents,
    IReadOnlyCollection<string> RepresentedNodeIds);
