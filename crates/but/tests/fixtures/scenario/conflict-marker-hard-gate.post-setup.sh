#!/usr/bin/env bash

set -eu -o pipefail

repo_dir="${1:?usage: conflict-marker-hard-gate.post-setup.sh <repo-dir> <artifact-dir>}"

mkdir -p "${repo_dir}/docs"

cat > "${repo_dir}/docs/conflicted-notes.md" <<'EOF'
<<<<<<< ours
keep this line
=======
take that line
>>>>>>> theirs
EOF
