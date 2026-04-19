const { Client, ContractExecuteTransaction, ContractCallQuery, ContractFunctionParameters, PrivateKey } = require('@hashgraph/sdk');
const crypto = require('crypto');

const ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID;
const PRIVATE_KEY_STRING = process.env.HEDERA_PRIVATE_KEY;
const CONTRACT_ID = process.env.HEDERA_CONTRACT_ID;
const NETWORK = process.env.HEDERA_NETWORK || 'testnet';

const shouldUseBlockchain = () => Boolean(ACCOUNT_ID && PRIVATE_KEY_STRING && CONTRACT_ID);

const toChainLoanId = (loanId) => {
  const raw = String(loanId || '').trim();
  const hex = raw.replace(/^0x/, '').toLowerCase();

  // Mongo ObjectId values are 24-hex chars and safely fit into uint256.
  if (/^[0-9a-f]+$/.test(hex) && hex.length > 0 && hex.length <= 64) {
    return BigInt(`0x${hex}`);
  }

  // Fallback for non-hex IDs: deterministic 128-bit value from SHA-256.
  const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  return BigInt(`0x${digest}`);
};

const parsePrivateKey = () => {
  if (!PRIVATE_KEY_STRING) return null;
  
  let keyHex = PRIVATE_KEY_STRING.trim();
  if (keyHex.startsWith('0x')) {
    keyHex = keyHex.slice(2);
  }

  try {
    return PrivateKey.fromStringED25519(keyHex);
  } catch (e1) {
    try {
      return PrivateKey.fromStringECDSA(keyHex);
    } catch (e2) {
      console.error('Invalid private key format:', e2.message);
      return null;
    }
  }
};

const getClient = () => {
  if (!shouldUseBlockchain()) {
    return null;
  }

  const privateKey = parsePrivateKey();
  if (!privateKey) {
    return null;
  }

  const client = Client.forTestnet();
  client.setOperator(ACCOUNT_ID, privateKey);
  return client;
};

const recordLoanDecision = async ({ loanId, loanType, riskScore, decision }) => {
  try {
    if (!shouldUseBlockchain()) {
      console.log('⚠️ Blockchain disabled - no configuration');
      return { blockchainEnabled: false, txHash: '', error: 'Blockchain not configured' };
    }

    const client = getClient();
    if (!client) {
      console.log('⚠️ Blockchain disabled - invalid credentials');
      return { blockchainEnabled: false, txHash: '', error: 'Failed to initialize client' };
    }

    // Prepare parameters for storeLoan function
    const chainLoanId = toChainLoanId(loanId);
    const riskScoreNum = Math.round(Number(riskScore) * 1000);

    console.log('📤 Recording loan on Hedera:', {
      loanId: chainLoanId.toString(),
      loanType,
      riskScore: riskScoreNum,
      decision,
    });

    // Execute contract function with proper parameters
    const executeContractTx = new ContractExecuteTransaction()
      .setContractId(CONTRACT_ID)
      .setGas(300000)
      .setFunction(
        'storeLoan',
        new ContractFunctionParameters()
          .addUint256(chainLoanId.toString())
          .addString(loanType || 'personal')
          .addUint256(String(riskScoreNum))
          .addString(decision || 'PENDING')
      );

    const executeContractSubmitTx = await executeContractTx.execute(client);
    const executeContractRx = await executeContractSubmitTx.getReceipt(client);

    console.log('✅ Loan recorded on Hedera');
    const txHash = executeContractSubmitTx.transactionId
      ? executeContractSubmitTx.transactionId.toString()
      : '';

    client.close();

    return {
      blockchainEnabled: true,
      txHash: txHash,
      contractId: CONTRACT_ID,
      status: 'SUCCESS',
    };
  } catch (error) {
    console.error('❌ Blockchain error:', error.message);
    return {
      blockchainEnabled: false,
      txHash: '',
      error: error.message,
      status: 'FAILED',
    };
  }
};

const getLoan = async (loanId) => {
  try {
    if (!shouldUseBlockchain()) {
      return null;
    }

    const client = getClient();
    if (!client) {
      return null;
    }

    const chainLoanId = toChainLoanId(loanId);

    // Query contract function: getLoan(uint256 loanId)
    const contractCallQuery = new ContractCallQuery()
      .setContractId(CONTRACT_ID)
      .setGas(300000)
      .setFunction(
        'getLoan',
        new ContractFunctionParameters().addUint256(chainLoanId.toString())
      );

    const queryResponse = await contractCallQuery.execute(client);

    client.close();

    if (!queryResponse) {
      return null;
    }

    // Parse response - returns (uint256, string, uint256, string, uint256)
    try {
      const result = queryResponse.getResult();
      return {
        loanId: result[0].toString(),
        loanType: result[1],
        riskScore: Number(result[2]) / 1000, // Reverse the scaling
        decision: result[3],
        timestamp: Number(result[4]),
      };
    } catch (parseError) {
      console.error('Error parsing response:', parseError.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Query error:', error.message);
    return null;
  }
};

module.exports = {
  recordLoanDecision,
  getLoan,
};
