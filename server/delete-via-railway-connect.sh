#!/bin/bash
echo "Удаляю всех пользователей через Railway connect..."
echo 'DELETE FROM "User";' | railway connect Postgres-4hJW
