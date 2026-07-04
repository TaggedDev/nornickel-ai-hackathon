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
            "Platform for working with scientific knowledge, hypotheses, and related materials.",
            new[]
            {
                new DashboardMetric("Connected sources", "03", "Knowledge sources ready for indexing."),
                new DashboardMetric("Active pipelines", "05", "Processing and enrichment flows available."),
                new DashboardMetric("Open reviews", "12", "Records waiting for expert validation.")
            },
            new[]
            {
                new DashboardActivity("Ingestion", "ArXiv import completed", "2 minutes ago"),
                new DashboardActivity("Review", "Similarity check queued for 8 papers", "12 minutes ago"),
                new DashboardActivity("Insights", "New relationship graph generated", "28 minutes ago")
            }));
    }

    public sealed record DashboardOverviewResponse(string ProductName, string Tagline,
        IReadOnlyCollection<DashboardMetric> Metrics, IReadOnlyCollection<DashboardActivity> Activities);

    public sealed record DashboardMetric(string Label, string Value, string Description);

    public sealed record DashboardActivity(string Category, string Title, string Timestamp);
}