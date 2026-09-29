export function publicCertificate(certificate) {
  if (!certificate || typeof certificate !== 'object') return certificate

  const {
    certificateId,
    projectId,
    memberId,
    contributionPercentage,
    milestoneIds,
    issuedAt,
    verificationStatus,
    txId
  } = certificate

  return {
    certificateId,
    projectId,
    memberId,
    contributionPercentage,
    milestoneIds,
    issuedAt,
    verificationStatus,
    txId
  }
}

export function publicVerification(result) {
  if (!result || typeof result !== 'object') return result

  return {
    certificateId: result.certificateId,
    verificationStatus: result.verificationStatus,
    ...(result.certificate ? { certificate: publicCertificate(result.certificate) } : {})
  }
}
