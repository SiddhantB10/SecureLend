# SecureLend

SecureLend is a full-stack AI-powered lending risk platform with:
- Frontend on Vercel (React + Vite)
- Backend API on Render (Node + Express)
- ML API on Render (FastAPI)
- Database on MongoDB Atlas
- Blockchain writes on Ethereum Sepolia

This repository is now configured to deploy with that exact architecture.

## Full Deployment Walkthrough

For a complete beginner-friendly, copy-paste deployment playbook (including exact env variables and India-specific recommendations), use:

- `DEPLOYMENT_GUIDE.md`

## Deployment Topology

- Frontend: `frontend/` -> Vercel
- Backend API: `backend/` -> Render Web Service
- ML API: `ml-service/` -> Render Web Service
- Smart contract: `blockchain/` -> deployed to Sepolia
- DB: MongoDB Atlas cluster

## 1) Deploy MongoDB Atlas

1. Create an Atlas cluster and database user.
2. In Atlas Network Access, allow Render outbound IPs or temporarily allow `0.0.0.0/0` while testing.
3. Copy the connection string and set database name to `securelend`.

Example:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/securelend?retryWrites=true&w=majority
```

## 2) Deploy Smart Contract to Sepolia

1. Create `blockchain/.env` from `blockchain/.env.example`.
2. Set `SEPOLIA_RPC_URL` and `PRIVATE_KEY`.
3. Deploy:

```bash
cd blockchain
npm install
npm run compile
npm run deploy:sepolia
```

4. Save deployed contract address and use it as `BLOCKCHAIN_CONTRACT_ADDRESS` in backend env vars.

## 3) Deploy ML API on Render

Use either:
- `render.yaml` blueprint at repo root, or
- Manual Render service setup.

Service settings:
- Root Directory: `ml-service`
- Build Command: `pip install -r requirements.txt && python training/train_model.py`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`

Required env vars:

```env
CORS_ORIGINS=https://your-backend.onrender.com
```

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
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/<project-id>
BLOCKCHAIN_CONTRACT_ADDRESS=0xYourSepoliaContractAddress
BLOCKCHAIN_PRIVATE_KEY=0xYourSepoliaWalletPrivateKey
ADMIN_NAME=SecureLend Admin
ADMIN_EMAIL=admin@securelend.com
ADMIN_PASSWORD=<strong-admin-password>
ADMIN_PHONE=+10000000000
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
- `backend/.env.example` is aligned to Atlas + Sepolia + Render.
- `ml-service/.env.example` includes explicit CORS setup.
- `blockchain/.env.example` is aligned to Sepolia.

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
python training/train_model.py
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
