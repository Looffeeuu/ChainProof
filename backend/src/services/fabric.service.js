import * as grpc from '@grpc/grpc-js'
import { connect, hash, signers } from '@hyperledger/fabric-gateway'
import { createPrivateKey } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { env } from '../config/env.js'

async function newGrpcConnection() {
  const tlsRootCert = await readFile(env.fabric.tlsCertPath())
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert)

  return new grpc.Client(env.fabric.peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': env.fabric.peerHostAlias
  })
}

async function newIdentity() {
  const credentials = await readFile(env.fabric.certPath())
  return { mspId: env.fabric.mspId, credentials }
}

async function newSigner() {
  const privateKeyPem = await readFile(env.fabric.keyPath())
  const privateKey = createPrivateKey(privateKeyPem)
  return signers.newPrivateKeySigner(privateKey)
}

export async function withContract(callback) {
  const client = await newGrpcConnection()

  try {
    const gateway = connect({
      client,
      identity: await newIdentity(),
      signer: await newSigner(),
      hash: hash.sha256
    })

    try {
      const network = gateway.getNetwork(env.fabric.channelName)
      const contract = network.getContract(env.fabric.chaincodeName)
      return await callback(contract)
    } finally {
      gateway.close()
    }
  } finally {
    client.close()
  }
}

export async function submitTransaction(name, ...args) {
  return withContract(async (contract) => {
    const result = await contract.submitTransaction(name, ...args)
    return decodeResult(result)
  })
}

export async function evaluateTransaction(name, ...args) {
  return withContract(async (contract) => {
    const result = await contract.evaluateTransaction(name, ...args)
    return decodeResult(result)
  })
}

function decodeResult(bytes) {
  if (!bytes || bytes.length === 0) return null

  const text = Buffer.from(bytes).toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
