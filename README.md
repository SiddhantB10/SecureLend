# SecureLend

SecureLend is a full-stack AI-powered lending risk platform with:
- Frontend on Vercel (React + Vite)
- Backend API on Render (Node + Express)
- ML API on Render (FastAPI)
- Database on MongoDB Atlas
- Blockchain writes on Hedera testnet

This repository is now configured to deploy with that exact architecture.

## How a loan decision is made

Every application goes through three layers, and the applicant sees the reasons for each:

1. **Identity & fraud checks** (`backend/services/decisionEngine.js`): PAN format (individual
   PAN), PAN 5th letter vs surname, PAN already used by another account, applicant name vs account
   holder, applications in the last 24 h (velocity), income or credit-score changes within 30 days,
   age vs years employed / credit history, and an ML anomaly detector.
2. **Lending policy** (`backend/services/lendingPolicy.js`): minimum age 21 and maximum age at
   loan end, regular income, minimum income, CIBIL floor (600, with 600–649 reviewed), missed
   payments, FOIR (all EMIs ≤ 50% comfortable, > 60% declined), and RBI loan-to-value caps for
   property loans (90% / 80% / 75%).
3. **Credit-risk model** (`ml-service/`): calibrated probability of default from monotonic
   gradient boosting trained on **42,493 real loans with known outcomes** (out-of-time ROC-AUC
   0.69). It sets the risk band and a risk-based interest rate. Full details are in
   [`ml-service/MODEL_CARD.md`](ml-service/MODEL_CARD.md).

Outcome: **approved** (with the offer, EMI and total interest), **sent for manual review** (an
officer decides from the admin dashboard and adds a note the applicant sees), or **declined**. Each
outcome comes with plain-language reasons, what counted in the applicant's favour, a counter-offer
when they can afford a smaller loan, and concrete steps to improve.

## Full Deployment Walkthrough

For a complete beginner-friendly, copy-paste deployment playbook (including exact env variables and India-specific recommendations), use:

- `DEPLOYMENT_GUIDE.md`

## Deployment Topology

- Frontend: `frontend/` -> Vercel
- Backend API: `backend/` -> Render Web Service
- ML API: `ml-service/` -> Render Web Service
- Smart contract: `blockchain/` -> deployed to Hedera testnet
- DB: MongoDB Atlas cluster

## 1) Deploy MongoDB Atlas

1. Create an Atlas cluster and database user.
2. In Atlas Network Access, allow Render outbound IPs or temporarily allow `0.0.0.0/0` while testing.
3. Copy the connection string and set database name to `securelend`.

Example:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/securelend?retryWrites=true&w=majority
# Optional for networks that block SRV DNS queries:
MONGODB_URI_FALLBACK=mongodb://<username>:<password>@<host1>:27017,<host2>:27017,<host3>:27017/securelend?replicaSet=<replica-set>&authSource=admin&retryWrites=true&w=majority
```

## 2) Deploy Smart Contract to Hedera

1. Create `blockchain/.env` from `blockchain/.env.example`.
2. Set `HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY`.
3. Deploy:

```bash
cd blockchain
npm install
npm run compile
npm run deploy
```

4. Save the deployed `HEDERA_CONTRACT_ID` and use it in backend env vars.

## 3) Deploy ML API on Render

Use either:
- `render.yaml` blueprint at repo root, or
- Manual Render service setup.

Service settings:
- Root Directory: `ml-service`
- Build Command: `pip install -r requirements.txt && python training/train_model.py`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`

Recommended env vars for Render:

```env
PYTHON_VERSION=3.11.9
CORS_ORIGINS=https://your-backend.onrender.com
```

Model files (`*.pkl`) are git-ignored, so the build step trains them from the real dataset in `ml-service/data/` (about 20 seconds). If the service ever starts without models, it trains them on first request.

## 4) Deploy Backend API on Render

Service settings:
- Root Directory: `backend`
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/health`

Required env vars:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/securelend?retryWrites=true&w=majority
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d
ML_SERVICE_URL=https://your-ml-service.onrender.com
CORS_ORIGINS=https://your-frontend.vercel.app
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.<account-id>
HEDERA_PRIVATE_KEY=<hedera-private-key>
HEDERA_CONTRACT_ID=0.0.<contract-id>
ADMIN_NAME=<admin-name>
ADMIN_EMAIL=<admin-email>
ADMIN_PASSWORD=<strong-admin-password>
ADMIN_PHONE=<admin-phone>
```

After first successful backend deploy, run admin seed once:

```bash
cd backend
npm install
npm run seed:admin
```

You can also run this through a Render one-off shell.

## 5) Deploy Frontend on Vercel

1. Import this repository in Vercel.
2. Set project root to `frontend`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Set env var:

```env
VITE_API_URL=https://your-backend.onrender.com
```

`frontend/vercel.json` already includes SPA rewrite routing to `index.html`.

## 6) Required Files in This Repo

- `render.yaml` contains both Render services (backend + ML API).
- `frontend/vercel.json` configures SPA rewrites.
- `backend/.env.example` is aligned to Atlas + Hedera + Render.
- `ml-service/.env.example` includes explicit CORS setup.
- `blockchain/.env.example` is aligned to Hedera.
- Admin accounts now live in the dedicated `admins` collection, while borrowers stay in `users`.

## 7) Health Checks

- Backend: `GET /health`
- ML API: `GET /health`

Both endpoints are present and suitable for Render health checks.

## 8) Local Dev (Optional)

```bash
# Backend
cd backend
npm install
copy .env.example .env
npm run dev

# ML API
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# Frontend
cd frontend
npm install
copy .env.example .env
npm run dev
```

## API Endpoints

- `POST /signup`
- `POST /login`
- `POST /apply-loan`: body fields `loanType, loanAmount, tenureMonths, purpose | propertyValue, fullName, dateOfBirth, pan, employmentType, monthlyIncome, yearsEmployed, existingEmi, residenceType, noCreditHistory, creditScore, missedPayments, recentCreditApplications, creditHistoryYears`. Returns the loan with its full `assessment`.
- `GET /my-loans`
- `GET /loan/:id` (owner or admin)
- `GET /all-loans` (admin)
- `PUT /loan/:id/status` (admin; `status`, optional `adminNotes`)
- `GET /model-info`: model metrics (proxied from the ML service)
- `GET /admin/audit-logs` (admin): admin sign-ins and manual decisions, newest first
- ML service: `POST /predict`, `GET /model-info`, `GET /health`
