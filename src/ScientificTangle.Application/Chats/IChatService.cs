namespace ScientificTangle.Application.Chats;

public interface IChatService
{
    Task<ChatDetails> CreateChatWithFirstMessageAsync(string userId, string messageText,
        CancellationToken cancellationToken = default);

    Task<ChatListBatch> GetChatsAsync(string userId, int skip, int take, CancellationToken cancellationToken = default);

    Task<ChatDetails?> GetChatAsync(string userId, Guid chatId, DateTime? messagesBeforeUtc, int messagesTake,
        CancellationToken cancellationToken = default);

    Task<ChatDetails?> AddMessageAsync(string userId, Guid chatId, string messageText,
        CancellationToken cancellationToken = default);

    Task<bool> SetPinnedAsync(string userId, Guid chatId, bool isPinned, CancellationToken cancellationToken = default);

    Task<bool> DeleteChatAsync(string userId, Guid chatId, CancellationToken cancellationToken = default);
}
