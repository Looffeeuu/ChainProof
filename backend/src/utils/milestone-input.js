import { ApplicationError } from './application-error.js'

const SHA256_HEX = /^[0-9a-f]{64}$/

export function parseContributors(raw) {
  let contributors
  try {
    contributors = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    throw new ApplicationError(400, 'VALIDATION_ERROR', 'contributors 必须是合法的 JSON 数组。')
  }

  if (!Array.isArray(contributors) || contributors.length === 0) {
    throw new ApplicationError(400, 'VALIDATION_ERROR', 'contributors 不能为空，至少需要一名贡献者。')
  }

  const seen = new Set()
  const normalized = contributors.map((item, index) => {
    const memberId = typeof item?.memberId === 'string' ? item.memberId.trim() : ''
    if (!memberId) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', `contributors[${index}].memberId 必须是非空字符串。`)
    }
    if (seen.has(memberId)) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', `contributors 中成员 ${memberId} 重复出现。`)
    }
    seen.add(memberId)

    const percentage = item?.percentage
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      throw new ApplicationError(
        400,
        'VALIDATION_ERROR',
        `contributors[${index}].percentage 必须是 0 到 100 之间的整数。`
      )
    }
    return { memberId, percentage }
  })

  const total = normalized.reduce((sum, item) => sum + item.percentage, 0)
  if (total !== 100) {
    throw new ApplicationError(
      400,
      'CONTRIBUTION_TOTAL_INVALID',
      `贡献比例总和是 ${total}%，必须正好是 100%。`
    )
  }
  return normalized
}

export function assertMatchingFileHash(clientFileHash, serverFileHash) {
  if (typeof clientFileHash !== 'string' || !SHA256_HEX.test(clientFileHash)) {
    throw new ApplicationError(
      400,
      'VALIDATION_ERROR',
      'clientFileHash 必须是 64 位小写十六进制的 SHA-256 摘要。'
    )
  }
  if (clientFileHash !== serverFileHash) {
    throw new ApplicationError(
      400,
      'FILE_HASH_MISMATCH',
      `文件哈希不一致：浏览器 ${clientFileHash.slice(0, 8)}…，服务器 ${serverFileHash.slice(0, 8)}…。`
    )
  }
}
