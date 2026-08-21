import { getProofLoanErrorCode, cleanProofLoanErrorMessage } from "@shared/proofloan";

type ClientErrorContext = "query" | "mutation" | "runtime";

export type ClientErrorReport = {
  context: ClientErrorContext;
  name: string;
  code: string | null;
  message: string;
  route: string;
  componentStack?: string;
};

const MAX_MESSAGE_LENGTH = 180;
const MAX_STACK_LENGTH = 240;

function bounded(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}

function errorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? bounded(error.name, 80) : "UnknownError";
}

function rawErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown client error";
}

function errorMessage(error: unknown): string {
  return bounded(cleanProofLoanErrorMessage(rawErrorMessage(error)), MAX_MESSAGE_LENGTH);
}

export function createClientErrorReport(context: ClientErrorContext, error: unknown, componentStack?: string): ClientErrorReport {
  const rawMessage = rawErrorMessage(error);
  const message = bounded(cleanProofLoanErrorMessage(rawMessage), MAX_MESSAGE_LENGTH);
  const report: ClientErrorReport = {
    context,
    name: errorName(error),
    code: getProofLoanErrorCode(rawMessage) ?? null,
    message,
    route: typeof window === "undefined" ? "unknown" : bounded(window.location.pathname, 120),
  };
  if (componentStack?.trim()) report.componentStack = bounded(componentStack, MAX_STACK_LENGTH);
  return report;
}

export function reportClientError(context: ClientErrorContext, error: unknown, componentStack?: string): ClientErrorReport {
  const report = createClientErrorReport(context, error, componentStack);
  console.error("[ProofLoan Client Error]", report);
  return report;
}
