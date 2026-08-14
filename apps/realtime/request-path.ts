export function isSocketIoRequest(url?: string) {
  return url?.startsWith('/socket.io/') ?? false
}
