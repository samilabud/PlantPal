/** Throw from anywhere in a handler; `withErrors` turns it into the shared error body. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const unauthorized = (message = 'Not signed in') =>
  new HttpError(401, 'unauthorized', message);
