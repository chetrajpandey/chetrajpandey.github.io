#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
ruby local-admin/launch.rb "$@"
launch_status=$?
if [ "$launch_status" -ne 0 ]; then
  printf '\nPress Return to close this window.\n'
  read -r
fi
exit "$launch_status"
