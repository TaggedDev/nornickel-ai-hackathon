namespace ScientificTangle.Contracts.Chats;

public sealed record CreateChatRequest(string Message);

public sealed record AddChatMessageRequest(string Message);

public sealed record SetChatPinnedRequest(bool IsPinned);

public sealed record ChatListResponse(IReadOnlyCollection<ChatListItemResponse> Items, int NextSkip);

public sealed record ChatListItemResponse(Guid Id, string Title, bool IsPinned, bool IsOwnedByCurrentUser,
    DateTime LastActivityAtUtc, DateTime CreatedAtUtc);

public sealed record ChatDetailsResponse(Guid Id, string Title, bool IsPinned, bool IsOwnedByCurrentUser,
    DateTime LastActivityAtUtc, DateTime CreatedAtUtc, IReadOnlyCollection<ChatMessageResponse> Messages,
    DateTime? NextMessagesBeforeUtc);

public sealed record ChatMessageResponse(Guid Id, string Sender, string Text, DateTime CreatedAtUtc);
