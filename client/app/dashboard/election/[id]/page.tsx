'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getContract } from '@/lib/votingContract';
import { Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { useMetaMask, useElectionData, useElectionActions } from '@/hooks/useElection';

export default function ElectionDetailPage() {
  const params = useParams();
  const electionId = parseInt(params.id as string);
  const [loading, setLoading] = useState(true);
  const { currentAddress, getCurrentAddress } = useMetaMask();
  //const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [election, setElection] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [voters, setVoters] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);
  const [isStartingElection, setIsStartingElection] = useState(false);
  const [isEndingElection, setIsEndingElection] = useState(false);
  const [votingStates, setVotingStates] = useState({});


  // const getCurrentAddress = async () => {
  //   try {
  //     if (typeof window === 'undefined' || !(window as any).ethereum) {
  //       throw new Error('Please install MetaMask!');
  //     }

  //     const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
  //     return accounts[0];
  //   } catch (error) {
  //     console.error('Error getting address:', error);
  //     setError('Failed to connect to MetaMask. Please make sure it\'s installed and connected.');
  //     return null;
  //   }
  // };

  const addCandidate = async () => {
    if (!newCandidateName.trim()) {
      setError('Candidate name cannot be empty.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const contract = await getContract();
      const tx = await contract.addCandidate(electionId, newCandidateName);
      await tx.wait();
      setSuccess(`Candidate "${newCandidateName}" added successfully!`);
      setNewCandidateName('');
      toast.success(`Candidate "${newCandidateName}" added successfully!`);
      loadElectionData();
    } catch (error) {
      console.error("Error adding candidate:", error);
      setError("Failed to add candidate. Make sure you're the admin.");
      toast.error("Failed to add candidate. Make sure you're the admin.");
    }
  };


  const loadCandidates = async (contract: any, electionId: number) => {
    try {
      const [ids, names, voteCounts] = await contract.getCandidates(electionId);
      return ids.map((id: any, index: number) => ({
        id: typeof id === 'bigint' ? Number(id) : id,
        name: names[index],
        votes: typeof voteCounts[index] === 'bigint' ? Number(voteCounts[index]) : voteCounts[index]
      }));
    } catch (error) {
      console.error('Failed to load candidates:', error);
      return [];
    }
  };

  const loadVoters = async (contract: any, electionId: number) => {
    try {
      return await contract.getVoters(electionId);
    } catch (error) {
      console.error('Failed to load voters:', error);
      return [];
    }
  };

  const startElection = async (electionId: number) => {
    try {
      const contract = await getContract();
      const tx = await contract.startElection(electionId);
      await tx.wait();
      setElection((prev: any | null) => prev ? { ...prev, isActive: true } : prev);
      console.log('Election started successfully');
      toast.success('Election started successfully!');
    } catch (error) {
      console.error('Failed to start election:', error);
      toast.error('Failed to start election.');
    }
  };

  const voteForCandidate = async (candidateId: number) => {
    if (!currentAddress) {
      setError("Please connect your wallet.");
      return;
    }

    try {
      setError('');
      setSuccess('');
      const contract = await getContract();
      const tx = await contract.vote(electionId, candidateId);
      await tx.wait();

      setSuccess("Vote cast successfully!");
      loadElectionData(); // Refresh election data after voting
      toast.success("Vote cast successfully!");
    } catch (error) {
      console.error("Error voting:", error);
      setError("Failed to cast vote. Make sure the election is active and you haven't already voted.");
      toast.error("Failed to cast vote. Make sure the election is active and you haven't already voted.");
    }
  };


  const stopElection = async (electionId: number) => {
    try {
      const contract = await getContract();
      const tx = await contract.stopElection(electionId);
      await tx.wait();
      setElection((prev: any | null) => prev ? { ...prev, isActive: false, isCompleted: true } : prev);
      console.log('Election stopped successfully');
      toast.success("Election stopped successfully!");
    } catch (error) {
      console.error('Failed to stop election:', error);
      toast.error("Failed to stop election.");
    }
  };

  const loadResults = async (contract: any, electionId: number) => {
    try {
      const [electionName, ids, names, voteCounts] = await contract.getResults(electionId)
      return ids.map((id: any, index: number) => ({
        id: typeof id === 'bigint' ? Number(id) : id,
        name: names[index],
        votes: typeof voteCounts[index] === 'bigint' ? Number(voteCounts[index]) : voteCounts[index]
      }));
    } catch (error) {
      console.error('Failed to load results:', error);
      return [];
    }
  };

  const loadElectionData = async () => {
    setLoading(true);
    setError('');

    try {
      const contract = await getContract();
      const address = await getCurrentAddress();
      //setCurrentAddress(address);

      if (!contract || !address) return;

      const electionData = await contract.elections(electionId);
      console.log(electionData);
      setElection({
        name: electionData.name,
        admin: electionData.admin,
        isActive: electionData.isActive,
        isCompleted: electionData.isCompleted,
        candidateCount: electionData.candidateCount
      });
      console.log(electionData);

      if (electionData.isCompleted) {
        const results = await loadResults(contract, electionId);
        setCandidates(results);
      } else {
        const candidates = await loadCandidates(contract, electionId);
        setCandidates(candidates);
      }

      const voters = await loadVoters(contract, electionId);
      setVoters(voters);
      // Check if the current user has voted
      setHasVoted(voters.some((voter: string) => voter.toLowerCase() === address.toLowerCase()));

      setIsAdmin(address.toLowerCase() === electionData.admin.toLowerCase());
    } catch (error) {
      console.error('Error loading election data:', error);
      setError('Failed to load election data. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (electionId) {
      loadElectionData();
    }
  }, [electionId]);

  if (loading && !election) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Loading election details...</h1>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Election not found</h1>
        <p>The election you're looking for doesn't exist or there was an error loading it.</p>
        {error && <p className="text-red-500 mt-2">{error}</p>}
        <button
          onClick={loadElectionData}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }
  // Add these handler functions to your component
  const handleAddCandidate = async () => {
    setIsAddingCandidate(true);
    try {
      await addCandidate();
    } finally {
      setIsAddingCandidate(false);
    }
  };

  const handleStartElection = async () => {
    setIsStartingElection(true);
    try {
      await startElection(electionId);
    } finally {
      setIsStartingElection(false);
    }
  };

  const handleEndElection = async () => {
    setIsEndingElection(true);
    try {
      await stopElection(electionId);
    } finally {
      setIsEndingElection(false);
    }
  };

  const handleVote = async (candidateId: string) => {
    setVotingStates(prev => ({ ...prev, [candidateId]: true }));
    try {
      await voteForCandidate(parseInt(candidateId));
    } finally {
      setVotingStates(prev => ({ ...prev, [candidateId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto max-w-5xl px-4">
        {loading && !election ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
          </div>
        ) : !election ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Election not found</h1>
            <p className="text-gray-600 mb-4">The election you're looking for doesn't exist or there was an error loading it.</p>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <Button
              onClick={loadElectionData}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  <span>Loading...</span>
                </div>
              ) : "Try Again"}
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md">
            {/* Header Section */}
            <div className="border-b p-6">
              <h1 className="text-3xl font-bold text-gray-800">
                Election Details
              </h1>
            </div>

            {/* Election Info Card */}
            <div className="p-6 border-b">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">{election.name}</h2>
              <div className="space-y-2">
                <p className="text-gray-600 text-sm">
                  Admin: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">{election.admin}</span>
                </p>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${election.isCompleted ? "bg-green-500" : election.isActive ? "bg-blue-500" : "bg-gray-400"}`}></div>
                  <p className="font-medium text-gray-800">
                    {election.isCompleted ? "Completed" : election.isActive ? "Active" : "Not Started"}
                  </p>
                </div>
              </div>
            </div>

            {/* Results Section */}
            {election.isCompleted ? (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Election Results
                </h2>

                {/* Winner Card */}
                {candidates.length > 0 && (
                  <div className="mb-4">
                    {(() => {
                      const winner = [...candidates].sort((a, b) => b.votes - a.votes)[0];
                      const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
                      return (
                        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-gray-700 text-sm mb-1">Winner</p>
                              <p className="font-medium text-lg">{winner.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-700 text-sm mb-1">Votes</p>
                              <p className="font-medium text-lg">{winner.votes}</p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-green-100">
                            <p className="text-gray-700 text-sm">Total Votes Cast: <span className="font-medium">{totalVotes}</span></p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Results Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="py-3 px-4 text-left border-b" style={{ width: '80%' }}>Candidate</th>
                        <th className="py-3 px-4 text-right border-b" style={{ width: '20%' }}>Votes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((candidate) => (
                        <tr key={candidate.id} className="border-t hover:bg-gray-50">
                          <td className="py-3 px-4">{candidate.name}</td>
                          <td className="py-3 px-4 text-right">{candidate.votes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : election.isActive ? (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Cast Your Vote
                </h2>
                {hasVoted ? (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                    <p className="text-green-800 font-medium">
                      Thank you! You have successfully cast your vote.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {candidates.map((candidate) => (
                      <li key={candidate.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
                        <span className="font-medium">{candidate.name}</span>
                        <Button
                          onClick={() => handleVote(candidate.id)}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                          disabled={votingStates[candidate.id as keyof typeof votingStates]}
                        >
                          {votingStates[candidate.id as keyof typeof votingStates] ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                              <span>Voting...</span>
                            </div>
                          ) : "Vote"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {isAdmin && (
                  <div className="mt-6">
                    <Button
                      onClick={handleEndElection}
                      className="bg-gray-800 hover:bg-gray-900 text-white"
                      disabled={isEndingElection}
                    >
                      {isEndingElection ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                          <span>Processing...</span>
                        </div>
                      ) : "End Election"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              isAdmin && (
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    Admin Controls
                  </h2>
                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <div className="mb-4">
                      <Input
                        type="text"
                        value={newCandidateName}
                        onChange={(e) => setNewCandidateName(e.target.value)}
                        placeholder="Enter candidate name"
                        className="w-full"
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={handleAddCandidate}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                        disabled={isAddingCandidate}
                      >
                        {isAddingCandidate ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                            <span>Adding...</span>
                          </div>
                        ) : "Add Candidate"}
                      </Button>
                      <Button
                        onClick={handleStartElection}
                        className="bg-gray-800 hover:bg-gray-900 text-white"
                        disabled={isStartingElection}
                      >
                        {isStartingElection ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                            <span>Starting...</span>
                          </div>
                        ) : "Start Election"}
                      </Button>
                    </div>
                    {error && <p className="text-red-500 mt-3 text-sm">{error}</p>}
                    {success && <p className="text-green-500 mt-3 text-sm">{success}</p>}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );

  // return (
  //   <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-12">
  //     <div className="container mx-auto max-w-6xl">
  //       <div className="bg-white shadow-2xl rounded-3xl p-8 border border-gray-100">
  //         {/* Header Section */}
  //         <h1 className="text-5xl font-extrabold mb-12 text-center text-gray-900 animate-fade-in">
  //           <span className="inline-block transform hover:scale-105 transition-transform">🗳️</span> Election Details
  //         </h1>

  //         {/* Election Info Card */}
  //         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
  //           <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 border border-gray-100">
  //             <h2 className="text-3xl font-semibold text-gray-900 mb-4">{election.name}</h2>
  //             <div className="space-y-3">
  //               <p className="text-gray-700 flex items-center gap-2 text-lg">
  //                 <span className="inline-block">👤</span> Admin: 
  //                 <span className="font-mono bg-gray-100 px-2 py-1 rounded-lg text-sm">{election.admin}</span>
  //               </p>
  //               <p className="flex items-center gap-2 text-lg font-medium text-gray-900">
  //                 <span className="text-2xl">
  //                   {election.isCompleted ? "✅" : election.isActive ? "⚫" : "⚪"}
  //                 </span>
  //                 {election.isCompleted ? "Completed" : election.isActive ? "Active" : "Not Started"}
  //               </p>
  //             </div>
  //           </div>
  //         </div>

  //         {/* Results Section */}
  //         {election.isCompleted ? (
  //           <div className="mt-12 animate-fade-in">
  //             <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-6">
  //               <span className="text-4xl">📊</span> Election Results
  //             </h2>
  //             <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
  //               <Table className="min-w-full">
  //                 <TableHead>
  //                   <TableRow className="bg-gray-100">
  //                     <TableHeaderCell className="py-4 px-6 text-lg text-left w-[80%]">Candidate</TableHeaderCell>
  //                     <TableHeaderCell className="py-4 px-6 text-lg text-right w-[20%]">Votes</TableHeaderCell>
  //                   </TableRow>
  //                 </TableHead>
  //                 <TableBody>
  //                   {candidates.map((candidate) => (
  //                     <TableRow key={candidate.id} className="border-b hover:bg-gray-50 transition-colors">
  //                       <TableCell className="py-4 px-6 text-lg text-left">{candidate.name}</TableCell>
  //                       <TableCell className="py-4 px-6 text-lg">
  //                         {candidate.votes}
  //                       </TableCell>
  //                     </TableRow>
  //                   ))}
  //                 </TableBody>
  //               </Table>
  //             </div>
  //           </div>
  //         ) : election.isActive ? (
  //           <div className="mt-12 animate-fade-in">
  //             <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-6">
  //               <span className="text-4xl">🗳️</span> Cast Your Vote
  //             </h2>
  //             {hasVoted ? (
  //               <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
  //                 <p className="text-gray-900 text-xl font-medium flex items-center justify-center gap-2">
  //                   <span className="text-2xl">✅</span> Thank you! You have successfully cast your vote.
  //                 </p>
  //               </div>
  //             ) : (
  //               <ul className="mt-6 space-y-4">
  //                 {candidates.map((candidate) => (
  //                   <li key={candidate.id} 
  //                       className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 border border-gray-100">
  //                     <span className="text-xl font-medium">{candidate.name}</span>
  //                     <Button
  //                       onClick={() => voteForCandidate(candidate.id)}
  //                       className="bg-black text-white px-8 py-3 rounded-xl hover:bg-gray-800 transition-all transform hover:scale-105 shadow-md"
  //                     >
  //                       Vote Now
  //                     </Button>
  //                   </li>
  //                 ))}
  //               </ul>
  //             )}
  //             {isAdmin && (
  //               <Button
  //                 onClick={() => stopElection(electionId)}
  //                 className="mt-8 bg-gray-900 text-white px-8 py-3 rounded-xl hover:bg-black transition-all transform hover:scale-105 shadow-md"
  //               >
  //                 End Election
  //               </Button>
  //             )}
  //           </div>
  //         ) : (
  //           isAdmin && (
  //             <div className="mt-12 animate-fade-in">
  //               <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-6">
  //                 <span className="text-4xl">⚙️</span> Admin Controls
  //               </h2>
  //               <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
  //                 <Input
  //                   type="text"
  //                   value={newCandidateName}
  //                   onChange={(e) => setNewCandidateName(e.target.value)}
  //                   placeholder="Enter candidate name"
  //                   className="border-2 border-gray-200 px-6 py-3 rounded-xl w-full shadow-inner focus:ring-2 focus:ring-gray-500 focus:border-transparent"
  //                 />
  //                 <div className="flex flex-wrap gap-4 mt-6">
  //                   <Button
  //                     onClick={addCandidate}
  //                     className="bg-black text-white px-8 py-3 rounded-xl hover:bg-gray-800 transition-all transform hover:scale-105 shadow-md"
  //                   >
  //                     Add Candidate
  //                   </Button>
  //                   <Button
  //                     onClick={() => startElection(electionId)}
  //                     className="bg-gray-900 text-white px-8 py-3 rounded-xl hover:bg-black transition-all transform hover:scale-105 shadow-md"
  //                   >
  //                     Start Election
  //                   </Button>
  //                 </div>
  //               </div>
  //             </div>
  //           )
  //         )}
  //       </div>
  //     </div>
  //   </div>
  // );
}