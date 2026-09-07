import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. 역할 목록 조회 (GET)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("roles")
      .select("*") 
      .order("created_at", { ascending: false }); // 최신순 정렬

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET Roles Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. 새 역할 등록 및 메뉴 권한 설정 (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, menu_ids } = body; // 프론트에서 { name: "TEST", menu_ids: [] } 형태로 보냄

    if (!name) {
      return NextResponse.json({ error: "역할 이름(name)은 필수입니다." }, { status: 400 });
    }

    // [Step 1] roles 테이블에 새 역할 추가
    const { data: newRole, error: roleError } = await supabase
      .from("roles")
      .insert([{ name }])
      .select()
      .single(); // 생성된 데이터를 바로 가져옴

    if (roleError) {
      console.error("Supabase Insert Role Error:", roleError.message);
      return NextResponse.json({ error: roleError.message }, { status: 400 });
    }

    // [Step 2] 메뉴 권한(menu_ids)이 있는 경우 role_menu_access에 저장
    // 💡 TEST 처럼 체크박스를 하나도 안 골라도 에러가 나지 않도록 방어 로직 포함
    if (menu_ids && Array.isArray(menu_ids) && menu_ids.length > 0) {
      const accessInserts = menu_ids.map((mId: string) => ({
        role_id: newRole.id, // 방금 생성된 역할의 UUID
        menu_id: mId
      }));

      const { error: accessError } = await supabase
        .from("role_menu_access")
        .insert(accessInserts);

      if (accessError) {
        console.error("Supabase Insert Access Error:", accessError.message);
        // 역할은 생성됐는데 권한 저장만 실패한 경우를 위해 알림 (필요시 역할 삭제 로직 추가 가능)
        return NextResponse.json({ error: "역할은 생성되었으나 메뉴 권한 저장에 실패했습니다." }, { status: 500 });
      }
    }

    // 성공 시 생성된 역할 객체 반환
    return NextResponse.json(newRole);

  } catch (error: any) {
    console.error("POST Roles Server Error:", error.message);
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}