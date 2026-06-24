export type StudentRouteSearchParams = Record<string, string | string[] | undefined>;

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveStudentRouteDemoStepId(searchParams: StudentRouteSearchParams | undefined): string | undefined {
  return firstQueryValue(searchParams?.step)?.trim() || undefined;
}
