# ChainProof Architecture

## 1. Overview

ChainProof uses a conventional B/S web architecture with Hyperledger Fabric as the trusted record layer.

```text
Browser
  |
  v
Vue 3 Frontend
  |
  | REST/JSON
  v
Node.js + Express Backend
  |             |
  |             +--> SQLite / local file storage
  |
  +--> Fabric Gateway SDK
            |
            v
     Hyperledger Fabric
            |
            +--> ChainProof chaincode
```

## 2. On-chain vs off-chain boundary

### On-chain
Store data whose history and integrity should be tamper-evident:
- Project identifiers and core membership references
- Milestone identifiers
- File SHA-256 hashes
- Contribution allocations
- Confirmation decisions
- Verification status
- Certificate records
- Transaction timestamps / ledger history

### Off-chain
Store data that is large, replaceable, presentation-oriented, or privacy-sensitive:
- Uploaded source files
- User avatars
- UI preferences
- Cached dashboard aggregates
- Session information

## 3. Frontend

Technology: Vue 3 + Vite.

Planned views:
- Dashboard
- Project list
- Project detail
- Create project
- Submit milestone
- Contribution confirmation
- Timeline
- Certificate
- Public verification page

The frontend must not communicate directly with Fabric.

## 4. Backend

Technology: Node.js + Express.

Responsibilities:
- REST API
- Input validation
- SHA-256 file hashing
- Local file handling
- Fabric Gateway connection
- Transaction submission/evaluation
- Mapping blockchain errors into user-friendly API errors
- Optional SQLite persistence for off-chain data

Suggested modules:

```text
backend/src/
├── app.js
├── routes/
├── controllers/
├── services/
│   ├── fabric.service.js
│   ├── hash.service.js
│   └── certificate.service.js
└── config/
```

## 5. Blockchain layer

Technology: Hyperledger Fabric with JavaScript chaincode.

Primary smart contract: `ChainProofContract`.

Initial transaction functions:
- `CreateProject`
- `GetProject`
- `CreateMilestone`
- `GetMilestone`
- `ConfirmContribution`
- `GetProjectMilestones`
- `GetProjectHistory`
- `IssueCertificate`
- `VerifyCertificate`

For the MVP, the network may use the official local Fabric test-network. The application architecture should still explain how separate organizations could represent independent stakeholders in a real consortium deployment.

## 6. Integrity model

When a file is submitted:

```text
file bytes
   |
   v
SHA-256
   |
   v
64-character digest
   |
   v
Fabric transaction
```

The uploaded file stays off-chain. Verification recalculates SHA-256 and compares it with the ledger digest.

## 7. Contribution confirmation rule

MVP rule:
- Contributor percentages must sum to exactly 100.
- Every listed contributor must confirm.
- Any rejection prevents automatic verification.
- Once all required confirmations are present, milestone status changes to `VERIFIED`.

This rule is intentionally simple so the project can demonstrate blockchain-backed consensus without building a complex governance engine.

## 8. Security / repository hygiene

Never commit:
- Fabric private keys
- generated certificates
- connection secrets
- `.env` files
- uploaded user files

Use `.env.example` for configuration templates.
