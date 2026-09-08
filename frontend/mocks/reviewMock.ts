export const reviewMock = {
  mission: {
    missionId: "mission-001",
    title: "MSA 서비스 분리 판단 노하우",
  },

  knowledgeUnits: [
    {
      id: "KU-001",
      type: "DECISION_RULE",
      typeLabel: "판단 규칙",
      status: "CANDIDATE",

      knowledge:
        "트랜잭션 결합도가 높은 서비스는 초기 Migration 단계에서 즉시 분리하지 않을 수 있다.",

      context:
        "Legacy Monolith를 단계적으로 MSA로 전환하는 초기 Migration 단계",

      rule:
        "서비스 간 강한 트랜잭션 결합이 존재하고 일정 제약이 큰 경우 단계적 분리를 우선 고려한다.",

      rationale:
        "트랜잭션 결합이 높은 상태에서 서비스를 성급하게 분리하면 분산 트랜잭션 처리와 운영 복잡도가 증가할 수 있기 때문이다.",

      exception:
        "독립 배포 또는 장애 격리가 반드시 필요한 서비스는 초기 단계에서도 우선 분리할 수 있다.",

      evidence: [
        {
          id: "ADR-021",
          sourceType: "ADR",
          title: "Order / Inventory Shared DB",
          content:
            "초기 Migration 단계에서 Order와 Inventory는 Shared Database를 유지한 뒤 단계적으로 분리했다.",
        },
        {
          id: "INTERVIEW-01",
          sourceType: "EXPERT",
          title: "전문가 인터뷰",
          content:
            "트랜잭션 결합도와 일정 제약 때문에 처음부터 DB를 나누지는 않았습니다.",
        },
      ],

      confidence: 92,
    },

    {
      id: "KU-002",
      type: "EXCEPTION",
      typeLabel: "예외",
      status: "CANDIDATE",

      knowledge:
        "Database per Service 원칙은 Migration 초기 단계에서 예외적으로 적용을 유예할 수 있다.",

      context:
        "기존 Shared Database 의존도가 높고 서비스별 데이터 소유권 정리가 완료되지 않은 상황",

      rule:
        "목표 아키텍처에서는 서비스별 데이터 소유권을 분리하는 것을 기본 원칙으로 한다.",

      rationale:
        "기존 데이터 의존성이 높은 상태에서 즉시 데이터베이스를 분리하면 Migration 위험과 전환 비용이 크게 증가할 수 있기 때문이다.",

      exception:
        "초기 Migration 단계에서는 기존 시스템 의존성과 일정 제약으로 Shared DB를 임시 유지할 수 있다.",

      evidence: [
        {
          id: "GUIDE-001",
          sourceType: "GUIDELINE",
          title: "Architecture Guideline",
          content:
            "서비스는 자신의 데이터를 독립적으로 소유하는 Database per Service 패턴을 권장한다.",
        },
        {
          id: "ADR-021",
          sourceType: "ADR",
          title: "Migration 단계적 DB 분리",
          content:
            "Order와 Inventory는 초기 단계에서 Shared DB를 유지했다.",
        },
      ],

      confidence: 88,
    },

    {
      id: "KU-003",
      type: "FAILURE_LESSON",
      typeLabel: "실패 교훈",
      status: "CANDIDATE",

      knowledge:
        "서비스 계층마다 Retry를 중복 적용하면 장애 상황에서 트래픽이 급격하게 증가할 수 있다.",

      context:
        "다수의 마이크로서비스가 연쇄적으로 호출되는 장애 상황",

      rule:
        "Retry 정책은 전체 호출 체인을 고려해 한정된 계층에서 적용해야 한다.",

      rationale:
        "여러 계층에서 동시에 Retry가 수행되면 하나의 실패 요청이 반복적으로 증폭되어 장애를 악화시킬 수 있기 때문이다.",

      exception:
        "독립적인 외부 호출이며 상위 계층에서 Retry가 수행되지 않는 경우에는 개별 Retry를 적용할 수 있다.",

      evidence: [
        {
          id: "IR-017",
          sourceType: "INCIDENT",
          title: "Retry Storm Incident",
          content:
            "Retry가 여러 계층에서 중복 수행되면서 장애 시 요청 트래픽이 약 9배 증가했다.",
        },
      ],

      confidence: 95,
    },

    {
      id: "KU-004",
      type: "PRINCIPLE",
      typeLabel: "원칙",
      status: "VERIFIED",

      knowledge:
        "서비스 경계는 비즈니스 Capability와 변경 주기를 함께 고려해 결정한다.",

      context:
        "서비스 분리 후보를 식별하는 초기 설계 단계",

      rule:
        "비즈니스 책임이 다르고 변경 주기도 독립적인 경우 서비스 분리를 우선 검토한다.",

      rationale:
        "비즈니스 책임과 변경 주기가 독립적일수록 서비스 간 변경 영향도를 줄이고 독립적인 배포가 가능하기 때문이다.",

      exception:
        "운영 조직과 배포 주기가 동일하고 분리 비용이 큰 경우 하나의 서비스로 유지할 수 있다.",

      evidence: [
        {
          id: "GUIDE-002",
          sourceType: "GUIDELINE",
          title: "Service Boundary Guideline",
          content:
            "Business Capability와 변경 독립성을 기준으로 서비스 경계를 정의한다.",
        },
      ],

      confidence: 94,
    },

    {
      id: "KU-005",
      type: "EXPERT_OPINION",
      typeLabel: "전문가 의견",
      status: "REJECTED",

      knowledge:
        "모든 서비스 간 통신은 비동기 이벤트 방식으로 구현해야 한다.",

      context:
        "서비스 간 통신 방식 결정",

      rule:
        "서비스 결합도를 낮추기 위해 비동기 이벤트 방식을 우선 검토한다.",

      rationale:
        "비동기 통신은 서비스 간 직접적인 의존성을 줄일 수 있지만 모든 업무에서 동일하게 적용할 수 있는 것은 아니다.",

      exception:
        "즉각적인 응답이나 강한 일관성이 필요한 업무에서는 동기 호출이 필요할 수 있다.",

      evidence: [
        {
          id: "INTERVIEW-02",
          sourceType: "EXPERT",
          title: "전문가 인터뷰",
          content:
            "개인적으로는 이벤트 기반 방식을 선호합니다.",
        },
      ],

      confidence: 54,
    },
  ],
};