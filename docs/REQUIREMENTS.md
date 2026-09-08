# ChainProof MVP Requirements

## 1. Product goal

ChainProof provides a trustworthy way for project teams to record milestones, contribution claims, confirmations, and final contribution evidence.

The MVP should demonstrate one complete scenario from project creation to certificate verification within a short classroom demo.

## 2. Roles

### Project owner
- Creates a project.
- Adds members.
- Submits or reviews milestones.

### Team member
- Views assigned projects.
- Reviews contribution claims.
- Confirms or rejects a claim.

### External verifier
- Opens a public verification page using a certificate ID.
- Checks whether the certificate exists and matches the ledger record.

## 3. Core entities

### Project
- projectId
- name
- description
- ownerId
- members[]
- createdAt
- status

### Milestone
- milestoneId
- projectId
- title
- description
- fileName
- fileHash
- contributors[]
- confirmations[]
- createdAt
- status

### Contributor record
- memberId
- percentage

### Confirmation record
- memberId
- decision: CONFIRMED | REJECTED
- timestamp

### Certificate
- certificateId
- projectId
- memberId
- contributionPercentage
- milestoneIds[]
- issuedAt
- verificationStatus

## 4. Functional requirements

### FR-01 Project creation
Users can create a project with project name, description, and members.

### FR-02 Milestone submission
Users can submit a milestone linked to a project.

### FR-03 File hashing
The backend computes SHA-256 for an uploaded file. The file itself remains off-chain.

### FR-04 Contribution declaration
The milestone submitter allocates contribution percentages to project members. Total must equal 100%.

### FR-05 Member confirmation
Project members can confirm or reject the contribution declaration.

### FR-06 Verification state
A milestone becomes VERIFIED when the configured confirmation rule is satisfied.

For the course MVP, the default rule is unanimous confirmation by all listed contributors.

### FR-07 Timeline
Users can view milestones chronologically with on-chain verification status.

### FR-08 Contribution dashboard
Users can view aggregated contribution percentages and milestone counts.

### FR-09 Certificate issuance
A verified project can generate per-member contribution certificates.

### FR-10 Certificate verification
An external verifier can enter a certificate ID and verify its ledger-backed record.

## 5. Non-functional requirements

- Browser-based B/S application.
- Responsive and visually consistent interface.
- Core demo flow must work without editing ledger data manually.
- Critical blockchain transactions must return clear success/error feedback.
- Generated private keys, certificates, and secrets must not be committed.
- Demo should be reproducible from documented setup commands.

## 6. Out of scope for MVP

- Cryptocurrency or token incentives
- NFT issuance
- Payments
- Cross-chain interoperability
- Real-name identity verification
- Production deployment or public consortium governance
- Complex dispute arbitration
- AI scoring of contributions

## 7. Demo success criteria

A 7-minute demo should be able to show:

1. Create a project.
2. Submit a milestone and upload a file.
3. Show its SHA-256 hash.
4. Allocate contributions.
5. Confirm contributions from team members.
6. Show milestone as blockchain verified.
7. View project timeline and contribution dashboard.
8. Open a certificate verification page and receive a valid result.
