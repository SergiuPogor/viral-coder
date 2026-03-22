package main

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

type Result struct {
	URL    string
	Status int
	Err    error
}

func fetchAll(urls []string, timeout time.Duration) []Result {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	ch := make(chan Result, len(urls))

	for _, url := range urls {
		go func(u string) {
			req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				ch <- Result{URL: u, Err: err}
				return
			}
			defer resp.Body.Close()
			ch <- Result{URL: u, Status: resp.StatusCode}
		}(url)
	}

	results := make([]Result, 0, len(urls))
	for range urls {
		results = append(results, <-ch)
	}
	return results
}

func main() {
	urls := []string{
		"https://api.github.com",
		"https://httpbin.org/get",
		"https://jsonplaceholder.typicode.com/todos/1",
		"https://catfact.ninja/fact",
	}

	results := fetchAll(urls, 5*time.Second)
	for _, r := range results {
		if r.Err != nil {
			fmt.Printf("[FAIL] %s: %v\n", r.URL, r.Err)
		} else {
			fmt.Printf("[OK]   %s: %d\n", r.URL, r.Status)
		}
	}
}
