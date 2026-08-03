import asyncio
import json
import httpx

async def main():
    dummy_proposal = {
        "destination": "Guwahati",
        "duration_days": 1,
        "currency": "INR",
        "days": [],
        "hotels": [],
        "inclusions": [],
        "exclusions": [],
        "extra_sections": {}
    }
    
    payload = {
        "proposal": dummy_proposal,
        "user_prompt": "add activity"
    }
    
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            print("Sending request...")
            res = await client.post("http://127.0.0.1:8000/api/refine-itinerary", json=payload)
            print("Status:", res.status_code)
            if res.status_code == 200:
                print("Success:", json.dumps(res.json(), indent=2))
            else:
                print("Error:", res.text)
        except Exception as e:
            print("Exception:", e)

if __name__ == "__main__":
    asyncio.run(main())
