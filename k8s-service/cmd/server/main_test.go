package main

import (
	"context"
	"io"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
)

func TestServeFinishesInFlightRequestsOnShutdown(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := listener.Addr().String()
	listener.Close()

	requestStarted := make(chan struct{})
	releaseRequest := make(chan struct{})
	e := echo.New()
	e.GET("/slow", func(c *echo.Context) error {
		close(requestStarted)
		<-releaseRequest
		return c.String(http.StatusOK, "done")
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	serveResult := make(chan error, 1)
	go func() { serveResult <- serve(ctx, e, addr) }()

	type response struct {
		body string
		err  error
	}
	responses := make(chan response, 1)
	client := http.Client{Timeout: 5 * time.Second}
	go func() {
		var res *http.Response
		var err error
		for range 50 {
			if res, err = client.Get("http://" + addr + "/slow"); err == nil {
				break
			}
			time.Sleep(10 * time.Millisecond)
		}
		if err != nil {
			responses <- response{err: err}
			return
		}
		defer res.Body.Close()
		body, err := io.ReadAll(res.Body)
		responses <- response{body: string(body), err: err}
	}()

	select {
	case <-requestStarted:
	case got := <-responses:
		t.Fatalf("request ended before reaching the handler: %+v", got)
	case err := <-serveResult:
		t.Fatalf("serve returned before the request arrived: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for the request to start")
	}

	cancel()

	// A server that does not wait for the handler would return here first.
	select {
	case err := <-serveResult:
		t.Fatalf("serve returned with a request still in flight: %v", err)
	case <-time.After(100 * time.Millisecond):
	}
	close(releaseRequest)

	select {
	case got := <-responses:
		if got.err != nil {
			t.Fatalf("in-flight request failed during shutdown: %v", got.err)
		}
		if got.body != "done" {
			t.Fatalf("unexpected body %q", got.body)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for the response")
	}

	select {
	case err := <-serveResult:
		if err != nil {
			t.Fatalf("serve returned an error after a clean shutdown: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("serve did not return after shutdown")
	}
}
