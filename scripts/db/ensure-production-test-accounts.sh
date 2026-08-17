#!/usr/bin/env bash
# Apply the verified three-role fixture to production and HTTP-verify login.
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-root@121.40.124.135}"
PUBLIC_URL="${PUBLIC_URL:-https://act.adapt-learn.online}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

student_password='DemoStudent@Just2026!'
teacher_password='TestTeacher@Just2026!'
admin_password='admin@Just'

echo "Generating password hashes locally..."
hashes="$(node --input-type=module -e '
import bcrypt from "bcryptjs";
const [student, teacher, admin] = process.argv.slice(1);
console.log(JSON.stringify({
  student: bcrypt.hashSync(student, 10),
  teacher: bcrypt.hashSync(teacher, 10),
  admin: bcrypt.hashSync(admin, 10),
}));
' "$student_password" "$teacher_password" "$admin_password")"

student_hash="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["student"])' "$hashes")"
teacher_hash="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["teacher"])' "$hashes")"
admin_hash="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["admin"])' "$hashes")"

echo "Updating production fixture accounts and clearing colliding teacher employeeNumber..."
sql_file="$(mktemp)"
python3 - "$student_hash" "$teacher_hash" "$admin_hash" >"$sql_file" <<'PY'
import sys
student, teacher, admin = (value.replace("'", "''") for value in sys.argv[1:4])
print(f"""BEGIN;

UPDATE "User"
SET
  name = 'demo',
  email = 'demo@example.com',
  role = 'STUDENT',
  "passwordHash" = '{student}'
WHERE email = 'demo@example.com';

INSERT INTO "StudentProfile" (id, "userId", "studentNumber", "createdAt", "updatedAt")
SELECT concat('sp_demo_', u.id), u.id, 'demo', NOW(), NOW()
FROM "User" u
WHERE u.email = 'demo@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM "StudentProfile" p WHERE p."userId" = u.id
  );

UPDATE "StudentProfile" p
SET "studentNumber" = 'demo', "updatedAt" = NOW()
FROM "User" u
WHERE p."userId" = u.id
  AND u.email = 'demo@example.com';

UPDATE "User"
SET "employeeNumber" = NULL
WHERE "employeeNumber" = 'test_teacher'
  AND email IS DISTINCT FROM 'test_teacher@example.com';

UPDATE "User"
SET
  name = 'test_teacher',
  email = 'test_teacher@example.com',
  role = 'TEACHER',
  "employeeNumber" = 'test_teacher',
  "passwordHash" = '{teacher}'
WHERE email = 'test_teacher@example.com';

UPDATE "User"
SET
  name = 'admin',
  email = 'admin',
  role = 'ADMIN',
  "employeeNumber" = 'admin',
  "passwordHash" = '{admin}'
WHERE email = 'admin' OR "employeeNumber" = 'admin';

COMMIT;

SELECT u.id, u.role, u.email, u."employeeNumber", p."studentNumber"
FROM "User" u
LEFT JOIN "StudentProfile" p ON p."userId" = u.id
WHERE u.email IN ('demo@example.com', 'test_teacher@example.com', 'admin')
ORDER BY u.role;
""")
PY
ssh -o BatchMode=yes "$SSH_TARGET" "podman exec -i act-obe-postgres psql -U act_user -d act_obe -v ON_ERROR_STOP=1" <"$sql_file"
rm -f "$sql_file"

echo "Verifying production HTTP login for all three roles..."
node "$REPO_ROOT/scripts/db/verify-test-account-login.mjs" --base-url "$PUBLIC_URL"
