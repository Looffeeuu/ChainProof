# Team Workflow

## Team structure

ChainProof is designed for a three-person team. Each member owns one primary track while reviewing integration work from the others.

### Track A — Frontend / Product
Owns:
- Vue pages and components
- Responsive layout
- Dashboard and timeline
- Certificate and verification views
- Demo polish

### Track B — Blockchain / Smart Contract
Owns:
- Fabric test-network setup
- Chaincode data model and transactions
- Ledger history queries
- Contract tests
- Deployment documentation

### Track C — Backend / Integration
Owns:
- Express REST API
- SHA-256 file hashing
- Upload handling
- Fabric Gateway connection
- Error mapping
- Frontend/backend integration

## Branch convention

Use one branch per issue:

```text
feat/1-fabric-network
feat/2-chaincode-core
feat/3-backend-foundation
feat/4-frontend-foundation
fix/<issue>-short-description
docs/<issue>-short-description
```

## Pull request rule

- Do not push feature work directly to `main` once team development begins.
- Link every PR to its GitHub Issue.
- Keep PRs small enough to review in roughly 10 minutes.
- At least one teammate should review integration-sensitive PRs.
- Squash merge is preferred for clean course-project history.

## Definition of done

An issue is done only when:
- implementation is committed;
- acceptance criteria are manually or automatically checked;
- setup/documentation changes are included;
- no secrets or generated Fabric credentials are committed;
- the relevant demo flow works from a clean checkout where practical.

## Weekly rhythm

Each week:
1. Agree on the week's acceptance criteria.
2. Work independently on owned issues.
3. Integrate before the end of the week.
4. Record blockers in the issue instead of private chat only.
5. Keep the final week for polish and delivery rather than new features.

## Scope protection

Do not add tokens, NFT functionality, payments, cross-chain features, AI contribution scoring, or complex dispute arbitration unless all MVP acceptance criteria are already complete.
