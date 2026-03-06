"""
Emergency admin password reset script.

Usage:
    python reset_admin_password.py --email taylor@hireabble.com --new-password YourNewPassword
"""
import asyncio
import argparse
from database import db, hash_password


async def reset_password(email: str, new_password: str):
    admin = await db.admin_users.find_one({"email": email})
    if not admin:
        print(f"No admin found with email: {email}")
        return
    await db.admin_users.update_one(
        {"email": email},
        {"$set": {"password": hash_password(new_password)}}
    )
    print(f"Password reset for {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset an admin password")
    parser.add_argument("--email", required=True)
    parser.add_argument("--new-password", required=True)
    args = parser.parse_args()
    asyncio.run(reset_password(args.email, args.new_password))
