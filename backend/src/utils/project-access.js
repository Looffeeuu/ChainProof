export function isProjectMember(project, memberId) {
  const normalizedMemberId = typeof memberId === 'string' ? memberId.trim() : ''
  return Boolean(
    normalizedMemberId &&
    Array.isArray(project?.members) &&
    project.members.includes(normalizedMemberId)
  )
}

export function visibleProjects(projects, memberId) {
  const list = Array.isArray(projects) ? projects : []
  const normalizedMemberId = typeof memberId === 'string' ? memberId.trim() : ''

  if (!normalizedMemberId) return list

  return list.filter((project) => isProjectMember(project, normalizedMemberId))
}


// The REST contract exposes business fields, not Fabric's internal docType.
export function publicProject(project) {
  const { projectId, name, description, ownerId, members, createdAt, status, txId } = project
  return {
    projectId,
    name,
    description,
    ownerId,
    members,
    createdAt,
    status,
    ...(txId === undefined ? {} : { txId })
  }
}
