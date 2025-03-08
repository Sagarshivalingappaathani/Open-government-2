'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getPublicFundingContract } from '@/lib/publicFundingContract';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Proposal {
  id: number;
  description: string;
  amount: bigint;
  recipient: string;
  votes: number;
  approved: boolean;
  executed: boolean;
  createdAt: number;
}

export default function FundManagementPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [treasuryBalance, setTreasuryBalance] = useState<bigint>(BigInt(0));
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [currentUserProposals, setCurrentUserProposals] = useState<Proposal[]>([]);
  const [depositAmount, setDepositAmount] = useState('');

  // New proposal form state
  const [newProposal, setNewProposal] = useState({
    description: '',
    amount: '',
    recipient: ''
  });

  // Loading states for transactions
  const [isDepositing, setIsDepositing] = useState(false);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [isVoting, setIsVoting] = useState<Record<number, boolean>>({});
  const [isReleasing, setIsReleasing] = useState<Record<number, boolean>>({});


  useEffect(() => {
    const initialize = async () => {
      try {
        if (typeof window.ethereum === "undefined") {
          toast.error("MetaMask not detected");
          setIsLoading(false);
          return;
        }

        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          await loadContractData();
        }

        // Subscribe to account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);

        setIsLoading(false);
      } catch (error) {
        console.error("Initialization failed:", error);
        toast.error("Failed to connect to blockchain.");
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      // Clean up event listeners
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setIsConnected(false);
      setAccount('');
      toast.error("Wallet disconnected");
    } else {
      setAccount(accounts[0]);
      setIsConnected(true);
      await loadContractData();
    }
  };

  const connectWallet = async () => {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      setIsConnected(true);
      await loadContractData();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toast.error("Could not connect to your wallet.");
    }
  };

  const loadContractData = async () => {
    try {
      setIsLoading(true);
      const contract = await getPublicFundingContract();
      const currentAccount = await window.ethereum.request({ method: "eth_accounts" });
      console.log(currentAccount);

      // Get treasury balance
      const balance = await contract.getTreasuryBalance();
      setTreasuryBalance(balance);

      // Get proposal count
      const count = await contract.proposalCount();

      // Fetch all proposals
      const fetchedProposals: Proposal[] = [];
      const currentUserProposals: Proposal[] = [];

      for (let i = 1; i <= Number(count); i++) {
        const proposal = await contract.getProposal(i);
        fetchedProposals.push({
          id: Number(proposal.id),
          description: proposal.description,
          amount: proposal.amount,
          recipient: proposal.recipient,
          votes: Number(proposal.votes),
          approved: proposal.approved,
          executed: proposal.executed,
          createdAt: Number(proposal.createdAt)
        });

        const user = currentAccount[0].toLowerCase();
        const recipient = proposal.recipient.toLowerCase();

        if (recipient === user) {
          currentUserProposals.push(proposal);
          console.log(proposal.votes);
        }
      }

      setProposals(fetchedProposals);
      setCurrentUserProposals(currentUserProposals);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load contract data:", error);
      toast.error("Could not load smart contract data.");
      setIsLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error("Please enter a valid amount to deposit.");
      return;
    }

    try {
      setIsDepositing(true);
      const contract = await getPublicFundingContract();
      const amountInWei = ethers.parseEther(depositAmount);

      const tx = await contract.depositFunds({ value: amountInWei });
      toast.success("Transaction Submitted");

      await tx.wait();
      toast.success(`Successfully deposited ${depositAmount} ETH.`);

      setDepositAmount('');
      await loadContractData();
    } catch (error) {
      console.error("Deposit failed:", error);
      toast.error("There was an error processing your deposit.");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleSubmitProposal = async () => {
    const { description, amount, recipient } = newProposal;

    if (!description || !amount || !recipient) {
      toast.error("Please fill in all proposal fields.");
      return;
    }

    if (!ethers.isAddress(recipient)) {
      toast.error("Please enter a valid Ethereum address.");
      return;
    }

    try {
      setIsSubmittingProposal(true);
      const contract = await getPublicFundingContract();
      const amountInWei = ethers.parseEther(amount);

      const tx = await contract.submitProposal(description, amountInWei, recipient);
      toast.success("Proposal Submitted");

      await tx.wait();
      toast.success("Proposal Created");

      setNewProposal({
        description: '',
        amount: '',
        recipient: ''
      });
      await loadContractData();
    } catch (error) {
      console.error("Proposal submission failed:", error);
      toast.error("Failed to submit your proposal.");
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleVoteOnProposal = async (proposalId: number) => {
    try {
      setIsVoting(prev => ({ ...prev, [proposalId]: true }));
      const contract = await getPublicFundingContract();

      const tx = await contract.voteOnProposal(proposalId);
      toast.success("Vote Submitted");

      await tx.wait();
      toast.success("Vote Successful");

      await loadContractData();
    } catch (error) {
      console.error("Voting failed:", error);
      toast.error("There was an error processing your vote.");
    } finally {
      setIsVoting(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const handleReleaseFunds = async (proposalId: number) => {
    try {
      setIsReleasing(prev => ({ ...prev, [proposalId]: true }));
      const contract = await getPublicFundingContract();

      const tx = await contract.releaseFunds(proposalId);
      toast.success("Transaction Submitted");

      await tx.wait();
      toast.success("Funds Released");

      await loadContractData();
    } catch (error) {
      console.error("Fund release failed:", error);
      toast.error("Failed to release funds.");
    } finally {
      setIsReleasing(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const formatDate = (timestamp: bigint | number) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-lg">Loading fund management dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Public Fund Treasury</h1>
          <p className="text-muted-foreground mt-2">Manage community funds and proposals</p>
        </div>

        {!isConnected ? (
          <Button onClick={connectWallet} className="mt-4 md:mt-0">
            Connect Wallet
          </Button>
        ) : (
          <div className="mt-4 md:mt-0 flex flex-col items-end">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <p className="text-sm font-medium">Connected</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {account.slice(0, 6)}...{account.slice(-4)}
            </p>
          </div>
        )}
      </div>

      {isConnected ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="deposit">Deposit Funds</TabsTrigger>
            <TabsTrigger value="proposals">Proposals</TabsTrigger>
            <TabsTrigger value="yourProposals">Your Proposals</TabsTrigger>
            <TabsTrigger value="create">Create Proposal</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Treasury Overview</CardTitle>
                  <CardDescription>Current status of the public fund</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-6">
                    <div>
                      <Label className="text-lg">Current Balance</Label>
                      <p className="text-3xl font-bold mt-2">{ethers.formatEther(treasuryBalance)} ETH</p>
                    </div>

                    <div>
                      <Label className="text-lg">Active Proposals</Label>
                      <p className="text-3xl font-bold mt-2">
                        {proposals.filter(p => !p.executed).length}
                      </p>
                    </div>

                    <div>
                      <Label className="text-lg">Completed Proposals</Label>
                      <p className="text-3xl font-bold mt-2">
                        {proposals.filter(p => p.executed).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="deposit">
            <Card>
              <CardHeader>
                <CardTitle>Deposit Funds</CardTitle>
                <CardDescription>Contribute ETH to the treasury</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div>
                    <Label htmlFor="depositAmount">Amount (ETH)</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="depositAmount"
                        type="number"
                        placeholder="0.1"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                      <Button
                        onClick={handleDeposit}
                        disabled={isDepositing || !depositAmount}
                      >
                        {isDepositing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Deposit"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-sm text-muted-foreground">
                  Current treasury balance: {ethers.formatEther(treasuryBalance)} ETH
                </p>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="proposals">
            <div className="grid gap-6">
              {proposals.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No proposals have been submitted yet.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                proposals.map((proposal) => (
                  <Card key={proposal.id} className={proposal.executed ? "opacity-75" : ""}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Proposal #{proposal.id}
                            {proposal.executed && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                Executed
                              </span>
                            )}
                            {proposal.approved && !proposal.executed && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                Approved
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription>Created: {formatDate(proposal.createdAt)}</CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{ethers.formatEther(proposal.amount)} ETH</p>
                          <p className="text-xs text-muted-foreground">
                            Recipient: {proposal.recipient.slice(0, 6)}...{proposal.recipient.slice(-4)}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4">{proposal.description}</p>

                      <div className="mt-4">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm">Votes: {proposal.votes}</span>
                          <span className="text-sm">Required: 3</span>
                        </div>
                        <Progress value={(proposal.votes / 3) * 100} className="h-2" />
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                      {!proposal.executed && !proposal.approved && (
                        <Button
                          variant="outline"
                          onClick={() => handleVoteOnProposal(proposal.id)}
                          disabled={isVoting[proposal.id]}
                        >
                          {isVoting[proposal.id] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Voting...
                            </>
                          ) : (
                            "Vote"
                          )}
                        </Button>
                      )}

                      {proposal.approved && !proposal.executed && (
                        <Button
                          onClick={() => handleReleaseFunds(proposal.id)}
                          disabled={isReleasing[proposal.id]}
                        >
                          {isReleasing[proposal.id] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Releasing...
                            </>
                          ) : (
                            "Release Funds"
                          )}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="yourProposals">
            <div className="grid gap-6">
              {currentUserProposals.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No proposals have been submitted yet.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                currentUserProposals.map((proposal) => {
                  if (!proposal || !proposal.id) {
                    console.error("Invalid proposal:", proposal);
                    return null; // Skip any invalid entries
                  }

                  return (
                    <Card key={proposal.id} className={proposal.executed ? "opacity-75" : ""}>
                      <CardHeader>
                        <CardTitle>Proposal #{proposal.id}</CardTitle>
                        <CardDescription>Created: {formatDate(proposal.createdAt)}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-4">{proposal.description || "No description available."}</p>
                        <div className="grid gap-4 text-sm">
                          <div>
                            <span className="font-medium">Amount:</span>{" "}
                            {ethers.formatEther(proposal.amount)} ETH
                          </div>
                          <div>
                            <span className="font-medium">Votes:</span> {proposal.votes.toString()}
                          </div>
                          <div>
                            <span className="font-medium">Approved:</span>{" "}
                            {proposal.approved ? "Yes" : "No"}
                          </div>
                          <div>
                            <span className="font-medium">Executed:</span>{" "}
                            {proposal.executed ? "Yes" : "No"}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create Proposal</CardTitle>
                <CardDescription>Submit a new funding proposal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Explain how these funds will be used..."
                      className="mt-2"
                      value={newProposal.description}
                      onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="amount">Amount (ETH)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.1"
                      className="mt-2"
                      value={newProposal.amount}
                      onChange={(e) => setNewProposal(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="recipient">Recipient Address</Label>
                    <Input
                      id="recipient"
                      placeholder="0x..."
                      className="mt-2"
                      value={newProposal.recipient}
                      onChange={(e) => setNewProposal(prev => ({ ...prev, recipient: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  Available funds: {ethers.formatEther(treasuryBalance)} ETH
                </div>
                <Button
                  onClick={handleSubmitProposal}
                  disabled={isSubmittingProposal || !newProposal.description || !newProposal.amount || !newProposal.recipient}
                  className="ml-auto"
                >
                  {isSubmittingProposal ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Proposal"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Wallet Not Connected</h2>
              <p className="text-muted-foreground text-center mb-6">
                Please connect your wallet to manage funds and interact with proposals.
              </p>
              <Button onClick={connectWallet}>Connect Wallet</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}