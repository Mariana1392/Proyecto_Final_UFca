import json

log_path = r"C:\Users\dairi\.gemini\antigravity-ide\brain\2f5ef62f-67ea-4a71-b8e0-c7ddfa2de1ab\.system_generated\logs\transcript.jsonl"
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            # Find steps that have subagent tool calls or responses
            if data.get('type') == 'SUBAGENT' or 'browser_subagent' in str(data):
                print(f"Step {data.get('step_index')}: {json.dumps(data)[:300]}...")
            if 'report' in str(data).lower():
                # Print if it's a subagent report
                print(f"Found report in step {data.get('step_index')}: {str(data)[:500]}")
        except Exception as e:
            pass
