import os
import logging
import httpx

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "EduWallet")


def _otp_html(code: str, name: str) -> str:
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F9F8;padding:32px 0;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ececec;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#1A4331;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">EduWallet</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <p style="color:#171717;font-size:16px;margin:0 0 8px;">Hi {name},</p>
            <p style="color:#525252;font-size:14px;line-height:22px;margin:0 0 24px;">Use the verification code below to confirm your EduWallet account. This code expires in 10 minutes.</p>
            <div style="background:#F9F9F8;border:1px dashed #1A4331;border-radius:10px;padding:20px;text-align:center;">
              <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#1A4331;">{code}</span>
            </div>
            <p style="color:#a3a3a3;font-size:12px;margin:24px 0 0;">If you did not request this, please ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


async def send_otp_email(recipient: str, code: str, name: str = "there") -> bool:
    if not EMAIL_KEY:
        logger.warning(f"[OTP-FALLBACK] No email key. OTP for {recipient}: {code}")
        return False
    payload = {
        "to": [recipient],
        "subject": "Your EduWallet verification code",
        "html": _otp_html(code, name),
        "from_name": EMAIL_FROM_NAME,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        logger.info(f"OTP email sent to {recipient}")
        return True
    except Exception as e:
        logger.error(f"OTP email failed for {recipient}: {e}. Code: {code}")
        return False
