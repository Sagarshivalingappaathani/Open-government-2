const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("VotingSystem", function () {
  let VotingSystem;
  let votingSystem;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // Get the ContractFactory and Signers
    VotingSystem = await ethers.getContractFactory("VotingSystem");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy a new VotingSystem contract before each test
    votingSystem = await VotingSystem.deploy();
  });

  describe("Election Creation", function () {
    it("Should create a new election correctly", async function () {
      await expect(votingSystem.createElection("Presidential Election"))
        .to.emit(votingSystem, "ElectionCreated")
        .withArgs(1, "Presidential Election", owner.address);

      const electionCount = await votingSystem.electionCount();
      expect(electionCount).to.equal(1);
    });

    it("Should allow multiple elections to be created", async function () {
      await votingSystem.createElection("Election 1");
      await votingSystem.createElection("Election 2");
      
      const electionCount = await votingSystem.electionCount();
      expect(electionCount).to.equal(2);
    });
  });

  describe("Candidate Management", function () {
    let electionId;

    beforeEach(async function () {
      await votingSystem.createElection("Test Election");
      electionId = 1;
    });

    it("Should add a candidate correctly", async function () {
      await expect(votingSystem.addCandidate(electionId, "Candidate 1"))
        .to.emit(votingSystem, "CandidateAdded")
        .withArgs(electionId, 1, "Candidate 1");
    });

    it("Should add multiple candidates", async function () {
      await votingSystem.addCandidate(electionId, "Candidate 1");
      await votingSystem.addCandidate(electionId, "Candidate 2");
      await votingSystem.addCandidate(electionId, "Candidate 3");
      
      // We can't directly check candidateCount since it's inside a mapping
      // We'll verify through voting and results later
    });

    it("Should not allow non-admin to add candidates", async function () {
      await expect(
        votingSystem.connect(addr1).addCandidate(electionId, "Unauthorized Candidate")
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("Should not allow adding candidates to non-existent elections", async function () {
      await expect(
        votingSystem.addCandidate(999, "Invalid Election")
      ).to.be.revertedWith("Election does not exist");
    });

    it("Should not allow adding candidates after election has started", async function () {
      await votingSystem.addCandidate(electionId, "Candidate 1");
      await votingSystem.startElection(electionId);
      
      await expect(
        votingSystem.addCandidate(electionId, "Late Candidate")
      ).to.be.revertedWith("Cannot add candidates after election has started");
    });
  });

  describe("Election Management", function () {
    let electionId;

    beforeEach(async function () {
      await votingSystem.createElection("Test Election");
      electionId = 1;
      await votingSystem.addCandidate(electionId, "Candidate 1");
      await votingSystem.addCandidate(electionId, "Candidate 2");
    });

    it("Should start an election correctly", async function () {
      await expect(votingSystem.startElection(electionId))
        .to.emit(votingSystem, "ElectionStarted")
        .withArgs(electionId);
    });

    it("Should not allow non-admin to start an election", async function () {
      await expect(
        votingSystem.connect(addr1).startElection(electionId)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("Should not allow starting a non-existent election", async function () {
      await expect(
        votingSystem.startElection(999)
      ).to.be.revertedWith("Election does not exist");
    });

    it("Should not allow starting an already started election", async function () {
      await votingSystem.startElection(electionId);
      
      await expect(
        votingSystem.startElection(electionId)
      ).to.be.revertedWith("Election is already active");
    });

    it("Should not allow starting a completed election", async function () {
      await votingSystem.startElection(electionId);
      await votingSystem.stopElection(electionId);
      
      await expect(
        votingSystem.startElection(electionId)
      ).to.be.revertedWith("Election has already been completed");
    });

    it("Should stop an election correctly", async function () {
      await votingSystem.startElection(electionId);
      
      await expect(votingSystem.stopElection(electionId))
        .to.emit(votingSystem, "ElectionStopped")
        .withArgs(electionId)
        .and.to.emit(votingSystem, "ResultsStored")
        .withArgs(electionId);
    });

    it("Should not allow non-admin to stop an election", async function () {
      await votingSystem.startElection(electionId);
      
      await expect(
        votingSystem.connect(addr1).stopElection(electionId)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("Should not allow stopping a non-active election", async function () {
      await expect(
        votingSystem.stopElection(electionId)
      ).to.be.revertedWith("Election is not active");
    });
  });

  describe("Voting Process", function () {
    let electionId;

    beforeEach(async function () {
      await votingSystem.createElection("Test Election");
      electionId = 1;
      await votingSystem.addCandidate(electionId, "Candidate 1");
      await votingSystem.addCandidate(electionId, "Candidate 2");
    });

    it("Should allow a user to vote", async function () {
      await votingSystem.startElection(electionId);
      
      await expect(votingSystem.connect(addr1).vote(electionId, 1))
        .to.emit(votingSystem, "Voted")
        .withArgs(electionId, 1, addr1.address);
    });

    it("Should not allow voting in a non-existent election", async function () {
      await expect(
        votingSystem.vote(999, 1)
      ).to.be.revertedWith("Election does not exist");
    });

    it("Should not allow voting if election is not active", async function () {
      await expect(
        votingSystem.connect(addr1).vote(electionId, 1)
      ).to.be.revertedWith("Election is not active");
    });

    it("Should not allow voting if election is completed", async function () {
      await votingSystem.startElection(electionId);
      await votingSystem.stopElection(electionId);
      
      await expect(
        votingSystem.vote(electionId, 1)
      ).to.be.revertedWith("Election is already completed");
    });

    it("Should not allow voting for an invalid candidate", async function () {
      await votingSystem.startElection(electionId);
      
      await expect(
        votingSystem.vote(electionId, 999)
      ).to.be.revertedWith("Invalid candidate");
    });

    it("Should not allow a user to vote twice", async function () {
      await votingSystem.startElection(electionId);
      
      await votingSystem.connect(addr1).vote(electionId, 1);
      
      await expect(
        votingSystem.connect(addr1).vote(electionId, 2)
      ).to.be.revertedWith("You have already voted");
    });

    it("Should record votes correctly", async function () {
      await votingSystem.startElection(electionId);
      
      await votingSystem.connect(addr1).vote(electionId, 1);
      await votingSystem.connect(addr2).vote(electionId, 2);
      await votingSystem.connect(addrs[0]).vote(electionId, 1);
      
      await votingSystem.stopElection(electionId);
      
      const results = await votingSystem.getResults(electionId);
      expect(results[0]).to.equal("Test Election");
      expect(results[1]).to.deep.equal([1n, 2n]);
      expect(results[2]).to.deep.equal(["Candidate 1", "Candidate 2"]);
      expect(results[3]).to.deep.equal([2n, 1n]);
    });

    it("Should not allow voting if election is not active", async function () {
      // Try to vote without starting the election
      await expect(
        votingSystem.connect(addr1).vote(electionId, 1)
      ).to.be.revertedWith("Election is not active");
    });
  });

  describe("Results Retrieval", function () {
    let electionId;

    beforeEach(async function () {
      await votingSystem.createElection("Test Election");
      electionId = 1;
      await votingSystem.addCandidate(electionId, "Candidate 1");
      await votingSystem.addCandidate(electionId, "Candidate 2");
      await votingSystem.startElection(electionId);
      
      await votingSystem.connect(addr1).vote(electionId, 1);
      await votingSystem.connect(addr2).vote(electionId, 2);
      
      await votingSystem.stopElection(electionId);
    });

    it("Should provide correct election results", async function () {
      const results = await votingSystem.getResults(electionId);
      
      expect(results[0]).to.equal("Test Election");
      expect(results[1][0]).to.equal(1);  // First candidate ID
      expect(results[1][1]).to.equal(2);  // Second candidate ID
      expect(results[2][0]).to.equal("Candidate 1");
      expect(results[2][1]).to.equal("Candidate 2");
      expect(results[3][0]).to.equal(1);  // First candidate vote count
      expect(results[3][1]).to.equal(1);  // Second candidate vote count
    });

    it("Should not allow viewing results of an incomplete election", async function () {
      await votingSystem.createElection("Ongoing Election");
      const ongoingElectionId = 2;
      await votingSystem.addCandidate(ongoingElectionId, "Candidate A");
      await votingSystem.startElection(ongoingElectionId);
      
      await expect(
        votingSystem.getResults(ongoingElectionId)
      ).to.be.revertedWith("Election is not completed yet");
    });

    it("Should handle elections with no votes correctly", async function () {
      await votingSystem.createElection("Empty Election");
      const emptyElectionId = 2;
      await votingSystem.addCandidate(emptyElectionId, "Lonely Candidate");
      await votingSystem.startElection(emptyElectionId);
      await votingSystem.stopElection(emptyElectionId);
      
      const results = await votingSystem.getResults(emptyElectionId);
      expect(results[0]).to.equal("Empty Election");
      expect(results[1][0]).to.equal(1);
      expect(results[2][0]).to.equal("Lonely Candidate");
      expect(results[3][0]).to.equal(0);  // Zero votes
    });
  });

  describe("Integration Tests", function () {
    it("Should handle the full election lifecycle", async function () {
      // Create election
      await votingSystem.createElection("Presidential Election");
      const electionId = 1;
      
      // Add candidates
      await votingSystem.addCandidate(electionId, "Candidate A");
      await votingSystem.addCandidate(electionId, "Candidate B");
      await votingSystem.addCandidate(electionId, "Candidate C");
      
      // Start election
      await votingSystem.startElection(electionId);
      
      // Multiple users vote
      await votingSystem.connect(addr1).vote(electionId, 1);
      await votingSystem.connect(addr2).vote(electionId, 2);
      await votingSystem.connect(addrs[0]).vote(electionId, 3);
      await votingSystem.connect(addrs[1]).vote(electionId, 1);
      await votingSystem.connect(addrs[2]).vote(electionId, 1);
      
      // Stop election
      await votingSystem.stopElection(electionId);
      
      // Get and verify results
      const results = await votingSystem.getResults(electionId);
      
      expect(results[0]).to.equal("Presidential Election");
      expect(results[1].length).to.equal(3);
      expect(results[2]).to.deep.equal(["Candidate A", "Candidate B", "Candidate C"]);
      expect(results[3][0]).to.equal(3);  // Candidate A votes
      expect(results[3][1]).to.equal(1);  // Candidate B votes
      expect(results[3][2]).to.equal(1);  // Candidate C votes
    });

    it("Should handle multiple elections concurrently", async function () {
      // Create two elections
      await votingSystem.createElection("School Election");
      const schoolElectionId = 1;
      
      await votingSystem.createElection("City Election");
      const cityElectionId = 2;
      
      // Set up School Election
      await votingSystem.addCandidate(schoolElectionId, "Student A");
      await votingSystem.addCandidate(schoolElectionId, "Student B");
      await votingSystem.startElection(schoolElectionId);
      
      // Set up City Election
      await votingSystem.addCandidate(cityElectionId, "Mayor A");
      await votingSystem.addCandidate(cityElectionId, "Mayor B");
      await votingSystem.startElection(cityElectionId);
      
      // People vote in both elections
      await votingSystem.connect(addr1).vote(schoolElectionId, 1);
      await votingSystem.connect(addr1).vote(cityElectionId, 2);
      
      await votingSystem.connect(addr2).vote(schoolElectionId, 2);
      await votingSystem.connect(addr2).vote(cityElectionId, 1);
      
      // Finish school election
      await votingSystem.stopElection(schoolElectionId);
      
      // Verify school results
      const schoolResults = await votingSystem.getResults(schoolElectionId);
      expect(schoolResults[0]).to.equal("School Election");
      expect(schoolResults[2]).to.deep.equal(["Student A", "Student B"]);
      expect(schoolResults[3][0]).to.equal(1);
      expect(schoolResults[3][1]).to.equal(1);
      
      // Finish city election
      await votingSystem.stopElection(cityElectionId);
      
      // Verify city results
      const cityResults = await votingSystem.getResults(cityElectionId);
      expect(cityResults[0]).to.equal("City Election");
      expect(cityResults[2]).to.deep.equal(["Mayor A", "Mayor B"]);
      expect(cityResults[3][0]).to.equal(1);
      expect(cityResults[3][1]).to.equal(1);
    });
  });
});