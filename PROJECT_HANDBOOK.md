# SecureLend Project Handbook

This document is the single technical reference for the SecureLend repository. It explains what the project does, how its services communicate, what each important file contains, how loan decisions are calculated, how to run it on Windows, and how to deploy it.

## 1. Project Summary

SecureLend is an India-focused, full-stack digital lending and loan-risk platform. A borrower can create an account, submit a personal or property loan application in INR, receive an AI-assisted risk assessment, and track the result. An administrator can inspect all applications, review medium-risk applications, approve or reject them, and see portfolio analytics.

The platform combines:

- React 19 and Vite for the browser application.
- Node.js, Express, and Mongoose for the backend API.
- FastAPI, pandas, NumPy, scikit-learn, and joblib for risk prediction.
- MongoDB Atlas for persistent data.
- Hedera testnet smart-contract writes for approved and rejected decisions.
- Vercel for the frontend and Render for the backend and ML services.

The main decision path is:

```text
Browser -> Express API -> formula score + ML API -> final risk decision
                                      |
                                      +-> MongoDB loan record
                                      +-> Hedera record when status is not review
```

## 2. Repository Layout

```text
SecureLend/
|-- backend/                 Express API and MongoDB data layer
|-- blockchain/              Solidity contract, compiler, and Hedera deploy scripts
|-- frontend/                React/Vite browser application
|-- ml-service/              FastAPI prediction service and model training code
|-- README.md                Short deployment overview
|-- DEPLOYMENT_GUIDE.md      Beginner deployment walkthrough
|-- HEDERA_SETUP.md          Hedera setup notes
|-- HEDERA_CREDENTIALS_FIX.md Credential troubleshooting
|-- render.yaml              Render services blueprint
|-- package-lock.json        Root lockfile, if root tooling is used
|-- .gitignore               Ignore rules for secrets and generated files
```

Ignored/generated directories include `node_modules`, `.env`, `.env.*` except `.env.example`, frontend build output, Python virtual environments, Python caches, model pickle files, blockchain cache, and blockchain artifacts. The deployment scripts generate the blockchain artifact required for deployment, so compile it locally before deploying.

## 3. Services, Ports, and URLs

### Local development

| Service | Directory | Technology | Local command | Default URL/port |
|---|---|---|---|---|
| Frontend | `frontend` | React + Vite | `npm.cmd run dev` | `http://127.0.0.1:5173` |
| Backend | `backend` | Node + Express | `npm.cmd run dev` | `http://127.0.0.1:5000` |
| ML API | `ml-service` | FastAPI + Uvicorn | `python -m uvicorn app:app --reload --port 8001` | `http://127.0.0.1:8001` |
| MongoDB | external/local fallback | MongoDB Atlas or MongoMemoryServer | configured by backend | no HTTP URL |

The backend ML client explicitly tries `http://127.0.0.1:8001` first in non-production development. Some older README commands use port `8000`; either set `ML_SERVICE_URL` to the port you use or start the ML service on `8001` so the default backend behavior works.

The backend prefers port `5000`. If it is busy, `server.js` automatically tries port `5001`. The frontend development server binds to `127.0.0.1` and normally uses port `5173`.

### Production topology

```text
Vercel frontend -> Render Node backend -> Render FastAPI ML service
                                  |
                                  +-> MongoDB Atlas
                                  +-> Hedera testnet
```

## 4. Exact Windows Local Run Instructions

Use separate PowerShell terminals. Because PowerShell execution policy may block `npm.ps1`, use `npm.cmd` on Windows.

### 4.1 Install backend dependencies

```powershell
cd "C:\Users\siddh\Desktop\SecureLend\backend"
npm.cmd install
Copy-Item .env.example .env
```

Edit `backend/.env` before using database-backed features. At minimum, set `MONGODB_URI` and a real `JWT_SECRET`. For local development, use:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/securelend?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
ML_SERVICE_URL=http://127.0.0.1:8001
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

Hedera variables may be left as placeholders. When they are incomplete, blockchain logging is disabled and loan creation continues.

Start the backend:

```powershell
npm.cmd run dev
```

Or run without nodemon:

```powershell
npm.cmd start
```

Check it at `http://127.0.0.1:5000/health`.

### 4.2 Install and start the ML API

```powershell
cd "C:\Users\siddh\Desktop\SecureLend\ml-service"
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8001
```

If the virtual environment does not exist:

```powershell
cd "C:\Users\siddh\Desktop\SecureLend\ml-service"
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8001
```

Check `http://127.0.0.1:8001/health`. The first prediction loads the committed model files if present; otherwise the application trains and saves models into `ml-service/models/`.

### 4.3 Install and start the frontend

```powershell
cd "C:\Users\siddh\Desktop\SecureLend\frontend"
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

For local development, `frontend/.env` should contain:

```env
VITE_API_URL=http://127.0.0.1:5000
```

Open the Vite URL shown in the terminal, normally `http://127.0.0.1:5173`.

### 4.4 Build and preview the frontend

```powershell
cd "C:\Users\siddh\Desktop\SecureLend\frontend"
npm.cmd run build
npm.cmd run preview
```

## 5. Environment Variables

### Backend: `backend/.env`

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port; defaults to `5000`. |
| `NODE_ENV` | Use `development` locally and `production` on Render. Development adds local CORS origins. |
| `MONGODB_URI` | Primary MongoDB connection string. The database path is forced to `securelend`. |
| `MONGODB_URI_FALLBACK` | Optional standard `mongodb://` URI if SRV DNS resolution fails. |
| `MONGODB_DNS_SERVERS` | Optional comma-separated DNS resolvers, default `8.8.8.8,1.1.1.1`. |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | Mongo server selection timeout, default `15000`. |
| `MONGODB_CONNECT_TIMEOUT_MS` | Mongo connection timeout, default `15000`. |
| `MONGODB_SOCKET_TIMEOUT_MS` | Mongo socket timeout, default `45000`. |
| `DISABLE_DB_FALLBACK` | Set `true` for admin seed/migration so no ephemeral database is used. |
| `JWT_SECRET` | Secret used to sign and verify bearer tokens. |
| `JWT_EXPIRES_IN` | JWT lifetime, default `7d`. |
| `ML_SERVICE_URL` | Production ML base URL; locally the client tries port `8001` first. |
| `ML_SERVICE_TIMEOUT_MS` | ML request timeout, default `3500`. |
| `CORS_ORIGINS` | Comma-separated allowed browser origins. |
| `FRONTEND_URL` | Fallback origin variable if `CORS_ORIGINS` is empty. |
| `HEDERA_NETWORK` | `testnet` by default; deploy script also supports `mainnet`. |
| `HEDERA_ACCOUNT_ID` | Hedera operator account. |
| `HEDERA_PRIVATE_KEY` | Hedera operator private key. Never commit it. |
| `HEDERA_CONTRACT_ID` | Deployed `LoanRegistry` contract ID. |
| `ADMIN_NAME` | Seed/setup admin name. |
| `ADMIN_EMAIL` | Seed/setup admin email. |
| `ADMIN_PASSWORD` | Seed/setup admin password. |
| `ADMIN_PHONE` | Seed/setup admin phone. |
| `ADMIN_SETUP_SECRET` | Optional secret for the HTTP admin setup endpoint. |

### ML API: `ml-service/.env`

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Comma-separated allowed origins. If empty, the current implementation uses `*`. |

### Frontend: `frontend/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Express API base URL. Local fallback is `http://127.0.0.1:5000`; deployed fallback is the configured Render URL in `src/api/client.js`. |

### Blockchain: `blockchain/.env`

```env
HEDERA_ACCOUNT_ID=0.0.<account-id>
HEDERA_PRIVATE_KEY=<matching-private-key>
HEDERA_NETWORK=testnet
HEDERA_CONTRACT_ID=
```

The account ID and private key must be a matching pair from the same Hedera testnet account.

## 6. Backend API

The Express application is assembled in `backend/app.js`. It enables CORS, trusts one proxy, applies Helmet security headers, parses JSON up to 2 MB, logs requests with Morgan, exposes health routes, then mounts auth, loan, and admin routes.

### Public endpoints

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/` | Returns backend running message and health path. |
| `GET` | `/health` | Returns `{ status: "ok", service: "securelend-backend" }`. |
| `POST` | `/signup` | Validates and creates a borrower account, hashes the password, and returns a JWT and sanitized user. |
| `POST` | `/login` | Authenticates an admin or borrower and returns a JWT and sanitized user. |
| `POST` | `/admin/setup` | Creates/updates admin only when `ADMIN_SETUP_SECRET` is configured and supplied in `x-admin-setup-secret`. |

### Authenticated endpoints

| Method | Path | Access | Behavior |
|---|---|---|---|
| `POST` | `/apply-loan` | Any authenticated user | Validates, scores, stores, and returns a loan application. |
| `GET` | `/my-loans` | Any authenticated user | Returns that user’s loans newest first. |
| `GET` | `/loan/:id` | Any authenticated user | Returns one loan populated with applicant identity fields. |
| `GET` | `/all-loans` | Admin only | Returns all loans populated with applicant name/email/role. |
| `PUT` | `/loan/:id/status` | Admin only | Changes a `review` loan to `approved` or `rejected`. |

All protected requests must include:

```http
Authorization: Bearer <jwt>
```

Validation failures return HTTP `400` with `message: "Validation failed"` and an `errors` array. Missing or invalid tokens return `401`. Non-admin access to admin routes returns `403`.

### Signup validation

- `name`: at least 2 characters.
- `email`: valid email.
- `password`: at least 8 characters.
- `phone`: Indian 10-digit number, optionally prefixed with `+91` and optional dash/space.

### Loan validation

- `loanType`: `personal` or `property`.
- `income`: greater than 0, INR.
- `creditScore`: integer from 300 to 900.
- `loanAmount`: greater than 0, INR.
- `existingDebt`: 0 or greater, INR.
- Personal loans require `employmentStatus`: `stable`, `moderate`, or `unstable`.
- Property loans require `propertyValue` greater than 0, INR.

## 7. Authentication and Authorization

`backend/middleware/auth.js` reads the `Bearer` token, verifies it with `JWT_SECRET`, and places the decoded payload on `req.user`. The token contains the account ID, email, role, and name. `backend/middleware/admin.js` allows only `req.user.role === 'admin'`.

Passwords are hashed with `bcryptjs` using 12 salt rounds. Login checks the dedicated `admins` collection first; if no admin exists with that email, it checks `users`. Responses never return the stored password.

The frontend `AuthContext` stores the current user and token in local storage keys `securelend:user` and `securelend:token`. Axios attaches the token to every API request. `ProtectedRoute` redirects unauthenticated users to `/login` and sends users without admin role back to `/dashboard` when they open `/admin`.

## 8. Loan Decision Pipeline

When `/apply-loan` receives a valid request:

1. The backend normalizes numeric fields and chooses `employmentStatus` over the legacy `employment` field.
2. `riskScoringService.computeFormulaScore` calculates a policy score.
3. The backend calls the ML service `/predict`.
4. If ML is available, final score is `0.6 * mlScore + 0.4 * formulaScore`.
5. If ML fails or times out, the formula score is used alone and an ML warning is returned.
6. Scores are clamped to the range 0 to 1.
7. Category thresholds are:
   - below `0.30`: `Low`
   - `0.30` through `0.70`: `Medium`
   - above `0.70`: `High`
8. Decision thresholds are the same:
   - Low: automatically `approved`
   - Medium: `review`, requiring admin action
   - High: automatically `rejected`
9. A loan is saved with both component scores, final score, category, explanation, decision source `ai`, and model name.
10. Approved/rejected decisions are sent to Hedera when blockchain configuration is valid. Review loans wait for admin action.

An unavailable blockchain must not block loan creation. When an admin later approves or rejects a review loan, the backend attempts to record that decision on Hedera.

## 9. Database and Models

MongoDB uses database name `securelend`. `backend/config/db.js` connects to Atlas, retries with a configured fallback URI or a generated non-SRV URI after SRV DNS errors, and otherwise starts a local `MongoMemoryServer` unless `DISABLE_DB_FALLBACK=true`.

After a successful persistent connection, `database/ensureIndexes.js` creates model indexes once.

### Collections

| Collection | Model | Important fields |
|---|---|---|
| `users` | `database/models/users/User.js` | `name`, unique lowercase `email`, hashed `password`, `phone`, role `user` or `admin`, timestamps. |
| `admins` | `database/models/admin/AdminAccount.js` | Name, unique email, password, phone, role `admin`, designation, active flag, permissions, timestamps. |
| `admin_profiles` | `AdminProfile.js` | User reference, designation, active flag, permissions, timestamps. |
| `admin_audit_logs` | `AdminAuditLog.js` | Admin user ID, action, entity type/id, notes, metadata, timestamps. |
| `loans` | `database/models/loans/Loan.js` | Applicant, financial inputs, risk outputs, status, decision source, blockchain fields, timestamps. |

The `Loan` model contains:

```text
userId, income, creditScore, loanAmount, loanType,
existingDebt, propertyValue, employment, employmentStatus,
personalInfo, financialInfo, employmentInfo, loanDetails,
riskScore, mlRiskScore, formulaRiskScore, riskCategory,
explanation, status, decisionSource, aiModel,
blockchainRecorded, blockchainTxHash, adminNotes,
createdAt, updatedAt
```

Loan status values are `pending`, `review`, `approved`, and `rejected`. Decision sources are `ai` and `admin`. Risk categories are `Low`, `Medium`, and `High`.

Admin seeding uses `backend/scripts/seedAdmin.js`, hashes the configured password, upserts `admins`, and removes any same-email record from `users`. `migrateAdminToAdmins.js` performs the same migration purpose for an existing deployment. Both disable the in-memory fallback before connecting.

## 10. ML Service

`ml-service/app.py` creates a FastAPI application titled `SecureLend ML Service`. It exposes `/`, `/health`, and `/predict`. The prediction request accepts:

```text
loanType, income, creditScore, loanAmount, existingDebt,
propertyValue, employmentStatus, formulaScore
```

Extra fields are ignored. The response includes:

```text
loanType, mlScore, explanation, featureImportance,
baselineRiskScore, model, riskScore
```

### Feature engineering

`model_utils.py` normalizes loan type and employment status, then derives:

- `debtToIncomeRatio = existingDebt / income`
- `creditRiskFactor = 1 - creditScore / 900`
- `loanToIncomeRatio = loanAmount / income`
- `loanToValueRatio = loanAmount / propertyValue` for property loans
- `employmentRiskFactor`: stable `0.2`, moderate `0.5`, unstable `0.8`
- `formulaScore`

Personal formula score:

```text
0.35 * debtToIncomeRatio
+ 0.30 * loanToIncomeRatio
+ 0.20 * creditRiskFactor
+ 0.15 * employmentRiskFactor
```

Property formula score:

```text
0.40 * loanToValueRatio
+ 0.30 * debtToIncomeRatio
+ 0.20 * creditRiskFactor
+ 0.10 * creditRiskFactor
```

The formula score is clamped to 0 through 1. Explanations flag low credit score, high loan-to-income ratio, high debt-to-income ratio, high property loan-to-value ratio, and unstable employment, then list the strongest model features.

### Models and training

`training/train_model.py` generates 1,500 deterministic synthetic, India-centric examples using NumPy seed 42. Income ranges approximately from INR 180,000 to INR 4,000,000; loan amounts range from INR 50,000 up to INR 3,000,000 subject to income; loan types are sampled as 58% personal and 42% property.

It trains two scikit-learn pipelines:

- Random forest: 240 estimators, max depth 12, balanced class weights, random state 42.
- Logistic regression: maximum 2,000 iterations and balanced class weights.

Both use `StandardScaler` for numeric columns and `OneHotEncoder(handle_unknown='ignore')` for categorical columns. The random forest supplies the main `mlScore`; logistic regression supplies `baselineRiskScore`.

Install requirements from `ml-service/requirements.txt`: FastAPI, Uvicorn, NumPy, pandas, scikit-learn, joblib, Pydantic, python-dotenv, and anyio.

## 11. Frontend Application

The React entry point is `frontend/src/main.jsx`. It wraps the app in `StrictMode`, `BrowserRouter`, and `AuthProvider`. Routes are lazy loaded in `App.jsx`:

| Route | Page | Access |
|---|---|---|
| `/` | Landing page | Public |
| `/login` | Login page | Public |
| `/signup` | Signup page | Public |
| `/dashboard` | User dashboard | Authenticated |
| `/apply` | Loan application form | Authenticated |
| `/result` | Risk and decision result | Authenticated |
| `/admin` | Admin dashboard | Authenticated admin |

### Page behavior

- `LandingPage`: explains the workflow and directs visitors to signup/login or application.
- `LoginPage`: submits email/password and routes admins to `/admin`, borrowers to `/dashboard`.
- `SignupPage`: collects name, email, password, and Indian phone number, then creates a session.
- `UserDashboard`: loads `/my-loans`, shows totals for all, review, and approved applications, and links to new applications.
- `LoanApplicationPage`: collects loan type, personal information, financial information, employment information, loan amount, purpose, and tenure. It validates locally, submits `/apply-loan`, stores the last result in local storage, and routes to `/result`.
- `ResultPage`: shows final risk meter, category, explanation, feature importance, ML score, formula score, stored details, decision source, model, and blockchain transaction ID.
- `AdminDashboard`: loads `/all-loans`, shows total/review/approved/rejected counts, risk distribution, monthly application volume, and approve/reject controls.

### Shared components

- `AppShell`: authenticated navigation, role-aware links, logout, page header, and motion wrapper.
- `AuthForm`: shared login/signup form presentation.
- `FormField`: label, hint, and validation error wrapper.
- `LenderDatePicker`: date input wrapper.
- `LenderSelect`: animated custom select with outside-click and Escape handling.
- `ProtectedRoute`: authentication and role gate.
- `RiskMeter`: percentage meter with Low/Medium/High colors.
- `SectionHeading`: repeated page section heading.
- `StatCard`: dashboard metric card.
- `StatusBadge`: pending, review, approved, and rejected status display.
- `formatters.js`: Indian locale INR formatting and month labels.

The API client uses Axios with a 20-second timeout. On localhost it uses `VITE_API_URL`, unless that value points to an `onrender.com` URL, in which case it switches to local backend `http://127.0.0.1:5000`. The default deployed fallback is `https://securelend-1.onrender.com`.

Styling uses Tailwind CSS 4, a Space Grotesk font, a light white/gray interface, blue primary accents, responsive layouts, Framer Motion animations, Lucide icons, and Recharts analytics.

## 12. Blockchain Integration

The Solidity contract is `blockchain/contracts/LoanRegistry.sol`:

- Solidity version `^0.8.24`.
- `LoanRecord` stores `loanId`, `loanType`, integer-scaled `riskScore`, `decision`, and timestamp.
- `storeLoan(...)` writes/replaces a record and emits `LoanStored`.
- `getLoan(loanId)` returns the record and reverts when it does not exist.

`blockchain/scripts/compile.js` compiles with `solc` and writes bytecode to `artifacts/contracts/LoanRegistry.sol/LoanRegistry.json`. `deploy.js` uploads bytecode to Hedera File Service, creates the contract, prints the contract ID, and updates `blockchain/.env` plus `backend/.env` when present.

`backend/services/blockchainService.js` uses `@hashgraph/sdk` and:

- Uses testnet unless configured otherwise.
- Accepts ED25519 or ECDSA private keys, with or without `0x`.
- Converts Mongo ObjectIds to uint256 values.
- Hashes non-hex IDs into deterministic 128-bit values.
- Scales risk scores by 1,000 before contract storage.
- Calls `storeLoan` with loan ID, type, scaled score, and decision.
- Queries `getLoan` and divides stored score by 1,000 on read.

Check credentials:

```powershell
cd "C:\Users\siddh\Desktop\SecureLend\blockchain"
npm.cmd install
npm.cmd run check-key
```

Compile and deploy:

```powershell
npm.cmd run compile
npm.cmd run deploy
```

Deployment requires a funded Hedera testnet account and a matching private key. Never commit either credential.

## 13. Deployment

### Recommended order

1. Create MongoDB Atlas and database credentials.
2. Configure Hedera credentials and deploy the contract.
3. Deploy `ml-service` to Render.
4. Deploy `backend` to Render.
5. Seed the admin account.
6. Deploy `frontend` to Vercel.
7. Run the smoke test.

### Render ML service

- Root directory: `ml-service`
- Runtime: Python
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Health path: `/health`
- Environment: `PYTHON_VERSION=3.11.9`, `CORS_ORIGINS=<backend-url>`

### Render backend service

- Root directory: `backend`
- Runtime: Node
- Build: `npm ci`
- Start: `npm start`
- Health path: `/health`
- Configure all backend variables from Section 5.

### Vercel frontend

- Root directory: `frontend`
- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Environment: `VITE_API_URL=<backend-url>`
- `frontend/vercel.json` rewrites all paths to `index.html` for SPA routing.

The root `render.yaml` defines both Render web services with the same root directories, build commands, start commands, health paths, and environment variable names.

### Seed admin

After the backend has access to the real MongoDB:

```powershell
cd "C:\Users\siddh\Desktop\SecureLend\backend"
npm.cmd install
npm.cmd run seed:admin
```

The command requires `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_PHONE`. It will not use the in-memory fallback.

## 14. Smoke Test

1. `GET` backend `/health` and ML `/health`.
2. Open the frontend.
3. Create a borrower account with a valid Indian phone number.
4. Log in.
5. Submit a personal loan with valid income, credit score, loan amount, debt, and employment status.
6. Confirm the result page shows ML score, formula score, final category, decision, and explanation.
7. Confirm the application appears on the user dashboard.
8. Log in with the seeded admin account.
9. Confirm the admin dashboard loads all applications and charts.
10. For a review loan, approve or reject it and confirm the status changes.
11. When Hedera is configured, verify a transaction ID is stored.

## 15. Troubleshooting

### PowerShell says `npm.ps1` cannot run

Use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

### `ModuleNotFoundError: No module named 'joblib'`

The command used a different Python interpreter. Use the virtual environment executable directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8001
```

### Backend cannot reach ML

Check that ML is running on port `8001`, that backend `ML_SERVICE_URL` is correct, and that `GET /health` works. The backend uses a 3.5-second default prediction timeout and falls back to formula scoring when ML fails.

### MongoDB connection fails

Check the Atlas username/password, URL-encode special characters in credentials, add the client/Render network to Atlas Network Access, and use `MONGODB_URI_FALLBACK` if SRV DNS queries are blocked. Do not use the in-memory fallback for admin seeding or production data.

### CORS errors

Set exact origins in `CORS_ORIGINS` without trailing slashes. Multiple origins are comma-separated. Locally include `http://127.0.0.1:5173` and `http://localhost:5173`.

### Hedera deployment or write fails

Run `npm.cmd run check-key`, verify the account/key pair came from the same Hedera portal account, confirm `HEDERA_NETWORK=testnet`, and confirm `HEDERA_CONTRACT_ID` is the deployed contract. The backend continues without blockchain logging when configuration is absent or invalid.

### Admin cannot approve a loan

Only loans with status `review` can be manually changed, and only to `approved` or `rejected`. A pending status is counted in the UI queue but the backend will reject manual changes unless the loan is actually `review`.

## 16. Security and Operational Notes

- Rotate secrets after testing and use a long random `JWT_SECRET`.
- Never commit `.env` files, private keys, passwords, or generated model artifacts.
- Use a dedicated Hedera testnet account for development.
- Limit MongoDB permissions and tighten Atlas network access after initial testing.
- The in-memory MongoDB fallback is ephemeral and intended only to keep local startup available when Atlas is unreachable.
- Admin seed/migration explicitly disables that fallback to avoid creating credentials in a temporary database.
- Render free services may sleep, causing cold-start latency.
- This project is a risk-assessment workflow, not a substitute for regulated lending, fraud, compliance, or credit policy review.

## 17. Useful Commands

```powershell
# Backend
cd backend
npm.cmd install
npm.cmd run dev
npm.cmd start
npm.cmd run seed:admin
npm.cmd run migrate:admin

# ML service
cd ..\ml-service
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8001

# Frontend
cd ..\frontend
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run preview

# Blockchain
cd ..\blockchain
npm.cmd install
npm.cmd run check-key
npm.cmd run compile
npm.cmd run deploy
```

## 18. Source-of-Truth Notes

When this handbook conflicts with older documentation, use the implementation as the source of truth. In particular, the backend ML client defaults to local port `8001`, while older local instructions mention `8000`; start Uvicorn on `8001` or explicitly set `ML_SERVICE_URL`. The currently committed package scripts, route definitions, schemas, and environment examples are the authoritative project behavior.