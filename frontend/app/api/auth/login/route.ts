import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: "이름과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const { data: user, error } = await supabase
      .from("users")
      .select(`
        id,
        name,
        password_hash,
        role_id,
        is_active,
        roles (
          name
        )
      `)
      .eq("name", name.trim())
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json(
        { error: "등록되지 않은 관리자 계정입니다." },
        { status: 401 }
      );
    }

    if (user.is_active === false) {
      return NextResponse.json(
        { error: "비활성화된 계정입니다. 관리자에게 문의하세요." },
        { status: 403 }
      );
    }

    if (user.password_hash !== password) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role_id: user.role_id,
        role_name: Array.isArray(user.roles)
          ? user.roles[0]?.name || "권한 미정"
          : (user.roles as any)?.name || "권한 미정",
      },
    });
  } catch (err) {
    console.error("Server Error:", err);

    return NextResponse.json(
      { error: "시스템 통신 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}