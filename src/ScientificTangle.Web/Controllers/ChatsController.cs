using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScientificTangle.Application.Chats;
using ScientificTangle.Contracts.Chats;

namespace ScientificTangle.Web.Controllers;

[ApiController]
[Authorize]
[Route("api/chats")]
public sealed class ChatsController : ControllerBase
{
    private readonly IChatService _chatService;

    public ChatsController(IChatService chatService)
    {
        _chatService = chatService;
    }

    [HttpGet]
    public async Task<ActionResult<ChatListResponse>> GetChats([FromQuery] int skip = 0, [FromQuery] int take = 30,
        CancellationToken cancellationToken = default)
    {
        var batch = await _chatService.GetChatsAsync(GetCurrentUserId(), skip, take, cancellationToken);
        return Ok(new ChatListResponse(batch.Items.Select(Map).ToList(), batch.NextSkip));
    }

    [HttpPost]
    public async Task<ActionResult<ChatDetailsResponse>> CreateChat([FromBody] CreateChatRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.Message)] = ["Message is required."]
            }));
        }

        var chat = await _chatService.CreateChatWithFirstMessageAsync(GetCurrentUserId(), request.Message,
            cancellationToken);

        return CreatedAtAction(nameof(GetChat), new { chatId = chat.Id }, Map(chat));
    }

    [HttpGet("{chatId:guid}")]
    public async Task<ActionResult<ChatDetailsResponse>> GetChat(Guid chatId,
        [FromQuery] DateTime? messagesBeforeUtc = null, [FromQuery] int messagesTake = 50,
        CancellationToken cancellationToken = default)
    {
        var chat = await _chatService.GetChatAsync(GetCurrentUserId(), chatId, messagesBeforeUtc, messagesTake,
            cancellationToken);

        return chat is null ? NotFound() : Ok(Map(chat));
    }

    [HttpPost("{chatId:guid}/messages")]
    public async Task<ActionResult<ChatDetailsResponse>> AddMessage(Guid chatId, [FromBody] AddChatMessageRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(request.Message)] = ["Message is required."]
            }));
        }

        var chat = await _chatService.AddMessageAsync(GetCurrentUserId(), chatId, request.Message, cancellationToken);
        return chat is null ? NotFound() : Ok(Map(chat));
    }

    [HttpPatch("{chatId:guid}/pin")]
    public async Task<IActionResult> SetPinned(Guid chatId, [FromBody] SetChatPinnedRequest request,
        CancellationToken cancellationToken = default)
    {
        var updated = await _chatService.SetPinnedAsync(GetCurrentUserId(), chatId, request.IsPinned,
            cancellationToken);

        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{chatId:guid}")]
    public async Task<IActionResult> DeleteChat(Guid chatId, CancellationToken cancellationToken = default)
    {
        var deleted = await _chatService.DeleteChatAsync(GetCurrentUserId(), chatId, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    private string GetCurrentUserId()
        => User.FindFirstValue(ClaimTypes.NameIdentifier) ??
           throw new InvalidOperationException("Authenticated user id claim was not found.");

    private static ChatListItemResponse Map(ChatListItem item)
        => new(item.Id, item.Title, item.IsPinned, item.IsOwnedByCurrentUser, item.LastActivityAtUtc,
            item.CreatedAtUtc);

    private static ChatDetailsResponse Map(ChatDetails chat)
        => new(chat.Id, chat.Title, chat.IsPinned, chat.IsOwnedByCurrentUser, chat.LastActivityAtUtc,
            chat.CreatedAtUtc, chat.Messages.Select(Map).ToList(), chat.NextMessagesBeforeUtc);

    private static ChatMessageResponse Map(ChatMessageItem message)
        => new(message.Id, message.Sender.ToString(), message.Text, message.CreatedAtUtc);
}
