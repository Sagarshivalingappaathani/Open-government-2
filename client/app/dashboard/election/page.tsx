// pages/voting.tsx
"use client"
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getContract } from '@/lib/votingContract';
import { getSBTContract } from '@/lib/sbtTokenContract';
import { Contract, ethers } from 'ethers';

// Define contract interfaces
interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}

interface Election {
  id: number;
  name: string;
  admin: string;
  isActive: boolean;
  isCompleted: boolean;
  candidateCount: number;
  startTime: number;
  endTime: number;
  voterCount: number;
  candidates?: Candidate[];
}

interface SBTApplication {
  hasApplied: boolean;
  isRegistered: boolean;
}

const VotingPage: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [account, setAccount] = useState<string>('');
  const [admin, setAdmin] = useState<string>('');
  const [contract, setContract] = useState<Contract | null>(null);
  const [sbtContract, setSbtContract] = useState<Contract | null>(null);
  const [newElectionName, setNewElectionName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // SBT Application states
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [userApplication, setUserApplication] = useState<SBTApplication | null>(null);
  const [sbtLoading, setSbtLoading] = useState<boolean>(false);

  // Connect to wallet and get contracts
  const connectWallet = async () => {
    setError('');
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
  
        const zkVotingContract = await getContract();
        setContract(zkVotingContract);

        const sbtTokenContract: Contract = await getSBTContract();
        setSbtContract(sbtTokenContract);
        const contractAdmin = await sbtTokenContract.getAdminAddress();
        console.log(contractAdmin)
        setAdmin(contractAdmin);
        console.log(contractAdmin);

        window.ethereum.on('accountsChanged', (accounts: string[]) => {
          setAccount(accounts[0]);
        });
      } else {
        setError('Please install MetaMask to use this application');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
  };

  // Create new election
  const createElection = async () => {
    setError('');
    setSuccess('');

    if (!newElectionName.trim()) {
      setError('Please enter an election name');
      return;
    }

    if (!contract) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      const tx = await contract.createElection(newElectionName);
      await tx.wait();
      setSuccess(`Election "${newElectionName}" created successfully!`);
      setNewElectionName('');
      fetchElections();
    } catch (err: any) {
      setError(err.message || 'Failed to create election');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all elections
  const fetchElections = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      const electionCount = await contract.electionCount();
      console.log(electionCount)
      const electionsList: Election[] = [];

      for (let i = 1; i <= electionCount; i++) {
        // Get basic election data
        const election = await contract.elections(i);

        // Get candidates data
        const [ids, names, voteCounts] = await contract.getCandidates(i);
        const candidates: Candidate[] = ids.map((id: any, index: number) => ({
          id: Number(id),
          name: names[index],
          voteCount: Number(voteCounts[index])
        }));

        electionsList.push({
          id: i,
          name: election.name,
          admin: election.admin,
          isActive: election.isActive,
          isCompleted: election.isCompleted,
          candidateCount: Number(election.candidateCount),
          startTime: Number(election.startTime),
          endTime: Number(election.endTime),
          voterCount: Number(election.voterCount),
          candidates
        });
      }

      setElections(electionsList);
    } catch (err: any) {
      console.error('Error fetching elections:', err);
      setError('Failed to load elections');
    } finally {
      setLoading(false);
    }
  };

  // Check SBT application status
  const checkSBTStatus = async () => {
    if (!sbtContract || !account) return;

    try {
      setSbtLoading(true);
      const [hasApplied, isRegistered] = await sbtContract.getApplicationStatus(account);
      setUserApplication({
        hasApplied,
        isRegistered
      });
      console.log(hasApplied, isRegistered);
    } catch (err) {
      console.error('Error checking SBT status:', err);
      setUserApplication(null);
    } finally {
      setSbtLoading(false);
    }
  };

  // Generate and apply for SBT token
  const applySBT = async () => {
    setError('');
    setSuccess('');

    if (!sbtContract) {
      setError('Please connect your wallet first');
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSbtLoading(true);

      // Create a voter hash using keccak256 of fullName + email + address
      const dataToHash = ethers.solidityPacked(
        ['string', 'string', 'address'],
        [fullName, email, account]
      );
      const voterHash = ethers.keccak256(dataToHash);

      // Generate a random nullifier
      const nullifier = ethers.randomBytes(32);

      // Call the contract method
      const tx = await sbtContract.applyForSBT(voterHash);
      await tx.wait();

      setSuccess('Your SBT application has been submitted successfully!');
      setFullName('');
      setEmail('');

      // Refresh the application status
      checkSBTStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to submit SBT application');
    } finally {
      setSbtLoading(false);
    }
  };

  const getApplications = async () => {
    if (!sbtContract) return;
    const applications = await sbtContract.getApplications();
    console.log(applications);
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Not set';
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Get election status
  const getElectionStatus = (election: Election) => {
    if (election.isCompleted) return "Completed";
    if (election.isActive) return "Active";
    return "Pending";
  };

  // Connect wallet and fetch data on component mount
  useEffect(() => {
    connectWallet().then(() => {
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  // Fetch elections when contract is available
  useEffect(() => {
    if (contract) {
      console.log(contract)
      fetchElections();
    }
  }, [contract]);

  // Check SBT status when sbtContract and account are available
  useEffect(() => {
    if (sbtContract && account) {
      checkSBTStatus();
    }
  }, [sbtContract, account]);

  // Helper function to get SBT application status text
  const getSBTStatusText = () => {
    if (!userApplication) return "Not Applied";
    if (userApplication.hasApplied) return "Applied";
    if (userApplication.isRegistered) return "Registered";
    return "Pending Approval";
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">ZK Voting System</h1>

      {/* Wallet Connection Status */}
      <div className="flex justify-between items-center mb-6">
        <div>
          {account ? (
            <p className="text-sm">
              Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}
            </p>
          ) : (
            <p className="text-sm">Not connected</p>
          )}
        </div>
        <Button
          onClick={connectWallet}
          variant={account ? "outline" : "default"}
        >
          {account ? "Connected" : "Connect Wallet"}
        </Button>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="elections" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="elections">Elections List</TabsTrigger>
          <TabsTrigger value="create">Create Election</TabsTrigger>
          <TabsTrigger value="sbt">SBT Application</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        {/* Elections List Tab */}
        <TabsContent value="elections">
          <Card>
            <CardHeader>
              <CardTitle>All Elections</CardTitle>
              <CardDescription>
                View all available elections and their details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading elections...</div>
              ) : elections.length === 0 ? (
                <div className="text-center py-8">No elections found. Create one!</div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {elections.map((election) => (
                      <Card key={election.id} className="border-gray-200">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-lg">{election.name}</CardTitle>
                            <span className={`px-2 py-1 text-xs rounded-full ${election.isCompleted
                              ? 'bg-gray-100 text-gray-700'
                              : election.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                              }`}>
                              {getElectionStatus(election)}
                            </span>
                          </div>
                          <CardDescription>
                            ID: {election.id} | Candidates: {election.candidateCount} | Votes: {election.voterCount}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2 pt-0">
                          <div className="text-sm space-y-1">
                            <p>Admin: {election.admin.substring(0, 6)}...{election.admin.substring(election.admin.length - 4)}</p>
                            <p>Start: {formatTime(election.startTime)}</p>
                            <p>End: {formatTime(election.endTime)}</p>
                          </div>

                          {election.candidates && election.candidates.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-sm font-medium mb-2">Candidates:</p>
                              <div className="space-y-1">
                                {election.candidates.map(candidate => (
                                  <div key={candidate.id} className="flex justify-between text-sm">
                                    <span>{candidate.name}</span>
                                    <span>{candidate.voteCount} votes</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          {account === election.admin && !election.isActive && !election.isCompleted && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  if (contract) {
                                    const tx = await contract.startElection(election.id);
                                    await tx.wait();
                                    setSuccess(`Election "${election.name}" started successfully!`);
                                    fetchElections();
                                  }
                                } catch (err: any) {
                                  setError(err.message || 'Failed to start election');
                                }
                              }}
                            >
                              Start Election
                            </Button>
                          )}

                          {account === election.admin && election.isActive && !election.isCompleted && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  if (contract) {
                                    const tx = await contract.stopElection(election.id);
                                    await tx.wait();
                                    setSuccess(`Election "${election.name}" stopped successfully!`);
                                    fetchElections();
                                  }
                                } catch (err: any) {
                                  setError(err.message || 'Failed to stop election');
                                }
                              }}
                            >
                              Stop Election
                            </Button>
                          )}

                          {account === election.admin && !election.isActive && !election.isCompleted && (
                            <Button
                              size="sm"
                              onClick={() => {
                                // This would open a modal for adding candidates
                                // You can implement this functionality later
                                setError('Adding candidates feature will be implemented soon');
                              }}
                            >
                              Add Candidate
                            </Button>
                          )}

                          {election.isActive && (
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!userApplication || !userApplication.isRegistered) {
                                  setError('You need an approved SBT token to vote. Please apply for one first.');
                                  return;
                                }
                                // This would open a modal for voting
                                // You can implement this functionality later
                                setError('Voting feature will be implemented soon');
                              }}
                            >
                              Vote
                            </Button>
                          )}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={fetchElections}
                variant="outline"
                className="w-full"
                disabled={loading || !account}
              >
                Refresh Elections
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Create Election Tab */}
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create New Election</CardTitle>
              <CardDescription>
                Set up a new election with a unique name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="election-name">Election Name</Label>
                  <Input
                    id="election-name"
                    placeholder="Enter election name"
                    value={newElectionName}
                    onChange={(e) => setNewElectionName(e.target.value)}
                    disabled={loading || !account}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={createElection}
                className="w-full"
                disabled={loading || !account || !newElectionName.trim()}
              >
                {loading ? "Creating..." : "Create Election"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* SBT Application Tab */}
        <TabsContent value="sbt">
          <Card>
            <CardHeader>
              <CardTitle>SBT Token Application</CardTitle>
              <CardDescription>
                Apply for a Soul Bound Token (SBT) to participate in voting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!account ? (
                <div className="text-center py-4">
                  Please connect your wallet to apply for an SBT token.
                </div>
              ) : sbtLoading ? (
                <div className="text-center py-4">Loading your SBT status...</div>
              ) : userApplication?.isRegistered ? (
                <div className="p-4 rounded text-center bg-green-50 border border-green-200 text-green-800">
                  <p className="font-medium">Your application has been approved! You can now participate in voting.</p>
                </div>
              ) : userApplication?.hasApplied ? (
                <div className="p-4 rounded text-center bg-yellow-50 border border-yellow-200 text-yellow-800">
                  <p className="font-medium">Your application is being reviewed. Please check back later.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input
                      id="full-name"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded">
                    <p className="text-sm">
                      <strong>Note:</strong> This information is used only to generate a unique voter hash.
                      Your email is not stored on the blockchain.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            {!userApplication?.hasApplied && account && (
              <CardFooter>
                <Button
                  onClick={applySBT}
                  className="w-full"
                  disabled={sbtLoading || !account || !fullName.trim() || !email.trim()}
                >
                  {sbtLoading ? "Submitting..." : "Apply for SBT Token"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default VotingPage;