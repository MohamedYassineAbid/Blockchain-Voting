import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import { formatAddress } from "./format.js";
import { deploymentInfo, getWalletContext, hasDeployment, votingContract } from "./blockchain/contract.js";

function shortError(error) {
  const message = error?.shortMessage || error?.reason || error?.message || "Something went wrong.";
  if (message.includes("Already voted")) return "This wallet has already voted in this election.";
  if (message.includes("Voting is closed")) return "Voting has closed. No more votes can be submitted.";
  if (message.includes("user rejected")) return "The transaction was cancelled in MetaMask.";
  if (message.includes("could not detect network")) return "Could not reach the selected network. Check your wallet connection.";
  return message.replace(/execution reverted: /i, "");
}

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [votingOpen, setVotingOpen] = useState(null);
  const [owner, setOwner] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");
  const [lastUpdated, setLastUpdated] = useState(null);

  const totalVotes = useMemo(() => candidates.reduce((sum, c) => sum + c.voteCount, 0), [candidates]);

  const refresh = useCallback(async (currentWallet = wallet) => {
    if (!hasDeployment || !window.ethereum) return;
    try {
      const provider = currentWallet?.provider ?? new BrowserProvider(window.ethereum);
      const contract = votingContract(provider);
      const count = Number(await contract.getCandidateCount());
      const rows = await Promise.all(Array.from({ length: count }, async (_, id) => {
        const candidate = await contract.candidates(id);
        return { id, name: candidate.name, voteCount: Number(candidate.voteCount) };
      }));
      setCandidates(rows);
      setVotingOpen(await contract.votingOpen());
      setOwner(await contract.owner());
      if (currentWallet?.account) setHasVoted(await contract.hasVoted(currentWallet.account));
      setLastUpdated(new Date());
    } catch (error) {
      setNotice(shortError(error));
      setNoticeType("error");
    }
  }, [wallet]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!hasDeployment || !window.ethereum) return undefined;
    let contract;
    let timer;
    try {
      contract = votingContract(new BrowserProvider(window.ethereum));
      const update = () => refresh();
      contract.on("VoteCast", update);
      contract.on("VotingClosed", update);
      timer = window.setInterval(update, 12000);
      return () => { window.clearInterval(timer); contract.removeAllListeners(); };
    } catch {
      return undefined;
    }
  }, [refresh]);

  useEffect(() => {
    if (!window.ethereum) return undefined;
    const onAccounts = async () => {
      setWallet(null);
      setHasVoted(false);
      await refresh(null);
    };
    const onChain = () => window.location.reload();
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [refresh]);

  async function connectWallet() {
    setNotice("");
    try {
      if (!window.ethereum) throw new Error("MetaMask was not found. Install the MetaMask browser extension to continue.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const context = await getWalletContext();
      setWallet(context);
      if (hasDeployment && deploymentInfo.chainId && context.chainId !== deploymentInfo.chainId) {
        setNotice(`Switch MetaMask to ${deploymentInfo.network} (chain ${deploymentInfo.chainId}) to use this election.`);
        setNoticeType("error");
      }
      await refresh(context);
    } catch (error) {
      setNotice(shortError(error));
      setNoticeType("error");
    }
  }

  async function vote(candidateId) {
    setBusy(true);
    setSelected(candidateId);
    setNotice("Confirm the vote in MetaMask. It will appear after the transaction is mined.");
    setNoticeType("info");
    try {
      const context = await getWalletContext();
      if (deploymentInfo.chainId && context.chainId !== deploymentInfo.chainId) throw new Error(`Switch MetaMask to ${deploymentInfo.network} (chain ${deploymentInfo.chainId}) first.`);
      const contract = votingContract(context.signer);
      const tx = await contract.vote(candidateId);
      setNotice("Transaction submitted. Waiting for block confirmation…");
      const receipt = await tx.wait();
      await refresh(context);
      setNotice(`Vote confirmed in block ${receipt.blockNumber}.`);
      setNoticeType("success");
    } catch (error) {
      setNotice(shortError(error));
      setNoticeType("error");
    } finally {
      setBusy(false);
      setSelected(null);
    }
  }

  async function closeElection() {
    setBusy(true);
    try {
      const context = await getWalletContext();
      const tx = await votingContract(context.signer).closeVoting();
      setNotice("Closing election… waiting for block confirmation.");
      setNoticeType("info");
      await tx.wait();
      await refresh(context);
      setNotice("Election closed. Results are final on this contract.");
      setNoticeType("success");
    } catch (error) {
      setNotice(shortError(error));
      setNoticeType("error");
    } finally { setBusy(false); }
  }

  const isOwner = wallet && owner && wallet.account.toLowerCase() === owner.toLowerCase();
  const canVote = wallet && votingOpen && !hasVoted && !busy && hasDeployment && (!deploymentInfo.chainId || wallet.chainId === deploymentInfo.chainId);

  return (
    <main className="app-shell" data-ui>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Campus Vote home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Campus Vote</span>
        </a>
        <div className="topbar-right">
          <span className={`network-label ${hasDeployment ? "" : "muted-label"}`}>{hasDeployment ? deploymentInfo.network : "Contract not deployed"}</span>
          {wallet ? <button className="wallet-button connected" onClick={connectWallet} title="Reconnect wallet">{formatAddress(wallet.account)}</button> : <button className="wallet-button" onClick={connectWallet}>Connect wallet</button>}
        </div>
      </header>

      <section className="election-head" id="top">
        <div>
          <p className="eyebrow">STUDENT COUNCIL · 2026</p>
          <h1>University Election</h1>
          <p className="subhead">Cast one vote with your wallet. Counts update from confirmed blockchain transactions.</p>
        </div>
        <div className={`election-state ${votingOpen === null ? "unknown" : votingOpen ? "open" : "closed"}`}><span className="state-dot" />{votingOpen === null ? "Awaiting contract" : votingOpen ? "Voting open" : "Voting closed"}</div>
      </section>

      {!hasDeployment && <div className="setup-banner" role="status"><strong>Ready to connect your contract.</strong><span>Deploy from the blockchain folder and the script will write the address and ABI here.</span></div>}
      {notice && <div className={`notice ${noticeType}`} role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}

      <section className="summary-row" aria-label="Election summary">
        <div className="summary-stat"><span className="stat-label">Total votes</span><strong>{totalVotes}</strong></div>
        <div className="summary-stat"><span className="stat-label">Candidates</span><strong>{candidates.length || "—"}</strong></div>
        <div className="summary-stat"><span className="stat-label">Your ballot</span><strong className="ballot-state">{!hasDeployment ? "—" : !wallet ? "Connect wallet" : hasVoted ? "Submitted" : votingOpen ? "Not submitted" : "Closed"}</strong></div>
        <div className="summary-updated"><span className="live-mark" />Live results <small>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for network"}</small></div>
      </section>

      <section className="candidate-section">
        <div className="section-title"><div><h2>Choose your candidate</h2><p>One vote per wallet address. Your selection is public on-chain.</p></div><button className="refresh-button" onClick={() => refresh()} disabled={!hasDeployment}>Refresh results <span aria-hidden="true">↻</span></button></div>
        {candidates.length ? <div className="candidate-list">
          {candidates.map((candidate, index) => {
            const percentage = totalVotes ? Math.round(candidate.voteCount / totalVotes * 100) : 0;
            return <article className="candidate-row" key={candidate.id}>
              <div className="candidate-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="candidate-info"><h3>{candidate.name}</h3><div className="bar-track" role="meter" aria-label={`${candidate.name} share of votes`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage}><span style={{ width: `${percentage}%` }} /></div></div>
              <div className="candidate-results"><strong>{candidate.voteCount}</strong><span>{percentage}%</span></div>
              <button className="vote-button" aria-label={`Vote for ${candidate.name}`} disabled={!canVote} onClick={() => vote(candidate.id)}>{busy && selected === candidate.id ? "Confirming…" : "Vote"}<span aria-hidden="true">↗</span></button>
            </article>;
          })}
        </div> : <div className="empty-state"><span className="empty-symbol">V</span><p>{hasDeployment ? "Reading candidates from the contract…" : "Deploy the contract to load the candidate list and live results."}</p></div>}
      </section>

      <section className="lower-grid">
        <div className="how-panel"><h2>How your vote is counted</h2><ol><li><span>01</span><p>Connect a MetaMask wallet on the election’s network.</p></li><li><span>02</span><p>Choose one candidate and confirm the transaction.</p></li><li><span>03</span><p>The contract records your address and updates the public count.</p></li></ol></div>
        <div className="transparency-panel"><h2>On-chain transparency</h2><p>Each address can vote once. Votes and wallet addresses are public; the contract does not provide ballot secrecy or verify a voter’s real-world identity.</p>{owner && <div className="owner-line"><span>Election administrator</span><code>{formatAddress(owner)}</code></div>}{isOwner && votingOpen && <button className="close-button" disabled={busy} onClick={closeElection}>Close election</button>}</div>
      </section>

      <footer className="footer"><span>Campus Vote <span className="footer-sep">/</span> Demonstration application</span><span>Votes are recorded on {hasDeployment ? deploymentInfo.network : "the configured network"}</span></footer>
    </main>
  );
}

