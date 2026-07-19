export class RankWorkerBlogError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;

  public constructor(message: string, options: { code: string; cause?: unknown }) {
    super(message);
    this.name = "RankWorkerBlogError";
    this.code = options.code;
    this.cause = options.cause;
  }
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
