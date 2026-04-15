const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error(
      'No deployer account available. Set PRIVATE_KEY in blockchain/.env to a 64-hex private key (with or without 0x), not a wallet address.'
    );
  }

  if (hre.network.name === 'sepolia' && !(process.env.SEPOLIA_RPC_URL || '').trim()) {
    throw new Error('SEPOLIA_RPC_URL is missing in blockchain/.env.');
  }

  console.log('Deploying with account:', deployer.address);

  const LoanRegistry = await hre.ethers.getContractFactory('LoanRegistry', deployer);
  const registry = await LoanRegistry.deploy();
  await registry.waitForDeployment();

  console.log('LoanRegistry deployed to:', await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
