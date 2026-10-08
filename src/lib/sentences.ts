// 스트리밍으로 들어오는 튜터 응답을 문장 단위로 끊어, 끝난 문장부터 바로 읽어 줄 수 있게 한다.
// 문장 끝 = . ! ? (와 닫는 따옴표) 뒤에 공백이 온 지점. 약어(Mr. a.m.)와 소수(4.50)에서는 끊지 않는다.
// 너무 짧은 문장("Oh!")은 다음 문장과 합쳐 읽는다 — 짧게 끊어 읽으면 발화 사이 틈이 어색하다.

const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "st", "jr", "sr", "vs", "etc", "e.g", "i.e", "a.m", "p.m", "u.s", "no"]);
const MIN_WORDS = 3;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export class SentenceSplitter {
  private buf = ""; // 아직 문장 끝이 안 온 부분
  private held = ""; // 짧아서 다음 문장과 합치려고 잡아 둔 문장

  push(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    const re = /[.!?]+["')\]]*(?=\s)/g;
    let cut = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buf))) {
      const end = m.index + m[0].length;
      const before = this.buf.slice(cut, m.index);
      const lastWord = (before.match(/(\S+)$/)?.[1] ?? "").toLowerCase();
      if (m[0].startsWith(".") && ABBREVIATIONS.has(lastWord)) continue;
      this.emit(this.buf.slice(cut, end), out);
      cut = end;
    }
    this.buf = this.buf.slice(cut);
    return out;
  }

  // 스트림이 끝나면 남은 것을 모두 내보낸다.
  flush(): string[] {
    const rest = `${this.held} ${this.buf}`.replace(/\s+/g, " ").trim();
    this.held = "";
    this.buf = "";
    return rest ? [rest] : [];
  }

  private emit(sentence: string, out: string[]) {
    const s = `${this.held} ${sentence}`.replace(/\s+/g, " ").trim();
    if (!s) return;
    if (words(s) < MIN_WORDS) {
      this.held = s;
      return;
    }
    this.held = "";
    out.push(s);
  }
}
