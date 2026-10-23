package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"DGTYHAC26/internal/config"
	"DGTYHAC26/internal/database"
)

func main() {
	log.Println("Starting Invoice Keeper Worker...")

	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.InitializeDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	log.Println("Worker is running... Waiting for tasks")

	// TODO: здесь будут Kafka consumer и scheduler

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Worker shutting down...")
}
