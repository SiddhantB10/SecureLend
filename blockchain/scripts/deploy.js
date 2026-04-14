const hre = require('hardhat');

async function main() {
  const LoanRegistry = await hre.ethers.getContractFactory('LoanRegistry');
  const registry = await LoanRegistry.deploy();
  await registry.waitForDeployment();

  console.log('LoanRegistry deployed to:', await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
