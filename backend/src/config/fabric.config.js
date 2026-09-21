import 'dotenv/config'

function env(key, fallback) {
  const v = process.env[key]
  if (v !== undefined) return v
  if (fallback !== undefined) return fallback
  throw new Error(`缺少环境变量: ${key}`)
}

export const fabricConfig = {
  peerEndpoint: env('PEER_ENDPOINT', 'localhost:7051'),
  peerTlsHostnameOverride: env('PEER_TLS_HOSTNAME_OVERRIDE', 'peer0.org1.example.com'),
  ordererEndpoint: env('ORDERER_ENDPOINT', 'localhost:7050'),
  ordererTlsHostnameOverride: env('ORDERER_TLS_HOSTNAME_OVERRIDE', 'orderer.example.com'),
  channelName: env('CHANNEL_NAME', 'chainproof'),
  chaincodeName: env('CHAINCODE_NAME', 'chainproof'),
  mspId: env('MSP_ID', 'Org1MSP'),
  certPath: env('CERT_PATH'),
  keyPath: env('KEY_PATH'),
  tlsCertPath: env('TLS_CERT_PATH'),
  uploadDir: env('UPLOAD_DIR', './uploads'),
  port: Number(env('PORT', '3000')),
}
