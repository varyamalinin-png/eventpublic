#!/bin/bash
echo "Подключаюсь к Postgres-4hJW через psql..."
echo 'DELETE FROM "User";' | railway connect Postgres-4hJW
