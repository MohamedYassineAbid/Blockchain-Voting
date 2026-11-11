const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

async function main() {
  const names = process.env.CANDIDATES
    ? process.env.CANDIDATES.split(",").map((name) => name.trim()).filter(Boolean)
    : ["Amina Ben Salem", "Youssef Trabelsi", "Lina Gharbi"];

  const VotingSystem = await hre.ethers.getContractFactory("VotingSystem");
  const voting = await VotingSystem.deploy(names);
  await voting.waitForDeployment();

  const address = await voting.getAddress();
  const artifact = await hre.artifacts.readArtifact("VotingSystem");
  const deployment = {
    address,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    network: hre.network.name,
    abi: artifact.abi,
    deployedAt: new Date().toISOString(),
  };

  const frontendConfig = path.resolve(__dirname, "../../frontend/src/blockchain/deployment.json");
  fs.mkdirSync(path.dirname(frontendConfig), { recursive: true });
  fs.writeFileSync(frontendConfig, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`VotingSystem deployed at ${address} on ${deployment.network} (chain ${deployment.chainId})`);
  console.log(`Frontend deployment config written to ${frontendConfig}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
