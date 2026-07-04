using System.ComponentModel.DataAnnotations;

namespace ScientificTangle.Contracts.Auth;

public sealed class RegisterRequest
{
    [Required] [MaxLength(100)] public string FirstName { get; set; } = string.Empty;

    [Required] [MaxLength(100)] public string LastName { get; set; } = string.Empty;

    [Required] [EmailAddress] public string Email { get; set; } = string.Empty;

    [Required] public string Password { get; set; } = string.Empty;

    [Required] public string ConfirmPassword { get; set; } = string.Empty;

    [Required] public string RoleName { get; set; } = string.Empty;
}