namespace ScientificTangle.Infrastructure.KnowledgeGraph;

public sealed class GraphRagOptions
{
    public const string SectionName = "GraphRag";

    public string BaseUrl { get; init; } = "https://science-search.shevkunov.space";

    public int TimeoutSeconds { get; init; } = 120;
}
