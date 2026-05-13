export class ApiError extends Error {
  code: string
  status: number

  constructor(msg: string, code: string, status: number) {
    super(msg)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'NOT_FOUND'
}

export function isOffline(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'OFFLINE'
}

export function isConflict(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'CONFLICT'
}
