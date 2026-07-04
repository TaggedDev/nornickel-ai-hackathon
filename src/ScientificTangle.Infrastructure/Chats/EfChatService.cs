using Microsoft.EntityFrameworkCore;
using ScientificTangle.Application.Chats;
using ScientificTangle.Core.Chats;
using ScientificTangle.Infrastructure.Persistence;

namespace ScientificTangle.Infrastructure.Chats;

public sealed class EfChatService : IChatService
{
    private const int MaxTake = 100;
    private readonly ScientificTangleIdentityDbContext _dbContext;

    public EfChatService(ScientificTangleIdentityDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ChatDetails> CreateChatWithFirstMessageAsync(string userId, string messageText,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var chat = new Chat(userId, messageText, now);
        chat.AddMessage(ChatMessageSender.User, messageText, now);

        await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken);
        chat.AddMessage(ChatMessageSender.Assistant, "Mocked AI Answer", DateTime.UtcNow);

        _dbContext.Chats.Add(chat);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return await BuildDetailsAsync(chat.Id, userId, null, MaxTake, cancellationToken) ??
               throw new InvalidOperationException($"Created chat '{chat.Id}' could not be loaded.");
    }

    public async Task<ChatListBatch> GetChatsAsync(string userId, int skip, int take,
        CancellationToken cancellationToken = default)
    {
        skip = Math.Max(0, skip);
        take = NormalizeTake(take);

        var chats = await _dbContext.Chats
            .AsNoTracking()
            .Where(chat => chat.OwnerUserId == userId)
            .Select(chat => new
            {
                chat.Id,
                chat.Title,
                chat.OwnerUserId,
                chat.LastActivityAtUtc,
                chat.CreatedAtUtc,
                IsPinned = chat.Pins.Any(pin => pin.UserId == userId)
            })
            .OrderByDescending(chat => chat.IsPinned)
            .ThenByDescending(chat => chat.LastActivityAtUtc)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        var items = chats
            .Select(chat => new ChatListItem(chat.Id, chat.Title, chat.IsPinned, chat.OwnerUserId == userId,
                chat.LastActivityAtUtc, chat.CreatedAtUtc))
            .ToList();

        return new ChatListBatch(items, skip + items.Count);
    }

    public Task<ChatDetails?> GetChatAsync(string userId, Guid chatId, DateTime? messagesBeforeUtc, int messagesTake,
        CancellationToken cancellationToken = default)
        => BuildDetailsAsync(chatId, userId, messagesBeforeUtc, NormalizeTake(messagesTake), cancellationToken);

    public async Task<ChatDetails?> AddMessageAsync(string userId, Guid chatId, string messageText,
        CancellationToken cancellationToken = default)
    {
        var chat = await _dbContext.Chats.FirstOrDefaultAsync(candidate => candidate.Id == chatId, cancellationToken);
        if (chat is null || !chat.CanBeModifiedBy(userId))
        {
            return null;
        }

        chat.AddMessage(ChatMessageSender.User, messageText, DateTime.UtcNow);

        await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken);
        chat.AddMessage(ChatMessageSender.Assistant, "Mocked AI Answer", DateTime.UtcNow);

        await _dbContext.SaveChangesAsync(cancellationToken);
        return await BuildDetailsAsync(chat.Id, userId, null, MaxTake, cancellationToken);
    }

    public async Task<bool> SetPinnedAsync(string userId, Guid chatId, bool isPinned,
        CancellationToken cancellationToken = default)
    {
        var canRead = await _dbContext.Chats
            .AnyAsync(chat => chat.Id == chatId && (chat.OwnerUserId == userId || chat.IsPublic), cancellationToken);
        if (!canRead)
        {
            return false;
        }

        var existingPin = await _dbContext.ChatPins
            .FirstOrDefaultAsync(pin => pin.ChatId == chatId && pin.UserId == userId, cancellationToken);

        if (isPinned && existingPin is null)
        {
            _dbContext.ChatPins.Add(new ChatPin(chatId, userId, DateTime.UtcNow));
        }
        else if (!isPinned && existingPin is not null)
        {
            _dbContext.ChatPins.Remove(existingPin);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteChatAsync(string userId, Guid chatId, CancellationToken cancellationToken = default)
    {
        var chat = await _dbContext.Chats.FirstOrDefaultAsync(candidate => candidate.Id == chatId, cancellationToken);
        if (chat is null || !chat.CanBeModifiedBy(userId))
        {
            return false;
        }

        _dbContext.Chats.Remove(chat);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<ChatDetails?> BuildDetailsAsync(Guid chatId, string userId, DateTime? messagesBeforeUtc,
        int messagesTake, CancellationToken cancellationToken)
    {
        var chat = await _dbContext.Chats
            .AsNoTracking()
            .Where(candidate => candidate.Id == chatId && (candidate.OwnerUserId == userId || candidate.IsPublic))
            .Select(candidate => new
            {
                candidate.Id,
                candidate.Title,
                candidate.OwnerUserId,
                candidate.CreatedAtUtc,
                candidate.LastActivityAtUtc,
                IsPinned = candidate.Pins.Any(pin => pin.UserId == userId)
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (chat is null)
        {
            return null;
        }

        var messages = await _dbContext.ChatMessages
            .AsNoTracking()
            .Where(message => message.ChatId == chatId)
            .Where(message => messagesBeforeUtc == null || message.CreatedAtUtc < messagesBeforeUtc)
            .OrderByDescending(message => message.CreatedAtUtc)
            .Take(messagesTake + 1)
            .Select(message => new ChatMessageItem(message.Id, message.Sender, message.Text, message.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        var hasMore = messages.Count > messagesTake;
        var page = messages.Take(messagesTake).Reverse().ToList();
        var nextBeforeUtc = hasMore ? page.FirstOrDefault()?.CreatedAtUtc : null;

        return new ChatDetails(chat.Id, chat.Title, chat.IsPinned, chat.OwnerUserId == userId, chat.LastActivityAtUtc,
            chat.CreatedAtUtc, page, nextBeforeUtc);
    }

    private static int NormalizeTake(int take) => Math.Clamp(take <= 0 ? 30 : take, 1, MaxTake);
}
