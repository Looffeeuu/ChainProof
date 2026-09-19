'use strict'

const ChainProofContract = require('./lib/chainproof-contract')

/**
 * ChainProof 链码入口。
 *
 * `contracts` 是 fabric-contract-api 的约定导出，peer 启动链码容器时读取它。
 * 额外导出的 ChainProofError / MILESTONE_STATUS 仅供单元测试与文档参照使用，
 * 后端通过 Gateway SDK 的返回值与错误 message 前缀交互，不直接 require 本包。
 */
module.exports.contracts = [ChainProofContract]

module.exports.info = {
  title: 'ChainProof Chaincode',
  description: '团队贡献存证与贡献证明合约（Hyperledger Fabric 2.5 / JavaScript）',
  version: '0.1.0'
}

module.exports.ChainProofError = ChainProofContract.ChainProofError
module.exports.MILESTONE_STATUS = ChainProofContract.MILESTONE_STATUS
