package main

import (
"context"
"log"
"net/http"
"os"
"os/signal"
"syscall"
"time"

"DGTYHAC26/internal/config"
"DGTYHAC26/internal/database"
"DGTYHAC26/internal/handlers"
)

func corsMiddleware(next http.Handler) http.Handler {
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

if r.Method == "OPTIONS" {
w.WriteHeader(http.StatusOK)
return
}
next.ServeHTTP(w, r)
})
}

func main() {
log.Println("Starting Invoice Keeper API...")

if err := config.Load(); err != nil {
log.Fatalf("Failed to load config: %v", err)
}
log.Printf("Environment: %s", config.AppConfig.Environment)

db, err := database.InitializeDB()
if err != nil {
log.Fatalf("Failed to initialize database: %v", err)
}
defer db.Close()

mux := http.NewServeMux()

mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
w.Header().Set("Content-Type", "application/json")
w.Write([]byte(`{"status":"ok"}`))
})

authHandler := handlers.NewAuthHandler(db)
mux.HandleFunc("POST /api/v1/auth/login", authHandler.Login)
mux.HandleFunc("GET /api/v1/auth/me", authHandler.Me)
mux.HandleFunc("POST /api/v1/auth/logout", authHandler.Logout)

paymentHandler := handlers.NewPaymentHandler(db)
mux.HandleFunc("GET /api/v1/payments", paymentHandler.GetPayments)
mux.HandleFunc("POST /api/v1/payments", paymentHandler.CreatePayment)
mux.HandleFunc("PATCH /api/v1/payments/{id}", paymentHandler.UpdatePayment)
mux.HandleFunc("DELETE /api/v1/payments/{id}", paymentHandler.DeletePayment)

dashboardHandler := handlers.NewDashboardHandler(db)
mux.HandleFunc("GET /api/v1/payments/summary", dashboardHandler.GetSummary)
mux.HandleFunc("GET /api/v1/payment-occurrences", dashboardHandler.GetOccurrences)

userHandler := handlers.NewUserHandler(db)
mux.HandleFunc("GET /api/v1/users", userHandler.GetUsers)
mux.HandleFunc("POST /api/v1/users", userHandler.CreateUser)
mux.HandleFunc("PATCH /api/v1/users/{id}", userHandler.UpdateUser)
mux.HandleFunc("DELETE /api/v1/users/{id}", userHandler.DeleteUser)

handlerWithCORS := corsMiddleware(mux)

server := &http.Server{
Addr:         config.AppConfig.Addr(),
Handler:      handlerWithCORS,
ReadTimeout:  15 * time.Second,
WriteTimeout: 15 * time.Second,
}

go func() {
log.Printf("API server listening on %s", config.AppConfig.Addr())
if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
log.Fatalf("Server failed: %v", err)
}
}()

quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

log.Println("Shutting down server...")
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
server.Shutdown(ctx)
log.Println("Server exited gracefully")
}
