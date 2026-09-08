export const conflictMock = {
  mission: {
    missionId: "mission-001",
    title: "MSA 서비스 분리 판단 노하우",
  },

  conflicts: [
    {
      id: "CONFLICT-001",
      title: "Database per Service 적용 시점",

      conflictType: "CONDITIONAL_CONFLICT",
      conflictTypeLabel: "조건부 충돌",

      severity: "HIGH",
      status: "OPEN",
      topic: "Data Ownership",

      sources: {
        expert: {
          sourceType: "EXPERT",
          title: "전문가 발언",
          content:
            "서비스를 분리한다면 데이터베이스도 서비스 단위로 반드시 분리해야 합니다.",
        },

        guideline: {
          sourceType: "GUIDELINE",
          title: "아키텍처 가이드라인",
          content:
            "각 서비스는 자신의 데이터를 독립적으로 소유하는 Database per Service 패턴을 권장합니다.",
        },

        project: {
          sourceType: "PROJECT_EVIDENCE",
          title: "프로젝트 근거",
          content:
            "Legacy Migration 초기 Order와 Inventory 서비스는 Shared Database를 일정 기간 함께 사용했습니다.",
        },
      },

      contextDifference: {
        sourceA: "Target Architecture",
        sourceB: "Migration Phase",
        description:
          "전문가 발언과 가이드라인은 목표 아키텍처 기준이고, 프로젝트 근거는 단계적 Migration 초기 상황에 해당합니다.",
      },

      unknownCondition: {
        title: "아직 확인되지 않은 조건",
        description:
          "어떤 조건에서 Database per Service 원칙을 즉시 적용하지 않고 Shared DB를 임시 유지할 수 있는지 확인이 필요합니다.",
      },

      aiAnalysis:
        "표면적으로는 Database per Service 원칙과 Shared Database 사용 사례가 충돌하지만, 적용 Context가 서로 다릅니다. Migration 단계에서 특정 조건이 존재할 경우 원칙 적용이 유예되는 조건부 예외일 가능성이 있습니다.",

      recommendedQuestion:
        "Legacy Migration 초기에는 Database per Service를 바로 적용하지 않았던 이유는 무엇인가요?",
    },

    {
      id: "CONFLICT-002",
      title: "서비스 간 트랜잭션 처리 방식",

      conflictType: "CONDITIONAL_CONFLICT",
      conflictTypeLabel: "조건부 충돌",

      severity: "MEDIUM",
      status: "OPEN",
      topic: "Transaction",

      sources: {
        expert: {
          sourceType: "EXPERT",
          title: "전문가 발언",
          content:
            "서비스 간 트랜잭션은 가능한 한 동기 방식으로 처리하지 않는 것이 좋습니다.",
        },

        guideline: {
          sourceType: "GUIDELINE",
          title: "아키텍처 가이드라인",
          content:
            "서비스 간 결합도를 줄이기 위해 비동기 이벤트 기반 통신을 우선 고려합니다.",
        },

        project: {
          sourceType: "PROJECT_EVIDENCE",
          title: "프로젝트 근거",
          content:
            "결제 승인 과정에서는 즉각적인 결과 확인이 필요해 일부 동기 호출을 유지했습니다.",
        },
      },

      contextDifference: {
        sourceA: "일반 서비스 통신",
        sourceB: "결제 승인 업무",
        description:
          "일반적인 서비스 간 통신 원칙과 즉각적인 응답이 필요한 결제 업무의 Context가 서로 다릅니다.",
      },

      unknownCondition: {
        title: "아직 확인되지 않은 조건",
        description:
          "어떤 업무 조건에서 비동기 원칙보다 동기 호출을 우선할 수 있는지 구체적인 판단 기준이 확인되지 않았습니다.",
      },

      aiAnalysis:
        "비동기 통신을 기본 원칙으로 사용하지만 즉각적인 응답이나 강한 일관성이 필요한 업무에서는 동기 호출을 예외적으로 허용하는 것으로 보입니다.",

      recommendedQuestion:
        "동기 호출을 허용하는 업무 조건이나 판단 기준은 무엇인가요?",
    },

    {
      id: "CONFLICT-003",
      title: "서비스 분리 기준",

      conflictType: "CONTEXT_DIFFERENCE",
      conflictTypeLabel: "Context 차이",

      severity: "LOW",
      status: "REVIEW",
      topic: "Service Boundary",

      sources: {
        expert: {
          sourceType: "EXPERT",
          title: "전문가 발언",
          content:
            "업무 기능이 다르면 서비스도 분리하는 것이 좋습니다.",
        },

        guideline: {
          sourceType: "GUIDELINE",
          title: "아키텍처 가이드라인",
          content:
            "비즈니스 Capability와 변경 주기를 기준으로 서비스 경계를 결정합니다.",
        },

        project: {
          sourceType: "PROJECT_EVIDENCE",
          title: "프로젝트 근거",
          content:
            "업무 기능은 달랐지만 배포 주기와 운영 조직이 동일해 하나의 서비스로 유지한 사례가 있습니다.",
        },
      },

      contextDifference: {
        sourceA: "일반 서비스 분리 원칙",
        sourceB: "운영 조직 및 배포 제약",
        description:
          "전문가 발언은 기능적 분리를 중심으로 설명하지만 프로젝트 사례는 운영 조직과 배포 주기를 추가 조건으로 고려하고 있습니다.",
      },

      unknownCondition: {
        title: "아직 확인되지 않은 조건",
        description:
          "업무 기능이 달라도 하나의 서비스로 유지하는 구체적인 운영·배포 조건을 추가 확인해야 합니다.",
      },

      aiAnalysis:
        "두 주장이 직접적으로 모순된다기보다 서비스 경계를 판단할 때 고려하는 Context가 서로 다릅니다. 기능적 책임 외에 변경 주기와 운영 책임을 함께 고려하는 것으로 보입니다.",

      recommendedQuestion:
        "업무 기능이 달라도 하나의 서비스로 유지하는 조건은 무엇인가요?",
    },
  ],
};