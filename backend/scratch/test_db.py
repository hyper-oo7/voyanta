import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from backend/.env
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')
sys.path.append(str(ROOT_DIR))

from src.services.supabase_client import get_supabase_client



sb = get_supabase_client()
if not sb:
    print("Failed to initialize Supabase client. Check SUPABASE_URL and SUPABASE_KEY.")
    sys.exit(1)

try:
    print("Attempting to select from public.users table...")
    res = sb.table("users").select("*").limit(5).execute()
    print("Success! Data in public.users:")
    print(json.dumps(res.data, indent=2))
except Exception as e:
    print(f"Error querying public.users: {e}")

try:
    print("\nAttempting to select from public.clients table...")
    res = sb.table("clients").select("*").limit(5).execute()
    print("Success! Data in public.clients:")
    print(json.dumps(res.data, indent=2))
except Exception as e:
    print(f"Error querying public.clients: {e}")

try:
    print("\nAttempting to select from public.proposals table...")
    res = sb.table("proposals").select("*").limit(5).execute()
    print("Success! Data in public.proposals:")
    print(json.dumps(res.data, indent=2))
except Exception as e:
    print(f"Error querying public.proposals: {e}")
