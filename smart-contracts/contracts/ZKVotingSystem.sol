// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface IVoterSBT {
    function isRegisteredVoter(address voter) external view returns (bool);
    
}

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) external view returns (bool);
}

contract ZKVotingSystem {
    IVoterSBT public voterSBT;
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
        uint256 startTime;
        uint256 endTime;
        mapping(uint => Candidate) candidates;
        mapping(uint256 => bool) nullifierHashes;
        uint256 voterCount;
    }

    uint public electionCount;
    mapping(uint => Election) public elections;

    event VoteCast(uint indexed electionId, uint256 nullifierHash);
    event DebugLog(string message);

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
        voterSBT = IVoterSBT(_sbtAddress);
        verifier = IVerifier(_verifierAddress);
    }

    function createElection(string memory _name) public {
        electionCount++;
        Election storage newElection = elections[electionCount];
        newElection.name = _name;
        newElection.admin = msg.sender;
        newElection.isActive = false;
        newElection.isCompleted = false;
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

    function startElection(
        uint _electionId
    ) public electionExists(_electionId) onlyAdmin(_electionId) {
        Election storage election = elections[_electionId];
        require(!election.isActive, "Election is already active");
        require(!election.isCompleted, "Election has already been completed");

        election.isActive = true;
        election.startTime = block.timestamp;
    }

    function zkVote(
        uint _electionId,
        uint _candidateId,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint256 _nullifierHash
    ) public electionExists(_electionId) {
        console.log("Casting vote:");
        console.log("Election ID:", _electionId);
        console.log("Candidate ID:", _candidateId);
        console.log("Nullifier Hash:", _nullifierHash);
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");
        require(!election.isCompleted, "Election has already been completed");
        require(_candidateId > 0 && _candidateId <= election.candidateCount, "Invalid candidate ID");
        
        // Verify the nullifier hasn't been used before
        require(!election.nullifierHashes[_nullifierHash], "Vote already cast with this nullifier");
        
        // Prepare inputs for the verifier
        // The public inputs are the election ID and the nullifier hash
        //uint[2] memory input = [uint(_electionId), _nullifierHash];
        
        // Verify the zero-knowledge proof
        //require(verifier.verifyProof(a, b, c, input), "Invalid zero-knowledge proof");
        
        // Mark this nullifier as used
        election.nullifierHashes[_nullifierHash] = true;
        
        // Increment vote count for the candidate
        election.candidates[_candidateId].voteCount++;
        
        // Increment the voter count
        election.voterCount++;
        
        emit VoteCast(_electionId, _nullifierHash);
        emit DebugLog("Vote cast successfully");
    }

    function stopElection(
        uint _electionId
    ) public onlyAdmin(_electionId) electionExists(_electionId) {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");

        election.isActive = false;
        election.isCompleted = true;
        election.endTime = block.timestamp;
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

    function getVoterCount(
        uint _electionId
    ) public view electionExists(_electionId) returns (uint256) {
        return elections[_electionId].voterCount;
    }

    function getElectionTimes(
        uint _electionId
    )
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
        returns (
            string memory,
            uint[] memory,
            string[] memory,
            uint[] memory,
            uint256,
            uint256
        )
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

        return (
            election.name,
            ids,
            names,
            voteCounts,
            election.startTime,
            election.endTime
        );
    }

    function isVoted(uint _electionId, uint256 _nullifierHash) public view electionExists(_electionId) returns (bool) {
        console.log("Checking if voted:");
        console.log("Election ID:", _electionId);
        console.log("Nullifier Hash:", _nullifierHash);
        console.log("Nullifier Hash Exists:", elections[_electionId].nullifierHashes[_nullifierHash]);
        return elections[_electionId].nullifierHashes[_nullifierHash];
    }
}