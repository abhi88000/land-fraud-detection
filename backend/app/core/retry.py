"""Tiny retry helper for transient errors (Gemini calls, GCS, etc.)."""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Awaitable, Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def retry_async(
    fn: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    base_delay: float = 1.5,
    max_delay: float = 8.0,
    label: str = "operation",
) -> T:
    """Run ``fn()`` with exponential backoff + jitter on exception.

    Re-raises the last exception if all attempts fail.
    """
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await fn()
        except Exception as exc:  # noqa: BLE001 - retry policy is intentionally broad
            last_exc = exc
            if attempt == attempts:
                logger.error(
                    "%s failed after %d attempts: %s", label, attempts, exc,
                    extra={"label": label, "attempts": attempts},
                )
                raise
            delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
            delay += random.uniform(0, delay * 0.25)  # 25% jitter
            logger.warning(
                "%s attempt %d/%d failed (%s); retrying in %.1fs",
                label, attempt, attempts, exc, delay,
                extra={"label": label, "attempt": attempt, "delay_s": round(delay, 2)},
            )
            await asyncio.sleep(delay)
    # Unreachable; for the type checker.
    raise last_exc  # type: ignore[misc]
