export const PEER39_ERROR_CODES: Readonly<Record<number, string>> = Object.freeze({
  0: 'Success',
  1: 'Failed to delete or create custom category',
  6: 'Account ID not found',
  10: 'Invalid category name (contains illegal characters)',
  13: 'URL is empty — a valid URL is required to create a custom URL category',
  16: 'Category is inactive',
  29: 'Keywords list is null or empty',
  31: 'Invalid Account ID',
  34: 'Invalid safeFrom value',
  38: 'Invalid language code',
  42: 'Category name is too long (max 120 chars)',
  44: 'Invalid keywords',
  47: 'Invalid type',
  49: 'Invalid URLs',
  50: 'Max field exceeded the maximum system limit (or below minimum, or invalid sort)',
  51: 'Invalid Buyer ID',
  58: 'Invalid email address',
  60: 'Invalid expiration date',
  62: 'Invalid expiration date',
  63: 'Invalid system parameter — the `system` header is wrong or missing',
});

export class Peer39ApiError extends Error {
  public readonly code: number;
  public readonly apiMessage: string;

  constructor(code: number, apiMessage: string, message?: string) {
    const human = PEER39_ERROR_CODES[code];
    super(message ?? `[code ${code}] ${human ?? apiMessage}`);
    this.name = 'Peer39ApiError';
    this.code = code;
    this.apiMessage = apiMessage;
  }
}

// Replaces the desktop MCP's MissingConfigError. In the Connector world, missing
// per-user setup is fixed via the /setup web UI, not via a chat tool.
export class MissingPeer39SetupError extends Error {
  public readonly userSub: string;
  public readonly setupUrl: string;

  constructor(userSub: string, setupUrl: string) {
    super(`Please complete setup at ${setupUrl} before using this tool.`);
    this.name = 'MissingPeer39SetupError';
    this.userSub = userSub;
    this.setupUrl = setupUrl;
  }
}
