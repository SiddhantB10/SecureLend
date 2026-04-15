const { ethers } = require('ethers');

const abi = [
  'function storeLoan(uint256 loanId, string loanType, uint256 riskScore, string decision) public',
  'function getLoan(uint256 loanId) public view returns (uint256 loanId, string loanType, uint256 riskScore, string decision, uint256 timestamp)',
];

const toChainLoanId = (loanId) => {
  const normalized = loanId.toString().replace(/^0x/, '');
  return BigInt(`0x${normalized}`);
};

const toScaledRisk = (riskScore) => Math.round(Number(riskScore) * 1000);

const shouldUseBlockchain = () =>
  Boolean(
    process.env.GANACHE_RPC_URL &&
      process.env.BLOCKCHAIN_PRIVATE_KEY &&
      process.env.BLOCKCHAIN_CONTRACT_ADDRESS
  );

const getContract = () => {
  if (!shouldUseBlockchain()) {
    return null;
  }

  const provider = new ethers.JsonRpcProvider(process.env.GANACHE_RPC_URL);
  const wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.BLOCKCHAIN_CONTRACT_ADDRESS, abi, wallet);
};

const recordLoanDecision = async ({ loanId, loanType, riskScore, decision }) => {
  const contract = getContract();
  if (!contract) {
    return { blockchainEnabled: false, txHash: '' };
  }

  const tx = await contract.storeLoan(toChainLoanId(loanId), String(loanType || 'personal'), toScaledRisk(riskScore), decision);
  const receipt = await tx.wait();

  return {
    blockchainEnabled: true,
    txHash: receipt.hash,
  };
};

module.exports = {
  recordLoanDecision,
};
