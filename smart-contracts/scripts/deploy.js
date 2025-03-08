const hre = require("hardhat");

async function main() {
  try {
    const { network } = hre;

    // Deploy VotingSystem
    const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
    console.log("Deploying VotingSystem...");
    const votingSystem = await VotingSystem.deploy();
    await votingSystem.waitForDeployment();
    const votingSystemAddress = await votingSystem.getAddress();
    console.log("VotingSystem deployed to:", votingSystemAddress);

    // Deploy PublicFundTreasury
    const PublicFundTreasury = await hre.ethers.getContractFactory("PublicFundTreasury");
    console.log("Deploying PublicFundTreasury...");
    const publicFundTreasury = await PublicFundTreasury.deploy();
    await publicFundTreasury.waitForDeployment();
    const publicFundTreasuryAddress = await publicFundTreasury.getAddress();
    console.log("PublicFundTreasury deployed to:", publicFundTreasuryAddress);

    // Verify VotingSystem (if not on a local network)
    if (network.config.chainId !== 31337 && process.env.ETHERSCAN_API_KEY) {
      console.log("Waiting for block confirmations...");
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s

      await verify(votingSystemAddress, []);
      await verify(publicFundTreasuryAddress, []);
    }

  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

async function verify(contractAddress, args) {
  console.log(`Verifying contract at ${contractAddress}...`);
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already verified!");
    } else {
      console.log("Verification error:", e);
    }
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
