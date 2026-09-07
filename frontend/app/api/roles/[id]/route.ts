import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. 역할 정보 및 메뉴 권한 수정 (PATCH)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, menu_ids } = body;

    if (!id || id === "undefined") {
      return NextResponse.json({ error: "유효한 ID가 필요합니다." }, { status: 400 });
    }

    // [Step 1] 역할 이름 업데이트
    const { error: roleError } = await supabase
      .from("roles")
      .update({ name })
      .eq("id", id);

    if (roleError) throw roleError;

    // [Step 2] 기존 메뉴 권한 삭제
    const { error: deleteError } = await supabase
      .from("role_menu_access")
      .delete()
      .eq("role_id", id);

    if (deleteError) throw deleteError;

    // [Step 3] 새로운 메뉴 권한 입력
    if (menu_ids && menu_ids.length > 0) {
      const inserts = menu_ids.map((mId: string) => ({
        role_id: id,
        menu_id: mId
      }));

      const { error: insertError } = await supabase
        .from("role_menu_access")
        .insert(inserts);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ message: "수정 완료" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. 역할 삭제 (DELETE) - 로직 강화 버전
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || id === "undefined") {
      return NextResponse.json({ error: "ID가 유효하지 않습니다." }, { status: 400 });
    }

    // 💡 [핵심 추가] 삭제 전, 연관된 메뉴 권한 데이터를 수동으로 먼저 삭제합니다.
    // 외래키 CASCADE 설정이 안 되어 있을 경우를 대비한 가장 확실한 방법입니다.
    const { error: relError } = await supabase
      .from("role_menu_access")
      .delete()
      .eq("role_id", id);
    
    if (relError) {
       console.error("관계 데이터 삭제 실패:", relError.message);
       throw relError;
    }

    // [Step 2] 실제 역할 삭제
    const { error: roleDeleteError } = await supabase
      .from("roles")
      .delete()
      .eq("id", id);

    if (roleDeleteError) {
      // 💡 유저 테이블에서 이 ID를 '필수'로 참조하고 있다면 여기서 에러가 발생합니다.
      return NextResponse.json({ 
        error: "이 역할을 할당받은 사용자가 존재하여 삭제할 수 없습니다. 사용자 목록에서 역할을 먼저 변경해 주세요." 
      }, { status: 400 });
    }

    return NextResponse.json({ message: "삭제 성공" });

  } catch (error: any) {
    console.error("DELETE 서버 에러:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}