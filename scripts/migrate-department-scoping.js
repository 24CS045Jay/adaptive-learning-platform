import "dotenv/config";
import mongoose from "mongoose";
import { Department, User, Subject } from "../models/index.js";

const DEFAULT_DEPARTMENTS = [
  { name: "Computer Engineering", code: "CE", institute: "CSPIT" },
  { name: "Computer Science & Engineering", code: "CSE", institute: "CSPIT" },
  { name: "Information Technology", code: "IT", institute: "CSPIT" },
  { name: "Electronics & Communication", code: "EC", institute: "CSPIT" },
  { name: "Artificial Intelligence & Machine Learning", code: "AIML", institute: "CSPIT" },
];

async function migrateDepartmentScoping() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI environment variable is not defined.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for department scoping migration...");
  const db = mongoose.connection.db;

  try {
    // 1. Ensure all 5 core Department documents exist (upsert by code)
    const departmentMap = new Map(); // code -> _id (ObjectId)
    const departmentIdMap = new Map(); // string(_id) -> doc

    for (const deptData of DEFAULT_DEPARTMENTS) {
      const dept = await Department.findOneAndUpdate(
        { code: deptData.code },
        { $set: { ...deptData, active: true } },
        { upsert: true, returnDocument: "after" },
      );
      departmentMap.set(deptData.code, dept._id);
      departmentIdMap.set(String(dept._id), dept);
      console.log(`[Department] Ensured ${dept.code} record: ${dept._id}`);
    }

    const cseDepartmentId = departmentMap.get("CSE");
    if (!cseDepartmentId) {
      throw new Error("CSE Department document could not be resolved.");
    }

    // 2. Query all User documents raw from MongoDB to inspect actual BSON types
    const rawUsers = await db.collection("users").find({}).toArray();
    console.log(`Analyzing ${rawUsers.length} user documents in MongoDB...`);

    let migratedUsersCount = 0;
    const migrationLogs = [];

    for (const user of rawUsers) {
      const rawDept = user.departmentId;
      const isAlreadyValidBsonObjectId =
        rawDept &&
        rawDept instanceof mongoose.Types.ObjectId &&
        departmentIdMap.has(String(rawDept));

      let targetDeptId = null;
      let reason = "";

      if (isAlreadyValidBsonObjectId) {
        continue;
      }

      // Check if user is the seeded HOD / admin account specifically
      if (user.email.toLowerCase() === "hod@charusat.ac.in" || user.email.toLowerCase() === "admin@charusat.edu.in") {
        targetDeptId = cseDepartmentId;
        reason = `Original seeded admin account mapped to CSE Department ObjectId`;
      } else if (typeof rawDept === "string" && departmentMap.has(rawDept.toUpperCase())) {
        targetDeptId = departmentMap.get(rawDept.toUpperCase());
        reason = `Converted department code string "${rawDept}" to Department ObjectId`;
      } else if (typeof rawDept === "string" && mongoose.Types.ObjectId.isValid(rawDept) && departmentIdMap.has(rawDept.toLowerCase())) {
        targetDeptId = new mongoose.Types.ObjectId(rawDept.toLowerCase());
        reason = `Converted string hex "${rawDept}" to BSON ObjectId`;
      } else if (user.email.includes("aiml")) {
        targetDeptId = departmentMap.get("AIML");
        reason = `Inferred AIML department from email address ${user.email}`;
      } else if (user.email.includes("it")) {
        targetDeptId = departmentMap.get("IT");
        reason = `Inferred IT department from email address ${user.email}`;
      } else if (user.email.includes("ce")) {
        targetDeptId = departmentMap.get("CE");
        reason = `Inferred CE department from email address ${user.email}`;
      } else if (user.email.includes("ec")) {
        targetDeptId = departmentMap.get("EC");
        reason = `Inferred EC department from email address ${user.email}`;
      } else {
        targetDeptId = cseDepartmentId;
        reason = `Defaulting unassigned account to CSE department`;
      }

      // Perform raw MongoDB update to ensure BSON ObjectId data type is saved
      const bsonDeptId = new mongoose.Types.ObjectId(String(targetDeptId));
      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: { departmentId: bsonDeptId } }
      );

      migratedUsersCount++;
      const targetDeptCode = departmentIdMap.get(String(bsonDeptId))?.code || "UNKNOWN";
      migrationLogs.push({
        userId: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        oldDepartmentId: rawDept ?? null,
        newDepartmentId: String(bsonDeptId),
        newDepartmentCode: targetDeptCode,
        reason,
      });
    }

    console.log(`\n=== USER MIGRATION LOGS (${migratedUsersCount} migrated) ===`);
    console.table(migrationLogs);

    // 3. Migrate Subject documents to BSON ObjectIds as well
    const rawSubjects = await db.collection("subjects").find({}).toArray();
    let migratedSubjectsCount = 0;

    for (const subject of rawSubjects) {
      const rawDept = subject.departmentId;
      const isAlreadyValid =
        rawDept &&
        rawDept instanceof mongoose.Types.ObjectId &&
        departmentIdMap.has(String(rawDept));

      if (!isAlreadyValid) {
        let targetDeptId = cseDepartmentId;
        if (typeof rawDept === "string" && departmentMap.has(rawDept.toUpperCase())) {
          targetDeptId = departmentMap.get(rawDept.toUpperCase());
        } else if (typeof rawDept === "string" && mongoose.Types.ObjectId.isValid(rawDept)) {
          targetDeptId = new mongoose.Types.ObjectId(rawDept.toLowerCase());
        }
        const bsonDeptId = new mongoose.Types.ObjectId(String(targetDeptId));
        await db.collection("subjects").updateOne(
          { _id: subject._id },
          { $set: { departmentId: bsonDeptId } }
        );
        migratedSubjectsCount++;
        console.log(`[Subject Migration] Subject ${subject.code} (${subject.name}) -> BSON ObjectId ${bsonDeptId}`);
      }
    }

    // 4. Final verification check via raw collection queries
    const invalidUsersCount = await db.collection("users").countDocuments({
      $or: [
        { departmentId: { $exists: false } },
        { departmentId: null },
        { departmentId: "" },
        { departmentId: { $type: "string" } },
      ],
    });

    console.log(`\n=== MIGRATION COMPLETE ===`);
    console.log(`Departments verified: ${DEFAULT_DEPARTMENTS.length}`);
    console.log(`Users migrated to BSON ObjectId: ${migratedUsersCount}`);
    console.log(`Subjects migrated to BSON ObjectId: ${migratedSubjectsCount}`);
    console.log(`Users missing or non-ObjectId departmentId after migration: ${invalidUsersCount}`);

    if (invalidUsersCount > 0) {
      throw new Error(`Migration error: ${invalidUsersCount} users still have missing or non-ObjectId departmentId.`);
    }
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

migrateDepartmentScoping().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
