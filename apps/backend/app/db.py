from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row

from .config import settings


_pool: Any | None = None


def _configure_connection(connection: psycopg.Connection) -> None:
    connection.execute(
        "select set_config('statement_timeout', %s, false)",
        (f"{settings.db_statement_timeout_ms}ms",),
    )
    connection.execute(
        "select set_config('lock_timeout', %s, false)",
        (f"{settings.db_lock_timeout_ms}ms",),
    )
    connection.commit()


def init_pool() -> None:
    """Open one pool per process when explicitly enabled.

    The default remains the direct connection path so deployment can enable a
    pool only after calculating its connection budget.
    """
    global _pool
    if not settings.db_pool_enabled or _pool is not None:
        return

    from psycopg_pool import ConnectionPool

    _pool = ConnectionPool(
        conninfo=settings.database_url.get_secret_value(),
        min_size=settings.db_pool_min_size,
        max_size=settings.db_pool_max_size,
        timeout=settings.db_pool_timeout_seconds,
        max_waiting=settings.db_pool_max_waiting,
        kwargs={
            "row_factory": dict_row,
            "connect_timeout": settings.db_connect_timeout_seconds,
        },
        configure=_configure_connection,
        open=True,
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_connection() -> Iterator[psycopg.Connection]:
    if _pool is not None:
        with _pool.connection() as connection:
            yield connection
        return

    with psycopg.connect(
        settings.database_url.get_secret_value(),
        row_factory=dict_row,
        connect_timeout=settings.db_connect_timeout_seconds,
    ) as connection:
        _configure_connection(connection)
        yield connection
