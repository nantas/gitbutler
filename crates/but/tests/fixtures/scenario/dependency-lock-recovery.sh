#!/usr/bin/env bash

set -eu -o pipefail

source "${BASH_SOURCE[0]%/*}/shared.sh"

### General Description

# A ws-ref points to a workspace commit. A dependency branch owns docs/shared.txt so
# committing edits from a fresh independent branch will leave the file dependency-locked
# until the child branch is moved on top of the dependency branch.
git-init-frozen
tick
echo base > README.md
git add README.md
git commit -m "base"
setup_target_to_match_main

git checkout -b dependency-base
tick
mkdir -p docs
echo "owned by dependency base" > docs/shared.txt
git add docs/shared.txt
git commit -m "add shared dependency file"

create_workspace_commit_once dependency-base
