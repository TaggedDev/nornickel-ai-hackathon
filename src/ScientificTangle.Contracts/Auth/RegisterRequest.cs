using System.ComponentModel.DataAnnotations;

namespace ScientificTangle.Contracts.Auth;

public sealed class RegisterRequest
{
    [Required(ErrorMessage = "Укажите имя.")]
    [MaxLength(100, ErrorMessage = "Имя не должно быть длиннее 100 символов.")]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Укажите фамилию.")]
    [MaxLength(100, ErrorMessage = "Фамилия не должна быть длиннее 100 символов.")]
    public string LastName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Укажите электронную почту.")]
    [EmailAddress(ErrorMessage = "Введите корректный адрес электронной почты.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Укажите пароль.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Подтвердите пароль.")]
    public string ConfirmPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Выберите роль.")]
    public string RoleName { get; set; } = string.Empty;
}
