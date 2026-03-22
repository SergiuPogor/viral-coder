import time
import functools
from threading import Lock

def timer(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = fn(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{fn.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

def memo(fn):
    cache = {}
    @functools.wraps(fn)
    def wrapper(*args):
        if args not in cache:
            cache[args] = fn(*args)
        return cache[args]
    return wrapper

def retry(max_attempts=3, delay=1.0, backoff=2.0):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            wait = delay
            for attempt in range(max_attempts):
                try:
                    return fn(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    print(f"Retry {attempt + 1}/{max_attempts}: {e}")
                    time.sleep(wait)
                    wait *= backoff
        return wrapper
    return decorator

def rate_limit(calls_per_second=5):
    min_interval = 1.0 / calls_per_second
    lock = Lock()
    last_call = [0.0]
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            with lock:
                elapsed = time.time() - last_call[0]
                if elapsed < min_interval:
                    time.sleep(min_interval - elapsed)
                last_call[0] = time.time()
            return fn(*args, **kwargs)
        return wrapper
    return decorator

@timer
@memo
@retry(max_attempts=3, delay=0.5)
@rate_limit(calls_per_second=10)
def fetch_user(user_id):
    print(f"Fetching user {user_id}...")
    return {"id": user_id, "name": f"User #{user_id}"}

print(fetch_user(42))
