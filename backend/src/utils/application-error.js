const CHAINCODE_ERROR_STATUS = Object.freeze({
  PROJECT_NOT_FOUND: 404,
  MILESTONE_NOT_FOUND: 404,
  CERTIFICATE_NOT_FOUND: 404,
  CONTRIBUTION_TOTAL_INVALID: 400,
  MEMBER_NOT_IN_CLAIM: 403,
  ALREADY_DECIDED: 409,
  MILESTONE_CLOSED: 409,
  FILE_HASH_MISMATCH: 400,
  NO_VERIFIED_CONTRIBUTION: 409,
  VALIDATION_ERROR: 400
})

export function mapApplicationError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const structured = parseChaincodeError(message)
  if (structured) return structured

  let match = message.match(/Project\s+([^\s]+)\s+does not exist/i)
  if (match) {
    return { status: 404, code: 'PROJECT_NOT_FOUND', message: `项目 ${match[1]} 不存在。` }
  }

  match = message.match(/Milestone\s+([^\s]+)\s+does not exist/i)
  if (match) {
    return { status: 404, code: 'MILESTONE_NOT_FOUND', message: `里程碑 ${match[1]} 不存在。` }
  }

  if (/Project\s+.+\s+already exists/i.test(message)) {
    return { status: 409, code: 'PROJECT_ALREADY_EXISTS', message: '该项目 ID 已存在，请更换后重试。' }
  }

  if (/Milestone\s+.+\s+already exists/i.test(message)) {
    return { status: 409, code: 'MILESTONE_ALREADY_EXISTS', message: '该里程碑 ID 已存在，请更换后重试。' }
  }

  if (/Contribution percentages must sum to 100/i.test(message)) {
    return { status: 400, code: 'CONTRIBUTION_TOTAL_INVALID', message: '贡献比例总和必须正好等于 100%。' }
  }

  if (/not a contributor/i.test(message)) {
    return { status: 403, code: 'MEMBER_NOT_IN_CLAIM', message: '当前成员不在这份贡献声明中，无法表态。' }
  }

  if (/already decided|already confirmed|already rejected/i.test(message)) {
    return { status: 409, code: 'ALREADY_DECIDED', message: '当前成员已经表过态，MVP 中不能撤回或改票。' }
  }

  if (/milestone.*closed|already verified|already rejected|no longer accepts/i.test(message)) {
    return { status: 409, code: 'MILESTONE_CLOSED', message: '该里程碑已经结束，不再接受新的表态。' }
  }

  if (/Decision must be CONFIRMED or REJECTED/i.test(message)) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'decision 只能是 CONFIRMED 或 REJECTED。' }
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误，请查看后端日志。'
  }
}

function parseChaincodeError(message) {
  for (const [code, status] of Object.entries(CHAINCODE_ERROR_STATUS)) {
    const marker = `${code}:`
    const markerIndex = message.lastIndexOf(marker)
    if (markerIndex === -1) continue

    const rawDetail = message.slice(markerIndex + marker.length).trim()
    const firstLine = rawDetail.split(/\r?\n/, 1)[0].trim()
    const sentence = firstLine.match(/^.*?。/)?.[0] ?? firstLine

    return {
      status,
      code,
      message: sentence || '链上交易未通过业务校验。'
    }
  }

  return null
}

