"use client";

import { usePathname, useRouter } from "next/navigation"; // 💡 useRouter 추가
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter(); // 💡 router 인스턴스 생성
  
  const [userName, setUserName] = useState("사용자");
  const [userRole, setUserRole] = useState("권한 미정");

  useEffect(() => {
    // 1. 로컬 스토리지에서 유저 정보 확인
    const storedUser = localStorage.getItem("user");

    // 2. 정보가 없으면 로그인 페이지로 강제 이동
    if (!storedUser) {
      // alert("로그인이 필요한 서비스입니다."); // 필요 시 주석 해제하여 사용하세요.
      router.replace("/login"); // 뒤로가기를 방지하기 위해 push 대신 replace 권장
      return;
    }

    try {
      // 3. 정보가 있다면 데이터 파싱 및 상태 업데이트
      const parsed = JSON.parse(storedUser);

      setUserName(parsed?.name || "사용자");
      setUserRole(
        parsed?.role_name || parsed?.role || parsed?.roles?.name || "권한 미정"
      );
    } catch (error) {
      console.error("유저 정보 파싱 에러", error);
      // 데이터가 형식이 맞지 않거나 깨진 경우에도 로그인 페이지로 보냅니다.
      router.replace("/login");
    }
  }, [router]); // router 객체를 의존성 배열에 추가

  // 현재 경로 이름을 한글로 매핑하는 로직
  const displayName = useMemo(() => {
    const cleanPath = pathname.split("?")[0].split("#")[0];
    const segments = cleanPath.split("/").filter(Boolean);
    const currentPathName = segments[segments.length - 1] || "dashboard";

    const pathMap: Record<string, string> = {
      dashboard: "대시보드",
      users: "사용자 관리",
      roles: "역할 관리",
      menus: "메뉴 관리",
      codes: "코드 관리",
      customers: "고객 관리",
      "consult-history": "상담내역",
      "sales-history": "영업내역",
    };

    return pathMap[currentPathName] || currentPathName;
  }, [pathname]);

  // 아바타에 표시할 이름 첫 글자
  const initial = userName?.[0] || "사";

  return (
    <div className="header-shell">
      <div className="title-block">
        <div className="meta-line">
          <span>관리 시스템</span>
          <ChevronRight size={12} className="meta-sep" />
          <span>운영 영역</span>
        </div>

        <div className="title-row">
          <span className="title-dot" />
          <h1 className="title-text">{displayName}</h1>
        </div>
      </div>

      <div className="action-group">
        {/* 알림 버튼 */}
        <button type="button" className="icon-btn" aria-label="알림">
          <span className="icon-shine" />
          <Bell size={18} className="icon-main" />
          <span className="alert-dot-wrap">
            <span className="alert-dot-ping" />
            <span className="alert-dot" />
          </span>
        </button>

        {/* 프로필 카드 섹션 */}
        <div className="profile-card">
          <div className="profile-copy">
            <span className="profile-name">{userName}</span>
            <span className="profile-role">{userRole}</span>
          </div>

          <div className="profile-avatar">{initial}</div>
        </div>
      </div>

      {/* 스타일은 별도의 CSS 파일 혹은 기존 방식을 그대로 유지하세요 */}
    </div>
  );
}