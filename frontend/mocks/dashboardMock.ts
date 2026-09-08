// Dashboard 화면 테스트용 Mock 데이터
export const dashboardMock = {
  summary: {
    activeMissions: 1,
    candidates: 27,
    knowledgeUnits: 120,
    verifiedKnowledge: 84,
    conflicts: 9,
  },

  activeMission: {
    missionId: "mission-alpha",
    title: "MSA 서비스 분리 판단 노하우",
    expertRole: "Senior MSA Consultant",
    description:
      "레거시 시스템의 MSA 전환 과정에서 서비스 경계, 데이터 소유권, 예외 조건을 구조화합니다.",
    coverage: 68,
  },
};