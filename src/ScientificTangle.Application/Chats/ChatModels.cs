using ScientificTangle.Core.Chats;
using ScientificTangle.Core.KnowledgeGraph;

namespace ScientificTangle.Application.Chats;

public sealed record ChatListItem(Guid Id, string Title, bool IsPinned, bool IsOwnedByCurrentUser,
    DateTime LastActivityAtUtc, DateTime CreatedAtUtc);

public sealed record ChatDetails(Guid Id, string Title, bool IsPinned, bool IsOwnedByCurrentUser,
    DateTime LastActivityAtUtc, DateTime CreatedAtUtc, IReadOnlyCollection<ChatMessageItem> Messages,
    DateTime? NextMessagesBeforeUtc, ChatKnowledgeContext? KnowledgeContext);

public sealed record ChatMessageItem(Guid Id, ChatMessageSender Sender, string Text, DateTime CreatedAtUtc);

public sealed record ChatListBatch(IReadOnlyCollection<ChatListItem> Items, int NextSkip);
