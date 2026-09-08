# ChainProof REST API Draft

Base URL: `/api`

This is the initial frontend/backend contract for the MVP. Exact payloads may evolve, but endpoint responsibilities should remain stable.

## Health

### GET `/health`
Returns backend status.

## Projects

### POST `/projects`
Create a project.

Example request:

```json
{
  "name": "VLA Safety Benchmark",
  "description": "Course demo project",
  "ownerId": "alice",
  "members": ["alice", "bob", "charlie"]
}
```

### GET `/projects`
List projects visible to the current demo user.

### GET `/projects/:projectId`
Get project details.

### GET `/projects/:projectId/milestones`
Get project milestones in chronological order.

### GET `/projects/:projectId/history`
Get ledger-backed project history.

## Milestones

### POST `/projects/:projectId/milestones`
Submit a milestone using `multipart/form-data`.

Fields:
- `title`
- `description`
- `contributors` as JSON
- `file`

The backend computes SHA-256 and submits the digest to Fabric.

### GET `/milestones/:milestoneId`
Get one milestone.

### POST `/milestones/:milestoneId/confirmations`
Confirm or reject a contribution claim.

```json
{
  "memberId": "bob",
  "decision": "CONFIRMED"
}
```

## Dashboard

### GET `/projects/:projectId/contributions`
Return aggregate contribution data for visualization.

Example response:

```json
{
  "projectId": "P001",
  "members": [
    { "memberId": "alice", "percentage": 42 },
    { "memberId": "bob", "percentage": 31 },
    { "memberId": "charlie", "percentage": 27 }
  ]
}
```

## Certificates

### POST `/projects/:projectId/certificates`
Issue project contribution certificates after verification requirements are satisfied.

### GET `/certificates/:certificateId`
Return certificate details.

### GET `/verify/:certificateId`
Public verification endpoint.

## Error shape

All API errors should use a consistent response:

```json
{
  "error": {
    "code": "CONTRIBUTION_TOTAL_INVALID",
    "message": "Contribution percentages must sum to 100."
  }
}
```

## MVP conventions

- IDs may be UUIDs or stable generated IDs.
- Use ISO 8601 timestamps.
- Do not expose Fabric private keys or connection details through the API.
- Blockchain transaction IDs may be returned as optional metadata for demo purposes.
