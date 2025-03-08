"use client";

import ElectionList from "@/components/votingSystem/ElectionList";
import CreateElection from "@/components/votingSystem/CreateElection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="w-full">
        <h1 className="text-4xl font-bold mb-12 text-center text-black">
          Blockchain Voting System
        </h1>

        <Tabs defaultValue="elections" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-gray-100 p-1 rounded-lg">
              <TabsTrigger
                value="elections"
                className="px-8 py-2 text-sm font-medium transition-all data-[state=active]:bg-black data-[state=active]:text-white"
              >
                View Elections
              </TabsTrigger>
              <TabsTrigger
                value="create"
                className="px-8 py-2 text-sm font-medium transition-all data-[state=active]:bg-black data-[state=active]:text-white"
              >
                Create Election
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="elections" className="mt-4">
            <div className="bg-gray-50 p-8 rounded-lg w-full">
              <ElectionList />
            </div>
          </TabsContent>

          <TabsContent value="create" className="mt-4">
            <div className="bg-gray-50 p-8 rounded-lg w-full">
              <CreateElection />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
