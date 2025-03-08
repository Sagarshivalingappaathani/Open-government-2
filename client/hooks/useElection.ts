import { useState, useEffect } from 'react';
import { getContract } from '@/lib/contract';
import { toast } from 'react-hot-toast';

export const useElection = (electionId: number) => {
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [election, setElection] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [voters, setVoters] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getCurrentAddress = async () => {
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Please install MetaMask!');
      }
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      setCurrentAddress(accounts[0]);
      return accounts[0];
    } catch (err) {
      console.error('Error getting address:', err);
      setError('Failed to connect to MetaMask.');
    }
  };

  const loadElectionData = async () => {
    setLoading(true);
    try {
      const contract = await getContract();
      const address = await getCurrentAddress();
      const electionData = await contract.elections(electionId);

      setElection({
        name: electionData.name,
        admin: electionData.admin,
        isActive: electionData.isActive,
        isCompleted: electionData.isCompleted,
      });

      const [ids, names, voteCounts] = await contract.getCandidates(electionId);
      setCandidates(ids.map((id: any, index: number) => ({
        id: id.toNumber(),
        name: names[index],
        votes: voteCounts[index].toNumber(),
      })));

      const voters = await contract.getVoters(electionId);
      setVoters(voters);
      setHasVoted(voters.some((voter: string) => voter.toLowerCase() === address.toLowerCase()));

      setIsAdmin(address.toLowerCase() === electionData.admin.toLowerCase());
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load election data.');
    } finally {
      setLoading(false);
    }
  };

  const addCandidate = async (name: string) => {
    if (!name.trim()) {
      setError('Candidate name cannot be empty.');
      return;
    }

    try {
      const contract = await getContract();
      const tx = await contract.addCandidate(electionId, name);
      await tx.wait();
      toast.success(`Candidate "${name}" added successfully!`);
      loadElectionData(); // Refresh data
    } catch (error) {
      console.error('Error adding candidate:', error);
      setError('Failed to add candidate.');
      toast.error('Failed to add candidate.');
    }
  };

  useEffect(() => {
    if (electionId) {
      loadElectionData();
    }
  }, [electionId]);

  return {
    currentAddress,
    election,
    candidates,
    voters,
    isAdmin,
    hasVoted,
    loading,
    error,
    addCandidate,
    loadElectionData,
  };
};
