// ============================================================
// Erros padronizados — Portal de Orçamentos
// ============================================================

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource.toUpperCase()}_NOT_FOUND`,
      id ? `${resource} '${id}' não encontrado.` : `${resource} não encontrado.`,
      404,
    )
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado.') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado.') {
    super('FORBIDDEN', message, 403)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 422, details)
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      'INVALID_STATUS_TRANSITION',
      `Transição de status '${from}' para '${to}' não é permitida.`,
      422,
    )
  }
}
