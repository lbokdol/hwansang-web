export interface LogLine {
  text: string;
  color: string;
}

export class MessageLog {
  lines: LogLine[] = [];
  private max = 60;

  push(text: string, color = "#cdbfa6"): void {
    this.lines.push({ text, color });
    if (this.lines.length > this.max) this.lines.shift();
  }

  recent(n: number): LogLine[] {
    return this.lines.slice(-n);
  }
}
