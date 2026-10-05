import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Department } from "../models/index.js";

async function verifyFixes() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== VERIFICATION CHECK ===");

  // 1. Check Department documents
  const depts = await Department.find({ code: { $in: ["CSE", "CE", "IT", "EC", "AIML"] } });
  console.log(`1. Found ${depts.length}/5 Department records:`, depts.map(d => `${d.code}:${d._id}`));
  if (depts.length < 5) {
    throw new Error("FAIL: Not all 5 departments exist in MongoDB.");
  }

  // 2. Check User documents for missing or invalid departmentId
  const deptIds = new Set(depts.map(d => String(d._id)));
  const allUsers = await User.find({});
  console.log(`2. Total User documents in database: ${allUsers.length}`);

  let invalidUsers = 0;
  for (const u of allUsers) {
    if (!u.departmentId || !deptIds.has(String(u.departmentId))) {
      console.error(`  INVALID USER: ${u.name} (${u.email}) role=${u.role} departmentId=${u.departmentId}`);
      invalidUsers++;
    }
  }

  if (invalidUsers > 0) {
    throw new Error(`FAIL: ${invalidUsers} users have missing/invalid departmentId references.`);
  } else {
    console.log("  SUCCESS: 100% of User documents have valid Department ObjectId references!");
  }

  // 3. Test HOD account login simulation
  const cseDept = depts.find(d => d.code === "CSE");
  const hodUser = await User.findOne({ email: "hod@charusat.ac.in" });
  if (!hodUser) {
    throw new Error("FAIL: Seeded HOD account hod@charusat.ac.in not found.");
  }

  console.log(`3. Seeded HOD account: ${hodUser.name} (${hodUser.email})`);
  console.log(`   HOD departmentId: ${hodUser.departmentId} (Matches CSE ObjectId ${cseDept._id}? ${String(hodUser.departmentId) === String(cseDept._id)})`);
  
  const passwordMatch = await bcrypt.compare("12345678", hodUser.passwordHash);
  console.log(`   Password match check ("12345678"): ${passwordMatch}`);

  if (!passwordMatch) {
    throw new Error("FAIL: HOD password match failed.");
  }
  if (String(hodUser.departmentId) !== String(cseDept._id)) {
    throw new Error("FAIL: HOD departmentId is not assigned to CSE Department ObjectId.");
  }

  // 4. Check CSE scoped directory user counts
  const cseUsers = await User.find({ departmentId: cseDept._id });
  const studentsCount = cseUsers.filter(u => u.role === "student").length;
  const facultyCount = cseUsers.filter(u => u.role === "faculty").length;
  const adminCount = cseUsers.filter(u => u.role === "admin").length;

  console.log(`4. CSE Scoped Directory Counts:`);
  console.log(`   - Students: ${studentsCount}`);
  console.log(`   - Faculty:  ${facultyCount}`);
  console.log(`   - Admins:   ${adminCount}`);
  console.log(`   - Total Visible CSE Users: ${cseUsers.length}`);

  if (studentsCount === 0 || facultyCount === 0 || adminCount === 0) {
    throw new Error("FAIL: CSE Users Directory counts returned 0 for a role.");
  }

  // 5. Test Add User flow programmatically with default password & mustChangePassword
  const testUserEmail = `verify-new-user-${Date.now()}@charusat.edu.in`;
  const defaultPasswordHash = await bcrypt.hash("password1234", 10);
  const createdTestUser = await User.create({
    name: "Verification Test Student",
    email: testUserEmail,
    passwordHash: defaultPasswordHash,
    role: "student",
    departmentId: cseDept._id,
    mustChangePassword: true,
  });

  console.log(`5. Created Test User via Add User simulation:`);
  console.log(`   - ID: ${createdTestUser._id}`);
  console.log(`   - Email: ${createdTestUser.email}`);
  console.log(`   - DepartmentId: ${createdTestUser.departmentId}`);
  console.log(`   - mustChangePassword: ${createdTestUser.mustChangePassword}`);

  // Refetch directory list to verify immediate inclusion
  const updatedCseUsers = await User.find({ departmentId: cseDept._id });
  const foundInDirectory = updatedCseUsers.some(u => String(u._id) === String(createdTestUser._id));
  console.log(`   - Immediately visible in CSE Directory? ${foundInDirectory}`);

  // Cleanup test user
  await User.deleteOne({ _id: createdTestUser._id });

  if (!foundInDirectory) {
    throw new Error("FAIL: Newly created test user was not visible in CSE directory query.");
  }

  console.log("\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===");
  await mongoose.disconnect();
}

verifyFixes().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
