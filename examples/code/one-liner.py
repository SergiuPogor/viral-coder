# fibonacci: infinite generator in one line
fib = lambda: (l := [0, 1], [(l.append(l[-1] + l[-2]), l[-1])[1] for _ in range(20)])[-1]

# prime sieve up to n
primes = lambda n: [x for x in range(2, n) if all(x % d for d in range(2, int(x**0.5) + 1))]

# flatten any nested list
flatten = lambda x: [i for s in x for i in (flatten(s) if isinstance(s, list) else [s])]

# matrix transpose
transpose = lambda m: list(map(list, zip(*m)))

# palindrome check ignoring spaces and case
is_palindrome = lambda s: (c := [x.lower() for x in s if x.isalnum()]) == c[::-1]

# group by key
group_by = lambda items, key: {k: [x for x in items if key(x) == k] for k in set(map(key, items))}

# chunk a list into groups of n
chunk = lambda lst, n: [lst[i:i+n] for i in range(0, len(lst), n)]

# frequency counter without collections
freq = lambda s: {c: s.count(c) for c in set(s)}

# decode caesar cipher
caesar = lambda s, n: "".join(chr((ord(c) - 97 + n) % 26 + 97) if c.isalpha() else c for c in s.lower())

# memoize any function
memo = lambda f: (cache := {}) or (lambda *a: cache.setdefault(a, f(*a)))

print(primes(50))
print(flatten([1, [2, [3, [4]], 5]]))
print(is_palindrome("A man a plan a canal Panama"))
