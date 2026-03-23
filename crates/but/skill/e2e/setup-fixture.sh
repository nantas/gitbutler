#!/usr/bin/env bash

set -euo pipefail

scenario_name="${1:?usage: setup-fixture.sh <scenario-name>}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "${script_dir}/../../../.." && pwd -P)"
scenario_dir="${repo_root}/crates/but/tests/fixtures/scenario"
scenario_script="${scenario_dir}/${scenario_name}.sh"
shared_script="${scenario_dir}/shared.sh"
skill_source_dir="${repo_root}/crates/but/skill"

if [[ ! -f "${scenario_script}" ]]; then
  echo "Unknown scenario: ${scenario_name}" >&2
  exit 1
fi

if ! command -v but >/dev/null 2>&1; then
  echo "'but' must be installed and available on PATH" >&2
  exit 1
fi

tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/gitbutler-skill-e2e.${scenario_name}.XXXXXX")"
repo_dir="${tmp_root}/repo"
artifact_dir="${tmp_root}/artifacts"

mkdir -p "${repo_dir}" "${artifact_dir}"
cp "${scenario_script}" "${repo_dir}/scenario.sh"
cp "${shared_script}" "${repo_dir}/shared.sh"

(
  cd "${repo_dir}"
  GIT_TEST_DEFAULT_INITIAL_BRANCH_NAME=main bash ./scenario.sh
) >"${artifact_dir}/scenario.log" 2>&1

repo_dir="$(cd "${repo_dir}" && pwd -P)"
artifact_dir="$(cd "${artifact_dir}" && pwd -P)"
skill_install_dir="${repo_dir}/.agents/skills/gitbutler"

mkdir -p "${repo_dir}/.git/info" "${repo_dir}/.tmp" "${skill_install_dir}"

for ignore_entry in ".agents/" ".but-data/" ".tmp/" ".tmp/e2e-artifacts/"; do
  if ! grep -qxF "${ignore_entry}" "${repo_dir}/.git/info/exclude" 2>/dev/null; then
    echo "${ignore_entry}" >> "${repo_dir}/.git/info/exclude"
  fi
done

cp "${skill_source_dir}/SKILL.md" "${skill_install_dir}/SKILL.md"
rm -rf "${skill_install_dir}/references"
cp -R "${skill_source_dir}/references" "${skill_install_dir}/references"

(
  cd "${repo_dir}"
  but setup >/dev/null
)

cat <<EOF
{
  "scenario": "${scenario_name}",
  "repoPath": "${repo_dir}",
  "artifactPath": "${artifact_dir}",
  "skillPath": "${skill_install_dir}"
}
EOF
