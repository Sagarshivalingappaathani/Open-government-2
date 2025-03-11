// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) external view returns (bool);
}

contract ZKVotingSystem {
    // Reference to the SBT contract
    address public voterSBTAddress;
    // Reference to the ZKP verifier
    IVerifier public verifier;
    
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    struct Election {
        string name;
        address admin;
        bool isActive;
        bool isCompleted;
        uint candidateCount;
        uint256 startTime; // Timestamp when election starts
        uint256 endTime;   // Timestamp when election ends
        mapping(uint => Candidate) candidates;
        // Store nullifier hashes to prevent double voting without revealing identity
        mapping(bytes32 => bool) nullifierHashes;
        uint256 voterCount;
    }

    uint public electionCount;
    mapping(uint => Election) public elections;

    modifier onlyAdmin(uint _electionId) {
        require(
            msg.sender == elections[_electionId].admin,
            "Only admin can perform this action"
        );
        _;
    }

    modifier electionExists(uint _electionId) {
        require(
            bytes(elections[_electionId].name).length > 0,
            "Election does not exist"
        );
        _;
    }

    constructor(address _sbtAddress, address _verifierAddress) {
        voterSBTAddress = _sbtAddress;
        verifier = IVerifier(_verifierAddress);
    }

    function createElection(string memory _name) public {
        electionCount++;
        Election storage newElection = elections[electionCount];
        newElection.name = _name;
        newElection.admin = msg.sender;
        newElection.isActive = false;
        newElection.isCompleted = false;
        // Initialize timestamps to 0
        newElection.startTime = 0;
        newElection.endTime = 0;
    }

    function addCandidate(
        uint _electionId,
        string memory _name
    ) public electionExists(_electionId) onlyAdmin(_electionId) {
        Election storage election = elections[_electionId];
        require(
            !election.isActive,
            "Cannot add candidates after election has started"
        );

        election.candidateCount++;
        election.candidates[election.candidateCount] = Candidate(
            election.candidateCount,
            _name,
            0
        );
    }

    // Start election and record the start time
    function startElection(
        uint _electionId
    ) public electionExists(_electionId) onlyAdmin(_electionId) {
        Election storage election = elections[_electionId];
        require(!election.isActive, "Election is already active");
        require(!election.isCompleted, "Election has already been completed");

        election.isActive = true;
        election.startTime = block.timestamp;
    }

    // Anonymous voting using ZKP
    // Updated to match the ZoKrates verifier format and our vote.zok circuit
    function zkVote(
        uint _electionId,
        uint[2] memory _a,
        uint[2][2] memory _b,
        uint[2] memory _c,
        uint[2] memory _input // [nullifierHash, candidateId]
    ) public electionExists(_electionId) {
        Election storage election = elections[_electionId];

        require(!election.isCompleted, "Election is already completed");
        require(election.isActive, "Election is not active");
        
        // Extract nullifier hash and candidate ID from the proof's public inputs
        bytes32 nullifierHash = bytes32(_input[0]);
        uint candidateId = _input[1];
        
        require(!election.nullifierHashes[nullifierHash], "Vote with this nullifier already cast");
        require(
            candidateId > 0 && candidateId <= election.candidateCount,
            "Invalid candidate"
        );
        
        // Verify ZK proof
        // The ZoKrates verifier expects [nullifierHash, candidateId] as public inputs
        require(verifier.verifyProof(_a, _b, _c, _input), "Invalid zero-knowledge proof");

        // Register the vote
        election.nullifierHashes[nullifierHash] = true;
        election.candidates[candidateId].voteCount++;
        election.voterCount++;
    }

    // Stop election and record the end time
    function stopElection(
        uint _electionId
    ) public onlyAdmin(_electionId) electionExists(_electionId) {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");

        election.isActive = false;
        election.isCompleted = true;
        election.endTime = block.timestamp; // Set the end time when admin stops the election
    }

    function getCandidates(
        uint _electionId
    )
        public
        view
        electionExists(_electionId)
        returns (uint[] memory, string[] memory, uint[] memory)
    {
        Election storage election = elections[_electionId];
        uint candidateCount = election.candidateCount;

        uint[] memory ids = new uint[](candidateCount);
        string[] memory names = new string[](candidateCount);
        uint[] memory voteCounts = new uint[](candidateCount);

        for (uint i = 1; i <= candidateCount; i++) {
            Candidate storage candidate = election.candidates[i];
            ids[i - 1] = candidate.id;
            names[i - 1] = candidate.name;
            voteCounts[i - 1] = candidate.voteCount;
        }

        return (ids, names, voteCounts);
    }

    function getVoterCount(uint _electionId) public view electionExists(_electionId) returns (uint256) {
        return elections[_electionId].voterCount;
    }

    function getElectionTimes(uint _electionId) 
        public 
        view 
        electionExists(_electionId)
        returns (uint256 startTime, uint256 endTime) 
    {
        Election storage election = elections[_electionId];
        return (election.startTime, election.endTime);
    }

    function getResults(
        uint _electionId
    )
        public
        view
        electionExists(_electionId)
        returns (string memory, uint[] memory, string[] memory, uint[] memory, uint256, uint256)
    {
        Election storage election = elections[_electionId];
        require(election.isCompleted, "Election is not completed yet");

        uint candidateCount = election.candidateCount;
        uint[] memory ids = new uint[](candidateCount);
        string[] memory names = new string[](candidateCount);
        uint[] memory voteCounts = new uint[](candidateCount);

        for (uint i = 1; i <= candidateCount; i++) {
            Candidate storage candidate = election.candidates[i];
            ids[i - 1] = candidate.id;
            names[i - 1] = candidate.name;
            voteCounts[i - 1] = candidate.voteCount;
        }

        return (election.name, ids, names, voteCounts, election.startTime, election.endTime);
    }
}