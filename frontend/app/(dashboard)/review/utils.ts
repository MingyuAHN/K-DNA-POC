export function formatKnowledgeType(
  knowledgeType: string
) {
  return knowledgeType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

export function formatConfidence(
  value: number | null
) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

export function formatContext(
  context: Record<string, unknown>
) {
  if (
    !context ||
    Object.keys(context).length === 0
  ) {
    return "등록된 적용 맥락이 없습니다.";
  }

  const parts = Object.entries(context)
    .filter(([, value]) => {
      if (value === null || value === "") {
        return false;
      }

      if (
        Array.isArray(value) &&
        value.length === 0
      ) {
        return false;
      }

      return true;
    })
    .map(([key, value]) => {
      const label = key
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) =>
          char.toUpperCase()
        );

      if (Array.isArray(value)) {
        return `${label}: ${value.join(", ")}`;
      }

      if (
        typeof value === "object" &&
        value !== null
      ) {
        return `${label}: ${JSON.stringify(value)}`;
      }

      return `${label}: ${String(value)}`;
    });

  return (
    parts.join("\n") ||
    "등록된 적용 맥락이 없습니다."
  );
}

export function formatDecisionRule(
  rule: Record<string, unknown> | null
) {
  if (!rule) {
    return "등록된 판단 규칙이 없습니다.";
  }

  const ifConditions = Array.isArray(
    rule.if_conditions
  )
    ? rule.if_conditions
        .map(String)
        .join(", ")
    : null;

  const then =
    typeof rule.then === "string"
      ? rule.then
      : null;

  const unless = Array.isArray(
    rule.unless
  )
    ? rule.unless
        .map(String)
        .join(", ")
    : null;

  const parts: string[] = [];

  if (ifConditions) {
    parts.push(`IF: ${ifConditions}`);
  }

  if (then) {
    parts.push(`THEN: ${then}`);
  }

  if (unless) {
    parts.push(`UNLESS: ${unless}`);
  }

  if (parts.length > 0) {
    return parts.join("\n");
  }

  return JSON.stringify(
    rule,
    null,
    2
  );
}

export function formatNullableText(
  value: string | null
) {
  return value?.trim() || "등록된 내용이 없습니다.";
}