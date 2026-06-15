import json

log_path = r"C:\Users\dairi\.gemini\antigravity-ide\brain\2f5ef62f-67ea-4a71-b8e0-c7ddfa2de1ab\.system_generated\logs\transcript.jsonl"
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get('step_index')
            if 935 <= step <= 999:
                print(f"Step {step}: type={data.get('type')} source={data.get('source')} content={str(data.get('content'))[:400]}")
        except Exception as e:
            pass
