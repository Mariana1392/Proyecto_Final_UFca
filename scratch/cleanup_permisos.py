import urllib.request
import json
import urllib.parse

url_base = 'https://bznygqmmjrypemdisjgz.supabase.co/rest/v1'
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bnlncW1tanJ5cGVtZGlzamd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDA0NjIsImV4cCI6MjA5MDIxNjQ2Mn0.oQL9aW_HiuuRxNKSzfJFEXWOzYoBL5iR0FF2mjljbmY',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bnlncW1tanJ5cGVtZGlzamd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY0MDQ2MiwiZXhwIjoyMDkwMjE2NDYyfQ.IstGY9kX9lOj9a3_XonuzfVr37gPN3VM4vOZ4_Eyyko',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

duplicados = {
    'gestion_roles': 'roles',
    'gestion_usuarios': 'usuarios',
    'gestion_asociados': 'asociados',
    'liquidaciones': 'liquidacion'
}

def request(method, path, body=None):
    req = urllib.request.Request(f"{url_base}{path}", method=method, headers=headers)
    if body:
        req.data = json.dumps(body).encode('utf-8')
    try:
        with urllib.request.urlopen(req) as response:
            if response.status in [200, 201, 204]:
                res = response.read()
                return json.loads(res) if res else None
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.read().decode('utf-8')}")
        return None

# 1. Traer todos los rol_permisos para los duplicados
claves_dup = ",".join(duplicados.keys())
rol_permisos = request('GET', f"/rol_permisos?permiso_clave=in.({claves_dup})")

if rol_permisos:
    for rp in rol_permisos:
        original = duplicados[rp['permiso_clave']]
        # Upsert the original key with the same 'activo' state
        body = {
            "rol_id": rp['rol_id'],
            "permiso_clave": original,
            "activo": rp['activo']
        }
        print(f"Migrando {rp['permiso_clave']} -> {original} para rol_id {rp['rol_id']}")
        request('POST', "/rol_permisos", body)

# 2. Borrar de rol_permisos las claves duplicadas
print("Borrando rol_permisos duplicados...")
request('DELETE', f"/rol_permisos?permiso_clave=in.({claves_dup})")

# 3. Borrar de permisos las claves duplicadas
print("Borrando permisos duplicados...")
request('DELETE', f"/permisos?clave=in.({claves_dup})")

print("Listo!")
