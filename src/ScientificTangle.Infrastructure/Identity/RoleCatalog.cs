namespace ScientificTangle.Infrastructure.Identity;

public static class RoleCatalog
{
    public const string Researcher = "Researcher";
    public const string Analyst = "Analyst";
    public const string ProjectManager = "ProjectManager";
    public const string Administrator = "Administrator";
    public const string ExternalPartner = "ExternalPartner";

    public static readonly IReadOnlyList<(string Name, string DisplayName)> Roles =
    [
        (Researcher, "Исследователь"), (Analyst, "Аналитик"), (ProjectManager, "Руководитель проекта"),
        (Administrator, "Администратор"), (ExternalPartner, "Внешний партнёр")
    ];
}