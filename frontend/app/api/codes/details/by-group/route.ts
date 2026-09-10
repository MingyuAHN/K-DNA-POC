import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupCode = searchParams.get("group_code");

  if (!groupCode) {
    return NextResponse.json({ error: "group_code is required" }, { status: 400 });
  }

  try {
    // 1. group_code로 group_id 조회
    const { data: groupData, error: groupError } = await supabase
      .from("code_groups")
      .select("id")
      .eq("group_code", groupCode)
      .single();

    if (groupError || !groupData) throw new Error("Group not found");

    // 2. 해당 ID를 가진 사용 중인(is_use: true) 상세 코드만 조회
    const { data: details, error: detailError } = await supabase
      .from("code_details")
      .select("code_value, code_name, sort_order")
      .eq("group_id", groupData.id)
      .eq("is_use", true)
      .order("sort_order", { ascending: true });

    if (detailError) throw detailError;

    return NextResponse.json(details);
  } catch (error: any) {
    console.error("Common Code Fetch Error:", error.message);
    // 에러 발생 시 서비스 중단을 막기 위해 빈 배열 반환
    return NextResponse.json([], { status: 200 }); 
  }
}