"use client";
import ElectionList from "@/components/smart-contract-components/ElectionList";
import CreateElection from "@/components/smart-contract-components/CreateElection";

export default function Home() {
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