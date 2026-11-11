# Campus Vote

A small educational DApp for a single student election. Solidity enforces the voting rules; React reads the contract and sends transactions through MetaMask. The contract is the source of truth, so refreshing or manipulating the page cannot bypass its one-vote-per-address check.

This is a demonstration, not a secure real-world election system. A person can create multiple Ethereum addresses, and both addresses and votes are public on-chain. The contract does not verify voter identity or keep ballots secret.



## Requirements

- Node.js 22.13 or newer
- npm
- MetaMask browser extension (the candidate list and results only load when a wallet provider such as MetaMask is present)

## 1. Install dependencies

```bash
cd blockchain
npm install
cd ../frontend
npm install
```

## 2. Start a local blockchain

In one terminal:

```bash
cd blockchain
npm run node
```

Keep this process running. It starts a local chain on `http://127.0.0.1:8545` (chain ID `31337`) and prints 20 funded demo accounts with their private keys.

- **Account #0 is the administrator.** The deploy script uses the first account, so this is the only account that sees the Close election button.
- Import any other printed key into MetaMask (Account menu → Import account) to create a voter.

Treat these keys as local demo keys only; never use them on a public network.

In MetaMask, add a network with:

- Network name: Hardhat Local
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

## 3. Deploy the contract locally

In another terminal:

```bash
cd blockchain
npm run deploy:local
```

The script deploys three sample candidates and writes the contract address, ABI, chain ID, and network into `frontend/src/blockchain/deployment.json`. To change the candidate list, set `CANDIDATES` before deploying (at least two names, comma-separated):

```bash
CANDIDATES="Candidate One,Candidate Two,Candidate Three" npm run deploy:local
```

Deploying overwrites `deployment.json`, so the frontend always points at the most recent deployment.

## 4. Start the React app

In another terminal:

```bash
cd frontend
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Then:

1. Click **Connect wallet** and approve the MetaMask request on Hardhat Local.
2. Choose a candidate and confirm the transaction. The page shows "Vote confirmed in block N" once it is mined.
3. Switch MetaMask to another funded account and vote again. Each address can vote once.
4. Switch to account #0 to see the **Close election** control. Closing is permanent.

Results refresh from contract events and every 12 seconds as a fallback.

## Troubleshooting

- **"Contract not deployed" or "Ready to connect your contract"**: run `npm run deploy:local` from `blockchain/`, then reload the page.
- **Candidate list stays on "Reading candidates from the contract…"**: no wallet provider was found. Install MetaMask and reload.
- **"Switch MetaMask to localhost (chain 31337)"**: select the Hardhat Local network in MetaMask.
- **Transactions fail after restarting `npm run node`**: a restarted Hardhat node starts a new chain. Run `npm run deploy:local` again, and in MetaMask open Settings → Advanced → Clear activity tab data (or Reset account) so its nonce matches the new chain.
- **"Already voted"**: the connected address has already voted. Switch to another account.
- **"Voting has closed"**: the administrator closed the election. Deploy again to start a new election.

## Sepolia deployment (optional)

1. Copy `blockchain/.env.example` to `blockchain/.env`.
2. Set `SEPOLIA_RPC_URL` to an RPC endpoint and `PRIVATE_KEY` to a dedicated test wallet key funded only with Sepolia test ETH. Never commit `.env` or use a wallet holding real funds.
3. From `blockchain/`, run `npm run deploy:sepolia`.
4. Add Sepolia to MetaMask and reload the frontend. The deploy script updates `deployment.json` automatically, so the frontend now targets Sepolia. To return to the local chain, run `npm run deploy:local` again.

The Sepolia network is only registered in `hardhat.config.js` when both variables are set.

## Useful commands

From `blockchain/`:

```bash
npm run compile   # compile the contract and write artifacts/
npm test          # run the contract tests (7 tests, in-memory network)
```

From `frontend/`:

```bash
npm run build     # production build into dist/
npm run preview   # serve dist/ (run npm run build first)
```

## Project map

```text
blockchain/
  contracts/VotingSystem.sol   Election rules and on-chain state
  test/VotingSystem.js         Contract behavior tests
  scripts/deploy.js            Deploys and exports the frontend ABI/address
  hardhat.config.js            Solidity and network configuration
  .env.example                 Template for optional Sepolia settings
frontend/
  index.html                   Vite entry page
  vite.config.js               Vite and React configuration
  src/main.jsx                 React entry point
  src/App.jsx                  Wallet, ballot, live results, and admin action
  src/format.js                Address formatting helper
  src/blockchain/contract.js   ethers.js connection helpers
  src/blockchain/deployment.json  Address, ABI, and network written by deploy.js
  src/styles.css               Responsive application styling
output/
  pdf/                         Project guide and project report PDFs
  report/                      Report screenshots and diagram sources
```

## Contract rules

- At least two non-empty candidate names are required at deployment.
- The deployer is the administrator.
- Each address may cast one vote while voting is open.
- Invalid candidate IDs are rejected.
- Only the administrator may close voting, and a closed election cannot be reopened.
- `VoteCast` and `VotingClosed` events drive frontend updates.
