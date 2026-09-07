import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const normalizeReferralYn = (value: unknown) => {
  return String(value || "N").toUpperCase() === "Y" ? "Y" : "N";
};

const emptyToNull = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const text = String(value).trim();
  return text === "" ? null : value;
};

const getTodayDate = () => {
  return new Date().toISOString().split("T")[0];
};

const buildCreatePayload = (body: any) => {
  const consultStatus =
    typeof body.consult_status === "string" && body.consult_status.trim() !== ""
      ? body.consult_status
      : "대기";

  return {
    ...body,

    referral_yn: normalizeReferralYn(body.referral_yn),
    consult_status: consultStatus,

    receipt_date: emptyToNull(body.receipt_date),
    consult_date: emptyToNull(body.consult_date),
    sales_date: emptyToNull(body.sales_date),

    tm_id: emptyToNull(body.tm_id),
    sales_id: emptyToNull(body.sales_id),

    sales_commission:
      body.sales_commission === undefined ||
      body.sales_commission === null ||
      body.sales_commission === ""
        ? 0
        : Number(body.sales_commission),
  };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const tm_id = searchParams.get("tm_id") || "all";
    const sales_id = searchParams.get("sales_id") || "all";
    const consult_status = searchParams.get("consult_status") || "all";
    const sales_status = searchParams.get("sales_status") || "all";
    const date_type = searchParams.get("date_type") || "영업일";
    const date_from = searchParams.get("date_from") || "";
    const date_to = searchParams.get("date_to") || "";

    const limitParam = Number(searchParams.get("limit") || "10");
    const offsetParam = Number(searchParams.get("offset") || "0");

    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 10;

    const offset =
      Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

    const getNextDate = (dateStr: string) => {
      const date = new Date(`${dateStr}T00:00:00`);
      date.setDate(date.getDate() + 1);

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");

      return `${yyyy}-${mm}-${dd}`;
    };

    const dateColumn = date_type === "상담일" ? "consult_date" : "sales_date";

    const buildQuery = () => {
      let query = supabase.from("customers").select("*", { count: "exact" });

      if (search) {
        query = query.or(
          `customer_name.ilike.%${search}%,company_name.ilike.%${search}%,mobile_phone.ilike.%${search}%`
        );
      }

      if (tm_id === "unassigned") {
        query = query.is("tm_id", null);
      } else if (tm_id === "assigned") {
        query = query.not("tm_id", "is", null);
      } else if (tm_id !== "all" && tm_id !== "") {
        query = query.eq("tm_id", tm_id);
      }

      if (sales_id === "unassigned") {
        query = query.is("sales_id", null);
      } else if (sales_id === "assigned") {
        query = query.not("sales_id", "is", null);
      } else if (sales_id !== "all" && sales_id !== "") {
        query = query.eq("sales_id", sales_id);
      }

      if (consult_status !== "all" && consult_status !== "") {
        query = query.eq("consult_status", consult_status);
      }

      if (sales_status !== "all" && sales_status !== "") {
        query = query.eq("sales_status", sales_status);
      }

      if (date_from) {
        query = query.gte(dateColumn, date_from);
      }

      if (date_to) {
        const nextDate = getNextDate(date_to);
        query = query.lt(dateColumn, nextDate);
      }

      return query.order(dateColumn, {
        ascending: false,
        nullsFirst: false,
      });
    };

    const batchSize = 1000;
    const allData: any[] = [];
    let totalCount = 0;
    let currentOffset = offset;

    while (allData.length < limit) {
      const remaining = limit - allData.length;
      const currentBatchSize = Math.min(batchSize, remaining);

      const from = currentOffset;
      const to = currentOffset + currentBatchSize - 1;

      const { data, error, count } = await buildQuery().range(from, to);

      if (error) throw error;

      if (typeof count === "number") {
        totalCount = count;
      }

      if (!data || data.length === 0) {
        break;
      }

      allData.push(...data);

      if (data.length < currentBatchSize) {
        break;
      }

      currentOffset += currentBatchSize;
    }

    return NextResponse.json({
      data: allData,
      totalCount,
    });
  } catch (error: any) {
    console.error("고객 조회 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = buildCreatePayload(body);

    const { data, error } = await supabase
      .from("customers")
      .insert([payload])
      .select();

    if (error) throw error;

    return NextResponse.json(data?.[0] || null);
  } catch (error: any) {
    console.error("고객 등록 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { ids, type, assignee_id } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "선택된 고객이 없습니다." },
        { status: 400 }
      );
    }

    if (type !== "TM" && type !== "SALES") {
      return NextResponse.json(
        { error: "배정 유형이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const column = type === "TM" ? "tm_id" : "sales_id";

    const updateValue =
      assignee_id === "" ||
      assignee_id === "all" ||
      assignee_id === "unassigned"
        ? null
        : assignee_id;

    const updatePayload: Record<string, any> = {
      [column]: updateValue,
    };

    // 상담사 일괄 배정 시 상담 날짜를 당일로 자동 설정
    if (type === "TM" && updateValue) {
      updatePayload.consult_date = getTodayDate();
    }

    // 영업자 일괄 배정 시에만 영업 상태를 "방문 전"으로 자동 설정
    if (type === "SALES" && updateValue) {
      updatePayload.sales_status = "방문 전";
    }

    const { error } = await supabase
      .from("customers")
      .update(updatePayload)
      .in("id", ids);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("일괄 배정 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "삭제할 고객 정보가 선택되지 않았습니다." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .in("id", ids);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${ids.length}건의 고객 정보가 삭제되었습니다.`,
    });
  } catch (error: any) {
    console.error("일괄 삭제 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}