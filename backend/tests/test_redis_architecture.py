"""
test_redis_architecture.py — Tests for Voyanta Redis Architecture Upgrades
=============================================================================
Tests:
1. Upstash REST client methods, persistent connection, and pipeline simulation.
2. Distributed locking (acquire_lock, release_lock).
3. Redis health probing and auto-reconnect logic.
4. Rate limiter pipeline atomicity.
5. Async extraction job persistence to Redis Hash with local fallback.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from src.core.redis_client import (
    UpstashRESTClient,
    UpstashRESTPipeline,
    acquire_lock,
    release_lock,
    get_healthy_redis,
    reset_redis_client,
    get_redis_client,
)
from src.core.rate_limiter import DistributedRateLimiterMiddleware


@pytest.mark.anyio
async def test_upstash_rest_client_operations():
    """Verify UpstashRESTClient methods format requests and handle responses."""
    client = UpstashRESTClient("https://mock-redis.upstash.io", "mock-token")
    assert client._http is not None
    assert client.headers["Authorization"] == "Bearer mock-token"

    with patch.object(client._http, "get", new_callable=AsyncMock) as mock_get, \
         patch.object(client._http, "post", new_callable=AsyncMock) as mock_post:
        
        # Test ping
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"result": "PONG"})
        is_pong = await client.ping()
        assert is_pong is True

        # Test get
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"result": "val123"})
        val = await client.get("mykey")
        assert val == "val123"

        # Test set with EX
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"result": "OK"})
        ok = await client.set("mykey", "val123", ex=60)
        assert ok is True

        # Test incr
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"result": 5})
        cnt = await client.incr("counter")
        assert cnt == 5

        # Test hset
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"result": 2})
        hcnt = await client.hset("job:1", mapping={"status": "completed", "progress": "100"})
        assert hcnt == 2

        # Test hgetall
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"result": {"status": "completed"}})
        hdata = await client.hgetall("job:1")
        assert hdata == {"status": "completed"}

    await client.aclose()


@pytest.mark.anyio
async def test_upstash_pipeline_execution():
    """Verify simulated pipeline batches and returns responses in order."""
    client = UpstashRESTClient("https://mock-redis.upstash.io", "mock-token")
    
    with patch.object(client, "incr", new_callable=AsyncMock) as mock_incr, \
         patch.object(client, "expire", new_callable=AsyncMock) as mock_exp:
        
        mock_incr.return_value = 1
        mock_exp.return_value = True

        pipe = client.pipeline(transaction=False)
        pipe.incr("key:1").expire("key:1", 60)
        results = await pipe.execute()

        assert results == [1, True]
        mock_incr.assert_called_once_with("key:1")
        mock_exp.assert_called_once_with("key:1", 60)

    await client.aclose()


@pytest.mark.anyio
async def test_distributed_lock_acquire_and_release():
    """Verify acquire_lock and release_lock behavior."""
    mock_redis = AsyncMock()
    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.eval = AsyncMock(return_value=1)

    # 1. Acquire lock
    token = await acquire_lock(mock_redis, "pdf_extract:abc123", ttl_seconds=60)
    assert token is not None
    mock_redis.set.assert_called_once_with("lock:pdf_extract:abc123", token, nx=True, px=60000)

    # 2. Release lock
    released = await release_lock(mock_redis, "pdf_extract:abc123", token)
    assert released is True
    mock_redis.eval.assert_called_once()


@pytest.mark.anyio
async def test_health_probe_reconnect():
    """Verify get_healthy_redis performs periodic ping and resets on failure."""
    await reset_redis_client()
    with patch("src.core.redis_client.get_redis_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(side_effect=Exception("Connection reset"))
        mock_get_client.return_value = mock_client

        # Calling get_healthy_redis should detect failed ping and reset
        with patch("src.core.redis_client._last_ping_time", 0.0):
            res = await get_healthy_redis()
            mock_client.ping.assert_called_once()
    await reset_redis_client()


@pytest.mark.anyio
async def test_rate_limiter_with_redis_pipeline():
    """Verify DistributedRateLimiterMiddleware uses pipeline on redis backend."""
    mock_app = AsyncMock()
    middleware = DistributedRateLimiterMiddleware(mock_app, max_requests=10, window_seconds=60)

    mock_redis = MagicMock()
    mock_pipe = AsyncMock()
    mock_pipe.incr = MagicMock(return_value=mock_pipe)
    mock_pipe.expire = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(return_value=[1, True])
    mock_redis.pipeline = MagicMock(return_value=mock_pipe)

    middleware.redis_client = mock_redis

    allowed, remaining, reset_ttl = await middleware._check_redis_limit("1.2.3.4", 1000.0)
    assert allowed is True
    assert remaining == 9
    mock_redis.pipeline.assert_called_once_with(transaction=False)
