import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, Department } from "../models/index.js";
import { JWT_SECRET } from "../middleware/auth.js";

const API = process.env.API_BASE || "http://127.0.0.1:5000";
const runId = Date.now();
const testEmail = `isolation-e2e-${runId}@example.invalid`;
const fixtureEmails = [
  `cse-hod-isolation-${runId}@example.invalid`,
  `it-hod-isolation-${runId}@example.invalid`,
];

function tokenFor(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "15m" },
  );
}

async function request(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {}
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mongoose.connect(process.env.MONGO_URI);
try {
  const [cseDept, itDept] = await Promise.all([
    Department.findOne({ code: "CSE" }),
    Department.findOne({ code: "IT" }),
  ]);
  assert(cseDept, "CSE Department not found in database.");
  assert(itDept, "IT Department not found in database.");

  let [cseHod, itHod] = await Promise.all([
    User.findOne({ role: "admin", departmentId: cseDept._id }).select("_id name email role departmentId"),
    User.findOne({ role: "admin", departmentId: itDept._id }).select("_id name email role departmentId"),
  ]);

  const fixtureIds = [];
  if (!cseHod || !itHod) {
    const passwordHash = await bcrypt.hash(`Isolation-${runId}-temporary`, 10);
    const fixtures = await User.insertMany([
      {
        name: "CSE HOD Isolation Fixture",
        email: fixtureEmails[0],
        passwordHash,
        role: "admin",
        departmentId: cseDept._id,
      },
      {
        name: "IT HOD Isolation Fixture",
        email: fixtureEmails[1],
        passwordHash,
        role: "admin",
        departmentId: itDept._id,
      },
    ]);
    fixtureIds.push(...fixtures.map((user) => user._id));
    if (!cseHod) cseHod = fixtures[0];
    if (!itHod) itHod = fixtures[1];
  }
  assert(cseHod, "Unable to provision a CSE department-scoped admin/HOD fixture.");
  assert(itHod, "Unable to provision an IT department-scoped admin/HOD fixture.");

  const cseDeptIdStr = String(cseDept._id);

  console.log(
    `Using ${cseHod.departmentId} scoped admin and ${itHod.departmentId} scoped admin fixtures.`,
  );
  const cseToken = tokenFor(cseHod);
  console.log("Checking CSE Users list...");
  const usersBefore = await request("/api/users", cseToken);
  assert(usersBefore.status === 200, `CSE Users request failed: ${usersBefore.status}`);
  assert(Array.isArray(usersBefore.body), "CSE Users response is not an array.");
  assert(
    usersBefore.body.every((user) => String(user.departmentId).toLowerCase() === cseDeptIdStr.toLowerCase()),
    "CSE Users response contains a non-CSE account.",
  );
  assert(
    !usersBefore.body.some((user) => String(user._id) === String(itHod._id)),
    "IT HOD is visible in CSE Users response.",
  );
  assert(
    !usersBefore.body.some((user) => user.email === itHod.email),
    "IT HOD email is visible in CSE Users response.",
  );

  console.log("Checking cross-department direct user lookup...");
  const directOtherDepartment = await request(`/api/users/${itHod._id}`, cseToken);
  assert(
    directOtherDepartment.status === 404,
    `Cross-department direct lookup returned ${directOtherDepartment.status}, expected 404.`,
  );

  console.log("Checking department-scoped subjects and populated faculty...");
  const subjects = await request("/api/subjects", cseToken);
  assert(subjects.status === 200, `CSE Subjects request failed: ${subjects.status}`);
  assert(
    subjects.body.every((subject) => String(subject.departmentId).toLowerCase() === cseDeptIdStr.toLowerCase()),
    "CSE Subjects response contains a non-CSE subject.",
  );
  assert(
    subjects.body.every(
      (subject) => !subject.facultyId || String(subject.facultyId.departmentId).toLowerCase() === cseDeptIdStr.toLowerCase(),
    ),
    "CSE Subjects response populated a non-CSE faculty member.",
  );

  console.log("Checking CSE user creation, list refresh, and cleanup...");
  const created = await request("/api/users", cseToken, {
    method: "POST",
    body: JSON.stringify({
      name: "Isolation E2E User",
      email: testEmail,
      role: "faculty",
      password: "Temp-password-123",
    }),
  });
  console.log("Created user response body:", created.body);
  assert(
    created.status === 201,
    `CSE user creation failed: ${created.status} ${JSON.stringify(created.body)}`,
  );
  assert(
    String(created.body.departmentId).toLowerCase() === cseDeptIdStr.toLowerCase(),
    "Created CSE user was not assigned to CSE.",
  );

  const loginResponse = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "Temp-password-123", role: "faculty" }),
    signal: AbortSignal.timeout(15000),
  });
  const loginBody = await loginResponse.json();
  assert(loginResponse.status === 200, `Created user login failed: ${loginResponse.status}`);
  assert(
    String(loginBody.user?.departmentId).toLowerCase() === cseDeptIdStr.toLowerCase(),
    "Login response did not carry the CSE departmentId.",
  );

  const usersAfter = await request("/api/users", cseToken);
  assert(usersAfter.status === 200, `CSE Users refresh failed: ${usersAfter.status}`);
  assert(
    usersAfter.body.some((user) => user.email === testEmail),
    "Created CSE user is missing from CSE Users response.",
  );
  assert(
    !usersAfter.body.some((user) => user.email === itHod.email),
    "IT HOD appeared after user-management mutation.",
  );

  const createdId = created.body._id || created.body.id;
  const deleted = await request(`/api/users/${createdId}`, cseToken, { method: "DELETE" });
  assert(deleted.status === 200, `E2E cleanup failed: ${deleted.status}`);
  if (fixtureIds.length) await User.deleteMany({ _id: { $in: fixtureIds } });

  console.log(
    JSON.stringify(
      {
        ok: true,
        cseDepartment: cseHod.departmentId,
        itDepartment: itHod.departmentId,
        cseVisibleUserCount: usersAfter.body.length,
        cseVisibleSubjectCount: subjects.body.length,
        itHodHiddenFromUsers: true,
        itHodDirectLookupBlocked: true,
        crossDepartmentFacultyHidden: true,
        userCreateAndDeletePassed: true,
        loginAndDepartmentClaimPassed: true,
      },
      null,
      2,
    ),
  );
} finally {
  await User.deleteMany({ email: { $in: [testEmail, ...fixtureEmails] } });
  await mongoose.disconnect();
}
