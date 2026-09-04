#!/usr/bin/env bash
# Dual repository synchronization script for TRACE project

set -e

echo "Syncing commit to 'team' remote..."
git push team main

echo "Syncing commit to 'personal' remote..."
git push personal main

echo "Dual repository sync completed successfully!"
