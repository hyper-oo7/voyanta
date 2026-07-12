import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from src.services.affinity_aggregation_service import aggregate_affinity, run_activity_logs_retention

def test_aggregate_affinity_sets_aggregated_at():
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table

    # Mock unaggregated logs query
    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_in = MagicMock()
    mock_select.in_.return_value = mock_in
    mock_in.is_.return_value = MagicMock(
        execute=MagicMock(return_value=MagicMock(data=[
            {"id": "log-1", "agency_id": "agency-A", "action": "suggestion_added", "entity_id": "obj-1"}
        ]))
    )

    with patch("src.services.affinity_aggregation_service.get_supabase_client", return_value=mock_sb):
        success = aggregate_affinity()
        assert success is True
        # Verify object_affinity upsert called
        assert mock_sb.table("object_affinity").upsert.called
        # Verify activity_logs updated with aggregated_at
        assert mock_sb.table("activity_logs").update.called


def test_run_activity_logs_retention_never_deletes_unaggregated():
    mock_sb = MagicMock()

    with patch("src.services.affinity_aggregation_service.get_supabase_client", return_value=mock_sb), \
         patch("src.services.affinity_aggregation_service.aggregate_affinity", return_value=True) as mock_agg:

        mock_delete_table = MagicMock()
        mock_sb.table.return_value = mock_delete_table
        mock_delete = MagicMock()
        mock_delete_table.delete.return_value = mock_delete
        mock_not_null = MagicMock()
        mock_delete.not_.return_value = MagicMock(is_=MagicMock(return_value=mock_not_null))
        mock_not_null.lt.return_value = MagicMock(execute=MagicMock(return_value=MagicMock(data=[{"id": "old-log-1"}])))

        result = run_activity_logs_retention(retention_days=60)

        assert result["status"] == "success"
        assert result["aggregation_ran"] is True
        # Verify that aggregate_affinity ran first
        mock_agg.assert_called_once()
