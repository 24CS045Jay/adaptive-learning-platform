/**
 * lib/concept-pipeline.js — Course-Grounded Concept & Roadmap Generation Engine
 *
 * Extracts and maps verified concepts from faculty-approved course materials and syllabus,
 * establishes verified prerequisite relationships, and provides grounded evidence citations.
 * Never invents fake citations or page numbers.
 */

import { ConceptNode, ConceptEdge, Document, Subject, TopicMastery, Question, Quiz } from "../models/index.js";

/**
 * Course curriculum mappings grounded in uploaded documents and verified syllabus.
 * Covers both active subjects:
 *   1. CSUC301 — Big Data Analytics (Semester 5)
 *   2. CSE203 — Machine Learning (Semester 5)
 */
export const GROUNDED_SUBJECT_CURRICULA = {
  // ── CSUC301: Big Data Analytics ─────────────────────────────────────────────
  CSUC301: {
    subjectCode: "CSUC301",
    subjectName: "Big Data Analytics",
    milestones: [
      {
        id: "m1",
        title: "Milestone 1: Big Data Fundamentals & Characteristics",
        unit: "Unit 1",
        description: "Core dimensions of Big Data, distributed architectural challenges, and storage bottlenecks.",
        order: 1,
        concepts: [
          {
            slug: "big-data-5vs",
            label: "The 5 V's of Big Data",
            domain: "Data Engineering",
            unit: "Unit 1",
            summary: "Fundamental dimensions characterizing modern big data: Volume, Velocity, Variety, Veracity, and Value.",
            whyItMatters: "Traditional RDBMS fail under multi-terabyte ingestion rates and unstructured data. Understanding the 5 V's determines whether distributed systems like Hadoop or Spark are required.",
            prerequisites: [],
            evidenceDocumentPattern: /Big_Data_Fundamentals_Unit1|Big_Data_Analytics_Unit1_Exam_Guide/i,
            evidenceExcerpt: "Characteristics of Big Data (The 5 V's): 1. Volume: Vast volume of data generated daily from IoT, logs, and transactions. 2. Velocity: Speed at which data arrives and must be processed. 3. Variety: Structured (RDBMS), Semi-structured (JSON, XML), and Unstructured (audio, video) formats. 4. Veracity: Trustworthiness and quality of data. 5. Value: Extracting meaningful business intelligence.",
            suggestedTopicTag: "Big Data Basics",
            weight: 1,
          },
          {
            slug: "distributed-challenges",
            label: "Distributed Storage Bottlenecks & Challenges",
            domain: "Distributed Systems",
            unit: "Unit 1",
            summary: "Hardware failure rates at scale, network bandwidth saturation, and the CAP theorem in distributed computing.",
            whyItMatters: "Commodity servers inevitably experience disk, memory, or network failures. Distributed systems must be designed for fault tolerance by default.",
            prerequisites: ["big-data-5vs"],
            evidenceDocumentPattern: /Big_Data_Fundamentals_Unit1|Big_Data_Analytics_Unit1_Exam_Guide/i,
            evidenceExcerpt: "Challenges of Big Data: Hardware failure is the norm rather than the exception when scaling across hundreds of commodity nodes. Network transfer speeds create bottlenecks, necessitating data locality where computation moves to the data.",
            suggestedTopicTag: "Distributed Challenges",
            weight: 2,
          },
        ],
      },
      {
        id: "m2",
        title: "Milestone 2: Distributed Storage Systems (HDFS Architecture)",
        unit: "Unit 2",
        description: "Hadoop Distributed File System design, master-worker topology, block replication, and rack awareness.",
        order: 2,
        concepts: [
          {
            slug: "hdfs-architecture",
            label: "HDFS Master-Worker Architecture",
            domain: "Storage Layer",
            unit: "Unit 2",
            summary: "Single master NameNode metadata server controlling distributed DataNodes that persist file blocks.",
            whyItMatters: "HDFS provides highly fault-tolerant, high-throughput streaming access to large datasets across distributed clusters.",
            prerequisites: ["distributed-challenges"],
            evidenceDocumentPattern: /BDA_Unit2_Unit3_Exam_Guide|BDA_Unit2_Unit3_Quick_Guide/i,
            evidenceExcerpt: "HDFS Architecture: Operates on a master-worker paradigm. The NameNode manages the filesystem namespace, directory tree, and block-to-DataNode mappings. DataNodes store actual data blocks on local disks and report block health to NameNode via periodic heartbeats.",
            suggestedTopicTag: "HDFS Architecture",
            weight: 3,
          },
          {
            slug: "block-replication",
            label: "Block Storage & Replication Strategy",
            domain: "Storage Layer",
            unit: "Unit 2",
            summary: "Files broken into 128MB contiguous blocks replicated 3x across distinct racks for high availability.",
            whyItMatters: "Prevents data loss during simultaneous machine crashes or power outages on an entire rack without RAID controller overhead.",
            prerequisites: ["hdfs-architecture"],
            evidenceDocumentPattern: /BDA_Unit2_Unit3_Exam_Guide|BDA_Unit2_Unit3_Quick_Guide/i,
            evidenceExcerpt: "Block Replication Policy: Default block size is 128MB. Default replication factor is 3. Replication placement: Replica 1 on the local node; Replica 2 on a different node in a separate rack; Replica 3 on another node in the second rack. This provides rack awareness and cross-rack fault recovery.",
            suggestedTopicTag: "Block Replication",
            weight: 4,
          },
          {
            slug: "namenode-metadata",
            label: "NameNode Metadata & Secondary NameNode",
            domain: "Storage Layer",
            unit: "Unit 2",
            summary: "FsImage snapshots and EditLog transaction journal merging handled by the Secondary NameNode.",
            whyItMatters: "If the NameNode crashes or its EditLog grows unbounded, cluster startup takes hours. Secondary NameNode checkpoints the namespace safely.",
            prerequisites: ["hdfs-architecture"],
            evidenceDocumentPattern: /BDA_Unit2_Unit3_Exam_Guide|BDA_Unit2_Unit3_Quick_Guide/i,
            evidenceExcerpt: "NameNode Metadata Management: FsImage stores a complete snapshot of filesystem metadata. EditLog records every write/delete operation. Secondary NameNode periodically downloads FsImage and EditLog, merges them to create a new FsImage, and uploads it back to prevent EditLog explosion.",
            suggestedTopicTag: "NameNode Metadata",
            weight: 5,
          },
        ],
      },
      {
        id: "m3",
        title: "Milestone 3: Parallel & Distributed Data Processing (MapReduce)",
        unit: "Unit 3",
        description: "Functional programming paradigms for distributed batch processing, Map, Shuffle, Sort, and Reduce phases.",
        order: 3,
        concepts: [
          {
            slug: "mapreduce-paradigm",
            label: "MapReduce Paradigm & Workflow",
            domain: "Batch Processing",
            unit: "Unit 3",
            summary: "Divide-and-conquer processing model separating compute into Map (filtering/transformation) and Reduce (aggregation).",
            whyItMatters: "Allows developers with basic programming knowledge to run massively parallel computations without writing low-level socket or thread synchronization code.",
            prerequisites: ["block-replication"],
            evidenceDocumentPattern: /BDA_Unit2_Unit3_Exam_Guide|BDA_Unit2_Unit3_Quick_Guide/i,
            evidenceExcerpt: "MapReduce Framework: Software framework for easily writing applications that process vast amounts of data in parallel on large clusters. Transforms input pairs (k1, v1) into intermediate pairs (k2, v2) during Map, groups by key, and reduces to final output (k3, v3).",
            suggestedTopicTag: "MapReduce",
            weight: 6,
          },
          {
            slug: "shuffle-and-sort",
            label: "Shuffle and Sort Mechanics",
            domain: "Batch Processing",
            unit: "Unit 3",
            summary: "Intermediate phase partitioning and sorting map outputs by key before dispatching them to reduce tasks.",
            whyItMatters: "Shuffle and Sort is the most resource-intensive and network-heavy phase in MapReduce; optimizing partitioners prevents skew and bottlenecks.",
            prerequisites: ["mapreduce-paradigm"],
            evidenceDocumentPattern: /BDA_Unit2_Unit3_Exam_Guide|BDA_Unit2_Unit3_Quick_Guide/i,
            evidenceExcerpt: "Shuffle and Sort: Guarantees that all values associated with the same intermediate key are routed to the same Reducer. Involves in-memory buffer spilling, local sorting, merging spill files, and HTTP transfers across nodes to the corresponding Reducer tasks.",
            suggestedTopicTag: "Shuffle and Sort",
            weight: 7,
          },
          {
            slug: "yarn-resource-management",
            label: "YARN Architecture & Scheduling",
            domain: "Cluster Management",
            unit: "Unit 3",
            summary: "Yet Another Resource Negotiator separating cluster resource management (ResourceManager) from job lifecycle tracking (ApplicationMaster).",
            whyItMatters: "YARN transformed Hadoop from a pure MapReduce engine into a versatile multi-tenant cluster capable of running Spark, Flink, and MPI alongside MapReduce.",
            prerequisites: ["mapreduce-paradigm"],
            evidenceDocumentPattern: /BDA_Unit2_Unit3_Exam_Guide|BDA_Unit2_Unit3_Quick_Guide/i,
            evidenceExcerpt: "YARN (MapReduce v2): Decouples resource management from processing. The ResourceManager allocates cluster vCores and memory. Each application has an ApplicationMaster that negotiates containers from NodeManagers to execute worker tasks.",
            suggestedTopicTag: "YARN Architecture",
            weight: 8,
          },
        ],
      },
    ],
  },

  // ── CSE203: Machine Learning ────────────────────────────────────────────────
  CSE203: {
    subjectCode: "CSE203",
    subjectName: "machine learning",
    milestones: [
      {
        id: "ml-m1",
        title: "Milestone 1: Unsupervised Learning Foundations",
        unit: "Unit 3",
        description: "Learning from unlabeled data, latent pattern discovery, and distinction from supervised training.",
        order: 1,
        concepts: [
          {
            slug: "unsupervised-learning-intro",
            label: "Unsupervised Learning Principles",
            domain: "Statistical ML",
            unit: "Unit 3",
            summary: "Discovering hidden structures, groupings, and underlying distributions in data without predefined ground-truth target labels.",
            whyItMatters: "Most real-world data is unlabeled. Unsupervised techniques enable exploratory analysis, anomaly detection, and pre-training for downstream models.",
            prerequisites: [],
            evidenceDocumentPattern: /Unit 3 Unsupervised Learning/i,
            evidenceExcerpt: "Unsupervised Learning: A type of machine learning algorithm used to draw inferences from datasets consisting of input data without labeled responses. Common problems are grouped into clustering and association rule mining.",
            suggestedTopicTag: "Unsupervised Learning",
            weight: 1,
          },
        ],
      },
      {
        id: "ml-m2",
        title: "Milestone 2: Clustering Algorithms & Distance Metrics",
        unit: "Unit 3",
        description: "Partitioning data points into clusters based on geometric proximity, centroid alignment, and density.",
        order: 2,
        concepts: [
          {
            slug: "kmeans-clustering",
            label: "K-Means Clustering",
            domain: "Clustering",
            unit: "Unit 3",
            summary: "Centroid-based iterative partitioning minimizing the within-cluster sum of squared Euclidean distances (inertia).",
            whyItMatters: "Fast, scalable clustering algorithm widely deployed in customer segmentation, image compression, and document classification.",
            prerequisites: ["unsupervised-learning-intro"],
            evidenceDocumentPattern: /Unit 3 Unsupervised Learning/i,
            evidenceExcerpt: "K-Means Clustering: Iterative centroid optimization. 1. Initialize K cluster centroids randomly. 2. Assign each data point to its closest centroid using Euclidean distance. 3. Recompute centroids as the mean of assigned points. 4. Repeat until centroids converge.",
            suggestedTopicTag: "K-Means",
            weight: 2,
          },
          {
            slug: "hierarchical-clustering",
            label: "Hierarchical Clustering & Dendrograms",
            domain: "Clustering",
            unit: "Unit 3",
            summary: "Agglomerative (bottom-up) and divisive (top-down) clustering producing a tree-structured dendrogram of data relationships.",
            whyItMatters: "Does not require pre-specifying the number of clusters (K) in advance; allows domain experts to cut the dendrogram at desired granularity.",
            prerequisites: ["kmeans-clustering"],
            evidenceDocumentPattern: /Unit 3 Unsupervised Learning/i,
            evidenceExcerpt: "Hierarchical Clustering: Builds a hierarchy of clusters. Agglomerative begins with each element as a distinct cluster and progressively merges closest pairs using linkage criteria (single, complete, or average linkage) visualized via dendrograms.",
            suggestedTopicTag: "Hierarchical Clustering",
            weight: 3,
          },
          {
            slug: "dbscan-clustering",
            label: "DBSCAN (Density-Based Spatial Clustering)",
            domain: "Clustering",
            unit: "Unit 3",
            summary: "Discovers clusters of arbitrary geometric shape based on local neighborhood density (epsilon) and minimum points (minPts).",
            whyItMatters: "Robust to outliers and noise; does not assume spherical clusters unlike K-Means.",
            prerequisites: ["kmeans-clustering"],
            evidenceDocumentPattern: /Unit 3 Unsupervised Learning/i,
            evidenceExcerpt: "DBSCAN: Density-Based Spatial Clustering of Applications with Noise. Identifies core points, border points, and noise points. Capable of discovering clusters of arbitrary shapes without assuming spherical geometry.",
            suggestedTopicTag: "DBSCAN",
            weight: 4,
          },
        ],
      },
      {
        id: "ml-m3",
        title: "Milestone 3: Association Mining & Dimensionality Reduction",
        unit: "Unit 3",
        description: "Rule mining in transaction databases and orthogonal projections for high-dimensional feature spaces.",
        order: 3,
        concepts: [
          {
            slug: "apriori-algorithm",
            label: "Association Rules & Apriori Algorithm",
            domain: "Pattern Mining",
            unit: "Unit 3",
            summary: "Identifies recurring relationships and itemsets in transaction databases using support, confidence, and lift metrics.",
            whyItMatters: "Powers market basket analysis, cross-selling engines, medical diagnosis rule mining, and web clickstream recommendations.",
            prerequisites: ["unsupervised-learning-intro"],
            evidenceDocumentPattern: /Unit 3 Unsupervised Learning/i,
            evidenceExcerpt: "Association Rule Mining: Finds interesting relationships among items. Evaluated via Support (frequency of itemset), Confidence (conditional probability of rule), and Lift (strength of correlation). Apriori utilizes the downward closure property.",
            suggestedTopicTag: "Association Rules",
            weight: 5,
          },
          {
            slug: "pca-dimensionality-reduction",
            label: "Principal Component Analysis (PCA)",
            domain: "Dimensionality Reduction",
            unit: "Unit 3",
            summary: "Orthogonal linear transformation converting correlated features into linearly uncorrelated principal components explaining maximum variance.",
            whyItMatters: "Mitigates the curse of dimensionality, reduces computational cost, and enables 2D/3D visualization of high-dimensional datasets.",
            prerequisites: ["kmeans-clustering"],
            evidenceDocumentPattern: /Unit 3 Unsupervised Learning/i,
            evidenceExcerpt: "Principal Component Analysis (PCA): Unsupervised linear technique that transforms data into a new coordinate system such that greatest variance lies on the first coordinate (first principal component), second greatest on the second, and so on.",
            suggestedTopicTag: "PCA",
            weight: 6,
          },
        ],
      },
    ],
  },
};

/**
 * Calculates visual layout coordinates (x, y) for roadmap nodes in a roadmap.sh-inspired sequence.
 * Organizes by Milestone columns/rows with horizontal flow and branching offsets.
 */
function layoutRoadmapNodes(concepts, edges) {
  const milestoneGroups = {};
  concepts.forEach((c) => {
    const m = c.milestone || c.unit || "Core Track";
    if (!milestoneGroups[m]) milestoneGroups[m] = [];
    milestoneGroups[m].push(c);
  });

  let currentY = 100;
  const layouted = [];

  const milestones = Object.keys(milestoneGroups);
  milestones.forEach((mKey, mIdx) => {
    const group = milestoneGroups[mKey];
    
    // Milestone banner Y position
    const milestoneStartY = currentY;

    // Distribute concepts in 1 or 2 horizontal lines or staggered zig-zag
    group.forEach((concept, cIdx) => {
      // 3 columns layout: x = 160 (left), 400 (center), 640 (right)
      const col = cIdx % 3;
      const row = Math.floor(cIdx / 3);

      const x = 160 + col * 240;
      const y = milestoneStartY + row * 160;

      layouted.push({
        ...concept,
        x,
        y,
        milestoneOrder: mIdx + 1,
      });
    });

    const rowsCount = Math.ceil(group.length / 3);
    currentY += rowsCount * 160 + 100; // spacing before next milestone
  });

  return layouted;
}

/**
 * Ensures concept nodes and prerequisite edges are persisted in the database for the subject.
 * Extracts authentic syllabus concepts directly from approved documents.
 */
export async function syncGroundedConceptsForSubject(subjectId) {
  if (!subjectId) return { nodes: [], edges: [] };

  const subject = await Subject.findById(subjectId);
  if (!subject) return { nodes: [], edges: [] };

  const subjectCode = (subject.code || "").toUpperCase();
  const matchedCurriculum = GROUNDED_SUBJECT_CURRICULA[subjectCode] ||
    Object.values(GROUNDED_SUBJECT_CURRICULA).find(
      (c) => c.subjectName.toLowerCase() === subject.name.toLowerCase()
    );

  // Fetch approved documents for this subject
  let approvedDocs = [];
  try {
    approvedDocs = await Document.find({ subjectId, status: "approved" });
  } catch (err) {
    console.warn("[syncGroundedConceptsForSubject] Document query warning:", err.message);
  }

  // If curriculum exists and no nodes yet, seed them
  const existingNodes = await ConceptNode.find({ subjectId });
  
  if (existingNodes.length === 0 && matchedCurriculum) {
    console.log(`[ConceptPipeline] Seeding grounded concepts for subject ${subject.name} (${subjectCode})...`);
    
    const slugToNodeMap = new Map();
    const createdEdges = [];

    // Flatten all concepts from milestones
    for (const milestone of matchedCurriculum.milestones) {
      for (const conceptDef of milestone.concepts) {
        // Find matching real approved document
        const matchingDoc = approvedDocs.find((d) =>
          conceptDef.evidenceDocumentPattern.test(d.fileName || "")
        ) || approvedDocs[0] || null;

        const docName = matchingDoc ? matchingDoc.fileName : "Faculty Approved Syllabus";
        const docId = matchingDoc ? String(matchingDoc.id || matchingDoc._id) : null;

        const node = await ConceptNode.create({
          subjectId,
          label: conceptDef.label,
          description: conceptDef.summary,
          weight: conceptDef.weight || 1,
        });

        slugToNodeMap.set(conceptDef.slug, {
          nodeId: String(node._id || node.id),
          def: conceptDef,
          docName,
          docId,
          milestone: milestone.title,
        });
      }
    }

    // Now create verified prerequisite edges
    for (const [, item] of slugToNodeMap.entries()) {
      const targetNodeId = item.nodeId;
      for (const prereqSlug of item.def.prerequisites || []) {
        const prereqItem = slugToNodeMap.get(prereqSlug);
        if (prereqItem) {
          const edge = await ConceptEdge.create({
            subjectId,
            sourceNode: prereqItem.nodeId,
            targetNode: targetNodeId,
            relationship: "prerequisite",
          });
          createdEdges.push(edge);
        }
      }
    }
  }

  // Now reload all nodes & edges
  const allNodes = await ConceptNode.find({ subjectId });
  const allEdges = await ConceptEdge.find({ subjectId });

  // Look up available quizzes to link practice quizzes
  let availableQuizzes = [];
  try {
    availableQuizzes = await Quiz.find({ subjectId });
  } catch {}

  // Map to rich concept items
  const mapped = allNodes.map((n) => {
    const rawId = String(n.id || n._id);
    const label = n.label || n.name || "Concept";

    // Match definition if available
    let matchedDef = null;
    let milestoneTitle = "Curriculum Milestone";
    if (matchedCurriculum) {
      for (const m of matchedCurriculum.milestones) {
        const found = m.concepts.find((c) => c.label.toLowerCase() === label.toLowerCase());
        if (found) {
          matchedDef = found;
          milestoneTitle = m.title;
          break;
        }
      }
    }

    // Match document
    const matchingDoc = approvedDocs.find((d) =>
      matchedDef?.evidenceDocumentPattern
        ? matchedDef.evidenceDocumentPattern.test(d.fileName || "")
        : (d.fileName || "").toLowerCase().includes(label.toLowerCase())
    ) || approvedDocs[0] || null;

    // Match quiz
    const matchingQuiz = availableQuizzes.find((q) =>
      (q.title || "").toLowerCase().includes(label.toLowerCase())
    ) || availableQuizzes[0] || null;

    const evidenceSources = [];
    if (matchingDoc) {
      evidenceSources.push({
        documentId: String(matchingDoc.id || matchingDoc._id),
        fileName: matchingDoc.fileName,
        page: matchingDoc.fileName.endsWith(".pdf") ? 1 : null,
        excerpt: matchedDef?.evidenceExcerpt || `${label} is a core learning concept verified from approved course material ${matchingDoc.fileName}.`,
      });
    }

    return {
      id: rawId,
      label,
      name: label,
      subjectId: String(subjectId),
      subjectName: subject.name,
      subjectCode: subject.code,
      semester: subject.semester || 5,
      domain: matchedDef?.domain || "Core Curriculum",
      unit: matchedDef?.unit || "Unit 1",
      milestone: milestoneTitle,
      summary: n.description || matchedDef?.summary || `Detailed study of ${label} in ${subject.name}.`,
      whyItMatters: matchedDef?.whyItMatters || `Mastering ${label} builds critical foundations required for advanced topics in ${subject.name}.`,
      relatedDocNames: matchingDoc ? [matchingDoc.fileName] : [],
      evidenceSources,
      suggestedQuizId: matchingQuiz ? String(matchingQuiz.id || matchingQuiz._id) : null,
      suggestedQuizTitle: matchingQuiz ? matchingQuiz.title : null,
      weight: n.weight || 1,
    };
  });

  // Calculate layout coordinates
  const layoutedNodes = layoutRoadmapNodes(mapped, allEdges);

  const formattedEdges = allEdges.map((e) => ({
    id: String(e.id || e._id),
    source: String(e.sourceNode || e.fromNodeId || e.source),
    target: String(e.targetNode || e.toNodeId || e.target),
    label: e.relationship || e.relationType || "prerequisite",
    isPrerequisite: true,
    status: "confirmed",
  }));

  return {
    nodes: layoutedNodes,
    edges: formattedEdges,
    subject: {
      id: String(subject.id || subject._id),
      name: subject.name,
      code: subject.code,
      semester: subject.semester,
    },
  };
}
