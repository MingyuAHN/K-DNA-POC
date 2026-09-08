export const gapMock = {
  mission: {
    missionId: "mission-001",
    title: "MSA 서비스 분리 판단 노하우",
  },

  topics: [
    {
      id: "service-boundary",
      label: "Service Boundary",
      coverage: 85,
    },
    {
      id: "data-ownership",
      label: "Data Ownership",
      coverage: 57,
    },
    {
      id: "transaction",
      label: "Transaction",
      coverage: 49,
    },
    {
      id: "exception",
      label: "Exception",
      coverage: 42,
    },
    {
      id: "failure-cases",
      label: "Failure Cases",
      coverage: 21,
    },
  ],

  dimensions: {
    "service-boundary": [
      { dimension: "WHAT", value: 88 },
      { dimension: "WHY", value: 72 },
      { dimension: "WHEN", value: 65 },
      { dimension: "HOW", value: 58 },
      { dimension: "SIGNAL", value: 61 },
      { dimension: "EXCEPTION", value: 44 },
      { dimension: "FAILURE", value: 31 },
      { dimension: "TRADE_OFF", value: 52 },
    ],

    "data-ownership": [
      { dimension: "WHAT", value: 76 },
      { dimension: "WHY", value: 46 },
      { dimension: "WHEN", value: 52 },
      { dimension: "HOW", value: 35 },
      { dimension: "SIGNAL", value: 38 },
      { dimension: "EXCEPTION", value: 21 },
      { dimension: "FAILURE", value: 17 },
      { dimension: "TRADE_OFF", value: 33 },
    ],

    transaction: [
      { dimension: "WHAT", value: 69 },
      { dimension: "WHY", value: 55 },
      { dimension: "WHEN", value: 43 },
      { dimension: "HOW", value: 39 },
      { dimension: "SIGNAL", value: 34 },
      { dimension: "EXCEPTION", value: 29 },
      { dimension: "FAILURE", value: 22 },
      { dimension: "TRADE_OFF", value: 41 },
    ],

    exception: [
      { dimension: "WHAT", value: 61 },
      { dimension: "WHY", value: 48 },
      { dimension: "WHEN", value: 35 },
      { dimension: "HOW", value: 31 },
      { dimension: "SIGNAL", value: 27 },
      { dimension: "EXCEPTION", value: 21 },
      { dimension: "FAILURE", value: 18 },
      { dimension: "TRADE_OFF", value: 30 },
    ],

    "failure-cases": [
      { dimension: "WHAT", value: 42 },
      { dimension: "WHY", value: 33 },
      { dimension: "WHEN", value: 28 },
      { dimension: "HOW", value: 24 },
      { dimension: "SIGNAL", value: 20 },
      { dimension: "EXCEPTION", value: 18 },
      { dimension: "FAILURE", value: 12 },
      { dimension: "TRADE_OFF", value: 25 },
    ],
  },

  recommendedQuestion:
    "Legacy Migration 초기에는 Database per Service를 바로 적용하지 않았던 이유는 무엇인가요?",
};