type ApiIssue = { message?: string }
type ApiProblem = { error?: string; issues?: ApiIssue[] }

export async function apiRequest<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const problem = body as ApiProblem | null
    const issueMessage = problem?.issues?.map(issue => issue.message).filter(Boolean).join(' ')
    throw new Error(issueMessage || problem?.error || `Request failed (${response.status})`)
  }
  return body as T
}
