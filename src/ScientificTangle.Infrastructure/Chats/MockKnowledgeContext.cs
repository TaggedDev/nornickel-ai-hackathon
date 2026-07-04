using ScientificTangle.Core.KnowledgeGraph;

namespace ScientificTangle.Infrastructure.Chats;

internal static class MockKnowledgeContext
{
    public static ChatKnowledgeContext Create()
    {
        var nodes = new List<KnowledgeGraphNode>
        {
            Node("n1", "Process", "электроэкстракция никеля", "электроэкстракция никеля (Ni electrowinning)",
                ["electrowinning", "Ni EW", "ЭЭ никеля"]),
            Node("n2", "Material", "католит", "католит", ["catholyte"]),
            Node("n3", "Equipment", "ванна электроэкстракции", "ванна электроэкстракции",
                ["EW cell", "электролизная ванна"]),
            Node("n4", "Property", "скорость циркуляции", "скорость циркуляции католита", ["flow rate"],
                new Dictionary<string, string> { ["param"] = "скорость циркуляции", ["unit"] = "м3/ч" }),
            Node("n5", "Property", "температура католита", "температура католита", [],
                new Dictionary<string, string> { ["param"] = "температура", ["unit"] = "°C" })
        };

        var edges = new List<KnowledgeGraphEdge>
        {
            Edge("e1", "uses_material", "n1", "n2",
                ("confidence", "0.86"), ("docId", "doc_9f2a11c7be03"), ("citationId", "1")),
            Edge("e2", "operates_at_condition", "n1", "n4",
                ("confidence", "0.86"), ("docId", "doc_9f2a11c7be03"), ("citationId", "1"),
                ("snippet", "при скорости циркуляции 8-10 м3/ч на ванну..."),
                ("value", "9"), ("op", "range"), ("valueMin", "8"), ("valueMax", "10"), ("unit", "м3/ч")),
            Edge("e3", "operates_at_condition", "n1", "n4",
                ("confidence", "0.74"), ("docId", "doc_1c7b93df20aa"), ("citationId", "3"),
                ("snippet", "увеличение скорости циркуляции до 12-15 м3/ч на ванну..."),
                ("value", "13.5"), ("op", "range"), ("valueMin", "12"), ("valueMax", "15"), ("unit", "м3/ч")),
            Edge("e4", "operates_at_condition", "n1", "n5",
                ("confidence", "0.79"), ("docId", "doc_4d8e60a1f592"), ("citationId", "2"),
                ("snippet", "поддерживать температуру в пределах 60-65 °C..."),
                ("value", "62.5"), ("op", "range"), ("valueMin", "60"), ("valueMax", "65"), ("unit", "°C")),
            Edge("e5", "produces_output", "n3", "n2",
                ("confidence", "0.79"), ("docId", "doc_4d8e60a1f592"), ("citationId", "2")),
            Edge("e6", "contradicts", "e2", "e3",
                ("topic", "оптимальная скорость циркуляции католита"),
                ("reason", "числовое расхождение оптимума: 8-10 vs 12-15 м3/ч"))
        };

        var documents = new List<ReferencedDocument>
        {
            new(
                "doc_9f2a11c7be03",
                "Электроэкстракция никеля. Влияние состава электролита",
                "Подача католита осуществляется через нижний распределительный коллектор; при скорости циркуляции 8-10 м3/ч на ванну достигается равномерное распределение концентрации никеля у поверхности катода.",
                "3.2 Организация циркуляции электролита",
                12,
                0.86,
                "world",
                2019,
                "ru"),
            new(
                "doc_4d8e60a1f592",
                "ОИП-05-2019 Параметры Cu EW",
                "Боковая рециркуляция электролита через переливные карманы с выносным теплообменником позволяет поддерживать температуру в пределах 60-65 °C без локальных перегревов.",
                "2.4 Тепловой режим ванн",
                8,
                0.79,
                "world",
                2019,
                "ru"),
            new(
                "doc_1c7b93df20aa",
                "Обзор. Мировая практика электрического рафинирования черновых медных анодов",
                "Для линий с повышенной плотностью тока рекомендуется увеличение скорости циркуляции до 12-15 м3/ч на ванну для предотвращения обеднения приэлектродного слоя.",
                "4.1 Гидродинамика ванны",
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
