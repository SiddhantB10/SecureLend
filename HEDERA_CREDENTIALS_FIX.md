# 🔐 Hedera Credentials Setup - CORRECT WAY

Your private key is valid, but it doesn't match your Account ID (0.0.8665542).

## ✅ How to Get CORRECT Credentials

### Step 1: Go to Hedera Portal
https://portal.hedera.com

### Step 2: Sign Up (if you don't have an account)
- Click "Create Account"
- Verify email
- Complete setup

### Step 3: Generate Test Account
- On the dashboard, click **"Generate Account"**
- Hedera will create a new test account FOR YOU
- You'll see:
  ```
  Account ID: 0.0.XXXXX
  Private Key: xxxxxxxx...
  ```

### ⚠️ CRITICAL: Copy BOTH together
- The **Account ID** and **Private Key** shown together on the same page are PAIRED
- If you change one, the other becomes invalid

## 📝 Example of Correct Pair:
```
HEDERA_ACCOUNT_ID=0.0.1234567
HEDERA_PRIVATE_KEY=0xabcd1234efgh5678...
```

## 🚀 Update Your Configuration

Once you have the correct pair:

1. Open `blockchain/.env`:
```env
HEDERA_ACCOUNT_ID=0.0.XXXXX         # Replace with your generated ID
HEDERA_PRIVATE_KEY=0xYOUR_PRIVATE_KEY  # Replace with your generated key
HEDERA_NETWORK=testnet
HEDERA_CONTRACT_ID=
```

2. Open `backend/.env`:
```env
HEDERA_ACCOUNT_ID=0.0.XXXXX
HEDERA_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
HEDERA_NETWORK=testnet
HEDERA_CONTRACT_ID=
```

3. Then run deployment:
```bash
cd blockchain
npm run deploy
```

## 🔗 Current Status
- Account ID: `0.0.8665542`
- Private Key: ✅ Valid format but ❌ Doesn't match the account
- Solution: Get new Account ID from Hedera Portal

## 💡 How to Verify Credentials Work
After updating .env with new credentials, run:
```bash
node scripts/checkKey.js  # Should show valid key
npm run deploy            # Should deploy successfully
```

## 📚 Need Help?
1. Hedera Portal: https://portal.hedera.com
2. Documentation: https://docs.hedera.com
3. Test account takes ~1 minute to set up

---

**Next: Go to Hedera Portal, generate a new account, and update your .env files!**
