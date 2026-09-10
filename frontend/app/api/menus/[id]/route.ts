import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// [PATCH] 메뉴 수정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // params를 Promise 타입으로 정의
) {
  try {
    // Next.js 15 대응: params를 await로 기다려야 id를 추출할 수 있습니다.
    const { id } = await params; 
    const body = await request.json();
    
    // 프론트엔드 MenusPage의 formData 필드명과 일치시킴
    const { title, path, icon, sort_order } = body;

    const { data, error } = await supabase
      .from("menus")
      .update({ 
        title, 
        path, 
        icon, 
        sort_order: Number(sort_order) 
      })
      .eq("id", id)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "수정할 대상을 찾지 못했습니다." }, { status: 404 });
    }

    return NextResponse.json(data[0]);
  } catch (error: any) {
    console.error("PATCH Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// [DELETE] 메뉴 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // params를 Promise 타입으로 정의
) {
  try {
    // Next.js 15 대응: params를 await로 기다려야 id를 추출할 수 있습니다.
    const { id } = await params;

    // 1. 외래키 제약 조건이 있다면 연결된 데이터(role_menu_access)부터 삭제 시도
    await supabase.from("role_menu_access").delete().eq("menu_id", id);

    // 2. 실제 메뉴 삭제
    const { error } = await supabase
      .from("menus")
      .delete()
      .eq("id", id);
    
    if (error) throw error;

    return NextResponse.json({ message: "성공적으로 삭제되었습니다." });
  } catch (error: any) {
    console.error("DELETE Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}