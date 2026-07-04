using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ScientificTangle.Contracts.Auth;
using ScientificTangle.Infrastructure.Identity;

namespace ScientificTangle.Web.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly RoleManager<ApplicationRole> _roleManager;

    public AuthController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager,
        RoleManager<ApplicationRole> roleManager)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _roleManager = roleManager;
    }

    [HttpGet("check-email")]
    [AllowAnonymous]
    public async Task<ActionResult<CheckEmailAvailabilityResponse>> CheckEmailAvailability([FromQuery] string? email)
    {
        var normalizedEmail = NormalizeEmail(email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["email"] = ["Укажите электронную почту."]
            }));
        }

        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        return Ok(new CheckEmailAvailabilityResponse(user is null));
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthUserResponse>> Register([FromBody] RegisterRequest request)
    {
        NormalizeRegisterRequest(request);

        if (request.Password != request.ConfirmPassword)
        {
            ModelState.AddModelError(nameof(request.ConfirmPassword), "Пароли не совпадают.");
        }

        var role = await _roleManager.FindByNameAsync(request.RoleName);
        if (role is null)
        {
            ModelState.AddModelError(nameof(request.RoleName), "Выбранная роль не существует.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var user = new ApplicationUser
        {
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Email = request.Email,
            UserName = request.Email
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            AddIdentityErrors(createResult);
            return ValidationProblem(ModelState);
        }

        var addToRoleResult = await _userManager.AddToRoleAsync(user, request.RoleName);
        if (!addToRoleResult.Succeeded)
        {
            AddIdentityErrors(addToRoleResult);
            return ValidationProblem(ModelState);
        }

        user.LastLoginAtUtc = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);
        await _signInManager.SignInAsync(user, isPersistent: true);

        return Ok(new AuthUserResponse(user.FirstName, user.LastName, user.Email!, role!.Name!, role.DisplayName));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthUserResponse>> Login([FromBody] LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(email))
        {
            ModelState.AddModelError(nameof(request.Email), "Укажите электронную почту.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return Unauthorized(new ProblemDetails { Title = "Неверная электронная почта или пароль." });
        }

        var signInResult = await _signInManager.PasswordSignInAsync(user.UserName!, request.Password,
            request.RememberMe, lockoutOnFailure: false);

        if (!signInResult.Succeeded)
        {
            return Unauthorized(new ProblemDetails { Title = "Неверная электронная почта или пароль." });
        }

        user.LastLoginAtUtc = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        var role = await GetAssignedRoleAsync(user);
        return Ok(new AuthUserResponse(user.FirstName, user.LastName, user.Email!, role.Name!, role.DisplayName));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok();
    }

    private void NormalizeRegisterRequest(RegisterRequest request)
    {
        request.Email = NormalizeEmail(request.Email);
        request.RoleName = request.RoleName.Trim();
    }

    private static string NormalizeEmail(string? email)
        => email?.Trim().ToLowerInvariant() ?? string.Empty;

    private void AddIdentityErrors(IdentityResult result)
    {
        foreach (var error in result.Errors)
        {
            ModelState.AddModelError(error.Code, TranslateIdentityError(error));
        }
    }

    private static string TranslateIdentityError(IdentityError error)
    {
        return error.Code switch
        {
            "DuplicateEmail" => "Пользователь с такой электронной почтой уже существует.",
            "DuplicateUserName" => "Пользователь с такой электронной почтой уже существует.",
            "InvalidEmail" => "Введите корректный адрес электронной почты.",
            "InvalidUserName" => "Введите корректный адрес электронной почты.",
            "PasswordTooShort" => "Пароль должен содержать минимум 6 символов.",
            "PasswordRequiresDigit" => "Пароль должен содержать хотя бы одну цифру.",
            "PasswordRequiresLower" => "Пароль должен содержать хотя бы одну строчную букву.",
            "PasswordRequiresUpper" => "Пароль должен содержать хотя бы одну заглавную букву.",
            "PasswordRequiresNonAlphanumeric" => "Пароль должен содержать хотя бы один специальный символ.",
            "PasswordRequiresUniqueChars" => "Пароль должен содержать больше уникальных символов.",
            _ => "Проверьте введённые данные."
        };
    }

    private async Task<ApplicationRole> GetAssignedRoleAsync(ApplicationUser user)
    {
        var roleNames = await _userManager.GetRolesAsync(user);
        var roleName = roleNames.Single();
        var role = await _roleManager.FindByNameAsync(roleName);
        return role ?? throw new InvalidOperationException($"Role '{roleName}' was not found.");
    }
}
