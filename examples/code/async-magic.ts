type RetryOptions = {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  onRetry?: (error: Error, attempt: number) => void;
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 }
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const jitter = Math.random() * 0.5 + 0.75;
      const delay = Math.min(baseDelay * 2 ** attempt * jitter, maxDelay);

      onRetry?.(error as Error, attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("unreachable");
}

const data = await withRetry(() => fetch("https://api.example.com/data"), {
  maxRetries: 5,
  baseDelay: 500,
  maxDelay: 15000,
  onRetry: (err, n) => console.log(`Retry ${n}: ${err.message}`),
});
