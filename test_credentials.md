# EduWallet — Test Credentials

All demo accounts share password: **Demo@2026**

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | kezajeanbertrand@gmail.com | Admin@2026 | Full admin dashboard |
| Parent | parent@demo.rw | Demo@2026 | Linked to 2 students |
| Student | student@demo.rw | Demo@2026 | Aline Uwase, balance ~45,000 RWF |
| Student 2 | student2@demo.rw | Demo@2026 | Kevin Mugisha |
| Patron | patron@demo.rw | Demo@2026 | Green Hills Academy cash-out agent |

Demo accounts are pre-verified (no OTP needed at login).
New sign-ups (parent/student) require an email OTP sent via Resend.

## Auth endpoints
- POST /api/auth/register
- POST /api/auth/verify-otp
- POST /api/auth/resend-otp
- POST /api/auth/login
- GET  /api/auth/me  (Bearer token)

Auth uses Bearer JWT tokens (Authorization: Bearer <token>), stored in localStorage on the frontend.
