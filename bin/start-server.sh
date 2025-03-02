#!/bin/bash

# docker entrypoint.sh to start the server with arguments
cd /opt/canvas-server/ || exit 1
npm run start "$@"
