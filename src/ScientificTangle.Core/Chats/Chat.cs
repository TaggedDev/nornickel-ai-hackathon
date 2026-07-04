namespace ScientificTangle.Core.Chats;

public sealed class Chat
{
    private readonly List<ChatMessage> _messages = [];
    private readonly List<ChatPin> _pins = [];

    private Chat()
    {
    }

    public Chat(string ownerUserId, string firstMessageText, DateTime createdAtUtc)
    {
        Id = Guid.NewGuid();
        OwnerUserId = ownerUserId;
        Title = BuildTitle(firstMessageText);
        CreatedAtUtc = createdAtUtc;
        LastActivityAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }

    public string OwnerUserId { get; private set; } = string.Empty;

    public string Title { get; private set; } = string.Empty;

    public bool IsPublic { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime LastActivityAtUtc { get; private set; }

    public IReadOnlyCollection<ChatMessage> Messages => _messages;

    public IReadOnlyCollection<ChatPin> Pins => _pins;

    public bool CanBeReadBy(string userId) => OwnerUserId == userId || IsPublic;

    public bool CanBeModifiedBy(string userId) => OwnerUserId == userId;

    public ChatMessage AddMessage(ChatMessageSender sender, string text, DateTime createdAtUtc)
    {
        var message = new ChatMessage(Id, sender, text, createdAtUtc);
        _messages.Add(message);
        LastActivityAtUtc = createdAtUtc;

        return message;
    }

    public static string BuildTitle(string firstMessageText)
    {
        var normalized = firstMessageText.Trim();
        return normalized.Length <= 60 ? normalized : $"{normalized[..57]}...";
    }
}
