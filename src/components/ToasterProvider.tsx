"use client";

import { Toaster } from "react-hot-toast";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: {
          background: "rgba(28, 33, 47, 0.96)",
          color: "#f4efe2",
          border: "1px solid rgba(124, 139, 171, 0.28)",
          borderRadius: "18px",
          fontSize: "14px",
          backdropFilter: "blur(18px)",
          boxShadow: "0 18px 48px rgba(4, 8, 17, 0.42)",
        },
        success: {
          iconTheme: {
            primary: "#7ed17d",
            secondary: "#10131d",
          },
          style: {
            borderColor: "rgba(126, 209, 125, 0.3)",
          },
        },
        error: {
          iconTheme: {
            primary: "#ff6f63",
            secondary: "#10131d",
          },
          style: {
            borderColor: "rgba(255, 111, 99, 0.28)",
          },
        },
      }}
    />
  );
}
