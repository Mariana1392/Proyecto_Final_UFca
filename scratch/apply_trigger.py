import psycopg2
import sys

def apply_trigger():
    user = "postgres.bznygqmmjrypemdisjgz"
    password = "BPMmJ35d25D$r*w"
    host = "aws-0-us-west-1.pooler.supabase.com"
    database = "postgres"
    port = "6543"

    print("Connecting to the database to apply the trigger fix...")
    try:
        conn = psycopg2.connect(host=host, database=database, user=user, password=password, port=port)
        conn.autocommit = True
        cur = conn.cursor()

        # Read the SQL file
        with open("PostgrelSQL/supabase_fix_usuarios_cedula_trigger.sql", "r", encoding="utf-8") as f:
            sql_content = f.read()

        print("Executing SQL script...")
        cur.execute(sql_content)
        print("SQL script applied successfully!")

        # Verify the trigger function is updated
        cur.execute("SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';")
        row = cur.fetchone()
        if row:
            print("Successfully verified trigger function in database.")
            # Print a snippet of the function body to make sure it includes the cedula copy
            body = row[0]
            if "v_solicitud.cedula" in body:
                print("Verification confirmed: the new trigger function handles cedula, telefono, and direccion sync.")
            else:
                print("Warning: trigger function does not contain expected cedula sync code.")
        else:
            print("Error: Could not find function handle_new_user in database.")

        cur.close()
        conn.close()
    except Exception as e:
        print("Error applying trigger:", e)
        sys.exit(1)

if __name__ == "__main__":
    apply_trigger()
