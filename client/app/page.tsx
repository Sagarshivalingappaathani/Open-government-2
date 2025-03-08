"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  const checkIfWalletIsConnected = async () => {
    try {
      if (!window.ethereum) return;

      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setIsConnected(true);
        setAccount(accounts[0]);
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged);
    } catch (error) {
      console.error("Error checking wallet connection:", error);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setIsConnected(false);
      setAccount(null);
    } else {
      setIsConnected(true);
      setAccount(accounts[0]);
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setIsConnected(true);
      setAccount(accounts[0]);
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          Welcome to Your Dashboard
        </h1>
        <p className="text-xl text-gray-600">
          A powerful and beautiful dashboard built with Next.js and Tailwind CSS.
        </p>
        {isConnected ? (
          <Link href="/dashboard/home">
            <Button size="lg" className="gap-2">
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        ) : (
          <Button
            size="lg"
            className="gap-2"
            onClick={connectWallet}
          >
            Connect Wallet
            <Wallet className="w-4 h-4" />
          </Button>
        )}
        {account && (
          <p className="text-sm text-gray-600">
            Connected: {account.slice(0, 6)}...{account.slice(-4)}
          </p>
        )}
      </div>
    </div>
  );
}