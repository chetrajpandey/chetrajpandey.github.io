#!/bin/bash
cd -- "$(dirname -- "$0")/.." || exit 1
ruby local-admin/server.rb
