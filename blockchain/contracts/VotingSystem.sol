// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VotingSystem
/// @notice A single-election voting contract with one vote per Ethereum address.
/// @dev Votes and voter addresses are public on-chain; this contract does not provide ballot secrecy.
contract VotingSystem {
    struct Candidate {
        string name;
        uint256 voteCount;
    }

    address public immutable owner;
    bool public votingOpen = true;

    Candidate[] public candidates;
    mapping(address => bool) public hasVoted;

    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event VotingClosed();

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor(string[] memory candidateNames) {
        require(candidateNames.length >= 2, "Need at least 2 candidates");

        owner = msg.sender;
        for (uint256 i = 0; i < candidateNames.length; i++) {
            require(bytes(candidateNames[i]).length > 0, "Candidate name is empty");
            candidates.push(Candidate({name: candidateNames[i], voteCount: 0}));
        }
    }

    function vote(uint256 candidateId) external {
        require(votingOpen, "Voting is closed");
        require(!hasVoted[msg.sender], "Already voted");
        require(candidateId < candidates.length, "Invalid candidate");

        // Update state before emitting the event; any later failure reverts the whole transaction.
        hasVoted[msg.sender] = true;
        candidates[candidateId].voteCount++;

        emit VoteCast(msg.sender, candidateId);
    }

    function getCandidateCount() external view returns (uint256) {
        return candidates.length;
    }

    function closeVoting() external onlyOwner {
        require(votingOpen, "Voting is already closed");
        votingOpen = false;
        emit VotingClosed();
    }
}
