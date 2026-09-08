export const dnaMock = {
  mission: {
    missionId: "mission-001",
    title: "MSA 서비스 분리 판단 노하우",
    expert: "MSA Architecture Expert",
  },

  graph: {
    nodes: [
      {
        id: "KU-001",
        nodeType: "KNOWLEDGE",
        knowledgeType: "PRINCIPLE",
        typeLabel: "원칙",
        status: "VERIFIED",
        title: "서비스 경계는 비즈니스 책임을 중심으로 정의한다.",
        statement:
          "서비스 경계는 기술 구성보다 비즈니스 Capability와 책임 범위를 우선하여 판단한다.",
        context: "MSA 서비스 경계를 정의하는 초기 설계 단계",
        rule:
          "비즈니스 책임과 변경 주기가 독립적이면 별도 서비스 분리를 우선 검토한다.",
        rationale:
          "책임과 변경 주기가 분리되어 있을수록 서비스 간 변경 영향을 줄이고 독립적인 배포가 가능하기 때문이다.",
        exception:
          "운영 조직과 배포 주기가 동일하고 분리 비용이 큰 경우 하나의 서비스로 유지할 수 있다.",
        confidence: 96,
      },

      {
        id: "KU-002",
        nodeType: "KNOWLEDGE",
        knowledgeType: "DECISION_RULE",
        typeLabel: "판단 규칙",
        status: "VERIFIED",
        title: "트랜잭션 결합도가 높으면 단계적 분리를 우선한다.",
        statement:
          "트랜잭션 결합도가 높은 서비스는 초기 Migration 단계에서 즉시 분리하지 않을 수 있다.",
        context:
          "Legacy Monolith를 단계적으로 MSA로 전환하는 초기 Migration 단계",
        rule:
          "강한 트랜잭션 결합과 일정 제약이 존재하면 단계적 분리를 우선 고려한다.",
        rationale:
          "성급한 분리는 분산 트랜잭션 처리와 운영 복잡도를 증가시킬 수 있기 때문이다.",
        exception:
          "Scaling Pattern 또는 Release Cycle이 크게 다른 경우 초기 단계에서도 우선 분리할 수 있다.",
        confidence: 93,
      },

      {
        id: "KU-003",
        nodeType: "KNOWLEDGE",
        knowledgeType: "EXCEPTION",
        typeLabel: "예외",
        status: "VERIFIED",
        title: "Migration 초기에는 Shared DB를 임시 유지할 수 있다.",
        statement:
          "Database per Service는 목표 원칙이지만 Migration 초기에는 조건에 따라 Shared DB를 임시 유지할 수 있다.",
        context:
          "Legacy Coupling이 높고 일정 제약이 존재하는 Migration 초기 단계",
        rule:
          "목표 아키텍처에서는 서비스별 데이터 소유권 분리를 기본 원칙으로 한다.",
        rationale:
          "기존 데이터 의존성이 높은 상태에서 즉시 DB를 분리하면 Migration 위험이 증가하기 때문이다.",
        exception:
          "서비스별 독립 배포 또는 장애 격리가 즉시 필요한 경우에는 우선 분리한다.",
        confidence: 89,
      },

      {
        id: "EV-001",
        nodeType: "EVIDENCE",
        sourceType: "ADR",
        sourceId: "ADR-021",
        title: "Order / Inventory Shared DB",
        content:
          "초기 Migration 단계에서 Order와 Inventory는 Shared Database를 유지한 뒤 단계적으로 분리했다.",
        relevance: 0.95,
        supportDirection: "SUPPORT",
      },

      {
        id: "EV-002",
        nodeType: "EVIDENCE",
        sourceType: "EXPERT",
        sourceId: "INTERVIEW-01",
        title: "전문가 인터뷰",
        content:
          "Transaction Coupling과 일정 제약 때문에 처음부터 DB를 분리하지 않았습니다.",
        relevance: 0.92,
        supportDirection: "SUPPORT",
      },
    ],

    relations: [
      {
        id: "REL-001",
        source: "KU-001",
        target: "KU-002",
        relationType: "RELATED",
        relationLabel: "관련",
        confidence: 0.91,
      },
      {
        id: "REL-002",
        source: "KU-002",
        target: "KU-003",
        relationType: "HAS_EXCEPTION",
        relationLabel: "예외",
        confidence: 0.94,
      },
      {
        id: "REL-003",
        source: "EV-001",
        target: "KU-003",
        relationType: "SUPPORTS",
        relationLabel: "근거",
        confidence: 0.95,
      },
      {
        id: "REL-004",
        source: "EV-002",
        target: "KU-002",
        relationType: "SUPPORTS",
        relationLabel: "근거",
        confidence: 0.92,
      },
    ],
  },
} as const;