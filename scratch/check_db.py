import urllib.request
import json

url = "https://bznygqmmjrypemdisjgz.supabase.co/rest/v1/creditos?select=id,referido_nombre,estado,asociado_id"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bnlncW1tanJ5cGVtZGlzamd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDA0NjIsImV4cCI6MjA5MDIxNjQ2Mn0.oQL9aW_HiuuRxNKSzfJFEXWOzYoBL5iR0FF2mjljbmY",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bnlncW1tanJ5cGVtZGlzamd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY0MDQ2MiwiZXhwIjoyMDkwMjE2NDYyfQ.IstGY9kX9lOj9a3_XonuzfVr37gPN3VM4vOZ4_Eyyko"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read()
        data = json.loads(html)
        
        # Para cada crédito, buscar el nombre del asociado
        for c in data:
            asoc_id = c['asociado_id']
            url_asoc = f"https://bznygqmmjrypemdisjgz.supabase.co/rest/v1/usuarios?id=eq.{asoc_id}&select=nombre"
            req_asoc = urllib.request.Request(url_asoc, headers=headers)
            with urllib.request.urlopen(req_asoc) as resp_asoc:
                asoc_data = json.loads(resp_asoc.read())
                c['asociado_nombre'] = asoc_data[0]['nombre'] if asoc_data else 'Desconocido'
                
        print(json.dumps(data, indent=2))
except Exception as e:
    print(e)
