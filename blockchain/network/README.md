# Local Fabric Network

For development, ChainProof uses the official Hyperledger Fabric `test-network` as the baseline rather than committing generated network artifacts into this repository.

## Recommended local workflow

1. Install the Hyperledger Fabric samples, binaries, and Docker images using the official Fabric documentation.
2. From `fabric-samples/test-network`, start the network and create the default channel:

```bash
./network.sh down
./network.sh up createChannel -c chainproof
```

3. Deploy the ChainProof JavaScript chaincode from this repository. A typical command shape is:

```bash
./network.sh deployCC \
  -ccn chainproof \
  -ccp /absolute/path/to/ChainProof/blockchain/chaincode \
  -ccl javascript \
  -c chainproof
```

4. Verify the chaincode package/deployment before wiring the backend Gateway connection.

## Shutdown

```bash
./network.sh down
```

## Important repository rule

Do **not** copy generated Fabric organizations, certificates, private keys, channel artifacts, or Docker data into this repository. They are local development artifacts and are excluded by `.gitignore`.

## Week 1 acceptance check

A teammate should be able to:

- clone ChainProof;
- prepare the official Fabric test-network;
- start channel `chainproof`;
- deploy this repository's chaincode;
- invoke at least `CreateProject` and `GetProject` successfully;
- stop and restart the network using documented commands.

If local Fabric version differences require command changes, update this README with the exact commands the team has validated.
