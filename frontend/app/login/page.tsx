"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const redirectToFirstMenu = async (roleId: number | string) => {
    try {
      const menuRes = await fetch(`/api/menus?role_id=${roleId}`, {
        cache: "no-store",
      });

      if (!menuRes.ok) {
        throw new Error("메뉴 조회 실패");
      }

      const menuData = await menuRes.json();

      if (Array.isArray(menuData) && menuData.length > 0 && menuData[0]?.path) {
        router.replace(menuData[0].path);
      } else {
        router.replace("/dashboard");
      }
    } catch (menuError) {
      console.error("메뉴 조회 중 오류 발생:", menuError);
      router.replace("/dashboard");
    }
  };

  useEffect(() => {
    const checkSavedLogin = async () => {
      const savedUser = localStorage.getItem("user");

      if (!savedUser) return;

      try {
        const user = JSON.parse(savedUser);

        if (!user?.role_id) {
          localStorage.removeItem("user");
          return;
        }

        await redirectToFirstMenu(user.role_id);
      } catch (err) {
        console.error("저장된 로그인 정보 확인 중 오류:", err);
        localStorage.removeItem("user");
      }
    };

    checkSavedLogin();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ name, password }),
      });

      const data = await res.json();

      if (res.ok) {
        const userData = {
          name: data.user.name,
          role: data.user.role_name || "시스템 관리자",
          role_id: data.user.role_id,
          role_name: data.user.role_name,
          id: data.user.id,
        };

        localStorage.setItem("user", JSON.stringify(userData));

        await redirectToFirstMenu(data.user.role_id);
      } else {
        setError(data.error || "아이디 또는 비밀번호가 일치하지 않습니다.");
      }
    } catch (err) {
      console.error("로그인 요청 중 오류:", err);
      setError("서버 연결에 실패했습니다. 관리자에게 문의하세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="bg-layer">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="grid-overlay" />
        <div className="noise-overlay" />
      </div>

      <div className="login-content">
        <div className="logo-section">
          <div className="logo-mark">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="logo-text">
            <span className="logo-title">Admin OS</span>
            <span className="logo-divider" />
            <span className="logo-subtitle">관리 시스템</span>
          </div>
        </div>

        <div className="glass-card">
          <div className="card-glow" />

          <div className="card-inner">
            <div className="card-header">
              <h1 className="card-title">로그인</h1>
              <p className="card-desc">관리자 계정으로 접속하세요</p>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <div className="field-group">
                <label className="field-label">이름</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="login-input"
                    placeholder="관리자 성함을 입력하세요"
                    required
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">비밀번호</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                    placeholder="비밀번호를 입력하세요"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="toggle-pw"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={isLoading} className="login-btn">
                {isLoading ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <span>접속하기</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="login-footer">
          © 2026 Admin System · 기업 운영 관리 플랫폼
        </p>
      </div>

      <style jsx>{`
        .login-wrapper {
          --accent: #3B82F6;
          --accent-light: #60A5FA;
          --accent-dark: #2563EB;
          --surface: rgba(255, 255, 255, 0.04);
          --surface-hover: rgba(255, 255, 255, 0.08);
          --border: rgba(255, 255, 255, 0.08);
          --border-focus: rgba(59, 130, 246, 0.5);
          --text-primary: #F1F5F9;
          --text-secondary: #94A3B8;
          --text-muted: #475569;
          --danger: #F43F5E;

          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
          background: #060A13;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .bg-layer { position: fixed; inset: 0; z-index: 0; }
        .gradient-orb { position: absolute; border-radius: 50%; filter: blur(120px); will-change: transform; }
        .orb-1 { width: 650px; height: 650px; background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%); top: -20%; right: -8%; animation: float-1 22s ease-in-out infinite; }
        .orb-2 { width: 550px; height: 550px; background: radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%); bottom: -15%; left: -8%; animation: float-2 28s ease-in-out infinite; }
        .orb-3 { width: 300px; height: 300px; background: radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%); top: 45%; left: 45%; animation: float-3 18s ease-in-out infinite; }
        .grid-overlay { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px); background-size: 64px 64px; mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, black 10%, transparent 70%); }
        .noise-overlay { position: absolute; inset: 0; opacity: 0.03; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E"); background-repeat: repeat; background-size: 256px; }

        @keyframes float-1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-50px, 40px) scale(1.08); } 66% { transform: translate(30px, -25px) scale(0.95); } }
        @keyframes float-2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, -50px) scale(1.06); } 66% { transform: translate(-30px, 20px) scale(0.94); } }
        @keyframes float-3 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(15px, -15px) scale(1.2); } }

        .login-content { position: relative; z-index: 10; width: 100%; max-width: 420px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 28px; animation: content-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.1s; }
        @keyframes content-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .logo-section { display: flex; flex-direction: column; align-items: center; gap: 16px; animation: content-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.2s; }
        .logo-mark { display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 15px; background: linear-gradient(145deg, #3B82F6 0%, #7C3AED 100%); color: white; box-shadow: 0 12px 40px -8px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset; animation: logo-pulse 4s ease-in-out infinite alternate; }
        @keyframes logo-pulse { from { box-shadow: 0 12px 40px -8px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset; } to { box-shadow: 0 16px 56px -8px rgba(59, 130, 246, 0.55), 0 0 0 1px rgba(255,255,255,0.15) inset; } }
        .logo-text { display: flex; align-items: center; gap: 10px; }
        .logo-title { font-size: 20px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px; }
        .logo-divider { width: 1px; height: 14px; background: var(--text-muted); }
        .logo-subtitle { font-size: 14px; font-weight: 500; color: var(--text-secondary); }

        .glass-card { position: relative; width: 100%; border-radius: 24px; overflow: hidden; animation: content-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.35s; }
        .card-glow { position: absolute; top: -1px; left: 20%; right: 20%; height: 1px; background: linear-gradient(90deg, transparent 0%, var(--accent-light) 50%, transparent 100%); opacity: 0.6; z-index: 2; }
        .card-inner { position: relative; z-index: 1; padding: 40px 36px; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(48px) saturate(1.4); -webkit-backdrop-filter: blur(48px) saturate(1.4); border: 1px solid var(--border); border-radius: 24px; box-shadow: 0 32px 80px -12px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255,255,255,0.05) inset; }
        .card-header { margin-bottom: 32px; }
        .card-title { font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.6px; margin: 0 0 6px; }
        .card-desc { font-size: 14px; font-weight: 400; color: var(--text-muted); margin: 0; }

        .login-form { display: flex; flex-direction: column; gap: 20px; }
        .field-group { display: flex; flex-direction: column; gap: 7px; }
        .field-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); padding-left: 2px; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 16px; color: var(--text-muted); pointer-events: none; transition: color 0.25s ease; }
        .input-wrapper:focus-within .input-icon { color: var(--accent-light); }
        .login-input { width: 100%; height: 50px; padding: 0 48px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary); font-family: inherit; font-size: 14px; font-weight: 500; outline: none; transition: all 0.25s ease; }
        .login-input::placeholder { color: var(--text-muted); font-weight: 400; }
        .login-input:focus { border-color: var(--border-focus); background: var(--surface-hover); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08); }
        .toggle-pw { position: absolute; right: 8px; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: none; border-radius: 10px; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s ease; }
        .toggle-pw:hover { background: var(--surface-hover); color: var(--text-secondary); }

        .error-box { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; background: rgba(244, 63, 94, 0.07); border: 1px solid rgba(244, 63, 94, 0.15); color: #FB7185; font-size: 13px; font-weight: 500; animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }

        .login-btn { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 50px; margin-top: 6px; border: none; border-radius: 14px; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%); color: white; font-family: inherit; font-size: 15px; font-weight: 700; letter-spacing: -0.2px; cursor: pointer; overflow: hidden; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 6px 24px -4px rgba(59, 130, 246, 0.35); }
        .login-btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 100%); opacity: 0; transition: opacity 0.3s ease; }
        .login-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 36px -4px rgba(59, 130, 246, 0.45); }
        .login-btn:hover::before { opacity: 1; }
        .login-btn:active { transform: translateY(0) scale(0.99); }
        .login-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2); }
        .login-btn span { position: relative; z-index: 1; }
        .login-btn svg { position: relative; z-index: 1; transition: transform 0.3s ease; }
        .login-btn:hover svg { transform: translateX(3px); }

        .spinner { width: 20px; height: 20px; border: 2.5px solid rgba(255, 255, 255, 0.2); border-top-color: white; border-radius: 50%; animation: spin 0.65s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .login-footer { font-size: 12px; color: var(--text-muted); opacity: 0.5; margin: 0; animation: content-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.5s; }

        @media (max-width: 480px) {
          .card-inner { padding: 32px 24px; }
          .card-title { font-size: 22px; }
          .logo-mark { width: 46px; height: 46px; }
          .logo-mark svg { width: 22px; height: 22px; }
        }
      `}</style>
    </div>
  );
}