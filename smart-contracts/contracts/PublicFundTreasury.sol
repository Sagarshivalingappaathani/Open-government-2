// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PublicFundTreasury {
    address public owner;
    uint256 public fundBalance;
    uint256 public proposalCount;
    uint256 public requiredApprovals;  // Number of approvals needed for a proposal to pass

    // Authority management
    mapping(address => bool) public isAuthority;
    address[] public authorities;

    struct Proposal {
        uint256 id;
        string description;
        uint256 amount;
        address payable recipient;
        mapping(address => bool) hasVoted;  // Track which authorities have voted
        uint256 approvalCount;
        bool approved;
        bool executed;
        uint256 createdAt;
    }

    mapping(uint256 => Proposal) public proposals;

    event FundsDeposited(address indexed depositor, uint256 amount);
    event ProposalSubmitted(uint256 id, string description, uint256 amount, address recipient);
    event AuthorityAdded(address indexed authority);
    event AuthorityRemoved(address indexed authority);
    event AuthorityVoted(uint256 indexed proposalId, address indexed authority);
    event ProposalApproved(uint256 indexed proposalId);
    event FundsReleased(uint256 indexed proposalId, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyAuthority() {
        require(isAuthority[msg.sender], "Only authorities can vote on proposals");
        _;
    }

    modifier proposalExists(uint256 _proposalId) {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Proposal does not exist");
        _;
    }

    modifier notExecuted(uint256 _proposalId) {
        require(!proposals[_proposalId].executed, "Proposal already executed");
        _;
    }

    constructor(uint256 _requiredApprovals) {
        owner = msg.sender;
        
        // Add owner as the first authority
        isAuthority[msg.sender] = true;
        authorities.push(msg.sender);
        
        // Set initial required approvals (minimum 1)
        requiredApprovals = _requiredApprovals > 0 ? _requiredApprovals : 1;
    }

    // Add a new authority (only owner can add)
    function addAuthority(address _authority) external onlyOwner {
        require(_authority != address(0), "Invalid authority address");
        require(!isAuthority[_authority], "Address is already an authority");
        
        isAuthority[_authority] = true;
        authorities.push(_authority);
        
        emit AuthorityAdded(_authority);
    }

    // Remove an authority (only owner can remove)
    function removeAuthority(address _authority) external onlyOwner {
        require(isAuthority[_authority], "Address is not an authority");
        require(authorities.length > requiredApprovals, "Cannot have fewer authorities than required approvals");
        require(_authority != owner, "Cannot remove the owner from authorities");
        
        isAuthority[_authority] = false;
        
        // Remove authority from the array
        for (uint256 i = 0; i < authorities.length; i++) {
            if (authorities[i] == _authority) {
                authorities[i] = authorities[authorities.length - 1];
                authorities.pop();
                break;
            }
        }
        
        emit AuthorityRemoved(_authority);
    }

    // Update required approvals threshold
    function updateRequiredApprovals(uint256 _newRequiredApprovals) external onlyOwner {
        require(_newRequiredApprovals > 0, "Must require at least one approval");
        require(_newRequiredApprovals <= authorities.length, "Cannot require more approvals than existing authorities");
        
        requiredApprovals = _newRequiredApprovals;
    }

    // Allow public deposits into the treasury
    function depositFunds() external payable {
        require(msg.value > 0, "Deposit must be greater than zero");
        fundBalance += msg.value;
        
        emit FundsDeposited(msg.sender, msg.value);
    }

    // Submit a new spending proposal (can be done by anyone)
    function submitProposal(string memory _description, uint256 _amount, address payable _recipient) external {
        require(_amount > 0, "Requested amount must be greater than zero");
        require(_recipient != address(0), "Invalid recipient address");
        
        proposalCount++;
        
        // Create new proposal
        Proposal storage newProposal = proposals[proposalCount];
        newProposal.id = proposalCount;
        newProposal.description = _description;
        newProposal.amount = _amount;
        newProposal.recipient = _recipient;
        newProposal.approvalCount = 0;
        newProposal.approved = false;
        newProposal.executed = false;
        newProposal.createdAt = block.timestamp;
        
        emit ProposalSubmitted(proposalCount, _description, _amount, _recipient);
    }

    // Vote on a proposal (only authorities can vote)
    function voteOnProposal(uint256 _proposalId) external onlyAuthority proposalExists(_proposalId) notExecuted(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        // Check if authority has already voted
        require(!proposal.hasVoted[msg.sender], "Authority has already voted on this proposal");
        
        // Record the vote
        proposal.hasVoted[msg.sender] = true;
        proposal.approvalCount++;
        
        emit AuthorityVoted(_proposalId, msg.sender);
        
        // Check if proposal has reached required approvals
        if (proposal.approvalCount >= requiredApprovals) {
            proposal.approved = true;
            emit ProposalApproved(_proposalId);
        }
    }

    // Release funds for an approved proposal
    function releaseFunds(uint256 _proposalId) external proposalExists(_proposalId) notExecuted(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        
        require(proposal.approved, "Proposal is not approved");
        require(proposal.amount <= address(this).balance, "Insufficient funds in treasury");
        
        // Mark as executed before transfer to prevent reentrancy attacks
        proposal.executed = true;
        fundBalance -= proposal.amount;
        
        // Transfer funds to recipient
        proposal.recipient.transfer(proposal.amount);
        
        emit FundsReleased(_proposalId, proposal.recipient, proposal.amount);
    }

    // Get current treasury balance
    function getTreasuryBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Get the number of authorities
    function getAuthorityCount() external view returns (uint256) {
        return authorities.length;
    }

    // Check if an address has voted on a specific proposal
    function hasVoted(uint256 _proposalId, address _authority) external view proposalExists(_proposalId) returns (bool) {
        return proposals[_proposalId].hasVoted[_authority];
    }

    // Get proposal approval count
    function getApprovalCount(uint256 _proposalId) external view proposalExists(_proposalId) returns (uint256) {
        return proposals[_proposalId].approvalCount;
    }
    
    // Get list of all authorities
    function getAllAuthorities() external view returns (address[] memory) {
        return authorities;
    }
}