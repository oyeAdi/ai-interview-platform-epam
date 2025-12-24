import requests
import json

API_URL = "http://localhost:3000/api/interview"
HEADERS = {"Content-Type": "application/json"}

def test_chat_interaction(round_num, message_history, last_msg):
    print(f"\n--- Testing Round {round_num} Interaction ---")
    payload = {
        "type": "chat",
        "selectedJobId": "sde1",
        "round": round_num,
        "currentQuestion": "Previous question context if any",
        "customSkills": ["Java", "System Design"],
        "messages": message_history + [{"role": "user", "text": last_msg}]
    }
    
    try:
        response = requests.post(API_URL, headers=HEADERS, json=payload, timeout=30)
        if response.status_code == 200:
            data = response.json()
            print(f"User: {last_msg}")
            print(f"AI: {data.get('text', 'No text response')}")
            print(f"Note: {data.get('candidateNote', 'No note')}")
            
            # Simple heuristic check
            ai_text = data.get('text', '').lower()
            if round_num == 2 and "code" not in ai_text and "function" not in ai_text:
                 print("⚠️ WARNING: Round 2 (Coding) response might be off-topic (expected coding problem).")
            elif round_num == 1 and ("code" in ai_text or "function" in ai_text):
                 print("⚠️ WARNING: Round 1 (Conceptual) response looks like a coding question.")
                 
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

def main():
    # Scenario 1: Start of Round 1
    history = []
    test_chat_interaction(1, history, "I am ready to start the interview.")

    # Scenario 2: Mid Round 1
    history.append({"role": "user", "text": "I am ready."})
    history.append({"role": "ai", "text": "Great. Let's start with Java. What is the difference between an Interface and an Abstract Class?"})
    test_chat_interaction(1, history, "An interface only has method signatures, but an abstract class can have implementation. Also you can implement multiple interfaces.")
    
    # Scenario 3: Start of Round 2 (Coding)
    # History reset for new round usually, or persisted. Let's try clean slash for round 2 start behavior.
    test_chat_interaction(2, [], "I am ready for the coding round.")

if __name__ == "__main__":
    main()
