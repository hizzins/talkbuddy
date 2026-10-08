import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// HTTPS=1 이면 자체 서명 인증서로 띄운다 — 폰 브라우저는 HTTPS(보안 컨텍스트)에서만 마이크·음성 인식을 허용한다.
const https = process.env.HTTPS === "1";

export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl({ name: "talkbuddy" })] : [])],
  server: {
    port: 5180,
    host: true, // 같은 네트워크의 폰에서 접속해 보기 위함
    proxy: { "/api": "http://localhost:8787" },
  },
});
