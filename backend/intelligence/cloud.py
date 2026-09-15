"""Disabled cloud adapters for a future trusted backend boundary."""

import re

from google.cloud import bigquery

from intelligence.cost_policy import require_cloud_usage
from intelligence.models import Principal
from intelligence.security import require
from intelligence.workflow import quarter_bounds


class BigQuerySales:
    def __init__(self, project: str, dataset: str, location: str):
        require_cloud_usage("BigQuery client creation")
        if not re.fullmatch(r"[a-z][a-z0-9-]{4,61}[a-z0-9]", project):
            raise ValueError("Invalid project ID")
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", dataset):
            raise ValueError("Invalid dataset ID")
        self.client = bigquery.Client(project=project, location=location)
        self.table = f"{project}.{dataset}.sales"

    def compare(self, principal: Principal, as_of: str) -> list[dict]:
        require_cloud_usage("BigQuery query execution")
        require(principal, "sales:read")
        baseline, start, end = quarter_bounds(as_of)
        query = f"""
            SELECT product_id, product,
                SUM(IF(order_date < @start, revenue_paise, 0)) / 100.0 AS previous_revenue,
                SUM(IF(order_date >= @start, revenue_paise, 0)) / 100.0 AS current_revenue
            FROM `{self.table}`
            WHERE tenant_id=@tenant AND order_date>=@baseline AND order_date<@end
            GROUP BY product_id, product ORDER BY product_id
        """
        config = bigquery.QueryJobConfig(
            maximum_bytes_billed=100_000_000,
            query_parameters=[
                bigquery.ScalarQueryParameter("tenant", "STRING", principal.tenant_id),
                bigquery.ScalarQueryParameter("baseline", "DATE", baseline),
                bigquery.ScalarQueryParameter("start", "DATE", start),
                bigquery.ScalarQueryParameter("end", "DATE", end),
            ],
            labels={"application": "customer-intelligence"},
        )
        job = self.client.query(query, job_config=config)
        try:
            return [dict(row) for row in job.result(timeout=30, max_results=1000)]
        except TimeoutError:
            job.cancel()
            raise
