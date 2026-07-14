import os
import sys

def lint_routers():
    # Resolve the directory relative to backend
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    router_dir = os.path.join(backend_dir, "src", "api", "routers")

    if not os.path.exists(router_dir):
        print(f"Error: Router directory not found at {router_dir}")
        sys.exit(1)

    violations = []
    
    for root, _, files in os.walk(router_dir):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    
                # The rule is: router files must not invoke get_supabase_client() directly
                # as it returns the admin/service role client which bypasses Row Level Security (RLS).
                # Instead, they should use get_user_supabase_client(token).
                if "get_supabase_client()" in content:
                    violations.append(
                        f"{os.path.relpath(filepath, backend_dir)}: calls get_supabase_client() directly (admin client bypassing RLS)"
                    )
                        
    if violations:
        print("\n=== LINT ERROR: Direct Supabase Admin Client Calls Found ===")
        for v in violations:
            print(f"  - {v}")
        print("\nFix: Use get_user_supabase_client(token) for user-facing API paths so that Row-Level Security is enforced.")
        sys.exit(1)
    else:
        print("SUCCESS: No direct get_supabase_client() calls found in API routers.")
        sys.exit(0)

if __name__ == "__main__":
    lint_routers()
