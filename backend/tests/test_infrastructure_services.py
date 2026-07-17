"""
test_infrastructure_services.py — Unit Tests for Redis & SQS Messaging Services
"""

import os
import pytest
from src.core.redis_client import get_redis_client, UpstashRESTClient
from src.services.sqs_messaging_service import get_sqs_service, SQSMessagingService


def test_sqs_messaging_service_offline():
    """Verify SQS messaging service handles offline/unconfigured environments gracefully."""
    sqs = SQSMessagingService(queue_url=None)
    msg_id = sqs.send_event("TEST_EVENT", {"foo": "bar"})
    assert msg_id is None
    assert sqs.receive_events() == []
    assert sqs.delete_event("fake_handle") is False


def test_upstash_rest_client_init():
    """Verify UpstashRESTClient initialization and headers."""
    client = UpstashRESTClient("https://fake.upstash.io", "fake_token_123")
    assert client.rest_url == "https://fake.upstash.io"
    assert client.headers["Authorization"] == "Bearer fake_token_123"
