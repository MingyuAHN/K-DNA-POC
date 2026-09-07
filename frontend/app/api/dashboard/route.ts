import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ROLE_TM = "cd244076-ae70-489b-a8e4-1a7912bfc222";
const ROLE_SALES = "6f903ef9-ccc8-4f65-94be-41c401067d40";

function getNextDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + 1);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function normalizeText(value: unknown) {
  const text = String(value || "").trim();
  return text === "" ? "미지정" : text;
}

async function fetchCustomersByDateRange(column: string, from: string, to: string) {
  const pageSize = 1000;
  let fromIndex = 0;
  let allRows: any[] = [];

  while (true) {
    let query = supabase
      .from("customers")
      .select("*")
      .order(column, { ascending: true, nullsFirst: false })
      .range(fromIndex, fromIndex + pageSize - 1);

    if (from) {
      query = query.gte(column, from);
    }

    if (to) {
      query = query.lt(column, getNextDate(to));
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = data || [];
    allRows = [...allRows, ...rows];

    if (rows.length < pageSize) break;

    fromIndex += pageSize;
  }

  return allRows;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const [consultFiltered, salesFiltered, uRes, groupRes] = await Promise.all([
      fetchCustomersByDateRange("consult_date", from, to),
      fetchCustomersByDateRange("sales_date", from, to),
      supabase.from("users").select("id, name, role_id"),
      supabase
        .from("code_groups")
        .select("group_code, code_details(code_name, code_value, sort_order)")
        .in("group_code", ["CONSULT_STATUS", "SALES_STATUS"]),
    ]);

    if (uRes.error) throw uRes.error;
    if (groupRes.error) throw groupRes.error;

    const users = uRes.data || [];
    const groups = groupRes.data || [];

    const consultGroup = groups.find(
      (g: any) => g.group_code === "CONSULT_STATUS"
    );

    const salesGroup = groups.find(
      (g: any) => g.group_code === "SALES_STATUS"
    );

    const consultDetails = [...(consultGroup?.code_details || [])].sort(
      (a: any, b: any) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0)
    );

    const salesDetails = [...(salesGroup?.code_details || [])].sort(
      (a: any, b: any) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0)
    );

    const consultCodeToName = Object.fromEntries(
      consultDetails.map((d: any) => [
        String(d.code_value || "").trim(),
        String(d.code_name || "").trim(),
      ])
    );

    const salesCodeToName = Object.fromEntries(
      salesDetails.map((d: any) => [
        String(d.code_value || "").trim(),
        String(d.code_name || "").trim(),
      ])
    );

    const consultHeaders = Array.from(
      new Set([
        ...consultDetails
          .map((d: any) => String(d.code_name || "").trim())
          .filter(Boolean),
        "대기",
        "미지정",
      ])
    );

    const salesHeaders = Array.from(
      new Set([
        ...salesDetails
          .map((d: any) => String(d.code_name || "").trim())
          .filter(Boolean),
        "미지정",
      ])
    );

    const normalizeConsultStatus = (value: unknown) => {
      const raw = String(value || "").trim();

      if (!raw) return "대기";
      if (raw === "대기") return "대기";

      const mapped = consultCodeToName[raw] || raw;

      if (mapped === "대기") return "대기";

      return mapped;
    };

    const normalizeSalesStatus = (value: unknown) => {
      const text = normalizeText(value);

      if (text === "미지정") return "미지정";

      return salesCodeToName[text] || text;
    };

    const tmStats: Record<string, any> = {};
    const salesStats: Record<string, any> = {};

    users.forEach((u: any) => {
      if (u.role_id === ROLE_TM) {
        tmStats[u.id] = {
          id: u.id,
          name: u.name,
          total: 0,
          statusCounts: Object.fromEntries(consultHeaders.map((h) => [h, 0])),
        };
      }

      if (u.role_id === ROLE_SALES) {
        salesStats[u.id] = {
          id: u.id,
          name: u.name,
          total: 0,
          commission: 0,
          statusCounts: Object.fromEntries(salesHeaders.map((h) => [h, 0])),
        };
      }
    });

    consultFiltered.forEach((c: any) => {
      if (!c.tm_id) return;

      if (!tmStats[c.tm_id]) {
        tmStats[c.tm_id] = {
          id: c.tm_id,
          name: users.find((u: any) => u.id === c.tm_id)?.name || "미확인 상담사",
          total: 0,
          statusCounts: Object.fromEntries(consultHeaders.map((h) => [h, 0])),
        };
      }

      tmStats[c.tm_id].total += 1;

      const status = normalizeConsultStatus(c.consult_status);

      if (
        Object.prototype.hasOwnProperty.call(
          tmStats[c.tm_id].statusCounts,
          status
        )
      ) {
        tmStats[c.tm_id].statusCounts[status] += 1;
      } else {
        tmStats[c.tm_id].statusCounts["미지정"] += 1;
      }
    });

    salesFiltered.forEach((c: any) => {
      if (!c.sales_id) return;

      if (!salesStats[c.sales_id]) {
        salesStats[c.sales_id] = {
          id: c.sales_id,
          name: users.find((u: any) => u.id === c.sales_id)?.name || "미확인 영업자",
          total: 0,
          commission: 0,
          statusCounts: Object.fromEntries(salesHeaders.map((h) => [h, 0])),
        };
      }

      salesStats[c.sales_id].total += 1;
      salesStats[c.sales_id].commission += Number(c.sales_commission || 0);

      const status = normalizeSalesStatus(c.sales_status);

      if (
        Object.prototype.hasOwnProperty.call(
          salesStats[c.sales_id].statusCounts,
          status
        )
      ) {
        salesStats[c.sales_id].statusCounts[status] += 1;
      } else {
        salesStats[c.sales_id].statusCounts["미지정"] += 1;
      }
    });

    return NextResponse.json({
      summary: {
        total: salesFiltered.length,
        unassignedTM: salesFiltered.filter((c: any) => !c.tm_id).length,
        unassignedSales: salesFiltered.filter((c: any) => !c.sales_id).length,
        totalCommission: salesFiltered.reduce(
          (acc: number, cur: any) => acc + Number(cur.sales_commission || 0),
          0
        ),
      },
      tmList: Object.values(tmStats),
      salesList: Object.values(salesStats),
      headers: {
        consult: consultHeaders,
        sales: salesHeaders,
      },
      debug: {
        from,
        to,
        consultCount: consultFiltered.length,
        salesCount: salesFiltered.length,
        consultPendingTotal: consultFiltered.filter(
          (c: any) => normalizeConsultStatus(c.consult_status) === "대기"
        ).length,
      },
    });
  } catch (err) {
    console.error("API 집계 에러:", err);

    return NextResponse.json(
      { error: "API 집계 에러" },
      { status: 500 }
    );
  }
}