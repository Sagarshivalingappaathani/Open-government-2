import React, { useState } from 'react';
import { getContract } from '@/lib/contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CreateElectionForm: React.FC = () => {
  const [electionName, setElectionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!electionName) return;

    try {
      setIsLoading(true);
      const contract = await getContract();
      const tx = await contract.createElection(electionName);
      await tx.wait();
      console.log(tx);
      alert('Election created successfully!');
      setElectionName('');
    } catch (error) {
      console.error('Error creating election:', error);
      alert('Failed to create election.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreateElection} className="space-y-4 p-4">
      <Input
        type="text"
        value={electionName}
        onChange={(e) => setElectionName(e.target.value)}
        placeholder="Enter election name"
        disabled={isLoading}
      />
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Election'}
      </Button>
    </form>
  );
};

export default CreateElectionForm;
