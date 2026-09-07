import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 특정 역할의 메뉴 권한 목록 가져오기 (GET)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role_id = searchParams.get("role_id");

    if (!role_id) {
      return NextResponse.json({ error: "role_id가 필요합니다." }, { status: 400 });
    }

    // role_menu_access 테이블에서 해당 역할의 메뉴 ID들을 조회
    const { data, error } = await supabase
      .from("role_menu_access")
      .select("menu_id")
      .eq("role_id", role_id);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Access GET Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}