import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("role_id");
    const isAll = searchParams.get("all") === "true";

    if (isAll) {
      const { data: allMenus, error: allMenuError } = await supabase
        .from("menus")
        .select("*")
        .order("sort_order", { ascending: true });

      if (allMenuError) throw allMenuError;

      return NextResponse.json(allMenus || []);
    }

    if (!roleId || roleId === "undefined" || roleId === "null") {
      return NextResponse.json([]);
    }

    const { data: accessData, error: accessError } = await supabase
      .from("role_menu_access")
      .select("menu_id")
      .eq("role_id", roleId);

    if (accessError) throw accessError;

    if (!accessData || accessData.length === 0) {
      return NextResponse.json([]);
    }

    const menuIds = accessData
      .map((item: any) => item.menu_id)
      .filter((id: any) => id !== null && id !== undefined);

    if (menuIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: menus, error: menuError } = await supabase
      .from("menus")
      .select("*")
      .in("id", menuIds)
      .order("sort_order", { ascending: true });

    if (menuError) throw menuError;

    return NextResponse.json(menus || []);
  } catch (error: any) {
    console.error("GET /api/menus error:", error);

    return NextResponse.json(
      { error: error?.message || "메뉴 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, path, icon, sort_order } = body;

    const { data, error } = await supabase
      .from("menus")
      .insert([
        {
          title,
          path,
          icon,
          sort_order: Number(sort_order),
        },
      ])
      .select();

    if (error) throw error;

    return NextResponse.json(data?.[0] || null);
  } catch (error: any) {
    console.error("POST /api/menus error:", error);

    return NextResponse.json(
      { error: error?.message || "메뉴 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}