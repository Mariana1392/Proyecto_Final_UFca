import json
from collections import Counter

def summarize():
    with open("scratch/hu_criterios_propagated.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print(f"Total Criterios de Aceptación (CAs): {len(data)}")
    
    # Processes
    processes = Counter()
    subprocesses = Counter()
    hus = set()
    states = Counter()
    
    hu_to_process = {}
    
    for item in data:
        proc = item.get("proceso")
        subp = item.get("subproceso")
        hu = item.get("codigo_hu")
        state = item.get("estado_ca")
        
        processes[proc] += 1
        subprocesses[f"{proc} -> {subp}"] += 1
        if hu:
            hus.add(hu)
            hu_to_process[hu] = proc
        states[state] += 1
        
    print(f"\nUnique Processes:")
    for p, c in processes.items():
        print(f"  - {p}: {c} CAs")
        
    print(f"\nUnique Subprocesses:")
    for s, c in subprocesses.items():
        print(f"  - {s}: {c} CAs")
        
    print(f"\nTotal User Stories (HUs): {len(hus)}")
    print(f"States breakdown:")
    for st, count in states.items():
        print(f"  - {st}: {count}")

if __name__ == "__main__":
    summarize()
