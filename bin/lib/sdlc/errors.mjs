// Uniform error format for SDLC ai-kit subcommands (port from Python sdlc/errors.py).
//
// All SDLC subcommands return either:
//
//     Success: { ok: true, data: {...}, warnings: [] }
//     Failure: { ok: false, error: { code, message, details, fix_hint? } }
//
// Error codes are namespaced `MCP_E_<CATEGORY>` (kept identical to Python ref impl
// so skill prompts continue to switch on error.code without rewrite). Skill callers
// branch on error.code to decide retry vs abort vs ask user.

export class SdlcError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, details?: Record<string, unknown>, fixHint?: string }} [opts]
   */
  constructor(message, { code = 'MCP_E_INTERNAL', details = {}, fixHint = null } = {}) {
    super(message);
    this.name = 'SdlcError';
    this.code = code;
    this.details = details;
    this.fixHint = fixHint;
  }

  /** Serialize to uniform tool response (mirrors Python to_response()). */
  toResponse() {
    const err = {
      code: this.code,
      message: this.message,
      details: this.details,
    };
    if (this.fixHint) err.fix_hint = this.fixHint;
    return { ok: false, error: err };
  }
}

// ─── Concrete error subclasses (1:1 with Python errors.py) ───────────

const _make = (code, defaultMessage = '') => class extends SdlcError {
  constructor(message = defaultMessage, opts = {}) {
    super(message, { code, ...opts });
    this.name = code;
  }
};

export const InvalidWorkspaceError       = _make('MCP_E_INVALID_WORKSPACE');
export const InvalidInputError           = _make('MCP_E_INVALID_INPUT');
export const NotFoundError               = _make('MCP_E_NOT_FOUND');
export const AlreadyExistsError          = _make('MCP_E_ALREADY_EXISTS');
export const VersionConflictError        = _make('MCP_E_VERSION_CONFLICT');
export const VerificationFailedError     = _make('MCP_E_VERIFICATION_FAILED');
export const TransactionFailedError      = _make('MCP_E_TRANSACTION_FAILED');
export const ForbiddenError              = _make('MCP_E_FORBIDDEN');
export const TemplateNotFoundError       = _make('MCP_E_TEMPLATE_NOT_FOUND');
export const IdCollisionError            = _make('MCP_E_ID_COLLISION');
export const NameCollisionError          = _make('MCP_E_NAME_COLLISION');
export const NotMonoRepoError            = _make('MCP_E_NOT_MONO');
export const DestructiveNotConfirmedError = _make('MCP_E_DESTRUCTIVE_NOT_CONFIRMED');

/**
 * Build uniform success response.
 * @param {Record<string, unknown>} data
 * @param {Array<Record<string, unknown>>} [warnings]
 */
export function successResponse(data, warnings = []) {
  return { ok: true, data, warnings };
}

/**
 * Wrap impl callable: catch SdlcError → uniform error response; rethrow others.
 * Mirrors Python `_sdlc_call` pattern.
 * @template T
 * @param {() => T} fn
 * @returns {T | { ok: false, error: object }}
 */
export function sdlcCall(fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof SdlcError) return err.toResponse();
    throw err;
  }
}

/**
 * Async variant of sdlcCall.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T | { ok: false, error: object }>}
 */
export async function sdlcCallAsync(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof SdlcError) return err.toResponse();
    throw err;
  }
}
