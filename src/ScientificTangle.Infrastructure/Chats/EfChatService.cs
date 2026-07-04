using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ScientificTangle.Application.Chats;
using ScientificTangle.Application.KnowledgeGraph;
using ScientificTangle.Core.Chats;
using ScientificTangle.Core.KnowledgeGraph;
using ScientificTangle.Infrastructure.Persistence;

namespace ScientificTangle.Infrastructure.Chats;

public sealed class EfChatService : IChatService
{
    private const int MaxTake = 100;
    private readonly ScientificTangleIdentityDbContext _dbContext;
    private readonly IKnowledgeGraphSearchClient _knowledgeGraphSearchClient;
    private readonly ILogger<EfChatService> _logger;

    public EfChatService(
        ScientificTangleIdentityDbContext dbContext,
        IKnowledgeGraphSearchClient knowledgeGraphSearchClient,
        ILogger<EfChatService> logger)
    {
        _dbContext = dbContext;
        _knowledgeGraphSearchClient = knowledgeGraphSearchClient;
        _logger = logger;
    }

    public async Task<ChatDetails> CreateChatWithFirstMessageAsync(string userId, string messageText,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var chat = new Chat(userId, messageText, now);
        chat.AddMessage(ChatMessageSender.User, messageText, now);
        _dbContext.Chats.Add(chat);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await AddAssistantAnswerAsync(chat, messageText, cancellationToken);
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

        var userMessage = chat.AddMessage(ChatMessageSender.User, messageText, DateTime.UtcNow);
        _dbContext.ChatMessages.Add(userMessage);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await AddAssistantAnswerAsync(chat, messageText, cancellationToken);
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
                candidate.KnowledgeContextJson,
                candidate.RepresentedKnowledgeGraphNodeIdsJson,
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

        var knowledgeContext = DeserializeKnowledgeContext(chat.KnowledgeContextJson);
        return new ChatDetails(chat.Id, chat.Title, chat.IsPinned, chat.OwnerUserId == userId, chat.LastActivityAtUtc,
            chat.CreatedAtUtc, page, nextBeforeUtc, knowledgeContext);
    }

    private async Task AddAssistantAnswerAsync(Chat chat, string messageText, CancellationToken cancellationToken)
    {
        try
        {
            var searchResult = await _knowledgeGraphSearchClient.SearchAsync(messageText, cancellationToken);
            var assistantMessage = chat.AddMessage(ChatMessageSender.Assistant, searchResult.AnswerMarkdown, DateTime.UtcNow);
            _dbContext.ChatMessages.Add(assistantMessage);
            chat.SetKnowledgeContext(searchResult.Context);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "GraphRAG search failed for chat {ChatId}.", chat.Id);
            var assistantMessage = chat.AddMessage(ChatMessageSender.Assistant,
                "Не удалось получить ответ из базы знаний. Попробуйте повторить запрос позже.",
                DateTime.UtcNow);
            _dbContext.ChatMessages.Add(assistantMessage);
        }
    }

    private static ChatKnowledgeContext? DeserializeKnowledgeContext(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<ChatKnowledgeContext>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static int NormalizeTake(int take) => Math.Clamp(take <= 0 ? 30 : take, 1, MaxTake);
}
