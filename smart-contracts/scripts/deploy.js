const hre = require("hardhat");

async function main() {
  try {
    // Get the network
    const { network } = hre;
    
    // Get the contract factory
    const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
    console.log("Deploying VotingSystem...");
    
    // Deploy the contract
    const votingSystem = await VotingSystem.deploy();
    
    // Wait for deployment transaction to be mined
    await votingSystem.waitForDeployment();

    // Get the deployed contract address
    const votingSystemAddress = await votingSystem.getAddress();
    console.log("VotingSystem deployed to:", votingSystemAddress);
    
    // Verify the contract on Etherscan (if not on a local network)
    if (network.config.chainId !== 31337 && process.env.ETHERSCAN_API_KEY) {
      console.log("Waiting for block confirmations...");
      // Wait for 6 blocks after deployment
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      await verify(votingSystemAddress, []);
    }
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

async function verify(contractAddress, args) {
  console.log("Verifying contract...");
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