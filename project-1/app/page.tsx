"use client";
import { useState, useEffect } from "react";
import { getContract } from "@/lib/contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Vote, Plus, Play, Square, Trophy, Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import ElectionList from "@/components/smart-contract-components/ElectionList";
import CreateElection from "@/components/smart-contract-components/CreateElection";
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
  candidates?: Candidate[];
  results?: {
    names: string[];
    voteCounts: number[];
  };
}

export default function Home() {
  const [contract, setContract] = useState<any>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [newElectionName, setNewElectionName] = useState("");
  const [newCandidateName, setNewCandidateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<number, number>>({});

  useEffect(() => {
    initContract();
  }, []);

  const initContract = async () => {
    try {
      const contract = await getContract();
      setContract(contract);
      await loadElections(contract);
    } catch (error) {
      console.error("Error initializing contract:", error);
    }
  };

  const loadElections = async (contract: any) => {
    try {
      const count = await contract.electionCount();
      const elections = [];
      
      for (let i = 1; i <= count; i++) {
        const election = await contract.elections(i);
        const electionData: Election = {
          id: i,
          name: election.name,
          admin: election.admin,
          isActive: election.isActive,
          isCompleted: election.isCompleted,
          candidateCount: election.candidateCount.toNumber(),
          candidates: []
        };

        // Load candidates for each election
        const candidates = [];
        for (let j = 1; j <= electionData.candidateCount; j++) {
          try {
            const candidate = await contract.elections(i).candidates(j);
            candidates.push({
              id: j,
              name: candidate.name,
              voteCount: candidate.voteCount
            });
          } catch (error) {
            console.error(`Error loading candidate ${j} for election ${i}:`, error);
          }
        }
        electionData.candidates = candidates;

        // Load results if election is completed
        if (electionData.isCompleted) {
          try {
            const [, , names, voteCounts] = await contract.getResults(i);
            electionData.results = {
              names,
              voteCounts: voteCounts.map((count: any) => count.toNumber())
            };
          } catch (error) {
            console.error(`Error loading results for election ${i}:`, error);
          }
        }

        elections.push(electionData);
      }
      
      setElections(elections);
    } catch (error) {
      console.error("Error loading elections:", error);
    }
  };

  const createElection = async () => {
    try {
      setLoading(true);
      const tx = await contract.createElection(newElectionName);
      await tx.wait();
      await loadElections(contract);
      setNewElectionName("");
    } catch (error) {
      console.error("Error creating election:", error);
    } finally {
      setLoading(false);
    }
  };

  const addCandidate = async (electionId: number) => {
    try {
      setLoading(true);
      const tx = await contract.addCandidate(electionId, newCandidateName);
      await tx.wait();
      await loadElections(contract);
      setNewCandidateName("");
    } catch (error) {
      console.error("Error adding candidate:", error);
    } finally {
      setLoading(false);
    }
  };

  const startElection = async (electionId: number) => {
    try {
      setLoading(true);
      const tx = await contract.startElection(electionId);
      await tx.wait();
      await loadElections(contract);
    } catch (error) {
      console.error("Error starting election:", error);
    } finally {
      setLoading(false);
    }
  };

  const stopElection = async (electionId: number) => {
    try {
      setLoading(true);
      const tx = await contract.stopElection(electionId);
      await tx.wait();
      await loadElections(contract);
    } catch (error) {
      console.error("Error stopping election:", error);
    } finally {
      setLoading(false);
    }
  };

  const vote = async (electionId: number, candidateId: number) => {
    try {
      setLoading(true);
      const tx = await contract.vote(electionId, candidateId);
      await tx.wait();
      await loadElections(contract);
      setSelectedCandidates((prev) => ({
        ...prev,
        [electionId]: candidateId
      }));
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Blockchain Voting System</h1>
        <ElectionList />
        <CreateElection />
      </div>
    </div>
  );
}