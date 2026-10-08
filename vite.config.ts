import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    host: true, // 같은 Wi-Fi 의 폰에서 접속해 보기 위함
    proxy: { "/api": "http://localhost:8787" },
  },
});
