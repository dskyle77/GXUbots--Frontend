const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4040").replace(
  /\/$/,
  "",
);

type ApiError = {
  message?: string;
  error?: string;
  errors?: { message?: string }[];
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-GXU-Request": "1",
      ...options.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as
    | (ApiSuccess<T> & ApiError)
    | ApiError
    | null;

  if (!response.ok || !body || !("success" in body) || !body.success) {
    const fieldErrors = body?.errors
      ?.map((item) => item.message)
      .filter(Boolean)
      .join(" ");

    throw new Error(
      fieldErrors ||
        body?.message ||
        body?.error ||
        `Request failed with status ${response.status}`,
    );
  }

  return body.data;
}
