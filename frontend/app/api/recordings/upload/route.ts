import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET_NAME = "recordings";

function extractStoragePathFromPublicUrl(fileUrl: string) {
  try {
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const index = fileUrl.indexOf(marker);

    if (index === -1) return null;

    return decodeURIComponent(fileUrl.substring(index + marker.length));
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get("customer_id");

    if (!customer_id) {
      return NextResponse.json(
        { error: "고객 ID가 없습니다." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("customer_recordings")
      .select("*")
      .eq("customer_id", customer_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "녹취 목록 조회 실패" },
      { status: 500 }
    );
  }
}

// 파일 업로드 X, DB 저장만 담당
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      customer_id,
      file_name,
      file_url,
      created_by,
      duration = null,
    } = body;

    if (!customer_id || !file_name || !file_url) {
      return NextResponse.json(
        { error: "고객 ID, 파일명, 파일 URL이 필요합니다." },
        { status: 400 }
      );
    }

    const payload: Record<string, any> = {
      customer_id,
      file_name,
      file_url,
      duration,
    };

    if (created_by) {
      payload.created_by = created_by;
    }

    const { data, error } = await supabase
      .from("customer_recordings")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "녹취 정보 저장 실패" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const recordingId = body?.id as string | undefined;

    if (!recordingId) {
      return NextResponse.json(
        { error: "녹취 ID가 없습니다." },
        { status: 400 }
      );
    }

    const { data: recording, error: findError } = await supabase
      .from("customer_recordings")
      .select("id, file_url")
      .eq("id", recordingId)
      .single();

    if (findError || !recording) {
      return NextResponse.json(
        { error: "녹취 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const storagePath = extractStoragePathFromPublicUrl(recording.file_url);

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      if (storageError) {
        return NextResponse.json(
          { error: storageError.message },
          { status: 500 }
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("customer_recordings")
      .delete()
      .eq("id", recordingId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: "녹취 파일이 삭제되었습니다.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "녹취 삭제 실패" },
      { status: 500 }
    );
  }
}