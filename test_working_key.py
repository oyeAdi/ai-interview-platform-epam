import requests
import json

api_key = "AIzaSyA3Ahw6Vu4V5FdLMMEdhuR1VTMDrQsjBTM"

def test_key():
    # Use gemini-2.0-flash as discovered in list_models
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": "Say 'OK'"}]}]}
    print(f"Testing key with gemini-2.0-flash...")
    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✓ SUCCESS!")
            print(f"Response: {response.json().get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')}")
        else:
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_key()
