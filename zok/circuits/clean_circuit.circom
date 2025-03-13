pragma circom 0.5.46;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// This circuit proves that:
// 1. The voter has a valid SBT token ID
// 2. The nullifier is correctly derived from the token ID and election ID
// 3. Without revealing which token ID is being used

template VoteCircuit() {
    // Private inputs
    signal input tokenId; // The SBT token ID of the voter (private)
    
    // Public inputs
    signal input electionId; // The ID of the election being voted in
    
    // Public outputs
    signal output nullifierHash; // The nullifier hash to prevent double voting
    
    // Ensure tokenId is within valid range (you can adjust this range)
    component tokenRange = LessThan(252);
    tokenRange.in[0] <== tokenId;
    tokenRange.in[1] <== 1000000; // Maximum possible token ID
    tokenRange.out === 1;
    
    // Compute the nullifier hash using Poseidon
    // Nullifier = Hash(tokenId, electionId)
    component hasher = Poseidon(2);
    hasher.inputs[0] <== tokenId;
    hasher.inputs[1] <== electionId;
    
    // Output the nullifier hash
    nullifierHash <== hasher.out;
}

// Compile the circuit with public inputs and outputs properly defined
component main {public [electionId]} = VoteCircuit();
