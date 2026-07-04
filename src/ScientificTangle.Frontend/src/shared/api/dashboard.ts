export type DashboardMetric = {
  label: string;
  value: string;
  description: string;
};

export type DashboardActivity = {
  category: string;
  title: string;
  timestamp: string;
};

export type DashboardOverview = {
  productName: string;
  tagline: string;
  metrics: DashboardMetric[];
  activities: DashboardActivity[];
};

export async function fetchOverview(): Promise<DashboardOverview> {
  const response = await fetch("/api/dashboard/overview");

  if (!response.ok) {
    throw new Error(`Overview request failed with status ${response.status}`);
  }

  return (await response.json()) as DashboardOverview;
}
