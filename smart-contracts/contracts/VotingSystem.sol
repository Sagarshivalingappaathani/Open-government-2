// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VotingSystem {
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
        mapping(uint => Candidate) candidates;
        mapping(address => bool) hasVoted;
        address[] voters;
    }

    uint public electionCount;
    mapping(uint => Election) public elections;

    event ElectionCreated(uint electionId, string name, address admin);
    event CandidateAdded(uint electionId, uint candidateId, string name);
    event ElectionStarted(uint electionId);
    event ElectionStopped(uint electionId);
    event Voted(uint electionId, uint candidateId, address voter);
    event ResultsStored(uint electionId);

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

    function createElection(string memory _name) public {
        electionCount++;
        Election storage newElection = elections[electionCount];
        newElection.name = _name;
        newElection.admin = msg.sender;
        newElection.isActive = false;
        newElection.isCompleted = false;

        emit ElectionCreated(electionCount, _name, msg.sender);
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

        emit CandidateAdded(_electionId, election.candidateCount, _name);
    }

    function startElection(
        uint _electionId
    ) public electionExists(_electionId) onlyAdmin(_electionId) {
        Election storage election = elections[_electionId];
        require(!election.isActive, "Election is already active");
        require(!election.isCompleted, "Election has already been completed");

        election.isActive = true;
        emit ElectionStarted(_electionId);
    }

    function vote(
        uint _electionId,
        uint _candidateId
    ) public electionExists(_electionId) {
        Election storage election = elections[_electionId];

        require(!election.isCompleted, "Election is already completed");
        require(election.isActive, "Election is not active");
        require(!election.hasVoted[msg.sender], "You have already voted");
        require(
            _candidateId > 0 && _candidateId <= election.candidateCount,
            "Invalid candidate"
        );

        election.hasVoted[msg.sender] = true;
        election.candidates[_candidateId].voteCount++;
        election.voters.push(msg.sender); // Add voter address here

        emit Voted(_electionId, _candidateId, msg.sender);
    }

    function stopElection(
        uint _electionId
    ) public onlyAdmin(_electionId) electionExists(_electionId) {
        Election storage election = elections[_electionId];
        require(election.isActive, "Election is not active");

        election.isActive = false;
        election.isCompleted = true;

        emit ElectionStopped(_electionId);
        emit ResultsStored(_electionId);
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

    function getVoters(
        uint _electionId
    ) public view electionExists(_electionId) returns (address[] memory) {
        return elections[_electionId].voters;
    }

    function getResults(
        uint _electionId
    )
        public
        view
        electionExists(_electionId)
        returns (string memory, uint[] memory, string[] memory, uint[] memory)
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

        return (election.name, ids, names, voteCounts);
    }
}
