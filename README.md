# SecureLend

SecureLend is a full-stack AI-powered loan fraud detection platform with a React/Vite frontend, Node/Express backend, Python FastAPI ML service, and Ethereum blockchain audit logging.

## Architecture

- Frontend: React.js, Vite, Tailwind CSS, Framer Motion, React Router, Axios
- Backend: Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, ethers.js
- ML Service: Python, FastAPI, Random Forest model, Logistic Regression baseline
- Blockchain: Solidity smart contract on Ganache with ethers.js writes after admin decisions

## Folder Structure

```text
SecureLend/
  frontend/
  backend/
  ml-service/
  blockchain/
```

## Local Setup

### 1) Prerequisites

- Node.js 18+
- MongoDB running locally or in the cloud
- Python 3.10+
- Ganache running locally

### 2) Backend

```bash
cd backend
npm install
copy .env.example .env
npm run seed:admin
npm run dev
```

### 3) ML Service

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python training/train_model.py
uvicorn app:app --reload --port 8000
```

### 4) Blockchain

```bash
cd blockchain
npm install
copy .env.example .env
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
```

### 5) Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

## Environment Variables

### backend/.env

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/securelend
JWT_SECRET=replace_me
JWT_EXPIRES_IN=7d
ML_SERVICE_URL=http://127.0.0.1:8000
GANACHE_RPC_URL=http://127.0.0.1:7545
BLOCKCHAIN_CONTRACT_ADDRESS=0xYourDeployedContractAddress
BLOCKCHAIN_PRIVATE_KEY=0xYourGanacheAccountPrivateKey
```

### frontend/.env

```env
VITE_API_URL=http://127.0.0.1:5000
```

### ml-service/.env

```env
MODEL_DIR=./models
```

### blockchain/.env

```env
GANACHE_RPC_URL=http://127.0.0.1:7545
PRIVATE_KEY=0xYourGanacheAccountPrivateKey
```

## API Endpoints

- `POST /signup`
- `POST /login`
- `POST /apply-loan`
- `GET /my-loans`
- `GET /all-loans`
- `PUT /loan/:id/status`

## Notes

- Loan risk scores are stored on-chain as integers scaled by 1000.
- The landing page is the first route; login is never the entry point.
- Admin decisions trigger a blockchain write after the database update succeeds.
- The backend includes a seed script that creates or updates an admin account.
