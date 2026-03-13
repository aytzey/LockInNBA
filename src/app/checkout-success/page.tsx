"use client";

import { useEffect } from "react";

export default function CheckoutSuccessPage() {
  useEffect(() => {
    // If opened as popup, close it so the parent window's polling picks up the result
    if (window.opener) {
      window.close();
      return;
    }
    // If not a popup (direct redirect), go back to home with the checkout_session param preserved
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id") || params.get("checkout_session");
    if (sessionId) {
      window.location.href = `/?checkout_session=${sessionId}`;
    } else {
      window.location.href = "/";
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0e1a] text-white">
      <div className="text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-[#00c853]/20 flex items-center justify-center">
          <svg className="h-6 w-6 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-semibold">Payment confirmed</p>
        <p className="text-sm text-gray-400">Redirecting back to LOCKIN...</p>
      </div>
    </main>
  );
}
