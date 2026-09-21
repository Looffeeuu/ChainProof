import * as grpc from '@grpc/grpc-js'
import { connect, signers } from '@hyperledger/fabric-gateway'
import { createPrivateKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fabricConfig } from '../config/fabric.config.js'

let gateway = null
let contract = null

function getGateway () {
  if (gateway) return { gateway, contract }

  const tlsRootCert = readFileSync(fabricConfig.tlsCertPath)
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert)
  const client = new grpc.Client(fabricConfig.peerEndpoint, tlsCredentials)

  const cert = readFileSync(fabricConfig.certPath)
  const privateKeyPem = readFileSync(fabricConfig.keyPath)
  const privateKey = createPrivateKey(privateKeyPem)

  gateway = connect({
    client,
    identity: { mspId: fabricConfig.mspId, credentials: cert },
    signer: signers.newPrivateKeySigner(privateKey),
  })

  const network = gateway.getNetwork(fabricConfig.channelName)
  contract = network.getContract(fabricConfig.chaincodeName)

  return { gateway, contract }
}

const KNOWN_CODES = new Set([
  'PROJECT_NOT_FOUND', 'MILESTONE_NOT_FOUND', 'CERTIFICATE_NOT_FOUND',
  'CONTRIBUTION_TOTAL_INVALID', 'MEMBER_NOT_IN_CLAIM', 'ALREADY_DECIDED',
  'MILESTONE_CLOSED', 'VALIDATION_ERROR', 'NO_VERIFIED_CONTRIBUTION',
])

function extractCode (text) {
  if (!text) return null
  const parts = text.split(/,\s*/)
  for (let i = parts.length - 1; i >= 0; i--) {
    const match = parts[i].match(/^([A-Z][A-Z_]{2,}):\s*(.+)$/)
    if (match && KNOWN_CODES.has(match[1])) {
      return { code: match[1], message: match[2].trim() }
    }
  }
  return null
}

export function parseChaincodeError (err) {
  if (Array.isArray(err?.details)) {
    for (const d of err.details) {
      const found = extractCode(d?.message)
      if (found) return found
    }
  }
  return extractCode(err?.message)
}

const ERROR_HTTP_STATUS = {
  PROJECT_NOT_FOUND: 404,
  MILESTONE_NOT_FOUND: 404,
  CERTIFICATE_NOT_FOUND: 404,
  CONTRIBUTION_TOTAL_INVALID: 400,
  MEMBER_NOT_IN_CLAIM: 403,
  ALREADY_DECIDED: 409,
  MILESTONE_CLOSED: 409,
  VALIDATION_ERROR: 400,
  NO_VERIFIED_CONTRIBUTION: 400,
}

export function toHttpError (err) {
  const parsed = parseChaincodeError(err)
  if (parsed) {
    return {
      status: ERROR_HTTP_STATUS[parsed.code] || 500,
      body: { error: { code: parsed.code, message: parsed.message } },
    }
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: err?.message || 'Unknown error' } },
  }
}

export async function submitTransaction (fn, ...args) {
  const { contract: cc } = getGateway()
  const resultBytes = await cc.submitTransaction(fn, ...args)
  return JSON.parse(new TextDecoder().decode(resultBytes))
}

export async function evaluateTransaction (fn, ...args) {
  const { contract: cc } = getGateway()
  const resultBytes = await cc.evaluateTransaction(fn, ...args)
  return JSON.parse(new TextDecoder().decode(resultBytes))
}

export function closeGateway () {
  if (gateway) {
    gateway.close()
    gateway = null
    contract = null
  }
}
