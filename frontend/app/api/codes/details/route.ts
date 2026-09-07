import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// [GET] 특정 그룹에 속한 세부 코드 목록 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("group_id");
  if (!groupId) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("code_details")
    .select("*")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// [POST] 세부 코드 등록
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from("code_details")
      .insert([body])
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data[0]);
  } catch (err) {
    return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
  }
}

// [PATCH] 세부 코드 수정
export async function PATCH(request: Request) {
  try {
    const { id, ...updateData } = await request.json();
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("code_details")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data[0]);
  } catch (err) {
    return NextResponse.json({ error: "Update Failed" }, { status: 400 });
  }
}

// [DELETE] 세부 코드 삭제
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error } = await supabase
    .from("code_details")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Deleted successfully" });
}