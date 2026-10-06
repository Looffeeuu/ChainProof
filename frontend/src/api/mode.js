/**
 * 每个接口各自决定走真接口还是假数据。
 *
 * 联调是一个接口一个接口切的（docs/API.md §8）。开关要是只有一个全局的，
 * 哪怕只有一个接口没做完，其余做完的也只能陪着一起走假数据。
 *
 * 两个环境变量，写在 frontend/.env.local：
 *
 *   VITE_REAL_APIS=listProjects,getProject   只让这几个走真接口，其余照旧走假数据
 *   VITE_REAL_APIS=*                         全部走真接口
 *   VITE_USE_MOCK=false                      同上，保留这个写法是为了旧的 .env.local 还能用
 *
 * 名字就是 api/ 下导出的函数名，完整清单见下面的 API_NAMES。
 *
 * **混用时要注意数据对不上。** 假数据和真接口是两套库，
 * 「项目走真接口、里程碑走假数据」时，真项目在假数据里查不到里程碑。
 * 所以要按 docs/API.md §8 的顺序从前往后切，前面的先通，后面的才有数据。
 */

/** api/ 下全部可切换的接口，顺序同 docs/API.md §8 */
export const API_NAMES = [
  'listProjects',
  'createProject',
  'getProject',
  'listMilestones',
  'createMilestone',
  'getMilestone',
  'downloadMilestoneFile',
  'confirmMilestone',
  'getContributions',
  'listCertificates',
  'createCertificate',
  'getCertificate',
  'verifyCertificate'
]

const env = import.meta.env ?? {}

const listed = new Set(
  String(env.VITE_REAL_APIS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)

const allReal = env.VITE_USE_MOCK === 'false' || listed.has('*')

// 名字拼错不会报错，只会让那个接口一直安静地走假数据——
// 联调时以为切过去了，实际看的还是假数据。所以启动时点名说出来。
for (const name of listed) {
  if (name !== '*' && !API_NAMES.includes(name)) {
    console.warn(`[api] VITE_REAL_APIS 里的「${name}」不是已知接口，已忽略。可用的名字：${API_NAMES.join(', ')}`)
  }
}

/**
 * @param {string} name API_NAMES 里的一个
 * @returns {boolean} true = 走假数据
 */
export function useMock(name) {
  return !(allReal || listed.has(name))
}

/**
 * 这个接口**切到真后端了没有**。useMock 的另一面，读起来顺一点。
 *
 * 混合模式下要靠它判断「附属数据是不是还没接入」：主数据已经是链上的了，
 * 而附属接口还走假数据时，假数据的回答**不是事实**——哪怕它返回了一个空数组。
 */
export function isReal(name) {
  return !useMock(name)
}
