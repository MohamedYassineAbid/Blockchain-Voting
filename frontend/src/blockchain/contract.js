import { BrowserProvider, Contract } from "ethers";
import deployment from "./deployment.json";

export const deploymentInfo = deployment;
export const hasDeployment = Boolean(deployment.address && deployment.abi?.length);

export async function getWalletContext() {
  if (!window.ethereum) throw new Error("MetaMask was not found. Install the MetaMask browser extension to continue.");
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  return { provider, signer, account: await signer.getAddress(), chainId: Number(network.chainId) };
}

export function votingContract(signerOrProvider) {
  if (!hasDeployment) throw new Error("No contract is deployed yet. Follow the deployment steps in the project README.");
  return new Contract(deployment.address, deployment.abi, signerOrProvider);
}
