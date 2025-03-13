'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getPublicFundingContract } from '@/lib/publicFundingContract';
import { toast } from 'react-hot-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Wallet,
  Home,
  Send,
  Users,
  Vote,
  BadgeDollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Shield,
  Trash2,
  Settings,
  ArrowRight,
  CircleDollarSign,
  FileCheck,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface Proposal {
  id: number;
  description: string;
  amount: string;
  recipient: string;
  approvalCount: number;
  approved: boolean;
  executed: boolean;
  createdAt: number;
}

export default function FundManagement() {
  const [account, setAccount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [isOwner, setIsOwner] = useState(false);
  const [isAuthority, setIsAuthority] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [authorities, setAuthorities] = useState<string[]>([]);
  const [requiredApprovals, setRequiredApprovals] = useState<number>(0);
  const [newRequiredApprovals, setNewRequiredApprovals] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    deposit: '',
    proposal: {
      description: '',
      amount: '',
      recipient: '',
    },
  });

  // Form states
  const [depositAmount, setDepositAmount] = useState('');
  const [newAuthority, setNewAuthority] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalRecipient, setProposalRecipient] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        if (typeof window.ethereum === 'undefined') {
          toast.error('Please install MetaMask to use this application');
          return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        setAccount(accounts[0]);

        const contract = await getPublicFundingContract();
        const owner = await contract.owner();
        const isAuth = await contract.isAuthority(accounts[0]);
        const balance = await contract.getTreasuryBalance();
        const balanceFormatted = ethers.formatEther(balance);
        const authList = await contract.getAllAuthorities();
        const reqApprovals = await contract.requiredApprovals();

        setIsOwner(owner.toLowerCase() === accounts[0].toLowerCase());
        setIsAuthority(isAuth);
        setBalance(balanceFormatted);
        setAuthorities(authList);
        setRequiredApprovals(Number(reqApprovals));

        // Load proposals
        const proposalCount = await contract.proposalCount();
        const loadedProposals: Proposal[] = [];

        for (let i = 1; i <= Number(proposalCount); i++) {
          const proposal = await contract.proposals(i);
          loadedProposals.push({
            id: Number(proposal.id),
            description: proposal.description,
            amount: ethers.formatEther(proposal.amount),
            recipient: proposal.recipient,
            approvalCount: Number(proposal.approvalCount),
            approved: proposal.approved,
            executed: proposal.executed,
            createdAt: Number(proposal.createdAt)
          });
        }
        setProposals(loadedProposals.reverse());
      } catch (error) {
        console.error('Initialization error:', error);
        toast.error('Failed to initialize the application. Please check your wallet connection.');
      }
    };

    init();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts : any) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount('');
          toast.error('Disconnected from MetaMask. Please reconnect.');
        }
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', setAccount);
      }
    };
  }, [account]);


  const handleDeposit = async () => {
    try {
      if (!depositAmount || parseFloat(depositAmount) <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      const contract = await getPublicFundingContract();
      const tx = await contract.depositFunds({
        value: ethers.parseEther(depositAmount)
      });

      toast.success('Transaction submitted. Waiting for confirmation...');
      await tx.wait();
      toast.success('Funds deposited successfully!');

      const currentBalance = await contract.getTreasuryBalance();
      const balanceFormatted = ethers.formatEther(currentBalance);
      setBalance(balanceFormatted);
      setDepositAmount('');
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Failed to deposit funds. Please check your wallet balance.');
    }
  };

  const handleAddAuthority = async () => {
    try {
      if (!ethers.isAddress(newAuthority)) {
        toast.error('Please enter a valid Ethereum address');
        return;
      }

      const contract = await getPublicFundingContract();
      const tx = await contract.addAuthority(newAuthority);

      toast.success('Adding new authority. Please wait for confirmation...');
      await tx.wait();
      toast.success('Authority added successfully!');

      setAuthorities(await contract.getAllAuthorities());
      setNewAuthority('');
    } catch (error) {
      console.error('Add authority error:', error);
      toast.error('Failed to add authority. Make sure you are the owner.');
    }
  };

  const handleRemoveAuthority = async (authority: string) => {
    try {
      const contract = await getPublicFundingContract();
      const tx = await contract.removeAuthority(authority);

      toast.success('Removing authority. Please wait for confirmation...');
      await tx.wait();
      toast.success('Authority removed successfully!');

      setAuthorities(await contract.getAllAuthorities());
    } catch (error) {
      console.error('Remove authority error:', error);
      toast.error('Failed to remove authority. Check if minimum authorities requirement is met.');
    }
  };

  const handleUpdateRequiredApprovals = async () => {
    try {
      const newValue = parseInt(newRequiredApprovals);
      if (isNaN(newValue) || newValue <= 0) {
        toast.error('Please enter a valid number of required approvals');
        return;
      }

      const contract = await getPublicFundingContract();
      const tx = await contract.updateRequiredApprovals(newValue);

      toast.success('Updating required approvals. Please wait for confirmation...');
      await tx.wait();
      toast.success('Required approvals updated successfully!');

      setRequiredApprovals(newValue);
      setNewRequiredApprovals('');
    } catch (error) {
      console.error('Update required approvals error:', error);
      toast.error('Failed to update required approvals. Check if the new value is valid.');
    }
  };

  const handleSubmitProposal = async () => {
    try {
      if (!proposalDescription || !proposalAmount || !proposalRecipient) {
        toast.error('Please fill in all proposal details');
        return;
      }

      if (!ethers.isAddress(proposalRecipient)) {
        toast.error('Please enter a valid recipient address');
        return;
      }

      const contract = await getPublicFundingContract();
      const tx = await contract.submitProposal(
        proposalDescription,
        ethers.parseEther(proposalAmount),
        proposalRecipient
      );

      toast.success('Submitting proposal. Please wait for confirmation...');
      await tx.wait();
      toast.success('Proposal submitted successfully!');

      // Reset form
      setProposalDescription('');
      setProposalAmount('');
      setProposalRecipient('');

      // Refresh proposals
      const proposalCount = await contract.proposalCount();
      const proposal = await contract.proposals(proposalCount);
      setProposals([{
        id: Number(proposal.id),
        description: proposal.description,
        amount: ethers.formatEther(proposal.amount),
        recipient: proposal.recipient,
        approvalCount: Number(proposal.approvalCount),
        approved: proposal.approved,
        executed: proposal.executed,
        createdAt: Number(proposal.createdAt)
      }, ...proposals]);
    } catch (error) {
      console.error('Submit proposal error:', error);
      toast.error('Failed to submit proposal. Please try again.');
    }
  };

  const handleVote = async (proposalId: number) => {
    try {
      const contract = await getPublicFundingContract();
      const tx = await contract.voteOnProposal(proposalId);

      toast.success('Submitting vote. Please wait for confirmation...');
      await tx.wait();
      toast.success('Vote cast successfully!');

      // Refresh proposal data
      const proposal = await contract.proposals(proposalId);
      const updatedProposals = proposals.map(p =>
        p.id === proposalId
          ? {
            ...p,
            approvalCount: Number(proposal.approvalCount),
            approved: proposal.approved
          }
          : p
      );
      setProposals(updatedProposals);
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Failed to cast vote. You may have already voted on this proposal.');
    }
  };

  const handleReleaseFunds = async (proposalId: number) => {
    try {
      const contract = await getPublicFundingContract();
      const tx = await contract.releaseFunds(proposalId);

      toast.success('Releasing funds. Please wait for confirmation...');
      await tx.wait();
      toast.success('Funds released successfully!');

      // Refresh proposal and balance
      const proposal = await contract.proposals(proposalId);
      const newBalance = await contract.getTreasuryBalance();
      setBalance(ethers.formatEther(newBalance));

      const updatedProposals = proposals.map(p =>
        p.id === proposalId
          ? { ...p, executed: proposal.executed }
          : p
      );
      setProposals(updatedProposals);
    } catch (error) {
      console.error('Release funds error:', error);
      toast.error('Failed to release funds. Please check the treasury balance.');
    }
  };

  const getStatusColor = (proposal: Proposal) => {
    if (proposal.executed) return 'text-green-600';
    if (proposal.approved) return 'text-blue-600';
    return 'text-orange-600';
  };

  const getStatusIcon = (proposal: Proposal) => {
    if (proposal.executed) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (proposal.approved) return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
    return <Clock className="w-4 h-4 text-orange-600" />;
  };

  const validateDeposit = (amount: string): boolean => {
    if (!amount || amount.trim() === '') {
      setErrors(prev => ({ ...prev, deposit: 'Amount is required' }));
      return false;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrors(prev => ({ ...prev, deposit: 'Please enter a valid positive amount' }));
      return false;
    }
    try {
      ethers.parseEther(amount); // Check if the amount is valid ETH 
    } catch (error) {
      setErrors(prev => ({ ...prev, deposit: 'Invalid ETH amount' }));
      return false;
    }
    setErrors(prev => ({ ...prev, deposit: '' }));
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 space-y-8">
        <div className="bg-white rounded-lg shadow-sm p-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Public Fund Treasury
            </h1>
            <p className="text-gray-500 mt-2">Decentralized Fund Management System</p>
          </div>
          <div className="text-right">
            <div className="px-4 py-2 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">Connected Account</p>
              <p className="font-mono text-sm">{account.slice(0, 6)}...{account.slice(-4)}</p>
            </div>
            <div className="mt-2 px-4 py-2 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Treasury Balance</p>
              <p className="font-bold text-green-700">{balance} ETH</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="home" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm rounded-lg p-1">
            <TabsTrigger value="home" className="flex items-center gap-2">
              <Home className="w-4 h-4" /> Home
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Proposals
            </TabsTrigger>
            <TabsTrigger value="deposit" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Deposit
            </TabsTrigger>
            <TabsTrigger value="authorities" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Authorities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Welcome to Public Fund Treasury
                  </CardTitle>
                  <CardDescription>
                    A decentralized system for transparent fund management
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">
                    The Public Fund Treasury is a decentralized application that enables transparent and secure management of funds through a multi-signature approval system.
                  </p>
                  <div className="space-y-4 mt-6">
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <CircleDollarSign className="w-6 h-6 text-green-600 mt-1" />
                      <div>
                        <h3 className="font-semibold">Deposit Funds</h3>
                        <p className="text-sm text-gray-600">Anyone can contribute ETH to the treasury</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <Send className="w-6 h-6 text-blue-600 mt-1" />
                      <div>
                        <h3 className="font-semibold">Submit Proposals</h3>
                        <p className="text-sm text-gray-600">Create proposals to allocate funds to specific purposes</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <FileCheck className="w-6 h-6 text-purple-600 mt-1" />
                      <div>
                        <h3 className="font-semibold">Multi-Signature Approval</h3>
                        <p className="text-sm text-gray-600">Proposals require multiple authority approvals</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-green-600" />
                    Current Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Total Authorities</p>
                      <p className="text-2xl font-bold text-blue-700">{authorities.length}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Required Approvals</p>
                      <p className="text-2xl font-bold text-green-700">{requiredApprovals}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Total Proposals</p>
                      <p className="text-2xl font-bold text-purple-700">{proposals.length}</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-sm text-orange-600">Active Proposals</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {proposals.filter(p => !p.executed).length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Your Role</h3>
                    <div className="space-y-2">
                      {isOwner && (
                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 rounded">
                          <Shield className="w-4 h-4" />
                          <span>Contract Owner</span>
                        </div>
                      )}
                      {isAuthority && (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                          <UserCheck className="w-4 h-4" />
                          <span>Authority Member</span>
                        </div>
                      )}
                      {!isOwner && !isAuthority && (
                        <div className="flex items-center gap-2 text-gray-600 bg-gray-50 p-2 rounded">
                          <Users className="w-4 h-4" />
                          <span>Regular User</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="proposals">
            <Card className="bg-white">
              <CardHeader className="border-b border-gray-100 bg-gray-50">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-black rounded-lg">
                    <Send className="w-6 h-6 text-white" />
                  </div>
                  Create New Proposal
                </CardTitle>
                <CardDescription className="text-gray-600 text-base">
                  Submit a new funding proposal for approval by the authorities
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="w-full space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-lg font-semibold">
                        Proposal Description
                      </Label>
                      <div className="space-y-1">
                        <Input
                          id="description"
                          value={proposalDescription}
                          onChange={(e) => setProposalDescription(e.target.value)}
                          placeholder="Describe the purpose of this proposal"
                          className="h-14 text-lg border-2 border-gray-200 focus:border-black focus:ring-black"
                        />
                        {errors.proposal.description && (
                          <p className="text-red-500 text-sm flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {errors.proposal.description}
                          </p>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm">
                        Provide a clear and detailed description of your funding request
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="amount" className="text-lg font-semibold">
                          Amount
                        </Label>
                        <div className="relative">
                          <Input
                            id="amount"
                            type="number"
                            value={proposalAmount}
                            onChange={(e) => setProposalAmount(e.target.value)}
                            placeholder="0.0"
                            className={`h-14 text-lg pr-16 border-2 ${errors.proposal.amount
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-black'
                              } focus:ring-black`}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-100 px-2 py-1 rounded text-gray-600 font-medium">
                            ETH
                          </div>
                        </div>
                        {errors.proposal.amount && (
                          <p className="text-red-500 text-sm flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {errors.proposal.amount}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recipient" className="text-lg font-semibold">
                          Recipient
                        </Label>
                        <div className="space-y-1">
                          <Input
                            id="recipient"
                            value={proposalRecipient}
                            onChange={(e) => setProposalRecipient(e.target.value)}
                            placeholder="0x..."
                            className={`h-14 text-lg font-mono border-2 ${errors.proposal.recipient
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-black'
                              } focus:ring-black`}
                          />
                          {errors.proposal.recipient && (
                            <p className="text-red-500 text-sm flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {errors.proposal.recipient}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <Button
                      onClick={handleSubmitProposal}
                      className="h-14 text-lg bg-black hover:bg-gray-900 transition-colors"
                      disabled={isLoading || Object.values(errors.proposal).some(error => !!error)}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Processing Proposal...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-5 h-5" />
                          Submit Proposal
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Active Proposals</CardTitle>
                <CardDescription>View and manage current funding proposals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Approvals</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proposals.map((proposal) => (
                        <TableRow key={proposal.id}>
                          <TableCell className="font-mono">#{proposal.id}</TableCell>
                          <TableCell className="max-w-xs truncate">{proposal.description}</TableCell>
                          <TableCell className="font-mono">{parseFloat(proposal.amount).toFixed(4)} ETH</TableCell>
                          <TableCell className="font-mono text-xs">
                            {proposal.recipient.slice(0, 6)}...{proposal.recipient.slice(-4)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="font-bold">{proposal.approvalCount}</span>
                              <span className="text-gray-500">/ {requiredApprovals}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(proposal)}
                              <span className={getStatusColor(proposal)}>
                                {proposal.executed
                                  ? 'Executed'
                                  : proposal.approved
                                    ? 'Approved'
                                    : 'Pending'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {format(proposal.createdAt * 1000, 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!proposal.executed && isAuthority && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleVote(proposal.id)}
                                >
                                  <Vote className="w-4 h-4 mr-1" /> Vote
                                </Button>
                              )}
                              {proposal.approved && !proposal.executed && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReleaseFunds(proposal.id)}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Send className="w-4 h-4 mr-1" /> Release
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deposit">
            <Card className="bg-white">
              <CardHeader className="border-b border-gray-100 bg-gray-50">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-black rounded-lg">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  Deposit Funds
                </CardTitle>
                <CardDescription className="text-gray-600 text-base">
                  Contribute ETH to the public treasury
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="max-w-2xl mx-auto">
                  <div className="p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-gray-100">
                    <div className="text-center mb-8">
                      <BadgeDollarSign className="w-16 h-16 text-black mx-auto mb-4" />
                      <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                        Current Treasury Balance
                      </h3>
                      <p className="text-4xl font-bold text-black">
                        {parseFloat(balance).toFixed(4)} ETH
                      </p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="depositAmount" className="text-lg font-semibold">
                          Amount to Deposit
                        </Label>
                        <div className="relative">
                          <Input
                            id="depositAmount"
                            type="number"
                            placeholder="0.0"
                            value={depositAmount}
                            onChange={(e) => {
                              setDepositAmount(e.target.value);
                              validateDeposit(e.target.value);
                            }}
                            className={`h-14 text-lg pr-16 border-2 ${errors.deposit
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-black'
                              } focus:ring-black`}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-100 px-2 py-1 rounded text-gray-600 font-medium">
                            ETH
                          </div>
                        </div>
                        {errors.deposit && (
                          <p className="text-red-500 text-sm flex items-center gap-1 mt-1">
                            <AlertCircle className="w-4 h-4" />
                            {errors.deposit}
                          </p>
                        )}
                      </div>

                      <Button
                        onClick={handleDeposit}
                        className="w-full h-14 text-lg bg-black hover:bg-gray-900 transition-colors"
                        disabled={isLoading || !!errors.deposit}
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Processing Deposit...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5" />
                            Deposit Funds
                          </div>
                        )}
                      </Button>

                      <div className="grid grid-cols-2 gap-4 mt-8 text-center">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Your Address</p>
                          <p className="font-mono text-sm">
                            {account.slice(0, 6)}...{account.slice(-4)}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Network</p>
                          <p className="font-medium">Ethereum Mainnet</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="authorities">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isOwner && (
                <Card>
                  <CardHeader>
                    <CardTitle>Authority Management</CardTitle>
                    <CardDescription>Add new authorities and update approval requirements</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newAuthority">New Authority Address</Label>
                        <Input
                          id="newAuthority"
                          value={newAuthority}
                          onChange={(e) => setNewAuthority(e.target.value)}
                          placeholder="0x..."
                        />
                      </div>
                      <Button onClick={handleAddAuthority} className="w-full">
                        <Users className="w-4 h-4 mr-2" /> Add Authority
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="requiredApprovals">Required Approvals</Label>
                        <Input
                          id="requiredApprovals"
                          type="number"
                          value={newRequiredApprovals}
                          onChange={(e) => setNewRequiredApprovals(e.target.value)}
                          placeholder={requiredApprovals.toString()}
                        />
                      </div>
                      <Button
                        onClick={handleUpdateRequiredApprovals}
                        className="w-full"
                        variant="outline"
                      >
                        <Settings className="w-4 h-4 mr-2" /> Update Required Approvals
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Current Authorities</CardTitle>
                  <CardDescription>
                    Active authorities ({authorities.length}) • Required Approvals: {requiredApprovals}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {authorities.map((authority, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-600" />
                          <span className="font-mono text-sm">{authority}</span>
                          {authority.toLowerCase() === account.toLowerCase() && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        {isOwner && authority.toLowerCase() !== account.toLowerCase() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAuthority(authority)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}