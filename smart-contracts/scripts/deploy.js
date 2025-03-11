const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy VoterSBT contract
  console.log("Deploying VoterSBT...");
  const VoterSBT = await ethers.getContractFactory("VoterSBT");
  const voterSBT = await VoterSBT.deploy();
  await voterSBT.waitForDeployment();
  const voterSBTAddress = await voterSBT.getAddress();
  console.log("VoterSBT deployed to:", voterSBTAddress);

  // // Deploy Verifier contract (ZoKrates generated)
  console.log("Deploying Verifier...");
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("Verifier deployed to:", verifierAddress);

  // Deploy ZKVotingSystem contract (with addresses of the other contracts)
  console.log("Deploying ZKVotingSystem...");
  const ZKVotingSystem = await ethers.getContractFactory("ZKVotingSystem");
  const zkVotingSystem = await ZKVotingSystem.deploy(voterSBTAddress, verifierAddress);
  await zkVotingSystem.waitForDeployment();
  const zkVotingSystemAddress = await zkVotingSystem.getAddress();
  console.log("ZKVotingSystem deployed to:", zkVotingSystemAddress);

  
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("VoterSBT:         ", voterSBTAddress);
  console.log("Verifier:         ", verifierAddress);
  console.log("ZKVotingSystem:   ", zkVotingSystemAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
