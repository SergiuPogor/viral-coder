const rules = [
  [3, "Fizz"],
  [5, "Buzz"],
  [7, "Bazz"],
];

const match = (n) =>
  rules
    .filter(([div]) => n % div === 0)
    .map(([, word]) => word)
    .join("") || String(n);

const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const range = (start, end) =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);

const toColumn = (width) => (items) =>
  items.map((s) => s.padEnd(width));

const colorize = (s) =>
  s.match(/[A-Z]/)
    ? `\x1b[36m${s}\x1b[0m`
    : `\x1b[33m${s}\x1b[0m`;

const chunk = (n) => (arr) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
    arr.slice(i * n, i * n + n).join("  ")
  );

const fizzBuzz = pipe(
  (n) => range(1, n),
  (nums) => nums.map(match),
  toColumn(12),
  (items) => items.map(colorize),
  chunk(5),
  (rows) => rows.join("\n")
);

console.log(fizzBuzz(105));
console.log("\n--- Enterprise FizzBuzz v2.0.0 ---");
console.log(`Processed ${105} items with ${rules.length} rules`);
console.log(`Rules: ${rules.map(([d, w]) => `${w}(÷${d})`).join(", ")}`);
