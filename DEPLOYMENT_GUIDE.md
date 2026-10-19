# SecureLend Deployment Guide (Vercel + Render + Atlas + Hedera)

This guide is written for beginners and is designed so you can deploy end-to-end with free-tier services.

## 0) What You Will Deploy

- Frontend: Vercel
- Backend API: Render Web Service (Node)
- ML API: Render Web Service (Python/FastAPI)
- Database: MongoDB Atlas (M0 free cluster)
- Blockchain: Hedera testnet

## 1) Important Free-Tier Reality Check

You asked for 100% free.

- Vercel Hobby: free
- MongoDB Atlas M0: free
- Hedera testnet: free testnet for development
- Render: usually has free options, but availability can vary by account/region/policy updates.

If your Render account does not show free web services, this architecture cannot stay 100% free on Render specifically. In that case, keep all config from this guide and switch only hosting provider for backend/ML.

## 2) Create Accounts (One-Time)

Create these accounts first:

- GitHub (code repo)
- Vercel
- Render
- MongoDB Atlas
- Hedera portal account
- Hedera testnet wallet credentials

## 3) Recommended Region Setup For India

For lower latency in India:

- Vercel: auto global edge (good for India)
- Render: pick closest available region (prefer Singapore if Mumbai is not available)
- MongoDB Atlas: pick AWS Mumbai (`ap-south-1`) if available on free tier, else nearest Asia region
- RPC provider: choose endpoint closest to Asia if option exists

## 4) Deployment Order (Do In This Exact Sequence)

1. Deploy smart contract to Hedera
2. Create MongoDB Atlas cluster
3. Deploy ML API on Render
4. Deploy Backend on Render
5. Deploy Frontend on Vercel
6. Seed admin user on backend
7. Smoke-test full flow

## 5) Step A: Deploy Smart Contract To Hedera

### A1. Prepare wallet and funds

- Create a Hedera testnet account or reuse your paired credentials.
- Keep private key secure (never commit).

### A2. Configure contract env

Create `blockchain/.env` with this exact shape:

```env
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=YOUR_PRIVATE_KEY_HEX
HEDERA_NETWORK=testnet
HEDERA_CONTRACT_ID=
```

### A3. Deploy

Run from project root:

```powershell
cd blockchain
npm install
npm run deploy
```

Copy the output contract ID. You will need it later as `HEDERA_CONTRACT_ID`.

## 6) Step B: Create MongoDB Atlas (Free)

### B1. Create free cluster

- In Atlas: Build a Database -> Shared -> M0 Free.
- Region: choose Mumbai if available.

### B2. Create DB user

- Database Access -> Add new user.
- Save username/password.

### B3. Network Access

- Add IP Access List.
- For easiest first deploy: allow `0.0.0.0/0`.
- Later, tighten security if needed.

### B4. Get connection string

Use this exact format:

```env
mongodb+srv://ATLAS_USER:ATLAS_PASSWORD@CLUSTER_HOST/securelend?retryWrites=true&w=majority
```

If your runtime/network blocks DNS SRV lookups (`querySrv ECONNREFUSED`), also set:

```env
MONGODB_URI_FALLBACK=mongodb://ATLAS_USER:ATLAS_PASSWORD@HOST1:27017,HOST2:27017,HOST3:27017/securelend?replicaSet=REPLICA_SET_NAME&authSource=admin&retryWrites=true&w=majority
```

## 7) Step C: Deploy ML API On Render

### C1. Create service

- Render -> New -> Web Service
- Connect GitHub repo
- Root Directory: `ml-service`
- Runtime: Python
- Build Command:

```bash
pip install -r requirements.txt
```

- Start Command:

```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```

- Health Check Path: `/health`

Why this is faster:

- Model files are already present in `ml-service/models/`, so retraining during each Render deploy is unnecessary.
- Training in build step can cause long builds or timeouts on free-tier instances.

### C2. Set env vars

Set exactly:

```env
CORS_ORIGINS=https://YOUR_BACKEND_RENDER_URL
```

Example after backend exists:

```env
CORS_ORIGINS=https://securelend-backend.onrender.com
```

### C3. Deploy and verify

Open:

- `https://YOUR_ML_RENDER_URL/health`

Expected response includes `"status": "ok"`.

## 8) Step D: Deploy Backend On Render

### D1. Create service

- Render -> New -> Web Service
- Root Directory: `backend`
- Runtime: Node
- Build Command:

```bash
npm ci
```

- Start Command:

```bash
npm start
```

- Health Check Path: `/health`

### D2. Set backend env vars (exact list)

Use this complete set in Render Environment:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://ATLAS_USER:ATLAS_PASSWORD@CLUSTER_HOST/securelend?retryWrites=true&w=majority
JWT_SECRET=seclend37grp
JWT_EXPIRES_IN=7d
ML_SERVICE_URL=https://YOUR_ML_RENDER_URL
CORS_ORIGINS=https://YOUR_FRONTEND_VERCEL_URL
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=YOUR_PRIVATE_KEY_HEX
HEDERA_CONTRACT_ID=0.0.YOUR_DEPLOYED_CONTRACT
ADMIN_NAME=YOUR_ADMIN_NAME
ADMIN_EMAIL=YOUR_ADMIN_EMAIL
ADMIN_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
ADMIN_PHONE=YOUR_ADMIN_PHONE
```

Notes:

- `CORS_ORIGINS` supports comma-separated multiple origins.
- Do not add trailing slash in URLs.
- Keep same private key wallet you used for contract deploy (or another funded wallet with permissions).

### D3. Verify backend

Open:

- `https://YOUR_BACKEND_RENDER_URL/health`

Expected: JSON with `"status": "ok"`.

## 9) Step E: Deploy Frontend On Vercel

### E1. Import project

- Vercel -> New Project -> Import repo
- Set Root Directory to `frontend`

### E2. Build settings

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

### E3. Set frontend env vars

Set exactly:

```env
VITE_API_URL=https://YOUR_BACKEND_RENDER_URL
```

### E4. Redeploy

After env var save, trigger redeploy.

## 10) Step F: Seed Admin User

Use Render Shell for backend service (or local command with same DB env):

```bash
npm run seed:admin
```

It creates/updates admin from `ADMIN_*` env vars.

## 11) Step G: Connect Everything (Dependency Map)

Use this map to confirm linkage:

- Frontend (`VITE_API_URL`) -> Backend Render URL
- Backend (`ML_SERVICE_URL`) -> ML Render URL
- Backend (`MONGODB_URI`) -> Atlas cluster
- Admin login data -> `admins` collection
- Backend (`HEDERA_ACCOUNT_ID`) -> Hedera account
- Backend (`HEDERA_PRIVATE_KEY`) -> Hedera private key
- Backend (`HEDERA_CONTRACT_ID`) -> your deployed contract
- ML (`CORS_ORIGINS`) -> Backend Render URL
- Backend (`CORS_ORIGINS`) -> Frontend Vercel URL

If all 7 links are correct, deployment works.

## 12) Quick Smoke Test Checklist

1. Open frontend URL on Vercel.
2. Sign up user.
3. Login user.
4. Submit loan application.
5. Confirm result page loads risk and decision.
6. Login as admin and approve/reject a review loan.
7. Verify backend logs no CORS/ML errors.
8. Verify blockchain transaction hash appears for approved/rejected decisions.

## 13) Common Errors And Exact Fix

### Error: CORS blocked

Fix:

- Ensure backend `CORS_ORIGINS` includes exact Vercel domain.
- Ensure no trailing slash.
- If using custom Vercel domain, add both domains comma-separated.

Example:

```env
CORS_ORIGINS=https://securelend.vercel.app,https://www.securelend.in
```

### Error: Backend cannot call ML

Fix:

- Check `ML_SERVICE_URL` points to live ML Render URL.
- Check ML health endpoint works.
- Ensure ML env has `CORS_ORIGINS=https://YOUR_BACKEND_RENDER_URL`.

### Error: Mongo connection failed

Fix:

- Atlas IP access list includes Render outbound traffic (or `0.0.0.0/0`).
- User/password in URI are URL-encoded if they contain special characters.

### Error: Hardhat invalid private key

Fix:

- Private key must be 64 hex chars (with or without `0x`).
- Use a valid Hedera testnet account/key pair only.

### Error: Contract write fails from backend

Fix:

- Verify `HEDERA_CONTRACT_ID` matches the deployed contract.
- Verify `HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY` are a matched pair.
- Use the Hedera testnet network.

## 14) India Smoothness Tips

- Choose nearest region for Atlas/Render.
- Keep payload sizes small and image assets compressed.
- Free Render services may sleep; first request after idle can be slow.
- To reduce cold-start impact (free method), ping `/health` on both Render services every 10-14 minutes using a free cron service.

## 15) Security Minimum Before Public Sharing

- Rotate all secrets after testing.
- Never commit `.env` files.
- Use strong `JWT_SECRET`.
- Use a dedicated Hedera test account for deployments.
- Keep Atlas user permissions limited to required database.

## 16) Exact Env Templates (Copy/Paste)

### 16.1 backend/.env (Render)

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://ATLAS_USER:ATLAS_PASSWORD@CLUSTER_HOST/securelend?retryWrites=true&w=majority
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=7d
ML_SERVICE_URL=https://YOUR_ML_RENDER_URL
CORS_ORIGINS=https://YOUR_FRONTEND_VERCEL_URL
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=YOUR_PRIVATE_KEY_HEX
HEDERA_CONTRACT_ID=0.0.YOUR_DEPLOYED_CONTRACT
ADMIN_NAME=SecureLend Admin
ADMIN_EMAIL=admin@securelend.com
ADMIN_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
ADMIN_PHONE=+919999999999
```

### 16.2 ml-service/.env (Render)

```env
CORS_ORIGINS=https://YOUR_BACKEND_RENDER_URL
```

### 16.3 frontend/.env (Vercel)

```env
VITE_API_URL=https://YOUR_BACKEND_RENDER_URL
```

### 16.4 blockchain/.env (local deploy machine)

```env
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=YOUR_PRIVATE_KEY_HEX
HEDERA_NETWORK=testnet
HEDERA_CONTRACT_ID=
```

## 17) Final Go-Live Verification URLs

Replace values and test:

- Frontend: `https://YOUR_FRONTEND_VERCEL_URL`
- Backend health: `https://YOUR_BACKEND_RENDER_URL/health`
- ML health: `https://YOUR_ML_RENDER_URL/health`

If all are green and smoke tests pass, your deployment is fully connected.
