require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrivateKey } = require('@hashgraph/sdk');

const PRIVATE_KEY_STRING = process.env.HEDERA_PRIVATE_KEY;
const ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID;

console.log('🔍 Checking Hedera Key Configuration...\n');

if (!ACCOUNT_ID || !PRIVATE_KEY_STRING) {
  console.error('Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY in blockchain/.env');
  process.exit(1);
}

console.log('Account ID:', ACCOUNT_ID);
console.log('Private Key (truncated):', PRIVATE_KEY_STRING.substring(0, 10) + '...' + PRIVATE_KEY_STRING.substring(PRIVATE_KEY_STRING.length - 10));
console.log('Key Length:', PRIVATE_KEY_STRING.length);

let keyHex = PRIVATE_KEY_STRING.trim();
if (keyHex.startsWith('0x')) {
  keyHex = keyHex.slice(2);
  console.log('Detected 0x prefix - removed');
  console.log('Hex key length after removing 0x:', keyHex.length);
}

console.log('\n🧪 Testing key formats...\n');

// Try ED25519
try {
  const ed25519Key = PrivateKey.fromStringED25519(keyHex);
  console.log('✅ Valid ED25519 key');
  console.log('   Public key:', ed25519Key.publicKey.toString());
} catch (e) {
  console.log('❌ Not a valid ED25519 key:', e.message);
}

// Try ECDSA
try {
  const ecdsaKey = PrivateKey.fromStringECDSA(keyHex);
  console.log('✅ Valid ECDSA key');
  console.log('   Public key:', ecdsaKey.publicKey.toString());
} catch (e) {
  console.log('❌ Not a valid ECDSA key:', e.message);
}

console.log('\n⚠️  IMPORTANT:');
console.log('If both key types fail, your private key may be:');
console.log('1. Incorrect/corrupted');
console.log('2. Not matching your Account ID');
console.log('3. In a different format');
console.log('\nGo to https://portal.hedera.com and verify your credentials');
