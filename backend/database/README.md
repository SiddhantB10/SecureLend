# SecureLend Database Structure

This folder centralizes MongoDB collections and schema ownership for clear separation of concerns.

## Model folders

- `models/users/User.js`: end-user and admin login accounts (`users` collection)
- `models/loans/Loan.js`: loan applications and risk decisions (`loans` collection)
- `models/admin/AdminAccount.js`: admin login account and permissions (`admins` collection)
- `models/admin/AdminProfile.js`: optional admin profile metadata (`admin_profiles` collection)
- `models/admin/AdminAuditLog.js`: admin action tracking (`admin_audit_logs` collection)

## Why this structure

- Clear ownership by domain (`users`, `loans`, `admin`)
- Easy indexing and maintenance
- Backward-compatible imports via `backend/models/*.js` re-exports
- Safe startup initialization with index creation in `ensureIndexes.js`

## Connectivity flow

1. `backend/server.js` loads env and calls `connectDatabase()`.
2. `backend/config/db.js` connects Atlas (with DNS fallback handling).
3. After connect, `ensureIndexes()` creates required indexes once.
4. Controllers consume models using unchanged import paths for users/loans and dedicated admin imports for admins.
