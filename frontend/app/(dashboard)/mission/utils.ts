export const formatMissionDate = (
  createdAt: string
) => {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );
};

export const getMissionStatusLabel = (
  status: string
) => {
  switch (status) {
    case "CREATED":
      return "생성됨";

    case "IN_PROGRESS":
      return "진행 중";

    case "COMPLETED":
      return "완료";

    case "CANCELLED":
      return "취소";

    default:
      return status;
  }
};

export const inputClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export const iconInputClass =
  "h-11 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export const labelClass =
  "text-sm font-bold text-slate-800";