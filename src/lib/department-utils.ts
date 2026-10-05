export interface DepartmentInfo {
  code: string;
  label: string;
  id: string;
}

export const DEPARTMENTS: DepartmentInfo[] = [
  { code: "CSE", label: "Computer Science & Engineering", id: "6a7bd9a4a2e4e5d9bc75c22e" },
  { code: "CE", label: "Computer Engineering", id: "6a7bd9a4a2e4e5d9bc75c22f" },
  { code: "IT", label: "Information Technology", id: "6a7bd9a4a2e4e5d9bc75c230" },
  { code: "EC", label: "Electronics & Communication", id: "6a7bd9a4a2e4e5d9bc75c231" },
  { code: "AIML", label: "AI & Machine Learning", id: "6a7bd9a4a2e4e5d9bc75c232" },
];

export function getDepartmentInfo(deptIdOrCode?: string): DepartmentInfo | undefined {
  if (!deptIdOrCode) return undefined;
  const clean = String(deptIdOrCode).trim().toLowerCase();
  return DEPARTMENTS.find(
    (d) => d.code.toLowerCase() === clean || d.id.toLowerCase() === clean,
  );
}

export function getDepartmentLabel(deptIdOrCode?: string): string {
  const info = getDepartmentInfo(deptIdOrCode);
  if (info) return `${info.label} (${info.code})`;
  if (!deptIdOrCode) return "All Departments";
  return String(deptIdOrCode);
}

export function getDepartmentCode(deptIdOrCode?: string): string {
  const info = getDepartmentInfo(deptIdOrCode);
  if (info) return info.code;
  if (!deptIdOrCode) return "GEN";
  const str = String(deptIdOrCode).trim();
  return str.length > 8 ? "CSE" : str.toUpperCase();
}
