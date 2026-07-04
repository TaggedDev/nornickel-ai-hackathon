using ScientificTangle.Core.KnowledgeGraph;

namespace ScientificTangle.Application.KnowledgeGraph;

public interface IKnowledgeGraphSearchClient
{
    Task<KnowledgeGraphSearchResult> SearchAsync(string query, CancellationToken cancellationToken = default);
}

public sealed record KnowledgeGraphSearchResult(
    string Query,
    string Intent,
    string AnswerMarkdown,
    ChatKnowledgeContext Context,
    KnowledgeGraphSearchMeta Meta);

public sealed record KnowledgeGraphSearchMeta(
    int RetrievedFacts,
    int UsedFacts,
    string? Model,
    bool NoData);
