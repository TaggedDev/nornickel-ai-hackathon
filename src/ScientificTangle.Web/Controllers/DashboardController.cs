using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ScientificTangle.Web.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    [HttpGet("overview")]
    public ActionResult<DashboardOverviewResponse> GetOverview()
    {
        return Ok(new DashboardOverviewResponse("Scientific Tangle",
            "Платформа для работы с научными знаниями, гипотезами и связанными материалами.",
            new[]
            {
                new DashboardMetric("Подключённые источники", "03", "Источники знаний готовы к индексации."),
                new DashboardMetric("Активные пайплайны", "05", "Доступны процессы обработки и обогащения."),
                new DashboardMetric("Открытые проверки", "12", "Записи ожидают экспертной валидации.")
            },
            new[]
            {
                new DashboardActivity("Загрузка", "Импорт ArXiv завершён", "2 минуты назад"),
                new DashboardActivity("Проверка", "Проверка сходства для 8 статей добавлена в очередь", "12 минут назад"),
                new DashboardActivity("Инсайты", "Новый граф связей сформирован", "28 минут назад")
            }));
    }

    public sealed record DashboardOverviewResponse(string ProductName, string Tagline,
        IReadOnlyCollection<DashboardMetric> Metrics, IReadOnlyCollection<DashboardActivity> Activities);

    public sealed record DashboardMetric(string Label, string Value, string Description);

    public sealed record DashboardActivity(string Category, string Title, string Timestamp);
}
