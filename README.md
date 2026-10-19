# SecureLend

SecureLend is a full-stack AI-powered lending risk platform with:
- Frontend on Vercel (React + Vite)
- Backend API on Render (Node + Express)
- ML API on Render (FastAPI)
- Database on MongoDB Atlas
- Blockchain writes on Hedera testnet

This repository is now configured to deploy with that exact architecture.

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
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`

Recommended env vars for Render:

```env
PYTHON_VERSION=3.11.9
CORS_ORIGINS=https://your-backend.onrender.com
```

Model files are committed in `ml-service/models/`, so retraining in the build step is unnecessary and can slow down free-tier deploys.

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
- `POST /apply-loan`
- `GET /my-loans`
- `GET /all-loans`
- `PUT /loan/:id/status`
