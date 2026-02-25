#!/bin/sh
set -e

if [ -z "$INFLUXDB3_ADMIN_TOKEN" ]; then
  echo "ERROR: INFLUXDB3_ADMIN_TOKEN is not set. Generate one with:"
  echo "  echo \"apiv3_\$(openssl rand -hex 32)\""
  echo "and add it to your .env file."
  exit 1
fi

echo "{\"token\":\"${INFLUXDB3_ADMIN_TOKEN}\",\"name\":\"_admin\"}" > /tmp/admin-token.json
chmod 600 /tmp/admin-token.json

exec influxdb3 serve \
  --object-store=file \
  --data-dir=/var/lib/influxdb3 \
  --http-bind=0.0.0.0:8181 \
  --admin-token-file=/tmp/admin-token.json
