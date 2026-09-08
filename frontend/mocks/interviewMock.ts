export const interviewMock = {
  mission: {
    missionId: "mission-alpha",
    title: "MSA 서비스 분리 판단 노하우",
    expertRole: "Senior MSA Consultant",
    statusLabel: "Interview 진행 중",
  },

  coverageItems: [
    {
      label: "Service Boundary",
      value: 82,
      iconType: "layers",
    },
    {
      label: "Data Ownership",
      value: 56,
      iconType: "database",
    },
    {
      label: "Transaction",
      value: 42,
      iconType: "link",
    },
    {
      label: "Exception",
      value: 63,
      iconType: "alert",
    },
    {
      label: "Failure Cases",
      value: 18,
      iconType: "warning",
    },
  ],

  messages: [
    {
      id: 1,
      speaker: "AI" as const,
      content:
        "MSA에서 서비스는 어떤 기준으로 분리하는 것이 가장 중요하다고 생각하십니까?",
      time: "10:14",
    },
    {
      id: 2,
      speaker: "EXPERT" as const,
      content:
        "비즈니스 도메인 단위로 핵심 비즈니스 역량과 데이터 소유권을 기준으로 서비스를 분리합니다.",
      time: "10:16",
    },
    {
      id: 3,
      speaker: "AI" as const,
      content:
        "도메인이 여러 서비스로 나뉠 때도 동일한 데이터베이스를 유지했던 사례가 있었습니까?",
      time: "10:18",
    },
    {
      id: 4,
      speaker: "EXPERT" as const,
      content:
        "트랜잭션 결합도가 높고 일정이 촉박했던 프로젝트에서는 초기에는 일부 Shared DB를 유지한 적이 있습니다.",
      time: "10:20",
    },
    {
      id: 5,
      speaker: "AI" as const,
      content:
        "그렇다면 Shared DB를 유지할지 분리할지 판단하는 핵심 조건은 무엇입니까?",
      time: "10:21",
    },
  ],

  insights: {
    newRule: {
      title: "서비스 분해 기준",
      description:
        "Business Capability와 데이터 소유권을 서비스 분리의 주요 기준으로 사용합니다.",
    },

    exception: {
      title: "초기 Migration 예외",
      description:
        "Transaction Coupling과 일정 제약이 큰 경우 Shared DB를 일시적으로 유지할 수 있습니다.",
    },

    conflict: {
      title: "DB 분리 원칙과 실제 적용 차이",
      description:
        "Database per Service 원칙과 ADR-021의 Shared DB 적용 사례가 조건에 따라 다르게 나타납니다.",
    },

    gap: {
      title: "분리 여부 판단 Signal 부족",
      description:
        "어떤 수치나 신호를 보고 Transaction Coupling이 높다고 판단하는지 추가 확인이 필요합니다.",
    },
  },
};