import os
import base64
import logging
import httpx

logger = logging.getLogger(__name__)

MOMO_BASE = os.environ.get("MOMO_BASE_URL", "").rstrip("/")
MOMO_TARGET = os.environ.get("MOMO_TARGET_ENV", "sandbox")
MOMO_SUB_KEY = os.environ.get("MOMO_SUBSCRIPTION_KEY", "")
MOMO_API_USER = os.environ.get("MOMO_API_USER", "")
MOMO_API_KEY = os.environ.get("MOMO_API_KEY", "")
MOMO_CALLBACK = os.environ.get("MOMO_CALLBACK_URL", "")


def is_live() -> bool:
    """Real MTN MoMo mode is active only when all credentials are configured."""
    return bool(MOMO_SUB_KEY and MOMO_API_USER and MOMO_API_KEY)


async def _access_token() -> str:
    raw = f"{MOMO_API_USER}:{MOMO_API_KEY}".encode()
    auth = base64.b64encode(raw).decode()
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{MOMO_BASE}/collection/token/",
            headers={
                "Authorization": f"Basic {auth}",
                "Ocp-Apim-Subscription-Key": MOMO_SUB_KEY,
            },
        )
    r.raise_for_status()
    return r.json()["access_token"]


async def request_to_pay(reference: str, amount: float, phone: str, note: str) -> bool:
    """Initiate MTN MoMo collection. Returns True if accepted (202)."""
    if not is_live():
        # SIMULATED: no real charge. Accepted immediately.
        logger.info(f"[MOMO-SIM] request_to_pay ref={reference} amount={amount} phone={phone}")
        return True
    token = await _access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Ocp-Apim-Subscription-Key": MOMO_SUB_KEY,
        "X-Reference-Id": reference,
        "X-Target-Environment": MOMO_TARGET,
        "Content-Type": "application/json",
    }
    if MOMO_CALLBACK:
        headers["X-Callback-Url"] = MOMO_CALLBACK
    body = {
        "amount": str(int(amount)),
        "currency": "RWF" if MOMO_TARGET != "sandbox" else "EUR",
        "externalId": reference,
        "payer": {"partyIdType": "MSISDN", "partyId": phone},
        "payerMessage": note,
        "payeeNote": note,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{MOMO_BASE}/collection/v1_0/requesttopay", headers=headers, json=body)
    return r.status_code == 202


async def check_status(reference: str) -> str:
    """Return SUCCESSFUL / FAILED / PENDING."""
    if not is_live():
        return "SUCCESSFUL"
    token = await _access_token()
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{MOMO_BASE}/collection/v1_0/requesttopay/{reference}",
            headers={
                "Authorization": f"Bearer {token}",
                "Ocp-Apim-Subscription-Key": MOMO_SUB_KEY,
                "X-Target-Environment": MOMO_TARGET,
            },
        )
    if r.status_code != 200:
        return "PENDING"
    return r.json().get("status", "PENDING")
