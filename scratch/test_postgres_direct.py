import psycopg2
import sys

def test_conn():
    # Trying the active project bznygqmmjrypemdisjgz
    # Standard Supabase pooler host: aws-0-us-west-1.pooler.supabase.com
    # Port: 6543
    user = "postgres.bznygqmmjrypemdisjgz"
    password = "BPMmJ35d25D$r*w"
    host = "aws-0-us-west-1.pooler.supabase.com"
    database = "postgres"
    
    print(f"Connecting to {host} as {user}...")
    try:
        conn = psycopg2.connect(host=host, database=database, user=user, password=password, port="6543")
        cur = conn.cursor()
        cur.execute("SELECT version();")
        ver = cur.fetchone()
        print("Connected! Version:", ver)
        
        # Check active tables in public schema
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        print("\nTables in public schema:")
        for r in cur.fetchall():
            print(f"  - {r[0]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print("Error connecting:", e)

if __name__ == "__main__":
    test_conn()
