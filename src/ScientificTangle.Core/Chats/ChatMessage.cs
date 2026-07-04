namespace ScientificTangle.Core.Chats;

public sealed class ChatMessage
{
    private ChatMessage()
    {
    }

    public ChatMessage(Guid chatId, ChatMessageSender sender, string text, DateTime createdAtUtc)
    {
        Id = Guid.NewGuid();
        ChatId = chatId;
        Sender = sender;
        Text = text.Trim();
        CreatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }

    public Guid ChatId { get; private set; }

    public ChatMessageSender Sender { get; private set; }

    public string Text { get; private set; } = string.Empty;

    public DateTime CreatedAtUtc { get; private set; }
}
