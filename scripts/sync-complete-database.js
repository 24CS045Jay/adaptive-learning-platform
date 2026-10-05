import "dotenv/config";
import bcrypt from "bcryptjs";
import { User, Subject, Department } from "../models/index.js";
import { connectSupabase } from "../db/supabase.js";

async function syncCompleteDatabase() {
  console.log("[SyncCompleteDB] Connecting to Supabase...");
  await connectSupabase();

  // 1. Ensure Department exists
  let dept = await Department.findOne({ code: "CSE" });
  if (!dept) {
    dept = await Department.create({
      name: "Computer Science & Engineering",
      code: "CSE",
      institute: "CSPIT",
      active: true,
    });
  }

  // 2. Sync Admin User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("12345678", salt);
  const adminEmail = "hod@charusat.ac.in";

  let adminUser = await User.findOne({ email: adminEmail });
  if (!adminUser) {
    adminUser = await User.create({
      name: "Amit Thakkar",
      email: adminEmail,
      passwordHash,
      role: "admin",
      departmentId: dept.id,
    });
  }
  console.log(`[SyncCompleteDB] ✅ Admin User synced: ${adminUser.name} (${adminUser.email})`);

  // 3. Sync Seed Subjects
  const seedSubjectsData = [
    {
      name: "Big Data Analytics",
      code: "CSE501",
      semester: 5,
      syllabus: "Covers MapReduce, Spark, and big data pipelines.",
    },
    {
      name: "Machine Learning",
      code: "CSE502",
      semester: 5,
      syllabus: "Covers supervised/unsupervised algorithms and deep learning.",
    },
    {
      name: "Cloud Computing",
      code: "CSE503",
      semester: 5,
      syllabus: "Covers AWS, Azure, GCP, virtualisation, and containers.",
    },
    {
      name: "Distributed Systems",
      code: "CSE601",
      semester: 6,
      syllabus: "Covers Paxos, Raft, CAP theorem, and consistency.",
    },
  ];

  for (const s of seedSubjectsData) {
    let existingSubj = await Subject.findOne({ code: s.code });
    if (!existingSubj) {
      existingSubj = await Subject.create({
        name: s.name,
        code: s.code,
        semester: s.semester,
        syllabus: s.syllabus,
        departmentId: dept.id,
        facultyId: adminUser.id,
      });
    }
    console.log(
      `[SyncCompleteDB] ✅ Subject synced: ${existingSubj.code} - ${existingSubj.name}`,
    );
  }

  const userCount = await User.countDocuments();
  const subjectCount = await Subject.countDocuments();
  console.log(`\n[SyncCompleteDB] Final Supabase Counts:`);
  console.log(`  - Users Table Count: ${userCount}`);
  console.log(`  - Subjects Table Count: ${subjectCount}`);
  console.log("[SyncCompleteDB] Sync completed successfully!");
}

syncCompleteDatabase().catch((err) => {
  console.error("[SyncCompleteDB Error]", err);
  process.exit(1);
});
