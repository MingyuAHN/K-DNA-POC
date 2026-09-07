import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. 사용자 전체 목록 조회 (GET)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(`
        *,
        roles (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 프론트엔드 테이블에서 user.role_name으로 바로 쓸 수 있게 가공
    const formattedData = data.map((user: any) => ({
      ...user,
      role_name: user.roles?.name || "미지정"
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("GET 에러 상세:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. 신규 사용자 등록 (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 프론트엔드 Payload 추출
    const { name, email, phone, role_id, password, is_active } = body;

    // 데이터 유효성 검사 (최소한의 방어 로직)
    if (!name) {
      return NextResponse.json({ error: "이름과 이메일은 필수 항목입니다." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("users")
      .insert([
        { 
          name, 
          email, 
          phone, 
          role_id,           // 💡 DB 컬럼명 role_id 사용
          password_hash: password || "default123", // 💡 DB 컬럼명 password_hash 사용
          is_active: is_active ?? true
        }
      ])
      .select();

    if (error) {
      console.error("Supabase 등록 에러:", error);
      // RLS 정책 위반이나 중복 이메일 등의 에러가 여기서 처리됨
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data[0], { status: 201 });
  } catch (error: any) {
    console.error("서버 내부 에러:", error);
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}