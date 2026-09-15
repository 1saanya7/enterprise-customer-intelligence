"""Conservative SQL syntax gate. Data authorization remains a separate boundary.

This intentionally supports only a small SQL surface. No arbitrary SQL API is exposed.
"""

from sqlglot import exp, parse
from sqlglot.errors import ParseError


class UnsafeSQL(ValueError):
    pass


def validate_read_query(sql: str, allowed_tables: set[str], allowed_columns: set[str]) -> str:
    try:
        statements = parse(sql, read="bigquery")
    except ParseError as exc:
        raise UnsafeSQL("SQL could not be parsed") from exc
    if len(statements) != 1 or not isinstance(statements[0], exp.Select):
        raise UnsafeSQL("Exactly one SELECT statement is required")
    tree = statements[0]
    if any(tree.find(kind) for kind in (exp.Subquery, exp.Join, exp.CTE, exp.Union)):
        raise UnsafeSQL(
            "Joins, CTEs and nested queries are outside the initial allowed SQL surface"
        )
    tables = list(tree.find_all(exp.Table))
    if len(tables) != 1 or tables[0].sql(dialect="bigquery").replace("`", "") not in allowed_tables:
        raise UnsafeSQL("Table is not authorized")
    if any(col.name not in allowed_columns for col in tree.find_all(exp.Column)):
        raise UnsafeSQL("Column is not authorized")
    for star in tree.find_all(exp.Star):
        if not isinstance(star.parent, exp.Count):
            raise UnsafeSQL("Wildcard projection is forbidden")
    permitted_functions = {"SUM", "COUNT", "AVG", "MIN", "MAX", "ROUND"}
    for func in tree.find_all(exp.Func):
        if func.sql_name() not in permitted_functions:
            raise UnsafeSQL("Function is not allowlisted")
    return tree.sql(dialect="bigquery")
