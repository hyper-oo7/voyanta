"""
sqs_messaging_service.py — AWS SQS Event Messaging Service
============================================================
Provides decoupled event publishing and consumption using AWS SQS.
Handles background task dispatching (e.g. PDF extraction initiated/completed,
proposal generated, cache invalidation events) across microservices.
"""

import os
import json
import logging
import asyncio
from typing import Optional, Dict, Any, List, Callable

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False
    boto3 = None


class SQSMessagingService:
    """
    AWS SQS Client for Event Messaging.
    Connects to SQS using standard AWS credentials and SQS_QUEUE_URL / SQS_QUEUE_NAME.
    Supports Standard and FIFO queues.
    """
    def __init__(self, queue_url: Optional[str] = None, region_name: Optional[str] = None):
        self.queue_url = queue_url or os.environ.get("SQS_QUEUE_URL") or os.environ.get("AWS_SQS_QUEUE_URL")
        self.region_name = region_name or os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
        self._client = None
        self._consumer_task: Optional[asyncio.Task] = None
        self._handlers: Dict[str, List[Callable[[Dict[str, Any]], Any]]] = {}

        if HAS_BOTO3 and self.queue_url:
            try:
                self._client = boto3.client("sqs", region_name=self.region_name)
                logger.info(f"[SQSMessaging] Initialized SQS client for queue: {self.queue_url}")
            except Exception as e:
                logger.error(f"[SQSMessaging] Failed to initialize AWS SQS client: {e}")
                self._client = None
        else:
            if not HAS_BOTO3:
                logger.warning("[SQSMessaging] boto3 not installed; event messaging disabled.")
            elif not self.queue_url:
                logger.debug("[SQSMessaging] SQS_QUEUE_URL not configured; running in local/offline mode.")

    def send_event(
        self,
        event_type: str,
        payload: Dict[str, Any],
        delay_seconds: int = 0,
        message_group_id: Optional[str] = None,
        deduplication_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Send an event message to AWS SQS queue.
        Returns the MessageId if successful, or None on failure.
        """
        if not self._client or not self.queue_url:
            logger.debug(f"[SQSMessaging] Offline mode: Event '{event_type}' generated but SQS is not connected.")
            return None

        message_body = json.dumps({
            "event_type": event_type,
            "payload": payload,
            "timestamp": os.environ.get("SOURCE_VERSION", "v2.0.0")
        })

        params = {
            "QueueUrl": self.queue_url,
            "MessageBody": message_body,
            "MessageAttributes": {
                "EventType": {
                    "DataType": "String",
                    "StringValue": event_type
                }
            }
        }

        # Handle FIFO queue requirements
        if self.queue_url.endswith(".fifo"):
            if message_group_id:
                params["MessageGroupId"] = message_group_id
            else:
                params["MessageGroupId"] = event_type
            if deduplication_id:
                params["MessageDeduplicationId"] = deduplication_id
        elif delay_seconds > 0:
            params["DelaySeconds"] = min(delay_seconds, 900)

        try:
            response = self._client.send_message(**params)
            msg_id = response.get("MessageId")
            logger.info(f"[SQSMessaging] Published event '{event_type}' (MessageId: {msg_id})")
            return msg_id
        except Exception as e:
            logger.error(f"[SQSMessaging] Error sending event '{event_type}' to SQS: {e}")
            return None

    async def send_event_async(
        self,
        event_type: str,
        payload: Dict[str, Any],
        delay_seconds: int = 0,
        message_group_id: Optional[str] = None,
        deduplication_id: Optional[str] = None
    ) -> Optional[str]:
        """Async wrapper for send_event using run_in_executor."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.send_event(event_type, payload, delay_seconds, message_group_id, deduplication_id)
        )

    def receive_events(
        self,
        max_messages: int = 10,
        wait_time_seconds: int = 20,
        visibility_timeout: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Long-poll AWS SQS queue for incoming events.
        Returns a list of parsed messages with receipt handles.
        """
        if not self._client or not self.queue_url:
            return []

        try:
            response = self._client.receive_message(
                QueueUrl=self.queue_url,
                MaxNumberOfMessages=min(max_messages, 10),
                WaitTimeSeconds=min(wait_time_seconds, 20),
                VisibilityTimeout=visibility_timeout,
                MessageAttributeNames=["All"]
            )
            messages = response.get("Messages", [])
            results = []
            for msg in messages:
                body_str = msg.get("Body", "{}")
                try:
                    body = json.loads(body_str)
                except Exception:
                    body = {"raw_body": body_str}

                event_type = body.get("event_type")
                if not event_type and "MessageAttributes" in msg:
                    attrs = msg["MessageAttributes"]
                    if "EventType" in attrs:
                        event_type = attrs["EventType"].get("StringValue")

                results.append({
                    "message_id": msg.get("MessageId"),
                    "receipt_handle": msg.get("ReceiptHandle"),
                    "event_type": event_type or "unknown",
                    "payload": body.get("payload", body),
                    "raw_message": msg
                })
            return results
        except Exception as e:
            logger.error(f"[SQSMessaging] Error receiving messages from SQS: {e}")
            return []

    def delete_event(self, receipt_handle: str) -> bool:
        """Delete processed message from SQS queue using receipt handle."""
        if not self._client or not self.queue_url or not receipt_handle:
            return False

        try:
            self._client.delete_message(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle
            )
            logger.debug("[SQSMessaging] Deleted processed message from SQS")
            return True
        except Exception as e:
            logger.error(f"[SQSMessaging] Error deleting message from SQS: {e}")
            return False

    def register_handler(self, event_type: str, handler: Callable[[Dict[str, Any]], Any]):
        """Register a callback handler for a specific event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
        logger.info(f"[SQSMessaging] Registered handler for event type: {event_type}")

    async def start_consumer(self, poll_interval: float = 1.0):
        """Start async background polling loop to consume and dispatch SQS events."""
        if self._consumer_task and not self._consumer_task.done():
            logger.warning("[SQSMessaging] Consumer loop is already running.")
            return

        async def _consumer_loop():
            logger.info("[SQSMessaging] Started background SQS consumer loop.")
            while True:
                try:
                    loop = asyncio.get_running_loop()
                    messages = await loop.run_in_executor(
                        None,
                        lambda: self.receive_events(max_messages=10, wait_time_seconds=10)
                    )
                    for msg in messages:
                        event_type = msg.get("event_type", "unknown")
                        payload = msg.get("payload", {})
                        receipt_handle = msg.get("receipt_handle")

                        handlers = self._handlers.get(event_type, []) + self._handlers.get("*", [])
                        if handlers:
                            for handler in handlers:
                                try:
                                    if asyncio.iscoroutinefunction(handler):
                                        await handler(payload)
                                    else:
                                        handler(payload)
                                except Exception as h_err:
                                    logger.error(f"[SQSMessaging] Handler error for event '{event_type}': {h_err}")
                        else:
                            logger.debug(f"[SQSMessaging] No handlers registered for event '{event_type}'")

                        if receipt_handle:
                            await loop.run_in_executor(None, lambda: self.delete_event(receipt_handle))
                except asyncio.CancelledError:
                    logger.info("[SQSMessaging] Consumer loop cancelled.")
                    break
                except Exception as loop_err:
                    logger.error(f"[SQSMessaging] Error in consumer loop: {loop_err}")
                    await asyncio.sleep(5.0)
                await asyncio.sleep(poll_interval)

        self._consumer_task = asyncio.create_task(_consumer_loop())

    async def stop_consumer(self):
        """Stop background SQS consumer loop."""
        if self._consumer_task and not self._consumer_task.done():
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass
            self._consumer_task = None
            logger.info("[SQSMessaging] Stopped SQS consumer loop.")


# Singleton instance
_sqs_service_instance: Optional[SQSMessagingService] = None

def get_sqs_service() -> SQSMessagingService:
    """Get or initialize the singleton SQSMessagingService."""
    global _sqs_service_instance
    if _sqs_service_instance is None:
        _sqs_service_instance = SQSMessagingService()
    return _sqs_service_instance
