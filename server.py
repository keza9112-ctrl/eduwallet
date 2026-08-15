import os
import uuid
import random
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId

import auth_utils as au
from email_service import send_otp_email
import momo_service as momo

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("eduwallet")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="EduWallet API")
api = APIRouter(prefix="/api")

ROLES = ["parent", "student", "patron", "admin"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_code(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


# ---------------- Models ----------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "parent"
    phone: Optional[str] = None
    school_id: Optional[str] = None


class VerifyOtpIn(BaseModel):
    email: EmailStr
    code: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ResendOtpIn(BaseModel):
    email: EmailStr


class LinkStudentIn(BaseModel):
    student_code: str


class DepositIn(BaseModel):
    student_id: str
    amount: float = Field(gt=0)
    phone: str


class WithdrawIn(BaseModel):
    amount: float = Field(gt=0)
    reason: Optional[str] = ""


class VerifyWithdrawIn(BaseModel):
    code: str
    pin: str


class SchoolIn(BaseModel):
    name: str
    district: Optional[str] = ""
    code: Optional[str] = None


class AdminUserIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str
    phone: Optional[str] = None
    school_id: Optional[str] = None


# ---------------- Helpers ----------------
async def get_current_user(request: Request) -> dict:
    token = au._extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = au.jwt.decode(token, au.get_jwt_secret(), algorithms=[au.JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except au.jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except au.jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


async def audit(actor: dict, action: str, detail: str, meta: dict = None):
    await db.audit_logs.insert_one({
        "actor_id": str(actor["_id"]),
        "actor_name": actor.get("name"),
        "actor_role": actor.get("role"),
        "action": action,
        "detail": detail,
        "meta": meta or {},
        "created_at": now_iso(),
    })


async def notify(user_id: str, title: str, body: str, kind: str = "info"):
    await db.notifications.insert_one({
        "user_id": user_id,
        "title": title,
        "body": body,
        "kind": kind,
        "read": False,
        "created_at": now_iso(),
    })


async def get_wallet(student_id: str) -> dict:
    w = await db.wallets.find_one({"student_id": student_id})
    if not w:
        w = {"student_id": student_id, "balance": 0.0, "created_at": now_iso()}
        res = await db.wallets.insert_one(w)
        w["_id"] = res.inserted_id
    return w


def pub_user(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "name": u.get("name"),
        "email": u.get("email"),
        "role": u.get("role"),
        "phone": u.get("phone"),
        "student_code": u.get("student_code"),
        "school_id": u.get("school_id"),
        "school_name": u.get("school_name"),
        "is_verified": u.get("is_verified", False),
    }


# ---------------- Auth ----------------
async def issue_otp(email: str, name: str):
    code = f"{random.randint(0, 999999):06d}"
    await db.otps.update_one(
        {"email": email},
        {"$set": {"code": code, "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(), "created_at": now_iso()}},
        upsert=True,
    )
    await send_otp_email(email, code, name)
    return code


@api.post("/auth/register")
async def register(data: RegisterIn):
    email = data.email.lower()
    if data.role not in ["parent", "student"]:
        raise HTTPException(status_code=400, detail="Public sign-up is only for parents and students")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    doc = {
        "name": data.name,
        "email": email,
        "password_hash": au.hash_password(data.password),
        "role": data.role,
        "phone": data.phone,
        "school_id": data.school_id,
        "is_verified": False,
        "created_at": now_iso(),
    }
    if data.role == "student":
        doc["student_code"] = gen_code("STU")
    res = await db.users.insert_one(doc)
    if data.role == "student":
        await get_wallet(str(res.inserted_id))
    await issue_otp(email, data.name)
    return {"message": "Account created. Check your email for the verification code.", "email": email}


@api.post("/auth/verify-otp")
async def verify_otp(data: VerifyOtpIn):
    email = data.email.lower()
    rec = await db.otps.find_one({"email": email})
    if not rec or rec["code"] != data.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code expired")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"email": email}, {"$set": {"is_verified": True}})
    await db.otps.delete_one({"email": email})
    user["is_verified"] = True
    token = au.create_access_token(str(user["_id"]), email, user["role"])
    await notify(str(user["_id"]), "Welcome to EduWallet", "Your account is verified and ready to use.", "success")
    return {"token": token, "user": pub_user(user)}


@api.post("/auth/resend-otp")
async def resend_otp(data: ResendOtpIn):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await issue_otp(email, user.get("name", "there"))
    return {"message": "A new verification code has been sent."}


@api.post("/auth/login")
async def login(data: LoginIn):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not au.verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_verified"):
        await issue_otp(email, user.get("name", "there"))
        return {"needs_verification": True, "email": email, "message": "Please verify your email. A new code was sent."}
    token = au.create_access_token(str(user["_id"]), email, user["role"])
    return {"token": token, "user": pub_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return pub_user(user)


# ---------------- Parent ----------------
@api.get("/parent/students")
async def parent_students(user: dict = Depends(require_role("parent"))):
    links = await db.links.find({"parent_id": str(user["_id"])}).to_list(200)
    out = []
    for l in links:
        s = await db.users.find_one({"_id": ObjectId(l["student_id"])})
        if s:
            w = await get_wallet(l["student_id"])
            out.append({**pub_user(s), "balance": w["balance"]})
    return out


@api.post("/parent/link-student")
async def link_student(data: LinkStudentIn, user: dict = Depends(require_role("parent"))):
    student = await db.users.find_one({"student_code": data.student_code.strip().upper(), "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="No student found with that code")
    sid = str(student["_id"])
    if await db.links.find_one({"parent_id": str(user["_id"]), "student_id": sid}):
        raise HTTPException(status_code=400, detail="Student already linked")
    await db.links.insert_one({"parent_id": str(user["_id"]), "student_id": sid, "created_at": now_iso()})
    await audit(user, "LINK_STUDENT", f"Linked student {student['name']} ({data.student_code})")
    await notify(sid, "New guardian linked", f"{user['name']} is now linked to your wallet.", "info")
    return {"message": f"Linked to {student['name']}"}


async def complete_deposit(tx_id: str, reference: str, student_id: str, amount: float, parent_id: str):
    """Poll MoMo status then credit wallet. Simulated mode completes after a short delay."""
    await asyncio.sleep(4)
    status = await momo.check_status(reference)
    if status == "SUCCESSFUL":
        await db.wallets.update_one({"student_id": student_id}, {"$inc": {"balance": amount}}, upsert=True)
        await db.transactions.update_one({"_id": ObjectId(tx_id)}, {"$set": {"status": "SUCCESSFUL", "updated_at": now_iso()}})
        await notify(student_id, "Money received", f"RWF {int(amount):,} was deposited to your wallet.", "success")
        await notify(parent_id, "Deposit successful", f"Your deposit of RWF {int(amount):,} was completed.", "success")
    else:
        await db.transactions.update_one({"_id": ObjectId(tx_id)}, {"$set": {"status": "FAILED", "updated_at": now_iso()}})
        await notify(parent_id, "Deposit failed", "Your mobile money deposit could not be completed.", "error")


@api.post("/deposits")
async def create_deposit(data: DepositIn, user: dict = Depends(require_role("parent"))):
    link = await db.links.find_one({"parent_id": str(user["_id"]), "student_id": data.student_id})
    if not link:
        raise HTTPException(status_code=403, detail="You are not linked to this student")
    student = await db.users.find_one({"_id": ObjectId(data.student_id)})
    reference = str(uuid.uuid4())
    accepted = await momo.request_to_pay(reference, data.amount, data.phone, f"EduWallet deposit for {student['name']}")
    if not accepted:
        raise HTTPException(status_code=502, detail="Mobile money provider rejected the request")
    tx = {
        "type": "deposit",
        "reference": reference,
        "student_id": data.student_id,
        "student_name": student["name"],
        "parent_id": str(user["_id"]),
        "parent_name": user["name"],
        "amount": data.amount,
        "currency": "RWF",
        "phone": data.phone,
        "method": "MTN MoMo" + ("" if momo.is_live() else " (Simulated)"),
        "status": "PENDING",
        "created_at": now_iso(),
    }
    res = await db.transactions.insert_one(tx)
    await audit(user, "DEPOSIT_INIT", f"Initiated RWF {int(data.amount)} deposit for {student['name']}", {"reference": reference})
    asyncio.create_task(complete_deposit(str(res.inserted_id), reference, data.student_id, data.amount, str(user["_id"])))
    return {"reference": reference, "status": "PENDING", "message": "Deposit initiated. Confirm the prompt on your phone."}


@api.get("/deposits/{reference}")
async def deposit_status(reference: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"reference": reference})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"reference": reference, "status": tx["status"], "amount": tx["amount"]}


# ---------------- Student wallet + withdrawals ----------------
@api.get("/wallet/me")
async def wallet_me(user: dict = Depends(require_role("student"))):
    w = await get_wallet(str(user["_id"]))
    return {"balance": w["balance"], "currency": "RWF", "student_code": user.get("student_code")}


@api.post("/withdrawals")
async def create_withdrawal(data: WithdrawIn, user: dict = Depends(require_role("student"))):
    w = await get_wallet(str(user["_id"]))
    if data.amount > w["balance"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    code = gen_code("WD")
    pin = f"{random.randint(0, 999999):06d}"
    doc = {
        "code": code,
        "pin": pin,
        "student_id": str(user["_id"]),
        "student_name": user["name"],
        "student_code": user.get("student_code"),
        "school_id": user.get("school_id"),
        "amount": data.amount,
        "reason": data.reason,
        "status": "PENDING",
        "created_at": now_iso(),
    }
    res = await db.withdrawals.insert_one(doc)
    await audit(user, "WITHDRAW_REQUEST", f"Requested RWF {int(data.amount)} cash-out", {"code": code})
    return {"id": str(res.inserted_id), "code": code, "pin": pin, "amount": data.amount, "status": "PENDING",
            "qr_payload": f"{code}:{pin}"}


@api.get("/withdrawals")
async def list_withdrawals(user: dict = Depends(get_current_user)):
    role = user["role"]
    if role == "student":
        q = {"student_id": str(user["_id"])}
    elif role == "patron":
        q = {"status": "PENDING"}
        if user.get("school_id"):
            q["school_id"] = user["school_id"]
    elif role == "admin":
        q = {}
    else:
        raise HTTPException(status_code=403, detail="Not allowed")
    items = await db.withdrawals.find(q).sort("created_at", -1).to_list(500)
    for it in items:
        it["id"] = str(it.pop("_id"))
        if role != "student":
            it.pop("pin", None)
    return items


@api.post("/withdrawals/verify")
async def verify_withdrawal(data: VerifyWithdrawIn, user: dict = Depends(require_role("patron"))):
    wd = await db.withdrawals.find_one({"code": data.code.strip().upper()})
    if not wd:
        raise HTTPException(status_code=404, detail="Request not found")
    if wd["status"] != "PENDING":
        raise HTTPException(status_code=400, detail=f"Request already {wd['status'].lower()}")
    if wd["pin"] != data.pin.strip():
        raise HTTPException(status_code=400, detail="Incorrect PIN")
    wd["id"] = str(wd.pop("_id"))
    wd.pop("pin", None)
    return {"valid": True, "request": wd}


@api.post("/withdrawals/{wid}/complete")
async def complete_withdrawal(wid: str, user: dict = Depends(require_role("patron"))):
    wd = await db.withdrawals.find_one({"_id": ObjectId(wid)})
    if not wd:
        raise HTTPException(status_code=404, detail="Request not found")
    if wd["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Request already processed")
    w = await get_wallet(wd["student_id"])
    if wd["amount"] > w["balance"]:
        raise HTTPException(status_code=400, detail="Student has insufficient balance")
    await db.wallets.update_one({"student_id": wd["student_id"]}, {"$inc": {"balance": -wd["amount"]}})
    await db.withdrawals.update_one({"_id": ObjectId(wid)}, {"$set": {"status": "COMPLETED", "patron_id": str(user["_id"]), "patron_name": user["name"], "completed_at": now_iso()}})
    await db.transactions.insert_one({
        "type": "withdrawal",
        "reference": wd["code"],
        "student_id": wd["student_id"],
        "student_name": wd["student_name"],
        "patron_id": str(user["_id"]),
        "patron_name": user["name"],
        "amount": wd["amount"],
        "currency": "RWF",
        "method": "Cash (Patron)",
        "status": "SUCCESSFUL",
        "created_at": now_iso(),
    })
    await audit(user, "WITHDRAW_COMPLETE", f"Issued RWF {int(wd['amount'])} cash to {wd['student_name']}", {"code": wd["code"]})
    await notify(wd["student_id"], "Cash issued", f"RWF {int(wd['amount']):,} was cashed out by {user['name']}.", "success")
    return {"message": "Cash-out completed", "amount": wd["amount"]}


# ---------------- Transactions ----------------
@api.get("/transactions")
async def transactions(user: dict = Depends(get_current_user)):
    role = user["role"]
    uid = str(user["_id"])
    if role == "student":
        q = {"student_id": uid}
    elif role == "parent":
        q = {"parent_id": uid}
    elif role == "patron":
        q = {"patron_id": uid}
    else:
        q = {}
    items = await db.transactions.find(q).sort("created_at", -1).to_list(500)
    for it in items:
        it["id"] = str(it.pop("_id"))
        it.pop("phone", None)
    return items


# ---------------- Notifications ----------------
@api.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(100)
    for it in items:
        it["id"] = str(it.pop("_id"))
    return items


@api.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"_id": ObjectId(nid), "user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": str(user["_id"])}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- Admin ----------------
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):
    total_students = await db.users.count_documents({"role": "student"})
    total_parents = await db.users.count_documents({"role": "parent"})
    total_patrons = await db.users.count_documents({"role": "patron"})
    total_schools = await db.schools.count_documents({})
    wallets = await db.wallets.find({}).to_list(2000)
    total_balance = sum(w.get("balance", 0) for w in wallets)
    deposits = await db.transactions.find({"type": "deposit", "status": "SUCCESSFUL"}).to_list(5000)
    withdrawals = await db.transactions.find({"type": "withdrawal"}).to_list(5000)
    total_deposited = sum(t["amount"] for t in deposits)
    total_withdrawn = sum(t["amount"] for t in withdrawals)
    pending_wd = await db.withdrawals.count_documents({"status": "PENDING"})
    # Monthly-ish series (last 6 buckets by created date)
    series = {}
    for t in deposits:
        d = t["created_at"][:10]
        series.setdefault(d, {"date": d, "deposits": 0, "withdrawals": 0})
        series[d]["deposits"] += t["amount"]
    for t in withdrawals:
        d = t["created_at"][:10]
        series.setdefault(d, {"date": d, "deposits": 0, "withdrawals": 0})
        series[d]["withdrawals"] += t["amount"]
    chart = sorted(series.values(), key=lambda x: x["date"])[-7:]
    return {
        "total_students": total_students,
        "total_parents": total_parents,
        "total_patrons": total_patrons,
        "total_schools": total_schools,
        "total_balance": total_balance,
        "total_deposited": total_deposited,
        "total_withdrawn": total_withdrawn,
        "pending_withdrawals": pending_wd,
        "chart": chart,
    }


@api.get("/admin/users")
async def admin_users(role: Optional[str] = Query(None), user: dict = Depends(require_role("admin"))):
    q = {"role": role} if role in ROLES else {}
    items = await db.users.find(q).sort("created_at", -1).to_list(1000)
    out = []
    for u in items:
        pu = pub_user(u)
        if u["role"] == "student":
            w = await get_wallet(str(u["_id"]))
            pu["balance"] = w["balance"]
        out.append(pu)
    return out


@api.post("/admin/users")
async def admin_create_user(data: AdminUserIn, user: dict = Depends(require_role("admin"))):
    email = data.email.lower()
    if data.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    school_name = None
    if data.school_id:
        sc = await db.schools.find_one({"_id": ObjectId(data.school_id)})
        school_name = sc["name"] if sc else None
    doc = {
        "name": data.name, "email": email, "password_hash": au.hash_password(data.password),
        "role": data.role, "phone": data.phone, "school_id": data.school_id, "school_name": school_name,
        "is_verified": True, "created_at": now_iso(),
    }
    if data.role == "student":
        doc["student_code"] = gen_code("STU")
    res = await db.users.insert_one(doc)
    if data.role == "student":
        await get_wallet(str(res.inserted_id))
    await audit(user, "CREATE_USER", f"Created {data.role} {data.name}")
    doc["_id"] = res.inserted_id
    return pub_user(doc)


@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, user: dict = Depends(require_role("admin"))):
    target = await db.users.find_one({"_id": ObjectId(uid)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["role"] == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete an admin")
    await db.users.delete_one({"_id": ObjectId(uid)})
    await audit(user, "DELETE_USER", f"Deleted {target['role']} {target['name']}")
    return {"ok": True}


@api.get("/admin/schools")
async def admin_schools(user: dict = Depends(require_role("admin"))):
    items = await db.schools.find({}).sort("created_at", -1).to_list(500)
    for it in items:
        it["id"] = str(it.pop("_id"))
        it["students"] = await db.users.count_documents({"role": "student", "school_id": it["id"]})
    return items


@api.post("/admin/schools")
async def admin_create_school(data: SchoolIn, user: dict = Depends(require_role("admin"))):
    doc = {"name": data.name, "district": data.district, "code": data.code or gen_code("SCH"), "created_at": now_iso()}
    res = await db.schools.insert_one(doc)
    await audit(user, "CREATE_SCHOOL", f"Created school {data.name}")
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    doc["students"] = 0
    return doc


@api.get("/admin/audit-logs")
async def admin_audit(user: dict = Depends(require_role("admin"))):
    items = await db.audit_logs.find({}).sort("created_at", -1).to_list(500)
    for it in items:
        it["id"] = str(it.pop("_id"))
    return items


@api.get("/schools/public")
async def public_schools():
    items = await db.schools.find({}).sort("name", 1).to_list(500)
    return [{"id": str(s["_id"]), "name": s["name"]} for s in items]


@api.get("/")
async def root():
    return {"message": "EduWallet API", "momo_live": momo.is_live()}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("student_code")
    await db.withdrawals.create_index("code")
    from seed import seed_all
    await seed_all(db)


@app.on_event("shutdown")
async def shutdown():
    client.close()
