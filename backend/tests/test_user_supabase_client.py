import pytest
from unittest.mock import MagicMock, patch
from src.services.supabase_client import get_user_supabase_client, scoped_query

def test_get_user_supabase_client_no_token():
    from src.services import supabase_client
    supabase_client._sb_client = None
    with patch("src.services.supabase_client.get_supabase_client", return_value=None):
        with patch.dict("os.environ", {"SUPABASE_URL": "http://mock", "SUPABASE_KEY": "mock-key"}):
            with patch("supabase.create_client") as mock_create_client:
                mock_client = MagicMock()
                mock_create_client.return_value = mock_client
                
                client = get_user_supabase_client()
                
                assert client == mock_client
                mock_create_client.assert_called_once()
                mock_client.postgrest.auth.assert_not_called()

def test_get_user_supabase_client_with_token():
    from src.services import supabase_client
    supabase_client._sb_client = None
    with patch("src.services.supabase_client.get_supabase_client", return_value=None):
        with patch.dict("os.environ", {"SUPABASE_URL": "http://mock", "SUPABASE_KEY": "mock-key"}):
            with patch("supabase.create_client") as mock_create_client:
                mock_client = MagicMock()
                mock_create_client.return_value = mock_client
                
                client = get_user_supabase_client("my-secret-jwt")
                
                assert client == mock_client
                mock_create_client.assert_called_once()
                mock_client.postgrest.auth.assert_called_once_with("my-secret-jwt")

def test_scoped_query_with_agency():
    mock_sb = MagicMock()
    mock_query = MagicMock()
    mock_sb.table.return_value = mock_query
    
    scoped_query(mock_sb, "proposals", "agency-123")
    
    mock_sb.table.assert_called_once_with("proposals")
    mock_query.or_.assert_called_once_with("agency_id.eq.agency-123,agency_id.is.null")

def test_scoped_query_without_agency():
    mock_sb = MagicMock()
    mock_query = MagicMock()
    mock_sb.table.return_value = mock_query
    
    scoped_query(mock_sb, "proposals", None)
    
    mock_sb.table.assert_called_once_with("proposals")
    mock_query.is_.assert_called_once_with("agency_id", "null")
