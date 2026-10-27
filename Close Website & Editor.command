#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
ruby local-admin/stop.rb "$@"
stop_status=$?
if [ "$stop_status" -ne 0 ]; then
  printf '\nPress Return to close this window.\n'
  read -r
fi
exit "$stop_status"
