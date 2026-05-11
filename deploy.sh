#!/usr/bin/env bash
# Deploy portfolio site to https://github.com/vadimka-ru/folio
# Run from this folder: bash deploy.sh
set -e

REMOTE="https://github.com/vadimka-ru/folio.git"
BRANCH="main"

cd "$(dirname "$0")"

echo "==> Cleaning any previous .git state"
rm -rf .git

echo "==> Initializing git repo on branch $BRANCH"
git init -b "$BRANCH"
git config user.email "vad270396@gmail.com"
git config user.name "Vadim Korolkov"

echo "==> Adding files"
git add -A
git status --short | head -5
echo "    Total staged: $(git status --short | wc -l | tr -d ' ') files"

echo "==> Committing"
git commit -m "Deploy portfolio site" --quiet

echo "==> Adding remote $REMOTE"
git remote add origin "$REMOTE"

echo "==> Force-pushing to $BRANCH (replacing placeholder)"
git push --force origin "$BRANCH"

echo
echo "Done. Site should be live at https://vadimka-ru.github.io/folio/ in 1-2 minutes."
