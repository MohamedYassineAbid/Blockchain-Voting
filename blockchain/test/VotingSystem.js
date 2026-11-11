const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingSystem", function () {
  async function deploy() {
    const [owner, voter1, voter2, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("VotingSystem");
    const voting = await Factory.deploy(["Amina", "Youssef", "Lina"]);
    return { voting, owner, voter1, voter2, other };
  }

  it("creates candidates with zero votes and sets the deployer as owner", async function () {
    const { voting, owner } = await deploy();
    expect(await voting.owner()).to.equal(owner.address);
    expect(await voting.getCandidateCount()).to.equal(3);
    expect((await voting.candidates(0)).name).to.equal("Amina");
    expect((await voting.candidates(0)).voteCount).to.equal(0);
    expect(await voting.votingOpen()).to.equal(true);
  });

  it("requires at least two candidates and rejects empty candidate names", async function () {
    const Factory = await ethers.getContractFactory("VotingSystem");
    await expect(Factory.deploy(["Only one"])).to.be.revertedWith("Need at least 2 candidates");
    await expect(Factory.deploy(["Amina", ""])).to.be.revertedWith("Candidate name is empty");
  });

  it("records a vote and emits VoteCast", async function () {
    const { voting, voter1 } = await deploy();
    await expect(voting.connect(voter1).vote(1))
      .to.emit(voting, "VoteCast")
      .withArgs(voter1.address, 1);
    expect((await voting.candidates(1)).voteCount).to.equal(1);
    expect(await voting.hasVoted(voter1.address)).to.equal(true);
  });

  it("prevents an address from voting twice", async function () {
    const { voting, voter1 } = await deploy();
    await voting.connect(voter1).vote(0);
    await expect(voting.connect(voter1).vote(2)).to.be.revertedWith("Already voted");
  });

  it("allows a different address to vote", async function () {
    const { voting, voter1, voter2 } = await deploy();
    await voting.connect(voter1).vote(0);
    await voting.connect(voter2).vote(2);
    expect((await voting.candidates(0)).voteCount).to.equal(1);
    expect((await voting.candidates(2)).voteCount).to.equal(1);
  });

  it("rejects an invalid candidate id", async function () {
    const { voting, voter1 } = await deploy();
    await expect(voting.connect(voter1).vote(3)).to.be.revertedWith("Invalid candidate");
  });

  it("allows only the owner to close voting and rejects votes after closure", async function () {
    const { voting, owner, voter1, other } = await deploy();
    await expect(voting.connect(other).closeVoting()).to.be.revertedWith("Not authorized");
    await expect(voting.connect(owner).closeVoting()).to.emit(voting, "VotingClosed");
    expect(await voting.votingOpen()).to.equal(false);
    await expect(voting.connect(voter1).vote(0)).to.be.revertedWith("Voting is closed");
    await expect(voting.connect(owner).closeVoting()).to.be.revertedWith("Voting is already closed");
  });
});
