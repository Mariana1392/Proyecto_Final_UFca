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

records_to_restore = [
  {
    "id": "ca4102c5-37f4-4b82-aa3a-b3310b17ad31",
    "clave": "gestion_asociados",
    "label": "Gestión de Asociados",
    "descripcion": "CRUD completo de asociados",
    "grupo": "admin",
    "activo": True
  },
  {
    "id": "2c1810fa-72ff-4a9e-ae6f-f31a5fabe1ed",
    "clave": "gestion_usuarios",
    "label": "Gestión de Usuarios",
    "descripcion": "CRUD completo de usuarios del sistema",
    "grupo": "admin",
    "activo": True
  },
  {
    "id": "d1490c70-88b8-41da-a76b-6ed7c5e30c66",
    "clave": "gestion_roles",
    "label": "Gestión de Roles",
    "descripcion": "Administrar roles y permisos",
    "grupo": "admin",
    "activo": True
  },
  {
    "id": "2fdb1303-9847-4c0d-a415-af7d993f9f82",
    "clave": "liquidaciones",
    "label": "Liquidaciones",
    "descripcion": "Procesar liquidaciones y cierre de período",
    "grupo": "admin",
    "activo": True
  }
]

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

# 1. Insertar permisos restaurados
request('POST', '/permisos', records_to_restore)
print("Permisos duplicados restaurados.")

# 2. Re-migrar rol_permisos de las claves originales a las claves duplicadas
duplicados_map = {
    'roles': 'gestion_roles',
    'usuarios': 'gestion_usuarios',
    'asociados': 'gestion_asociados',
    'liquidacion': 'liquidaciones'
}

claves_orig = ",".join(duplicados_map.keys())
rol_permisos = request('GET', f"/rol_permisos?permiso_clave=in.({claves_orig})")

if rol_permisos:
    for rp in rol_permisos:
        dup = duplicados_map[rp['permiso_clave']]
        body = {
            "rol_id": rp['rol_id'],
            "permiso_clave": dup,
            "activo": rp['activo']
        }
        req_post = urllib.request.Request(f"{url_base}/rol_permisos", method='POST', headers={**headers, 'Prefer': 'resolution=merge-duplicates'})
        req_post.data = json.dumps(body).encode('utf-8')
        try:
            with urllib.request.urlopen(req_post) as response:
                pass
        except urllib.error.HTTPError as e:
            print(f"Error {e.code}: {e.read().decode('utf-8')}")
