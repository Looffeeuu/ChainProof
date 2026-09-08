# ChainProof

> Blockchain-based collaborative contribution verification platform

ChainProof is a course project for **Blockchain Technology Application Practice**. It provides tamper-evident records for collaborative project milestones, file hashes, contribution claims, member confirmations, and final contribution certificates.

## Why ChainProof?

Team projects often have disputes around who contributed what, when a result was produced, and whether historical contribution records were changed later. ChainProof records the critical evidence on Hyperledger Fabric so verified milestones can be traced and independently checked.

## Core workflow

1. Create a project and register team members.
2. Submit a milestone with description and file hash.
3. Declare contributor percentages.
4. Team members confirm the contribution claim.
5. Once confirmation conditions are satisfied, the milestone becomes verified on-chain.
6. The application displays a project timeline and contribution dashboard.
7. At project completion, ChainProof generates a verifiable contribution certificate.

## MVP scope

- Project creation and member management
- Milestone submission
- SHA-256 file hashing
- Contribution percentage declaration
- Multi-member confirmation
- Hyperledger Fabric ledger storage
- Project timeline
- Contribution dashboard
- Certificate verification page

## Tech stack

- **Frontend:** Vue 3 + Vite
- **Backend:** Node.js + Express
- **Blockchain:** Hyperledger Fabric + JavaScript chaincode
- **Database:** SQLite for off-chain application data
- **Integration:** Fabric Gateway SDK

## Repository structure

```text
ChainProof/
├── frontend/                 # Vue frontend
├── backend/                  # Express API + Fabric Gateway integration
├── blockchain/
│   ├── chaincode/            # Fabric smart contract
│   └── network/              # Local Fabric network documentation/config
├── docs/
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── TEAM_WORKFLOW.md
├── .gitignore
└── README.md
```

## Four-week plan

### Week 1 — Foundation
- Run Fabric test network locally
- Define on-chain data models
- Implement basic chaincode for projects and milestones
- Scaffold frontend/backend

### Week 2 — Core workflow
- File hashing
- Contribution declaration
- Member confirmation
- Express ↔ Fabric integration

### Week 3 — Product experience
- Dashboard
- Timeline
- Contribution visualization
- Certificate generation and verification

### Week 4 — Delivery
- Integration testing and bug fixes
- Demo data and UI polish
- PPT, project report, demo video

## Development principle

Keep the blockchain layer focused on data that benefits from tamper evidence and shared verification. Large files, UI metadata, and replaceable application data stay off-chain.

## Status

🚧 Initial development setup in progress.
