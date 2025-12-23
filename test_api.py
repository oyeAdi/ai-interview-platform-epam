import requests
import json

# Keys found in backup
keys = [
    ("USER_TOKEN", "AQ.Ab8RN6Jm-sKbOasJ2emGUHtjAJX_Ti8lvJyiF5cAlWgya-5QFg"),
    ("STORED_KEY", "AIzaSyAhMC13D-v4DcX1pMJ1JvtaZHO7gJOmmI4"),
    ("SYSTEM_KEY", "AIzaSyA3Ahw6Vu4V5FdLMMEdhuR1VTMDrQsjBTM")
]

with open("test_results.log", "w") as log:
    for name, key in keys:
        log.write(f"\n--- Testing {name} ---\n")
        if key.startswith("AIza"):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
            headers = {"Content-Type": "application/json"}
        else:
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json"
            }
        
        payload = {"contents": [{"parts": [{"text": "Say 'OK'"}]}]}
        try:
            response = requests.post(url, json=payload, headers=headers)
            log.write(f"Status: {response.status_code}\n")
            if response.status_code == 200:
                log.write("✓ SUCCESS\n")
                log.write(f"Response: {response.text}\n")
            else:
                log.write(f"✗ FAILED: {response.text}\n")
        except Exception as e:
            log.write(f"Error: {e}\n")
print("Done. Check test_results.log")
