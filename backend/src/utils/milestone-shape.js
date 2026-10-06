export function publicMilestone(milestone) {
  if (!milestone || typeof milestone !== 'object') return milestone
  const {
    milestoneId,
    projectId,
    title,
    description,
    fileName,
    fileHash,
    submitterId,
    requiredConfirmerIds,
    contributors,
    confirmations,
    createdAt,
    status,
    txId
  } = milestone
  return {
    milestoneId,
    projectId,
    title,
    description,
    fileName,
    fileHash,
    submitterId,
    requiredConfirmerIds,
    contributors,
    confirmations,
    createdAt,
    status,
    txId
  }
}
