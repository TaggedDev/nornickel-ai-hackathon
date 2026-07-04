import { useEffect, useState } from "react";
import { fetchOverview, type DashboardOverview } from "./shared/api/dashboard";

const emptyOverview: DashboardOverview = {
  productName: "Scientific Tangle",
  tagline: "Frontend is loading.",
  metrics: [],
  activities: [],
};

export default function App() {
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOverview();
  }, []);

  async function loadOverview() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchOverview();
      setOverview(response);
    } catch (requestError) {
      setError("Frontend is up, but the API is unavailable. Start ScientificTangle.Web and retry.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Scientific Tangle</p>
          <h1>Research operations</h1>
          <p className="sidebar-copy">
            A React shell wired to your ASP.NET Core backend. Replace this with product workflows, not a landing page.
          </p>
        </div>

        <nav className="nav">
          <button className="nav-item nav-item-active" type="button">
            Overview
          </button>
          <button className="nav-item" type="button">
            Sources
          </button>
          <button className="nav-item" type="button">
            Pipelines
          </button>
          <button className="nav-item" type="button">
            Reviews
          </button>
        </nav>
      </aside>

      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">Connected to backend</p>
            <h2>{overview.productName}</h2>
            <p className="hero-copy">{overview.tagline}</p>
          </div>

          <button className="refresh-button" type="button" onClick={() => void loadOverview()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh data"}
          </button>
        </section>

        {error ? <section className="status status-error">{error}</section> : null}

        <section className="metrics-grid">
          {overview.metrics.map((metric) => (
            <article className="panel" key={metric.label}>
              <span className="panel-label">{metric.label}</span>
              <strong className="metric-value">{metric.value}</strong>
              <p className="panel-copy">{metric.description}</p>
            </article>
          ))}
        </section>

        <section className="activity-layout">
          <article className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-label">Activity feed</span>
                <h3>Recent backend events</h3>
              </div>
              <span className="status-chip">{isLoading ? "Loading" : "Live"}</span>
            </div>

            <div className="activity-list">
              {overview.activities.map((activity) => (
                <div className="activity-item" key={`${activity.category}-${activity.title}`}>
                  <div>
                    <span className="activity-category">{activity.category}</span>
                    <p className="activity-title">{activity.title}</p>
                  </div>
                  <span className="activity-time">{activity.timestamp}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <span className="panel-label">Next steps</span>
            <h3>What to build next</h3>
            <ul className="next-steps">
              <li>Replace mock overview cards with your real API contracts.</li>
              <li>Add routed pages for search, entity details, and review flows.</li>
              <li>Move fetch logic into feature-level hooks as the app grows.</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}
