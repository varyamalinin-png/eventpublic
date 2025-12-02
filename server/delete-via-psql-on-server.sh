#!/bin/bash
# Скрипт для выполнения на Railway сервере через connect
echo 'DELETE FROM "User";' | railway connect postgres
