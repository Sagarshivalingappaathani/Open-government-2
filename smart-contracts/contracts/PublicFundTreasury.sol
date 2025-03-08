// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PublicFundTreasury {
    address public owner;
    uint256 public fundBalance;
    uint256 public proposalCount;

    struct Proposal {
        uint256 id;
        string description;
        uint256 amount;
        address payable recipient;
        uint256 votes;
        bool approved;
        bool executed;
        uint256 createdAt;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted; // Tracks votes per proposal per person

    event FundsDeposited(address indexed depositor, uint256 amount);
    event ProposalSubmitted(uint256 id, string description, uint256 amount, address recipient);
    event ProposalApproved(uint256 id);
    event FundsReleased(uint256 id, address recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier proposalExists(uint256 _proposalId) {
        require(proposals[_proposalId].id != 0, "Proposal does not exist");
        _;
    }

    modifier notExecuted(uint256 _proposalId) {
        require(!proposals[_proposalId].executed, "Funds already released");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Allow public deposits into the treasury
    function depositFunds() external payable {
        require(msg.value > 0, "Deposit must be greater than zero");
        fundBalance += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    // Submit a new spending proposal
    function submitProposal(string memory _description, uint256 _amount, address payable _recipient) external {
        require(_amount > 0, "Requested amount must be greater than zero");
        require(_recipient != address(0), "Invalid recipient address");

        proposalCount++;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            description: _description,
            amount: _amount,
            recipient: _recipient,
            votes: 0,
            approved: false,
            executed: false,
            createdAt: block.timestamp
        });

        emit ProposalSubmitted(proposalCount, _description, _amount, _recipient);
    }

    // Vote on a proposal (only once per proposal per person)
    function voteOnProposal(uint256 _proposalId) external proposalExists(_proposalId) {
        require(!hasVoted[_proposalId][msg.sender], "Already voted on this proposal");

        proposals[_proposalId].votes++;
        hasVoted[_proposalId][msg.sender] = true;

        if (proposals[_proposalId].votes >= 3) { // Example threshold for auto-approval
            proposals[_proposalId].approved = true;
            emit ProposalApproved(_proposalId);
        }
    }

    // Release funds for an approved proposal
    function releaseFunds(uint256 _proposalId) external proposalExists(_proposalId) notExecuted(_proposalId) {
        Proposal storage prop = proposals[_proposalId];
        require(prop.approved, "Proposal is not approved");
        require(prop.amount <= fundBalance, "Insufficient funds");

        prop.recipient.transfer(prop.amount);
        fundBalance -= prop.amount;
        prop.executed = true;

        emit FundsReleased(_proposalId, prop.recipient, prop.amount);
    }

    // Get current treasury balance
    function getTreasuryBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // View all proposals
    function getProposal(uint256 _proposalId) external view proposalExists(_proposalId) returns (Proposal memory) {
        return proposals[_proposalId];
    }
}