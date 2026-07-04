using System.ComponentModel.DataAnnotations;

namespace ScientificTangle.Contracts.Auth;

public sealed class LoginRequest
{
    [Required(ErrorMessage = "Укажите электронную почту.")]
    [EmailAddress(ErrorMessage = "Введите корректный адрес электронной почты.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Укажите пароль.")]
    public string Password { get; set; } = string.Empty;

    public bool RememberMe { get; set; }
}
