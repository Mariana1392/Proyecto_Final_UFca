import psycopg2
import sys

def test():
    password = "BPMmJ35d25D$r*w"
    
    # Combination 1: Direct connection
    try:
        print("Trying direct connection: db.bznygqmmjrypemdisjgz.supabase.co:5432...")
        conn = psycopg2.connect(
            host="db.bznygqmmjrypemdisjgz.supabase.co",
            database="postgres",
            user="postgres",
            password=password,
            port="5432",
            connect_timeout=5
        )
        print("Success!")
        conn.close()
        return "db.bznygqmmjrypemdisjgz.supabase.co"
    except Exception as e:
        print("Direct failed:", e)

    # Combination 2: Direct connection with project ID as user
    try:
        print("Trying direct connection with project user...")
        conn = psycopg2.connect(
            host="db.bznygqmmjrypemdisjgz.supabase.co",
            database="postgres",
            user="postgres.bznygqmmjrypemdisjgz",
            password=password,
            port="5432",
            connect_timeout=5
        )
        print("Success!")
        conn.close()
        return "db.bznygqmmjrypemdisjgz.supabase.co (project user)"
    except Exception as e:
        print("Direct with project user failed:", e)

    # Combination 3: Pooler aws-0-us-east-1.pooler.supabase.com
    try:
        print("Trying pooler aws-0-us-east-1.pooler.supabase.com...")
        conn = psycopg2.connect(
            host="aws-0-us-east-1.pooler.supabase.com",
            database="postgres",
            user="postgres.bznygqmmjrypemdisjgz",
            password=password,
            port="6543",
            connect_timeout=5
        )
        print("Success!")
        conn.close()
        return "aws-0-us-east-1.pooler.supabase.com"
    except Exception as e:
        print("Pooler east failed:", e)

    # Combination 4: Pooler aws-0-us-east-2.pooler.supabase.com
    try:
        print("Trying pooler aws-0-us-east-2.pooler.supabase.com...")
        conn = psycopg2.connect(
            host="aws-0-us-east-2.pooler.supabase.com",
            database="postgres",
            user="postgres.bznygqmmjrypemdisjgz",
            password=password,
            port="6543",
            connect_timeout=5
        )
        print("Success!")
        conn.close()
        return "aws-0-us-east-2.pooler.supabase.com"
    except Exception as e:
        print("Pooler east 2 failed:", e)

    # Combination 5: Host from env? Let's check if we can resolve the direct db host ip
    import socket
    try:
        ip = socket.gethostbyname("db.bznygqmmjrypemdisjgz.supabase.co")
        print(f"Resolved db.bznygqmmjrypemdisjgz.supabase.co to IP: {ip}")
    except Exception as e:
        print("Could not resolve hostname:", e)
        
    return None

if __name__ == "__main__":
    test()
