import {
  AlertTriangle,
  CircleAlert,
  Database,
  Layers3,
  Link2,
  type LucideIcon,
} from "lucide-react";

export const coverageIconMap: Record<string, LucideIcon> = {
  layers: Layers3,
  database: Database,
  link: Link2,
  alert: CircleAlert,
  warning: AlertTriangle,
};

// 메시지 시간
export function formatMessageTime(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// 인터뷰 생성일
export function formatInterviewDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// 인터뷰 상태
export function getInterviewStatusLabel(status: string) {
  switch (status) {
    case "CREATED":
      return "생성됨";

    case "IN_PROGRESS":
      return "진행 중";

    case "COMPLETED":
      return "종료";

    case "CANCELLED":
      return "취소";

    default:
      return status;
  }
}