namespace ScientificTangle.Contracts.Auth;

public sealed record AuthUserResponse(
    string FirstName,
    string LastName,
    string Email,
    string RoleName,
    string RoleDisplayName);
