namespace ScientificTangle.Core.Chats;

public sealed class ChatPin
{
    private ChatPin()
    {
    }

    public ChatPin(Guid chatId, string userId, DateTime pinnedAtUtc)
    {
        ChatId = chatId;
        UserId = userId;
        PinnedAtUtc = pinnedAtUtc;
    }

    public Guid ChatId { get; private set; }

    public string UserId { get; private set; } = string.Empty;

    public DateTime PinnedAtUtc { get; private set; }

    public Chat Chat { get; private set; } = null!;
}
