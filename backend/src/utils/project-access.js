export function visibleProjects(projects, memberId) {
  const list = Array.isArray(projects) ? projects : []
  const normalizedMemberId = typeof memberId === 'string' ? memberId.trim() : ''

  if (!normalizedMemberId) return list

  return list.filter(
    (project) =>
      Array.isArray(project?.members) && project.members.includes(normalizedMemberId)
  )
}

