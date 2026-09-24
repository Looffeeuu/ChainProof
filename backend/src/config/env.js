import 'dotenv/config'
import { fileURLToPath } from 'node:url'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || fileURLToPath(new URL('../../uploads/', import.meta.url)),
  fabric: {
    mspId: process.env.FABRIC_MSP_ID || 'Org1MSP',
    channelName: process.env.FABRIC_CHANNEL_NAME || 'chainproof',
    chaincodeName: process.env.FABRIC_CHAINCODE_NAME || 'chainproof',
    peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
    peerHostAlias: process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.org1.example.com',
    tlsCertPath: () => requireEnv('FABRIC_TLS_CERT_PATH'),
    certPath: () => requireEnv('FABRIC_CERT_PATH'),
    keyPath: () => requireEnv('FABRIC_KEY_PATH')
  }
}
