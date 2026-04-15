require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

const normalizePrivateKey = () => {
  const raw = (process.env.PRIVATE_KEY || '').trim();
  if (!raw) {
    return '';
  }

  const normalized = raw.startsWith('0x') ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return '';
  }

  return `0x${normalized}`;
};

const privateKey = normalizePrivateKey();
const accounts = privateKey ? [privateKey] : [];

module.exports = {
  solidity: '0.8.24',
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts,
    },
    ganache: {
      url: process.env.GANACHE_RPC_URL || 'http://127.0.0.1:7545',
      accounts,
    },
  },
};
