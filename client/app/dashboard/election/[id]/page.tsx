"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Contract, BigNumberish, ethers } from "ethers";
import { Toaster, toast } from "react-hot-toast";
import { getContract } from "@/lib/votingContract";
import { getSBTContract } from "@/lib/sbtTokenContract";
import Link from "next/link";
import { generateZKProof } from "@/lib/zkUtils";

// Component for loading spinner
const Loader = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
  </div>
);

// Button component with loading state
const Button: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ onClick, disabled = false, loading = false, className = "", children }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`px-4 py-2 rounded ${disabled ? "bg-gray-300 cursor-not-allowed" : "bg-black text-white hover:bg-gray-800"
      } transition-colors ${className}`}
  >
    {loading ? <Loader /> : children}
  </button>
);

// Define types for candidates and election details
interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}

interface ElectionDetails {
  name: string;
  isActive: boolean;
  isCompleted: boolean;
  startTime: number;
  endTime: number;
  candidates: Candidate[];
  voterCount: number;
}

export default function ElectionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [electionId, setElectionId] = useState<number | null>(null);
  const [electionDetails, setElectionDetails] = useState<ElectionDetails>({
    name: "",
    isActive: false,
    isCompleted: false,
    startTime: 0,
    endTime: 0,
    candidates: [],
    voterCount: 0,
  });
  const [newCandidateName, setNewCandidateName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userAddress, setUserAddress] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [votingContract, setVotingContract] = useState<Contract | null>(null);
  const [voterSBTContract, setVoterSBTContract] = useState<Contract | null>(null);
  const [tokenId, setTokenId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);
  const [isStartingElection, setIsStartingElection] = useState(false);
  const [isStoppingElection, setIsStoppingElection] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  // Generate a random nullifier hash for the user (in a real app, this would be derived from a commitment)
  const [nullifierHash, setNullifierHash] = useState<bigint | null>(null);

  useEffect(() => {
    if (params.id) {
      const id = typeof params.id === 'string' ? Number(params.id) : Number(params.id[0]);
      setElectionId(id);
      initializeContract();
    }
  }, [params.id]);

  const initializeContract = async () => {
    try {
      setIsLoading(true);
      const contract = await getContract();
      setVotingContract(contract);
      const sbtContract = await getSBTContract();
      setVoterSBTContract(sbtContract);
      // Get user address
      if (typeof window !== 'undefined' && window.ethereum) {
        // @ts-ignore - ethereum property might not be recognized
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        const userAddr = accounts[0].address;
        setUserAddress(userAddr);
        const id = typeof params.id === 'string' ? Number(params.id) : Number(params.id[0]);
        await loadElectionDetails(contract, sbtContract, id, userAddr);
        
      }
    } catch (error) {
      console.error("Failed to initialize:", error);
      toast.error("Failed to load election details");
    } finally {
      setIsLoading(false);
    }
  };

  const loadElectionDetails = async (contract: Contract, sbtContract: Contract, id: number, userAddr: string) => {
    try {
      // Load election basic info
      const election = await contract.elections(id);
      // Check if user is admin
      const admin = election.admin;
      setIsAdmin(admin.toLowerCase() === userAddr.toLowerCase());

      // Get candidates
      const [ids, names, voteCounts] = await contract.getCandidates(id);
      const candidatesList = ids.map((id: bigint, index: number) => ({
        id: Number(id),
        name: names[index],
        voteCount: election.isCompleted ? Number(voteCounts[index]) : 0,
      }));

      // Get voter count
      const voterCount = await contract.getVoterCount(id);
      // Get election times
      const [startTime, endTime] = await contract.getElectionTimes(id);

      setElectionDetails({
        name: election.name,
        isActive: election.isActive,
        isCompleted: election.isCompleted,
        startTime: Number(startTime), // Works for bigint
        endTime: Number(endTime),
        candidates: candidatesList,
        voterCount: Number(voterCount), // Assuming voterCount is still a BigNumber
      });

      const isRegistered = await sbtContract.isRegisteredVoter(userAddr);
      console.log("isRegistered", isRegistered);
      console.log("userAddr", userAddr);
      console.log("id", id);

      if (isRegistered) {
        const userNullifier = await sbtContract.getNullifierByAddress(userAddr);
        if (userNullifier) {
          setNullifierHash(userNullifier);
          const isVoted = await contract.isVoted(id, userNullifier);
          console.log("isVoted", isVoted);
          setHasVoted(isVoted);
        }
      }

    } catch (error) {
      console.error("Error loading election details:", error);
      toast.error("Failed to load election details");
    }
  };

  const handleAddCandidate = async () => {``
    if (!newCandidateName.trim()) {
      toast.error("Candidate name cannot be empty");
      return;
    }

    if (!votingContract) {
      toast.error("Contract not initialized");
      return;
    }

    try {
      setIsAddingCandidate(true);
      const tx = await votingContract.addCandidate(electionId, newCandidateName);
      toast.loading("Adding candidate...");
      await tx.wait();
      toast.dismiss();
      toast.success("Candidate added successfully");
      setNewCandidateName("");
      await loadElectionDetails(votingContract, voterSBTContract as Contract, electionId as number, userAddress);
    } catch (error) {
      console.error("Error adding candidate:", error);
      toast.error("Failed to add candidate");
    } finally {
      setIsAddingCandidate(false);
    }
  };

  const handleStartElection = async () => {
    if (!votingContract || electionId === null) {
      toast.error("Contract not initialized");
      return;
    }

    try {
      setIsStartingElection(true);
      const tx = await votingContract.startElection(electionId);
      toast.loading("Starting election...");
      await tx.wait();
      toast.dismiss();
      toast.success("Election started successfully");
      await loadElectionDetails(votingContract, voterSBTContract as Contract, electionId as number, userAddress);
    } catch (error) {
      console.error("Error starting election:", error);
      toast.error("Failed to start election");
    } finally {
      setIsStartingElection(false);
    }
  };

  const handleStopElection = async () => {
    if (!votingContract || electionId === null) {
      toast.error("Contract not initialized");
      return;
    }

    try {
      setIsStoppingElection(true);
      const tx = await votingContract.stopElection(electionId);
      toast.loading("Ending election...");
      await tx.wait();
      toast.dismiss();
      toast.success("Election ended successfully");
      await loadElectionDetails(votingContract, voterSBTContract as Contract, electionId, userAddress);
    } catch (error) {
      console.error("Error stopping election:", error);
      toast.error("Failed to end election");
    } finally {
      setIsStoppingElection(false);
    }
  };

  // Add this function to your ElectionDetailsPage component
  const handleVote = async (candidateId: number, electionId: number) => {
    if (!votingContract) {
      toast.error("Contract not initialized");
      return;
    }

    try {
      setIsVoting(true);
      toast.loading("Preparing your anonymous vote...");
      if (!voterSBTContract) {
        toast.error("SBT contract not initialized");
        return;
      }
      // 1. Get the user's SBT token ID - this should be kept private
      const tokenId = await voterSBTContract.getTokenIdByAddress(userAddress);
      setTokenId(tokenId);
      console.log("Generating zero-knowledge proof...");

      // 2. Generate ZK proof and nullifier hash
      const { proof, nullifierHash } = await generateZKProof(tokenId, electionId);
      const currentNullifierHash = await voterSBTContract.getNullifierByAddress(userAddress);
      console.log(proof);
      // 3. Prepare the proof for the contract
      // The zkVote function expects proof components (a, b, c) and the nullifier hash
      const tx = await votingContract.zkVote(
        electionId,
        candidateId,
        proof.a,
        proof.b,
        proof.c,
        currentNullifierHash
      );

      toast.dismiss();
      toast.loading("Casting your anonymous vote...");

      await tx.wait();

      toast.dismiss();
      toast.success("Vote cast successfully and anonymously!");

      // 4. Reload election details
      await loadElectionDetails(votingContract, voterSBTContract, electionId, userAddress);
      setHasVoted(true);
    } catch (error) {
      console.error("Error casting vote:", error);
      toast.dismiss();
      toast.error("An error occurred while casting your vote. Please try again.");
    } finally {
      setIsVoting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Not set";
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading election details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard/election" className="text-gray-600 hover:text-black">
          ← Back to Elections
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{electionDetails.name}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-600">Status:
              <span className={`ml-2 font-medium ${electionDetails.isCompleted ? "text-black" :
                electionDetails.isActive ? "text-green-600" : "text-yellow-600"
                }`}>
                {electionDetails.isCompleted ? "Completed" :
                  electionDetails.isActive ? "Active" : "Not Started"}
              </span>
            </p>
            <p className="text-gray-600">Total Voters: <span className="font-medium">{electionDetails.voterCount}</span></p>
          </div>
          <div>
            <p className="text-gray-600">Start Time: <span className="font-medium">{formatDate(electionDetails.startTime)}</span></p>
            <p className="text-gray-600">End Time: <span className="font-medium">{formatDate(electionDetails.endTime)}</span></p>
          </div>
        </div>

        {/* Admin Controls */}
        {isAdmin && !electionDetails.isActive && !electionDetails.isCompleted && (
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Admin Controls</h2>

            <div className="mb-4">
              <h3 className="font-medium mb-2">Add Candidate</h3>
              <div className="flex">
                <input
                  type="text"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  placeholder="Candidate Name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-1 focus:ring-black"
                />
                <Button
                  onClick={handleAddCandidate}
                  loading={isAddingCandidate}
                  className="rounded-l-none"
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <Button
                onClick={handleStartElection}
                loading={isStartingElection}
                disabled={electionDetails.candidates.length === 0}
              >
                Start Election
              </Button>
              {electionDetails.candidates.length === 0 && (
                <p className="text-red-500 text-sm mt-2">Add at least one candidate to start the election</p>
              )}
            </div>
          </div>
        )}

        {/* Admin Stop Controls */}
        {isAdmin && electionDetails.isActive && !electionDetails.isCompleted && (
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Admin Controls</h2>
            <Button
              onClick={handleStopElection}
              loading={isStoppingElection}
              className="bg-red-600 hover:bg-red-700"
            >
              End Election
            </Button>
          </div>
        )}

        {/* Election Not Started Message */}
        {!electionDetails.isActive && !electionDetails.isCompleted && !isAdmin && (
          <div className="bg-yellow-50 p-4 rounded-md mb-6 text-center">
            <p className="text-yellow-700">
              This election has not started yet. Please check back later.
            </p>
          </div>
        )}

        {/* Voting Interface */}
        {electionDetails.isActive && !electionDetails.isCompleted && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Cast Your Vote</h2>

            {hasVoted ? (
              <div className="bg-green-50 p-4 rounded-md text-center">
                <p className="text-green-700">
                  You have already cast your vote in this election. Thank you for participating!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {electionDetails.candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors"
                  >
                    <h3 className="font-medium mb-2">{candidate.name}</h3>
                    <Button
                      onClick={() => handleVote(candidate.id, electionId as number)}
                      loading={isVoting}
                      className="w-full"
                    >
                      Vote
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results Display */}
        {electionDetails.isCompleted && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Election Results</h2>

            <div className="mb-6">
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium mb-3">Final Tally</h3>
                <div className="space-y-4">
                  {electionDetails.candidates.map((candidate) => {
                    const percentage = electionDetails.voterCount > 0
                      ? ((candidate.voteCount / electionDetails.voterCount) * 100).toFixed(1)
                      : "0";

                    return (
                      <div key={candidate.id}>
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{candidate.name}</span>
                          <span>{candidate.voteCount} votes ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-black h-2.5 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-center">
              {(() => {
                // Find winner(s)
                if (electionDetails.voterCount === 0) {
                  return <p className="text-gray-600">No votes were cast in this election.</p>;
                }

                const maxVotes = Math.max(...electionDetails.candidates.map(c => c.voteCount));
                const winners = electionDetails.candidates.filter(c => c.voteCount === maxVotes);

                if (winners.length > 1) {
                  return (
                    <div>
                      <h3 className="text-xl font-bold mb-2">It's a tie!</h3>
                      <p>
                        {winners.map(w => w.name).join(' and ')} have tied with {maxVotes} votes each.
                      </p>
                    </div>
                  );
                } else if (winners.length === 1) {
                  return (
                    <div>
                      <h3 className="text-xl font-bold mb-2">Winner: {winners[0].name}</h3>
                      <p>With {winners[0].voteCount} votes ({((winners[0].voteCount / electionDetails.voterCount) * 100).toFixed(1)}%)</p>
                    </div>
                  );
                } else {
                  return <p className="text-gray-600">No candidates found.</p>;
                }
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}