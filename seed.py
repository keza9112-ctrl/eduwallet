import os
import uuid
from datetime import datetime, timezone
import auth_utils as au


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def code(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


async def seed_all(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@eduwallet.rw").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Admin@2026")

    # Admin (idempotent password sync)
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        await db.users.insert_one({
            "name": "System Administrator", "email": admin_email,
            "password_hash": au.hash_password(admin_pw), "role": "admin",
            "is_verified": True, "created_at": now_iso(),
        })
    elif not au.verify_password(admin_pw, admin["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": au.hash_password(admin_pw)}})

    # Only seed demo data once
    if await db.users.count_documents({"email": "parent@demo.rw"}):
        return

    school = await db.schools.find_one({"name": "Green Hills Academy"})
    if not school:
        res = await db.schools.insert_one({"name": "Green Hills Academy", "district": "Gasabo", "code": code("SCH"), "created_at": now_iso()})
        school_id = str(res.inserted_id)
    else:
        school_id = str(school["_id"])
    res2 = await db.schools.insert_one({"name": "FAWE Girls School", "district": "Kicukiro", "code": code("SCH"), "created_at": now_iso()})

    def mk(name, email, role, **extra):
        return {"name": name, "email": email, "password_hash": au.hash_password("Demo@2026"),
                "role": role, "is_verified": True, "created_at": now_iso(), **extra}

    stu_code = code("STU")
    stu2_code = code("STU")
    student = mk("Aline Uwase", "student@demo.rw", "student", student_code=stu_code, school_id=school_id, school_name="Green Hills Academy", phone="250780000001")
    student2 = mk("Kevin Mugisha", "student2@demo.rw", "student", student_code=stu2_code, school_id=school_id, school_name="Green Hills Academy", phone="250780000002")
    parent = mk("Jean Bosco", "parent@demo.rw", "parent", phone="250788000001")
    patron = mk("Grace Mukamana", "patron@demo.rw", "patron", school_id=school_id, school_name="Green Hills Academy", phone="250788000002")

    s_id = str((await db.users.insert_one(student)).inserted_id)
    s2_id = str((await db.users.insert_one(student2)).inserted_id)
    p_id = str((await db.users.insert_one(parent)).inserted_id)
    await db.users.insert_one(patron)

    await db.wallets.insert_one({"student_id": s_id, "balance": 45000.0, "created_at": now_iso()})
    await db.wallets.insert_one({"student_id": s2_id, "balance": 12000.0, "created_at": now_iso()})

    await db.links.insert_one({"parent_id": p_id, "student_id": s_id, "created_at": now_iso()})
    await db.links.insert_one({"parent_id": p_id, "student_id": s2_id, "created_at": now_iso()})

    await db.transactions.insert_one({
        "type": "deposit", "reference": str(uuid.uuid4()), "student_id": s_id, "student_name": "Aline Uwase",
        "parent_id": p_id, "parent_name": "Jean Bosco", "amount": 30000.0, "currency": "RWF",
        "method": "MTN MoMo (Simulated)", "status": "SUCCESSFUL", "created_at": now_iso(),
    })
    await db.transactions.insert_one({
        "type": "deposit", "reference": str(uuid.uuid4()), "student_id": s_id, "student_name": "Aline Uwase",
        "parent_id": p_id, "parent_name": "Jean Bosco", "amount": 15000.0, "currency": "RWF",
        "method": "MTN MoMo (Simulated)", "status": "SUCCESSFUL", "created_at": now_iso(),
    })
