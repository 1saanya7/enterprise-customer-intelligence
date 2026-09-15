import pytest
from intelligence.sql_policy import UnsafeSQL, validate_read_query


def validate(sql):
    return validate_read_query(sql, {"sales"}, {"product_id", "revenue_paise", "tenant_id"})


def test_aggregate_allowed():
    assert "SUM" in validate("SELECT product_id, SUM(revenue_paise) FROM sales GROUP BY product_id")


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM sales",
        "SELECT product_id FROM sales; DROP TABLE sales",
        "SELECT * FROM sales",
        "SELECT salary FROM sales",
        "SELECT product_id FROM employees",
        "SELECT product_id FROM sales UNION ALL SELECT product_id FROM sales",
        "SELECT product_id FROM sales JOIN employees USING (product_id)",
        "SELECT (SELECT salary FROM employees) FROM sales",
        "SELECT remote_function(revenue_paise) FROM sales",
        "EXPORT DATA OPTIONS(uri='gs://leak/*.csv') AS SELECT product_id FROM sales",
        "WITH x AS (SELECT product_id FROM sales) SELECT product_id FROM x",
    ],
)
def test_unsafe_sql_rejected(sql):
    with pytest.raises(UnsafeSQL):
        validate(sql)
