#!/usr/bin/env bash
# Generates the Appwrite docker-compose.yml/.env (PostgreSQL, port 8080) in ./appwrite and starts it.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p appwrite

docker run --rm \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume "$(pwd)/appwrite":/usr/src/code/appwrite:rw \
  --entrypoint="install" \
  appwrite/appwrite:2.5.0 \
  --http-port=127.0.0.1:8080 --https-port=127.0.0.1:8443 \
  --interactive=N --no-start=true --database=postgresql --domain=localhost

docker compose -f appwrite/docker-compose.yml up -d
echo "Appwrite starting at http://localhost:8080 (give it ~1 min to become healthy)"
