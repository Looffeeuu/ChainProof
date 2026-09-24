export function currentMemberId(req) {
  const headerValue = req.get('X-Member-Id')
  return typeof headerValue === 'string' && headerValue.trim() ? headerValue.trim() : null
}
