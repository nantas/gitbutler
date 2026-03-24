#!/usr/bin/env bash

set -eu -o pipefail

source "${BASH_SOURCE[0]%/*}/shared.sh"

### General Description

# A ws-ref points to a workspace commit. A dependency branch exists, and the worktree
# already contains unresolved conflict markers that should hard-gate further mutation.
git-init-frozen
tick
echo base > README.md
git add README.md
git commit -m "base"
setup_target_to_match_main

git checkout -b dependency-base
tick
mkdir -p docs
echo "stable dependency content" > docs/conflicted-notes.md
git add docs/conflicted-notes.md
git commit -m "seed dependency file"

create_workspace_commit_once dependency-base
