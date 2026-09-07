import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id || id === "undefined") {
      return NextResponse.json({ error: "유효한 ID가 필요합니다." }, { status: 400 });
    }

    const body = await request.json();
    const { name, email, phone, role_id, password, is_active } = body;

    const updateData: any = {
      name,
      email,
      phone,
      role_id,
      is_active,
    };

    if (password && password.trim() !== "") {
      updateData.password_hash = password;
    }

    // 💡 .single()을 제거하고 배열로 받아서 안전하게 처리합니다.
    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase PATCH Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 💡 데이터가 없는 경우 (ID가 틀렸거나 RLS에 막혔을 때)
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "수정할 대상을 찾지 못했거나 권한이 없습니다." }, { status: 404 });
    }

    // 💡 결과 데이터를 JSON 직렬화가 가능한 깨끗한 객체로 변환
    const result = {
      id: data[0].id,
      name: data[0].name,
      email: data[0].email,
      phone: data[0].phone,
      role_id: data[0].role_id,
      is_active: data[0].is_active,
      created_at: String(data[0].created_at),
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Server PATCH Error:", error.message);
    return NextResponse.json({ error: String(error.message) }, { status: 500 });
  }
}

// 2. 사용자 삭제 (DELETE)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // 💡 params를 Promise로 정의
) {
  try {
    // 💡 params를 await 하여 id를 확실히 가져옴 (undefined 방지)
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id || id === "undefined") {
      return NextResponse.json({ error: "유효한 ID가 제공되지 않았습니다." }, { status: 400 });
    }

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase DELETE Error:", error.message);
      // 외래키 제약 조건(연관 데이터 존재) 시 에러 메시지 반환
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "삭제 성공" });
  } catch (error: any) {
    console.error("Server DELETE Error:", error.message);
    return NextResponse.json({ error: "삭제 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}