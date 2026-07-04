using ScientificTangle.Core.KnowledgeGraph;

namespace ScientificTangle.Infrastructure.Chats;

internal static class MockKnowledgeContext
{
    public static ChatKnowledgeContext Create()
    {
        var nodes = new List<KnowledgeGraphNode>
        {
            Node("n1", "Process", "Nickel electrowinning", "Nickel electrowinning", ["Ni EW", "electrowinning"]),
            Node("n2", "Material", "Catholyte", "Catholyte", ["catholyte"]),
            Node("n3", "Equipment", "Electrowinning cell", "Electrowinning cell", ["EW cell"]),
            Node("n4", "Property", "Circulation flow rate", "Catholyte circulation flow rate", ["flow rate"],
                new Dictionary<string, string> { ["param"] = "circulation flow rate", ["unit"] = "m3/h" }),
            Node("n5", "Property", "Catholyte temperature", "Catholyte temperature", [],
                new Dictionary<string, string> { ["param"] = "temperature", ["unit"] = "C" })
        };

        var edges = new List<KnowledgeGraphEdge>
        {
            Edge("e1", "uses_material", "n1", "n2",
                ("confidence", "0.86"), ("docId", "doc_9f2a11c7be03"), ("citationId", "1")),
            Edge("e2", "operates_at_condition", "n1", "n4",
                ("confidence", "0.86"), ("docId", "doc_9f2a11c7be03"), ("citationId", "1"),
                ("value", "9"), ("op", "range"), ("valueMin", "8"), ("valueMax", "10"), ("unit", "m3/h")),
            Edge("e3", "operates_at_condition", "n1", "n4",
                ("confidence", "0.74"), ("docId", "doc_1c7b93df20aa"), ("citationId", "3"),
                ("value", "13.5"), ("op", "range"), ("valueMin", "12"), ("valueMax", "15"), ("unit", "m3/h")),
            Edge("e4", "operates_at_condition", "n1", "n5",
                ("confidence", "0.79"), ("docId", "doc_4d8e60a1f592"), ("citationId", "2"),
                ("value", "62.5"), ("op", "range"), ("valueMin", "60"), ("valueMax", "65"), ("unit", "C")),
            Edge("e5", "produces_output", "n3", "n2",
                ("confidence", "0.79"), ("docId", "doc_4d8e60a1f592"), ("citationId", "2")),
            Edge("e6", "contradicts", "e2", "e3",
                ("topic", "optimal catholyte circulation flow rate"),
                ("reason", "Numeric optimum differs: 8-10 vs 12-15 m3/h"))
        };

        var documents = new List<ReferencedDocument>
        {
            new(
                "doc_9f2a11c7be03",
                "Nickel electrowinning. Electrolyte composition influence",
                "Catholyte is supplied through the lower distribution collector; 8-10 m3/h per cell gives an even nickel concentration near the cathode.",
                "3.2 Electrolyte circulation",
                12,
                0.86,
                "world",
                2019,
                "ru"),
            new(
                "doc_4d8e60a1f592",
                "OIP-05-2019 Cu EW parameters",
                "Side recirculation through overflow pockets with an external heat exchanger keeps temperature within 60-65 C.",
                "2.4 Cell thermal mode",
                8,
                0.79,
                "world",
                2019,
                "ru"),
            new(
                "doc_1c7b93df20aa",
                "Review. Global practice of electric refining",
                "High-current-density lines recommend circulation up to 12-15 m3/h per cell to prevent near-electrode depletion.",
                "4.1 Cell hydrodynamics",
                21,
                0.74,
                "world",
                2021,
                "ru")
        };

        return new ChatKnowledgeContext(
            new KnowledgeGraphSnapshot(nodes, edges),
            documents,
            nodes.Select(node => node.Id).ToList());
    }

    private static KnowledgeGraphNode Node(
        string id,
        string type,
        string label,
        string canonicalName,
        IReadOnlyCollection<string> aliases,
        IReadOnlyDictionary<string, string>? properties = null)
        => new(id, type, label, canonicalName, aliases, properties ?? new Dictionary<string, string>());

    private static KnowledgeGraphEdge Edge(
        string id,
        string type,
        string source,
        string target,
        params (string Key, string Value)[] properties)
        => new(id, type, source, target, properties.ToDictionary(pair => pair.Key, pair => pair.Value));
}
