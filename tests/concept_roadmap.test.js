import test from "node:test";
import assert from "node:assert/strict";
import { GROUNDED_SUBJECT_CURRICULA, syncGroundedConceptsForSubject } from "../lib/concept-pipeline.js";
import { Subject, ConceptNode, ConceptEdge, AuditLog } from "../models/index.js";

test("Concept Roadmap Integration Suite", async (t) => {
  await t.test("1. Verified Course Curriculum Grounding", () => {
    // Check CSUC301 (Big Data Analytics) curriculum
    const bda = GROUNDED_SUBJECT_CURRICULA.CSUC301;
    assert.ok(bda, "BDA curriculum should be defined");
    assert.equal(bda.subjectCode, "CSUC301");
    assert.ok(bda.milestones.length >= 3, "BDA should have at least 3 milestone chapters");

    // All concepts must have genuine evidence excerpts and document patterns
    const allBdaConcepts = bda.milestones.flatMap((m) => m.concepts);
    assert.ok(allBdaConcepts.length >= 8, "BDA should have at least 8 verified syllabus concepts");

    for (const c of allBdaConcepts) {
      assert.ok(c.label, "Concept must have a label");
      assert.ok(c.summary, `Concept ${c.label} must have a summary`);
      assert.ok(c.whyItMatters, `Concept ${c.label} must explain why it matters`);
      assert.ok(c.evidenceExcerpt, `Concept ${c.label} must have grounded evidence excerpt`);
      assert.ok(c.evidenceDocumentPattern, `Concept ${c.label} must reference genuine course documents`);
    }

    // Check CSE203 (Machine Learning) curriculum
    const ml = GROUNDED_SUBJECT_CURRICULA.CSE203;
    assert.ok(ml, "ML curriculum should be defined");
    assert.equal(ml.subjectCode, "CSE203");
    assert.ok(ml.milestones.length >= 3, "ML should have at least 3 milestone chapters");
    const allMlConcepts = ml.milestones.flatMap((m) => m.concepts);
    assert.ok(allMlConcepts.length >= 6, "ML should have at least 6 verified syllabus concepts");
  });

  await t.test("2. Prerequisite Sequence Integrity", () => {
    const bda = GROUNDED_SUBJECT_CURRICULA.CSUC301;
    const allConcepts = bda.milestones.flatMap((m) => m.concepts);
    const slugSet = new Set(allConcepts.map((c) => c.slug));

    // Verify all declared prerequisites exist within the curriculum
    for (const c of allConcepts) {
      for (const p of c.prerequisites) {
        assert.ok(slugSet.has(p), `Prerequisite ${p} of ${c.label} must exist in the syllabus`);
      }
    }

    // Starting concept must have zero prerequisites
    const startConcept = allConcepts.find((c) => c.slug === "big-data-5vs");
    assert.ok(startConcept, "5 V's concept must exist");
    assert.equal(startConcept.prerequisites.length, 0, "Initial starting concept must have no prerequisites");

    // Advanced concepts must build upon foundations
    const mapReduce = allConcepts.find((c) => c.slug === "mapreduce-paradigm");
    assert.ok(mapReduce, "MapReduce concept must exist");
    assert.ok(mapReduce.prerequisites.includes("block-replication"), "MapReduce must require block-replication");
  });

  await t.test("3. Concept Graph Synchronization and Evidence Association", async () => {
    const subjects = await Subject.find({});
    if (subjects.length === 0) return;

    const testSubj = subjects[0];
    const { nodes, edges, subject } = await syncGroundedConceptsForSubject(testSubj.id || testSubj._id);

    assert.ok(Array.isArray(nodes), "Nodes must be an array");
    assert.ok(Array.isArray(edges), "Edges must be an array");
    assert.ok(nodes.length > 0, "Should return concept nodes for course");
    assert.ok(edges.length > 0, "Should return prerequisite edges for course");
    assert.equal(subject.id, String(testSubj.id || testSubj._id));

    // Verify nodes have layout coordinates and evidence citations
    for (const n of nodes) {
      assert.ok(typeof n.x === "number" && n.x > 0, "Node must have valid X coordinate");
      assert.ok(typeof n.y === "number" && n.y > 0, "Node must have valid Y coordinate");
      assert.ok(n.label, "Node must have label");
      assert.ok(n.summary, "Node must have summary");
      assert.ok(Array.isArray(n.evidenceSources), "Node must have evidenceSources array");
    }

    // Verify edges point to existing node IDs
    const nodeIdSet = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      assert.ok(nodeIdSet.has(e.source), `Edge source ${e.source} must exist in nodes`);
      assert.ok(nodeIdSet.has(e.target), `Edge target ${e.target} must exist in nodes`);
      assert.equal(e.status, "confirmed");
    }
  });

  await t.test("4. Progress Persistence & Review Isolation", async () => {
    const studentA = "test-student-a-roadmap";
    const studentB = "test-student-b-roadmap";
    const testConceptId = "concept-test-123";

    // Student A marks concept as reviewed
    const logA = await AuditLog.create({
      actor_id: studentA,
      action: "CONCEPT_REVIEWED",
      target: testConceptId,
      details: { conceptId: testConceptId, reviewedAt: new Date().toISOString() },
    });
    assert.ok(logA, "Review log should be created");

    // Student B has not reviewed
    const logsB = await AuditLog.find({
      actor_id: studentB,
      action: "CONCEPT_REVIEWED",
    });
    assert.equal(logsB.length, 0, "Student B must not have Student A's review logs");

    // Clean up test audit logs
    try {
      await AuditLog.deleteMany({ actor_id: { $in: [studentA, studentB] } });
    } catch {}
  });
});
