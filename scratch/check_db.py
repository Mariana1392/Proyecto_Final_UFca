import psycopg2
import os

DB_HOST = os.environ.get("SUPABASE_DB_HOST", "aws-0-us-west-1.pooler.supabase.com")
DB_NAME = os.environ.get("SUPABASE_DB_NAME", "postgres")
DB_USER = os.environ.get("SUPABASE_DB_USER", "postgres.qixndhymkzhgndmmniio")
DB_PASS = os.environ.get("SUPABASE_DB_PASSWORD", "BPMmJ35d25D$r*w")

try:
    conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS, port="6543")
    cur = conn.cursor()

    print("--- LATEST LIQUIDATIONS ---")
    cur.execute("""
        SELECT id, tipo, asociado_id, detalle->>'estado' as estado, detalle->>'anulado' as anulado
        FROM liquidaciones
        ORDER BY created_at DESC LIMIT 5
    """)
    for row in cur.fetchall():
        print(row)
        
    print("\n--- SAVINGS ACCOUNTS ---")
    cur.execute("""
        SELECT id, asociado_id, tipo, estado, monto_ahorrado, anulado
        FROM cuentas_ahorro
        LIMIT 5
    """)
    for row in cur.fetchall():
        print(row)

    print("\n--- CREDITS ---")
    cur.execute("""
        SELECT id, asociado_id, estado, saldo, anulado
        FROM creditos
        LIMIT 5
    """)
    for row in cur.fetchall():
        print(row)

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
