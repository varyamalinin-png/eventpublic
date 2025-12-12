#!/bin/bash
cd /home/ubuntu/event_app_new/server
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  node scripts/fix-users-usernames.js
else
  echo "❌ .env файл не найден"
  exit 1
fi

