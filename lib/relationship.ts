export type RelationshipQuestionType = 'positive' | 'negative' | 'role_leader' | 'role_isolated';

export const MAX_NOMINATIONS_PER_TYPE = 3;

export type RosterStudent = { id: string; name: string; studentNumber: number };

export type RelationshipNominationRow = {
  raterId: string;
  targetId: string;
  questionType: RelationshipQuestionType;
};

export type SociogramNode = {
  studentId: string;
  name: string;
  studentNumber: number;
  positiveInCount: number;
  negativeInCount: number;
  isIsolated: boolean;
  isConflictRisk: boolean;
};

export type SociogramEdge = { fromId: string; toId: string; mutual: boolean };

export type RoleTally = { studentId: string; name: string; studentNumber: number; count: number };

export type SociogramReport = {
  nodes: SociogramNode[];
  positiveEdges: SociogramEdge[];
  mutualPairCount: number;
  isolatedStudents: SociogramNode[];
  conflictRiskStudents: SociogramNode[];
  groups: RosterStudent[][];
  roleLeaders: RoleTally[];
  roleIsolatedPicks: RoleTally[];
  includesNegative: boolean;
};

const toRoleTally = (
  nominations: RelationshipNominationRow[],
  type: RelationshipQuestionType,
  rosterById: Map<string, RosterStudent>
): RoleTally[] => {
  const counts = new Map<string, number>();
  nominations
    .filter((n) => n.questionType === type)
    .forEach((n) => counts.set(n.targetId, (counts.get(n.targetId) ?? 0) + 1));

  return [...counts.entries()]
    .map(([studentId, count]) => {
      const student = rosterById.get(studentId);
      return student ? { studentId, name: student.name, studentNumber: student.studentNumber, count } : null;
    })
    .filter((v): v is RoleTally => v !== null)
    .sort((a, b) => b.count - a.count);
};

/** 학생들의 지명 응답을 소시오그램 지표(인기도·상호지명·고립·갈등위험·소그룹)로 집계한다. */
export function buildSociogram(
  roster: RosterStudent[],
  nominations: RelationshipNominationRow[],
  includesNegative: boolean
): SociogramReport {
  const rosterById = new Map(roster.map((s) => [s.id, s]));

  const positiveNominations = nominations.filter((n) => n.questionType === 'positive');
  const negativeNominations = nominations.filter((n) => n.questionType === 'negative');

  const positiveInCount = new Map<string, number>(roster.map((s) => [s.id, 0]));
  positiveNominations.forEach((n) => positiveInCount.set(n.targetId, (positiveInCount.get(n.targetId) ?? 0) + 1));

  const negativeInCount = new Map<string, number>(roster.map((s) => [s.id, 0]));
  negativeNominations.forEach((n) => negativeInCount.set(n.targetId, (negativeInCount.get(n.targetId) ?? 0) + 1));

  const negativeAvg = includesNegative && roster.length > 0
    ? [...negativeInCount.values()].reduce((sum, v) => sum + v, 0) / roster.length
    : 0;
  const conflictRiskThreshold = negativeAvg + 2;

  // 상호 지명 여부 확인용 집합
  const positivePairKey = (a: string, b: string) => `${a}|${b}`;
  const positiveSet = new Set(positiveNominations.map((n) => positivePairKey(n.raterId, n.targetId)));

  const positiveEdges: SociogramEdge[] = positiveNominations.map((n) => ({
    fromId: n.raterId,
    toId: n.targetId,
    mutual: positiveSet.has(positivePairKey(n.targetId, n.raterId)),
  }));

  const mutualPairKeys = new Set<string>();
  positiveEdges.forEach((edge) => {
    if (edge.mutual) {
      const key = [edge.fromId, edge.toId].sort().join('|');
      mutualPairKeys.add(key);
    }
  });

  const nodes: SociogramNode[] = roster.map((s) => {
    const positiveIn = positiveInCount.get(s.id) ?? 0;
    const negativeIn = negativeInCount.get(s.id) ?? 0;
    return {
      studentId: s.id,
      name: s.name,
      studentNumber: s.studentNumber,
      positiveInCount: positiveIn,
      negativeInCount: negativeIn,
      isIsolated: positiveIn === 0,
      isConflictRisk: includesNegative && negativeIn > 0 && negativeIn > conflictRiskThreshold,
    };
  });

  // 상호 지명 쌍을 엣지로 하는 연결 요소(소그룹) 계산
  const adjacency = new Map<string, Set<string>>(roster.map((s) => [s.id, new Set<string>()]));
  mutualPairKeys.forEach((key) => {
    const [a, b] = key.split('|');
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  });

  const visited = new Set<string>();
  const groups: RosterStudent[][] = [];
  roster.forEach((student) => {
    if (visited.has(student.id) || (adjacency.get(student.id)?.size ?? 0) === 0) return;
    const componentIds: string[] = [];
    const queue = [student.id];
    visited.add(student.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      componentIds.push(current);
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    if (componentIds.length >= 2) {
      groups.push(componentIds.map((id) => rosterById.get(id)!).filter(Boolean));
    }
  });

  return {
    nodes,
    positiveEdges,
    mutualPairCount: mutualPairKeys.size,
    isolatedStudents: nodes.filter((n) => n.isIsolated),
    conflictRiskStudents: nodes.filter((n) => n.isConflictRisk),
    groups,
    roleLeaders: toRoleTally(nominations, 'role_leader', rosterById),
    roleIsolatedPicks: toRoleTally(nominations, 'role_isolated', rosterById),
    includesNegative,
  };
}
