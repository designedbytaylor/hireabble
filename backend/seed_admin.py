"""
Seed script to create the first admin user.

Usage:
    python seed_admin.py --email admin@hireabble.com --password YourSecurePassword --name "Admin"
"""
import asyncio
import argparse
import uuid
from datetime import datetime, timezone
from database import db, hash_password


async def create_admin(email: str, password: str, name: str):
    existing = await db.admin_users.find_one({"email": email})
    if existing:
        print(f"Admin with email {email} already exists.")
        return

    admin_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password": hash_password(password),
        "name": name,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admin_users.insert_one(admin_doc)
    print(f"Admin user created: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create an admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    asyncio.run(create_admin(args.email, args.password, args.name))
