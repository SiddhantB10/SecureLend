// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LoanRegistry {
    struct LoanRecord {
        uint256 loanId;
        string loanType;
        uint256 riskScore;
        string decision;
        uint256 timestamp;
    }

    mapping(uint256 => LoanRecord) private loanRecords;
    mapping(uint256 => bool) private exists;

    event LoanStored(uint256 indexed loanId, string loanType, uint256 riskScore, string decision, uint256 timestamp);

    function storeLoan(uint256 loanId, string memory loanType, uint256 riskScore, string memory decision) public {
        loanRecords[loanId] = LoanRecord({
            loanId: loanId,
            loanType: loanType,
            riskScore: riskScore,
            decision: decision,
            timestamp: block.timestamp
        });
        exists[loanId] = true;

        emit LoanStored(loanId, loanType, riskScore, decision, block.timestamp);
    }

    function getLoan(uint256 loanId)
        public
        view
        returns (uint256, string memory, uint256, string memory, uint256)
    {
        require(exists[loanId], 'Loan record not found');
        LoanRecord memory record = loanRecords[loanId];
        return (record.loanId, record.loanType, record.riskScore, record.decision, record.timestamp);
    }
}
