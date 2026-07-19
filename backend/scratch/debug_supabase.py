import os
import sys
from pathlib import Path

# Add backend to path so we can import from src
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

from src.services.supabase_client import get_supabase_client

def main():
    sb = get_supabase_client()
    if not sb:
        print("Failed to initialize Supabase client")
        return

    # Check agencies
    print("Testing connection...")
    try:
        res = sb.table("agencies").select("id, name").limit(5).execute()
        print("Agencies fetched successfully:", res.data)
    except Exception as e:
        print("Error fetching agencies:", e)

    # Let's check users
    try:
        res = sb.table("users").select("id, agency_id, email").limit(5).execute()
        print("Users fetched successfully:", res.data)
    except Exception as e:
        print("Error fetching users:", e)

    # Let's call the RPC/function or current_setting if we can
    try:
        # We can try executing a select current_agency_id query
        res = sb.postgrest.rpc("current_agency_id").execute()
        print("current_agency_id() result via RPC:", res.data)
    except Exception as e:
        print("Error executing RPC current_agency_id:", e)

if __name__ == "__main__":
    main()
