import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트 초기화
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

const normalizePatchBody = (body: any) => {
  return {
    ...body,

    referral_yn: normalizeReferralYn(body.referral_yn),

    // UUID 컬럼 빈 문자열 오류 방지
    tm_id: emptyToNull(body.tm_id),
    sales_id: emptyToNull(body.sales_id),

    // 날짜 컬럼 빈 문자열 오류 방지
    receipt_date: emptyToNull(body.receipt_date),
    consult_date: emptyToNull(body.consult_date),
    sales_date: emptyToNull(body.sales_date),

    sales_commission:
      body.sales_commission === undefined ||
      body.sales_commission === null ||
      body.sales_commission === ""
        ? 0
        : Number(body.sales_commission),
  };
};

/**
 * 1. 개별 고객 정보 수정 (PATCH)
 * URL: /api/customers/[id]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID가 유효하지 않습니다." },
        { status: 400 }
      );
    }

    const payload = normalizePatchBody(body);

    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase Update Error:", error);
      throw error;
    }

    return NextResponse.json(data?.[0] || null);
  } catch (error: any) {
    console.error("API 개별 수정 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 2. 개별 고객 삭제 (DELETE)
 * URL: /api/customers/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID가 누락되었습니다." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      console.error("Supabase Delete Error:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "고객 정보가 정상적으로 삭제되었습니다.",
    });
  } catch (error: any) {
    console.error("API 개별 삭제 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}