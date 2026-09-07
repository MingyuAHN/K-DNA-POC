import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    // 1. 파일을 ArrayBuffer로 읽기
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 2. 엑셀 데이터 파싱
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // 엑셀의 데이터를 JSON 배열로 변환 (header: 1은 행 단위 배열)
    // 실제 데이터는 5행(Index 4)부터 시작하므로 slice 처리
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const dataRows = rows.slice(5); // 양식 설명 4행 + 헤더 1행 제외

    // 3. DB 포맷에 맞게 매핑
    const customersToInsert = dataRows
      .filter(row => row[0]) // 업체명(row[0])이 있는 경우만 필터링
      .map((row) => ({
        company_name: String(row[0] || "").trim(),
        customer_name: String(row[1] || "").trim(),
        landline_phone: String(row[2] || "").trim(),
        mobile_phone: String(row[3] || "").trim(),
        address: String(row[4] || "").trim(),
        note: String(row[5] || "").trim(),
        receipt_date: new Date().toISOString().split('T')[0], // 등록일은 현재 날짜
        consult_status: "대기", // 🌟 엑셀 업로드 시 상담 상태 기본값을 '대기'로 고정
      }));

    if (customersToInsert.length === 0) {
      return NextResponse.json({ error: "등록할 유효한 데이터가 없습니다." }, { status: 400 });
    }

    // 4. Supabase 일괄 삽입 (Bulk Insert)
    const { data, error } = await supabase
      .from("customers")
      .insert(customersToInsert)
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      insertedCount: data.length,
    });

  } catch (error: any) {
    console.error("Excel Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}