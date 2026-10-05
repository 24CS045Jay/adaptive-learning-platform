import "dotenv/config";
import bcrypt from "bcryptjs";
import { User, Department } from "../models/index.js";
import { connectSupabase } from "../db/supabase.js";

/**
 * Bootstrap Seed Script for Supabase
 * Seeds primary departments & accounts needed to manage the system.
 */
async function seedSupabase() {
  console.log("[Seed] Connecting to Supabase...");
  await connectSupabase();

  try {
    // 1. Seed default department if not present
    let dept = await Department.findOne({ code: "CE" });
    if (!dept) {
      dept = await Department.create({
        name: "Computer Engineering",
        code: "CE",
        institute: "CSPIT",
        active: true,
      });
      console.log(`[Seed] Created department: CE (${dept.id})`);
    }

    // 2. Seed Admin
    const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@charusat.edu.in").toLowerCase().trim();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "password123";

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, await bcrypt.genSalt(10));
      const newAdmin = await User.create({
        name: "System Admin",
        email: adminEmail,
        passwordHash,
        role: "admin",
        departmentId: dept.id,
        mustChangePassword: false,
      });
      console.log(`[Seed] Created Admin account: ${newAdmin.email}`);
    } else {
      console.log(`[Seed] Admin account already exists: ${existingAdmin.email}`);
    }

    // 3. Seed Faculty
    const facultyEmail = "faculty@charusat.edu.in";
    const existingFaculty = await User.findOne({ email: facultyEmail });
    if (!existingFaculty) {
      const passwordHash = await bcrypt.hash("password123", await bcrypt.genSalt(10));
      await User.create({
        name: "Prof. Sharma (CE)",
        email: facultyEmail,
        passwordHash,
        role: "faculty",
        departmentId: dept.id,
        mustChangePassword: false,
      });
      console.log(`[Seed] Created Faculty account: ${facultyEmail}`);
    }

    // 4. Seed Student
    const studentEmail = "student@charusat.edu.in";
    const existingStudent = await User.findOne({ email: studentEmail });
    if (!existingStudent) {
      const passwordHash = await bcrypt.hash("password123", await bcrypt.genSalt(10));
      await User.create({
        name: "Jay Ladva",
        email: studentEmail,
        passwordHash,
        role: "student",
        departmentId: dept.id,
        mustChangePassword: false,
      });
      console.log(`[Seed] Created Student account: ${studentEmail}`);
    }

    console.log("\n[Seed Complete] Supabase database seeded successfully!\n");
    process.exit(0);
  } catch (error) {
    console.error("[Seed Error]:", error.message || error);
    process.exit(1);
  }
}

seedSupabase();
