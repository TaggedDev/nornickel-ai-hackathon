export type AuthUser = {
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  roleDisplayName: string;
};

export type LoginRequest = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type RegisterRequest = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  roleName: string;
};

export type ValidationErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  errors?: ValidationErrors;

  constructor(message: string, status: number, errors?: ValidationErrors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const problem = payload as { title?: string; errors?: ValidationErrors } | null;
  throw new ApiError(problem?.title ?? `Request failed with status ${response.status}`, response.status, problem?.errors);
}

export async function login(request: LoginRequest): Promise<AuthUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseApiResponse<AuthUser>(response);
}

export async function register(request: RegisterRequest): Promise<AuthUser> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return parseApiResponse<AuthUser>(response);
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiError(`Logout failed with status ${response.status}`, response.status);
  }
}

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const params = new URLSearchParams({ email });
  const response = await fetch(`/api/auth/check-email?${params.toString()}`, {
    credentials: "include",
  });

  const payload = await parseApiResponse<{ isAvailable: boolean }>(response);
  return payload.isAvailable;
}
