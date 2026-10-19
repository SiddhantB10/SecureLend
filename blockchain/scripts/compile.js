const path = require('path');
const fs = require('fs');
const solc = require('solc');

const contractPath = path.resolve(__dirname, '..', 'contracts', 'LoanRegistry.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'LoanRegistry.sol': {
      content: source
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

console.log('🔨 Compiling Solidity contract...');
const tempFile = JSON.parse(solc.compile(JSON.stringify(input)));

if (tempFile.errors) {
  let hasError = false;
  for (const error of tempFile.errors) {
    console.error(error.formattedMessage);
    if (error.severity === 'error') {
      hasError = true;
    }
  }
  if (hasError) {
    process.exit(1);
  }
}

const contract = tempFile.contracts['LoanRegistry.sol']['LoanRegistry'];
const bytecode = contract.evm.bytecode.object;

const outputDir = path.resolve(__dirname, '..', 'artifacts', 'contracts', 'LoanRegistry.sol');
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.resolve(outputDir, 'LoanRegistry.json');
fs.writeFileSync(outputPath, JSON.stringify({ bytecode: '0x' + bytecode }, null, 2));

console.log('✅ Compiled successfully! Artifact saved to:', outputPath);
