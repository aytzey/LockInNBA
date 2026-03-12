"use client";

import { Toaster } from "react-hot-toast";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: {
          background: "rgba(17, 24, 41, 0.95)",
          color: "#f5f5f3",
          border: "1px solid rgba(42, 56, 82, 0.6)",
          borderRadius: "12px",
          fontSize: "14px",
          backdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        },
        success: {
          iconTheme: {
            primary: "#00c853",
            secondary: "#0a0e1a",
          },
          style: {
            borderColor: "rgba(0, 200, 83, 0.3)",
          },
        },
        error: {
          iconTheme: {
            primary: "#ff3b3b",
            secondary: "#0a0e1a",
          },
          style: {
            borderColor: "rgba(255, 59, 59, 0.3)",
          },
        },
      }}
    />
  );
}
