const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const {
  Client,
  ContractCreateTransaction,
  FileCreateTransaction,
  Hbar,
  PrivateKey,
  ContractFunctionParameters,
} = require('@hashgraph/sdk');

const ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID;
const PRIVATE_KEY_STRING = process.env.HEDERA_PRIVATE_KEY;
const NETWORK = process.env.HEDERA_NETWORK || 'testnet';

if (!ACCOUNT_ID || !PRIVATE_KEY_STRING) {
  throw new Error('HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in .env');
}

async function main() {
  // Parse private key - remove 0x prefix if present
  let privateKeyHex = PRIVATE_KEY_STRING.trim();
  if (privateKeyHex.startsWith('0x')) {
    privateKeyHex = privateKeyHex.slice(2);
  }

  // Create private key from hex string
  let privateKey;
  try {
    privateKey = PrivateKey.fromStringED25519(privateKeyHex);
  } catch (e1) {
    try {
      privateKey = PrivateKey.fromStringECDSA(privateKeyHex);
    } catch (e2) {
      throw new Error(`Invalid private key format. Must be ED25519 or ECDSA hex. Error: ${e2.message}`);
    }
  }

  // Create client
  const client = Client.forTestnet();
  client.setOperator(ACCOUNT_ID, privateKey);

  console.log('🔗 Deploying to Hedera Testnet...');
  console.log('📍 Account ID:', ACCOUNT_ID);

  try {
    // Read compiled contract bytecode from the Hardhat artifact
    const artifactPath = path.join(
      __dirname,
      '..',
      'artifacts',
      'contracts',
      'LoanRegistry.sol',
      'LoanRegistry.json'
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const contractBytecode = artifact.bytecode;

    if (!contractBytecode || contractBytecode === '0x') {
      throw new Error('Compiled bytecode not found in LoanRegistry artifact.');
    }

    // Upload contract bytecode to Hedera File Service
    console.log('\n📤 Uploading contract bytecode...');
    const fileCreateTx = new FileCreateTransaction()
      .setKeys([privateKey.publicKey])
      .setContents(contractBytecode);

    const fileCreateSubmitTx = await fileCreateTx.execute(client);
    const fileCreateRx = await fileCreateSubmitTx.getReceipt(client);
    const bytecodeFileId = fileCreateRx.fileId;

    console.log('✅ Bytecode uploaded:', bytecodeFileId.toString());

    // Deploy contract
    console.log('\n🚀 Deploying smart contract...');
    const contractCreateTx = new ContractCreateTransaction()
      .setBytecodeFileId(bytecodeFileId)
      .setGas(1500000)
      .setConstructorParameters(new ContractFunctionParameters());

    const contractCreateSubmitTx = await contractCreateTx.execute(client);
    const contractCreateRx = await contractCreateSubmitTx.getReceipt(client);
    const contractId = contractCreateRx.contractId;

    console.log('✅ LoanRegistry deployed!');
    console.log('📋 Contract ID:', contractId.toString());

    // Update .env with contract ID in both blockchain and backend folders
    const blockchainEnvPath = path.join(__dirname, '..', '.env');
    let blockchainEnvContent = fs.readFileSync(blockchainEnvPath, 'utf8');
    blockchainEnvContent = blockchainEnvContent.replace(/HEDERA_CONTRACT_ID=.*/, `HEDERA_CONTRACT_ID=${contractId.toString()}`);
    fs.writeFileSync(blockchainEnvPath, blockchainEnvContent);

    // Also update backend .env if it exists
    const backendEnvPath = path.join(__dirname, '..', '..', 'backend', '.env');
    if (fs.existsSync(backendEnvPath)) {
      let backendEnvContent = fs.readFileSync(backendEnvPath, 'utf8');
      backendEnvContent = backendEnvContent.replace(/HEDERA_CONTRACT_ID=.*/, `HEDERA_CONTRACT_ID=${contractId.toString()}`);
      fs.writeFileSync(backendEnvPath, backendEnvContent);
      console.log('📝 Updated backend .env with HEDERA_CONTRACT_ID');
    }

    console.log('\n✨ Deployment successful!');
    console.log('📝 .env files updated with HEDERA_CONTRACT_ID');
    console.log('\n🎉 Next steps:');
    console.log('1. Backend is ready to use!');
    console.log('2. Contract functions available: storeLoan(), getLoan()');

    client.close();
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    client.close();
    process.exit(1);
  }
}

main();

